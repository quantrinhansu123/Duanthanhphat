import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports = {};
let deniedTabs = new Set(), rpcError = null, calls = [];
const imports = {
  "next/server":{NextResponse:{json:(body,options)=>({body,status:options?.status??200})}},
  "@/lib/server/requireAccess":{requireAccess:async(tab,action)=>{assert.equal(action,"delete");return deniedTabs.has(tab)?{status:403}:null;}},
  "@/lib/supabase/admin":{createAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {error:rpcError};}})},
  "@/lib/supabase/env":{formatSupabaseError:e=>e.message},
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/app/api/certificates/route.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,URL,require:key=>{assert.ok(key in imports,key);return imports[key];}});
const id="11111111-1111-4111-8111-111111111111";
const request=(query,origin="http://localhost:3010")=>({url:`http://localhost:3010/api/certificates?${query}`,headers:{get:k=>k==="origin"?origin:null}});
assert.equal((await exports.DELETE(request(`groupId=${id}`))).status,200);
assert.equal(calls[0].args.p_nhom_id,id);
assert.equal((await exports.DELETE(request("title=Legacy"))).status,200);
for(const query of ["","id=bad","groupId=bad","title="+"a".repeat(301)]) assert.equal((await exports.DELETE(request(query))).status,400);
const before=calls.length;
assert.equal((await exports.DELETE(request(`groupId=${id}`,"https://untrusted.example"))).status,403);
deniedTabs = new Set(["chung-chi","ho-so-tho-han"]);
assert.equal((await exports.DELETE(request(`id=${id}`))).status,403);
assert.equal(calls.length,before,"Denied or malformed requests must not call the destructive RPC");
deniedTabs = new Set(["chung-chi"]);
assert.equal((await exports.DELETE(request(`groupId=${id}`))).status,403);
assert.equal((await exports.DELETE(request(`id=${id}`))).status,200,"Personnel permission allows deleting only an individual certificate");
rpcError={message:"database unavailable"};
assert.equal((await exports.DELETE(request(`id=${id}`))).status,500);
console.log("PASS certificate deletion API: permissions, individual/type scopes, CSRF, validation and error propagation");
