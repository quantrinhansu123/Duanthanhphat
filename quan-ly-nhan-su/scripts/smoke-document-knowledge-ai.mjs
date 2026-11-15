// Explicit opt-in only. Sends synthetic fixtures to Google, never business documents.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { extractWorkerPages } from "./knowledge-worker.mjs";
import {
  embedKnowledge,
  extractKnowledgeFacts,
  transcribeKnowledgeImage,
} from "../src/lib/server/documentKnowledgeAI.ts";

if (!process.argv.includes("--live")) {
  console.log("Live API smoke test is opt-in: pnpm knowledge:smoke -- --live");
  process.exit(0);
}
const calls = [];
const previous = globalThis.fetch;
let syntheticDirectory;
globalThis.fetch = async (url, options) => {
  const started = Date.now();
  const response = await previous(url, options);
  const json = await response
    .clone()
    .json()
    .catch(() => ({}));
  calls.push({
    operation: String(url).split(":").at(-1),
    status: response.status,
    elapsed_ms: Date.now() - started,
    usage: json.usageMetadata,
  });
  return response;
};
try {
  const [doc] = await embedKnowledge([
    "Điều khoản phạt chậm tiến độ trong hợp đồng thử nghiệm.",
  ]);
  const [query] = await embedKnowledge(["Phạt chậm tiến độ bao nhiêu?"], true);
  assert.equal(doc.length, 768);
  assert.equal(query.length, 768);
  assert.ok(Math.abs(doc.reduce((s, n) => s + n * n, 0) - 1) < 0.001);
  const pages = [
    {
      page: 1,
      method: "synthetic",
      text: "TÀI LIỆU THỬ NGHIỆM, KHÔNG PHẢI HỒ SƠ THẬT. Hợp đồng HD-TEST-01 ký ngày 01/11/2026, giá trị 1.000.000 đồng. Biên bản nghiệm thu lũy kế đợt 2 ngày 02/11/2026 ghi 600.000 đồng. Đề nghị thanh toán ngày 03/11/2026 là 500.000 đồng. Chưa có chứng từ chứng minh chuyển khoản.",
    },
  ];
  const facts = await extractKnowledgeFacts(pages);
  assert.ok(
    facts.some((f) => f.kind === "contract_base" && f.amount === "1000000"),
  );
  assert.ok(
    facts.some(
      (f) =>
        f.kind === "accepted_cumulative" &&
        f.amount === "600000" &&
        f.period_index === 2,
    ),
  );
  assert.ok(
    facts.some((f) => f.kind === "payment_request" && f.amount === "500000"),
  );
  assert.ok(
    !facts.some((f) => f.kind === "payment"),
    "A payment request is not proof of transfer",
  );
  const image = execFileSync(
    process.env.KNOWLEDGE_PYTHON || "python",
    [
      "-c",
      'import fitz,sys; d=fitz.open(); p=d.new_page(width=600,height=240); p.insert_text((30,40),"SYNTHETIC TEST - NOT A REAL CONTRACT",fontsize=16); p.insert_text((30,80),"CONTRACT HD-TEST-01",fontsize=20); p.insert_text((30,125),"Date: 2026-11-01",fontsize=20); p.insert_text((30,170),"Total: 1.000.000 VND",fontsize=20); sys.stdout.buffer.write(p.get_pixmap(dpi=160).tobytes("png"))',
    ],
    { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
  );
  const ocr = await transcribeKnowledgeImage(
    image.toString("base64"),
    "image/png",
  );
  assert.ok(ocr.includes("HD-TEST-01"));
  assert.ok(ocr.includes("1.000.000"));
  // Exercise the real OCR upload/PDF path with Vietnamese names and financial fields.
  process.env.KNOWLEDGE_OCR = "gemini";
  syntheticDirectory = await mkdtemp(join(tmpdir(), "tcw-gemini-ocr-smoke-"));
  execFileSync(
    process.env.KNOWLEDGE_PYTHON || "python",
    [
      fileURLToPath(new URL("./knowledge-ocr-fixture.py", import.meta.url)),
      syntheticDirectory,
    ],
    { windowsHide: true },
  );
  const expected = JSON.parse(
    await readFile(join(syntheticDirectory, "manifest.json"), "utf8"),
  ).must_contain;
  const imagePages = await extractWorkerPages(
    await readFile(join(syntheticDirectory, "vietnamese.png")),
    "vietnamese.png",
  );
  const pdfPages = await extractWorkerPages(
    await readFile(join(syntheticDirectory, "mixed.pdf")),
    "mixed.pdf",
  );
  assert.equal(imagePages[0].method, "gemini");
  assert.equal(pdfPages.length, 4);
  assert.equal(pdfPages[0].method, "native");
  assert.equal(pdfPages[3].text, "");
  for (const page of [imagePages[0], pdfPages[1], pdfPages[2]])
    for (const field of expected)
      assert.ok(
        page.text.includes(field),
        "Vietnamese field was not preserved",
      );
  console.log(
    JSON.stringify(
      {
        synthetic: true,
        passed: true,
        dimensions: 768,
        financialFacts: 3,
        realPayments: 0,
        ocr: true,
        vietnameseOcrFields: true,
        mixedPdfPages: pdfPages.length,
        calls,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const code =
    error instanceof Error && /^DK_[A-Z_0-9]+$/.test(error.message)
      ? error.message
      : "DK_LIVE_ASSERTION_FAILED";
  console.error(
    JSON.stringify(
      { synthetic: true, passed: false, error: code, calls },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  globalThis.fetch = previous;
  if (syntheticDirectory) {
    const rel = relative(resolve(tmpdir()), resolve(syntheticDirectory));
    if (
      !rel ||
      rel.startsWith("..") ||
      isAbsolute(rel) ||
      !rel.startsWith("tcw-gemini-ocr-smoke-")
    )
      throw new Error("Unsafe test cleanup");
    await rm(syntheticDirectory, { recursive: true, force: true });
  }
}
