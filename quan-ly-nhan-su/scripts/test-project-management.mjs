import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

function load(relative, dependencies, extra = "") {
  const api = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(relative, import.meta.url), "utf8") + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports: api, require: dependencies,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test" } },
    window: { alert: (message) => { throw Error(message); } },
  });
  return api;
}
const writes = [];
let record = {};
const db = { from: () => ({ update(body) { writes.push(body); Object.assign(record, body); return this; }, eq() { return this; }, then(resolve) { return Promise.resolve({ error: null }).then(resolve); } }) };
const projectApi = load("../src/lib/projectsDb.ts", () => ({ createClient: () => db, projects: [] }));
const react = {
  useState: (value) => [typeof value === "function" ? value() : value, () => {}],
  useRef: (value) => ({ current: value }), useEffect: () => {},
  useMemo: (factory) => factory(), useCallback: (callback) => callback,
};
const components = load("../src/components/ProjectManagement.tsx", (id) => {
  if (id === "react") return react;
  if (id === "react/jsx-runtime") return jsx;
  if (id === "@/lib/projectsDb") return projectApi;
  return { welders: [], REPORT_MACHINES: [] };
}, "\nexport { CheckboxGroup, ProjectModal, emptyProject };\n");
function nodes(element) {
  if (!element || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  return [element, ...nodes(element.props?.children)];
}

const group = components.CheckboxGroup({ label: "Nhân sự", options: ["a", "b", "c"], selected: ["c"], onChange: () => {}, readOnly: false, searchable: true });
const choices = nodes(group).filter((node) => node.type === "input" && node.props.type === "checkbox");
assert.equal(choices[1].props.checked, true, "Selected personnel must appear first");
assert.equal(nodes(group).filter((node) => node.type === "input" && node.props.type === "search").length, 1);
let selected;
let stateCalls = 0;
react.useState = (value) => [stateCalls++ === 0 ? "tien" : value, () => {}];
const filtered = components.CheckboxGroup({ label: "Nhân sự", options: ["a", "b"], selected: ["b"], onChange: (value) => { selected = value; }, readOnly: false, searchable: true, renderLabel: (id) => id === "a" ? "Trần Công Tiến" : "Nguyễn Văn A" });
const filteredChecks = nodes(filtered).filter((node) => node.type === "input" && node.props.type === "checkbox");
assert.equal(filteredChecks.length, 2, "Search matches Vietnamese names without accents");
filteredChecks[0].props.onChange();
assert.equal(selected.includes("b"), true, "Select-all search results preserves hidden selections");
react.useState = (value) => [typeof value === "function" ? value() : value, () => {}];

const project = { ...components.emptyProject(), name: "Test", location: "Test", startDate: "2026-09-01", endDate: "2026-09-03", plannedWeldCount: 10 };
let calls = 0;
let release;
const pending = new Promise((resolve) => { release = resolve; });
const modal = components.ProjectModal({ project, mode: "create", onClose: () => {}, onSave: async () => { calls++; await pending; }, personnelOptions: [], machineOptions: [], railOptions: [], weldOptions: [] });
const save = nodes(modal).find((node) => node.type === "button" && node.props.children === "Thêm dự án");
const first = save.props.onClick();
await save.props.onClick();
assert.equal(calls, 1, "A rapid double click sends one save request");
release();
await first;
await save.props.onClick();
assert.equal(calls, 2, "Save lock is released after completion");

for (const plan of [
  [{ ngay: "2026-09-01", so_moi_han: 3 }, { ngay: "2026-09-03", so_moi_han: 7 }],
  [{ ngay: "2026-09-03", so_moi_han: 0 }],
  [],
]) {
  writes.length = 0;
  record = { ngay_bat_dau: "2026-09-01", ngay_ket_thuc: "2026-09-03" };
  assert.equal((await projectApi.saveTheoreticalProgress("p1", plan)).error, undefined);
  assert.equal(record.tong_moi_han_du_kien, plan.reduce((sum, row) => sum + row.so_moi_han, 0));
  assert.equal(Object.hasOwn(writes.at(-1), "tong_moi_han_du_kien"), false, "Final JSON write must not rerun the equal-distribution trigger");
  const restored = projectApi.duAnRowToProject({ ...record, id: "p1", du_an: "Test", created_at: "2026-09-01" });
  assert.equal(JSON.stringify(restored.theoreticalProgress), JSON.stringify(plan), "Edited, zero and empty plans survive reload");
}
console.log("PASS: selected-first search, accent search, selection preservation, double-click lock, plan totals and reload");
