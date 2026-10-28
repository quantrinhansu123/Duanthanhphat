import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const m = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/lib/weldAcceptance.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: m });

assert.equal(m.parseChainageMeters("Km12+345"), 12345);
assert.equal(m.parseChainageMeters("12+5"), 12005);
assert.equal(m.parseChainageMeters("12,5"), 12500);
assert.equal(m.parseChainageMeters("abc"), null);
assert.equal(m.parseChainageMeters(""), null);

const row = (id, code, date, km) => ({ id, ma_lich_su: code, ngay_thuc_hien: date, ly_trinh: km, phien_ban: 1, tinh_trang: "Chờ thí nghiệm" });
const rows = [row("a", "PQ-10", "2026-10-02", "Km1+000"), row("b", "PQ-2", "2026-10-01", "Km0+500"), row("c", "PQ-3", "2026-10-03", null)];
// mối 2 đứng trước mối 10
assert.deepEqual(m.filterRfiCandidates(rows, {}).rows.map((r) => r.id), ["b", "c", "a"]);
assert.deepEqual(m.filterRfiCandidates(rows, { nameFrom: "PQ-2", nameTo: "PQ-3" }).rows.map((r) => r.id), ["b", "c"]);
assert.deepEqual(m.filterRfiCandidates(rows, { dateFrom: "2026-10-02" }).rows.map((r) => r.id), ["c", "a"]);
// thiếu lý trình không lọt vào khoảng km, nhưng được báo
const km = m.filterRfiCandidates(rows, { kmFrom: "Km0+000", kmTo: "Km2+000" });
assert.deepEqual(km.rows.map((r) => r.id), ["b", "a"]);
assert.deepEqual([...km.missingChainage], ["c"]);
assert.throws(() => m.filterRfiCandidates(rows, { kmFrom: "xx" }));
assert.equal(m.filterRfiCandidates(rows, { query: "pq-1" }).rows.length, 1);

// RFI 10 mối: mặc định chọn Đạt cho mối đủ điều kiện
const d = m.defaultDecisions([
  { moi_han_id: "a", phien_ban: 1, du_dieu_kien_nghiem_thu: true },
  { moi_han_id: "b", phien_ban: 2, du_dieu_kien_nghiem_thu: false },
]);
assert.deepEqual(JSON.parse(JSON.stringify(m.summarizeDecisions(d))), { total: 2, accepted: 1, failed: 0, deferred: 1 });
console.log("weld acceptance rules OK");
