import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  createdAt: string;
  read: boolean;
};

type NoticeRow = {
  id: string;
  tieu_de: string;
  noi_dung: string;
  loai: string | null;
  created_at: string;
  da_doc: boolean | null;
};

export async function loadNotifications(): Promise<AppNotification[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("thong_bao")
    .select("id,tieu_de,noi_dung,loai,created_at,da_doc")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return [];
  return ((data ?? []) as NoticeRow[]).map((row) => ({
    id: row.id,
    title: row.tieu_de,
    body: row.noi_dung,
    kind: row.loai || "cap_dau",
    createdAt: row.created_at,
    read: row.da_doc === true,
  }));
}

export async function markNotificationsRead(ids: string[]) {
  if (!ids.length || !isSupabaseConfigured()) return;
  const supabase = createClient();
  await supabase.from("thong_bao").update({ da_doc: true }).in("id", ids);
}

/** Ghi thông báo trên app và gọi Zalo nếu đã cấu hình OA. */
export async function notifyCommanderOilLow(message: string) {
  const title = "Cấp dầu";
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    await supabase.from("thong_bao").insert({
      tieu_de: title,
      noi_dung: message,
      loai: "cap_dau",
      da_doc: false,
    });
  }
  try {
    await fetch("/api/notify-zalo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `${title}: ${message}` }),
    });
  } catch {
    // Zalo là kênh phụ; thông báo trên app vẫn được ghi.
  }
}
