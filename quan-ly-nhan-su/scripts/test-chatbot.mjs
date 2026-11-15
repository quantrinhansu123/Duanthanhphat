import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/components/ChatBot.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("ChatBot.tsx", source, ts.ScriptTarget.Latest, true);
assert.equal(parsed.parseDiagnostics.length, 0, "Chatbot must compile, including attachment filenames");
const states = [], refs = [];
let stateIndex, refIndex, fetchImpl;
const jsx = (type, props) => ({ type, props });
const imports = {
  react: {
    useState(initial) {
      const i = stateIndex++;
      if (!(i in states)) states[i] = initial;
      return [states[i], (value) => { states[i] = typeof value === "function" ? value(states[i]) : value; }];
    },
    useRef(initial) {
      const i = refIndex++;
      return refs[i] ??= { current: initial };
    },
    useEffect() {},
  },
  "react/jsx-runtime": { jsx, jsxs: jsx },
  "@/components/icons": { Paperclip() {}, X() {} },
  "@/components/ContractForm": { CONTRACT_FIELDS: [] },
  "@/components/ContractDocument": {},
};
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  exports, crypto, FormData, performance, AbortSignal, Error,
  fetch: (...args) => fetchImpl(...args),
  require: (name) => { assert.ok(name in imports, name); return imports[name]; },
});
function render() {
  stateIndex = refIndex = 0;
  return exports.default();
}
function find(node, predicate) {
  if (!node || typeof node !== "object") return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}
render();
states[0] = true;
states[8] = [
  { id: "codex:gpt-6-luna", provider: "codex", label: "Luna" },
  { id: "anti:gemini-3.8-flash-medium", provider: "anti", label: "Gemini 3.8 Flash (Medium)" },
];
states[9] = "codex:gpt-6-luna";
const attachment = { name: "hồ sơ.pdf", path: "test.pdf", image: false };
states[6] = [attachment];
states[2] = "Đọc hồ sơ";
let sent;
fetchImpl = async (url, options) => {
  assert.equal(url, "/api/chat");
  sent = JSON.parse(options.body);
  return { ok: false, json: async () => ({ error: "Mất kết nối" }) };
};
await find(render(), (n) => n.type === "form").props.onSubmit({ preventDefault() {} });
// The submit callback launches the async request without awaiting it.
await new Promise(setImmediate);
assert.equal(sent.messages[0].text, "Đọc hồ sơ\n📎 hồ sơ.pdf");
assert.equal(sent.attachments[0].path, attachment.path);
assert.equal(sent.modelId, "codex:gpt-6-luna");
assert.equal(states[1].length, 0, "Failed send must not duplicate the user message on retry");
assert.equal(states[2], "Đọc hồ sơ");
assert.equal(states[6][0], attachment, "Keep uploaded files for retry");
assert.equal(states[4], "Mất kết nối");

states[2] = "";
fetchImpl = async (_url, options) => {
  sent = JSON.parse(options.body);
  return { ok: true, json: async () => ({ text: "Đã đọc hồ sơ" }) };
};
find(render(), (n) => n.type === "form").props.onSubmit({ preventDefault() {} });
await new Promise(setImmediate);
assert.ok(sent.messages[0].text.startsWith("Hãy đọc tệp đính kèm"), "Allow sending files without a typed question");
assert.equal(states[1].length, 2);
assert.equal(states[6].length, 0);
assert.equal(states[1][1].modelLabel, "Luna");
assert.ok(states[1][1].elapsedMs >= 0, "Measure client-observed response time");

const sessionRef = refs.find(ref=>ref.current===sent.sessionId);
assert.ok(sessionRef,'Find actual conversation ID sent to backend');
const previousSession = sessionRef.current;
const previousMessages = states[1];
find(render(), (n) => n.type === "select").props.onChange({ target: { value: "anti:gemini-3.8-flash-medium" } });
assert.notEqual(sessionRef.current, previousSession, "Isolate CLI context when switching model");
assert.equal(states[1], previousMessages, "Keep visible history for comparison");

const question = find(render(), (n) => n.type === "textarea");
assert.ok(question, "Question input must support multiple lines");
let shortcutSubmits = 0, prevented = 0;
const keyEvent = {
  key: "Enter", shiftKey: false,
  nativeEvent: { isComposing: false },
  preventDefault() { prevented++; },
  currentTarget: { form: { requestSubmit() { shortcutSubmits++; } } },
};
question.props.onKeyDown({ ...keyEvent, shiftKey: true });
assert.equal(prevented, 0, "Shift+Enter must insert a newline");
assert.equal(shortcutSubmits, 0, "Shift+Enter must not submit");
question.props.onKeyDown(keyEvent);
assert.equal(prevented, 1, "Enter must prevent inserting a newline");
assert.equal(shortcutSubmits, 1, "Enter submits");
question.props.onKeyDown({ ...keyEvent, nativeEvent: { isComposing: true } });
assert.equal(shortcutSubmits, 1, "Do not submit while composing text");
question.props.onChange({ target: { value: "Dòng một\nDòng hai" } });
find(render(), (n) => n.type === "form").props.onSubmit({ preventDefault() {} });
await new Promise(setImmediate);
assert.equal(sent.messages.at(-1).text, "Dòng một\nDòng hai", "Preserve newlines in the API request");
assert.equal(sent.modelId, "anti:gemini-3.8-flash-medium");
assert.equal(states[1].at(-1).modelLabel, "Gemini 3.8 Flash (Medium)");

states[7] = true;
const tree = render();
assert.equal(find(tree, (n) => n.type === "button" && n.props.children === "Chat mới").props.disabled, true);
assert.equal(find(tree, (n) => n.props?.["aria-label"] === "Đính kèm tệp").props.disabled, true);
assert.equal(find(tree, (n) => n.type === "select").props.disabled, true, "Cannot switch providers during upload");
fetchImpl = () => { assert.fail("Cannot start a second upload while uploading"); };
await find(tree, (n) => n.type === "input" && n.props.type === "file").props.onChange({ target: { files: [new File(["test"], "test.txt")] } });
states[7] = false;
states[2] = "Giữ câu hỏi khi quá giờ";
states[6] = [attachment];
fetchImpl = async (_url, options) => {
  assert.ok(options.signal instanceof AbortSignal, "Bound the browser's wait time");
  const error = new Error("timeout"); error.name = "TimeoutError"; throw error;
};
find(render(), (n) => n.type === "form").props.onSubmit({ preventDefault() {} });
await new Promise(setImmediate);
assert.equal(states[2], "Giữ câu hỏi khi quá giờ");
assert.equal(states[6][0], attachment);
assert.equal(states[3], false, "Timeout must leave the composer usable");
assert.ok(states[4].includes("2 phút"));
states[11]=[{id:'11111111-1111-4111-8111-111111111111',name:'Hồ sơ bên A'}];
const scopeSelector=find(render(),n=>n.type==='select'&&n.props['aria-label']==='Chọn kho hồ sơ để tra cứu');
scopeSelector.props.onChange({target:{value:states[11][0].id}});
assert.equal(states[1].length,0,'Switching projects clears previous document context');
assert.equal(states[6].length,0,'Switching projects clears pending files');
fetchImpl=async(url,options)=>{assert.equal(url,'/api/chat/upload');assert.equal(options.body.get('provider'),'codex','Project upload ignores unrelated general-chat provider');return {ok:true,json:async()=>({name:'test.pdf',path:'fixture-upload.pdf',image:false})};};
await find(render(),n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:[new File(['fixture'],'test.pdf')]}});
await new Promise(setImmediate);
assert.equal(states[6].length,1);states[6]=[];
states[2]='Tổng giá trị nghiệm thu';
fetchImpl=async(_url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({text:'Số liệu đã xác minh',modelLabel:'Kho hồ sơ · SQL',citations:[{documentId:'22222222-2222-4222-8222-222222222222',page:2,title:'Hồ sơ.pdf',revision:1}]})};};
find(render(),n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(setImmediate);
assert.equal(sent.knowledgeProjectId,states[11][0].id,'Explicit project selected on server');
assert.equal(sent.messages.length,1,'No history from previous project sent');
assert.ok(find(render(),n=>n.type==='a'&&n.props.href?.includes('/api/document-knowledge/source?id=')),'Citations use authenticated source endpoint');
assert.equal(find(render(),n=>n.type==='select').props.disabled,true,'Project chat uses configured knowledge model');
console.log("PASS chatbot: attachments, retries, upload guards, multiline messages and keyboard shortcuts");
