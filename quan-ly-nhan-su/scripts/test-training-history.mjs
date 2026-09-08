import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const course = { id: "course-a", ten_khoa_hoc: "Khóa A", ngay: "2026-09-08", thoi_luong: "8 giờ", tong_gio_nha_san_xuat: 6, tong_gio_tu_dao_tao: 2 };
const tables = {
  dao_tao: [course, { ...course, id: "course-b", ten_khoa_hoc: "Khóa B" }],
  nhan_su: [
    { employee_id: "a", ho_ten: "A", chuc_vu: "Thợ hàn" },
    { employee_id: "b", ho_ten: "B", chuc_vu: "Kỹ thuật viên" },
  ],
  dao_tao_hoc_vien: [
    { id: "a1", dao_tao_id: "course-a", employee_id: "a", ket_qua: "Đạt", trang_thai: "Hoàn thành", chung_chi_id: "cert-a" },
    { id: "b1", dao_tao_id: "course-a", employee_id: "b", ket_qua: "Không đạt", trang_thai: "Không hoàn thành" },
    { id: "a2", dao_tao_id: "course-b", employee_id: "a", ket_qua: "Đang học" },
  ],
  chung_chi: [{ id: "cert-a", employee_id: "a", ten_chung_chi: "Chứng chỉ A", ngay_cap: "2026-09-09" }],
};
let rpcErrors = [];
const db = {
  from(table) {
    let rows = tables[table];
    return {
      select() { return this; }, order() { return this; },
      in(key, values) { rows = rows.filter((row) => values.includes(row[key])); return this; },
      range(start, end) { rows = rows.slice(start, end + 1); return this; },
      then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
    };
  },
  async rpc() { return { error: rpcErrors.shift(), data: null }; },
};
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/lib/trainingDb.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  exports: api,
  require: () => ({ createClient: () => db }),
  process: { env: { NEXT_PUBLIC_SUPABASE_URL: "test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test" } },
});

(async () => {
  const { records, error } = await api.fetchWelderTrainingHistory();
  assert.equal(error, undefined);
  assert.equal(records.length, 3, "Include every assigned person and each course separately");
  const a = records.find((row) => row.id === "a1");
  assert.equal(a.manufacturerHours, 6);
  assert.equal(a.selfTrainingHours, 2);
  assert.equal(a.date, new Date("2026-09-08T00:00:00").toLocaleDateString("vi-VN"));
  assert.equal(a.certificateDate, new Date("2026-09-09T00:00:00").toLocaleDateString("vi-VN"));
  assert.equal(a.certificateId, "cert-a");
  assert.equal(records.find((row) => row.id === "b1").personType, "Nhân sự khác");
  assert.equal(records.find((row) => row.id === "a2").certificateId, undefined, "Do not reuse another course's certificate");
  tables.chung_chi[0].employee_id = "b";
  assert.equal((await api.fetchWelderTrainingHistory()).records[0].certificateId, undefined, "Do not show another person's certificate");
  const missingRpc = { code: "PGRST202", message: "missing function" };
  for (const errors of [
    [{ message: "record v_nhom is not assigned yet" }],
    [missingRpc, { message: "record v_nhom is not assigned yet" }],
    [missingRpc, missingRpc, { message: "record v_nhom is not assigned yet" }],
  ]) {
    rpcErrors = [...errors];
    const result = await api.saveTrainingCourse({ title: "A", certificateGroupId: "group-a", attendees: [] });
    assert.match(result.error, /migration_20260908_fix_v_nhom_dao_tao/);
    assert.equal(result.id, undefined, "Certificate issuance failure must not report a successful save");
  }
  console.log("PASS: training history, all attendees, course-specific certificates, dates/hours, RPC error handling");
})().catch((error) => { console.error(error); process.exitCode = 1; });
