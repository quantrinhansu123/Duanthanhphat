export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export function requireSupabaseConfig() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL trong .env.local");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local (JWT anon từ Supabase Dashboard)");
  }
}

const WELD_TYPE_CHECK_MESSAGE =
  "Database chưa nhận loại mối hàn mới (Chấp thuận / Tần suất). Chạy supabase/migration_20261011_loai_moi_han_chap_thuan_tan_suat.sql trên Supabase SQL Editor.";

function explainKnownError(message: string) {
  if (/lich_su_moi_han_loai_check|tong_moi_han_nam_loai_check/.test(message)) return WELD_TYPE_CHECK_MESSAGE;
  return message;
}

export function formatSupabaseError(error: unknown): string {
  if (error instanceof Error) return explainKnownError(error.message);
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return explainKnownError(message);
  }
  return "Không thể tải dữ liệu Supabase";
}
