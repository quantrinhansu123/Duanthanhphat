import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadModule(path, dependencies = {}) {
  const api = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports: api, require: (id) => dependencies[id] });
  return api;
}

let fail = false;
let responseLimit = 1000;
const tables = {
  bao_cao_moi_han_theo_du_an: Array.from({ length: 2397 }, (_, id) => ({ id: String(id) })),
  bao_cao_moi_han_theo_tho: [{ tho_han_id: "1" }],
  bao_cao_moi_han_theo_nam: [],
};
const db = {
  from(view) {
    const orders = [];
    return {
      select(columns) { assert.ok(!columns.includes("created_at")); return this; },
      order(column) { assert.notEqual(column, "created_at"); orders.push(column); return this; },
      async range(from, to) {
        assert.ok(to - from < 1000);
        if (view === "bao_cao_moi_han_theo_du_an") assert.deepEqual(orders, ["ngay_thuc_hien", "id"]);
        if (fail) return { data: null, error: { code: "42501", message: "permission denied" } };
        return { data: tables[view].slice(from, Math.min(to + 1, from + responseLimit)), error: null };
      },
    };
  },
};
const env = loadModule("../src/lib/supabase/env.ts");
const api = loadModule("../src/lib/bulkImportDb.ts", {
  "@/lib/supabase/client": { createClient: () => db },
  "@/lib/supabase/env": env,
});
for (const limit of [1000, 500]) {
  responseLimit = limit;
  const result = await api.fetchBulkImportData();
  assert.equal(result.projects.length, 2397);
  assert.equal(new Set(result.projects.map((row) => row.id)).size, 2397);
  assert.equal(result.projects.at(-1).id, "2396");
  assert.equal(result.welders.length, 1);
  assert.equal(result.years.length, 0);
}
fail = true;
await assert.rejects(() => api.fetchBulkImportData(), /permission denied/);
console.log("PASS: no created_at dependency; all rows loaded across response limits; empty views and Supabase errors handled");
