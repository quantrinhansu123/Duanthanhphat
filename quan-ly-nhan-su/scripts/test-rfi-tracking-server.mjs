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
const tracking = load("rfiTracking", { "./weldAcceptance": acceptance });
const project = { du_an_id: "project" };
const snapshot = (i) => ({ moi_han: { ma_lich_su: `W-${i}`, ma_diem: "TT0001", ly_trinh: `Km1+${String(i % 1000).padStart(3, "0")}` } });
const link = (i, phieu_id = "main") => ({ phieu_id, moi_han_id: String(i), con_hieu_luc: i > 1202, du_lieu_chot: snapshot(i), phieu_yeu_cau_nghiem_thu: project });
const batch = (id, phieu_id = "main", draft = false) => ({ id, phieu_id, created_at: id, thong_tin: { draft }, phieu_yeu_cau_nghiem_thu: project });
const result = (i, dot_id, ket_qua = "Đạt") => ({ dot_id, moi_han_id: String(i), ket_qua, du_lieu_chot: snapshot(i) });
const kinds = ["Phụ lục công việc", "Giai đoạn xây dựng", "Hoàn thành công việc"];
const tables = {
  phieu_yeu_cau_nghiem_thu: ["main", "draft"].map((id) => ({ id, so_phieu: id, ngay_moi: "2026-11-01", du_an_id: "project", created_at: id, thong_tin: {} })),
  phieu_yeu_cau_nghiem_thu_moi: [...Array.from({ length: 1203 }, (_, i) => link(i + 1)), link(2000, "draft")],
  dot_nghiem_thu: [batch("a"), batch("b"), batch("c"), batch("d"), batch("e", "draft", true)],
  dot_nghiem_thu_moi: [
    ...Array.from({ length: 600 }, (_, i) => result(i + 1, "a")),
    ...Array.from({ length: 600 }, (_, i) => result(i + 601, "b")),
    result(1201, "c", "Không đạt"), result(1202, "c", "Không đạt"), result(1203, "d", "Chưa nghiệm thu"),
    result(2000, "e"), // A draft is not an acceptance, even if old data contains Đạt.
  ],
  ho_so_nghiem_thu: ["a", "b", "c", "d", "e"].flatMap((dot_id) => kinds.map((loai, i) => ({ id: `${dot_id}-${i}`, dot_id, loai, tinh_trang_ky: dot_id === "a" ? "Đã ký" : "Chờ ký" }))),
  toa_do: [{ id: "p", lich_su_moi_han_id: "1", ma_diem: "HT0001", ly_trinh: "Km99+999" }],
};
const pages = [];
const db = { from(table) {
  const predicates = [], orders = [];
  let from = 0, to = 999;
  const field = (row, key) => key.split(".").reduce((v, part) => v?.[part], row);
  const q = {
    select() { return q; },
    eq(key, value) { predicates.push((r) => field(r, key) === value); return q; },
    in(key, values) { predicates.push((r) => values.includes(r[key])); return q; },
    order(key, options) { orders.push([key, options?.ascending !== false]); return q; },
    range(a, b) { from = a; to = b; return q; },
    then(resolve, reject) {
      pages.push([table, from]);
      const data = tables[table].filter((r) => predicates.every((f) => f(r))).sort((a, b) => {
        for (const [key, ascending] of orders) {
          const value = String(a[key]).localeCompare(String(b[key]));
          if (value) return ascending ? value : -value;
        }
        return 0;
      }).slice(from, to + 1);
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return q;
} };
const server = load("server/weldAcceptanceServer", {
  "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => db },
  "@/lib/server/weldQualityAuth": { QualityApiError: Error }, "@/lib/server/weldQualityJournal": {},
  "@/lib/server/weldQualityDb": {}, "@/lib/weldAcceptance": acceptance, "@/lib/rfiTracking": tracking,
  "@/lib/weldQuality": {},
  "@/lib/constructionDiaryAuto": {}, "@/lib/server/projectEquipment": {}, "@/lib/projectEquipment": {},
  "@/lib/server/privateJsonStorage": {}, "@lwr/lib/track-editor": {},
});
const rfis = await server.listRfis("project");
const main = rfis.find((r) => r.id === "main"), draft = rfis.find((r) => r.id === "draft");
assert.equal(main.tong_moi, 1203);
assert.equal(main.tracking.da_nghiem_thu, 1200);
assert.equal(main.tracking.da_ky, 600);
assert.equal(main.tracking.cho_ky, 600);
assert.equal(main.tracking.khong_dat, 2);
assert.equal(main.tracking.chua_nghiem_thu, 1);
assert.equal(main.tracking.moi.find((r) => r.moi_han_id === "1").ly_trinh, "Km1+001", "Use frozen acceptance KM after GPS changes");
assert.equal(draft.tracking.da_nghiem_thu, 0, "Draft snapshots must not count as completed acceptance");
assert.ok(pages.some(([table, from]) => table === "dot_nghiem_thu_moi" && from === 1000), "Page through results exceeding PostgREST's 1000-row limit");
assert.equal((await server.listRfis("other-project")).length, 0, "Scope to selected project");
console.log("PASS RFI server: 1203 welds across batches, full pagination, draft exclusion, actual signed counts, frozen KM and project scoping");
