import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { QualityApiError } from "@/lib/server/weldQualityAuth";
import { object, qualityDate, qualityUuid } from "@/lib/server/weldQualityJournal";
import { completeWeldAcceptance, publishWeldRfi } from "@/lib/server/weldQualityDb";
import { filterRfiCandidates, rfiBlockReason, type RfiCandidate } from "@/lib/weldAcceptance";

const db = () => createAdminClient();

function str(v: unknown, max = 300): string {
  if (v == null) return "";
  if (typeof v !== "string" || v.length > max) throw new QualityApiError("Nội dung văn bản không hợp lệ.");
  return v.trim();
}

/** Đọc hết mọi trang (PostgREST mặc định giới hạn 1.000 dòng). */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function chunked<T>(ids: string[], load: (part: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await load(ids.slice(i, i + 200));
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}

type QualityRow = { moi_han_id: string; phien_ban: number | null; tinh_trang: string; du_dieu_kien_rfi: boolean };

export async function loadRfiCandidates(body: Record<string, unknown>) {
  const projectId = qualityUuid(body.du_an_id);
  const f = object(body.filters ?? {});
  const filter = { query: str(f.query), nameFrom: str(f.nameFrom), nameTo: str(f.nameTo), kmFrom: str(f.kmFrom, 40), kmTo: str(f.kmTo, 40),
    dateFrom: qualityDate(f.dateFrom) ?? "", dateTo: qualityDate(f.dateTo) ?? "" };
  const quality = await fetchAll<QualityRow>((a, b) => db().from("chat_luong_moi_han")
    .select("moi_han_id,phien_ban,tinh_trang,du_dieu_kien_rfi").eq("du_an_id", projectId).order("moi_han_id").range(a, b));
  const linked = await fetchAll<{ moi_han_id: string }>((a, b) => db().from("phieu_yeu_cau_nghiem_thu_moi")
    .select("moi_han_id,phieu_yeu_cau_nghiem_thu!inner(du_an_id)").eq("con_hieu_luc", true)
    .eq("phieu_yeu_cau_nghiem_thu.du_an_id", projectId).order("moi_han_id").range(a, b));
  const inRfi = new Set(linked.map((r) => r.moi_han_id));
  const isEligible = (q: QualityRow) => q.du_dieu_kien_rfi && q.tinh_trang !== "Đạt" && q.tinh_trang !== "Nghiệm thu đạt" && !inRfi.has(q.moi_han_id);
  const eligible = quality.filter(isEligible);
  const ids = eligible.map((q) => q.moi_han_id);
  const welds = await chunked<{ id: string; ma_lich_su: string; ngay_thuc_hien: string | null }>(ids, (p) =>
    db().from("lich_su_moi_han").select("id,ma_lich_su,ngay_thuc_hien").in("id", p));
  const points = await chunked<{ lich_su_moi_han_id: string; ly_trinh: string | null }>(ids, (p) =>
    db().from("toa_do").select("lich_su_moi_han_id,ly_trinh").in("lich_su_moi_han_id", p));
  const km = new Map(points.filter((p) => p.ly_trinh).map((p) => [p.lich_su_moi_han_id, p.ly_trinh as string]));
  const meta = new Map(eligible.map((q) => [q.moi_han_id, q]));
  const rows: RfiCandidate[] = welds.map((w) => ({ id: w.id, ma_lich_su: w.ma_lich_su, ngay_thuc_hien: w.ngay_thuc_hien,
    ly_trinh: km.get(w.id) ?? null, phien_ban: meta.get(w.id)?.phien_ban ?? 0, tinh_trang: meta.get(w.id)?.tinh_trang ?? "" }));
  let result;
  try { result = filterRfiCandidates(rows, filter); } catch (e) { throw new QualityApiError((e as Error).message); }
  const excluded: Record<string, number> = {};
  for (const q of quality) {
    if (isEligible(q)) continue;
    const reason = inRfi.has(q.moi_han_id) ? "Đã thuộc RFI đang hiệu lực" : rfiBlockReason(q.tinh_trang);
    excluded[reason] = (excluded[reason] ?? 0) + 1;
  }
  return { rows: result.rows, missingChainage: result.missingChainage, excluded, total: eligible.length };
}

export async function nextRfiNumber(projectId: string) {
  const { count, error } = await db().from("phieu_yeu_cau_nghiem_thu").select("id", { count: "exact", head: true }).eq("du_an_id", projectId);
  if (error) throw error;
  return `RFI-${String((count ?? 0) + 1).padStart(3, "0")}`;
}

export async function publishRfi(body: Record<string, unknown>, actor: string) {
  const ids = body.moi_han_ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 2000) throw new QualityApiError("Chọn 1–2000 mối cho một phiếu.");
  const ngay = qualityDate(body.ngay_moi);
  if (!ngay) throw new QualityApiError("Nhập ngày mời nghiệm thu.");
  const soPhieu = str(body.so_phieu, 80);
  if (!soPhieu) throw new QualityApiError("Nhập số phiếu.");
  const id = await publishWeldRfi({ id: qualityUuid(body.id), du_an_id: qualityUuid(body.du_an_id), so_phieu: soPhieu, ngay_moi: ngay,
    moi_han_ids: ids.map(qualityUuid), nguoi_lap: actor, thong_tin: object(body.thong_tin ?? {}) });
  return { id };
}

export async function listRfis(projectId: string) {
  const { data, error } = await db().from("phieu_yeu_cau_nghiem_thu")
    .select("id,so_phieu,ngay_moi,trang_thai,nguoi_lap,thong_tin,created_at,phieu_yeu_cau_nghiem_thu_moi(con_hieu_luc)")
    .eq("du_an_id", projectId).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data.map(({ phieu_yeu_cau_nghiem_thu_moi: m, ...r }) => ({ ...r, tong_moi: m.length, con_lai: m.filter((x) => x.con_hieu_luc).length }));
}

/** Mối của RFI kèm tình trạng hiện tại để chọn nghiệm thu. */
export async function loadRfiDetail(rfiId: string) {
  const { data: rfi, error } = await db().from("phieu_yeu_cau_nghiem_thu").select("*").eq("id", rfiId).single();
  if (error) throw error;
  const links = await fetchAll<{ moi_han_id: string; con_hieu_luc: boolean; du_lieu_chot: { moi_han?: { ma_lich_su?: string; ngay_thuc_hien?: string | null } } }>((a, b) =>
    db().from("phieu_yeu_cau_nghiem_thu_moi").select("moi_han_id,con_hieu_luc,du_lieu_chot").eq("phieu_id", rfiId).order("moi_han_id").range(a, b));
  const quality = await chunked<{ moi_han_id: string; phien_ban: number | null; tinh_trang: string; du_dieu_kien_nghiem_thu: boolean }>(
    links.map((l) => l.moi_han_id), (p) => db().from("chat_luong_moi_han").select("moi_han_id,phien_ban,tinh_trang,du_dieu_kien_nghiem_thu").in("moi_han_id", p));
  const q = new Map(quality.map((x) => [x.moi_han_id, x]));
  // Vị trí hiện trường của từng mối (lý trình + toạ độ) để phiếu có link dẫn thẳng tới mối.
  const points = await chunked<{ lich_su_moi_han_id: string; ly_trinh: string | null; kinh_do: number | null; vi_do: number | null }>(
    links.map((l) => l.moi_han_id), (p) => db().from("toa_do").select("lich_su_moi_han_id,ly_trinh,kinh_do,vi_do").in("lich_su_moi_han_id", p));
  const where = new Map<string, (typeof points)[number]>();
  for (const pt of points) { // ưu tiên điểm có toạ độ hợp lệ
    const cur = where.get(pt.lich_su_moi_han_id);
    if (!cur || (cur.vi_do == null && pt.vi_do != null)) where.set(pt.lich_su_moi_han_id, pt);
  }
  const welds = links.map((l) => ({ moi_han_id: l.moi_han_id, con_hieu_luc: l.con_hieu_luc,
    ma_lich_su: l.du_lieu_chot.moi_han?.ma_lich_su ?? "", ngay_thuc_hien: l.du_lieu_chot.moi_han?.ngay_thuc_hien ?? null,
    ly_trinh: where.get(l.moi_han_id)?.ly_trinh ?? null,
    vi_do: where.get(l.moi_han_id)?.vi_do == null ? null : Number(where.get(l.moi_han_id)?.vi_do),
    kinh_do: where.get(l.moi_han_id)?.kinh_do == null ? null : Number(where.get(l.moi_han_id)?.kinh_do), phien_ban: q.get(l.moi_han_id)?.phien_ban ?? 0,
    tinh_trang: q.get(l.moi_han_id)?.tinh_trang ?? "", du_dieu_kien_nghiem_thu: q.get(l.moi_han_id)?.du_dieu_kien_nghiem_thu ?? false }));
  welds.sort((a, b) => a.ma_lich_su.localeCompare(b.ma_lich_su, "vi", { numeric: true }));
  return { rfi, welds };
}

export async function completeRfi(body: Record<string, unknown>, actor: string) {
  const ngay = qualityDate(body.ngay_nghiem_thu);
  if (!ngay) throw new QualityApiError("Nhập ngày nghiệm thu.");
  if (!Array.isArray(body.ket_qua) || !body.ket_qua.length || body.ket_qua.length > 2000) throw new QualityApiError("Danh sách kết quả không hợp lệ.");
  const ket_qua = body.ket_qua.map((v) => {
    const r = object(v);
    if (r.ket_qua !== "Đạt" && r.ket_qua !== "Không đạt" && r.ket_qua !== "Chưa nghiệm thu") throw new QualityApiError("Kết quả nghiệm thu không hợp lệ.");
    if (typeof r.phien_ban !== "number" || !Number.isSafeInteger(r.phien_ban)) throw new QualityApiError("Phiên bản không hợp lệ.");
    return { moi_han_id: qualityUuid(r.moi_han_id), phien_ban: r.phien_ban, ket_qua: r.ket_qua as "Đạt" | "Không đạt" | "Chưa nghiệm thu", ly_do: str(r.ly_do, 1000) || undefined };
  });
  const id = await completeWeldAcceptance({ id: qualityUuid(body.id), phieu_id: qualityUuid(body.phieu_id), ngay_nghiem_thu: ngay,
    nguoi_lap: actor, ket_qua, thong_tin: object(body.thong_tin ?? {}) });
  return { id };
}

/** Số mối được chấp nhận trong các đợt nghiệm thu diễn ra vào ngày `date` (tách khỏi ngày hàn). */
export async function acceptedOnDate(body: Record<string, unknown>) {
  const date = qualityDate(body.date);
  if (!date) throw new QualityApiError("Nhập ngày cần xem.");
  const projectId = body.du_an_id ? qualityUuid(body.du_an_id) : null;
  let query = db().from("dot_nghiem_thu_moi")
    .select("moi_han_id,dot_nghiem_thu!inner(ngay_nghiem_thu,phieu_yeu_cau_nghiem_thu!inner(du_an_id))", { count: "exact", head: true })
    .eq("ket_qua", "Đạt").eq("dot_nghiem_thu.ngay_nghiem_thu", date);
  if (projectId) query = query.eq("dot_nghiem_thu.phieu_yeu_cau_nghiem_thu.du_an_id", projectId);
  const { count, error } = await query;
  if (error) throw error;
  return { count: count ?? 0 };
}

export async function listRecords(projectId: string) {
  const { data, error } = await db().from("dot_nghiem_thu")
    .select("id,ngay_nghiem_thu,nguoi_lap,created_at,phieu_yeu_cau_nghiem_thu!inner(id,so_phieu,du_an_id),ho_so_nghiem_thu(id,loai,tinh_trang_ky)")
    .eq("phieu_yeu_cau_nghiem_thu.du_an_id", projectId).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data;
}

export async function loadRecordSet(dotId: string) {
  const [dot, docs, welds, revisions] = await Promise.all([
    db().from("dot_nghiem_thu").select("*,phieu_yeu_cau_nghiem_thu(*,du_an(*))").eq("id", dotId).single(),
    db().from("ho_so_nghiem_thu").select("*").eq("dot_id", dotId).order("loai"),
    db().from("dot_nghiem_thu_moi").select("*").eq("dot_id", dotId),
    db().from("ho_so_nghiem_thu_sua_doi").select("*,ho_so_nghiem_thu!inner(dot_id)").eq("ho_so_nghiem_thu.dot_id", dotId).order("phien_ban"),
  ]);
  for (const r of [dot, docs, welds, revisions]) if (r.error) throw r.error;
  return { dot: dot.data, ho_so: docs.data, moi: welds.data, sua_doi: revisions.data };
}

/** Thêm bản sửa đổi thông tin in (địa điểm, thành phần…); không đụng tới dữ liệu chốt. */
export async function reviseRecord(body: Record<string, unknown>, actor: string) {
  const hoSoId = qualityUuid(body.ho_so_id);
  const lyDo = str(body.ly_do, 1000);
  if (!lyDo) throw new QualityApiError("Cần nêu lý do sửa đổi.");
  const t = object(body.thong_tin);
  const thong_tin = { dia_diem: str(t.dia_diem, 300), thanh_phan: str(t.thanh_phan, 1000) };
  const { data: last, error: lastError } = await db().from("ho_so_nghiem_thu_sua_doi").select("phien_ban")
    .eq("ho_so_id", hoSoId).order("phien_ban", { ascending: false }).limit(1);
  if (lastError) throw lastError;
  const { error } = await db().from("ho_so_nghiem_thu_sua_doi")
    .insert({ ho_so_id: hoSoId, phien_ban: (last?.[0]?.phien_ban ?? 0) + 1, thong_tin, ly_do: lyDo, nguoi_sua: actor });
  if (error) throw error; // trùng phiên bản (hai người sửa cùng lúc) → 409 qua ràng buộc unique
  return { ok: true };
}

export async function setSignStatus(body: Record<string, unknown>) {
  if (body.tinh_trang_ky !== "Chờ ký" && body.tinh_trang_ky !== "Đã ký") throw new QualityApiError("Tình trạng ký không hợp lệ.");
  const { error } = await db().from("ho_so_nghiem_thu").update({ tinh_trang_ky: body.tinh_trang_ky }).eq("id", qualityUuid(body.id));
  if (error) throw error;
  return { ok: true };
}
