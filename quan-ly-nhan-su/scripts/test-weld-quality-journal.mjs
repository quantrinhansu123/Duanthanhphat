import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import * as XLSX from "xlsx";

const require = createRequire(import.meta.url);
function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, Buffer, Date, URL, Error, console, ...globals, require: (id) => {
    if (id in dependencies) return dependencies[id];
    if (id === "server-only") return {};
    if (id.startsWith("node:")) return require(id);
    return new Proxy({}, { get: () => () => undefined });
  } });
  return exports;
}
const rules = load("../src/lib/weldQuality.ts");
const environment = { APP_BASIC_AUTH_USER: "qc-test", APP_BASIC_AUTH_PASSWORD: "fixture-password" };
const auth = load("../src/lib/server/weldQualityAuth.ts", {}, { process: { env: environment } });
const basic = `Basic ${Buffer.from("qc-test:fixture-password").toString("base64")}`;
const request = (extra = {}) => new Request("https://app.test/api/weld-quality", { method: "POST", headers: { "content-type": "application/json", authorization: basic, ...extra }, body: "{}" });
assert.equal(auth.requireWeldQualityAuth(request()), "qc-test");
for (const [headers, status] of [[{ authorization: "" }, 401], [{ authorization: "Basic !!!!" }, 401], [{ origin: "https://other.test" }, 403], [{ "sec-fetch-site": "cross-site" }, 403], [{ "content-type": "text/plain" }, 415]]) {
  assert.throws(() => auth.requireWeldQualityAuth(request(headers)), (e) => e.status === status);
}
delete environment.APP_BASIC_AUTH_PASSWORD;
assert.throws(() => auth.requireWeldQualityAuth(request()), (e) => e.status === 503);
environment.APP_BASIC_AUTH_PASSWORD = "fixture-password";

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const snapshots = new Map([
  [id(1), { ...rules.emptyWeldInspection(id(1)), phien_ban: 4, ngay_mai: "2026-10-27", gia_tri_do: { doc_mat_lan: -0.1, phang_mat_lan: 0 }, ly_do_loai_nghiem_thu: "Field rejection" }],
  [id(2), { ...rules.emptyWeldInspection(id(2)), phien_ban: 2 }],
]);
let saves = [];
let activeSaves = 0, peakSaves = 0;
const qualityDb = {
  loadWeldQuality: async (key) => ({ inspection: snapshots.get(key) ?? null }),
  saveWeldQualityInspection: async (v) => {
    if (v.moi_han_id === id(2)) throw new Error("Mối đã nghiệm thu; cần lập bản sửa đổi");
    activeSaves++; peakSaves = Math.max(peakSaves, activeSaves);
    await Promise.resolve();
    activeSaves--;
    saves.push(structuredClone(v)); return { ...v, phien_ban: v.phien_ban + 1 };
  },
};
const rows = Array.from({ length: 2205 }, (_, i) => ({ id: id(i + 10), ma_lich_su: `W-${i}`, du_an: "Project", tinh_trang_chat_luong: i % 2 ? "Chờ thí nghiệm" : "Chờ mài", tinh_trang_thi_nghiem: ["Chờ thí nghiệm", "Đạt", "Không đạt", "Không thí nghiệm"][i % 4], phien_ban_chat_luong: 1 }));
const db = { from() {
  const predicates = [];
  let start = 0, end = rows.length - 1, head = false;
  return {
    select(_value, options) { head = options?.head; return this; },
    order() { return this; },
    eq(key, value) { predicates.push((r) => r[key] === value); return this; },
    in(key, values) { predicates.push((r) => values.includes(r[key])); return this; },
    gte() { return this; }, lte() { return this; }, or() { return this; }, not() { return this; }, is() { return this; }, gt() { return this; },
    range(a, b) { start = a; end = b; return this; },
    then(resolve) { const filtered = rows.filter((r) => predicates.every((p) => p(r))); return Promise.resolve({ data: head ? null : filtered.slice(start, end + 1), count: filtered.length, error: null }).then(resolve); },
  };
} };
const weldData = load("../src/lib/weldReportData.ts", { "@/lib/supabase/client": { createClient: () => db } });
const journal = load("../src/lib/server/weldQualityJournal.ts", {
  "@/lib/weldQuality": rules, "@/lib/weldReportData": weldData, "@/lib/server/weldQualityAuth": auth,
  "@/lib/server/weldQualityDb": qualityDb, "@/lib/supabase/admin": { createAdminClient: () => db },
});
const parsed = journal.parseQualityInspection({ ...snapshots.get(id(1)), gia_tri_do: { doc_mat_lan: "-0,10", phang_mat_lan: "0" }, nguoi_ghi_nhan: "forged" }, "real-actor");
assert.equal(parsed.gia_tri_do.doc_mat_lan, -0.1);
assert.equal(parsed.gia_tri_do.phang_mat_lan, 0);
assert.equal(parsed.nguoi_ghi_nhan, "real-actor");
for (const patch of [{ ngay_mai: "2026-02-30" }, { phuong_phap_ndt: "wrong" }, { phien_ban: -1 }, { gia_tri_do: { wrong: 0 } }, { ket_qua_ndt: "Đạt", ngay_ndt: null }]) {
  assert.throws(() => journal.parseQualityInspection({ ...snapshots.get(id(1)), ...patch }, "real-actor"));
}
assert.throws(() => journal.parseQualityFilters({ page: 1, pageSize: 1001 }));
assert.throws(() => journal.parseQualityFilters({ qualityStatusFilter: "made-up" }));
assert.throws(() => journal.parseQualityFilters({ dateFrom: "2026-10-29", dateTo: "2026-10-28" }));
const filters = journal.parseQualityFilters({ page: 2, pageSize: 50, qualityStatusFilter: "Chờ mài", projects: ["Project"] });
const expected = rows.filter((r) => r.tinh_trang_chat_luong === "Chờ mài");
const page = await journal.loadQualityJournalPage(filters);
assert.equal(page.total, expected.length);
assert.equal(page.rows[0].id, expected[50].id, "Quality filtering happens before pagination");
const selected = await journal.loadQualityJournalRows(filters, true);
assert.equal(selected.length, expected.length, "Select all spans more than the 1000-row API default");
assert.equal(selected.at(-1).id, expected.at(-1).id);
assert.equal((await journal.loadQualityJournalRows(filters)).length, expected.length, "Export uses the same complete filtered set");

let batch = await journal.markQualityBatch({ kind: "visual", date: "2026-10-28", entries: [{ id: id(1), phien_ban: 4 }, { id: id(2), phien_ban: 2 }, { id: id(3), phien_ban: 9 }] }, "actor");
assert.equal(saves.length, 1);
assert.equal(batch.filter((r) => r.error).length, 2);
assert.equal(saves[0].truc_quan, "Đạt");
assert.equal(saves[0].gia_tri_do.doc_mat_lan, -0.1, "Visual pass does not fabricate geometry");
assert.equal(saves[0].ket_qua_ndt, null, "Visual pass does not set NDT pass");
assert.equal(saves[0].ly_do_loai_nghiem_thu, "Field rejection", "Bulk pass cannot erase field rejection");
saves = [];
await journal.markQualityBatch({ kind: "ndt", date: "2026-10-28", method: "Từ tính", entries: [{ id: id(1), phien_ban: 4 }] }, "actor");
assert.equal(saves[0].phuong_phap_ndt, "Từ tính");
assert.equal(saves[0].truc_quan, null);
assert.equal(saves[0].gia_tri_do.phang_mat_lan, 0);
await assert.rejects(() => journal.markQualityBatch({ kind: "visual", date: "2026-10-28", entries: [{ id: id(1), phien_ban: 4 }, { id: id(1), phien_ban: 4 }] }, "actor"), /trùng/);
saves = [];
await journal.importQualityBatch({ entries: [{ moi_han_id: id(1), phien_ban: 4, patch: { gia_tri_do: { phang_mat_lan: 0.2 } } }] }, "actor");
assert.equal(saves[0].gia_tri_do.doc_mat_lan, -0.1, "Blank import cells preserve current measurements");
assert.equal(saves[0].gia_tri_do.phang_mat_lan, 0.2);
await assert.rejects(() => journal.importQualityBatch({ entries: [{ moi_han_id: id(1), phien_ban: 4, patch: { ly_do_loai_nghiem_thu: null } }] }, "actor"), /không hợp lệ/);
saves = []; peakSaves = 0;
await journal.markQualityBatch({ kind: "visual", date: "2026-10-28", entries: Array.from({ length: 21 }, (_, i) => ({ id: id(i + 10), phien_ban: 0 })) }, "actor");
assert.equal(saves.length, 21, "All 21 selected welds are processed");
assert.ok(peakSaves > 1 && peakSaves <= 5, "Batch processing bounds concurrency without serializing all 100 requests");

const phrases = load("../src/i18n/phrases.ts");
const excel = load("../src/lib/weldQualityExcel.ts", { xlsx: XLSX, "@/lib/weldQuality": rules, "@/i18n/phrases": phrases });
const exportRow = { id: id(1), phien_ban_chat_luong: 4, tinh_trang_chat_luong: "Chờ mài", kiem_tra_chat_luong: snapshots.get(id(1)) };
const makeFile = (items) => {
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items), "Journal");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return { arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) };
};
const exportData = { "Mã bản ghi": id(1), ...excel.qualityExcelColumns(exportRow) };
let imported = await excel.parseWeldQualityExcel(makeFile([exportData]));
assert.equal(imported[0].patch.gia_tri_do.doc_mat_lan, -0.1);
assert.equal(imported[0].patch.gia_tri_do.phang_mat_lan, 0);
assert.equal(imported[0].phien_ban, 4);
const english = Object.fromEntries(Object.entries(exportData).map(([key, value]) => [phrases.PHRASES[key] ?? key, typeof value === "string" ? phrases.PHRASES[value] ?? value : value]));
imported = await excel.parseWeldQualityExcel(makeFile([english]));
assert.equal(imported[0].patch.gia_tri_do.phang_mat_lan, 0, "English exports remain importable");
await assert.rejects(() => excel.parseWeldQualityExcel(makeFile([exportData, exportData])), /trùng/);
await assert.rejects(() => excel.parseWeldQualityExcel(makeFile([{ ...exportData, "Phiên bản kiểm tra": "" }])), /Phiên bản/);

let calls = 0;
const route = load("../src/app/api/weld-quality/route.ts", {
  "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
  "@/lib/server/weldQualityAuth": auth,
  "@/lib/server/weldQualityJournal": { ...journal, loadQualityDetail: async () => { calls++; return {}; } },
  "@/lib/server/weldQualityDb": qualityDb,
  "@/lib/supabase/env": { formatSupabaseError: (e) => e.message },
});
assert.equal((await route.GET(new Request(`https://app.test/api/weld-quality?id=${id(1)}`))).status, 401);
assert.equal(calls, 0, "Unauthorized requests cannot reach service_role");
assert.equal((await route.POST(new Request("https://app.test/api/weld-quality", { method: "POST", headers: { authorization: basic, "content-type": "application/json" }, body: "{" }))).status, 400);
assert.equal((await route.GET(new Request(`https://app.test/api/weld-quality?id=${id(1)}`, { headers: { authorization: basic } }))).status, 200);
assert.equal(calls, 1);
console.log("PASS: auth and origin guards, API validation, actor identity, quality filtering before pagination, all-page selection/export, partial bulk errors, stale revisions, no fabricated geometry, bilingual Excel round trip");
