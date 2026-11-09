import { createClient } from "@/lib/supabase/client";

/** Mã Lisp (toa_do.ma_diem) của các mối đã nhập trong ngày của dự án, theo thứ tự nhập — đầu vào của nextLispCode(). */
export async function loadDayLispCodes(projectId: string, isoDate: string, excludeWeldId?: string): Promise<string[]> {
  if (!projectId || !isoDate) return [];
  const db = createClient();
  const welds = await db.from("lich_su_moi_han").select("id,created_at").eq("du_an_id", projectId).eq("ngay_thuc_hien", isoDate).order("created_at").limit(1000);
  if (welds.error || !welds.data?.length) return [];
  const ids = welds.data.map((w) => w.id as string).filter((id) => id !== excludeWeldId);
  const points = await db.from("toa_do").select("ma_diem,lich_su_moi_han_id").in("lich_su_moi_han_id", ids);
  if (points.error) return [];
  const byWeld = new Map((points.data ?? []).map((p) => [p.lich_su_moi_han_id as string, p.ma_diem as string]));
  return ids.map((id) => byWeld.get(id)).filter((code): code is string => Boolean(code));
}
