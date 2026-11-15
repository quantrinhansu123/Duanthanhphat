import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const antiResponseModule = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/lib/server/antiResponse.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: antiResponseModule });
const calls = [], configs = [];
const antiCalls = [];
let antiResponse = JSON.stringify({ action: "message", text: "Anti CLI reply" });
let starts = 0;
let contractContext = "";
let authenticatedUser = { email: "test@example.com" };
const env = { CHAT_PROVIDER: "codex" };
const imports = {
  "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  "node:child_process": {
    spawn() {
      starts++;
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.kill = () => {};
      child.stdin = { write(line) {
        const call = JSON.parse(line);
        calls.push(call);
        const result = call.method === "thread/start" ? { thread: { id: "test-thread" } } : {};
        queueMicrotask(() => {
          child.stdout.write(JSON.stringify({ id: call.id, result }) + "\n");
          if (call.method === "turn/start") {
            child.stdout.write(JSON.stringify({ method: "item/agentMessage/delta", params: { threadId: "test-thread", delta: "Bạn cần hỗ trợ gì?" } }) + "\n");
            child.stdout.write(JSON.stringify({ method: "turn/completed", params: { threadId: "test-thread" } }) + "\n");
          }
        });
      } };
      return child;
    },
  },
  "node:fs/promises": {
    stat: async (path) => ({ mtimeMs: path.endsWith("hoso-index.json") ? 2 : 1 }),
    mkdir: async () => {}, copyFile: async () => {},
    writeFile: async (path, text) => { configs.push({ path, text }); },
    readFile: async () => JSON.stringify({ models: [{ slug: "gpt-6-luna" }] }),
  },
  xlsx: {},
  "@/lib/server/requireAccess": { requireAuthenticatedUser: async () => ({ denied: null, user: authenticatedUser }) },
  "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email: "test@example.com" } } }) } }) },
  "@/lib/server/chatPdf": { readChatPdf: async () => null },
  "@/lib/server/chatContractContext": { readChatContractContext: async () => contractContext },
  "@/lib/server/antiChat": { askAntiCli: async (...args) => { antiCalls.push(args); return antiResponse; } },
  "@/lib/server/antiResponse": antiResponseModule,
  "@/lib/server/chatModels": { getChatModels: async () => ({ models: [
    { id: "codex:gpt-6-luna", provider: "codex", model: "gpt-6-luna" },
    { id: "codex:gpt-6-sol", provider: "codex", model: "gpt-6-sol" },
    { id: "anti:gemini-3.8-flash-medium", provider: "anti", model: "gemini-3.8-flash-medium" },
  ], defaultId: "codex:gpt-6-luna" }) },
};
const exports = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/app/api/chat/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  exports, process: { env, cwd: () => process.cwd() },
  setTimeout, clearTimeout, URL,
  require: (name) => imports[name] ?? require(name),
});
const request = (text, modelId) => ({ url: "http://localhost:3010/api/chat", json: async () => ({ sessionId: "test-session", modelId, messages: [{ role: "user", text }] }) });
const greeting = await exports.POST(request("Chào bạn!", "anti:gemini-3.8-flash-medium"));
assert.equal(greeting.body.modelLabel, "Hệ thống", "Local greeting must not pretend to be a model response");
assert.equal(starts, 0, "Do not start a CLI for a first-message greeting");
assert.equal(antiCalls.length, 0);
assert.equal((await exports.POST(request("a"))).body.text, "Bạn cần hỗ trợ gì?");
assert.equal(starts, 1);
const config = configs.find((file) => file.path.endsWith("config.toml")).text;
assert.ok(config.includes("fast_mode = true"));
assert.ok(config.includes("model_catalog_json = "), "Avoid online model-list timeouts when model is cached");
for (const feature of ["plugins", "remote_plugin", "apps", "shell_snapshot"]) {
  assert.ok(config.includes(`${feature} = false`), `${feature} must not slow chatbot startup`);
}
const turn = calls.find((call) => call.method === "turn/start");
assert.equal(turn.params.effort, "medium");
assert.equal(turn.params.serviceTier, "priority", "Fast mode must preserve medium reasoning");
assert.ok(turn.params.input[0].text.includes("không chạy lệnh hay kiểm tra môi trường"));
assert.ok(turn.params.input[0].text.includes("hoso-index.json"), "First message must receive the initialized contract index path");
env.CODEX_EFFORT = "high";
assert.equal((await exports.POST(request("Câu hỏi tiếp theo"))).status, 200);
assert.equal(starts, 1, "Reuse the running process");
assert.equal(calls.filter((call) => call.method === "thread/start").length, 1, "Reuse conversation context");
assert.equal(calls.filter((call) => call.method === "turn/start").at(-1).params.effort, "high");
assert.equal(calls.filter((call) => call.method === "turn/start").at(-1).params.serviceTier, "priority");
contractContext = "Verified contract data fixture";
await exports.POST(request("Tạo hợp đồng theo mẫu"));
assert.ok(calls.filter((call) => call.method === "turn/start").at(-1).params.input[0].text.includes(contractContext), "Inject verified data without another tool round trip");
const turnsBeforeAnti = calls.length;
assert.equal((await exports.POST(request("Thử Anti", "anti:gemini-3.8-flash-medium"))).body.text, "Anti CLI reply");
assert.equal(calls.length, turnsBeforeAnti, "Anti selection must not start a Codex turn");
assert.equal(antiCalls[0][1], "gemini-3.8-flash-medium");
assert.ok(antiCalls[0][2].length < 4000, "Anti must not receive unrelated database/schema instructions for every conversation");
assert.ok(antiCalls[0][2].includes(contractContext), "Both providers receive the same verified contract data");
antiResponse = JSON.stringify({ action: "contract_form", text: "Mời kiểm tra thông tin hợp đồng.", data: Object.fromEntries(antiResponseModule.ANTI_RESPONSE_SCHEMA.properties.data.required.map((key) => [key, key === "bTen" ? "Nguyễn Văn Huy" : ""])) });
const contract = await exports.POST(request("Tạo hợp đồng", "anti:gemini-3.8-flash-medium"));
assert.equal(contract.body.action, "contract_form");
assert.equal(contract.body.data.bTen, "Nguyễn Văn Huy");
assert.ok(antiCalls[0][5]?.properties?.action, "Require structured output instead of free-form contract markers");
assert.equal(antiCalls[1][6], "tcw-contract-draft", "Verified template drafts must not open tools and reread PDFs");
assert.equal((await exports.POST(request("Test", "anti:unknown;command"))).status, 400);
assert.equal(antiCalls.length, 2, "Unknown model must not invoke a CLI");
await exports.POST(request("Đổi Codex model", "codex:gpt-6-sol"));
assert.equal(calls.filter((call) => call.method === "thread/start").at(-1).params.model, "gpt-6-sol");
await exports.POST(request("Đối chiếu rồi tạo hợp đồng", "anti:gemini-3.8-flash-medium"));
assert.equal(antiCalls.at(-1)[6], undefined, "Explicit source verification must keep normal file tools available");
authenticatedUser = null;
assert.equal((await exports.POST(request("Chào bạn!"))).status, 401, "Fast path must still require a verified account");
console.log("PASS chat API: provider routing, model validation, shared contract output, Fast and context reuse");
