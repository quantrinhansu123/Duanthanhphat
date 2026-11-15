import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = await mkdtemp(join(tmpdir(), "chat-build-"));
try {
  const path = join(root, ".next", "server", "app", "api", "chat", "route.js.nft.json");
  await mkdir(dirname(path), { recursive: true });
  const files = [
    join(root, ".codex-chat", "auth.json"),
    join(root, ".codex-chat", "uploads", "private.pdf"),
    join(root, ".codex-chat-backup", "keep.js"),
    join(root, "node_modules", "keep.js"),
  ].map((file) => relative(dirname(path), file));
  await writeFile(path, JSON.stringify({ version: 1, files }));
  const script = fileURLToPath(new URL("./strip-chat-runtime-traces.mjs", import.meta.url));
  await promisify(execFile)(process.execPath, [script], { cwd: root, windowsHide: true });
  const result = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(result.files, files.slice(2), "Exclude only private runtime, preserving siblings and dependencies");
  assert.equal(result.version, 1);
  await promisify(execFile)(process.execPath, [script], { cwd: root, windowsHide: true });
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), result, "Cleanup is idempotent");
  console.log("PASS build traces: private files excluded, sibling/dependency files preserved, idempotent");
} finally {
  await rm(root, { recursive: true, force: true });
}
