// Opt-in only: one synthetic extraction, no database or company documents.
import assert from "node:assert/strict";
import { extractKnowledgeFacts } from "../src/lib/server/documentKnowledgeAI.ts";
import { assessAutomaticFact } from "../src/lib/documentKnowledgeAutomatic.ts";
if (!process.argv.includes("--live")) {
  console.log("Opt-in: pnpm knowledge:automatic:smoke -- --live");
  process.exit(0);
}
const pages = [
  { page: 1, method: "native", text: "TÀI LIỆU THỬ GIẢ LẬP. Hợp đồng HD-TEST-01. Ngày 01/11/2026.\nGiá trị hợp đồng HD-TEST-01 là 1.200.000.000 đồng." },
  { page: 2, method: "native", text: "TÀI LIỆU THỬ GIẢ LẬP. Hợp đồng HD-TEST-01. Ngày 01/11/2026.\nNghiệm thu lũy kế đến đợt 1: 300.000.000 đồng." },
  { page: 3, method: "native", text: "TÀI LIỆU THỬ GIẢ LẬP. Hợp đồng HD-TEST-01. Ngày 01/11/2026.\nMã giao dịch: FTTEST001. Thực chuyển thành công 100.000.000 đồng." },
];
const facts = await extractKnowledgeFacts(pages);
const checks = facts.map(f => ({ kind: f.kind, amount: f.amount, ...assessAutomaticFact(f, pages) }));
console.log(JSON.stringify({ synthetic: true, facts: checks }));
for (const kind of ["contract_base", "accepted_cumulative", "payment"])
  assert.ok(checks.some(c => c.kind === kind && c.eligible), `Automatic source checks failed for ${kind}`);
console.log(JSON.stringify({ synthetic: true, passed: true, facts: checks }));
