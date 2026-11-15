import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";
import {
  formatVnd,
  knownKnowledgeMetricQuestion,
  isIsoDate,
  splitKnowledgePages,
  validateExtractedFacts,
} from "../src/lib/documentKnowledge.ts";
import {
  embedKnowledge,
  generateKnowledgeJson,
  extractKnowledgeFacts,
  normalizeKnowledgeVector,
  knowledgePipelineVersion,
} from "../src/lib/server/documentKnowledgeAI.ts";
import { extractWorkerPages, runKnowledgeJob } from "./knowledge-worker.mjs";
import { safeKnowledgeKey } from "../src/lib/server/documentKnowledgeStore.ts";

let checks = 0;
const eq = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
const throws = (fn, re) => {
  assert.throws(fn, re);
  checks++;
};
const rejects = async (fn, re) => {
  await assert.rejects(fn, re);
  checks++;
};
const folder = await mkdtemp(join(tmpdir(), "tcw-knowledge-test-"));
const originalFetch = globalThis.fetch;
const previousEnv = { ...process.env };
try {
  // Default unit suite is offline; exercise Gemini with mock fetch, no Paddle install needed.
  process.env.KNOWLEDGE_OCR='gemini';
  eq(isIsoDate("2026-02-30"), false, "Reject impossible dates");
  eq(
    knownKnowledgeMetricQuestion("Tổng giá trị nghiệm thu?"),
    "accepted_total",
  );
  eq(
    knownKnowledgeMetricQuestion("Tổng giá trị nghiệm thu hợp đồng HD-05?"),
    null,
    "Contract filter must not use whole-project shortcut",
  );
  eq(
    knownKnowledgeMetricQuestion("Tổng nghiệm thu đến 2026-11-01?"),
    null,
    "Dated questions must not use today shortcut",
  );
  eq(isIsoDate("2024-02-29"), true);
  eq(
    formatVnd("999999999999999999999999"),
    "999.999.999.999.999.999.999.999 đồng",
    "No IEEE-754 rounding",
  );
  eq(formatVnd(null), "Chưa có số liệu xác minh");
  const text = "Hợp đồng HD01: 1000 đồng.";
  const pages = [{ page: 1, text, method: "fixture" }];
  const fact = {
    contract_code: "HD01",
    kind: "contract_base",
    amount: "1000",
    event_date: "2026-01-01",
    period_index: null,
    source_page: 1,
    quote: text,
  };
  eq(validateExtractedFacts([fact], pages), [fact]);
  throws(
    () => validateExtractedFacts([{ ...fact, amount: 1000 }], pages),
    /DK_INVALID_AMOUNT/,
  );
  throws(
    () => validateExtractedFacts([{ ...fact, quote: "invented" }], pages),
    /DK_EVIDENCE_NOT_FOUND/,
  );
  throws(
    () => validateExtractedFacts([{ ...fact, source_page: 2 }], pages),
    /DK_EVIDENCE_NOT_FOUND/,
  );
  throws(
    () =>
      validateExtractedFacts([{ ...fact, event_date: "2026-02-30" }], pages),
    /DK_INVALID_DATE/,
  );
  throws(
    () => validateExtractedFacts([{ ...fact, period_index: 0 }], pages),
    /DK_INVALID_PERIOD/,
  );
  for (const key of [
    "../secret",
    "a/../b",
    "C:/private",
    "/etc/passwd",
    "a//b",
    "a\0b",
  ])
    throws(() => safeKnowledgeKey(key), /DK_INVALID_PATH/);
  eq(safeKnowledgeKey("Bên A\\hồ sơ.pdf"), "Bên A/hồ sơ.pdf");
  const content = Array.from(
    { length: 140 },
    (_, i) =>
      `Điều khoản ${String(i).padStart(4, "0")} thanh toán 👨‍👩‍👧‍👦 tăng giảm. `,
  ).join("");
  const chunks = splitKnowledgePages([
    { page: 3, text: content, method: "fixture" },
  ]);
  eq(
    chunks.every(
      (c) =>
        Buffer.byteLength(c.content, "utf8") <= 1800 &&
        c.page === 3 &&
        c.content.isWellFormed(),
    ),
    true,
    "Unicode chunks fit embedding budget",
  );
  // Verify overlap never drops text: all original positions are covered in order.
  let covered = 0;
  for (const c of chunks) {
    const start = content.indexOf(c.content, Math.max(0, covered - 250));
    assert.ok(start >= 0 && start <= covered);
    covered = Math.max(covered, start + c.content.length);
  }
  eq(covered, content.trim().length, "No gap when splitting long pages");
  throws(
    () => normalizeKnowledgeVector(new Array(768).fill(0)),
    /DK_INVALID_VECTOR/,
  );
  throws(
    () => normalizeKnowledgeVector(new Array(767).fill(1)),
    /DK_INVALID_VECTOR/,
  );
  const norm = normalizeKnowledgeVector(new Array(768).fill(2));
  eq(Math.abs(norm.reduce((s, n) => s + n * n, 0) - 1) < 1e-10, true);
  process.env.GEMINI_API_KEY = "fixture-key-not-a-secret";
  delete process.env.KNOWLEDGE_EMBEDDING_MODEL;
  const requests = [];
  let mode = "embedding";
  let ocrCount = 0,
    failOcrAt = -1,
    emptyFacts = false,
    manyFacts = false;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, body });
    eq(
      options.headers["x-goog-api-key"],
      "fixture-key-not-a-secret",
      "Key in header",
    );
    if (mode === "denied")
      return {
        ok: false,
        status: 403,
        json: async () => ({ error: "private secret input" }),
      };
    if (String(url).endsWith(":batchEmbedContents"))
      return {
        ok: true,
        json: async () => ({
          embeddings: body.requests.map(() => ({
            values: new Array(768).fill(1),
          })),
        }),
      };
    const isImage = body.contents[0].parts.some((p) => p.inlineData);
    if (isImage && ++ocrCount === failOcrAt)
      return { ok: false, status: 400, json: async () => ({}) };
    const value = isImage
      ? { text: "Trang scan: Nghiệm thu 200 đồng." }
      : {
          facts: manyFacts
            ? new Array(101).fill(fact)
            : emptyFacts
              ? []
              : [fact],
        };
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            finishReason: mode === "truncated" ? "MAX_TOKENS" : "STOP",
            content: { parts: [{ text: JSON.stringify(value) }] },
          },
        ],
      }),
    };
  };
  eq((await embedKnowledge(["Điều khoản phạt"], true))[0].length, 768);
  eq(requests.at(-1).body.requests[0].taskType, "RETRIEVAL_QUERY");
  await embedKnowledge(["Nội dung hợp đồng"]);
  eq(requests.at(-1).body.requests[0].taskType, "RETRIEVAL_DOCUMENT");
  eq(requests.at(-1).body.requests[0].outputDimensionality, 768);
  await rejects(
    () => embedKnowledge(["ấ".repeat(601)]),
    /DK_EMBEDDING_INPUT_LIMIT/,
  );
  mode = "truncated";
  await rejects(() => generateKnowledgeJson("fixture", {}), /DK_AI_INCOMPLETE/);
  mode = "denied";
  await rejects(
    () => embedKnowledge(["fixture"]),
    /^KnowledgeAIError: DK_AI_AUTH$/,
  );
  mode = "normal";
  manyFacts = true;
  await rejects(() => extractKnowledgeFacts(pages), /DK_EXTRACTION_LIMIT/);
  eq(
    "maxItems" in
      requests.at(-1).body.generationConfig.responseJsonSchema.properties.facts,
    false,
    "Keep nested schema compatible with live Gemini",
  );
  manyFacts = false;
  await writeFile(join(folder, "fixture.txt"), text);
  eq(
    await extractWorkerPages(Buffer.from(text), "fixture.txt"),
    pages.map((p) => ({ ...p, method: "text" })),
  );
  await rejects(
    () => extractWorkerPages(Buffer.from(text), "fixture.exe"),
    /DK_UNSUPPORTED_FORMAT/,
  );
  const pdfPath = join(folder, "mixed.pdf");
  execFileSync(
    process.env.KNOWLEDGE_PYTHON || "python",
    [
      "-c",
      'import fitz,sys; s=fitz.open(); p=s.new_page(); p.insert_text((40,70),"Native page contract. "*7); pix=p.get_pixmap(); d=fitz.open(); p=d.new_page(); p.insert_text((40,70),"Native page contract. "*7); p=d.new_page(); p.insert_image(p.rect,pixmap=pix); p=d.new_page(); p.insert_image(p.rect,pixmap=pix); d.save(sys.argv[1])',
      pdfPath,
    ],
    { windowsHide: true },
  );
  const extracted = await extractWorkerPages(
    await readFile(pdfPath),
    "mixed.pdf",
  );
  eq(
    extracted.map((p) => p.page),
    [1, 2, 3],
    "Mixed PDFs retain every page and numbering",
  );
  eq(extracted[0].method, "native");
  eq(
    extracted[1].text,
    "Trang scan: Nghiệm thu 200 đồng.",
    "Only scan page calls OCR",
  );
  process.env.CHAT_CONTRACT_DIR = folder;
  process.env.KNOWLEDGE_CACHE_DIR = join(folder, "cache");
  const claimed = {
    job: { id: "fixture-job", lease_token: "fixture-token" },
    document: {
      project_id: "11111111-1111-4111-8111-111111111111",
      source_kind: "local",
      source_ref: "fixture.txt",
      name: "fixture.txt",
      size_bytes: Buffer.byteLength(text),
      content_hash: createHash("sha256").update(text).digest("hex"),
      pipeline_version: knowledgePipelineVersion(),
    },
  };
  const completed = [];
  let fail = true;
  const admin = {
    rpc: async (name, args) => {
      if (name === "dk_complete_job") {
        if (fail)
          return { error: { message: "DK_DATABASE_ERROR" }, data: null };
        completed.push(args);
      }
      return { data: true, error: null };
    },
  };
  eq(
    (await runKnowledgeJob(admin, claimed)).state,
    "failed",
    "Incomplete database publish is reported",
  );
  const before = requests.length;
  fail = false;
  eq(
    (await runKnowledgeJob(admin, claimed)).state,
    "done",
    "Retry resumes cached work",
  );
  eq(requests.length, before, "Retry does not repeat extraction or embeddings");
  eq(
    completed[0].p_facts,
    [fact],
    "Publication contains proposals, not automatic approvals",
  );
  eq(completed[0].p_chunks[0].embedding.length, 768);
  const pdfBytes = await readFile(pdfPath);
  const pdfClaim = {
    job: { ...claimed.job, id: "pdf-job" },
    document: {
      ...claimed.document,
      source_ref: "mixed.pdf",
      name: "mixed.pdf",
      size_bytes: pdfBytes.length,
      content_hash: createHash("sha256").update(pdfBytes).digest("hex"),
    },
  };
  emptyFacts = true;
  failOcrAt = ocrCount + 2;
  eq(
    (await runKnowledgeJob(admin, pdfClaim)).error_code,
    "DK_AI_HTTP_400",
    "Mid-document OCR failure is explicit",
  );
  const ocrBeforeRetry = ocrCount;
  eq((await runKnowledgeJob(admin, pdfClaim)).state, "done");
  eq(
    ocrCount - ocrBeforeRetry,
    1,
    "Retry reuses OCR of earlier successful pages",
  );
  await writeFile(join(folder, "fixture.txt"), "changed");
  eq(
    (await runKnowledgeJob(admin, claimed)).error_code,
    "DK_SOURCE_CHANGED",
    "Hash checked even with cache",
  );
  console.log(
    `PASS document knowledge core/worker: ${checks} checks; mixed PDF, mocked Google, checkpoint resume`,
  );
} finally {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env))
    if (!(key in previousEnv)) delete process.env[key];
  Object.assign(process.env, previousEnv);
  const target = resolve(folder),
    rel = relative(resolve(tmpdir()), target);
  if (
    !rel ||
    rel.startsWith("..") ||
    isAbsolute(rel) ||
    !rel.startsWith("tcw-knowledge-test-")
  )
    throw new Error("Unsafe test cleanup");
  await rm(target, { recursive: true, force: true });
}
