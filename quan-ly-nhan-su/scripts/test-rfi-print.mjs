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
const quality = load("../src/lib/weldQuality.ts");
const pages = load("../src/components/WeldAcceptanceRecordPages.tsx", {
  "react/jsx-runtime": jsx, "@/lib/weldQuality": quality,
});
const Document = load("../src/components/WeldAcceptanceDocument.tsx", {
  react: React, "react/jsx-runtime": jsx,
  "@/lib/weldQualityClient": {}, "@/lib/weldCode": codes,
  "@/components/WeldAcceptanceRecordPages": pages,
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

const record = {
  dot: { id: "draft", ngay_nghiem_thu: "2026-10-31", thong_tin: { draft: true }, phieu_yeu_cau_nghiem_thu: {
    so_phieu: "RFI-TEST", ngay_moi: "2026-11-01", thong_tin: { dia_diem: "Địa điểm kiểm thử", gio_bat_dau: "08:00", ben_moi: "Nhà thầu kiểm thử", ben_nhan: "Tư vấn kiểm thử" }, du_an: { du_an: "Phú Quốc" },
  } },
  ho_so: pages.ACCEPTANCE_DOCS.map((d, i) => ({ id: `doc-${i}`, loai: d.loai, tinh_trang_ky: "Chờ ký" })),
  moi: Array.from({ length: 21 }, (_, i) => ({ moi_han_id: `w${i}`, ket_qua: "Chưa nghiệm thu", ly_do: "Chờ siêu âm / nghiệm thu tại hiện trường", du_lieu_chot: {
    moi_han: { ma_lich_su: `FBW-${i + 1}`, ngay_thuc_hien: "2026-10-29", ten_tho_han: "Thợ kiểm thử", ly_trinh: `Km1+${i}` },
    kiem_tra: { truc_quan: "Đạt", gia_tri_do: { doc_mat_lan: 0 } },
  } })),
  sua_doi: [{ ho_so_id: "doc-1", phien_ban: 1, thong_tin: { dia_diem: "Địa điểm đã sửa" } }],
};
const pack = renderToStaticMarkup(React.createElement(pages.default, { record }));
assert.equal(pages.ACCEPTANCE_DOCS.length, 3);
assert.equal((pack.match(/class="acceptance-page"/g) ?? []).length, 5, "21 welds: two annex pages, one work record, two completion pages");
assert.match(pack, /Địa điểm kiểm thử/);
assert.match(pack, /Địa điểm đã sửa/);
assert.match(pack, /08:00/);
assert.match(pack, /01\/11\/2026/, "Draft documents follow the updated RFI invitation date");
assert.match(pack, /Nhà thầu kiểm thử/);
assert.match(pack, /Tư vấn kiểm thử/);
assert.match(pack, /Thợ kiểm thử/);
assert.match(pack, /FBW-21/);
assert.doesNotMatch(pack, /Mẫu tạm|undefined|null|>Chưa nghiệm thu</);
assert.doesNotMatch(pack, /Chờ siêu âm \/ nghiệm thu tại hiện trường/, "Leave notes free for field inspection instead of repeating an internal draft reason");
for (const doc of pages.ACCEPTANCE_DOCS) {
  const single = renderToStaticMarkup(React.createElement(Document, { onClose() {}, view: { kind: doc.kind, record } }));
  assert.match(single, new RegExp(doc.title));
  assert.match(single, /FBW-21/, "Draft records include all requested welds, even before acceptance");
}
if (process.env.PRINT_QA_HTML) fs.writeFileSync(process.env.PRINT_QA_HTML, `<!doctype html><meta charset="utf-8"><style>${pages.acceptancePrintCss}</style><div class="acceptance-print-root">${pack}</div>`);
console.log("PASS: same three templates for individual/batch print, 21-weld pagination, revisions and blank unverified results");
