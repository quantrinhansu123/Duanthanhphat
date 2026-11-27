import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadTs(relPath, resolver) {
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(new URL(relPath, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (id) => {
      if (resolver) return resolver(id);
      return {};
    },
  });
  return exports;
}

const machineAssignments = loadTs("../src/data/machineAssignments.ts");
const oil = loadTs("../src/lib/engineOilAlerts.ts", (id) => {
  if (id.includes("machineAssignments")) return machineAssignments;
  return {};
});

// 1. Kiểm tra các hằng số theo đúng bảng quy tắc Excel
assert.equal(oil.ENGINE_OIL_BASE_HOURS, 250, "Số giờ định mức = 250 giờ");
assert.equal(oil.ENGINE_OIL_MAX_HOURS, 275, "Số giờ cho phép (+10%) = 275 giờ");
assert.equal(oil.ENGINE_OIL_AVG_WELDS_PER_DAY, 21, "Năng suất trung bình = 21 mối/ngày");
assert.equal(oil.ENGINE_OIL_HOURS_PER_DAY, 8, "Số giờ hoạt động trong ngày = 8 giờ");
assert.equal(oil.ENGINE_OIL_WELDS_PER_HOUR, 2.625, "Năng suất mối/giờ = 21/8 = 2.625");
assert.equal(oil.ENGINE_OIL_RED_ALERT_WELDS, 656, "Cảnh báo đỏ khi đạt 656 mối");
assert.equal(oil.ENGINE_OIL_INTERVAL_HOURS, 275, "Alias tương thích = 275 giờ");
assert.equal(oil.ENGINE_OIL_WARN_HOURS, 250, "Alias cảnh báo sớm = 250 giờ");

function makeSchedule(overrides) {
  return {
    id: "s-1",
    date: "2026-11-10",
    machineId: "m-1",
    machineCode: "KCM-01",
    machineName: "Máy hàn KCM-01",
    location: "",
    operatingHours: 8,
    projectId: "",
    projectName: "",
    personInChargeId: "",
    personInChargeName: "",
    fuelAddedLiters: 0,
    pumpOpened: false,
    machineCondition: "",
    conditionDescription: "",
    recommendation: "",
    imageAssets: [],
    weldCount: 21,
    ...overrides,
  };
}

function makeFuel(overrides) {
  return {
    id: "f-1",
    date: "2026-11-10",
    machineId: "m-1",
    machineCode: "KCM-01",
    machineName: "Máy hàn KCM-01",
    liters: 0,
    remaining: 0,
    added: 0,
    hasActual: false,
    engineOilLiters: null,
    generatorHours: null,
    unit: "lít",
    personId: "",
    personName: "—",
    note: "",
    ...overrides,
  };
}

// 2. Máy chạy dưới ngưỡng -> ok, không có cảnh báo
{
  const schedules = [
    makeSchedule({ date: "2026-11-01", operatingHours: 200, weldCount: 500 }),
  ];
  const statuses = oil.computeEngineOilStatuses(schedules, []);
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].level, "ok");
  assert.equal(statuses[0].overdue, false);
  assert.equal(oil.engineOilWarnings(schedules, []).length, 0);
}

// 3. Máy đạt định mức 250 giờ (dưới 275h và dưới 656 mối) -> cảnh báo vàng (warning)
{
  const schedules = [
    makeSchedule({ date: "2026-11-05", operatingHours: 250, weldCount: 520 }),
  ];
  const warnings = oil.engineOilWarnings(schedules, []);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].level, "warning");
  assert.equal(warnings[0].overdue, false);
  assert.equal(warnings[0].reachedBaseHours, true);
  assert.equal(warnings[0].reachedRedWelds, false);
}

// 4. Máy đạt ngưỡng cảnh báo đỏ 656 mối (dù giờ mới 240h) -> cảnh báo đỏ (danger)
{
  const schedules = [
    makeSchedule({ date: "2026-11-01", operatingHours: 120, weldCount: 330 }),
    makeSchedule({ date: "2026-11-02", operatingHours: 120, weldCount: 326 }),
  ];
  const warnings = oil.engineOilWarnings(schedules, []);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].level, "danger");
  assert.equal(warnings[0].overdue, true);
  assert.equal(warnings[0].reachedRedWelds, true);
  assert.equal(warnings[0].welds, 656);
  assert.equal(warnings[0].hours, 240);
}

// 5. Máy đạt 275 giờ (dù số mối < 656) -> cảnh báo đỏ (danger)
{
  const schedules = [
    makeSchedule({ date: "2026-11-05", operatingHours: 275, weldCount: 500 }),
  ];
  const warnings = oil.engineOilWarnings(schedules, []);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].level, "danger");
  assert.equal(warnings[0].overdue, true);
  assert.equal(warnings[0].reachedMaxHours, true);
}

// 6. Chỉ đổ dầu máy phát (engineOilLiters = null) KHÔNG tắt cảnh báo dầu động cơ
{
  const schedules = [
    makeSchedule({ date: "2026-11-05", operatingHours: 260, weldCount: 660 }),
  ];
  const fuels = [
    makeFuel({ date: "2026-11-06", added: 80, engineOilLiters: null, generatorHours: null }),
  ];
  const warnings = oil.engineOilWarnings(schedules, fuels);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].level, "danger");
  assert.equal(warnings[0].since, null);
}

// 7. Sau khi đổ dầu động cơ (engineOilLiters > 0) -> loại bỏ cảnh báo
{
  const schedules = [
    makeSchedule({ date: "2026-11-05", operatingHours: 275, weldCount: 680 }),
  ];
  const fuels = [
    makeFuel({ date: "2026-11-05", engineOilLiters: 18, generatorHours: 1275 }),
  ];
  const statuses = oil.computeEngineOilStatuses(schedules, fuels);
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].level, "ok");
  assert.equal(statuses[0].hours, 0);
  assert.equal(statuses[0].welds, 0);
  assert.equal(statuses[0].since, "2026-11-05");
  assert.equal(oil.engineOilWarnings(schedules, fuels).length, 0);
}

// 8. Lượt chạy mới sau ngày đổ dầu bắt đầu cộng dồn lại từ 0; hỗ trợ alias code:...
{
  const codeMap = oil.buildCodeToMachineIdMap([{ id: "uuid-kcm1", code: "KCM-01" }]);
  const schedules = [
    makeSchedule({ date: "2026-11-01", machineId: "code:KCM-01", operatingHours: 275, weldCount: 700 }),
    makeSchedule({ date: "2026-11-10", machineId: "uuid-kcm1", operatingHours: 16, weldCount: 42 }),
  ];
  const fuels = [
    makeFuel({ date: "2026-11-05", machineId: "uuid-kcm1", engineOilLiters: 18, generatorHours: 1275 }),
  ];
  const statuses = oil.computeEngineOilStatuses(schedules, fuels, codeMap);
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].machineId, "uuid-kcm1");
  assert.equal(statuses[0].hours, 16);
  assert.equal(statuses[0].welds, 42);
  assert.equal(statuses[0].level, "ok");
}

console.log("PASS: engine oil alert rules (250h / 275h / 656 welds / reset after refill)");
