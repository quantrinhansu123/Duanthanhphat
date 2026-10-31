import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

let groups;
let certificates;
let missingExtras = false;
let writes;
let rpcCalls;
const db = {
  from(table) {
    let operation = "select";
    let payload;
    let columns = "";
    let single = false;
    const filters = [];
    const query = {
      select(value) { columns = value; return this; },
      insert(value) { operation = "insert"; payload = structuredClone(value); return this; },
      update(value) { operation = "update"; payload = structuredClone(value); return this; },
      eq(key, value) { filters.push((row) => row[key] === value); return this; },
      ilike(key, value) { filters.push((row) => row[key].toLowerCase() === value.toLowerCase()); return this; },
      in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
      limit() { return this; },
      single() { single = true; return this; },
      or(expression) {
        const alternatives = [...expression.matchAll(/and\(ngay_cap\.(is\.null|eq\.[\d-]+),ngay_het_han\.(is\.null|eq\.[\d-]+)\)/g)];
        assert.equal(alternatives.length, 2, "Date filter must contain missing dates and previous group dates");
        filters.push((row) => alternatives.some(([, issued, expires]) =>
          [["ngay_cap", issued], ["ngay_het_han", expires]].every(([key, condition]) =>
            condition === "is.null" ? row[key] == null : row[key] === condition.slice(3))));
        return this;
      },
      then(resolve) {
        if (missingExtras && /nha_cung_cap|loai_day_han/.test(columns + Object.keys(payload ?? {}).join())) {
          return Promise.resolve({ data: null, error: { message: "missing nha_cung_cap column" } }).then(resolve);
        }
        const tableRows = table === "chung_chi_nhom" ? groups : certificates;
        let rows = tableRows.filter((row) => filters.every((filter) => filter(row)));
        if (operation === "insert") {
          rows = (Array.isArray(payload) ? payload : [payload]).map((row) => ({ id: `new-${tableRows.length}`, ...row }));
          tableRows.push(...rows);
          writes++;
        } else if (operation === "update") {
          rows.forEach((row) => Object.assign(row, payload));
          writes++;
        }
        return Promise.resolve({ data: structuredClone(single ? rows[0] : rows), error: null }).then(resolve);
      },
    };
    return query;
  },
  async rpc() { rpcCalls++; return { error: null }; },
};
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/lib/certificatesDb.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  exports: api,
  require: () => ({ createClient: () => db, isSupabaseConfigured: () => true, formatSupabaseError: (error) => error.message }),
});

function reset() {
  groups = [];
  certificates = [];
  writes = 0;
  rpcCalls = 0;
  missingExtras = false;
}
const dates = { issuedAt: "2026-10-15", expiresAt: "2027-10-15" };
reset();
await api.createCertificateType({ title: "K922", ...dates, supplier: "KZESO" });
assert.equal(groups[0].ngay_cap, dates.issuedAt);
assert.equal(groups[0].ngay_het_han, dates.expiresAt);
assert.equal(groups[0].nha_cung_cap, "KZESO");

for (const invalid of [
  { issuedAt: "", expiresAt: dates.expiresAt },
  { issuedAt: dates.issuedAt, expiresAt: "" },
  { issuedAt: "2026-02-30", expiresAt: dates.expiresAt },
  { issuedAt: "2026-10-15", expiresAt: "2026-10-14" },
  { issuedAt: "15/10/2026", expiresAt: dates.expiresAt },
]) {
  reset();
  await assert.rejects(api.createCertificateType({ title: "K922", ...invalid }));
  await assert.rejects(api.updateCertificateType({ id: "group", title: "K922", ...invalid }));
  await assert.rejects(api.createPersonnelCertificates({ title: "K922", employeeIds: ["person"], status: "Còn hiệu lực", ...invalid }));
  await assert.rejects(api.updateCertificateRecord({id:"cert",title:"K922",status:"Còn hiệu lực",...invalid}));
  await assert.rejects(api.syncGroupCertificates({groupId:"group",title:"K922",employeeIds:["person"],status:"Còn hiệu lực",...invalid}));
  assert.equal(writes, 0, "Invalid dates must fail before writing");
  assert.equal(rpcCalls, 0, "Do not issue a personal certificate with invalid dates");
}
reset();
await api.createCertificateType({ title: "K922", issuedAt: "2024-02-29", expiresAt: "2024-02-29" });
assert.equal(groups.length, 1, "Allow real leap days and same-day expiry");

for (const oldDates of [
  { ngay_cap: "2025-01-01", ngay_het_han: "2026-01-01" },
  { ngay_cap: null, ngay_het_han: null },
]) {
  reset();
  groups.push({ id: "group", ten_nhom: "K922", ...oldDates });
  certificates.push(
    { id: "shared", nhom_id: "group", ...oldDates },
    { id: "missing", nhom_id: "group", ngay_cap: null, ngay_het_han: null },
    { id: "personal", nhom_id: "group", ngay_cap: "2025-03-01", ngay_het_han: "2028-03-01" },
    { id: "other", nhom_id: "other", ...oldDates },
  );
  await api.updateCertificateType({ id: "group", title: "K922", ...dates });
  assert.equal(groups[0].ngay_cap, dates.issuedAt);
  assert.equal(groups[0].ngay_het_han, dates.expiresAt);
  assert.equal(certificates[0].ngay_cap, dates.issuedAt);
  assert.equal(certificates[1].ngay_het_han, dates.expiresAt);
  assert.equal(certificates[2].ngay_cap, "2025-03-01", "Keep personal issue dates");
  assert.equal(certificates[2].ngay_het_han, "2028-03-01", "Keep personal expiry dates");
  assert.equal(certificates[3].ngay_het_han, oldDates.ngay_het_han, "Keep other groups untouched");
}
reset();
groups.push({ id: "group", ten_nhom: "K922", ngay_cap: dates.issuedAt, ngay_het_han: dates.expiresAt });
await api.updateCertificateType({ id: "group", title: "K922", ...dates, employeeIds: ["new-person"] });
assert.equal(certificates[0].employee_id, "new-person");
assert.equal(certificates[0].ngay_cap, dates.issuedAt);
assert.equal(certificates[0].ngay_het_han, dates.expiresAt);

reset();
missingExtras = true;
await assert.rejects(api.createCertificateType({ title: "K922", ...dates, supplier: "KZESO", employeeIds: ["person"] }), /migration_20261015/);
assert.equal(rpcCalls, 0, "Missing schema must not partially issue certificates");
assert.equal(writes, 0);
await api.createCertificateType({ title: "K922", ...dates });
assert.equal(groups[0].ngay_cap, dates.issuedAt, "Old schema fallback must retain dates");

const component = ts.createSourceFile("CertificateManagement.tsx", fs.readFileSync(new URL("../src/components/CertificateManagement.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let certificateTypesDeclaration;
function findCertificateTypes(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(component) === "certificateTypes" && node.initializer?.getText(component).startsWith("useMemo")) certificateTypesDeclaration = node.getText(component);
  ts.forEachChild(node, findCertificateTypes);
}
findCertificateTypes(component);
assert.ok(certificateTypesDeclaration);
const owners = {};
vm.runInNewContext(ts.transpileModule(`const ${certificateTypesDeclaration}; exports.rows = certificateTypes;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText, {
  exports: owners,
  useMemo: (fn) => fn(),
  normalizeCertTitle: (title) => title.trim().toLowerCase(),
  parseCertificateList: (value) => value,
  catalogGroups: [{ id: "group", name: "K922" }],
  welders: [{ employee_id: "person", ho_ten: "A", chung_chi: [], created_at: "2026-01-01" }],
  certificateItems: [{ employeeId: "person", title: "K922", status: "Hết hạn" }],
});
assert.equal(owners.rows[0].holders[0].id, "person", "Expired certificates remain visible even when absent from the active personnel cache");
console.log("PASS: certificate date persistence, validation, shared/personal dates, new holders, missing-schema safety");
