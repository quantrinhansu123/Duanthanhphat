import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

/** Nạp dailyReportDb.ts vào vm ở chế độ cục bộ (không Supabase) với localStorage giả. */
const store = new Map();
const localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const stub = (extra = {}) => new Proxy(extra, { get: (t, k) => (k in t ? t[k] : () => undefined) });
const code = ts.transpileModule(fs.readFileSync(new URL("../src/lib/dailyReportDb.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exports = {};
vm.runInNewContext(code, {
  exports, localStorage, window: { localStorage }, crypto: { randomUUID: () => Math.random().toString(16).slice(2) },
  console, Date, JSON, Array, Map, Set, Promise, Number, String, Object, Error, RegExp, Math,
  require: () => stub({ createClient: () => ({}), isSupabaseConfigured: () => false, formatSupabaseError: (e) => e?.message ?? String(e) }),
});
const { reportPhotos, reportNoteText, saveReportPhotos } = exports;

test_main();
async function test_main() {
  assert.deepEqual(reportPhotos("ghi chú thường"), []);
  assert.deepEqual(reportPhotos(null), []);
  const a = "https://res.cloudinary.com/x/a.jpg";
  const b = "https://res.cloudinary.com/x/b.jpg";
  let header = await saveReportPhotos("2026-10-27", [a]);
  assert.deepEqual(reportPhotos(header.ghiChu), [a]);
  header = await saveReportPhotos("2026-10-27", [a, b]);
  assert.deepEqual(reportPhotos(header.ghiChu), [a, b], "thêm ảnh giữ ảnh cũ");
  header = await saveReportPhotos("2026-10-27", [b]);
  assert.deepEqual(reportPhotos(header.ghiChu), [b]);
  header = await saveReportPhotos("2026-10-27", []);
  assert.deepEqual(reportPhotos(header.ghiChu), []);
  assert.equal(reportNoteText(header.ghiChu), "");
  assert.deepEqual(reportPhotos('x\n[ANH]["javascript:alert(1)","https://ok/a.png"]'), ["https://ok/a.png"], "chỉ nhận URL https");
  assert.equal(reportNoteText("Ghi chú\n[ANH][]"), "Ghi chú", "ghi chú giữ nguyên, bỏ phần ảnh");
  console.log("PASS test-daily-report-photos");
}

// ---- Phân loại mối hàn theo dải ray (TT/TP/HT/HP) với Supabase giả ----
const tables = {
  lich_su_moi_han: [
    { id: "w1", ma_lich_su: "A1" }, { id: "w2", ma_lich_su: "A2" }, { id: "w3", ma_lich_su: "A3" }, { id: "w4", ma_lich_su: "A4" },
  ],
  toa_do: [
    { ma_diem: "TT0001", lich_su_moi_han_id: "w1" }, { ma_diem: "TP0001", lich_su_moi_han_id: "w2" },
    { ma_diem: "HT0003", lich_su_moi_han_id: "w3" },
  ],
};
function query(name) {
  const q = { select: () => q, in: (col, vals) => ({ then: (r) => r({ data: tables[name].filter((x) => vals.includes(x[col])), error: null }) }) };
  return q;
}
const code2 = ts.transpileModule(fs.readFileSync(new URL("../src/lib/dailyReportDb.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const ex2 = {};
vm.runInNewContext(code2, {
  exports: ex2, localStorage, window: { localStorage }, console, Date, JSON, Array, Map, Set, Promise, Number, String, Object, Error, RegExp, Math,
  require: () => stub({ createClient: () => ({ from: (n) => query(n) }), isSupabaseConfigured: () => true, formatSupabaseError: (e) => String(e) }),
});
const counts = await ex2.railCountsForWelds([
  { ma_lich_su: "A1", so_luong_thuc_hien: 1 }, { ma_lich_su: "A2", so_luong_thuc_hien: 2 },
  { ma_lich_su: "A3", so_luong_thuc_hien: 1 }, { ma_lich_su: "A4", so_luong_thuc_hien: 1 },
]);
assert.equal(`${counts.tt}/${counts.tp}/${counts.ht}/${counts.hp}/${counts.other}`, "1/2/1/0/1", "TT/TP/HT/HP + chưa phân loại");
assert.equal(counts.tt + counts.tp + counts.ht + counts.hp + counts.other, 5, "tổng = tổng mối hàn trong ngày");
console.log("PASS rail counts");
