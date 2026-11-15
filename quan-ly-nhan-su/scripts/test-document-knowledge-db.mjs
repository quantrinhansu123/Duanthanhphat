import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const db = new PGlite({ extensions: { vector, unaccent } });
let checks = 0;
const eq = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
const one = async (sql, args = []) => {
  const r = await db.query(sql, args);
  return r.rows[0];
};
const scalar = async (sql, args = []) => Object.values(await one(sql, args))[0];
async function rejects(sql, args, match) {
  await assert.rejects(() => db.query(sql, args), match);
  checks++;
}
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
    insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');`);
  const migration = await readFile(
    new URL(
      "../../supabase/migration_20261116_document_knowledge.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration); // Idempotent before records.
  const owner = "11111111-1111-4111-8111-111111111111",
    viewer = "22222222-2222-4222-8222-222222222222",
    outsider = "33333333-3333-4333-8333-333333333333";
  const login = async (uid) =>
    db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await login(owner);
  const project = await scalar("select dk_create_project('Hồ sơ thử')");
  await db.query("select dk_grant_member($1,$2,$3)", [
    project,
    viewer,
    "viewer",
  ]);
  eq(await scalar("select dk_access($1)", [project]), true, "Owner can read");
  const register = async (key, hash = "a", pipeline = "fixture") =>
    scalar("select dk_register_document($1,$2,$3,$4,$5,$6,$7,$8)", [
      project,
      key,
      key,
      "upload",
      "private/fixture",
      hash.repeat(64),
      pipeline,
      10,
    ]);
  const registered = await register("one.pdf");
  eq(
    (await register("one.pdf")).unchanged,
    true,
    "Same source version does not queue another job",
  );
  eq(await scalar("select count(*)::int from dk_jobs"), 1, "One job");
  let claimed = await scalar("select dk_claim_job()");
  eq(
    await scalar("select dk_claim_job()"),
    null,
    "Active lease is not claimed twice",
  );
  const text =
    "Hợp đồng 1000. Nghiệm thu đợt 1: 200. Nghiệm thu lũy kế đợt 2: 500. Thực chuyển 150. Đề nghị thanh toán 300.";
  const pages = [{ page: 1, text, method: "fixture" }];
  const facts = [
    ["contract_base", "1000", null, "Hợp đồng 1000."],
    ["accepted_increment", "200", 1, "Nghiệm thu đợt 1: 200."],
    ["accepted_cumulative", "500", 2, "Nghiệm thu lũy kế đợt 2: 500."],
    ["payment", "150", null, "Thực chuyển 150."],
    ["payment_request", "300", null, "Đề nghị thanh toán 300."],
  ].map(([kind, amount, period_index, quote]) => ({
    kind,
    amount,
    period_index,
    quote,
    contract_code: "HD-01",
    event_date: "2026-11-01",
    source_page: 1,
  }));
  const complete = async (job, ps = pages, fs = facts) =>
    db.query("select dk_complete_job($1,$2,$3,$4,$5,$6)", [
      job.id,
      job.lease_token,
      JSON.stringify(ps),
      JSON.stringify([
        {
          page: 1,
          ordinal: 0,
          content: text,
          embedding: new Array(768).fill(0.01),
        },
      ]),
      JSON.stringify(fs),
      "gemini-embedding-001",
    ]);
  await rejects(
    "select dk_complete_job($1,$2,$3,$4,$5,$6)",
    [
      claimed.job.id,
      claimed.job.lease_token,
      JSON.stringify(pages),
      "[]",
      JSON.stringify([{ ...facts[0], quote: "invented evidence" }]),
      "fixture",
    ],
    /DK_EVIDENCE_NOT_FOUND/,
  );
  eq(
    await scalar("select count(*)::int from dk_pages"),
    0,
    "Invalid extraction rolls back all staging rows",
  );
  await complete(claimed.job);
  const summary = async (metric = "accepted_total") =>
    scalar("select dk_financial_summary($1,$2,$3)", [
      project,
      metric,
      "2026-11-16",
    ]);
  eq((await summary()).total_vnd, null, "Unreviewed amounts never count");
  eq((await summary()).complete, false, "Unreviewed corpus is incomplete");
  const rows = (
    await db.query(
      "select *,amount::text as amount from dk_facts order by kind",
    )
  ).rows;
  for (const f of rows) {
    await db.query("select dk_review_fact($1,$2,$3,$4,$5)", [
      f.id,
      0,
      "approved",
      JSON.stringify({ ...f, business_key: "event:" + f.kind }),
      "Đã đối chiếu bản gốc",
    ]);
  }
  const accepted = await summary();
  eq(
    accepted.total_vnd,
    "500",
    "Latest cumulative snapshot is not added to its earlier increment",
  );
  eq(
    accepted.complete,
    false,
    "Fact approval still requires full-document confirmation",
  );
  await db.query("select dk_document_action($1,$2,$3,$4)", [
    registered.document_id,
    1,
    "verify",
    "Đã kiểm tra đầy đủ tất cả các trang",
  ]);
  eq(
    (await summary()).complete,
    true,
    "Explicit document confirmation gives complete coverage",
  );
  eq(
    (await summary("paid_total")).total_vnd,
    "150",
    "Payment request is not a bank transfer",
  );
  eq(
    (await summary("payment_requested_total")).total_vnd,
    "300",
    "Requested value is separate",
  );
  eq((await summary("contract_total")).total_vnd, "1000", "Contract amount");
  await rejects(
    "select dk_review_fact($1,$2,$3,$4,$5)",
    [rows[0].id, null, "rejected", "{}", "fixture"],
    /DK_REVIEW_CONFLICT/,
  );
  await rejects(
    "select dk_document_action($1,$2,$3,$4)",
    [registered.document_id, null, "verify", "fixture"],
    /DK_STALE_DOCUMENT/,
  );
  await rejects(
    "select dk_document_action($1,$2,$3,$4)",
    [registered.document_id, 1, "verify", null],
    /DK_REVIEW_NOTE_REQUIRED/,
  );
  const propose = async (kind) =>
    scalar("select dk_add_fact($1,$2,$3,$4,$5)", [
      registered.document_id,
      1,
      1,
      text,
      kind,
    ]);
  const approve = async (id, fields) =>
    db.query("select dk_review_fact($1,$2,$3,$4,$5)", [
      id,
      0,
      "approved",
      JSON.stringify({
        contract_code: "HD-01",
        event_date: "2026-11-01",
        period_index: null,
        ...fields,
      }),
      "Đã đối chiếu bản gốc",
    ]);
  const duplicate = await propose("payment");
  await rejects(
    "select dk_review_fact($1,$2,$3,$4,$5)",
    [
      duplicate,
      0,
      "approved",
      JSON.stringify({
        kind: "payment",
        amount: "150",
        contract_code: "HD-01",
        business_key: "event:payment",
        event_date: "2026-11-01",
      }),
      "fixture",
    ],
    /duplicate key/,
  );
  await rejects(
    "select dk_review_fact($1,$2,$3,$4,$5)",
    [
      duplicate,
      0,
      "approved",
      JSON.stringify({
        kind: "payment",
        amount: "-1",
        contract_code: "HD-01",
        business_key: "negative",
        event_date: "2026-11-01",
      }),
      "fixture",
    ],
    /DK_INVALID_FACT/,
  );
  await rejects(
    "select dk_review_fact($1,$2,$3,$4,$5)",
    [
      duplicate,
      0,
      "approved",
      JSON.stringify({ kind: "payment", amount: "1.5" }),
      "fixture",
    ],
    /DK_INVALID_AMOUNT/,
  );
  await rejects(
    "select dk_add_fact($1,$2,$3,$4,$5)",
    [registered.document_id, 1, 1, "No such text", "payment"],
    /DK_EVIDENCE_NOT_FOUND/,
  );
  const later = await propose("accepted_increment");
  await approve(later, {
    kind: "accepted_increment",
    amount: "100",
    period_index: 3,
    event_date: "2026-11-02",
    business_key: "accepted:3",
  });
  eq(
    (await summary()).total_vnd,
    "600",
    "Only later incremental periods add to cumulative snapshot",
  );
  const conflict = await propose("accepted_increment");
  await approve(conflict, {
    kind: "accepted_increment",
    amount: "50",
    period_index: 4,
    event_date: "2026-10-31",
    business_key: "accepted:4",
  });
  eq(
    (await summary()).total_vnd,
    null,
    "Contradictory period/date blocks total",
  );
  eq((await summary()).conflicts, 1);
  const orphan = await propose("contract_adjustment");
  await approve(orphan, {
    kind: "contract_adjustment",
    amount: "-50",
    contract_code: "HD-02",
    business_key: "amendment:orphan",
  });
  eq(
    (await summary("contract_total")).total_vnd,
    null,
    "Adjustment without base contract blocks contract total",
  );
  eq((await summary("contract_total")).complete, false);
  eq(
    (
      await scalar("select dk_financial_summary($1,$2,$3,$4)", [
        project,
        "contract_total",
        "2026-11-16",
        " hd-01 ",
      ])
    ).total_vnd,
    "1000",
    "Exact contract filter does not include other contract adjustments",
  );
  eq(
    (
      await scalar("select dk_financial_summary($1,$2,$3,$4)", [
        project,
        "paid_total",
        "2026-11-16",
        "HD-404",
      ])
    ).total_vnd,
    null,
    "Unknown contract never falls back to whole project",
  );
  eq(
    (
      await scalar("select dk_financial_summary($1,$2,$3)", [
        project,
        "paid_total",
        "2026-10-01",
      ])
    ).total_vnd,
    null,
    "As-of excludes later events",
  );
  await db.query(
    `insert into dk_facts(project_id,document_id,revision,contract_id,contract_code,kind,amount,event_date,business_key,source_page,quote,status)
    select $1,$2,1,(select id from dk_contracts where project_id=$1 and code='HD-01'),'HD-01','payment',1,'2026-11-01','bulk:'||n,1,$3,'approved'
    from generate_series(1,1005) n`,
    [project, registered.document_id, text],
  );
  const bulk = await summary("paid_total");
  eq(
    bulk.total_vnd,
    "1155",
    "Server aggregation includes more than PostgREST 1000-row limit",
  );
  eq(bulk.event_count, 1006);
  eq(bulk.sources.length, 20);
  eq(bulk.sources_truncated, true);
  const search = await scalar("select dk_search($1,$2)", [
    project,
    "nghiệm thu",
  ]);
  eq(search.length, 1, "Keyword retrieval returns actual page evidence");
  const folded = await scalar("select dk_search($1,$2)", [
    project,
    "nghiem thu",
  ]);
  eq(folded.length, 1, "Vietnamese accent-insensitive keyword search");
  await rejects(
    "select dk_review_fact($1,$2,$3,$4,$5)",
    [rows[0].id, 0, "rejected", "{}", "Không hợp lệ"],
    /DK_REVIEW_CONFLICT/,
  );
  const detail = await scalar("select dk_document_detail($1)", [
    registered.document_id,
  ]);
  eq(
    typeof detail.facts[0].amount,
    "string",
    "Amounts are transported as decimal strings",
  );
  await login(viewer);
  eq(
    await scalar("select dk_access($1,true)", [project]),
    false,
    "Viewer cannot edit",
  );
  await rejects(
    "select dk_document_action($1,$2,$3,$4)",
    [registered.document_id, 1, "remove", "test"],
    /DK_FORBIDDEN/,
  );
  await login(outsider);
  await rejects(
    "select dk_financial_summary($1,$2)",
    [project, "paid_total"],
    /DK_FORBIDDEN/,
  );
  await rejects(
    "select dk_document_detail($1)",
    [registered.document_id],
    /DK_FORBIDDEN/,
  );
  await db.exec("set role authenticated");
  eq(
    await scalar("select count(*)::int from dk_documents"),
    0,
    "Actual RLS hides documents of other projects",
  );
  eq(
    await scalar("select count(*)::int from dk_chunks"),
    0,
    "Actual RLS hides evidence of other projects",
  );
  eq(
    await scalar(
      "select has_function_privilege('authenticated','dk_claim_job()','execute')",
    ),
    false,
    "Users cannot run worker-only functions",
  );
  eq(
    await scalar(
      "select has_function_privilege('anon','dk_access(uuid,boolean)','execute')",
    ),
    false,
    "Anonymous callers denied",
  );
  await db.exec("reset role");
  await login(owner);
  const revised = await register("one.pdf", "b");
  eq(revised.revision, 2, "Changed hash creates a new revision");
  eq(
    (await summary("paid_total")).total_vnd,
    null,
    "Replacing a source immediately invalidates approved facts",
  );
  await rejects(
    "select dk_document_action($1,$2,$3,$4)",
    [registered.document_id, 1, "verify", "old review"],
    /DK_STALE_DOCUMENT/,
  );
  await rejects(
    "select dk_complete_job($1,$2,$3,$4,$5,$6)",
    [
      claimed.job.id,
      claimed.job.lease_token,
      JSON.stringify(pages),
      "[]",
      "[]",
      "fixture",
    ],
    /DK_LEASE_LOST/,
  );
  claimed = await scalar("select dk_claim_job()");
  await db.query(
    "update dk_jobs set lease_until=now()-interval '1 minute' where id=$1",
    [claimed.job.id],
  );
  const reclaimed = await scalar("select dk_claim_job()");
  eq(reclaimed.job.attempts, 2, "Expired job is reclaimable");
  assert.notEqual(reclaimed.job.lease_token, claimed.job.lease_token);
  checks++;
  eq(
    await scalar("select dk_heartbeat($1,$2)", [
      claimed.job.id,
      claimed.job.lease_token,
    ]),
    false,
    "Old worker loses lease",
  );
  await complete(reclaimed.job);
  await db.exec(migration); // Idempotent after records and extension/index creation.
  eq(
    await scalar("select count(*)::int from dk_documents"),
    1,
    "Rerun does not lose records",
  );
  eq(
    await scalar(
      "select public from storage.buckets where id='document-knowledge'",
    ),
    false,
    "Source bucket remains private",
  );
  const missing = await scalar(
    "select dk_register_document($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      project,
      "local/folder/a.pdf",
      "a.pdf",
      "local",
      "folder/a.pdf",
      "c".repeat(64),
      "fixture",
      10,
    ],
  );
  await rejects(
    "select dk_mark_missing($1,$2,$3)",
    [project, "local/folder/", null],
    /DK_INVALID_SCAN/,
  );
  await db.query("select dk_mark_missing($1,$2,$3)", [
    project,
    "local/folder/",
    "[]",
  ]);
  eq(
    await scalar("select state from dk_documents where id=$1", [
      missing.document_id,
    ]),
    "removed",
    "Only explicit completed scan reconciles removed source",
  );
  eq(
    await scalar("select state from dk_documents where id=$1", [
      registered.document_id,
    ]),
    "ready",
    "Scan reconciliation preserves uploads",
  );
  console.log(
    `PASS document knowledge DB: ${checks} checks, real PostgreSQL/pgvector, no live database`,
  );
} catch (error) {
  console.error({
    message: error.message,
    detail: error.detail,
    where: error.where,
    query: error.query,
  });
  process.exitCode = 1;
} finally {
  await db.close();
}
