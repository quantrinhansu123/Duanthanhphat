import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "system-configuration";

/**
 * Cache ngắn theo tiến trình: danh sách bucket và nội dung file thay đổi rất ít nhưng mỗi lần đọc
 * đang tốn ~2,5 giây (listBuckets → createSignedUrl → tải qua HTTP). Giữ 30 giây để trang Báo cáo ngày
 * không phải trả giá này ở mọi request; ghi file sẽ xoá cache ngay.
 */
const CACHE_TTL_MS = 30_000;
let bucketCache: { at: number; exists: boolean } | null = null;
const jsonCache = new Map<string, { at: number; value: unknown }>();

function cacheFresh(at: number) {
  return Date.now() - at < CACHE_TTL_MS;
}

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

async function bucketExists() {
  if (bucketCache && cacheFresh(bucketCache.at)) return bucketCache.exists;
  const supabase = createAdminClient();
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  const exists = Boolean(buckets?.some((bucket) => bucket.id === BUCKET));
  bucketCache = { at: Date.now(), exists };
  return exists;
}

export async function readPrivateJson<T>(path: string): Promise<T | null> {
  const hit = jsonCache.get(path);
  if (hit && cacheFresh(hit.at)) return hit.value as T;

  const supabase = createAdminClient();
  if (!(await bucketExists())) return null;

  // download() có thể trả bản cũ từ CDN tới ~15 giây sau khi ghi; ký URL mới + tham số chống cache để luôn đọc bản mới nhất.
  const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !signed) {
    if (!error || isMissing(error) || /not found/i.test(error.message)) return null;
    throw error;
  }
  const response = await fetch(`${signed.signedUrl}&cb=${Date.now()}`, { cache: "no-store" });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`Không đọc được ${path}: HTTP ${response.status}`);
  const value = JSON.parse(await response.text()) as T;
  jsonCache.set(path, { at: Date.now(), value });
  return value;
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
  jsonCache.set(path, { at: Date.now(), value });
  bucketCache = { at: Date.now(), exists: true };
}

/** Xoá cache đọc (dùng khi cần đảm bảo đọc lại bản mới nhất từ Storage). */
export function invalidatePrivateJsonCache(path?: string) {
  if (path) jsonCache.delete(path);
  else jsonCache.clear();
  bucketCache = null;
}
