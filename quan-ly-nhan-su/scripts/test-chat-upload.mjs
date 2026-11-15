import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import vm from "node:vm";
import ts from "typescript";

let denied = null;
const writes = [];
const imports = {
  "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  "node:fs/promises": { mkdir: async () => {}, writeFile: async (...args) => writes.push(args) },
  "node:path": { join },
  "@/lib/server/requireAccess": { requireAccess: async () => denied },
};
const exports = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/app/api/chat/upload/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, File, Buffer, process: { env: { CHAT_PROVIDER: "codex" }, cwd: () => process.cwd() }, require: (name) => imports[name] });
const request = (provider, file = new File(["example"], "hồ sơ.txt")) => ({ formData: async () => new Map([["file", file], ["provider", provider], ["sessionId", "../../session"]]) });
assert.equal((await exports.POST(request("anti"))).status, 200);
assert.ok(writes[0][0].startsWith(join(process.cwd(), ".codex-chat", "uploads", "session") + sep));
assert.equal((await exports.POST(request("codex"))).status, 200);
assert.equal((await exports.POST(request("gemini"))).status, 400);
assert.equal((await exports.POST(request("anti", new File([], "empty.txt")))).status, 400);
assert.equal((await exports.POST(request("anti", new File([new Uint8Array(25 * 1024 * 1024 + 1)], "large.pdf")))).status, 413);
denied = { status: 401 };
assert.equal((await exports.POST(request("anti"))).status, 401);
assert.equal(writes.length, 2, "Rejected requests must never write a file");
console.log("PASS chat uploads: Anti/Codex support, authentication, size limits and safe session paths");
