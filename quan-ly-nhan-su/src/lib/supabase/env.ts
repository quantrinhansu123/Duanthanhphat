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

export function formatSupabaseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Không thể tải dữ liệu Supabase";
}
