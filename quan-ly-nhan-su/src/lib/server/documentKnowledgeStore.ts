// Shared server/CLI storage. Never import this module from a client component.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import {
  basename,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { KNOWLEDGE_BUCKET, isUuid } from "../documentKnowledge.ts";
import { knowledgePipelineVersion } from "./documentKnowledgeAI.ts";

export function knowledgeAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("DK_DATABASE_NOT_CONFIGURED");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function knowledgeResult<T>(result: { data: T; error: unknown }): T {
  if (result.error) {
    const error = result.error as { message?: string; code?: string };
    const known = error.message?.match(/\bDK_[A-Z_]+\b/)?.[0];
    throw new Error(
      known ||
        (error.code === "23505" ? "DK_DUPLICATE_EVENT" : "DK_DATABASE_ERROR"),
    );
  }
  return result.data;
}
export async function requireKnowledgeProject(
  client: SupabaseClient,
  projectId: unknown,
  write = false,
) {
  if (!isUuid(projectId)) throw new Error("DK_INVALID_PROJECT");
  if (
    !knowledgeResult(
      await client.rpc("dk_access", { p_project: projectId, p_write: write }),
    )
  )
    throw new Error("DK_FORBIDDEN");
  return projectId;
}
export function safeKnowledgeKey(value: string) {
  const key = value.replace(/\\/g, "/").normalize("NFC");
  if (
    !key ||
    key.length > 1000 ||
    isAbsolute(key) ||
    /^[a-z]:/i.test(key) ||
    key.includes("\0") ||
    key.split("/").some((p) => !p || p === "." || p === "..")
  )
    throw new Error("DK_INVALID_PATH");
  return key;
}
export async function stageKnowledgeUpload(
  project: string,
  name: string,
  bytes: Buffer,
  sourceKey = name,
) {
  const key = safeKnowledgeKey(sourceKey);
  if (!bytes.length || bytes.length > 50 * 1024 * 1024)
    throw new Error("DK_FILE_SIZE_LIMIT");
  const admin = knowledgeAdmin();
  const hash = createHash("sha256").update(bytes).digest("hex");
  const suffix =
    extname(name)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, "")
      .slice(0, 12) || ".bin";
  const storagePath = `${project}/${hash}${suffix}`;
  const uploaded = await admin.storage
    .from(KNOWLEDGE_BUCKET)
    .upload(storagePath, bytes, {
      upsert: false,
      contentType: "application/octet-stream",
    });
  if (
    uploaded.error &&
    !/already exists|duplicate/i.test(uploaded.error.message)
  )
    throw new Error("DK_UPLOAD_FAILED");
  return knowledgeResult(
    await admin.rpc("dk_register_document", {
      p_project: project,
      p_key: "upload/" + key,
      p_name: name,
      p_kind: "upload",
      p_ref: storagePath,
      p_hash: hash,
      p_pipeline: knowledgePipelineVersion(),
      p_size: bytes.length,
    }),
  );
}
export async function resolveKnowledgeLocal(key: string) {
  const configured = process.env.CHAT_CONTRACT_DIR?.trim();
  if (!configured) throw new Error("DK_SOURCE_ROOT_NOT_CONFIGURED");
  const root = await realpath(configured);
  const full = await realpath(resolve(root, safeKnowledgeKey(key)));
  const rel = relative(root, full);
  if (!rel || rel.startsWith(".." + sep) || rel === ".." || isAbsolute(rel))
    throw new Error("DK_INVALID_PATH");
  return full;
}
export async function hashKnowledgeFile(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export async function scanKnowledgeDirectory(project: string, folder = "") {
  if (!isUuid(project)) throw new Error("DK_INVALID_PROJECT");
  const configured = process.env.CHAT_CONTRACT_DIR?.trim();
  if (!configured) throw new Error("DK_SOURCE_ROOT_NOT_CONFIGURED");
  const root = await realpath(configured);
  const prefix = folder ? safeKnowledgeKey(folder) : "";
  const start = prefix ? await resolveKnowledgeLocal(prefix) : root;
  const files: { key: string; path: string; size: number }[] = [];
  const walk = async (path: string) => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name.startsWith("~$")) continue;
      // Symlinks/junctions are deliberately not followed into unrelated directories.
      if (entry.isSymbolicLink()) throw new Error("DK_SOURCE_SYMLINK");
      const full = resolve(path, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        if (files.length >= 10000) throw new Error("DK_SOURCE_FILE_LIMIT");
        files.push({
          key: relative(root, full).split(sep).join("/"),
          path: full,
          size: (await stat(full)).size,
        });
      }
    }
  };
  await walk(start);
  const admin = knowledgeAdmin();
  let queued = 0,
    unchanged = 0;
  const keys: string[] = [];
  for (const file of files) {
    const ref = safeKnowledgeKey(file.key);
    keys.push("local/" + ref);
    const result = knowledgeResult(
      await admin.rpc("dk_register_document", {
        p_project: project,
        p_key: "local/" + ref,
        p_name: basename(file.path),
        p_kind: "local",
        p_ref: ref,
        p_hash: await hashKnowledgeFile(file.path),
        p_pipeline: knowledgePipelineVersion(),
        p_size: file.size,
      }),
    );
    if (result.unchanged) unchanged++;
    else queued++;
  }
  // Only reconcile removals AFTER a complete successful scan. Never delete source files.
  knowledgeResult(
    await admin.rpc("dk_mark_missing", {
      p_project: project,
      p_prefix: "local/" + (prefix ? prefix + "/" : ""),
      p_keys: keys,
    }),
  );
  return { discovered: files.length, queued, unchanged };
}
export type KnowledgeSource = {
  source_kind: string;
  source_ref: string;
  content_hash: string;
  size_bytes: number;
  name: string;
};
export async function readKnowledgeSource(
  source: KnowledgeSource,
): Promise<Buffer> {
  if (source.size_bytes > 50 * 1024 * 1024)
    throw new Error("DK_FILE_SIZE_LIMIT");
  let bytes: Buffer;
  if (source.source_kind === "local") {
    const path = await resolveKnowledgeLocal(source.source_ref);
    if ((await stat(path)).size > 50 * 1024 * 1024)
      throw new Error("DK_FILE_SIZE_LIMIT");
    bytes = await readFile(path);
  } else {
    const downloaded = knowledgeResult(
      await knowledgeAdmin()
        .storage.from(KNOWLEDGE_BUCKET)
        .download(source.source_ref),
    );
    if (!downloaded) throw new Error("DK_SOURCE_NOT_FOUND");
    bytes = Buffer.from(await downloaded.arrayBuffer());
  }
  if (bytes.length > 50 * 1024 * 1024) throw new Error("DK_FILE_SIZE_LIMIT");
  if (createHash("sha256").update(bytes).digest("hex") !== source.content_hash)
    throw new Error("DK_SOURCE_CHANGED");
  return bytes;
}
