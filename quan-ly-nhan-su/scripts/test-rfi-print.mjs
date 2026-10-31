import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";

function load(path, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: (name) => { assert.ok(name in imports, name); return imports[name]; } });
  return exports;
}
const codes = load("../src/lib/weldCode.ts");
const Document = load("../src/components/WeldAcceptanceDocument.tsx", {
  react: React, "react/jsx-runtime": jsx,
  "@/lib/weldQualityClient": {}, "@/lib/weldCode": codes,
}).default;
function print(points) {
  return renderToStaticMarkup(React.createElement(Document, { onClose() {}, view: {
    kind: "rfi", rfi: { projectName: "Phú Quốc", rfi: { so_phieu: "RFI-001", ngay_moi: "2026-10-30", thong_tin: {} },
      welds: points.map((code, i) => ({ ma_diem: code, ma_lich_su: `W${i}`, ly_trinh: i ? "1+284.33" : "Km0+044.43" })) },
  } }));
}
assert.match(print(["TT0002", "TP0050"]), /☑ Tuyến thượng.*☐ Tuyến hạ/);
assert.match(print(["HT0001", "HP0002"]), /☐ Tuyến thượng.*☑ Tuyến hạ/);
assert.match(print(["TT0001", "HP0002"]), /☑ Tuyến thượng.*☑ Tuyến hạ/);
const partial = print(["TT0001", null]);
assert.match(partial, /Chưa xác định tuyến: W1/);
assert.match(partial, /Từ Km0\+044.43 đến Km1\+284.33/);
assert.doesNotMatch(partial, /Km Km/);
assert.match(print([null]), /☐ Tuyến thượng.*☐ Tuyến hạ/);
console.log("RFI print routes: upper/lower/mixed/missing and chainage OK");
const monitoring = renderToStaticMarkup(React.createElement(Document,{onClose(){},view:{kind:"rfi",rfi:{projectName:"Phú Quốc",welds:[],rfi:{so_phieu:"RFI-002",ngay_moi:"2026-10-31",thong_tin:{loai_rfi:"theo-doi",nameFrom:"W2",nameTo:"W10",kmFrom:"Km0+020",kmTo:"Km1+500"}}}}}));
assert.match(monitoring,/PHIẾU YÊU CẦU THEO DÕI CÔNG VIỆC HÀN/);
assert.match(monitoring,/W2 – W10/);
assert.match(monitoring,/Từ Km0\+020 đến Km1\+500/);
assert.doesNotMatch(monitoring,/Nhà thầu cam kết.*đã đáp ứng yêu cầu chất lượng/);
console.log("PASS monitoring RFI print uses manual range without acceptance claims");
