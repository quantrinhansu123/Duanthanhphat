import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = ts.transpileModule(await readFile(new URL("../src/lib/server/chatModels.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
let listingCalls = 0;
function load(unavailable = false) {
  const imports = {
    "node:util": { promisify: (fn) => (...args) => new Promise((resolve, reject) => fn(...args, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }))) },
    "node:child_process": { execFile(command, args, options, callback) {
      assert.equal(command, "agy");
      assert.equal(args[0], "models");
      assert.equal(options.shell, undefined);
      listingCalls++;
      callback(unavailable ? new Error("not installed") : null, "Fetching available models...\ngemini-3.8-flash-medium\tGemini Medium\nclaude-sonnet-4-6\tClaude Sonnet\nbad;command\tInvalid\n", "");
    } },
    "node:fs/promises": { readFile: async () => JSON.stringify({ models: [
      { slug: "gpt-6-luna", display_name: "Luna", visibility: "list" },
      { slug: "gpt-6-sol", display_name: "Sol", visibility: "list" },
      { slug: "hidden", visibility: "hide" },
    ] }) },
  };
  const exports = {};
  vm.runInNewContext(source, { exports, process: { env: { CHAT_PROVIDER: "codex" }, cwd: () => process.cwd() }, require: (name) => imports[name] ?? require(name) });
  return exports;
}
const api = load();
const list = await api.getChatModels();
assert.equal(list.defaultId, "codex:gpt-6-luna");
assert.equal(list.models.filter((m) => m.provider === "codex").length, 2, "Deduplicate default and exclude hidden models");
assert.equal(list.models.filter((m) => m.provider === "anti").length, 2);
assert.equal(list.models.find((m) => m.id === "anti:gemini-3.8-flash-medium").label, "Gemini Medium");
assert.ok(list.models.every((m) => !m.id.includes(";")));
await api.getChatModels();
assert.equal(listingCalls, 1, "Cache CLI model discovery between chat requests");
const fallback = await load(true).getChatModels();
assert.equal(fallback.models.filter((m) => m.provider === "anti").length, 0);
assert.ok(fallback.antiError);
assert.ok(fallback.models.some((m) => m.provider === "codex"), "Codex stays usable if Anti is unavailable");
console.log("PASS model list: live Anti discovery, Codex catalog, caching, validation and unavailable CLI fallback");
