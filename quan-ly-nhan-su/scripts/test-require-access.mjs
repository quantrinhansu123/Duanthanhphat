import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const env = { NEXT_PUBLIC_SUPABASE_URL: "configured", NEXT_PUBLIC_SUPABASE_ANON_KEY: "configured" };
let user = { email: "test@example.com" }, authError = false, storageError = false, allowed = true, authCalls = 0;
const imports = {
  "server-only": {},
  "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  "@/data/systemConfig": { checkPermission: () => allowed, initialAccounts: [], defaultPermissions: [] },
  "@/lib/server/privateJsonStorage": { readPrivateJson: async () => { if (storageError) throw new Error("storage offline"); return null; } },
  "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => {
    authCalls++;
    if (authError) throw new Error("auth offline");
    return { data: { user } };
  } } }) },
};
const exports = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/lib/server/requireAccess.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, process: { env }, require: (name) => { assert.ok(name in imports, name); return imports[name]; } });
const context = await exports.requireAuthenticatedUser();
assert.equal(context.user, user);
assert.equal(context.denied, null);
assert.equal(authCalls, 1, "Return verified identity without a second authentication call");
assert.equal(await exports.requireAccess(null), null);
assert.equal(await exports.requireAccess("documents"), null);
allowed = false;
assert.equal((await exports.requireAccess("documents")).status, 403);
user = null;
assert.equal((await exports.requireAccess(null)).status, 401);
authError = true;
assert.equal((await exports.requireAuthenticatedUser()).denied.status, 401);
authError = false;
user = { email: "test@example.com" };
storageError = true;
assert.equal((await exports.requireAccess("documents")).status, 401);
delete env.NEXT_PUBLIC_SUPABASE_URL;
const before = authCalls;
assert.equal(await exports.requireAccess("documents"), null, "Preserve existing unconfigured-environment behavior");
assert.equal(authCalls, before);
console.log("PASS access: single verified identity, permission scopes, auth/storage failures and existing callers");
