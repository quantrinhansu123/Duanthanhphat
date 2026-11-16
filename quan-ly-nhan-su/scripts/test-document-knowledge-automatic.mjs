import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { assessAutomaticFact, assessAutomaticDocument } from "../src/lib/documentKnowledgeAutomatic.ts";
import { knownKnowledgeMetricQuestion, knowledgeQuestionDocumentCount } from "../src/lib/documentKnowledge.ts";

let checks = 0;
const eq = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
const owner = "11111111-1111-4111-8111-111111111111", viewer = "22222222-2222-4222-8222-222222222222", outsider = "33333333-3333-4333-8333-333333333333";
const db = new PGlite({ extensions: { vector, unaccent } });
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const login = uid => scalar("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
let sequence = 0;
function fact(kind, quote, amount, period = null, code = "HD-01", extra = {}) {
  return { contract_code: code, kind, amount, event_date: "2026-11-01", period_index: period, source_page: 1, quote, ...extra };
}
function pages(facts) { return [{ page: 1, text: "HD-01. Ngày 01/11/2026.\n" + facts.map(f => f.quote).join("\n"), method: "native" }]; }
const base = fact("contract_base", "Giá trị hợp đồng HD-01 là 1.000 đồng.", "1000");
const receipt = fact("payment", "Mã giao dịch: FT001. Thực chuyển thành công 150 đồng.", "150", null, "HD-01", { event_ref: "FT001" });
async function publish(project, key, facts, sourcePages = pages(facts)) {
  const hash = (++sequence).toString(16).padStart(64, "0");
  const registered = await scalar("select dk_register_document($1,$2,$2,'upload','private/fixture',$3,'automatic-fixture',10)", [project, key, hash]);
  const claimed = await scalar("select dk_claim_job()");
  assert.equal(claimed.document.id, registered.document_id);
  const automatic = { document: assessAutomaticDocument(sourcePages, facts), facts: facts.map(f => assessAutomaticFact(f, sourcePages)) };
  await db.query("select dk_complete_job($1,$2,$3,'[]'::jsonb,$4,'fixture',$5)", [claimed.job.id, claimed.job.lease_token, JSON.stringify(sourcePages), JSON.stringify(facts), JSON.stringify(automatic)]);
  return registered.document_id;
}
const summary = (project, metric = "accepted_total", expected = null) => scalar("select dk_automatic_summary($1,$2,'2026-11-16',null,$3)", [project, metric, expected]);
try {
  const source = pages([base, receipt]);
  eq(assessAutomaticFact(base, source).eligible, true, "Currency, amount, code and date grounded");
  eq(assessAutomaticFact({ ...base, amount: "1000000" }, source).eligible, false, "No invented multiplier");
  eq(assessAutomaticFact({ ...base, contract_code: "HD-FAKE" }, source).issues.includes("contract"), true);
  eq(assessAutomaticFact({ ...base, event_date: "2026-10-31" }, source).issues.includes("date"), true);
  eq(assessAutomaticFact(receipt, source).identity, "TRANSFER:HD-01:FT001");
  const noRef = fact("payment", "Thực chuyển thành công 150 đồng.", "150");
  eq(assessAutomaticFact(noRef, pages([noRef])).issues.includes("reference"), true);
  const request = fact("payment", "Mã giao dịch: FT001. Đề nghị chuyển khoản 150 đồng.", "150");
  eq(assessAutomaticFact(request, pages([request])).eligible, false, "Request is not paid");
  const typed = fact("contract_base", "Giá trị hợp đồng HD-01 là 1,2 tỷ đồng.", "1200000000");
  eq(assessAutomaticFact(typed, pages([typed])).eligible, true, "Explicit unit conversion with BigInt");
  const dollars = fact("contract_base", "Giá trị hợp đồng HD-01 là 1.000 USD.", "1000");
  eq(assessAutomaticFact(dollars, pages([dollars])).eligible, false);
  const reduction = fact("contract_adjustment", "Phụ lục số PL02 điều chỉnh giảm 100 đồng.", "-100");
  eq(assessAutomaticFact(reduction, pages([reduction])).eligible, true);
  const replacement = fact("contract_adjustment", "Phụ lục số PL02 tăng tổng giá trị mới lên 1.000 đồng.", "1000");
  eq(assessAutomaticFact(replacement, pages([replacement])).eligible, false, "Replacement is not delta");
  eq(assessAutomaticDocument([{ page: 1, text: "Nghiệm thu 1.000 đồng", method: "native" }], []).issues.includes("no_financial_facts"), true);
  const incompletePage = [{ page: 1, method: "native", text: pages([base])[0].text + "\nNghiệm thu lũy kế đợt 1: 200 đồng." }];
  eq(assessAutomaticDocument(incompletePage, [base]).issues.includes("missing_financial_kind"), true, "A different fact on the page does not hide an omitted monetary category");
  eq(assessAutomaticFact(base, [{ ...source[0], method: "paddle", ocr_meta: { warnings: ["DK_OCR_CHARSET_REVIEW"] } }]).eligible, false);
  for (const question of ["83 file này bao nhiêu tiền?", "Tổng 83 file bao nhiêu tiền?", "15 tệp tổng bao tiền?", "Tổng tiền?"]) eq(knownKnowledgeMetricQuestion(question), "overview");
  eq(knowledgeQuestionDocumentCount("83 file này bao nhiêu tiền?"), 83);
  eq(knowledgeQuestionDocumentCount("83file này bao tiền?"), 83);
  assert.throws(() => knowledgeQuestionDocumentCount("1000001 file bao tiền?"), /DK_DOCUMENT_SCOPE_REQUIRED/); checks++;
  assert.throws(() => knowledgeQuestionDocumentCount("2 file trong 83 file"), /DK_DOCUMENT_SCOPE_REQUIRED/); checks++;

  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
    insert into auth.users values('${owner}'),('${viewer}'),('${outsider}');`);
  const migration = await readFile(new URL("../../supabase/migration_20261116_document_knowledge.sql", import.meta.url), "utf8");
  await db.exec(migration);
  await login(owner);
  const project = await scalar("select dk_create_project('Tự động thử')");
  await db.query("select dk_grant_member($1,$2,'viewer')", [project, viewer]);
  const fs = [base,
    fact("accepted_increment", "Nghiệm thu riêng đợt 1: 200 đồng.", "200", 1),
    fact("accepted_cumulative", "Nghiệm thu lũy kế đến đợt 2: 500 đồng.", "500", 2),
    receipt, fact("payment_request", "Đề nghị thanh toán. Số đề nghị: DN001, số tiền 300 đồng.", "300")];
  const first = await publish(project, "one.pdf", fs);
  eq(await scalar("select count(*)::int from dk_facts where status='approved'"), 0, "No automatic human approval");
  eq(await scalar("select review_state from dk_documents where id=$1", [first]), "pending");
  eq((await scalar("select dk_financial_summary($1,'accepted_total','2026-11-16')", [project])).total_vnd, null, "Manual-only view remains separate");
  eq((await summary(project, "contract_total")).total_vnd, "1000");
  eq((await summary(project)).total_vnd, "500", "Earlier increments not added to cumulative");
  eq((await summary(project, "paid_total")).total_vnd, "150", "Request excluded from paid");
  eq((await summary(project, "payment_requested_total")).total_vnd, "300");
  eq((await summary(project)).complete, true, "No person must approve to answer");
  eq((await summary(project)).human_verified, false);
  await publish(project, "copy.pdf", fs);
  eq((await summary(project)).total_vnd, "500", "Duplicate documents cannot double the event");
  eq((await summary(project)).duplicates_ignored, 2);
  eq((await summary(project, "paid_total")).total_vnd, "150", "Same transfer reference counted once");
  await db.query("update dk_facts set status='approved',business_key='LEGACY-BASE',automatic_check='{\"eligible\":false,\"issues\":[\"not_assessed\"]}' where document_id=$1 and kind='contract_base'", [first]);
  eq((await summary(project, "contract_total")).total_vnd, "1000", "Legacy manual base and automatic copy use the same canonical identity");
  const mismatch = await summary(project, "contract_total", 83);
  eq(mismatch.selection_matches, false);
  eq(mismatch.total_vnd, null, "Do not substitute all-project total for a different file selection");
  const changed = fact("contract_base", "Giá trị hợp đồng HD-01 là 1.200 đồng.", "1200");
  await publish(project, "conflict.pdf", [changed]);
  eq((await summary(project, "contract_total")).total_vnd, null);
  eq((await summary(project, "contract_total")).conflicts, 1, "Conflict blocks the total");
  await publish(project, "missing-ref.pdf", [noRef]);
  eq((await summary(project, "paid_total")).facts_unresolved, 1);
  eq((await summary(project, "paid_total")).complete, false);
  eq((await summary(project, "paid_total")).total_vnd, "150", "Only explicitly partial result retained");
  await publish(project, "omitted.pdf", [], [{ page: 1, text: "HD-01. Ngày 01/11/2026. Nghiệm thu 2.000 đồng.", method: "native" }]);
  eq((await summary(project)).documents_with_issues, 1);
  eq((await summary(project)).complete, false);
  await publish(project, "partial-extraction.pdf", [base], incompletePage);
  eq((await summary(project)).documents_with_issues, 2, "Incomplete extraction cannot claim full automatic coverage");
  await login(viewer);
  eq((await summary(project)).basis, "automatic", "Viewer may read own project automatic totals");
  await db.exec("set role authenticated");
  await assert.rejects(() => db.query("update dk_facts set automatic_check='{}'"), /permission denied/); checks++;
  await db.exec("reset role");
  await login(outsider);
  await assert.rejects(() => summary(project), /DK_FORBIDDEN/); checks++;
  await login(owner);
  await db.exec(migration); // Rerun after populated rows, retaining classifications and private state.
  eq((await summary(project, "paid_total")).total_vnd, "150");
  const all83 = await scalar("select dk_create_project('83 hồ sơ tự động')");
  for (let i = 1; i <= 83; i++) {
    const code = `HD-${String(i).padStart(3, '0')}`;
    const f = fact("contract_base", `Giá trị hợp đồng ${code} là 1.000 đồng.`, "1000", null, code);
    await publish(all83, `${code}.pdf`, [f]);
  }
  const result83 = await summary(all83, "contract_total", 83);
  eq(result83.documents_ready, 83);
  eq(result83.total_vnd, "83000", "All 83 documents aggregated without human reviews");
  eq(result83.contract_count, 83);
  eq(result83.complete, true);
  eq(result83.documents_verified, 0);
  eq(result83.human_verified, false);
  eq(result83.sources.length, 20);
  eq(result83.sources_truncated, true, "Citation cap never limits the sum");
  // A replacement makes the prior revision obsolete without adding its old amount.
  const f2 = fact("contract_base", "Giá trị hợp đồng HD-001 là 2.000 đồng.", "2000", null, "HD-001");
  await publish(all83, "HD-001.pdf", [f2]);
  eq((await summary(all83, "contract_total", 83)).total_vnd, "84000");
  const transfers = await scalar("select dk_create_project('Chứng từ chuyển khoản trùng mã')");
  await publish(transfers, "transfer-1.pdf", [receipt]);
  const otherReceipt = { ...receipt, contract_code: "HD-02" };
  await publish(transfers, "transfer-2.pdf", [otherReceipt], [{ ...pages([otherReceipt])[0], text: pages([otherReceipt])[0].text.replace("HD-01", "HD-02") }]);
  eq((await summary(transfers, "paid_total")).total_vnd, null, "Same transfer reference across contracts needs allocation evidence");
  eq((await summary(transfers, "paid_total")).conflicts, 1);
  await scalar("select dk_register_document($1,'retry.pdf','retry.pdf','upload','private/fixture',$2,'retry-fixture',10)", [all83, 'f'.repeat(64)]);
  const retryJob = await scalar("select dk_claim_job()");
  await db.query("select dk_fail_job($1,$2,'DK_AI_HTTP_503')", [retryJob.job.id,retryJob.job.lease_token]);
  eq(await scalar("select dk_claim_job()"), null, "Transient error uses cooldown instead of a tight retry loop");
  await db.query("update dk_jobs set updated_at=now()-interval '10 minutes' where id=$1", [retryJob.job.id]);
  const retried = await scalar("select dk_claim_job()");
  eq(retried.job.id, retryJob.job.id, "Watch worker retries transient API failure automatically");
  eq(retried.job.attempts, 2);
  await db.query("select dk_fail_job($1,$2,'DK_AI_HTTP_503')", [retried.job.id,retried.job.lease_token]);
  await db.query("update dk_jobs set attempts=4,updated_at=now()-interval '1 day' where id=$1", [retryJob.job.id]);
  eq(await scalar("select dk_claim_job()"), null, "Four attempts cap API spend");
  console.log(`PASS automatic knowledge: ${checks} checks; source grounding, deduplication, conflicts, permissions and 83-file SQL totals without manual review`);
} finally { await db.close(); }
