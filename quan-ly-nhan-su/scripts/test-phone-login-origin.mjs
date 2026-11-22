import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require("next/server");
const account = { phone: "0000000000", email: "fixture@example.test", status: "Hoạt động" };
let signIns = 0;
const dependencies = {
  "next/server": { NextResponse },
  "@/data/systemConfig": { initialAccounts: [], normalizePhone: (value) => value },
  "@/lib/server/privateJsonStorage": { readPrivateJson: async () => ({ accounts: [account] }) },
  "@/lib/supabase/server": { createClient: async () => ({ auth: {
    signInWithPassword: async ({ email, password }) => {
      assert.equal(email, account.email);
      assert.equal(password, "fixture");
      signIns++;
      return { error: null };
    },
  } }) },
};
const source = readFileSync(new URL("../src/app/api/auth/phone-login/route.ts", import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText, { exports, require: (id) => dependencies[id], URL, setTimeout });

async function submit(target, origin = target, site = "same-origin") {
  const request = new NextRequest(target + "/api/auth/phone-login", {
    method: "POST",
    headers: { host: new URL(target).host, origin, "sec-fetch-site": site, "content-type": "application/json" },
    body: JSON.stringify({ phone: account.phone, password: "fixture" }),
  });
  return (await exports.POST(request)).status;
}

for (const target of ["http://127.0.0.1:3010", "http://localhost:3010", "http://[::1]:3010", "https://app.example.test"]) {
  assert.equal(await submit(target), 200, target);
}
const ip = "http://127.0.0.1:3010";
for (const origin of ["http://localhost:3010", "http://127.0.0.1:3011", "https://127.0.0.1:3010", "https://other.example.test"]) {
  assert.equal(await submit(ip, origin), 403, origin);
}
assert.equal(await submit(ip, ip, "cross-site"), 403);
assert.equal(signIns, 4);
console.log("Phone login origin checks passed.");
