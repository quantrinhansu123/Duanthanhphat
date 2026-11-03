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
  nguoi_nhan?: string | null;
};

/** Tên gọi (từ cuối của họ tên) bỏ dấu, chữ thường — dùng để khớp người nhận thông báo. */
export function recipientKey(fullName: string): string {
  const last = fullName.split("@")[0].trim().split(/\s+/).filter(Boolean).pop() ?? "";
  return last.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
}

/** Thông báo không ghi người nhận → mọi người thấy; có ghi → chỉ những người được liệt kê. */
function visibleTo(row: NoticeRow, userName: string): boolean {
  const list = (row.nguoi_nhan ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  if (!list.length) return true;
  const me = recipientKey(userName);
  return Boolean(me) && list.includes(me);
}

export async function loadNotifications(userName = ""): Promise<AppNotification[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const query = (columns: string) => supabase.from("thong_bao").select(columns)
    .order("created_at", { ascending: false }).limit(60);
  let result = await query("id,tieu_de,noi_dung,loai,created_at,da_doc,nguoi_nhan");
  // Chưa chạy migration cột nguoi_nhan → vẫn hiện thông báo như cũ.
  if (result.error) result = await query("id,tieu_de,noi_dung,loai,created_at,da_doc");
  if (result.error) return [];
  return ((result.data ?? []) as unknown as NoticeRow[]).filter((row) => visibleTo(row, userName)).slice(0, 30).map((row) => ({
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

/** Ghi thông báo trên app cho đúng người nhận (tên gọi: Phúc, Thanh, Tiến…), rồi gọi Zalo nếu đã cấu hình OA. */
export async function notifyPeople(input: { title: string; message: string; kind: string; recipients: string[] }) {
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const payload = {
      tieu_de: input.title,
      noi_dung: input.message,
      loai: input.kind,
      da_doc: false,
      nguoi_nhan: input.recipients.map(recipientKey).join(","),
    };
    const { error } = await supabase.from("thong_bao").insert(payload);
    if (error && /nguoi_nhan/.test(error.message ?? "")) {
      const { nguoi_nhan, ...withoutAudience } = payload;
      void nguoi_nhan;
      await supabase.from("thong_bao").insert(withoutAudience);
    }
  }
  try {
    await fetch("/api/notify-zalo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `${input.title}: ${input.message}` }),
    });
  } catch {
    // Zalo là kênh phụ; thông báo trên app vẫn được ghi.
  }
}

/** Báo cáo mức dầu / đổ dầu → thông báo cho Tiến. */
export function notifyOilReport(message: string) {
  return notifyPeople({ title: "Cấp dầu", message, kind: "cap_dau", recipients: ["Tiến"] });
}

/** Checklist máy trước ca → thông báo cho Phúc, Thanh, Tiến. */
export function notifyPreShiftChecklist(message: string) {
  return notifyPeople({ title: "Checklist máy trước ca", message, kind: "checklist", recipients: ["Phúc", "Thanh", "Tiến"] });
}
