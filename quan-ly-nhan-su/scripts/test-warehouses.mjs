import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";

function load(path, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { ...globals, exports, URL, crypto: { randomUUID }, require: (id) => { assert.ok(id in imports, id); return imports[id]; } });
  return exports;
}
const machines = load("../src/data/machines.ts");
const equipment = load("../src/lib/projectEquipment.ts", { "@/data/machines": machines });
const rules = load("../src/lib/warehouses.ts", { "@/lib/projectEquipment": equipment });
const warehouse = { id: "hn", name: "Kho 1 Hà Nội", address: "Địa chỉ kho Hà Nội" };
const model = { id: "g", code: "G1", name: "Máy mài", type: "", model: "M20", weldingTechnology: "", specs: { quantity: 20, warehouseId: "hn" } };
const projects = [{ id: "p", name: "Dự án A" }, { id: "q", name: "Dự án B" }];
let metadata = { p: { status: "Đang triển khai", machineTypes: ["G1"], machineQuantities: { G1: 8 } } };
let rows = rules.equipmentLocations([model], [warehouse], projects, metadata);
assert.equal(rows[0].warehouseQuantity, 12);
assert.equal(rows[0].projects[0].quantity, 8);
assert.match(rules.equipmentLocationLabel(rows[0]), /Dự án Dự án A: 8 bộ; Kho 1 Hà Nội.*12 bộ/);
metadata.q = { status: "Đang triển khai", machineTypes: ["G1"], machineQuantities: { G1: 5 } };
assert.equal(rules.equipmentLocations([model], [warehouse], projects, metadata)[0].warehouseQuantity, 7);
metadata.p.status = "Hoàn thành";
assert.equal(rules.equipmentLocations([model], [warehouse], projects, metadata)[0].warehouseQuantity, 15);
delete metadata.q;
assert.equal(rules.equipmentLocations([model], [warehouse], projects, metadata)[0].warehouseQuantity, 20);
assert.equal(rules.equipmentLocations([model], [], projects, metadata)[0].warehouseName, "Chưa chọn kho");
const moved = rules.equipmentLocations([{ ...model, specs: { ...model.specs, warehouseId: "hcm" } }], [warehouse, { id: "hcm", name: "Kho 2 HCM", address: "HCM" }], projects, metadata);
assert.equal(moved[0].warehouseName, "Kho 2 HCM");
const overallocated = rules.equipmentLocations([model], [warehouse], projects, {
  p: { status: "Đang triển khai", machineTypes: ["G1"], machineQuantities: { G1: 15 } },
  q: { status: "Đang triển khai", machineTypes: ["G1"], machineQuantities: { G1: 8 } },
});
assert.equal(overallocated[0].warehouseQuantity, 0);
assert.equal(overallocated[0].excessQuantity, 3);
assert.match(rules.equipmentLocationLabel(overallocated[0]), /Đang gán vượt 3 bộ/);
const orphan = rules.equipmentLocations([model], [warehouse], projects, {
  deleted: { status: "Đang triển khai", machineTypes: ["G1"], machineQuantities: { G1: 2 } },
  completed: { status: "Hoàn thành", machineTypes: ["G1"], machineQuantities: { G1: 20 } },
});
assert.equal(orphan[0].projects.length, 1);
assert.equal(orphan[0].projects[0].missing, true);
assert.equal(orphan[0].warehouseQuantity, 18, "Unresolved allocations cannot silently become warehouse stock");
assert.match(rules.equipmentLocationLabel(orphan[0]), /Dự án không còn tồn tại/);
console.log("PASS allocation conflicts: excess quantities and deleted-project references remain visible without inventing warehouse stock");
console.log("PASS warehouse quantities: 20 total - 8 on project = 12 in warehouse; multiple projects, returns, transfer and unknown warehouse");

let stored = [], references = 0, denied = null, databaseError = null;
const api = load("../src/app/api/warehouses/route.ts", {
  "next/server": { NextResponse: { json: (data, options) => ({ data, status: options?.status ?? 200 }) } },
  "@/lib/server/requireAccess": { requireAccess: async () => denied },
  "@/lib/server/privateJsonStorage": { readPrivateJson: async () => structuredClone(stored), writePrivateJson: async (_, next) => { stored = structuredClone(next); } },
  "@/lib/supabase/admin": { createAdminClient: () => ({ from: () => ({ select() { return this; }, contains: async () => ({ count: references, error: databaseError }) }) }) },
  "@/lib/supabase/env": { formatSupabaseError: (e) => e.message },
});
const request = (data) => ({ json: async () => data });
assert.equal((await api.POST(request({ name: "Kho 1 Hà Nội", address: "" }))).status, 400);
assert.equal((await api.POST(request(null))).status, 400);
const created = await api.POST(request({ name: "Kho 1 Hà Nội", address: "Hà Nội" }));
assert.equal(created.status, 200);
const id = created.data.warehouse.id;
assert.equal((await api.GET()).data.warehouses[0].address, "Hà Nội");
assert.equal((await api.POST(request({ id, name: "Kho 1 Hà Nội", address: "HCM" }))).status, 409);
assert.equal((await api.PUT(request({ id, name: "Kho Hà Nội", address: "Địa chỉ mới" }))).status, 200);
assert.equal(stored[0].id, id);
assert.equal(stored[0].address, "Địa chỉ mới");
assert.equal((await api.PUT(request({ id: "missing", name: "Kho", address: "HN" }))).status, 404);
references = 1;
assert.equal((await api.DELETE({ url: `http://localhost/api/warehouses?id=${id}` })).status, 409);
assert.equal(stored.length, 1);
references = 0; databaseError = new Error("DB offline");
assert.equal((await api.DELETE({ url: `http://localhost/api/warehouses?id=${id}` })).status, 500);
assert.equal(stored.length, 1);
databaseError = null;
denied = { status: 403 };
assert.equal((await api.POST(request({ name: "Kho cấm", address: "HN" }))).status, 403);
denied = null;
assert.equal((await api.DELETE({ url: `http://localhost/api/warehouses?id=${id}` })).status, 200);
assert.equal(stored.length, 0);
console.log("PASS warehouse API: create/read/edit/delete, required address, duplicate names, permissions and deletion guard");

let writes = 0;
const catalog = load("../src/lib/machineCatalogDb.ts", {
  "@/data/machines": machines,
  "@/lib/supabase/client": { createClient: () => { writes++; throw new Error("Unexpected database write"); } },
  "@/lib/supabase/env": { isSupabaseConfigured: () => true },
  "@/lib/projectEquipment": equipment,
  "@/lib/warehousesDb": { loadWarehouses: async () => [warehouse] },
});
await assert.rejects(() => catalog.createMachine({ ...model, specs: { quantity: 20, warehouseId: "unknown" } }), /Kho không còn tồn tại/);
await assert.rejects(() => catalog.updateMachine({ ...model, specs: { quantity: 20, warehouseId: "unknown" } }), /Kho không còn tồn tại/);
assert.equal(writes, 0);
console.log("PASS machine save: unknown warehouse is rejected before any database write");
