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

  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  return JSON.parse(await data.text()) as T;
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
