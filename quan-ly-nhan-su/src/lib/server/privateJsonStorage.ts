import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "system-configuration";

function isMissing(error: { message?: string; statusCode?: string | number } | null) {
  if (!error) return false;
  return String(error.statusCode) === "404" || /not found/i.test(error.message || "");
}

async function ensureBucket() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  if (data?.some((bucket) => bucket.id === BUCKET)) return;
  const created = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 1024 * 1024,
    allowedMimeTypes: ["application/json"],
  });
  if (created.error) throw created.error;
}

export async function readPrivateJson<T>(path: string): Promise<T | null> {
  const supabase = createAdminClient();
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) throw bucketsError;
  if (!buckets?.some((bucket) => bucket.id === BUCKET)) return null;

  // download() có thể trả bản cũ từ CDN tới ~15 giây sau khi ghi; ký URL mới + tham số chống cache để luôn đọc bản mới nhất.
  const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !signed) {
    if (!error || isMissing(error) || /not found/i.test(error.message)) return null;
    throw error;
  }
  const response = await fetch(`${signed.signedUrl}&cb=${Date.now()}`, { cache: "no-store" });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`Không đọc được ${path}: HTTP ${response.status}`);
  return JSON.parse(await response.text()) as T;
}

export async function writePrivateJson(path: string, value: unknown) {
  await ensureBucket();
  const supabase = createAdminClient();
  const content = new TextEncoder().encode(JSON.stringify(value));
  const { error } = await supabase.storage.from(BUCKET).upload(path, content, {
    contentType: "application/json",
    cacheControl: "0",
    upsert: true,
  });
  if (error) throw error;
}
