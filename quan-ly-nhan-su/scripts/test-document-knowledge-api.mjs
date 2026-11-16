import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as domain from "../src/lib/documentKnowledge.ts";
import * as automatic from "../src/lib/documentKnowledgeAutomatic.ts";
import { knowledgeResult } from "../src/lib/server/documentKnowledgeStore.ts";

const require = createRequire(import.meta.url);
let checks = 0;
const eq = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
const pid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  docId = "33333333-3333-4333-8333-333333333333";
const user = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "fixture@example.test",
};
let loggedIn = true,
  write = true;
const data = {
  dk_documents: [
    {
      id: docId,
      project_id: pid,
      name: "HD-01.pdf",
      revision: 2,
      state: "ready",
    },
  ],
  dk_pages: [
    {
      document_id: docId,
      revision: 2,
      page: 1,
      text: "Phạt chậm tiến độ 2%.",
      method: "fixture",
    },
  ],
  dk_facts: [{ id: docId, project_id: other }],
};
const rpcCalls = [];
const client = {
  from(table) {
    let rows = [...(data[table] || [])],
      single = false;
    const q = {
      select() {
        return q;
      },
      eq(k, v) {
        rows = rows.filter((r) => r[k] === v);
        return q;
      },
      neq(k, v) {
        rows = rows.filter((r) => r[k] !== v);
        return q;
      },
      in(k, values) {
        rows = rows.filter((r) => values.includes(r[k]));
        return q;
      },
      order() {
        return q;
      },
      range() {
        return q;
      },
      maybeSingle() {
        single = true;
        return q;
      },
      single() {
        single = true;
        return q;
      },
      then(done) {
        return Promise.resolve({
          data: single ? rows[0] || null : rows,
          error: null,
          count: rows.length,
        }).then(done);
      },
    };
    return q;
  },
  async rpc(name, args) {
    rpcCalls.push({ name, args });
    if (["dk_financial_summary", "dk_automatic_summary"].includes(name))
      return {
        data: {
          metric: args.p_metric,
          total_vnd: "17250605000",
          as_of_date: "2026-11-16",
          event_count: 4,
          contract_count: 1,
          documents_total: 83,
          documents_ready: 82,
          documents_verified: 80,
          facts_pending: 2,
          conflicts: 0,
          complete: false,
          sources: [{ document_id: docId, source_page: 1 }],
          ...(name === "dk_automatic_summary" ? { basis: "automatic", human_verified: false, facts_unresolved: 1, documents_with_issues: 1, duplicates_ignored: 2, selection_matches: !args.p_expected_documents || args.p_expected_documents === 83, expected_documents: args.p_expected_documents } : {}),
        },
        error: null,
      };
    if (name === "dk_search")
      return {
        data: [
          {
            document_id: docId,
            name: "HD-01.pdf",
            page: 1,
            content: "Phạt chậm tiến độ 2%.",
          },
        ],
        error: null,
      };
    return { data: true, error: null };
  },
};
const json = (body, options) => ({ body, status: options?.status ?? 200 });
const common = {
  "server-only": {},
  "next/server": { NextResponse: { json } },
  "@/lib/documentKnowledge": domain,
  "../documentKnowledge": domain,
  "../documentKnowledgeAutomatic": automatic,
};
async function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(
    await readFile(new URL("../src/" + file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => ({ ...common, ...imports })[name] ?? require(name),
    process,
    Error,
    Request,
    Response,
    File,
    Buffer,
    URL,
    TextEncoder,
    AbortSignal,
    setTimeout,
    clearTimeout,
    console,
  });
  return exports;
}
const auth = {
  requireAuthenticatedUser: async () => ({
    user: loggedIn ? user : null,
    denied: null,
  }),
  requireAccess: async () => null,
};
const store = {
  knowledgeResult,
  requireKnowledgeProject: async (_client, project, editing) => {
    if (project !== pid || (editing && !write)) throw new Error("DK_FORBIDDEN");
    return project;
  },
};
const web = await load("lib/server/documentKnowledgeWeb.ts", {
  "@/lib/supabase/server": { createClient: async () => client },
  "./requireAccess": auth,
  "./documentKnowledgeStore": store,
});
const priorFlag = process.env.DOCUMENT_KNOWLEDGE_ENABLED;
process.env.DOCUMENT_KNOWLEDGE_ENABLED = "true";
let plan = {
  calls: [
    {
      name: "get_financial_summary",
      metric: "accepted_total",
      contract_code: null,
      as_of_date: null,
      query: null,
      document_id: null,
      page: null,
    },
  ],
  clarification: null,
};
let nextAnswer = null,
  embeddingCalls = 0;
let embeddingUnavailable = false;
const prompts = [];
const chat = await load("lib/server/documentKnowledgeChat.ts", {
  "./documentKnowledgeAI": {
    embedKnowledge: async () => {
      embeddingCalls++;
      if (embeddingUnavailable) throw new Error("DK_AI_HTTP_503");
      return [new Array(768).fill(0.01)];
    },
  },
  "./documentKnowledgeCodex": {
    knowledgeCompletion: async (prompt, schema) => {
      prompts.push({ prompt, schema });
      return {
        value: nextAnswer && prompt.startsWith("Trả lời") ? nextAnswer : plan,
        usage: { input_tokens: 10, cached_input_tokens: 2, output_tokens: 3 },
        elapsed_ms: 10,
        model: "fixture",
      };
    },
  },
  "./documentKnowledgeStore": {
    ...store,
    stageKnowledgeUpload: async () => ({}),
  },
  "./documentKnowledgeWeb": web,
});
const body = {
  knowledgeProjectId: pid,
  messages: [
    { role: "user", text: "Cho anh tổng nghiệm thu đến ngày hôm nay" },
  ],
};
const req = new Request("http://localhost/api/chat", {
  method: "POST",
  headers: { Origin: "http://localhost" },
});
try {
  let result = await chat.handleKnowledgeChat(req, body);
  eq(result.status, 200);
  assert.match(result.body.text, /17\.250\.605\.000 đồng/);
  checks++;
  assert.match(result.body.text, /CHƯA ĐỦ DỮ LIỆU/);
  checks++;
  eq(embeddingCalls, 0, "Financial query does not embed documents or question");
  eq(prompts.length, 1, "SQL answer needs only planning call");
  eq(
    prompts[0].prompt.includes("17250605000"),
    false,
    "Planner never sees database rows",
  );
  eq(
    result.body.citations[0].href,
    `/api/document-knowledge/source?id=${docId}&revision=2#page=1`,
  );
  eq(
    (
      await chat.handleKnowledgeChat(req, {
        ...body,
        knowledgeProjectId: other,
      })
    ).status,
    403,
  );
  loggedIn = false;
  eq((await chat.handleKnowledgeChat(req, body)).status, 401);
  loggedIn = true;
  const evil = new Request(req.url, {
    method: "POST",
    headers: { Origin: "https://evil.test" },
  });
  eq(
    (await chat.handleKnowledgeChat(evil, body)).status,
    403,
    "Reject cross-origin stateful chat",
  );
  const base = {
    metric: null,
    contract_code: null,
    as_of_date: null,
    query: null,
    document_id: null,
    page: null,
  };
  plan = {
    calls: [{ ...base, name: "search_documents", query: "Phạt chậm tiến độ" }],
    clarification: null,
  };
  nextAnswer = {
    text: "Phạt chậm tiến độ 2%.",
    sources: [{ document_id: docId, page: 1 }],
  };
  result = await chat.handleKnowledgeChat(req, body);
  eq(result.status, 200);
  eq(embeddingCalls, 1);
  eq(result.body.text, "Phạt chậm tiến độ 2%.");
  eq(result.body.usage.input_tokens, 20, "Usage includes planning and answer");
  embeddingUnavailable = true;
  const fallback = await chat.handleKnowledgeChat(req, body);
  eq(
    fallback.status,
    200,
    "Keyword lookup works when embedding service is unavailable",
  );
  eq(rpcCalls.filter((c) => c.name === "dk_search").at(-1).args.p_vector, null);
  embeddingUnavailable = false;
  assert.ok(prompts.at(-1).prompt.includes("Phạt chậm tiến độ 2%."));
  checks++;
  nextAnswer = {
    text: "Invented",
    sources: [{ document_id: other, page: 99 }],
  };
  eq(
    (await chat.handleKnowledgeChat(req, body)).body.code,
    "DK_INVALID_CITATION",
    "Reject invented source IDs/pages",
  );
  plan = {
    calls: [
      { ...base, name: "get_document_evidence", document_id: other, page: 1 },
    ],
    clarification: null,
  };
  eq(
    (await chat.handleKnowledgeChat(req, body)).status,
    403,
    "Evidence ID restricted to selected project",
  );
  plan = {
    calls: [{ ...base, name: "execute_sql", query: "DROP TABLE" }],
    clarification: null,
  };
  eq(
    (await chat.handleKnowledgeChat(req, body)).body.code,
    "DK_INVALID_QUERY",
    "No arbitrary SQL tool",
  );
  plan = {
    calls: [{ ...base, name: "search_documents", query: "ấ".repeat(601) }],
    clarification: null,
  };
  eq((await chat.handleKnowledgeChat(req, body)).body.code, "DK_INVALID_QUERY");
  plan = {
    calls: [],
    clarification: "Bạn muốn hỏi hợp đồng, nghiệm thu hay thực trả?",
  };
  eq(
    (await chat.handleKnowledgeChat(req, body)).body.text,
    plan.clarification,
    "Clarify ambiguous totals",
  );
  const api = await load("app/api/document-knowledge/route.ts", {
    "@/lib/server/documentKnowledgeStore": {
      ...store,
      scanKnowledgeDirectory: async () => ({}),
      stageKnowledgeUpload: async () => ({}),
      knowledgeAdmin: () => {
        throw new Error("Must not use service role");
      },
    },
    "@/lib/server/documentKnowledgeWeb": web,
  });
  const post = (payload) =>
    new Request("http://localhost/api/document-knowledge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify(payload),
    });
  eq(
    (
      await api.POST(
        post({
          action: "review_fact",
          projectId: pid,
          factId: docId,
          version: 1,
          decision: "approved",
          fields: {},
          note: "fixture",
        }),
      )
    ).status,
    403,
    "Reject fact from a different project even if client supplies authorized project",
  );
  eq(
    (
      await api.POST(
        post({ action: "scan", projectId: pid, folder: "../secrets" }),
      )
    ).status,
    403,
    "Folder import requires explicit server allowlist",
  );
  write = false;
  eq(
    (
      await api.POST(
        post({
          action: "verify",
          projectId: pid,
          documentId: docId,
          revision: 2,
          note: "fixture",
        }),
      )
    ).status,
    403,
  );
  write = true;
  const evidence = await load("app/api/document-knowledge/evidence/route.ts", {
    "@/lib/server/documentKnowledgeStore": store,
    "@/lib/server/documentKnowledgeWeb": web,
  });
  eq(
    (
      await evidence.GET(
        new Request(`http://localhost/evidence?id=${docId}&page=1`),
      )
    ).body.text,
    "Phạt chậm tiến độ 2%.",
  );
  eq(
    (
      await evidence.GET(
        new Request(`http://localhost/evidence?id=${other}&page=1`),
      )
    ).status,
    403,
  );
  const source = await load("app/api/document-knowledge/source/route.ts", {
    "@/lib/server/documentKnowledgeStore": {
      ...store,
      readKnowledgeSource: async () => Buffer.from("fixture"),
    },
    "@/lib/server/documentKnowledgeWeb": web,
  });
  eq(
    (
      await source.GET(
        new Request(`http://localhost/source?id=${docId}&revision=1`),
      )
    ).status,
    409,
    "Old citations cannot silently show different revision",
  );
  const pdf = await source.GET(
    new Request(`http://localhost/source?id=${docId}&revision=2`),
  );
  eq(pdf.status, 200);
  eq(pdf.headers.get("Cache-Control"), "private, no-store");
  eq(pdf.headers.get("Content-Type"), "application/pdf");
  const old = process.env.CHAT_LEGACY_ADMIN_IDS;
  const plannedBefore = prompts.length;
  const direct = await chat.handleKnowledgeChat(req, {
    ...body,
    messages: [{ role: "user", text: "Tổng giá trị nghiệm thu?" }],
  });
  eq(direct.status, 200);
  eq(
    direct.body.usage.input_tokens,
    0,
    "Exact first-turn financial question runs without model",
  );
  eq(prompts.length, plannedBefore, "Known totals do not call Codex");
  eq(direct.body.modelLabel, "Kho hồ sơ · SQL");
  const ambiguous = await chat.handleKnowledgeChat(req, {
    ...body,
    messages: [{ role: "user", text: "Tổng tiền?" }],
  });
  eq(
    ambiguous.body.usage.input_tokens,
    0,
    "General financial overview runs without model",
  );
  const beforeOverview = rpcCalls.length;
  const overview = await chat.handleKnowledgeChat(req, { ...body, messages: [{ role: "user", text: "83 file này bao tiền?" }] });
  eq(overview.status, 200);
  eq(overview.body.usage.input_tokens, 0);
  eq(rpcCalls.slice(beforeOverview).filter(c => c.name === "dk_automatic_summary").map(c => c.args.p_metric), ["contract_total", "accepted_total", "paid_total"]);
  eq(rpcCalls.slice(beforeOverview).filter(c => c.name === "dk_automatic_summary").every(c => c.args.p_expected_documents === 83), true);
  assert.match(overview.body.text, /KẾT QUẢ TỰ ĐỘNG/); checks++;
  assert.match(overview.body.text, /không cộng chúng thành một tổng/); checks++;
  const mismatch = await chat.handleKnowledgeChat(req, { ...body, messages: [{ role: "user", text: "15 file này bao tiền?" }] });
  assert.match(mismatch.body.text, /Phạm vi chưa khớp/); checks++;
  eq(mismatch.body.text.includes("17.250.605.000"), false);
  const subset = await chat.handleKnowledgeChat(req, { ...body, messages: [{ role: "user", text: "2 file trong 83 file bao tiền?" }] });
  eq(subset.body.code, "DK_DOCUMENT_SCOPE_REQUIRED");
  const summaries = await load("app/api/document-knowledge/summary/route.ts", { "@/lib/server/documentKnowledgeStore": store, "@/lib/server/documentKnowledgeWeb": web });
  await summaries.GET(new Request(`http://localhost/summary?project=${pid}`));
  eq(rpcCalls.at(-1).name, "dk_automatic_summary", "UI defaults to automatic totals");
  await summaries.GET(new Request(`http://localhost/summary?project=${pid}&mode=verified`));
  eq(rpcCalls.at(-1).name, "dk_financial_summary", "Manual verified totals remain explicitly available");
  eq((await summaries.GET(new Request(`http://localhost/summary?project=${pid}&mode=unsafe`))).body.code, "DK_INVALID_QUERY");
  delete process.env.CHAT_LEGACY_ADMIN_IDS;
  eq(
    await web.legacyKnowledgeRestricted(),
    true,
    "Legacy source tree is closed to ordinary users",
  );
  process.env.CHAT_LEGACY_ADMIN_IDS = user.id;
  eq(
    await web.legacyKnowledgeRestricted(),
    false,
    "Explicit administrator retains legacy access",
  );
  loggedIn = false;
  eq(await web.legacyKnowledgeRestricted(), true);
  loggedIn = true;
  delete process.env.CHAT_LEGACY_ADMIN_IDS;
  eq(
    chat.isLegacyChatAdmin(user),
    false,
    "Full server CLI must be explicitly enabled for administrator",
  );
  const legacyTree = await load("app/api/ai-qs/route.ts", {
    "@/lib/server/requireAccess": auth,
    "@/lib/server/documentKnowledgeWeb": web,
    "@/lib/server/aiQsFiles": {
      listAiQsTree: async () => {
        throw new Error("Legacy tree must not be read");
      },
    },
  });
  eq(
    (await legacyTree.GET()).body.legacyRestricted,
    true,
    "Old tree URL cannot bypass new private projects",
  );
  const legacyDownload = await load("app/api/ai-qs/download/route.ts", {
    "@/lib/server/requireAccess": auth,
    "@/lib/server/documentKnowledgeWeb": web,
    "@/lib/server/aiQsFiles": {},
  });
  eq(
    (
      await legacyDownload.GET(
        new Request("http://localhost/api/ai-qs/download?path=contract.pdf"),
      )
    ).status,
    403,
  );
  if (old === undefined) delete process.env.CHAT_LEGACY_ADMIN_IDS;
  else process.env.CHAT_LEGACY_ADMIN_IDS = old;
  console.log(
    `PASS document knowledge API/chat: ${checks} checks, bounded retrieval, permissions, citations and SQL routing`,
  );
} finally {
  if (priorFlag === undefined) delete process.env.DOCUMENT_KNOWLEDGE_ENABLED;
  else process.env.DOCUMENT_KNOWLEDGE_ENABLED = priorFlag;
}
