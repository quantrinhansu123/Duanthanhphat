import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { ...globals, exports, URL, require: (id) => { assert.ok(id in imports, id); return imports[id]; } });
  return exports;
}
const machines = load("../src/data/machines.ts");
const rules = load("../src/lib/projectEquipment.ts", { "@/data/machines": machines });
const { assignedEquipment, equipmentGroup, equipmentQuantity, projectEquipmentText } = rules;
const weld = { id: "w", code: "W1", name: "Máy hàn", model: "UN5", type: "", weldingTechnology: "FBW", specs: {} };
const grind = { id: "g", code: "G1", name: "Máy mài ray", model: "GM", type: "", weldingTechnology: "", specs: { quantity: 20 } };
assert.equal(equipmentGroup(weld), "welding");
assert.equal(equipmentGroup(grind), "other");
assert.equal(equipmentGroup({ ...grind, specs: { equipmentGroup: "welding" } }), "welding");
assert.equal(equipmentQuantity(grind), 20);
assert.equal(equipmentQuantity(weld), 1);
const assigned = assignedEquipment([weld, grind], { machineTypes: ["W1", "G1"], machineQuantities: { G1: 8 } });
assert.equal(assigned.length, 2);
assert.equal(assigned[1].quantity, 8);
assert.equal(assigned[0].quantity, 1);
assert.equal(assignedEquipment([weld, grind], { machineTypes: [] }).length, 0);
assert.equal(assignedEquipment([weld], { machineTypes: ["old-code"] })[0].missing, true);
assert.match(projectEquipmentText(assigned), /1\. Máy hàn:[\s\S]*1 bộ[\s\S]*2\. Máy và thiết bị khác:[\s\S]*8 bộ/);

let store = { p: { status: "Đang triển khai", machineTypes: ["W1", "G1"], machineQuantities: { G1: 8 } } };
const tables = [weld, grind].map((m) => ({ id: m.id, ma_may: m.code, ten_may: m.name, model: m.model, loai_may: m.type, cong_nghe_han: m.weldingTechnology, thong_so: m.specs }));
const client = { from() { return { select() { return this; }, in(key, values) { return Promise.resolve({ data: tables.filter((m) => values.includes(m[key])), error: null }); } }; } };
const server = load("../src/lib/server/projectEquipment.ts", {
  "server-only": {}, "@/lib/server/privateJsonStorage": { readPrivateJson: async () => store },
  "@/lib/supabase/admin": { createAdminClient: () => client }, "@/lib/projectEquipment": rules,
});
assert.equal((await server.loadProjectEquipment("p"))[1].quantity, 8);
assert.equal((await server.loadProjectEquipment("other-project")).length, 0);

const route = load("../src/app/api/project-metadata/route.ts", {
  "next/server": { NextResponse: { json: (data, options) => ({ data, status: options?.status ?? 200 }) } },
  "@/lib/server/requireAccess": { requireAccess: async () => null },
  "@/lib/supabase/env": { formatSupabaseError: (error) => error.message },
  "@/lib/supabase/admin": { createAdminClient: () => client },
  "@/lib/projectEquipment": rules,
  "@/lib/server/privateJsonStorage": { readPrivateJson: async () => structuredClone(store), writePrivateJson: async (_, next) => { store = next; } },
});
const put = (quantity) => route.PUT({ json: async () => ({ projectId: "p", metadata: { status: "Đang triển khai", machineTypes: ["W1", "G1"], machineQuantities: { G1: quantity } } }) });
assert.equal((await put(12)).status, 200);
assert.equal((await server.loadProjectEquipment("p"))[1].quantity, 12);
assert.equal((await put(21)).status, 400);
for (const invalid of [0, -1, 1.5, "2"]) assert.notEqual((await put(invalid)).status, 200);
assert.equal(store.p.machineQuantities.G1, 12, "Invalid assignment must not overwrite saved quantities");
store.q = { status: "Đang triển khai", machineTypes: ["G1"], machineQuantities: { G1: 7 } };
assert.equal((await put(14)).status, 400, "Cannot allocate more sets than remain after another project");
assert.equal((await put(13)).status, 200);
delete store.q;
const bulk = await route.PUT({ json: async () => ({ store: { p: { ...store.p, machineQuantities: { G1: 25 } } } }) });
assert.notEqual(bulk.status, 200, "Bulk metadata save must also reject quantities above stock");
store.p.status = "Hoàn thành";
store.q = { status: "Đang triển khai", machineTypes: ["G1"], machineQuantities: { G1: 20 } };
assert.notEqual((await put(13)).status, 200, "Reactivating a completed project must check available stock again");
store.p.status = "Đang triển khai";
delete store.q;
const clear = await route.PUT({ json: async () => ({ projectId: "p", metadata: { ...store.p, machineTypes: ["W1"] } }) });
assert.equal(clear.status, 200);
assert.equal((await server.loadProjectEquipment("p")).length, 1);
assert.equal(store.p.machineQuantities.G1, undefined, "Removing an assignment also removes its quantity");
console.log("PASS project equipment: groups, quantity, legacy defaults, project isolation, save/reload, invalid and overstock rejection, unassign");

const local = { headers: [{ id: "report", ngayBaoCao: "2026-10-30", duAnId: "p" }], work: [], incidents: [], equipment: [{ id: "manual", baoCaoId: "report", tenThietBi: "Thiết bị bổ sung", soLuong: "2", ghiChu: "" }] };
const daily = load("../src/lib/dailyReportDb.ts", {
  "@/lib/supabase/client": {},
  "@/lib/supabase/env": { isSupabaseConfigured: () => false, formatSupabaseError: (e) => e.message },
  "@/lib/weldReportData": {},
  "@/lib/projectEquipmentDb": { loadProjectEquipment: async (id) => { assert.equal(id, "p"); return assigned; } },
}, { window: { localStorage: { getItem: () => JSON.stringify(local) } } });
const report = await daily.loadDailyReport("2026-10-30");
assert.equal(report.equipment.length, 3);
assert.equal(report.equipment.find((r) => r.id === "project:g").soLuong, "8");
assert.equal(report.equipment.find((r) => r.id === "project:g").boPhan, "2. Máy và thiết bị khác");
assert.equal(report.equipment.find((r) => r.id === "manual").soLuong, "2");
assert.equal(local.equipment.length, 1, "Reading a report must not create or save duplicate equipment");
console.log("PASS daily report: uses project equipment with both groups and quantities; preserves manual rows; no writes");

let overrides = { g: grind, G1: grind, w: weld, W1: weld };
const catalog = load("../src/lib/machineCatalogDb.ts", {
  "@/data/machines": machines,
  "@/lib/supabase/client": {},
  "@/lib/supabase/env": { isSupabaseConfigured: () => false },
  "@/lib/projectEquipment": rules,
  "@/lib/warehousesDb": {},
}, { window: { localStorage: { getItem: () => JSON.stringify(overrides), setItem: (_, value) => { overrides = JSON.parse(value); } } } });
await catalog.deleteMachine("g");
assert.equal(overrides.g, undefined);
assert.equal(overrides.G1, undefined);
assert.ok(overrides.w && overrides.W1, "Deleting a machine clears both cache keys and keeps unrelated equipment");
console.log("PASS cleanup: deleting test equipment removes both local cache aliases");
