import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  knowledgeOcrConfig,
  knowledgeOcrEnvironment,
} from "../src/lib/server/documentKnowledgeOcrConfig.ts";
try {
  const config = knowledgeOcrConfig();
  const child = spawn(
    process.env.KNOWLEDGE_PYTHON || "python",
    [
      fileURLToPath(new URL("./knowledge-extract.py", import.meta.url)),
      "--check",
    ],
    {
      windowsHide: true,
      env: knowledgeOcrEnvironment(config),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "",
    failed = false;
  const timer = setTimeout(() => {
    failed = true;
    child.kill();
  }, config.timeoutSeconds * 1000);
  child.stderr.on("data", () => {});
  child.stdout.on("data", (chunk) => {
    output += chunk.toString("utf8");
    if (output.length > 100000) {
      failed = true;
      child.kill();
    }
  });
  const code = await new Promise((resolve) => {
    child.once("error", () => resolve(-1));
    child.once("close", resolve);
  });
  clearTimeout(timer);
  const rows = output
    .split(/\r?\n/)
    .filter((l) => l.startsWith("{"))
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return {};
      }
    });
  const result = rows.find((row) => row.ok) || rows.find((row) => row.error);
  if (code !== 0 || failed || !result?.ok)
    throw new Error(result?.error || "DK_OCR_CHECK_FAILED");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(
    error instanceof Error && /^DK_[A-Z_0-9]+$/.test(error.message)
      ? error.message
      : "DK_OCR_CHECK_FAILED",
  );
  process.exitCode = 1;
}
