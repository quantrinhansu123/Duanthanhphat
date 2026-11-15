import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { join } from "node:path";
import { tmpdir } from "node:os";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
let mode = "ok",
  killed = 0,
  checks = 0,
  cleanup = 0;
const eq = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
const rejects = async (fn, re) => {
  await assert.rejects(fn, re);
  checks++;
};
const spawned = [],
  writes = [];
const env = {
  KNOWLEDGE_CODEX_BINARY: join(tmpdir(), "fixture-codex.exe"),
  KNOWLEDGE_CODEX_HOME: join(tmpdir(), "private-auth"),
  GEMINI_API_KEY: "never-inherit-google",
  SUPABASE_SERVICE_ROLE_KEY: "never-inherit-database",
  PATH: process.env.PATH,
  NODE_ENV: "test",
};
const mocks = {
  "server-only": {},
  "node:fs/promises": {
    mkdtemp: async (prefix) => prefix + "fixture",
    writeFile: async (...args) => writes.push(args),
    readFile: async () =>
      mode === "invalid" ? "invalid" : JSON.stringify({ text: "fixture" }),
    access: async () => {},
    rm: async () => {
      cleanup++;
    },
  },
  "node:child_process": {
    spawn(binary, args, options) {
      spawned.push({ binary, args, options });
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => {
        killed++;
      };
      child.stdin = new EventEmitter();
      child.stdin.end = () =>
        queueMicrotask(() => {
          if (mode === "tool")
            child.stdout.write(
              JSON.stringify({
                type: "item.started",
                item: { type: "command_execution" },
              }) + "\n",
            );
          if (mode === "overflow")
            child.stdout.write("x".repeat(1024 * 1024 + 1));
          child.stdout.write(
            JSON.stringify({
              type: "turn.completed",
              usage: {
                input_tokens: 25,
                cached_input_tokens: 10,
                output_tokens: 4,
              },
            }) + "\n",
          );
          child.emit("close", mode === "failed" ? 1 : 0);
        });
      return child;
    },
  },
};
const exports = {};
const code = ts.transpileModule(
  await readFile(
    new URL("../src/lib/server/documentKnowledgeCodex.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
vm.runInNewContext(code, {
  exports,
  require: (name) => mocks[name] ?? require(name),
  process: { env, platform: process.platform },
  Error,
  Buffer,
  setTimeout,
  clearTimeout,
});
const schema = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
  additionalProperties: false,
};
const result = await exports.knowledgeCompletion("fixture", schema);
eq(result.value.text, "fixture");
eq(result.usage.input_tokens, 25);
const { args, options } = spawned[0];
eq(options.windowsHide, true);
eq(options.env.GEMINI_API_KEY, undefined);
eq(options.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
assert.ok(
  args.includes("--ignore-user-config") &&
    args.includes("--ephemeral") &&
    args.includes("read-only"),
);
checks++;
assert.ok(
  args.includes('service_tier="default"') &&
    args.includes('web_search="disabled"'),
);
checks++;
assert.ok(
  args.includes("shell_tool") &&
    args.includes("multi_agent_v2") &&
    args.includes("computer_use"),
);
checks++;
assert.ok(args.some((a) => a.startsWith("model_instructions_file=")));
checks++;
assert.ok(writes.every((w) => w[2].mode === 0o600));
checks++;
eq(cleanup, 1, "Temporary prompts removed on success");
mode = "tool";
await rejects(
  () => exports.knowledgeCompletion("fixture", schema),
  /DK_CODEX_TOOL_ATTEMPT/,
);
eq(killed > 0, true, "Unexpected tool execution terminates process");
mode = "overflow";
await rejects(
  () => exports.knowledgeCompletion("fixture", schema),
  /DK_CODEX_OUTPUT_LIMIT/,
);
mode = "invalid";
await rejects(
  () => exports.knowledgeCompletion("fixture", schema),
  /DK_CODEX_INVALID_JSON/,
);
mode = "failed";
await rejects(
  () => exports.knowledgeCompletion("fixture", schema),
  /DK_CODEX_UNAVAILABLE/,
);
mode = "ok";
const signal = new AbortController();
signal.abort();
await rejects(
  () => exports.knowledgeCompletion("fixture", schema, signal.signal),
  /DK_CANCELLED/,
);
eq(cleanup, 6, "All attempted executions remove temporary prompts");
await rejects(
  () => exports.knowledgeCompletion("x".repeat(24001), schema),
  /DK_CONTEXT_LIMIT/,
);
env.KNOWLEDGE_CODEX_MODEL = "model; unsafe";
await rejects(
  () => exports.knowledgeCompletion("fixture", schema),
  /DK_INVALID_MODEL/,
);
console.log(
  `PASS document knowledge Codex gateway: ${checks} checks; isolated environment, no tools, cancellation and usage`,
);
