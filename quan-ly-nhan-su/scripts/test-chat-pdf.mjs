import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/lib/server/chatPdf.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, require: createRequire(import.meta.url) });
const dir = await mkdtemp(join(tmpdir(), "chat-pdf-"));
try {
  const textPdf = join(dir, "hồ sơ.pdf"), scanPdf = join(dir, "scan.pdf");
  await promisify(execFile)("python", ["-c", `
import fitz, sys
with fitz.open() as doc:
    doc.new_page().insert_text((72,72), "Candidate CV: TypeScript, React and Next.js. Software engineer.")
    doc.new_page().insert_text((72,72), "Experience: Built dashboards and integrated Supabase databases.")
    doc.save(sys.argv[1])
with fitz.open() as doc:
    doc.new_page()
    doc.save(sys.argv[2])
`, textPdf, scanPdf], { windowsHide: true });
  const text = await exports.readChatPdf(textPdf);
  assert.ok(text.includes("TypeScript") && text.includes("Supabase"), "Extract every page, including Unicode paths");
  assert.equal(await exports.readChatPdf(scanPdf), null, "Scans must fall back to image reading");
  assert.equal(await exports.readChatPdf(join(dir, "missing.pdf")), null);
  assert.equal(await exports.readChatPdf("example.docx"), null);
  console.log("PASS chat PDF: direct text, multiple pages, Unicode paths, scan and error fallback");
} finally {
  await rm(dir, { recursive: true, force: true });
}
