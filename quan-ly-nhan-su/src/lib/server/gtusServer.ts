import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { QualityApiError } from "@/lib/server/weldQualityAuth";
import { object, qualityDate, qualityUuid } from "@/lib/server/weldQualityJournal";

const db = () => createAdminClient();
const TABLE = "gtus_thanh_rfi";
const RATES = [30, 50, 70, 100];

export type GtusSnapshot = {
  thanh_id: string; ma_thanh: string; route: "ha" | "thuong"; ray: "trai" | "phai";
  ly_trinh_dau: string; ly_trinh_cuoi: string; chieu_dai: number; ma_lwr: string | null;
};

function tableError(error: { code?: string; message?: string }): never {
  if (error.code === "PGRST205" || error.code === "42P01" || /gtus_thanh_rfi/.test(error.message ?? "")) {
    throw new QualityApiError("Chưa chạy migration supabase/migration_20261111_gtus_thanh_rfi.sql trên Supabase (bảng gtus_thanh_rfi).", 409);
  }
  throw new QualityApiError(error.message ?? "Lỗi lưu dữ liệu giải toả ứng suất.", 500);
}

/** Lưu danh sách thanh của RFI GTUS (chụp lại lý trình / chiều dài lúc phát phiếu). Gọi lại cùng phiếu thì giữ nguyên kết quả đã nhập. */
export async function snapshotGtusThanh(phieuId: string, items: GtusSnapshot[]) {
  if (!items.length) return;
  const { error } = await db().from(TABLE).upsert(items.map((item) => ({ phieu_id: phieuId, ...item })), { onConflict: "phieu_id,thanh_id", ignoreDuplicates: true });
  if (error) tableError(error);
}

/** Xoá dữ liệu thanh khi xoá RFI GTUS. */
export async function deleteGtusThanh(phieuId: string) {
  const { error } = await db().from(TABLE).delete().eq("phieu_id", phieuId);
  if (error && error.code !== "PGRST205" && error.code !== "42P01") throw error;
}

export async function gtusDetail(body: Record<string, unknown>) {
  const id = qualityUuid(body.id);
  const rfi = await db().from("phieu_yeu_cau_nghiem_thu").select("id,du_an_id,so_phieu,ngay_moi,trang_thai,thong_tin").eq("id", id).single();
  if (rfi.error) throw rfi.error;
  if ((rfi.data.thong_tin as Record<string, unknown> | null)?.cong_viec !== "gtus") throw new QualityApiError("Đây không phải phiếu giải toả ứng suất.", 400);
  const rows = await db().from(TABLE).select("*").eq("phieu_id", id).order("route", { ascending: false }).order("ly_trinh_dau").order("ray");
  if (rows.error) tableError(rows.error);
  return { rfi: rfi.data, items: rows.data };
}

type Cell = Record<string, unknown>;
/** Thanh Đạt → đánh dấu «đã giải toả» (released) trên track map của dự án; bỏ Đạt thì gỡ dấu. */
async function syncReleased(projectId: string, changes: Map<string, boolean>) {
  if (!changes.size) return;
  const row = await db().from("lwr_track_layouts").select("layout").eq("project_id", projectId).maybeSingle();
  if (row.error || !row.data) return;
  const layout = row.data.layout as { rows?: { cells?: Cell[] }[] };
  let touched = false;
  for (const line of layout.rows ?? []) {
    for (const cell of line.cells ?? []) {
      const want = changes.get(String(cell.id));
      if (want === undefined) continue;
      if (want && !cell.released) { cell.released = true; touched = true; }
      if (!want && cell.released) { delete cell.released; touched = true; }
    }
  }
  if (touched) await db().from("lwr_track_layouts").update({ layout, updated_at: new Date().toISOString() }).eq("project_id", projectId);
}

/** Lưu nghiệm thu và thanh toán từng thanh của RFI GTUS. */
export async function gtusSave(body: Record<string, unknown>, actor: string) {
  const id = qualityUuid(body.phieu_id);
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 200) throw new QualityApiError("Danh sách thanh không hợp lệ.");
  const rfi = await db().from("phieu_yeu_cau_nghiem_thu").select("du_an_id,thong_tin").eq("id", id).single();
  if (rfi.error) throw rfi.error;
  if ((rfi.data.thong_tin as Record<string, unknown> | null)?.cong_viec !== "gtus") throw new QualityApiError("Đây không phải phiếu giải toả ứng suất.", 400);
  const before = await db().from(TABLE).select("thanh_id,ket_qua").eq("phieu_id", id);
  if (before.error) tableError(before.error);
  const known = new Map(before.data.map((r) => [r.thanh_id as string, r.ket_qua as string | null]));
  const released = new Map<string, boolean>();
  for (const raw of body.items) {
    const it = object(raw);
    const thanhId = String(it.thanh_id ?? "");
    if (!known.has(thanhId)) throw new QualityApiError(`Thanh ${thanhId} không thuộc phiếu này.`, 400);
    const ket_qua = it.ket_qua === "Đạt" || it.ket_qua === "Không đạt" ? it.ket_qua : null;
    const ty_le = it.ty_le == null || it.ty_le === "" ? null : Number(it.ty_le);
    if (ty_le !== null && !RATES.includes(ty_le)) throw new QualityApiError("Tỷ lệ thanh toán chỉ nhận 30, 50, 70 hoặc 100%.");
    if (ket_qua === "Không đạt" && !String(it.ly_do ?? "").trim()) throw new QualityApiError(`Nhập lý do không đạt cho thanh ${thanhId}.`);
    const patch = {
      ket_qua,
      ngay_nghiem_thu: ket_qua ? (qualityDate(it.ngay_nghiem_thu) ?? new Date().toISOString().slice(0, 10)) : null,
      ly_do: ket_qua === "Không đạt" ? String(it.ly_do).trim().slice(0, 500) : null,
      nguoi_ghi: ket_qua ? actor : null,
      ty_le,
      ngay_thanh_toan: ty_le !== null ? (qualityDate(it.ngay_thanh_toan) ?? new Date().toISOString().slice(0, 10)) : null,
      ghi_chu_thanh_toan: ty_le !== null ? String(it.ghi_chu ?? "").trim().slice(0, 300) || null : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await db().from(TABLE).update(patch).eq("phieu_id", id).eq("thanh_id", thanhId);
    if (error) tableError(error);
    if ((known.get(thanhId) === "Đạt") !== (ket_qua === "Đạt")) released.set(thanhId, ket_qua === "Đạt");
  }
  await syncReleased(String(rfi.data.du_an_id), released);
  return { ok: true as const, released: released.size };
}
