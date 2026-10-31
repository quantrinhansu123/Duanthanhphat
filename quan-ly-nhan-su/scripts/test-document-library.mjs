import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";
import * as jsxRuntime from "react/jsx-runtime";

function load(path, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, URL, Buffer, crypto, console, ...globals, require: (id) => {
    assert.ok(id in imports, `Missing mock: ${id}`);
    return imports[id];
  } });
  return exports;
}

let folders = ["Dự án", "Dự án/A", "Dự án/A/Con", "Dự án/B", "Dự án khác"];
let documents = [
  { id: "a", appProperties: { thu_muc: "Dự án/A" } },
  { id: "b", appProperties: { thu_muc: "Dự án/A/Con" } },
  { id: "keep", appProperties: { thu_muc: "Dự án/B" } },
];
let failDelete = false;
let denied = null;
const folderRoute = load("../src/app/api/document-folders/route.ts", {
  "next/server": { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } },
  "@/lib/server/requireAccess": { requireAccess: async () => denied },
  "@/lib/server/privateJsonStorage": {
    readPrivateJson: async () => [...folders], writePrivateJson: async (_, value) => { folders = value; },
  },
  "@/lib/supabase/env": { formatSupabaseError: (e) => e.message },
  "@/lib/documentStorage": {
    listStoredDocuments: async () => documents,
    updateStoredDocument: async () => {},
    deleteStoredDocument: async (id) => {
      if (failDelete) throw new Error("Không xóa được tệp");
      documents = documents.filter((doc) => doc.id !== id);
    },
  },
});
const createFolder = (name, parent) => folderRoute.POST({ json: async () => ({ name, parent }) });
assert.equal((await createFolder("C", "Dự án")).status, 200);
assert.equal((await createFolder("D", "Dự án")).status, 200);
assert.equal((await createFolder("C", "Dự án/A")).status, 200, "Same name allowed under a different parent");
assert.equal((await createFolder("c", "Dự án")).status, 409);
assert.equal((await createFolder("bad/name", "Dự án")).status, 400);
const removeFolder = () => folderRoute.DELETE({ url: "https://test/api/document-folders?path=" + encodeURIComponent("Dự án/A") });
failDelete = true;
assert.equal((await removeFolder()).status, 500);
assert.ok(folders.includes("Dự án/A/Con"), "Keep folder tree if deleting a document fails");
failDelete = false;
assert.equal((await removeFolder()).status, 200);
assert.ok(!folders.some((f) => f.startsWith("Dự án/A")));
assert.equal(documents.length, 1);
assert.equal(documents[0].id, "keep", "Sibling documents survive recursive deletion");
denied = { status: 403 };
assert.equal((await removeFolder()).status, 403);
console.log("PASS folders: multiple siblings, nested folders, duplicates, recursive deletion, failure handling and permissions");

const rows = new Map();
const objects = new Map();
let failWrite = false;
const bucket = {
  getPublicUrl: (path) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
  createSignedUploadUrl: async (path) => ({ data: { signedUrl: `https://storage.test/upload/${path}` } }),
  info: async (path) => objects.has(path) ? { data: objects.get(path) } : { error: { message: "not found" } },
  remove: async (paths) => { paths.forEach((p) => objects.delete(p)); return {}; },
};
const client = {
  storage: { from: () => bucket, getBucket: async () => ({ data: {} }) },
  from() {
    let id, action, payload;
    const query = {
      select() { return query; },
      eq(_, value) { id = value; return query; },
      insert(value) { payload = value; action = "insert"; return query; },
      update(value) { payload = value; action = "update"; return query; },
      maybeSingle: async () => ({ data: rows.get(id) || null }),
      single: async () => {
        if (action === "insert") {
          if (failWrite) return { error: { message: "Database unavailable" } };
          rows.set(payload.id, { ...payload, created_at: "2026-10-31T00:00:00Z", updated_at: "2026-10-31T00:00:00Z" });
          return { data: rows.get(payload.id) };
        }
        return { data: rows.get(id) || null };
      },
      then(resolve, reject) {
        if (failWrite) return Promise.resolve({ error: { message: "Database unavailable" } }).then(resolve, reject);
        if (action === "update") rows.set(id, { ...rows.get(id), ...payload });
        return Promise.resolve({}).then(resolve, reject);
      },
    };
    return query;
  },
};
const storage = load("../src/lib/documentStorage.ts", {
  "node:crypto": crypto,
  "@/lib/supabase/admin": { createAdminClient: () => client },
  "@/lib/supabase/env": { formatSupabaseError: (e) => e?.message || "Unknown error", isSupabaseConfigured: () => true },
}, { process: { env: { SUPABASE_SERVICE_ROLE_KEY: "unit-test-only-secret" } } });
const input = { name: "Biện pháp.pdf", description: "", size: 16 * 1024 * 1024, appProperties: { thu_muc: "Dự án/B" } };
await assert.rejects(storage.prepareDocumentUpload({ ...input, size: 51 * 1024 * 1024 }), /50 MB/);
await assert.rejects(storage.prepareDocumentUpload({ ...input, size: 0 }), /50 MB/);
const session = await storage.prepareDocumentUpload(input);
const ticket = JSON.parse(Buffer.from(session.ticket.split(".")[0], "base64url"));
const expiredPayload = Buffer.from(JSON.stringify({ ...ticket, expires: 0 })).toString("base64url");
const expiredReceipt = `${expiredPayload}.${crypto.createHmac("sha256", "unit-test-only-secret").update(expiredPayload).digest("base64url")}`;
await assert.rejects(storage.completeDocumentUpload(expiredReceipt), /hết hạn/);
await assert.rejects(storage.completeDocumentUpload(session.ticket + "tampered"), /không hợp lệ/);
await assert.rejects(storage.completeDocumentUpload(session.ticket), /chưa tải lên/);
objects.set(ticket.path, { size: input.size, contentType: "application/pdf" });
const item = await storage.completeDocumentUpload(session.ticket);
assert.equal(item.size, input.size);
assert.equal(item.appProperties.thu_muc, "Dự án/B");
assert.equal((await storage.completeDocumentUpload(session.ticket)).id, item.id, "Retry must not create duplicates");
const replacement = await storage.prepareDocumentUpload({ ...input, size: 20, replaceId: item.id });
const replacementTicket = JSON.parse(Buffer.from(replacement.ticket.split(".")[0], "base64url"));
objects.set(replacementTicket.path, { size: 20, contentType: "application/pdf" });
failWrite = true;
await assert.rejects(storage.completeDocumentUpload(replacement.ticket), /Database unavailable/);
assert.equal(rows.get(item.id).file_path, ticket.path);
assert.ok(objects.has(ticket.path), "Failed replacement must preserve old PDF");
failWrite = false;
objects.set(replacementTicket.path, { size: 20, contentType: "application/pdf" });
const replaced = await storage.completeDocumentUpload(replacement.ticket);
assert.equal(replaced.id, item.id, "Replacement keeps document links");
assert.equal(replaced.appProperties.thu_muc, "Dự án/B");
assert.ok(!objects.has(ticket.path));
const wrong = await storage.prepareDocumentUpload(input);
const wrongTicket = JSON.parse(Buffer.from(wrong.ticket.split(".")[0], "base64url"));
objects.set(wrongTicket.path, { size: 1, contentType: "application/pdf" });
await assert.rejects(storage.completeDocumentUpload(wrong.ticket), /không đúng/);
assert.ok(!objects.has(wrongTicket.path));
console.log("PASS PDF storage: 16 MB upload, signed ticket integrity, size validation, retry, safe replacement and folder metadata");

denied = null;
const uploadRoute = load("../src/app/api/documents/upload-session/route.ts", {
  "next/server": { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } },
  "@/lib/documentStorage": storage,
  "@/lib/server/requireAccess": { requireAccess: async () => denied },
}, { console: { ...console, error() {} } });
const uploadRequest = (body) => uploadRoute.POST({ json: async () => body });
assert.equal((await uploadRequest({ action: "prepare", name: "a.pdf", mimeType: "text/plain", size: 5 })).status, 400);
assert.equal((await uploadRequest({ action: "prepare", name: "a.pdf", mimeType: "application/pdf", size: 51 * 1024 * 1024 })).status, 400);
assert.equal((await uploadRequest({ action: "complete", ticket: "invalid" })).status, 400);
denied = { status: 403 };
assert.equal((await uploadRequest({ action: "complete", ticket: session.ticket })).status, 403);
console.log("PASS upload API: validates PDF, size, expiry, signed receipt and edit permission");

let fetchCalls = [], uploadCalls = [];
const browserClient = load("../src/lib/driveDocumentsClient.ts", {}, {
  fetch: async (url, options) => {
    const body = JSON.parse(options.body);
    fetchCalls.push({ url, body });
    return { ok: true, status: 200, json: async () => body.action === "prepare" ? session : { item } };
  },
  XMLHttpRequest: class {
    upload = {};
    status = 200;
    open(method, url) { uploadCalls.push({ method, url }); }
    setRequestHeader() {}
    send(file) { assert.equal(file.name, "Tên gốc.pdf"); this.onload(); }
  },
});
const result = await browserClient.uploadDocumentToDrive({ name: "Tên gốc.pdf", size: input.size, type: "application/pdf" }, "", "", undefined, input.appProperties);
assert.equal(result.success, true);
assert.equal(fetchCalls[0].body.name, "Tên gốc.pdf");
assert.equal(fetchCalls[0].body.appProperties.thu_muc, "Dự án/B");
assert.equal(uploadCalls[0].method, "PUT");
assert.equal(uploadCalls[0].url, session.uploadUrl);
assert.equal(fetchCalls[1].body.action, "complete");
assert.ok(fetchCalls.every((call) => !call.body.file), "File bytes must bypass Next/Vercel request bodies");
console.log("PASS PDF client: optional title falls back to filename; direct upload bypasses Vercel body limit");

const uiDocuments = [
  { id: "direct", name: "Tài liệu trực tiếp", createdTime: "2026-10-31", size: 10, appProperties: { thu_muc: "Dự án" } },
  { id: "nested", name: "Tài liệu trong thư mục A", createdTime: "2026-10-31", size: 10, appProperties: { thu_muc: "Dự án/A" } },
];
let uiFolders = ["Dự án", "Dự án/A", "Dự án/B"];
let stateIndex = 0, mounted = false;
const state = [], effects = [], listeners = {};
const uiWindow = {
  location: { href: "http://localhost:3010/tai-lieu" },
  addEventListener: (name, callback) => { listeners[name] = callback; }, removeEventListener() {},
  history: {
    entries: ["http://localhost:3010/tai-lieu"],
    state: null,
    pushState(value, __, url) { this.state = value; this.entries.push(String(url)); uiWindow.location.href = String(url); },
    back() { this.entries.pop(); uiWindow.location.href = this.entries.at(-1); listeners.popstate(); },
  },
};
class Element { constructor(editable) { this.editable = editable; } closest() { return this.editable; } }
function useState(initial) {
  const index = stateIndex++;
  if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
  return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
}
const component = load("../src/components/DocumentLibrary.tsx", {
  react: { useState, useRef: (current) => useState({ current })[0], useEffect: (callback) => { if (!mounted) effects.push(callback); }, useMemo: (f) => f(), useCallback: (f) => f },
  "react/jsx-runtime": jsxRuntime,
  "@/components/icons": { X: () => null },
  "@/i18n/LanguageProvider": { useLanguage: () => ({ lang: "vi", t: (s) => s }) },
  "@/lib/driveDocumentsClient": {
    fetchDriveDocuments: async () => ({ configured: true, items: uiDocuments }),
    fetchDocumentFolders: async () => ({ folders: uiFolders }),
    createDocumentFolder: async (name, parent) => {
      const created = `${parent}/${name}`;
      uiFolders = [...uiFolders, created];
      return { folders: uiFolders, created };
    },
  },
}, { window: uiWindow, HTMLElement: Element });
const render = () => { stateIndex = 0; return component.default(); };
function nodes(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const text = (tree) => typeof tree === "string" || typeof tree === "number" ? String(tree)
  : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : "";
const button = (tree, label) => {
  const found = nodes(tree, (node) => node.type === "button" && text(node) === label);
  assert.equal(found.length, 1, `Expected one button: ${label}`);
  return found[0];
};
render();
mounted = true;
effects.forEach((effect) => effect());
await new Promise(setImmediate);
let tree = render();
assert.ok(!text(tree).includes("Tài liệu trực tiếp"), "Root shows folders, not all descendant documents");
button(tree, "📁 Dự án").props.onClick();
tree = render();
assert.ok(text(tree).includes("Tài liệu trực tiếp"));
assert.ok(!text(tree).includes("Tài liệu trong thư mục A"), "Do not flatten descendant documents into parent folder");
button(tree, "+ Tạo thư mục con").props.onClick();
tree = render();
nodes(tree, (node) => node.type === "input" && node.props.placeholder === "Tên thư mục con")[0].props.onChange({ target: { value: "C" } });
tree = render();
await nodes(tree, (node) => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
tree = render();
assert.equal(new URL(uiWindow.location.href).searchParams.get("thu-muc"), "Dự án", "Creating a child stays in parent for adding siblings");
assert.ok(button(tree, "📁 C"));
button(tree, "📁 A").props.onClick();
tree = render();
assert.ok(text(tree).includes("Tài liệu trong thư mục A"));
let prevented = false;
listeners.keydown({ key: "Backspace", target: new Element(true), preventDefault() { prevented = true; } });
assert.equal(prevented, false, "Backspace in a text field edits text");
listeners.keydown({ key: "Backspace", target: new Element(false), preventDefault() { prevented = true; } });
assert.equal(prevented, true);
assert.equal(new URL(uiWindow.location.href).searchParams.get("thu-muc"), "Dự án");
uiWindow.location.href = "http://localhost:3010/tai-lieu?thu-muc=" + encodeURIComponent("Dự án/A");
uiWindow.history.state = null;
listeners.popstate();
listeners.keydown({ key: "Backspace", target: new Element(false), preventDefault() {} });
assert.equal(new URL(uiWindow.location.href).searchParams.get("thu-muc"), "Dự án", "A directly opened folder goes to its parent instead of leaving the document library");
tree = render();
button(tree, "Tải PDF lên").props.onClick();
tree = render();
assert.equal(nodes(tree, (node) => node.type === "input" && node.props.placeholder === "Để trống để dùng tên tệp PDF")[0].props.required, undefined);
assert.ok(text(tree).includes("Chọn tệp"));
assert.ok(!text(tree).includes("bucket"));
console.log("PASS UI behavior: folder levels, multiple siblings, Backspace history, editable fields, optional title and Vietnamese labels");

if (process.argv.includes("--live")) {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const realStorage = load("../src/lib/documentStorage.ts", {
    "node:crypto": crypto,
    "@/lib/supabase/admin": { createAdminClient: () => admin },
    "@/lib/supabase/env": { formatSupabaseError: (e) => e?.message || "Unknown error", isSupabaseConfigured: () => true },
  }, { process });
  const paths = [];
  let createdId;
  try {
    const bytes = Buffer.alloc(16 * 1024 * 1024, 32);
    bytes.write("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n");
    bytes.write("\ntrailer<</Root 1 0 R>>\n%%EOF\n", bytes.length - 34);
    const liveSession = await realStorage.prepareDocumentUpload({
      ...input, name: "__KIEM_TRA_TAI_LIEU_TU_DONG__.pdf", appProperties: { source: "document-library-test" },
    });
    const liveTicket = JSON.parse(Buffer.from(liveSession.ticket.split(".")[0], "base64url"));
    paths.push(liveTicket.path);
    const uploaded = await fetch(liveSession.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: bytes });
    assert.ok(uploaded.ok, `Storage upload failed: ${uploaded.status} ${await uploaded.text()}`);
    const liveItem = await realStorage.completeDocumentUpload(liveSession.ticket);
    createdId = liveItem.id;
    assert.equal(liveItem.size, bytes.length);
    const downloaded = await realStorage.getStoredDocumentBuffer(createdId);
    assert.equal(downloaded.buffer.length, bytes.length);
    assert.equal(crypto.createHash("sha256").update(downloaded.buffer).digest("hex"), crypto.createHash("sha256").update(bytes).digest("hex"));
    const cors = await fetch(liveSession.uploadUrl, { method: "OPTIONS", headers: {
      Origin: "https://duanthanhphatfull-three.vercel.app", "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type",
    } });
    assert.ok(cors.ok);
    assert.ok(["*", "https://duanthanhphatfull-three.vercel.app"].includes(cors.headers.get("access-control-allow-origin")));
    console.log("PASS LIVE: direct signed upload of 16 MB PDF, metadata saved, download checksum matches, browser CORS allowed");
  } finally {
    if (createdId) await realStorage.deleteStoredDocument(createdId);
    if (paths.length) {
      const removed = await admin.storage.from("tai-lieu").remove(paths);
      assert.equal(removed.error, null);
    }
    if (createdId) {
      const remaining = await admin.from("tai_lieu").select("id").eq("id", createdId).maybeSingle();
      assert.equal(remaining.error, null);
      assert.equal(remaining.data, null);
    }
    console.log("PASS LIVE cleanup: temporary PDF and document record removed");
  }
}
