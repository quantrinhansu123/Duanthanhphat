import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../src/lib/server/antiResponse.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports });
const parse = (value) => exports.parseAntiResponse(JSON.stringify(value));
assert.equal(parse({ action: "message", text: "Xin chào" }).text, "Xin chào");
assert.equal(exports.parseAntiResponse('```json\n{"action":"message","text":"Xin chào"}\n```\nconfidence: high').text, "Xin chào", "Accept valid structured data followed by a CLI footer");
assert.equal(parse({ action: "contract_form", text: "Bổ sung thông tin" }).action, "contract_form");
const fields = exports.ANTI_RESPONSE_SCHEMA.properties.data.required;
const data = Object.fromEntries(fields.map((key) => [key, ""]));
data.bTen = "Nguyễn Văn Huy";
assert.equal(parse({ action: "contract_form", text: "Kiểm tra hợp đồng", data }).data.bTen, "Nguyễn Văn Huy");
for (const invalid of [null, { action: "unknown", text: "hi" }, { action: "message", text: "" }, { action: "contract_form", text: "hi", data: { bTen: "Partial" } }]) {
  assert.throws(() => parse(invalid));
}
assert.throws(() => exports.parseAntiResponse("not JSON"));
console.log("PASS Anti output: chat, blank form, complete contract and malformed response validation");
