import { createAdminClient } from "@/lib/supabase/admin";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";
import type { DriveDocumentItem } from "@/lib/googleDrive/types";

export const DOCUMENT_BUCKET = "tai-lieu";
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
export const DOCUMENT_SETUP_MESSAGE =
  "Chưa có bảng tài liệu. Chạy supabase/tai_lieu.sql trên Supabase.";

type TaiLieuRow = {
  id: string;
  ten: string;
  mo_ta: string | null;
  file_path: string;
  file_url: string;
  file_size: number | null;
  thuoc_tinh?: Record<string, string> | null;
  created_at: string;
  updated_at: string;
};

function toItem(row: TaiLieuRow): DriveDocumentItem {
  return {
    id: row.id,
    name: row.ten,
    description: row.mo_ta || "",
    size: Number(row.file_size) || 0,
    mimeType: "application/pdf",
    createdTime: row.created_at,
    modifiedTime: row.updated_at,
    webViewLink: `/api/documents/${row.id}`,
    webContentLink: row.file_url || `/api/documents/${row.id}?download=1`,
    appProperties: row.thuoc_tinh && typeof row.thuoc_tinh === "object" ? row.thuoc_tinh : undefined,
  };
}

function missingTable(error: unknown) {
  const message = formatSupabaseError(error);
  return /tai_lieu|schema cache|42P01|PGRST205/i.test(message);
}

async function ensureBucket() {
  const supabase = createAdminClient();
  const existing = await supabase.storage.getBucket(DOCUMENT_BUCKET);
  if (!existing.error && existing.data) return supabase;
  const created = await supabase.storage.createBucket(DOCUMENT_BUCKET, {
    public: true,
    fileSizeLimit: MAX_DOCUMENT_BYTES,
    allowedMimeTypes: ["application/pdf"],
  });
  if (created.error && !/already exists/i.test(created.error.message)) {
    throw new Error(formatSupabaseError(created.error));
  }
  return supabase;
}

export function isDocumentStorageConfigured() {
  return isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export async function listStoredDocuments(): Promise<DriveDocumentItem[]> {
  const supabase = createAdminClient();
  const withProps = await supabase
    .from("tai_lieu")
    .select("id,ten,mo_ta,file_path,file_url,file_size,thuoc_tinh,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (!withProps.error) return ((withProps.data ?? []) as TaiLieuRow[]).map(toItem);
  if (!/thuoc_tinh/.test(withProps.error.message)) throw new Error(missingTable(withProps.error) ? DOCUMENT_SETUP_MESSAGE : formatSupabaseError(withProps.error));
  const plain = await supabase
    .from("tai_lieu")
    .select("id,ten,mo_ta,file_path,file_url,file_size,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (plain.error) throw new Error(missingTable(plain.error) ? DOCUMENT_SETUP_MESSAGE : formatSupabaseError(plain.error));
  return ((plain.data ?? []) as TaiLieuRow[]).map(toItem);
}

async function readRow(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tai_lieu")
    .select("id,ten,mo_ta,file_path,file_url,file_size,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(missingTable(error) ? DOCUMENT_SETUP_MESSAGE : formatSupabaseError(error));
  if (!data) throw new Error("Không tìm thấy tài liệu.");
  return data as TaiLieuRow;
}

export async function getStoredDocumentBuffer(id: string) {
  const row = await readRow(id);
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).download(row.file_path);
  if (error || !data) throw new Error(error ? formatSupabaseError(error) : "Không tải được file.");
  const buffer = Buffer.from(await data.arrayBuffer());
  return { name: row.ten.endsWith(".pdf") ? row.ten : `${row.ten}.pdf`, mimeType: "application/pdf", buffer };
}

export async function uploadStoredDocument(input: {
  bytes: Buffer;
  name: string;
  description: string;
  appProperties?: Record<string, string>;
}) {
  const supabase = await ensureBucket();
  const id = crypto.randomUUID();
  const path = `${id}.pdf`;
  const uploaded = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, input.bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploaded.error) throw new Error(formatSupabaseError(uploaded.error));
  const fileUrl = supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(path).data.publicUrl;
  const payload = {
    id,
    ten: input.name.trim() || "Tài liệu.pdf",
    mo_ta: input.description.trim() || null,
    file_path: path,
    file_url: fileUrl,
    file_size: input.bytes.byteLength,
    thuoc_tinh: input.appProperties ?? {},
  };
  let inserted = await supabase.from("tai_lieu").insert(payload).select("id,ten,mo_ta,file_path,file_url,file_size,thuoc_tinh,created_at,updated_at").single();
  if (inserted.error && /thuoc_tinh/.test(inserted.error.message)) {
    const { thuoc_tinh: _props, ...withoutProps } = payload;
    void _props;
    inserted = await supabase.from("tai_lieu").insert(withoutProps).select("id,ten,mo_ta,file_path,file_url,file_size,created_at,updated_at").single();
  }
  if (inserted.error || !inserted.data) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
    throw new Error(inserted.error && missingTable(inserted.error) ? DOCUMENT_SETUP_MESSAGE : formatSupabaseError(inserted.error));
  }
  return toItem(inserted.data as TaiLieuRow);
}

export async function updateStoredDocument(id: string, patch: { name?: string; description?: string }) {
  const supabase = createAdminClient();
  const body: { ten?: string; mo_ta?: string | null } = {};
  if (patch.name !== undefined) body.ten = patch.name.trim();
  if (patch.description !== undefined) body.mo_ta = patch.description.trim() || null;
  const { data, error } = await supabase
    .from("tai_lieu")
    .update(body)
    .eq("id", id)
    .select("id,ten,mo_ta,file_path,file_url,file_size,created_at,updated_at")
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return toItem(data as TaiLieuRow);
}

export async function replaceStoredDocumentContent(id: string, bytes: Buffer, patch?: { name?: string; description?: string }) {
  const row = await readRow(id);
  const supabase = await ensureBucket();
  const uploaded = await supabase.storage.from(DOCUMENT_BUCKET).upload(row.file_path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploaded.error) throw new Error(formatSupabaseError(uploaded.error));
  const body: { file_size: number; ten?: string; mo_ta?: string | null } = { file_size: bytes.byteLength };
  if (patch?.name?.trim()) body.ten = patch.name.trim();
  if (patch?.description !== undefined) body.mo_ta = patch.description.trim() || null;
  const { error } = await supabase.from("tai_lieu").update(body).eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function deleteStoredDocument(id: string) {
  const row = await readRow(id);
  const supabase = createAdminClient();
  const removed = await supabase.storage.from(DOCUMENT_BUCKET).remove([row.file_path]);
  if (removed.error) throw new Error(formatSupabaseError(removed.error));
  const { error } = await supabase.from("tai_lieu").delete().eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}
