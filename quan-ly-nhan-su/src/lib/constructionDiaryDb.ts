import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

/** Nội dung phần B "Tình hình thi công hàng ngày" (mẫu NKTC trang 6-7). */
export type ConstructionDiary = {
  thoiTiet: "Bình thường" | "Mưa" | "Nắng" | "";
  nhietDo: string;
  sang: string;
  chieu: string;
  toi: string;
  banChiHuy: string;
  canBoKyThuat: string;
  congNhan: string;
  thietBi: string;
  noiDungCongViec: string;
  nghiemThuHangNgay: string;
  suCo: string;
  kienNghi: string;
  nhanXetGiamSat: string;
  chtTiepThu: string;
};

export const EMPTY_DIARY: ConstructionDiary = {
  thoiTiet: "", nhietDo: "", sang: "", chieu: "", toi: "", banChiHuy: "", canBoKyThuat: "", congNhan: "", thietBi: "",
  noiDungCongViec: "", nghiemThuHangNgay: "", suCo: "", kienNghi: "", nhanXetGiamSat: "", chtTiepThu: "",
};

const localKey = (projectId: string, date: string) => `nhat-ky-thi-cong-ngay:${projectId}:${date}`;

/** Đọc nhật ký; Supabase lỗi/chưa có bảng thì dùng bản lưu trên máy này. */
export async function loadDiary(projectId: string, date: string): Promise<{ diary: ConstructionDiary; saved: boolean; source: "supabase" | "local"; error?: string }> {
  let error: string | undefined;
  if (isSupabaseConfigured()) {
    try {
      const res = await createClient().from("nhat_ky_thi_cong_ngay").select("du_lieu").eq("du_an_id", projectId).eq("ngay", date).maybeSingle();
      if (!res.error) return { diary: { ...EMPTY_DIARY, ...(res.data?.du_lieu as Partial<ConstructionDiary> | undefined) }, saved: Boolean(res.data), source: "supabase" };
      error = formatSupabaseError(res.error);
    } catch (cause) { error = formatSupabaseError(cause); }
  }
  try {
    const raw = window.localStorage.getItem(localKey(projectId, date));
    return { diary: { ...EMPTY_DIARY, ...(raw ? (JSON.parse(raw) as Partial<ConstructionDiary>) : {}) }, saved: Boolean(raw), source: "local", error };
  } catch {
    return { diary: EMPTY_DIARY, saved: false, source: "local", error };
  }
}

export async function saveDiary(projectId: string, date: string, diary: ConstructionDiary): Promise<{ source: "supabase" | "local"; error?: string }> {
  let error: string | undefined;
  if (isSupabaseConfigured()) {
    try {
      const res = await createClient().from("nhat_ky_thi_cong_ngay")
        .upsert({ du_an_id: projectId, ngay: date, du_lieu: diary }, { onConflict: "du_an_id,ngay" });
      if (!res.error) return { source: "supabase" };
      error = formatSupabaseError(res.error);
    } catch (cause) { error = formatSupabaseError(cause); }
  }
  window.localStorage.setItem(localKey(projectId, date), JSON.stringify(diary));
  return { source: "local", error };
}
