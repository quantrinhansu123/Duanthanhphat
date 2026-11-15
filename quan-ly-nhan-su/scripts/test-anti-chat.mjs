import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const children = [];
const deadlines = [];
const imports = {
  "node:child_process": { spawn(command, args, options) {
    assert.equal(command, "agy");
    assert.ok(!args.some((arg) => arg.startsWith("--print")), "Use continuous input mode, not single-prompt print mode");
    assert.equal(options.shell, undefined, "Never run user prompts through a shell");
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stdin = new PassThrough();
    child.writes = [];
    child.args = args;
    child.stdin.on("data", (line) => child.writes.push(JSON.parse(line.toString())));
    child.kill = () => { if (!child.killed) { child.killed = true; child.emit("close"); } };
    children.push(child);
    return child;
  } },
};
const exports = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/lib/server/antiChat.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, process, setTimeout: (fn, ms) => {
  const timer = setTimeout(fn, ms);
  if (ms === 90000) deadlines.push(fn);
  return timer;
}, clearTimeout, require: (name) => imports[name] ?? require(name) });
const result = (child, response, status = "SUCCESS") => child.stdout.write(JSON.stringify({ event: "result", result: { status, response } }) + "\n");
const first = exports.askAntiCli("session:model", "gemini-3.8-flash-medium", "Nguyễn Văn Huy\n" + "x".repeat(80000), "next");
assert.equal(children[0].writes[0].event, "user");
assert.ok(children[0].writes[0].message.content.length > 80000, "Long Unicode prompts travel over stdin");
assert.ok(!children[0].args.some((arg) => arg.includes("Nguyễn")), "Prompt must not be exposed in argv");
await assert.rejects(exports.askAntiCli("session:model", "gemini-3.8-flash-medium", "initial", "next"), /đang xử lý/);
result(children[0], " First reply \n");
assert.equal(await first, "First reply");
const second = exports.askAntiCli("session:model", "gemini-3.8-flash-medium", "unused initial", "Follow-up");
assert.equal(children.length, 1, "Reuse process and conversation between turns");
assert.equal(children[0].writes[1].message.content, "Follow-up");
result(children[0], "Second reply");
assert.equal(await second, "Second reply");
const other = exports.askAntiCli("other:model", "claude-sonnet-4-6", "New model history", "next");
assert.equal(children.length, 2, "Isolate conversations/models");
result(children[1], "", "ERROR");
await assert.rejects(other, /không trả về nội dung/);
const retry = exports.askAntiCli("other:model", "claude-sonnet-4-6", "Restored history", "next");
assert.equal(children[2].writes[0].message.content, "Restored history");
children[2].emit("error", new Error("ENOENT"));
await assert.rejects(retry, /Không khởi động được/);
const closed = exports.askAntiCli("closed:model", "claude-sonnet-4-6", "initial", "next");
children[3].kill();
await assert.rejects(closed, /đã đóng kết nối/);
const controller = new AbortController();
const cancelled = exports.askAntiCli("cancel:model", "claude-sonnet-4-6", "initial", "next", controller.signal);
const cancelledChild = children.at(-1);
controller.abort();
await assert.rejects(cancelled, /đã dừng/);
assert.equal(cancelledChild.killed, true, "Disconnected requests must stop their own CLI process");
const hung = exports.askAntiCli("hung:model", "claude-sonnet-4-6", "initial", "next");
deadlines.at(-1)();
await assert.rejects(hung, /90 giây/);
assert.equal(children.at(-1).killed, true, "Timeout must stop the hung process");
const structured = exports.askAntiCli("structured:model", "claude-sonnet-4-6", "initial", "next", undefined, { type: "object" });
const structuredChild = children.at(-1);
assert.ok(structuredChild.args.includes("--json-schema"));
structuredChild.stdout.write(JSON.stringify({ event: "result", result: { status: "SUCCESS", response: 'invalid footer', structured_output: { action: "message", text: "Valid structured answer" } } }) + "\n");
assert.equal(JSON.parse(await structured).text, "Valid structured answer", "Prefer validated CLI data over decorated response text");
for (const child of children) child.kill();
console.log("PASS Anti CLI: NDJSON, context reuse, isolation, abort, timeout and recovery");
