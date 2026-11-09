import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { QualityApiError } from "@/lib/server/weldQualityAuth";
import { qualityDate, qualityUuid } from "@/lib/server/weldQualityJournal";

const db = () => createAdminClient();

function ids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 500) throw new QualityApiError("Danh sách mối hàn không hợp lệ (tối đa 500 mối mỗi lượt).");
  return [...new Set(value.map(qualityUuid))];
}

/** Trong danh sách mối đã cho, những mối đã ghi thanh toán. */
export async function listPaymentIds(moiIds: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < moiIds.length; i += 200) {
    const { data, error } = await db().from("thanh_toan_moi_han").select("moi_han_id").in("moi_han_id", moiIds.slice(i, i + 200));
    if (error) throw error;
    out.push(...(data ?? []).map((r) => r.moi_han_id as string));
  }
  return out;
}

export async function listPayments(projectId: string) {
  const out: { moi_han_id: string; ngay_thanh_toan: string; dot_thanh_toan: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from("thanh_toan_moi_han").select("moi_han_id,ngay_thanh_toan,dot_thanh_toan")
      .eq("du_an_id", projectId).order("moi_han_id").range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return out;
  }
}

/** Ghi thanh toán: chỉ mối đã nghiệm thu «Đạt» của đúng dự án. */
export async function setPayments(body: Record<string, unknown>, actor: string) {
  const projectId = qualityUuid(body.du_an_id), moiIds = ids(body.moi_han_ids);
  const ngay = qualityDate(body.ngay_thanh_toan);
  if (!ngay) throw new QualityApiError("Nhập ngày thanh toán.");
  const dot = typeof body.dot_thanh_toan === "string" ? body.dot_thanh_toan.trim().slice(0, 80) : "";
  const { data, error } = await db().from("chat_luong_moi_han").select("moi_han_id,tinh_trang").eq("du_an_id", projectId).in("moi_han_id", moiIds);
  if (error) throw error;
  const accepted = new Set((data ?? []).filter((r) => r.tinh_trang === "Đạt").map((r) => r.moi_han_id as string));
  const rejected = moiIds.filter((id) => !accepted.has(id));
  if (rejected.length) throw new QualityApiError(`Chỉ thanh toán được mối đã nghiệm thu Đạt; ${rejected.length} mối chưa đủ điều kiện.`);
  const { error: saveError } = await db().from("thanh_toan_moi_han").upsert(
    moiIds.map((moi_han_id) => ({ moi_han_id, du_an_id: projectId, ngay_thanh_toan: ngay, dot_thanh_toan: dot || null, nguoi_cap_nhat: actor })),
    { onConflict: "moi_han_id" });
  if (saveError) throw saveError;
  return { count: moiIds.length };
}

export async function clearPayments(body: Record<string, unknown>) {
  const projectId = qualityUuid(body.du_an_id), moiIds = ids(body.moi_han_ids);
  const { error } = await db().from("thanh_toan_moi_han").delete().eq("du_an_id", projectId).in("moi_han_id", moiIds);
  if (error) throw error;
  return { count: moiIds.length };
}

