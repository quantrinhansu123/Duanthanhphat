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
const trackEditor = load("../features/lwr/lib/track-editor", { "./track-data": {}, "./stress-release": {} });
const { diaryWorkText, diaryManpowerDefaults, diaryStressReleaseText } = load("constructionDiaryAuto", {
  "./weldAcceptance": load("weldAcceptance"), "@lwr/lib/track-editor": trackEditor,
});
const row = (id, ma_diem, ly_trinh, quantity = 1, method = "FBW") => ({ id, ma_diem, ly_trinh, ma_lich_su: `PQ-${id}`, so_luong_thuc_hien: quantity, cong_nghe_han: method });
const rows = [row("a", "HT0001", "Km10+100", 2), row("b", "HP0002", "Km2+005"), row("c", "TT0001", "Km1+000", 1, "ATW")];
const text = diaryWorkText([...rows, rows[0]], "weld");
assert.match(text, /Hàn chảy giáp mép đoạn Km2\+005 – Km10\+100, thuộc tuyến hạ. Khối lượng: 3 mối/);
assert.match(text, /Hàn nhiệt nhôm đoạn Km1\+000 – Km1\+000, thuộc tuyến thượng/);
assert.equal(text.split("\n").length, 2);
assert.match(diaryWorkText(rows, "grind"), /^Mài ray/);
assert.match(diaryWorkText(rows, "weld"), /Mối số: HP0002, HT0001/);
assert.match(diaryWorkText(rows, "accept"), /Mối số: HP0002, HT0001/);
assert.match(diaryWorkText([row("d", null, null)], "weld"), /Km… – Km…, thuộc tuyến ….*cần bổ sung lý trình/);
assert.match(diaryWorkText([rows[0], row("d", "HT0002", "bad")], "grind"), /cần bổ sung lý trình/);
assert.equal(diaryWorkText([], "weld"), "");
assert.match(diaryWorkText([row("f", "TT0002", "Km0+044.43")], "weld"), /Km0\+044\.43/);
console.log("construction diary defaults OK");

const rail = { id: "lwr", code: "HT-01", projectId: "p", rowKey: "HT", startCellId: "HT-01", endCellId: "HT-01", releaseDate: "2026-10-27", completedAt: "2026-10-28T18:00:00Z" };
const layout = { rows: [{ line: "TUYẾN HẠ", rail: "RAY TRÁI", cells: [{id:"HT-01",from:"0+000",to:"0+500"}] }], longRails: [rail, rail, {...rail,id:"other",projectId:"q"}, {...rail,id:"pending",completedAt:undefined}] };
assert.match(diaryStressReleaseText(layout,"p","2026-10-29"), /Giải tỏa ứng suất đoạn Km0\+000 – Km0\+500.*HT-01.*500 m ray/);
assert.equal(diaryStressReleaseText(layout,"p","2026-10-29").split("\n").length,1);
assert.equal(diaryStressReleaseText(layout,"p","2026-10-27"), "", "Planned release date is not completion date");

const tables = {
  lich_su_moi_han: rows.map((r, i) => ({ ...r, du_an_id: "p", ngay_thuc_hien: i === 0 ? "2026-10-29" : "2026-10-28" })),
  kiem_tra_moi_han: [
    { moi_han_id: "b", ngay_mai: "2026-10-29", "lich_su_moi_han.du_an_id": "p" },
  ],
  dot_nghiem_thu_moi: [
    { moi_han_id: "c", ket_qua: "Đạt", "dot_nghiem_thu.ngay_nghiem_thu": "2026-10-29", "dot_nghiem_thu.phieu_yeu_cau_nghiem_thu.du_an_id": "p" },
    { moi_han_id: "a", ket_qua: "Chưa nghiệm thu", "dot_nghiem_thu.ngay_nghiem_thu": "2026-10-29", "dot_nghiem_thu.phieu_yeu_cau_nghiem_thu.du_an_id": "p" },
    { moi_han_id: "a", ket_qua: "Đạt", "dot_nghiem_thu.ngay_nghiem_thu": "2026-10-29", "dot_nghiem_thu.phieu_yeu_cau_nghiem_thu.du_an_id": "other" },
  ],
  du_an: [{ id: "p", nguoi_phu_trach: "manager" }],
  lwr_track_layouts: [{project_id: "p", layout}],
  nhan_su: [
    { employee_id: "manager", ho_ten: "Chỉ huy", chuc_vu: "CHT - Kỹ sư - Thợ hàn", trang_thai: "Hoạt động" },
    { employee_id: "engineer", ho_ten: "Kỹ sư", chuc_vu: "Kỹ sư - Thợ hàn", trang_thai: "Hoạt động" },
    { employee_id: "worker", ho_ten: "Thợ", chuc_vu: "Thợ hàn", trang_thai: "Hoạt động" },
    { employee_id: "locked", ho_ten: "Nghỉ", chuc_vu: "Thợ hàn", trang_thai: "Khóa" },
  ],
  bao_cao_ngay_cong_viec: [
    { phan: "hom_nay", "bao_cao_ngay.du_an_id": "p", "bao_cao_ngay.ngay_bao_cao": "2026-10-29", nhan_luc: { cht: [{ten: "2"}], ky_su: [{ten: "3"}], lai_may: [{ten: "4"}], tho_van_hanh: [{ten: "5"}], cong_nhan: [{ten: "6"}], vnr: [{ten: "7"}] } },
    { phan: "hom_nay", "bao_cao_ngay.du_an_id": "other", "bao_cao_ngay.ngay_bao_cao": "2026-10-29", cht_ten: "99" },
    { phan: "ngay_tiep_theo", "bao_cao_ngay.du_an_id": "p", "bao_cao_ngay.ngay_bao_cao": "2026-10-29", cht_ten: "88" },
  ],
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
    not(k, op, value) { assert.equal(op, "is"); assert.equal(value, null); result = result.filter((r) => r[k] != null); return q; },
    in(k, values) { result = result.filter((r) => values.includes(r[k])); return q; },
    range(a, b) { result = result.slice(a, b + 1); return q; },
    async single() { return { data: result[0], error: fail ? new Error("offline") : null }; },
    async maybeSingle() { return { data: result[0] ?? null, error: fail ? new Error("offline") : null }; },
    then(resolve) { return Promise.resolve({ data: result, error: fail ? new Error("offline") : null }).then(resolve); },
  };
  return q;
} };
const { loadDiaryDefaults } = load("server/weldAcceptanceServer", {
  "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => db },
  "@/lib/server/weldQualityAuth": { QualityApiError: Error },
  "@/lib/server/weldQualityJournal": { qualityUuid: (v) => v, qualityDate: (v) => v },
  "@/lib/server/weldQualityDb": {}, "@/lib/weldAcceptance": {},
  "@/lib/constructionDiaryAuto": { diaryWorkText, diaryManpowerDefaults, diaryStressReleaseText },
  "@lwr/lib/track-editor": {validateTrackLayout: value=>value},
  "@/lib/server/privateJsonStorage": { readPrivateJson: async () => ({ p: { personnelIds: ["manager", "engineer", "worker", "locked"] } }) },
  "@/lib/server/projectEquipment": { loadProjectEquipment: async () => [] },
  "@/lib/projectEquipment": { projectEquipmentText: () => "Chưa gán thiết bị" },
});
const defaults = await loadDiaryDefaults({ du_an_id: "p", date: "2026-10-29" });
assert.match(defaults.noiDungCongViec, /Hàn chảy giáp mép.*Khối lượng: 2 mối/);
assert.match(defaults.noiDungCongViec, /Mài ray.*Khối lượng: 1 mối/);
assert.doesNotMatch(defaults.noiDungCongViec, /Hàn nhiệt nhôm/);
assert.match(defaults.noiDungCongViec, /Giải tỏa ứng suất.*500 m ray/);
assert.match(defaults.nghiemThuHangNgay, /TT0001.*Kết quả: Đạt/);
assert.doesNotMatch(defaults.nghiemThuHangNgay, /RFI-001|HT0001/);
assert.equal(defaults.banChiHuy, "2");
assert.equal(defaults.canBoKyThuat, "3");
assert.equal(defaults.congNhan, "22");
const empty = await loadDiaryDefaults({ du_an_id: "p", date: "2026-10-30" });
assert.equal(empty.nghiemThuHangNgay, "Không có công tác nghiệm thu");
assert.equal(empty.noiDungCongViec, "Không có công tác thi công trong ngày");
assert.equal(empty.banChiHuy, "1");
assert.equal(empty.canBoKyThuat, "1");
assert.equal(empty.congNhan, "1");
const repeated = diaryManpowerDefaults([
  tables.bao_cao_ngay_cong_viec[0], tables.bao_cao_ngay_cong_viec[0],
], [], null);
assert.equal(repeated.congNhan, "22", "Repeated daily manpower across work items is not summed twice");
assert.equal(diaryManpowerDefaults([{ cht_ten: "0" }], tables.nhan_su, "manager").banChiHuy, "0", "Explicit zero overrides roster");
assert.equal(diaryManpowerDefaults([{ky_su_ten:"A, B"},{ky_su_ten:"A"}],[],null).canBoKyThuat,"2","Legacy names are deduplicated across work items");
fail = true;
await assert.rejects(() => loadDiaryDefaults({ du_an_id: "p", date: "2026-10-29" }), /offline/);
console.log("construction diary date/project/actual acceptance/stress release/manpower/error checks OK");

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

const { reportWeatherFields, weatherLabel } = load("reportWeather");
const weatherData = {
  daily: { time: ["2026-10-29"], weather_code: [61], temperature_2m_mean: [27.4] },
  hourly: { time: ["2026-10-29T07:00", "2026-10-29T13:00", "2026-10-29T19:00"], weather_code: [0, 61, 3], temperature_2m: [25.8, 29.2, 27.1] },
};
const weather = reportWeatherFields(weatherData, "2026-10-29");
assert.equal(weather.thoiTiet, "Mưa");
assert.equal(weather.sang, "Nắng, 26°C");
assert.equal(weather.chieu, "Mưa, 29°C");
assert.equal(weather.toi, "Nhiều mây, 27°C");
assert.equal(reportWeatherFields({...weatherData,hourly:{...weatherData.hourly,weather_code:[0,61,0]}},"2026-10-29").toi,"Trời quang, 27°C");
assert.throws(() => reportWeatherFields(weatherData, "2026-10-30"), /Chưa có dữ liệu/);
assert.throws(() => reportWeatherFields({daily: {time: ["2026-10-29"], weather_code: [null]}}, "2026-10-29"), /Chưa có dữ liệu/);
assert.equal(weatherLabel(95), "Dông");
assert.equal(weatherLabel(71), "Tuyết");
console.log("weather date, morning/afternoon/evening, missing-data checks OK");

let point = {vi_do: 10.2, kinh_do: 103.96}, weatherFetches = 0, location = "";
const projectWeather = load("server/projectWeather", {
  "server-only": {},
  "@/lib/supabase/admin": { createAdminClient: () => ({from(table) {
    assert.ok(["toa_do","du_an"].includes(table));
    const q = {select() {return q;}, eq(k,v) {assert.equal(k,table === "toa_do" ? "du_an_id" : "id");assert.equal(v,"p");return q;}, not() {return q;}, order() {return q;}, async limit() {return {data: point ? [point] : [], error: null};}, async single() {return {data: {vi_tri: location},error: null};}};
    return q;
  }}) },
  "@/lib/server/weldQualityJournal": { qualityUuid: v=>v, qualityDate: v=>v },
  "@/lib/reportWeather": { reportWeatherFields },
}, { URL, URLSearchParams, AbortSignal, fetch: async (url) => {
  weatherFetches++;
  assert.equal(url.searchParams.get("latitude"),"10.2");
  assert.equal(url.searchParams.get("longitude"),"103.96");
  assert.equal(url.searchParams.get("timezone"),"auto");
  return {ok: true, json: async()=>weatherData};
}});
assert.equal((await projectWeather.loadProjectWeather({du_an_id:"p",date:"2026-10-29"})).chieu,"Mưa, 29°C");
point = null;
await assert.rejects(()=>projectWeather.loadProjectWeather({du_an_id:"p",date:"2026-10-29"}),/chưa có tọa độ/);
assert.equal(weatherFetches,1,"Missing coordinates must not use weather from another project");
location = "Phú Quốc - An Giang";
assert.equal((await projectWeather.loadProjectWeather({du_an_id:"p",date:"2026-10-29"})).thoiTiet,"Mưa");
assert.equal(weatherFetches,2,"Phu Quoc reports retain the existing location fallback");
console.log("project weather coordinates and missing-location checks OK");
