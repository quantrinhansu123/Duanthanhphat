import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { QualityApiError } from "@/lib/server/weldQualityAuth";
import type { GeometryLimits, QualityRuleSync, SavedWeldQualityRule } from "@/lib/weldQuality";

const migration = "Cần cập nhật SQL đồng bộ tiêu chí trên Supabase (migration_20261101_tieu_chi_dong_bo_moi_mo.sql).";
function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "PGRST202" || error.code === "42883") throw new QualityApiError(migration, 503);
  throw error;
}

export async function createAndApplyQualityRule(input: {
  du_an_id: string; cong_nghe_han: string; loai_moi_han: string; ten: string; dung_sai: GeometryLimits;
  yeu_cau_ndt: boolean; ndt_truoc_rfi: boolean; can_cu_mien_ndt: string | null; nguoi_xac_nhan: string;
}) {
  const { data, error } = await createAdminClient().rpc("tao_va_ap_dung_tieu_chuan_moi_han", {
    p_du_an_id: input.du_an_id, p_cong_nghe_han: input.cong_nghe_han, p_loai_moi_han: input.loai_moi_han,
    p_ten: input.ten, p_dung_sai: input.dung_sai, p_yeu_cau_ndt: input.yeu_cau_ndt,
    p_ndt_truoc_rfi: input.ndt_truoc_rfi, p_can_cu_mien_ndt: input.can_cu_mien_ndt, p_nguoi_xac_nhan: input.nguoi_xac_nhan,
  });
  check(error);
  return data as { rule: SavedWeldQualityRule; sync: QualityRuleSync };
}

export async function applyQualityRule(ruleId: string, actor: string) {
  const { data, error } = await createAdminClient().rpc("ap_dung_tieu_chuan_moi_han", {
    p_tieu_chuan_id: ruleId, p_nguoi_thay_doi: actor,
  });
  check(error);
  return data as QualityRuleSync;
}
