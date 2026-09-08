import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const text = fs.readFileSync(new URL("../src/components/OverviewDashboard.tsx", import.meta.url), "utf8");
const source = ts.createSourceFile("overview.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node.initializer);
  if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node);
  ts.forEachChild(node, visit);
}
visit(source);
function evaluate(name, context) {
  const node = declarations.get(name);
  const expression = ts.isFunctionDeclaration(node) ? `(${node.getText(source)})` : node.getText(source);
  return vm.runInNewContext(ts.transpile(`const result = ${expression}; result;`, { target: ts.ScriptTarget.ES2020 }), {
    useMemo: (fn) => fn(), ...context,
  });
}
const range = evaluate("planWeldsInRange", {});
const project = { id: "p", name: "P", startDate: "2026-01-01", endDate: "2026-12-31", plannedWeldCount: 1000,
  theoreticalProgress: [{ ngay: "2026-01-01", so_moi_han: 10 }, { ngay: "2026-12-01", so_moi_han: 990 }] };
assert.equal(range(project, "2026-01-01", "2026-09-08"), 10, "Future plans do not count as due");
assert.equal(range(project, "2026-02-01", "2026-02-28"), 0, "No fallback production on days with zero plan");
for (const [actualToDate, plannedToDate, expected] of [[10, 10, "ĐÚNG TIẾN ĐỘ"], [9, 10, "CHẬM TIẾN ĐỘ"], [11, 10, "VƯỢT TIẾN ĐỘ"], [0, 0, "CHƯA ĐẾN KỲ KẾ HOẠCH"]]) {
  assert.equal(evaluate("progressStatus", { actualToDate, plannedToDate }).label, expected);
}
const selectedRows = [{ ngay_thuc_hien: "2026-01-01", nam_thuc_hien: 2026 }, { ngay_thuc_hien: "2026-09-08", nam_thuc_hien: 2026 }, { nam_thuc_hien: 2020 }];
for (const chartViewMode of ["monthly", "cumulative"]) {
  const period = evaluate("chartPeriod", { chartViewMode, selectedRows, selectedProjects: [project], isAllDates: true,
    getJournalRowDateIso: (row) => row.ngay_thuc_hien || "", filterFrom: "", filterTo: "",
    dailySeries: [], dailyTargets: [], dailyValues: [], yearlySeries: [] });
  assert.equal(period.values.reduce((a, b) => a + b, 0), 3, "All records count beyond the recent daily window");
  assert.equal(period.targets.reduce((a, b) => a + b, 0), 1000);
  assert.ok(period.labels.some((label) => label.includes("chưa rõ tháng")));
}
let returnedStatus = "Chờ thí nghiệm";
let savedBody;
const db = { from: () => ({ update(body) { savedBody = body; return this; }, eq() { return this; }, select() { return this; }, async single() { return { data: { id: "w", tinh_trang_thi_nghiem: returnedStatus }, error: null }; } }) };
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/lib/weldReportData.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
  exports: api, require: () => ({ createClient: () => db, formatSupabaseError: (error) => error.message }),
});
const payload = { id: "w", ma_lich_su: "W", loai_ray: "50N", chung_chi_su_dung: "C", tinh_trang_thi_nghiem: returnedStatus };
await api.updateWeldJournalEntry(payload);
assert.equal(savedBody.tinh_trang_thi_nghiem, "Chờ thí nghiệm");
returnedStatus = "Đạt";
await assert.rejects(() => api.updateWeldJournalEntry(payload), /chưa lưu đúng/);
const journalText = fs.readFileSync(new URL("../src/components/WeldingJournalList.tsx", import.meta.url), "utf8");
const journalSource = ts.createSourceFile("journal.tsx", journalText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initEffect;
function findInit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(journalSource) === "useEffect" && node.arguments[0]?.getText(journalSource).includes("initializedForm.current = initial")) initEffect = node.arguments[0];
  ts.forEachChild(node, findInit);
}
findInit(journalSource);
let form;
const context = { open: true, initial: { result: "Đạt" }, initializedForm: { current: undefined }, wasOpen: { current: false }, setForm: (value) => { form = value; }, defaultLinkDateRange: () => ({}), setLinkDateFrom: () => {}, setLinkDateTo: () => {} };
const runInit = () => vm.runInNewContext(ts.transpile(`(${initEffect.getText(journalSource)})();`, { target: ts.ScriptTarget.ES2020 }), context);
runInit();
form = { result: "Chờ thí nghiệm" };
runInit();
assert.equal(form.result, "Chờ thí nghiệm", "Refreshing dropdown options must not reset the selected status");
context.open = false;
runInit();
context.open = true;
runInit();
assert.equal(form.result, "Đạt", "Reopening the form initializes it again");
console.log("PASS: monthly/cumulative totals, undated history, schedule cutoff, zero-plan days, pending status verification");
