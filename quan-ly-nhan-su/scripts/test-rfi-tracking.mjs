import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(name, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: (key) => { assert.ok(key in imports, key); return imports[key]; } });
  return exports;
}
const acceptance = load("weldAcceptance");
const { summarizeRfiWelds, acceptedChainage } = load("rfiTracking", { "./weldAcceptance": acceptance });
const weld = (id, km, result = "Đạt", signed = false, code = "TT0001") => ({ moi_han_id: id, ma_lich_su: `W-${id}`, ly_trinh: km, ket_qua: result, da_ky: signed, ma_diem: code });
const rows = [weld("1", "Km1+005"), weld("2", "Km1+025", "Đạt", true), weld("3", "Km2+010", "Không đạt"), weld("4", null, "Chưa nghiệm thu"), weld("5", "Km5+000", "Đạt", false, "HT0001")];
const summary = summarizeRfiWelds(rows);
assert.equal(summary.da_nghiem_thu, 3);
assert.equal(summary.cho_ky, 2);
assert.equal(summary.da_ky, 1);
assert.equal(summary.khong_dat, 1);
assert.equal(summary.chua_nghiem_thu, 1);
assert.equal(summary.thieu_ly_trinh, 1);
assert.equal(summary.km_nghiem_thu, "Tuyến thượng: Km1+005 – Km1+025; Tuyến hạ: Km5+000");
assert.equal(summarizeRfiWelds([...rows, rows[0]]).da_nghiem_thu, 3, "Deduplicate weld IDs");
assert.equal(acceptedChainage([weld("1", "bad"), weld("2", "Km2+000", "Không đạt")]), "—", "Never count invalid KM or rejected welds as accepted coverage");
assert.equal(summarizeRfiWelds([]).da_nghiem_thu, 0);
assert.match(acceptance.acceptanceBlockReason("Chờ ký biên bản", true), /chiều dài mài/);
console.log("PASS RFI tracking: actual acceptance results, unsigned/signed counts, route-specific KM, missing KM, rejection exclusion and unique welds");
