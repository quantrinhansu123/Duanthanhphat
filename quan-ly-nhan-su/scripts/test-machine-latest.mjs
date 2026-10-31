import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports = {};
const imports = {
  "@/data/machines":{machines:[]}, "@/lib/machineRunSchedulesDb":{HOURS_PER_WELD_SHIFT:8},
  "@/lib/weldReportData":{formatWeldWorkHours:String,weldWorkHours:()=>8}, "@lwr/lib/supabase":{supabase:null},
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/features/lwr/lib/machine-images.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,require:key=>{assert.ok(key in imports,key);return imports[key];}});
const weld = (id,machineId,date,metres,endTime,project="p") => ({id,code:id,machineId,machineCode:machineId,date,metres,endTime,project});
const rows = [
  weld("W1","m1","2026-10-29",2000,"08:00"),weld("W2","m1","2026-10-29",1000,"17:00"),
  weld("W3","m2","2026-10-29",3000,"16:00"),weld("W4","m1","2026-10-30",500,"10:00"),
  weld("W5","m1","2026-10-30",600,"18:00","q"),weld("W6","m3",null,700,"19:00"),
];
const markers = exports.buildMachineOnTrack(rows,{}, {},{W2:"TUYẾN HẠ",W3:"TUYẾN THƯỢNG",W5:"TUYẾN HẠ"});
assert.equal(markers.length,5,"Different machines on the same day must not merge into one representative");
assert.equal(markers.find(m=>m.weldCode==="W2").metres,1000,"Last worked weld can have a smaller chainage");
const latest=exports.latestMachinePositions(markers);
assert.equal(latest.length,2,"No date must not be shown as a current location");
assert.equal(latest.find(m=>m.machineId==="m1").weldCode,"W5");
assert.equal(latest.find(m=>m.machineId==="m1").line,"TUYẾN HẠ");
assert.equal(exports.latestMachinePositions(markers.filter(m=>m.date==="2026-10-29")).find(m=>m.machineId==="m1").weldCode,"W2");
console.log("PASS machine markers: latest day per machine, multiple machines/projects, reverse movement, route and date-filter handling");
