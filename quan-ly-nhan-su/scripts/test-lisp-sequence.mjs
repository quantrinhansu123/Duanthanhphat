import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(name, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: (key) => { assert.ok(key in imports, key); return imports[key]; } });
  return exports;
}
const { pairedLispSequence, nextLispCode } = load("lispSequence", { "@/lib/weldCode": load("weldCode") });

// Mảng tạo trong vm có prototype khác → chuẩn hoá qua JSON trước khi so sánh.
const seq = (...args) => JSON.parse(JSON.stringify(pairedLispSequence(...args)));

// Hai mã đầu (ray trái HT0168, ray phải HP0170) → xen kẽ, mỗi ray chạy liên tục.
assert.deepEqual(seq("HT0168", "HP0170", 6), ["HT0168", "HP0170", "HT0169", "HP0171", "HT0170", "HP0172"]);
assert.deepEqual(seq("HT0168", "HP0170", 3), ["HT0168", "HP0170", "HT0169"]);
assert.deepEqual(seq("TT0009", "TP0009", 2), ["TT0009", "TP0009"]);
// Hai mã không phải cặp ray của cùng tuyến → không sinh.
assert.deepEqual(seq("HT0168", "TP0170", 4), []);
assert.deepEqual(seq("HT0168", "HT0170", 4), []);
assert.deepEqual(seq("abc", "HP0170", 4), []);

// Mối kế tiếp trong ngày.
assert.equal(nextLispCode([]), null);
assert.equal(nextLispCode(["HT0168"]), null, "ray phải chưa có mối → cần nhập tay mối đầu của ray phải");
assert.equal(nextLispCode(["HT0168", "HP0170"]), "HT0169");
assert.equal(nextLispCode(["HT0168", "HP0170", "HT0169"]), "HP0171");
assert.equal(nextLispCode(["HT0168", "HP0170", "HT0169", "HP0171"]), "HT0170");
// Hàn phải trước: HP0170 rồi HT0168 → HP0171 (phải cũng chạy liên tục độc lập).
assert.equal(nextLispCode(["HP0170", "HT0168"]), "HT0169");
// Giữ độ rộng số (4 chữ số) và bỏ qua mã không hợp lệ.
assert.equal(nextLispCode(["junk", "HT0009", "HP0011"]), "HT0010");
console.log("lisp sequence OK");
