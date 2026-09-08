import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

let failedCreatedAt = 0;
let pageReads = 0;
let unexpectedError = false;
const statuses = ["Chờ thí nghiệm", "Đạt", "Không đạt", "Không thí nghiệm"];
const rows = Array.from({ length: 120 }, (_, index) => ({ id: String(index), tinh_trang_thi_nghiem: statuses[index % 4] }));
const db = { from() {
  let columns = "", head = false, start = 0, end = 49, status;
  return {
    select(value, options) { columns = value; head = options?.head; return this; },
    order() { return this; }, eq(key, value) { if (key === "tinh_trang_thi_nghiem") status = value; return this; }, or() { return this; },
    range(a, b) { start = a; end = b; return this; },
    then(resolve) {
      if (unexpectedError) return Promise.resolve({ error: { message: "permission denied" } }).then(resolve);
      if (columns.includes("created_at")) {
        failedCreatedAt++;
        return Promise.resolve({ error: { code: "42703", message: "column created_at does not exist" } }).then(resolve);
      }
      const filtered = rows.filter((row) => !status || row.tinh_trang_thi_nghiem === status);
      if (!head) { pageReads++; assert.ok(end - start < 50, "Never fetch all history because created_at is absent"); }
      return Promise.resolve({ error: null, count: filtered.length, data: head ? null : filtered.slice(start, end + 1) }).then(resolve);
    },
  };
} };
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/lib/weldReportData.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: api, require: () => ({ createClient: () => db, isSupabaseConfigured: () => true, formatSupabaseError: (error) => error.message }) });
const first = await api.loadWeldJournalPage({ page: 1 });
assert.equal(first.total, 120);
assert.equal(first.pendingCount, 30);
assert.equal(first.rows[0].tinh_trang_thi_nghiem, "Chờ thí nghiệm");
const second = await api.loadWeldJournalPage({ page: 2 });
assert.equal(second.rows[0].id, "50");
assert.equal(failedCreatedAt, 1);
assert.equal(pageReads, 2);
const filtered = await api.loadWeldJournalPage({ page: 1, resultFilter: "Chờ thí nghiệm" });
assert.equal(filtered.total, 30);
assert.equal(filtered.passCount, 0);
unexpectedError = true;
await assert.rejects(() => api.loadWeldJournalPage({ page: 1 }), /permission denied/);
console.log("PASS: missing created_at retains pagination, status, counts and filters; unrelated errors do not fetch all rows");
