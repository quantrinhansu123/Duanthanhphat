import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { QualityApiError } from "@/lib/server/weldQualityAuth";
import { qualityDate, qualityUuid } from "@/lib/server/weldQualityJournal";

const db = () => createAdminClient();
const PERCENTS = [30, 50, 70, 100];

type PaymentRow = { moi_han_id: string; ngay_thanh_toan: string; ty_le: number; ghi_chu: string | null };

function ids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 500) throw new QualityApiError("Danh sách mối hàn không hợp lệ (tối đa 500 mối mỗi lượt).");
  return [...new Set(value.map(qualityUuid))];
}

/** Mối thuộc một phiếu: RFI chính (phieu_yeu_cau_nghiem_thu) hoặc phiếu tách hình học / siêu âm (phieu_nt_tach). */
export async function weldsOfTicket(projectId: string, ticketId: string): Promise<string[]> {
  const main = await db().from("phieu_yeu_cau_nghiem_thu").select("id").eq("id", ticketId).eq("du_an_id", projectId).maybeSingle();
  if (main.error) throw main.error;
  const table = main.data ? "phieu_yeu_cau_nghiem_thu_moi" : "phieu_nt_tach_moi";
  if (!main.data) {
    const split = await db().from("phieu_nt_tach").select("id").eq("id", ticketId).eq("du_an_id", projectId).maybeSingle();
    if (split.error) throw split.error;
    if (!split.data) throw new QualityApiError("Phiếu không thuộc dự án này.");
  }
  const { data, error } = await db().from(table).select("moi_han_id").eq("phieu_id", ticketId);
  if (error) throw error;
  return (data ?? []).map((r) => r.moi_han_id as string);
}

/** Thanh toán của đúng các mối được hỏi (danh sách nhật ký hàn dùng để hiện cột «Thanh toán»). */
export async function paymentsOf(moiIds: string[]): Promise<PaymentRow[]> {
  const out: PaymentRow[] = [];
  for (let i = 0; i < moiIds.length; i += 200) {
    const { data, error } = await db().from("thanh_toan_moi_han").select("moi_han_id,ngay_thanh_toan,ty_le,ghi_chu").in("moi_han_id", moiIds.slice(i, i + 200));
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}

/** Tỷ lệ theo kết quả của từng mối trên phiếu siêu âm. */
export async function ultrasoundPaymentRates(moiIds: string[]): Promise<Record<string, number>> {
  const rates: Record<string, number> = {};
  for (let i = 0; i < moiIds.length; i += 200) {
    const { data, error } = await db().from("phieu_nt_tach_moi")
      .select("moi_han_id,phieu_nt_tach!inner(da_ky,ngay_nghiem_thu)")
      .eq("loai", "sieu-am").eq("ket_qua", "Đạt")
      .not("phieu_nt_tach.ngay_nghiem_thu", "is", null)
      .in("moi_han_id", moiIds.slice(i, i + 200));
    if (error) throw error;
    for (const row of data ?? []) {
      const ticket = Array.isArray(row.phieu_nt_tach) ? row.phieu_nt_tach[0] : row.phieu_nt_tach;
      if (ticket) rates[row.moi_han_id] = ticket.da_ky ? 100 : 70;
    }
  }
  return rates;
}

/** Thanh toán đủ 100% trong danh sách mối đã cho. */
export async function listPaymentIds(moiIds: string[]): Promise<string[]> {
  return (await paymentsOf(moiIds)).filter((r) => r.ty_le === 100).map((r) => r.moi_han_id);
}

export async function listPayments(projectId: string) {
  const out: PaymentRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from("thanh_toan_moi_han").select("moi_han_id,ngay_thanh_toan,ty_le,ghi_chu")
      .eq("du_an_id", projectId).order("moi_han_id").range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return out;
  }
}

/** Ghi thanh toán theo mối (chọn theo phiếu = chọn các mối của phiếu rồi ghi): chỉ mối đã nghiệm thu «Đạt» của đúng dự án; tỷ lệ 30/50/70/100 (mặc định 100). */
export async function setPayments(body: Record<string, unknown>, actor: string) {
  const projectId = qualityUuid(body.du_an_id);
  const moiIds = ids(body.moi_han_ids);
  const ngay = qualityDate(body.ngay_thanh_toan);
  if (!ngay) throw new QualityApiError("Nhập ngày thanh toán.");
  const tyLe = body.ty_le == null ? 100 : Number(body.ty_le);
  if (!PERCENTS.includes(tyLe)) throw new QualityApiError("Tỷ lệ thanh toán chỉ nhận 30, 50, 70 hoặc 100%.");
  const ghiChu = typeof body.ghi_chu === "string" ? body.ghi_chu.trim().slice(0, 500) : "";
  const { data, error } = await db().from("chat_luong_moi_han").select("moi_han_id,tinh_trang").eq("du_an_id", projectId).in("moi_han_id", moiIds);
  if (error) throw error;
  const accepted = new Set((data ?? []).filter((r) => r.tinh_trang === "Đạt").map((r) => r.moi_han_id as string));
  const rejected = moiIds.filter((id) => !accepted.has(id));
  if (rejected.length) throw new QualityApiError(`Chỉ thanh toán được mối đã nghiệm thu Đạt; ${rejected.length} mối chưa đủ điều kiện.`);
  const { error: saveError } = await db().from("thanh_toan_moi_han").upsert(
    moiIds.map((moi_han_id) => ({ moi_han_id, du_an_id: projectId, ngay_thanh_toan: ngay, ty_le: tyLe, ghi_chu: ghiChu || null, nguoi_cap_nhat: actor })),
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
