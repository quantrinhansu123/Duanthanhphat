// Node >=22.18. Paddle runs in a bounded Python child, separate from the web process.
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rename,
  rm,
  readdir,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { resolve, join, extname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import * as XLSX from "xlsx";
import {
  splitKnowledgePages,
  validateExtractedFacts,
} from "../src/lib/documentKnowledge.ts";
import {
  embedKnowledge,
  extractKnowledgeFacts,
  transcribeKnowledgeImage,
  knowledgePipelineVersion,
} from "../src/lib/server/documentKnowledgeAI.ts";
import {
  knowledgeAdmin,
  knowledgeResult,
  readKnowledgeSource,
  scanKnowledgeDirectory,
} from "../src/lib/server/documentKnowledgeStore.ts";
import {
  knowledgeOcrConfig,
  knowledgeOcrEnvironment,
} from "../src/lib/server/documentKnowledgeOcrConfig.ts";

const scriptRoot = fileURLToPath(new URL(".", import.meta.url));
const abort = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => abort.abort());

async function* boundedLines(stream) {
  const decoder = new StringDecoder("utf8");
  let buffered = "";
  for await (const chunk of stream) {
    buffered += decoder.write(chunk);
    let end;
    while ((end = buffered.indexOf("\n")) >= 0) {
      if (end > 20 * 1024 * 1024) throw new Error("DK_PAGE_IMAGE_LIMIT");
      const line = buffered.slice(0, end);
      buffered = buffered.slice(end + 1);
      yield line;
    }
    if (buffered.length > 20 * 1024 * 1024)
      throw new Error("DK_PAGE_IMAGE_LIMIT");
  }
  buffered += decoder.end();
  if (buffered) yield buffered;
}
export async function resolveOcrPage(row, config, fallbackState, signal) {
  if (
    !row ||
    !Number.isInteger(row.page) ||
    !["native", "paddle", "gemini"].includes(row.method)
  )
    throw new Error("DK_INVALID_PAGE");
  let text = row.text;
  const metadata = row.ocr_meta || {};
  const primaryText = typeof text === "string" ? text : "";
  if (row.image) {
    if (row.fallback_requested) {
      if (config.mode !== "paddle" || config.fallback !== "gemini")
        throw new Error("DK_INVALID_PAGE");
      if (fallbackState.count >= config.maxFallbackPages)
        throw new Error("DK_OCR_FALLBACK_LIMIT");
      fallbackState.count++;
    } else if (config.mode !== "gemini") throw new Error("DK_INVALID_PAGE");
    text = await transcribeKnowledgeImage(row.image, "image/png", signal);
    if (!text.trim()) throw new Error("DK_OCR_NO_TEXT");
    if (
      primaryText.trim() &&
      text.trim().length < primaryText.trim().length * 0.5
    )
      throw new Error("DK_OCR_INCOMPLETE");
    metadata.fallback_used = Boolean(row.fallback_requested);
    if (row.fallback_requested) metadata.primary_text = primaryText;
    row.method = "gemini";
  }
  if (typeof text !== "string" || text.length > 60000)
    throw new Error("DK_INVALID_PAGE");
  if (!text.trim() && metadata.warnings?.length)
    throw new Error("DK_OCR_NO_TEXT");
  return { page: row.page, text, method: row.method, ocr_meta: metadata };
}
async function ocrPages(path, signal, checkpoints) {
  const config = knowledgeOcrConfig();
  const skip = checkpoints?.getCompletedPageNumbers
    ? await checkpoints.getCompletedPageNumbers()
    : [];
  const env = knowledgeOcrEnvironment(config, skip);
  const child = spawn(
    process.env.KNOWLEDGE_PYTHON || "python",
    [join(scriptRoot, "knowledge-extract.py"), path],
    {
      windowsHide: true,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      signal,
    },
  );
  // Always attach exit/error listeners before reading stdout, including fast failures.
  const exited = new Promise((resolve) => {
    child.once("error", () => resolve(new Error("DK_PYTHON_UNAVAILABLE")));
    child.once("close", (code) =>
      resolve(code === 0 ? null : new Error("DK_PDF_EXTRACT_FAILED")),
    );
  });
  // Consume diagnostics without logging private paths or library output.
  child.stderr.on("data", () => {});
  const pages = [];
  const fallbackState = { count: 0 };
  let timedOut = false;
  const stop = () => {
    timedOut = true;
    child.kill();
  };
  const timer = setTimeout(stop, config.timeoutSeconds * 1000);
  try {
    // Pull stdout with backpressure while OCR is pending; never buffer an entire scan.
    for await (const line of boundedLines(child.stdout)) {
      if (!line.startsWith("{")) continue;
      if (line.length > 20 * 1024 * 1024)
        throw new Error("DK_PAGE_IMAGE_LIMIT");
      const row = JSON.parse(line);
      if (row.error)
        throw new Error(
          /^DK_[A-Z_0-9]+$/.test(row.error)
            ? row.error
            : "DK_PDF_EXTRACT_FAILED",
        );
      timer.refresh();
      if (row.page !== pages.length + 1) throw new Error("DK_INCOMPLETE_PAGES");
      const previous = await checkpoints?.getPage(row.page);
      if (row.cached && !previous) throw new Error("DK_OCR_CACHE_MISSING");
      const page =
        previous || (await resolveOcrPage(row, config, fallbackState, signal));
      if (previous?.ocr_meta?.fallback_used) fallbackState.count++;
      if (!previous) await checkpoints?.putPage(page);
      pages.push(page);
    }
    const exitError = await exited;
    if (timedOut) throw new Error("DK_OCR_TIMEOUT");
    if (exitError) throw exitError;
  } catch (error) {
    child.kill();
    await exited;
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (!pages.length) throw new Error("DK_EMPTY_DOCUMENT");
  return pages;
}

export async function extractWorkerPages(bytes, name, signal, checkpoints) {
  const extension = extname(name).toLowerCase();
  if ([".txt", ".md", ".csv", ".json"].includes(extension)) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.length > 500000) throw new Error("DK_TEXT_LIMIT");
    // Synthetic page boundaries are documented for plain text (12000 chars each).
    return Array.from(
      { length: Math.max(1, Math.ceil(text.length / 12000)) },
      (_, i) => ({
        page: i + 1,
        text: text.slice(i * 12000, (i + 1) * 12000),
        method: "text",
      }),
    );
  }
  if ([".xlsx", ".xls"].includes(extension)) {
    const book = XLSX.read(bytes, { type: "buffer" });
    const pages = [];
    for (const sheet of book.SheetNames) {
      const text =
        `Trang tính: ${sheet}\n` + XLSX.utils.sheet_to_csv(book.Sheets[sheet]);
      if (text.length > 500000) throw new Error("DK_TEXT_LIMIT");
      for (let i = 0; i < Math.max(1, text.length); i += 12000)
        pages.push({
          page: pages.length + 1,
          text: text.slice(i, i + 12000),
          method: "spreadsheet",
        });
    }
    return pages;
  }
  if (![".pdf", ".png", ".jpg", ".jpeg", ".webp"].includes(extension))
    throw new Error("DK_UNSUPPORTED_FORMAT");
  const temp = await mkdtemp(join(tmpdir(), "tcw-knowledge-"));
  try {
    const path = join(temp, "source" + extension);
    await writeFile(path, bytes);
    return await ocrPages(path, signal, checkpoints);
  } finally {
    // Check the exact resolved target before a recursive removal on Windows.
    const target = resolve(temp),
      allowed = resolve(tmpdir());
    const { relative, isAbsolute } = await import("node:path");
    const rel = relative(allowed, target);
    if (
      !rel ||
      rel.startsWith("..") ||
      isAbsolute(rel) ||
      !rel.startsWith("tcw-knowledge-")
    )
      throw new Error("DK_UNSAFE_TEMP_PATH");
    await rm(target, { recursive: true, force: true });
  }
}

export async function runKnowledgeJob(admin, claimed, signal) {
  const { job, document } = claimed;
  const token = { p_job: job.id, p_token: job.lease_token };
  let lost = false,
    heartbeatPending = false;
  const leaseAbort = new AbortController();
  const jobSignal = signal
    ? AbortSignal.any([signal, leaseAbort.signal])
    : leaseAbort.signal;
  const heartbeat = setInterval(async () => {
    if (heartbeatPending) return;
    heartbeatPending = true;
    try {
      if (!knowledgeResult(await admin.rpc("dk_heartbeat", token))) lost = true;
    } catch {
      lost = true;
    } finally {
      heartbeatPending = false;
      if (lost) leaseAbort.abort();
    }
  }, 30000);
  try {
    if (document.pipeline_version !== knowledgePipelineVersion())
      throw new Error("DK_PIPELINE_CHANGED");
    const bytes = await readKnowledgeSource(document);
    const cacheRoot = resolve(
      process.env.KNOWLEDGE_CACHE_DIR ||
        join(process.cwd(), ".codex-chat", "knowledge-cache"),
    );
    await mkdir(cacheRoot, { recursive: true, mode: 0o700 });
    const cacheKey = createHash("sha256")
      .update(
        `${document.project_id}:${document.content_hash}:${document.pipeline_version}:${extname(document.name).toLowerCase()}`,
      )
      .digest("hex");
    const directory = join(cacheRoot, cacheKey);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const cachePath = join(directory, "manifest.json");
    let cached = {};
    try {
      const raw = await readFile(cachePath, "utf8");
      if (raw.length < 100 * 1024 * 1024) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          cached = parsed;
      }
    } catch {
      /* First extraction or corrupt generated cache. */
    }
    if (
      cached.pages &&
      (!Array.isArray(cached.pages) ||
        cached.pages.some(
          (p, i) =>
            p?.page !== i + 1 ||
            typeof p.text !== "string" ||
            typeof p.method !== "string",
        ))
    )
      cached = {};
    const save = async (destination, value) => {
      const path = join(directory, randomUUID() + ".tmp");
      await writeFile(path, JSON.stringify(value), { mode: 0o600 });
      await rename(path, destination);
    };
    const checkpoint = () => save(cachePath, cached);
    const checkpoints = {
      async getCompletedPageNumbers() {
        const found = [];
        for (const file of await readdir(directory)) {
          const match = /^page-([0-9]+)\.json$/.exec(file);
          if (
            match &&
            Number(match[1]) <= knowledgeOcrConfig().maxPages &&
            (await this.getPage(Number(match[1])))
          )
            found.push(Number(match[1]));
        }
        return found;
      },
      async getPage(page) {
        try {
          const value = JSON.parse(
            await readFile(join(directory, `page-${page}.json`), "utf8"),
          );
          if (
            value?.page === page &&
            typeof value.text === "string" &&
            typeof value.method === "string"
          )
            return value;
        } catch {
          /* Unfinished page. */
        }
        return null;
      },
      putPage: (page) => save(join(directory, `page-${page.page}.json`), page),
    };
    const pages =
      cached.pages ||
      (await extractWorkerPages(bytes, document.name, jobSignal, checkpoints));
    if (pages.length > 500 || pages.some((p) => p.text.length > 60000))
      throw new Error("DK_PAGE_LIMIT");
    cached.pages = pages;
    await checkpoint();
    const facts = cached.facts
      ? validateExtractedFacts(cached.facts, pages)
      : await extractKnowledgeFacts(pages, jobSignal);
    cached.facts = facts;
    await checkpoint();
    const chunks = splitKnowledgePages(pages);
    for (let start = 0; start < chunks.length; start += 8) {
      jobSignal.throwIfAborted();
      const group = chunks.slice(start, start + 8);
      const vectorPath = join(directory, `vectors-${start}.json`);
      let previous = [];
      try {
        previous = JSON.parse(await readFile(vectorPath, "utf8"));
      } catch {
        /* No completed batch. */
      }
      const valid =
        Array.isArray(previous) &&
        previous.length === group.length &&
        previous.every(
          (v) =>
            Array.isArray(v) &&
            v.length === 768 &&
            v.every(Number.isFinite) &&
            Math.abs(v.reduce((s, n) => s + n * n, 0) - 1) < 0.001,
        );
      const vectors = valid
        ? previous
        : await embedKnowledge(
            group.map((c) => c.content),
            false,
            jobSignal,
          );
      group.forEach((chunk, i) => {
        chunk.embedding = vectors[i];
      });
      if (!valid) await save(vectorPath, vectors);
    }
    if (lost || !knowledgeResult(await admin.rpc("dk_heartbeat", token)))
      throw new Error("DK_LEASE_LOST");
    knowledgeResult(
      await admin.rpc("dk_complete_job", {
        ...token,
        p_pages: pages,
        p_chunks: chunks,
        p_facts: facts,
        p_model:
          process.env.KNOWLEDGE_EMBEDDING_MODEL || "gemini-embedding-001",
      }),
    );
    return {
      job_id: job.id,
      pages: pages.length,
      facts: facts.length,
      chunks: chunks.length,
      state: "done",
    };
  } catch (error) {
    const code = lost
      ? "DK_LEASE_LOST"
      : signal?.aborted
        ? "DK_CANCELLED"
        : error instanceof Error && /^DK_[A-Z_0-9]+$/.test(error.message)
          ? error.message
          : "DK_WORKER_FAILED";
    await admin.rpc("dk_fail_job", { ...token, p_code: code });
    return { job_id: job.id, state: "failed", error_code: code };
  } finally {
    clearInterval(heartbeat);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name) => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args[i + 1];
  };
  const project = option("--project"),
    folder = option("--folder") || "";
  const scanOnly = args.includes("--scan-only"),
    watch = args.includes("--watch");
  const admin = knowledgeAdmin();
  let lastScan = 0;
  do {
    if (project && Date.now() - lastScan > 60000) {
      console.log(
        JSON.stringify({ scan: await scanKnowledgeDirectory(project, folder) }),
      );
      lastScan = Date.now();
    }
    if (scanOnly) return;
    const claimed = knowledgeResult(await admin.rpc("dk_claim_job"));
    if (claimed) {
      const result = await runKnowledgeJob(admin, claimed, abort.signal);
      console.log(JSON.stringify(result));
      if (!watch && result.state === "failed") process.exitCode = 1;
    } else if (watch) await new Promise((resolve) => setTimeout(resolve, 2000));
  } while (watch && !abort.signal.aborted);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error instanceof Error && /^DK_[A-Z_0-9]+$/.test(error.message)
        ? error.message
        : "DK_WORKER_FAILED",
    );
    process.exitCode = 1;
  });
}
