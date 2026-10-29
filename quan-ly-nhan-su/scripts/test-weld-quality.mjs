import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const rules = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/lib/weldQuality.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: rules });

const bound = (min, max) => ({ min, max, minInclusive: true, maxInclusive: true });
// Fixture kiểm tra biên đóng; không phải cấu hình PQ đã được xác nhận cho dự án thật.
const limits = { doc_mat_lan: bound(-0.1, 0.4), ngang_nam_ray: bound(-0.4, 0.4), ngang_chan_ray: bound(-2, 2), phang_mat_lan: bound(0, 0.2) };
const measurements = { doc_mat_lan: 0, ngang_nam_ray: 0, ngang_chan_ray: 0, phang_mat_lan: 0 };
for (const value of [null, undefined, "", "  "]) assert.equal(rules.parseWeldMeasurement(value), null);
for (const [input, expected] of [["0", 0], [0, 0], ["-0,10", -0.1], [" +0.40 ", 0.4], [".2", 0.2]]) {
  assert.equal(rules.parseWeldMeasurement(input), expected);
}
for (const value of [NaN, Infinity, -Infinity, true, [], {}, "1e3", "0,1.2", "0 mm", "--1", "1 000"]) {
  assert.throws(() => rules.parseWeldMeasurement(value));
}
assert.equal(rules.evaluateGeometry({}, limits), null);
assert.equal(rules.evaluateGeometry(measurements, null), null);
for (const [key, limit] of Object.entries(limits)) {
  for (const [value, expected] of [[limit.min, "Đạt"], [limit.max, "Đạt"], [limit.min - 0.001, "Không đạt"], [limit.max + 0.001, "Không đạt"]]) {
    assert.equal(rules.evaluateGeometry({ ...measurements, [key]: value }, limits), expected);
  }
}
assert.equal(rules.evaluateGeometry({ doc_mat_lan: -0.11 }, limits), "Không đạt", "Known failures remain failures even if other measurements are missing");
const openLimits = structuredClone(limits);
openLimits.doc_mat_lan.maxInclusive = false;
assert.equal(rules.evaluateGeometry({ ...measurements, doc_mat_lan: 0.4 }, openLimits), "Không đạt");
for (const value of [null, {}, { ...limits, extra: bound(0, 1) }, { ...limits, doc_mat_lan: bound(1, 0) },
  { ...limits, doc_mat_lan: bound(null, null) }, { ...limits, doc_mat_lan: bound(0, Infinity) }]) {
  assert.throws(() => rules.validateGeometryLimits(value));
}
assert.throws(() => rules.validateGeometryMeasurements({ doc_mat_lan: "0" }));
assert.throws(() => rules.validateGeometryMeasurements({ wrong: 0 }));

const rule = { dung_sai: limits, yeu_cau_ndt: true, ndt_truoc_rfi: false, can_cu_mien_ndt: null };
const empty = { ngay_mai: null, truc_quan: null, gia_tri_do: {}, phuong_phap_ndt: "Siêu âm", ket_qua_ndt: null, ngay_ndt: null };
const inspection = { ngay_mai: "2026-10-28", truc_quan: "Đạt", gia_tri_do: measurements, phuong_phap_ndt: "Siêu âm", ket_qua_ndt: null, ngay_ndt: null };

assert.equal(rules.evaluateWeldQuality(null, rule, "Sản xuất").status, "Chờ mài");
assert.equal(rules.evaluateWeldQuality(empty, rule, "Sản xuất").status, "Chờ mài");
// Mọi loại mối hàn cùng trình tự — không còn nhảy thẳng Chờ thí nghiệm cho Thử nghiệm/Chấp thuận.
assert.equal(rules.evaluateWeldQuality(empty, rule, "Thử nghiệm").status, "Chờ mài");
assert.equal(rules.evaluateWeldQuality(empty, rule, "Chấp thuận").status, "Chờ mài");
assert.equal(rules.evaluateWeldQuality(inspection, rule, "Thử nghiệm").status, "Chờ siêu âm và nghiệm thu");
assert.equal(rules.evaluateWeldQuality(inspection, rule, "Sản xuất").status, "Chờ siêu âm và nghiệm thu");
assert.equal(rules.evaluateWeldQuality(inspection, null, "Sản xuất").rfiEligible, false);
assert.equal(rules.evaluateWeldQuality(inspection, rule, "Sản xuất").rfiEligible, true);
assert.equal(rules.evaluateWeldQuality(inspection, { ...rule, ndt_truoc_rfi: true }, "Sản xuất").rfiEligible, false);
assert.equal(rules.evaluateWeldQuality(inspection, rule, "Sản xuất").acceptanceEligible, false);

const ndtPass = { ...inspection, ket_qua_ndt: "Đạt", ngay_ndt: "2026-10-28" };
assert.equal(rules.evaluateWeldQuality(ndtPass, rule, "Sản xuất").status, "Chờ ký biên bản");
assert.equal(rules.evaluateWeldQuality(ndtPass, rule, "Sản xuất", true).status, "Đạt");
assert.equal(rules.evaluateWeldQuality({ ...ndtPass, truc_quan: "Không đạt" }, rule, "Sản xuất").status, "Sửa chữa/khắc phục");
assert.equal(rules.evaluateWeldQuality({ ...ndtPass, truc_quan: "Không đạt", xu_ly_truc_quan: "khong_dat" }, rule, "Sản xuất").status, "Không đạt");
assert.equal(rules.evaluateWeldQuality({ ...ndtPass, ket_qua_ndt: "Không đạt" }, rule, "Sản xuất").status, "Không đạt");
assert.equal(rules.evaluateWeldQuality({ ...ndtPass, ly_do_loai_nghiem_thu: "Lỗi hiện trường" }, rule, "Sản xuất").status, "Không đạt");
assert.equal(rules.evaluateWeldQuality(inspection, { ...rule, yeu_cau_ndt: false, can_cu_mien_ndt: "Fixture" }, "Đào tạo").status, "Không thí nghiệm");
assert.equal(rules.normalizeWeldQualityStatus("Nghiệm thu đạt"), "Đạt");
assert.equal(rules.normalizeWeldQualityStatus("Chờ thí nghiệm"), "Chờ siêu âm và nghiệm thu");
console.log("PASS: unified quality lifecycle (no NDT column), repair path, signing wait, aliases");
