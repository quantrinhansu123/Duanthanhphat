// Explicit opt-in: downloads models on first run, sends no content to Google.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { extractWorkerPages } from "./knowledge-worker.mjs";
import { knowledgeOcrConfig } from "../src/lib/server/documentKnowledgeOcrConfig.ts";
if (!process.argv.includes("--live")) {
  console.log("Opt-in local model test: pnpm knowledge:ocr:smoke -- --live");
  process.exit(0);
}
process.env.KNOWLEDGE_OCR = "paddle";
process.env.KNOWLEDGE_OCR_FALLBACK = "none";
const folder = await mkdtemp(join(tmpdir(), "tcw-paddle-smoke-"));
const previous = globalThis.fetch;
let apiCalls = 0;
globalThis.fetch = async () => {
  apiCalls++;
  throw new Error("Unexpected cloud request");
};
try {
  const fixture = spawnSync(
    process.env.KNOWLEDGE_PYTHON || "python",
    [
      fileURLToPath(new URL("./knowledge-ocr-fixture.py", import.meta.url)),
      folder,
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  if (fixture.status !== 0) throw new Error("DK_TEST_FIXTURE_FAILED");
  const expected = JSON.parse(
    await readFile(join(folder, "manifest.json"), "utf8"),
  ).must_contain;
  const results = [];
  for (const name of ["vietnamese.png", "mixed.pdf"]) {
    const start = Date.now(),
      pages = await extractWorkerPages(
        await readFile(join(folder, name)),
        name,
      );
    const ocr = pages.filter((p) => p.method === "paddle");
    assert.equal(ocr.length, name.endsWith(".pdf") ? 2 : 1);
    for (const page of ocr)
      for (const value of expected)
        assert.ok(
          page.text.includes(value),
          `Missing synthetic field ${value}`,
        );
    if (name.endsWith(".pdf")) {
      assert.equal(pages[0].method, "native");
      assert.equal(pages[3].text, "");
    }
    results.push({
      file: name,
      pages: pages.length,
      elapsed_ms: Date.now() - start,
      ocr: ocr.map((p) => ({
        page: p.page,
        mean_confidence: p.ocr_meta.mean_confidence,
        elapsed_ms: p.ocr_meta.elapsed_ms,
        warnings: p.ocr_meta.warnings,
      })),
    });
  }
  assert.equal(apiCalls, 0);
  console.log(
    JSON.stringify(
      {
        passed: true,
        synthetic: true,
        apiCalls,
        config: knowledgeOcrConfig(),
        results,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    error instanceof Error && /^DK_[A-Z_0-9]+$/.test(error.message)
      ? error.message
      : "DK_PADDLE_SMOKE_FAILED",
  );
  process.exitCode = 1;
} finally {
  globalThis.fetch = previous;
  const rel = relative(resolve(tmpdir()), resolve(folder));
  if (
    !rel ||
    rel.startsWith("..") ||
    isAbsolute(rel) ||
    !rel.startsWith("tcw-paddle-smoke-")
  )
    throw new Error("Unsafe test cleanup");
  await rm(folder, { recursive: true, force: true });
}
