import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(name, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { ...globals, exports, require: (key) => { assert.ok(key in imports, key); return imports[key]; } });
  return exports;
}
const { diaryWorkText } = load("constructionDiaryAuto", { "./weldAcceptance": load("weldAcceptance") });
const row = (id, ma_diem, ly_trinh, quantity = 1, method = "FBW") => ({ id, ma_diem, ly_trinh, ma_lich_su: `PQ-${id}`, so_luong_thuc_hien: quantity, cong_nghe_han: method });
const rows = [row("a", "HT0001", "Km10+100", 2), row("b", "HP0002", "Km2+005"), row("c", "TT0001", "Km1+000", 1, "ATW")];
const text = diaryWorkText([...rows, rows[0]], "weld");
assert.match(text, /Hàn chảy giáp mép đoạn Km2\+005 – Km10\+100, thuộc tuyến hạ. Khối lượng: 3 mối/);
assert.match(text, /Hàn nhiệt nhôm đoạn Km1\+000 – Km1\+000, thuộc tuyến thượng/);
assert.equal(text.split("\n").length, 2);
assert.match(diaryWorkText(rows, "grind"), /^Mài ray/);
assert.match(diaryWorkText(rows, "accept"), /Mối số: HP0002, HT0001/);
assert.match(diaryWorkText([row("d", null, null)], "weld"), /Km… – Km…, thuộc tuyến ….*cần bổ sung lý trình/);
assert.match(diaryWorkText([rows[0], row("d", "HT0002", "bad")], "grind"), /cần bổ sung lý trình/);
assert.equal(diaryWorkText([], "weld"), "");
assert.match(diaryWorkText([row("f", "TT0002", "Km0+044.43")], "weld"), /Km0\+044\.43/);
console.log("construction diary defaults OK");

const tables = {
  lich_su_moi_han: rows.map((r, i) => ({ ...r, du_an_id: "p", ngay_thuc_hien: i === 0 ? "2026-10-29" : "2026-10-28" })),
  kiem_tra_moi_han: [{ moi_han_id: "b", ngay_mai: "2026-10-29", "lich_su_moi_han.du_an_id": "p" }],
  phieu_yeu_cau_nghiem_thu: [
    { id: "r", du_an_id: "p", so_phieu: "RFI-001", ngay_moi: "2026-10-29", created_at: "2026-10-28", trang_thai: "Đã phát hành" },
    { id: "cancelled", du_an_id: "p", so_phieu: "CANCEL", ngay_moi: "2026-10-29", trang_thai: "Đã huỷ" },
    { id: "other", du_an_id: "other", so_phieu: "OTHER", ngay_moi: "2026-10-29", trang_thai: "Đã phát hành" },
  ],
  phieu_yeu_cau_nghiem_thu_moi: [{ phieu_id: "r", moi_han_id: "c" }],
  toa_do: rows.map((r) => ({ lich_su_moi_han_id: r.id, ma_diem: r.ma_diem, ly_trinh: r.ly_trinh })),
};
let fail = false;
const db = { from(name) {
  let result = tables[name];
  assert.ok(result, name);
  const q = {
    select() { return q; }, order() { return q; },
    eq(k, v) { result = result.filter((r) => r[k] === v); return q; },
    neq(k, v) { result = result.filter((r) => r[k] !== v); return q; },
    in(k, values) { result = result.filter((r) => values.includes(r[k])); return q; },
    range(a, b) { result = result.slice(a, b + 1); return q; },
    then(resolve) { return Promise.resolve({ data: result, error: fail ? new Error("offline") : null }).then(resolve); },
  };
  return q;
} };
const { loadDiaryDefaults } = load("server/weldAcceptanceServer", {
  "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => db },
  "@/lib/server/weldQualityAuth": { QualityApiError: Error },
  "@/lib/server/weldQualityJournal": { qualityUuid: (v) => v, qualityDate: (v) => v },
  "@/lib/server/weldQualityDb": {}, "@/lib/weldAcceptance": {},
  "@/lib/constructionDiaryAuto": { diaryWorkText },
});
const defaults = await loadDiaryDefaults({ du_an_id: "p", date: "2026-10-29" });
assert.match(defaults.noiDungCongViec, /Hàn chảy giáp mép.*Khối lượng: 2 mối/);
assert.match(defaults.noiDungCongViec, /Mài ray.*Khối lượng: 1 mối/);
assert.doesNotMatch(defaults.noiDungCongViec, /Hàn nhiệt nhôm/);
assert.match(defaults.nghiemThuHangNgay, /TT0001.*RFI-001/);
assert.doesNotMatch(defaults.nghiemThuHangNgay, /CANCEL|OTHER|nghiệm thu đạt/);
const empty = await loadDiaryDefaults({ du_an_id: "p", date: "2026-10-30" });
assert.equal(empty.nghiemThuHangNgay, "Không có công tác nghiệm thu");
fail = true;
await assert.rejects(() => loadDiaryDefaults({ du_an_id: "p", date: "2026-10-29" }), /offline/);
console.log("construction diary date/project/RFI/error checks OK");

const storage = new Map();
let dbError = false, networkError = false, storageError = false;
let savedRow = null;
const client = { from() {
  const query = {
    select() { return query; }, eq() { return query; },
    async maybeSingle() {
      if (networkError) throw new Error("network offline");
      return { data: savedRow, error: dbError ? new Error("database unavailable") : null };
    },
    async upsert(row) {
      if (networkError) throw new Error("network offline");
      if (!dbError) savedRow = row;
      return { error: dbError ? new Error("database unavailable") : null };
    },
  };
  return query;
} };
const diaryDb = load("constructionDiaryDb", {
  "@/lib/supabase/client": { createClient: () => client },
  "@/lib/supabase/env": { isSupabaseConfigured: () => true, formatSupabaseError: (e) => e.message },
}, { window: { localStorage: {
  getItem: (key) => storage.get(key) ?? null,
  setItem(key, value) { if (storageError) throw new Error("storage full"); storage.set(key, value); },
} } });
const date = "2027-10-29";
assert.equal((await diaryDb.loadDiary("p", date)).saved, false);
const manual = { ...diaryDb.EMPTY_DIARY, thoiTiet: "Mưa", noiDungCongViec: "Dòng 1\nDòng 2 — tiếng Việt", nghiemThuHangNgay: "" };
assert.equal((await diaryDb.saveDiary("p", date, manual)).source, "supabase");
const saved = await diaryDb.loadDiary("p", date);
assert.equal(saved.saved, true);
assert.deepEqual(JSON.parse(JSON.stringify(saved.diary)), manual);
assert.equal(saved.diary.nghiemThuHangNgay, "");
dbError = true;
assert.equal((await diaryDb.saveDiary("p", date, manual)).source, "local");
assert.deepEqual(JSON.parse(JSON.stringify((await diaryDb.loadDiary("p", date)).diary)), manual);
assert.equal((await diaryDb.loadDiary("other", date)).saved, false);
assert.equal((await diaryDb.loadDiary("p", "2027-10-30")).saved, false);
networkError = true;
assert.equal((await diaryDb.saveDiary("p", date, manual)).source, "local");
assert.deepEqual(JSON.parse(JSON.stringify((await diaryDb.loadDiary("p", date)).diary)), manual);
storageError = true;
await assert.rejects(() => diaryDb.saveDiary("p", date, manual), /storage full/);
storage.set("nhat-ky-thi-cong-ngay:p:2027-10-29", "broken JSON");
assert.equal((await diaryDb.loadDiary("p", date)).saved, false);
console.log("construction diary save/reload/blank/local fallback/network/storage checks OK");
