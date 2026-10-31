import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(name, imports) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {exports, require: key => {assert.ok(key in imports, key); return imports[key];}});
  return exports;
}
const rules = load("weldAcceptance", {});
const range = {nameFrom: "W2", nameTo: "W10", kmFrom: "", kmTo: ""};
rules.validateMonitoringRange(range);
rules.validateMonitoringRange({...range, kmFrom:"Km0+000",kmTo:"Km1+250"});
rules.validateMonitoringRange({...range,nameFrom:"",nameTo:"",kmFrom:"0+000",kmTo:"1+000"});
for (const invalid of [
  {...range,nameFrom:"",nameTo:""}, {...range,nameTo:""}, {...range,nameFrom:"W20"},
  {...range,kmFrom:"0+000"}, {...range,kmFrom:"bad",kmTo:"1+000"}, {...range,kmFrom:"2+000",kmTo:"1+000"},
]) assert.throws(()=>rules.validateMonitoringRange(invalid));

const records = new Map();
let acceptanceCalls = 0, inserts = 0;
const db = {from(table) {
  assert.equal(table,"phieu_yeu_cau_nghiem_thu","Monitoring must not query eligibility or link acceptance welds");
  const q = {
    async insert(row) {
      inserts++;
      if (records.has(row.id) || [...records.values()].some(r=>r.so_phieu===row.so_phieu)) return {error:{code:"23505"}};
      records.set(row.id,structuredClone(row)); return {error:null};
    },
    select() {return q;}, eq(_,id) {q.id=id;return q;}, async single(){return {data:records.get(q.id),error:null};},
  };return q;
}};
const server = load("server/weldAcceptanceServer", {
  "server-only":{}, "@/lib/supabase/admin":{createAdminClient:()=>db},
  "@/lib/server/weldQualityAuth":{QualityApiError:Error},
  "@/lib/server/weldQualityJournal":{object:v=>v,qualityUuid:v=>v,qualityDate:v=>v},
  "@/lib/server/weldQualityDb":{publishWeldRfi:async()=>{acceptanceCalls++;return "acceptance";}},
  "@/lib/weldAcceptance":rules, "@/lib/constructionDiaryAuto":{}, "@/lib/server/projectEquipment":{},
  "@/lib/projectEquipment":{}, "@/lib/server/privateJsonStorage":{}, "@lwr/lib/track-editor":{},
});
const input = {id:"one",du_an_id:"project",so_phieu:"RFI-001",ngay_moi:"2026-10-31",loai_rfi:"theo-doi",filters:range,thong_tin:{pham_vi:"Hàn ray",loai_rfi:"nghiem-thu"}};
await server.publishRfi(input,"admin@example.com");
assert.equal(records.get("one").thong_tin.loai_rfi,"theo-doi");
assert.equal(records.get("one").thong_tin.nameTo,"W10");
await server.publishRfi(input,"admin@example.com");
assert.equal(records.size,1,"Retry must not create a duplicate RFI");
await assert.rejects(()=>server.publishRfi({...input,so_phieu:"CHANGED"},"admin@example.com"));
await assert.rejects(()=>server.publishRfi({...input,id:"two"},"admin@example.com"));
const before = inserts;
await assert.rejects(()=>server.publishRfi({...input,filters:{...range,nameTo:""}},"admin@example.com"));
assert.equal(inserts,before,"Invalid range must fail before writing");
assert.equal(acceptanceCalls,0);
await server.publishRfi({...input,id:"accept",loai_rfi:"nghiem-thu",moi_han_ids:["weld"]},"admin@example.com");
assert.equal(acceptanceCalls,1,"Acceptance RFI retains its existing eligibility RPC");
console.log("PASS monitoring RFI: name/Km ranges, validation, separate workflow, idempotency and acceptance regression");
