import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
const code = ts.transpileModule(fs.readFileSync(new URL("../src/lib/resourceCache.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInNewContext(code, { exports, Date, Map, Set, Promise, Error, String, setTimeout });
const { loadResource, getResource, mutateResource, subscribe, isFresh, clearResources } = exports;

// 1. Hai lần gọi cùng key → chỉ 1 request (dedupe)
let calls = 0;
const fetcher = async () => (calls++, ["a", "b"]);
await Promise.all([loadResource("k", fetcher), loadResource("k", fetcher)]);
assert.equal(calls, 1);
assert.deepEqual(getResource("k").data, ["a", "b"]);
assert.ok(isFresh("k", 1000));

// 2. mutate sửa tại chỗ và báo cho subscriber
let notified = 0;
const off = subscribe("k", () => notified++);
mutateResource("k", (cur) => [...cur, "c"]);
assert.deepEqual(getResource("k").data, ["a", "b", "c"]);
assert.equal(notified, 1);
off();

// 3. Làm mới ngầm: có dữ liệu cũ → refreshing, không loading
const p = loadResource("k", async () => ["x"]);
assert.equal(getResource("k").refreshing, true);
assert.equal(getResource("k").loading, false);
await p;
assert.deepEqual(getResource("k").data, ["x"]);

// 4. Lỗi giữ dữ liệu cũ
await loadResource("k", async () => { throw new Error("mất mạng"); }, []);
assert.deepEqual(getResource("k").data, ["x"]);
assert.equal(getResource("k").error, "mất mạng");

// 5. Lỗi lần đầu: không có dữ liệu, có error; sau đó tải lại được
await loadResource("new", async () => { throw new Error("lỗi"); }, []);
assert.equal(getResource("new").data, undefined);
assert.equal(getResource("new").error, "lỗi");
await loadResource("new", async () => 1);
assert.equal(getResource("new").data, 1);
assert.equal(getResource("new").error, "");

// 5b. Lỗi tạm thời → thử lại rồi thành công; lỗi kéo dài → dừng đúng số lần thử
let tries = 0;
await loadResource("retry", async () => { if (++tries < 3) throw new Error("tạm thời"); return "ok"; }, [1, 1]);
assert.equal(tries, 3);
assert.equal(getResource("retry").data, "ok");
let always = 0;
await loadResource("dead", async () => { always++; throw new Error("chết"); }, [1, 1]);
assert.equal(always, 3);
assert.equal(getResource("dead").error, "chết");

// 6. mutate khi chưa có dữ liệu → bỏ qua; clear xóa sạch
mutateResource("none", () => { throw new Error("không được gọi"); });
clearResources();
assert.equal(getResource("k").data, undefined);

console.log("resourceCache: OK");
