import "server-only";

import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";

/** Thư mục tri thức ở workspace gốc (cạnh quan-ly-nhan-su). */
export function knowledgeRootDir() {
  if (process.env.KNOWLEDGE_ROOT?.trim()) return resolve(process.env.KNOWLEDGE_ROOT.trim());
  return resolve(process.cwd(), "..", "Tri thức");
}

export const KNOWLEDGE_MAX_BYTES = 50 * 1024 * 1024;

export type KnowledgeFileItem = {
  name: string;
  size: number;
  modifiedAt: string;
  ext: string;
};

function sanitizeFileName(name: string) {
  const base = basename(name).replace(/[^\w.\-() \[\]À-ỹ]+/gi, "_").trim();
  return (base || "tep").slice(-180);
}

function underRoot(root: string, full: string) {
  const rel = relative(root, full);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** Chuẩn hóa path từ chat/markdown (bỏ <> , file:// , dấu ngoặc). */
export function normalizeKnowledgeInput(input: string) {
  return input
    .trim()
    .replace(/^<|>$/g, "")
    .replace(/^["']|["']$/g, "")
    .replace(/^file:\/\/\//i, "")
    .replace(/^file:\/\//i, "");
}

/** Chỉ cho phép tệp nằm đúng trong thư mục Tri thức (chặn path traversal) — upload gốc. */
export function resolveKnowledgePath(name: string) {
  const safe = sanitizeFileName(name);
  const root = knowledgeRootDir();
  const full = resolve(root, safe);
  if (!underRoot(root, full)) throw new Error("Đường dẫn tệp không hợp lệ.");
  return { root, name: safe, path: full, relative: safe };
}

/**
 * Cho phép đường dẫn tuyệt đối hoặc tương đối trong Tri thức (kể cả thư mục con).
 * Dùng cho tải về từ chat / File tri thức.
 */
export function resolveKnowledgeAccessPath(input: string) {
  const root = knowledgeRootDir();
  const raw = normalizeKnowledgeInput(input);
  if (!raw) throw new Error("Thiếu đường dẫn tệp.");

  const full = isAbsolute(raw) || /^[a-zA-Z]:[\\/]/.test(raw) ? resolve(raw) : resolve(root, raw);
  if (!underRoot(root, full)) {
    throw new Error("Tệp không nằm trong thư mục Tri thức.");
  }

  const rel = relative(root, full).split(sep).join("/");
  return { root, path: full, name: basename(full), relative: rel };
}

export async function ensureKnowledgeRoot() {
  const root = knowledgeRootDir();
  await mkdir(root, { recursive: true });
  return root;
}

export async function listKnowledgeFiles(): Promise<KnowledgeFileItem[]> {
  const root = await ensureKnowledgeRoot();
  const entries = await readdir(root, { withFileTypes: true });
  const items: KnowledgeFileItem[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
    const full = join(root, entry.name);
    const info = await stat(full);
    items.push({
      name: entry.name,
      size: info.size,
      modifiedAt: info.mtime.toISOString(),
      ext: extname(entry.name).replace(/^\./, "").toLowerCase(),
    });
  }
  items.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return items;
}

export async function saveKnowledgeFile(file: File) {
  if (!file?.size) throw new Error("Không nhận được tệp.");
  if (file.size > KNOWLEDGE_MAX_BYTES) throw new Error("Tệp quá lớn (tối đa 50 MB).");

  const { root, name, path } = resolveKnowledgePath(file.name);
  await mkdir(root, { recursive: true });

  let finalName = name;
  let finalPath = path;
  try {
    await stat(finalPath);
    const stem = name.slice(0, Math.max(0, name.length - extname(name).length)) || "tep";
    const ext = extname(name);
    finalName = `${stem}-${Date.now()}${ext}`;
    finalPath = resolveKnowledgePath(finalName).path;
  } catch {
    // chưa tồn tại → dùng tên gốc
  }

  await writeFile(finalPath, Buffer.from(await file.arrayBuffer()));
  const info = await stat(finalPath);
  return {
    name: finalName,
    size: info.size,
    modifiedAt: info.mtime.toISOString(),
    ext: extname(finalName).replace(/^\./, "").toLowerCase(),
  } satisfies KnowledgeFileItem;
}

export async function deleteKnowledgeFile(name: string) {
  const { path } = resolveKnowledgePath(name);
  await unlink(path);
}

export function openKnowledgeFileStream(name: string) {
  const { path, name: safe } = resolveKnowledgePath(name);
  const nodeStream = createReadStream(path);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;
  return { stream: webStream, name: safe, path };
}

export function openKnowledgeAccessStream(input: string) {
  const resolved = resolveKnowledgeAccessPath(input);
  const nodeStream = createReadStream(resolved.path);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;
  return { ...resolved, stream: webStream };
}
