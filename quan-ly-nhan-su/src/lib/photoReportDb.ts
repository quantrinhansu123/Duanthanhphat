import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

export type PhotoItem = { id: string; noiDung: string; anh: string };
export type PhotoReport = { goiThau: string; hangMuc: string; items: PhotoItem[] };

export const newPhotoItem = (): PhotoItem => ({ id: crypto.randomUUID(), noiDung: "", anh: "" });
export const emptyPhotoReport = (): PhotoReport => ({ goiThau: "", hangMuc: "", items: Array.from({ length: 4 }, newPhotoItem) });

const localKey = (projectId: string, date: string) => `bao-cao-anh-ngay:${projectId}:${date}`;

/** Đọc báo cáo ảnh; Supabase lỗi/chưa có bảng thì dùng bản lưu trên máy này. */
export async function loadPhotoReport(projectId: string, date: string): Promise<{ report: PhotoReport | null; source: "supabase" | "local"; error?: string }> {
  let error: string | undefined;
  if (isSupabaseConfigured()) {
    const res = await createClient().from("bao_cao_anh_ngay").select("du_lieu").eq("du_an_id", projectId).eq("ngay", date).maybeSingle();
    if (!res.error) return { report: (res.data?.du_lieu as PhotoReport | undefined) ?? null, source: "supabase" };
    error = formatSupabaseError(res.error);
  }
  try {
    const raw = window.localStorage.getItem(localKey(projectId, date));
    return { report: raw ? (JSON.parse(raw) as PhotoReport) : null, source: "local", error };
  } catch {
    return { report: null, source: "local", error };
  }
}

export async function savePhotoReport(projectId: string, date: string, report: PhotoReport): Promise<{ source: "supabase" | "local"; error?: string }> {
  let error: string | undefined;
  if (isSupabaseConfigured()) {
    const res = await createClient().from("bao_cao_anh_ngay").upsert({ du_an_id: projectId, ngay: date, du_lieu: report }, { onConflict: "du_an_id,ngay" });
    if (!res.error) return { source: "supabase" };
    error = formatSupabaseError(res.error);
  }
  try {
    window.localStorage.setItem(localKey(projectId, date), JSON.stringify(report));
  } catch {
    return { source: "local", error: "Bộ nhớ trình duyệt đầy, chưa lưu được ảnh" + (error ? ` (${error})` : "") };
  }
  return { source: "local", error };
}

/** Thu nhỏ ảnh về tối đa 1280px, JPEG 0.75 (~100-250 KB) để lưu trong jsonb. */
export function compressImage(file: File, maxSide = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Không đọc được ảnh")); };
    img.src = url;
  });
}
