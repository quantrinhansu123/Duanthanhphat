import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, dependencies, env) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, Buffer, URL, Error, process: { env }, require: (id) => {
    if (id in dependencies) return dependencies[id];
    if (id === "server-only") return {};
    return require(id);
  } });
  return exports;
}
// Admin client giả: token "good" thuộc a@x.vn (được phép), "stranger" thuộc b@x.vn (không có trong danh sách).
const users = { good: "A@X.vn", stranger: "b@x.vn" };
const allowed = new Set(["a@x.vn"]);
const admin = { createAdminClient: () => ({
  auth: { getUser: async (token) => (users[token] ? { data: { user: { email: users[token] } }, error: null } : { data: { user: null }, error: new Error("bad") }) },
  from: () => ({ select: () => ({ eq: (_c, email) => ({ maybeSingle: async () => ({ data: allowed.has(email) ? { email } : null, error: null }) }) }) }),
}) };
const run = (env, headers = {}, method = "GET") => load("../src/lib/server/weldQualityAuth.ts", { "@/lib/supabase/admin": admin }, env)
  .authenticateWeldQuality(new Request("https://app.test/api/weld-quality", { method, headers }));
const status = (p) => p.then(() => null, (e) => e.status);

assert.equal(await run({}, { "x-supabase-token": "good" }), "a@x.vn", "email chữ thường làm người ghi nhận");
assert.equal(await status(run({}, { "x-supabase-token": "stranger" })), 403, "đăng nhập đúng nhưng không có trong danh sách");
assert.equal(await status(run({}, { "x-supabase-token": "bad" })), 401, "token sai");
assert.equal(await status(run({})), 401, "không token, không Basic Auth");
assert.equal(await status(run({}, { "x-supabase-token": "good", origin: "https://evil.test", "content-type": "application/json" }, "POST")), 403, "chặn website khác");
assert.equal(await status(run({}, { "x-supabase-token": "good", "content-type": "text/plain" }, "POST")), 415);
assert.equal(await run({}, { "x-supabase-token": "good", "content-type": "application/json" }, "POST"), "a@x.vn");
const basic = `Basic ${Buffer.from("u:p").toString("base64")}`;
assert.equal(await run({ APP_BASIC_AUTH_USER: "u", APP_BASIC_AUTH_PASSWORD: "p" }, { authorization: basic }), "u", "Basic Auth cũ vẫn dùng được");
console.log("PASS: Supabase login token + allowlist (401/403), origin/content-type guards, Basic Auth fallback");
