import { createClient } from "@/lib/supabase/client";

export type DocumentItem = {
  id: string;
  title: string;
  description: string;
  filePath: string;
  fileUrl: string;
  fileSize: number;
  createdAt: string;
};

export type TaiLieuRow = {
  id: string;
  ten: string;
  mo_ta: string | null;
  file_path: string;
  file_url: string;
  file_size: number | null;
  created_at: string;
  updated_at?: string;
};

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

function rowToDocument(row: TaiLieuRow): DocumentItem {
  return {
    id: row.id,
    title: row.ten,
    description: row.mo_ta ?? "",
    filePath: row.file_path,
    fileUrl: row.file_url,
    fileSize: row.file_size ?? 0,
    createdAt: row.created_at,
  };
}

export async function fetchDocuments(): Promise<{ items: DocumentItem[]; error?: string }> {
  if (!hasSupabaseEnv()) {
    return { items: [], error: "Chưa cấu hình Supabase env" };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("tai_lieu")
    .select("id, ten, mo_ta, file_path, file_url, file_size, created_at")
    .order("created_at", { ascending: false });

  if (error) return { items: [], error: error.message };
  return { items: (data ?? []).map((r) => rowToDocument(r as TaiLieuRow)) };
}

export async function uploadDocument(
  file: File,
  title: string,
  description?: string,
): Promise<{ item?: DocumentItem; error?: string }> {
  if (!hasSupabaseEnv()) {
    return { error: "Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL / ANON_KEY" };
  }

  const name = title.trim();
  if (!name) return { error: "Nhập tên tài liệu" };
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Chỉ chấp nhận file PDF" };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { error: "File tối đa 50 MB" };
  }

  const supabase = createClient();
  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
  const filePath = `${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("tai-lieu")
    .upload(filePath, file, { contentType: "application/pdf", upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data: publicData } = supabase.storage.from("tai-lieu").getPublicUrl(filePath);
  const fileUrl = publicData.publicUrl;

  const { data, error } = await supabase
    .from("tai_lieu")
    .insert({
      ten: name,
      mo_ta: description?.trim() || null,
      file_path: filePath,
      file_url: fileUrl,
      file_size: file.size,
    })
    .select("id, ten, mo_ta, file_path, file_url, file_size, created_at")
    .single();

  if (error) return { error: error.message };
  return { item: rowToDocument(data as TaiLieuRow) };
}

export async function deleteDocument(id: string, filePath: string): Promise<{ error?: string }> {
  if (!hasSupabaseEnv()) {
    return { error: "Chưa cấu hình Supabase env" };
  }

  const supabase = createClient();
  await supabase.storage.from("tai-lieu").remove([filePath]);
  const { error } = await supabase.from("tai_lieu").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function updateDocument(
  id: string,
  oldFilePath: string,
  title: string,
  description?: string,
  newFile?: File | null,
): Promise<{ item?: DocumentItem; error?: string }> {
  if (!hasSupabaseEnv()) {
    return { error: "Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL / ANON_KEY" };
  }

  const name = title.trim();
  if (!name) return { error: "Nhập tên tài liệu" };

  const supabase = createClient();
  let filePath = oldFilePath;
  let fileUrl: string | undefined;
  let fileSize: number | undefined;

  if (newFile) {
    if (newFile.type !== "application/pdf" && !newFile.name.toLowerCase().endsWith(".pdf")) {
      return { error: "Chỉ chấp nhận file PDF" };
    }
    if (newFile.size > 50 * 1024 * 1024) {
      return { error: "File tối đa 50 MB" };
    }

    const safeName = newFile.name.replace(/[^\w.\-() ]+/g, "_");
    filePath = `${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("tai-lieu")
      .upload(filePath, newFile, { contentType: "application/pdf", upsert: false });

    if (uploadError) return { error: uploadError.message };

    const { data: publicData } = supabase.storage.from("tai-lieu").getPublicUrl(filePath);
    fileUrl = publicData.publicUrl;
    fileSize = newFile.size;

    if (oldFilePath !== filePath) {
      await supabase.storage.from("tai-lieu").remove([oldFilePath]);
    }
  }

  const payload: Record<string, unknown> = {
    ten: name,
    mo_ta: description?.trim() || null,
  };
  if (fileUrl) {
    payload.file_path = filePath;
    payload.file_url = fileUrl;
    payload.file_size = fileSize;
  }

  const { data, error } = await supabase
    .from("tai_lieu")
    .update(payload)
    .eq("id", id)
    .select("id, ten, mo_ta, file_path, file_url, file_size, created_at")
    .single();

  if (error) return { error: error.message };
  return { item: rowToDocument(data as TaiLieuRow) };
}

export function formatFileSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
