import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const text = fs.readFileSync(new URL("../src/components/OverviewDashboard.tsx", import.meta.url), "utf8");
const source = ts.createSourceFile("overview.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node.initializer);
  if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node);
  ts.forEachChild(node, visit);
}
visit(source);
function evaluate(name, context) {
  const node = declarations.get(name);
  const expression = ts.isFunctionDeclaration(node) ? `(${node.getText(source)})` : node.getText(source);
  return vm.runInNewContext(ts.transpile(`const result = ${expression}; result;`, { target: ts.ScriptTarget.ES2020 }), {
    useMemo: (fn) => fn(), ...context,
  });
}
// planRows dùng lịch đã lưu (theoreticalProgress); chỉ khi thiếu lịch mới gọi buildDailyWeldPlan.
const planRows = evaluate("planRows", { buildDailyWeldPlan: () => [] });
const range = evaluate("scheduledWeldsInRange", { planRows });
const project = { id: "p", name: "P", startDate: "2026-01-01", endDate: "2026-12-31", plannedWeldCount: 1000,
  theoreticalProgress: [{ ngay: "2026-01-01", so_moi_han: 10 }, { ngay: "2026-12-01", so_moi_han: 990 }] };
assert.equal(range(project, "2026-01-01", "2026-09-08"), 10, "Future plans do not count as due");
assert.equal(range(project, "2026-02-01", "2026-02-28"), 0, "No fallback production on days with zero plan");
for (const [actualToDate, plannedToDate, expected] of [[10, 10, "ĐÚNG TIẾN ĐỘ"], [9, 10, "CHẬM TIẾN ĐỘ"], [11, 10, "VƯỢT TIẾN ĐỘ"], [0, 0, "CHƯA ĐẾN KỲ KẾ HOẠCH"]]) {
  // progressStatus nay là biểu thức trong component: dựng đúng các biến nó đọc.
  const status = evaluate("progressStatus", {
    selectedProjects: [{}], isUnfilteredOverview: false, behindReasons: [], liveProjects: [], statusScope: [{}],
    statusPlannedToDate: plannedToDate, actualToDate, isAllDates: false, plannedInPeriod: 0, upcomingProjects: [], upcomingDailyPlan: 0,
  });
  assert.equal(status.label, expected);
}
const selectedRows = [{ ngay_thuc_hien: "2026-01-01", nam_thuc_hien: 2026 }, { ngay_thuc_hien: "2026-09-08", nam_thuc_hien: 2026 }, { nam_thuc_hien: 2020 }];
const getJournalRowDateIso = (row) => row.ngay_thuc_hien || "";
const statusContext = {
  hasProgressRange: true, progressFrom: "2026-01-01", progressTo: "2026-11-02",
  statusScope: [{ id: "pq", name: "PQ" }], showFastCharts: false, fastRollupRows: [],
  getJournalRowDateIso,
  selectedRows: [
    { du_an_id: "pq", loai_moi_han: "Sản xuất", nam_thuc_hien: 2025 },
    { du_an_id: "old", loai_moi_han: "Sản xuất", ngay_thuc_hien: "2026-10-01" },
    { du_an_id: "pq", loai_moi_han: "Đào tạo", ngay_thuc_hien: "2026-10-01" },
    { du_an_id: "pq", loai_moi_han: "Sản xuất", ngay_thuc_hien: "2026-12-01" },
  ],
};
assert.equal(evaluate("actualToDate", statusContext), 0, "PQ has no production due to date; history and training do not count");
const remainingPlanContext = { isAllDates: true, statusScope: [{ id: "pq", plannedWeldCount: 3010 }], plannedInPeriod: 46 };
const remainingContext = { remainingTarget: evaluate("remainingTarget", remainingPlanContext) };
const remainingFor = (context) => evaluate("remainingWelds", {
  ...remainingContext, actualToDate: evaluate("actualToDate", context),
});
assert.equal(remainingFor(statusContext), 3010, "PQ without production still has all 3010 joints remaining");
const pqProduction = { du_an_id: "pq", loai_moi_han: "Sản xuất", ngay_thuc_hien: "2026-11-02" };
assert.equal(remainingFor({ ...statusContext, selectedRows: [...statusContext.selectedRows, pqProduction] }), 3009);
assert.equal(remainingFor({ ...statusContext, progressTo: "2026-11-03",
  selectedRows: [...statusContext.selectedRows, pqProduction, { ...pqProduction, ngay_thuc_hien: "2026-11-03" }],
}), 3008, "New production on the next day automatically reduces the balance");
assert.equal(evaluate("remainingWelds", { ...remainingContext, actualToDate: 3011 }), 0, "Remaining cannot be negative");
assert.equal(evaluate("remainingWelds", {
  remainingTarget: evaluate("remainingTarget", { ...remainingPlanContext, isAllDates: false }), actualToDate: 5,
}), 41, "Date filters use the period plan");
assert.equal(evaluate("actualToDate", { ...statusContext, selectedRows: [...statusContext.selectedRows, pqProduction] }), 1);
assert.equal(evaluate("actualToDate", { ...statusContext, selectedRows: [{ ...pqProduction, du_an_id: null, du_an: "PQ" }] }), 1, "Legacy rows match by project name");
assert.equal(evaluate("actualToDate", { ...statusContext, hasProgressRange: false }), 0);
const fastStatusContext = { ...statusContext, showFastCharts: true,
  fastRollupRows: statusContext.selectedRows.map((row) => ({ ...row, so_moi: 100 })),
};
assert.equal(evaluate("actualToDate", fastStatusContext), 0, "Rollup applies the same project, production and date limits");
assert.equal(remainingFor(fastStatusContext), 3010, "Rollup preserves the full PQ balance without production");
assert.equal(remainingFor({ ...fastStatusContext,
  fastRollupRows: [...fastStatusContext.fastRollupRows, { ...pqProduction, so_moi: 2 }, { ...pqProduction, so_luong_thuc_hien: 3 }],
}), 3005, "New rollup production automatically reduces the balance in both schemas");
assert.equal(evaluate("actualToDate", { ...fastStatusContext,
  fastRollupRows: [...fastStatusContext.fastRollupRows, { ...pqProduction, so_moi: 2 }, { ...pqProduction, so_luong_thuc_hien: 3 }],
}), 5, "Both rollup schemas count production quantities");
assert.equal(evaluate("progressStatus", {
  selectedProjects: [{}], isUnfilteredOverview: false, behindReasons: [], liveProjects: [], statusScope: [{}],
  statusPlannedToDate: 46, actualToDate: evaluate("actualToDate", statusContext), isAllDates: true,
  plannedInPeriod: 0, upcomingProjects: [], upcomingDailyPlan: 0,
}).label, "CHẬM TIẾN ĐỘ", "Zero current production cannot be ahead of a 46-weld plan");
const period = evaluate("chartPeriod", { chartViewMode: "monthly", selectedRows, selectedProjects: [project], isAllDates: true,
  getJournalRowDateIso, filterFrom: "", filterTo: "",
  dailySeries: [], dailyTargets: [], dailyValues: [], yearlySeries: [], planRows, canSkipJournal: false, fastRollupRows: [] });
assert.equal(period.values.reduce((a, b) => a + b, 0), 3, "All records count beyond the recent daily window");
assert.equal(period.targets.reduce((a, b) => a + b, 0), 1000);
assert.ok(period.labels.some((label) => label.includes("chưa rõ tháng")));
// Biểu đồ lũy kế (hàm riêng): chỉ tính đến hôm nay; dữ liệu chỉ có năm tách thành undatedTotal, tự phân bổ thì chia đều các tháng.
const planStartDate = evaluate("planStartDate", { planRows });
const cumulative = (spreadUndatedMonthly) => evaluate("cumulativeChartPeriod", { cumulativeChartViewMode: "monthly", selectedRows, selectedProjects: [project],
  isAllDates: true, todayIso: "2026-10-27", filterFrom: "", filterTo: "", getJournalRowDateIso, planRows, planStartDate,
  canSkipJournal: false, fastRollupRows: [], spreadUndatedMonthly, yearTotals: [], dailySeries: [], dailyTargets: [], dailyValues: [], yearlySeries: [] });
const plain = cumulative(false);
assert.equal(plain.values.reduce((a, b) => a + b, 0), 2, "Dated records count up to today");
assert.equal(plain.undatedTotal, 1, "Year-only records are reported separately");
assert.equal(plain.targets.reduce((a, b) => a + b, 0), 1000);
assert.equal(cumulative(true).values.reduce((a, b) => a + b, 0), 3, "Spreading year-only records adds them to monthly bars");
// Đường nhanh (rollup theo ngày) cộng đúng số mối trong từng tháng khi bỏ qua nhật ký chi tiết.
const fast = evaluate("chartPeriod", { chartViewMode: "monthly", selectedRows: [], selectedProjects: [project], isAllDates: true,
  getJournalRowDateIso: () => "", filterFrom: "", filterTo: "", dailySeries: [], dailyTargets: [], dailyValues: [], yearlySeries: [],
  planRows, canSkipJournal: true,
  fastRollupRows: [{ ngay_thuc_hien: "2026-01-05", so_moi: 4 }, { ngay_thuc_hien: "2026-01-20", so_moi: 6 }, { ngay_thuc_hien: "2026-02-02", so_moi: 5 }] });
assert.equal(fast.values.reduce((a, b) => a + b, 0), 15, "Rollup path counts every welded joint");
assert.deepEqual([...fast.dates].slice(0, 2), ["2026-01", "2026-02"]); // [...] đưa mảng ra khỏi vm context
let returnedStatus = "Chờ thí nghiệm";
let savedBody;
const db = { from: () => ({ update(body) { savedBody = body; return this; }, eq() { return this; }, select() { return this; }, async single() { return { data: { id: "w", tinh_trang_thi_nghiem: returnedStatus }, error: null }; }, async maybeSingle() { return { data: { ngay_thuc_hien: "2026-01-01" }, error: null }; } }) };
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/lib/weldReportData.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
  exports: api,
  // Module phụ (cache, thông báo lịch máy…) không thuộc phạm vi test này → hàm rỗng.
  require: () => new Proxy({ createClient: () => db, formatSupabaseError: (error) => error.message, isSupabaseConfigured: () => true }, { get: (target, key) => (key in target ? target[key] : () => undefined) }),
});
const payload = { id: "w", ma_lich_su: "W", loai_ray: "50N", chung_chi_su_dung: "C", tinh_trang_thi_nghiem: returnedStatus };
await api.updateWeldJournalEntry(payload);
assert.equal(savedBody.tinh_trang_thi_nghiem, "Chờ thí nghiệm");
returnedStatus = "Đạt";
await assert.rejects(() => api.updateWeldJournalEntry(payload), /chưa lưu đúng/);
const journalText = fs.readFileSync(new URL("../src/components/WeldingJournalList.tsx", import.meta.url), "utf8");
const journalSource = ts.createSourceFile("journal.tsx", journalText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initEffect;
function findInit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(journalSource) === "useEffect" && node.arguments[0]?.getText(journalSource).includes("initializedForm.current = initial")) initEffect = node.arguments[0];
  ts.forEachChild(node, findInit);
}
findInit(journalSource);
let form;
const noop = () => {};
const context = { open: true, mode: "edit", initial: { result: "Đạt", anh_moi_han_lien_ket: [], ma_hien_truong: "", ten_moi_han_theo_may: "" }, initializedForm: { current: undefined }, wasOpen: { current: false },
  initialImageIds: { current: null }, removedImages: { current: null }, setForm: (value) => { form = value; }, setProjectSuggestion: noop, setImageError: noop,
  setSiteCodeEdited: noop, setMachineCodeEdited: noop, setEntryMode: noop, setBulkDateFrom: noop, setBulkDateTo: noop, setBulkCount: noop,
  defaultPerformedAt: () => "2026-10-27T08:00", defaultLinkDateRange: () => ({}), setLinkDateFrom: noop, setLinkDateTo: noop };
const runInit = () => vm.runInNewContext(ts.transpile(`(${initEffect.getText(journalSource)})();`, { target: ts.ScriptTarget.ES2020 }), context);
runInit();
form = { result: "Chờ thí nghiệm" };
runInit();
assert.equal(form.result, "Chờ thí nghiệm", "Refreshing dropdown options must not reset the selected status");
context.open = false;
runInit();
context.open = true;
runInit();
assert.equal(form.result, "Đạt", "Reopening the form initializes it again");
console.log("PASS: monthly/cumulative totals, undated history, schedule cutoff, zero-plan days, pending status verification");
