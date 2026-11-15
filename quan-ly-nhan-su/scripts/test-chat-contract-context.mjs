import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, stat, utimes, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/lib/server/chatContractContext.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, require: createRequire(import.meta.url) });
const home = await mkdtemp(join(tmpdir(), "chat-contract-"));
try {
  const root = join(home, "source");
  await mkdir(root);
  await mkdir(join(home, "hd-cache"));
  const pdf = join(root, "original.pdf");
  await writeFile(pdf, "fixture");
  const code = "1612/2025/HĐ/TCW-TN";
  const row = { cot: [code, "Tùng Nguyên"], pdfHopDong: [pdf] };
  const index = join(home, "hoso-index.json");
  const cache = join(home, "hd-cache", code.replaceAll("/", "_") + ".json");
  const data = { soHD: code, pdf, benA: "Original company", benB: "Original partner" };
  await writeFile(index, JSON.stringify({ rows: [row] }));
  await writeFile(cache, "\uFEFF" + JSON.stringify(data));
  const read = (text) => exports.readChatContractContext(text, home, root);
  const request = `Dựa theo hợp đồng ${code} (Tùng Nguyên), tạo hợp đồng cho Nguyễn Văn Huy`;
  const context = await read(request);
  assert.ok(context.includes('"benA":"Original company"'), "Load exact contract, including UTF-8 BOM cache");
  assert.ok(context.includes("không gán địa chỉ/chức vụ"), "Never reuse old partner identity for a new party");
  assert.ok((await read(request.replace("HĐ", "HD"))).includes(code), "Match Vietnamese contract code variants");
  assert.equal(await read("Xin chào"), "");
  assert.equal(await read(request.replace("1612", "11612")), "", "Do not match partial contract codes");
  await writeFile(index, JSON.stringify({ rows: [row, row] }));
  assert.equal(await read(request), "", "Ambiguous matches fall back to normal lookup");
  await writeFile(index, JSON.stringify({ rows: [row] }));
  const future = new Date((await stat(cache)).mtimeMs + 10000);
  await utimes(pdf, future, future);
  assert.equal(await read(request), "", "Never reuse cache when source PDF has changed");
  await utimes(pdf, new Date(0), new Date(0));
  await writeFile(cache, JSON.stringify({ ...data, soHD: "wrong" }));
  assert.equal(await read(request), "", "Verify embedded contract identity");
  await writeFile(cache, JSON.stringify({ ...data, pdf: join(home, "outside.pdf") }));
  assert.equal(await read(request), "", "Reject unrelated sources");
  await writeFile(cache, "bad json");
  assert.equal(await read(request), "");
  console.log("PASS contract context: exact match, BOM, ambiguity, freshness, identity and safe fallback");
} finally {
  await rm(home, { recursive: true, force: true });
}
