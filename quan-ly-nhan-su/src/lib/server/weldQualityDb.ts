import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatSupabaseError } from "@/lib/supabase/env";
import {
  validateGeometryLimits, validateGeometryMeasurements,
  type SavedWeldInspection, type SavedWeldQualityRule, type WeldQualityStatus,
} from "@/lib/weldQuality";
export type { SavedWeldInspection, SavedWeldQualityRule } from "@/lib/weldQuality";

export type WeldQualitySummary = {
  moi_han_id: string;
  tinh_trang: WeldQualityStatus;
  phien_ban: number | null;
  tieu_chuan_id: string | null;
  ket_qua_hinh_hoc: "Đạt" | "Không đạt" | null;
  du_dieu_kien_rfi: boolean;
  du_dieu_kien_nghiem_thu: boolean;
};

/** Chỉ gọi từ server sau xác thực; chưa cung cấp endpoint HTTP ở giai đoạn nền dữ liệu. */
export async function loadWeldQuality(weldId: string) {
  const db = createAdminClient();
  const [inspection, summary] = await Promise.all([
    db.from("kiem_tra_moi_han").select("*").eq("moi_han_id", weldId).maybeSingle(),
    db.from("chat_luong_moi_han").select("*").eq("moi_han_id", weldId).single(),
  ]);
  if (inspection.error) throw new Error(formatSupabaseError(inspection.error));
  if (summary.error) throw new Error(formatSupabaseError(summary.error));
  return {
    inspection: inspection.data as SavedWeldInspection | null,
    summary: summary.data as WeldQualitySummary,
  };
}

export async function createWeldQualityRule(rule: Omit<SavedWeldQualityRule, "id">) {
  validateGeometryLimits(rule.dung_sai);
  const { data, error } = await createAdminClient().from("tieu_chuan_nghiem_thu_moi_han").insert(rule).select("*").single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as SavedWeldQualityRule;
}

export async function saveWeldQualityInspection(
  inspection: Omit<SavedWeldInspection, "updated_at">,
) {
  validateGeometryMeasurements(inspection.gia_tri_do);
  const { data, error } = await createAdminClient().rpc("luu_kiem_tra_moi_han", {
    p_moi_han_id: inspection.moi_han_id,
    p_phien_ban: inspection.phien_ban,
    p_tieu_chuan_id: inspection.tieu_chuan_id,
    p_ngay_mai: inspection.ngay_mai,
    p_truc_quan: inspection.truc_quan,
    p_gia_tri_do: inspection.gia_tri_do,
    p_phuong_phap_ndt: inspection.phuong_phap_ndt,
    p_ket_qua_ndt: inspection.ket_qua_ndt,
    p_ngay_ndt: inspection.ngay_ndt,
    p_nguoi_ghi_nhan: inspection.nguoi_ghi_nhan,
    p_ghi_chu: inspection.ghi_chu,
    p_ly_do_loai_nghiem_thu: inspection.ly_do_loai_nghiem_thu ?? null,
  }).single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as SavedWeldInspection;
}

export type PublishWeldRfi = {
  id: string;
  du_an_id: string;
  so_phieu: string;
  ngay_moi: string;
  moi_han_ids: string[];
  nguoi_lap: string;
  thong_tin: Record<string, unknown>;
};

export async function publishWeldRfi(input: PublishWeldRfi): Promise<string> {
  const { data, error } = await createAdminClient().rpc("phat_hanh_rfi_moi_han", {
    p_id: input.id, p_du_an_id: input.du_an_id, p_so_phieu: input.so_phieu,
    p_ngay_moi: input.ngay_moi, p_moi_han_ids: input.moi_han_ids,
    p_nguoi_lap: input.nguoi_lap, p_thong_tin: input.thong_tin,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return data as string;
}

export type CompleteWeldAcceptance = {
  id: string;
  phieu_id: string;
  ngay_nghiem_thu: string;
  nguoi_lap: string;
  ket_qua: { moi_han_id: string; phien_ban: number; ket_qua: "Đạt" | "Không đạt" | "Chưa nghiệm thu"; ly_do?: string }[];
  thong_tin: Record<string, unknown>;
};

export async function completeWeldAcceptance(input: CompleteWeldAcceptance): Promise<string> {
  const { data, error } = await createAdminClient().rpc("hoan_thanh_nghiem_thu_moi_han", {
    p_id: input.id, p_phieu_id: input.phieu_id, p_ngay_nghiem_thu: input.ngay_nghiem_thu,
    p_nguoi_lap: input.nguoi_lap, p_ket_qua: input.ket_qua, p_thong_tin: input.thong_tin,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return data as string;
}
