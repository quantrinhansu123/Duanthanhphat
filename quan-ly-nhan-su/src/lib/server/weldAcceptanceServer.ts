import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { QualityApiError } from "@/lib/server/weldQualityAuth";
import { object, qualityDate, qualityUuid } from "@/lib/server/weldQualityJournal";
import { completeWeldAcceptance, publishWeldRfi } from "@/lib/server/weldQualityDb";
import { rfiScope, acceptanceBlockReason, filterRfiCandidates, isRfiEligibleStatus, rfiBlockReason, validateMonitoringRange, type RfiCandidate } from "@/lib/weldAcceptance";
import { summarizeRfiWelds } from "@/lib/rfiTracking";
import { acceptanceIssues, type SavedWeldInspection, type SavedWeldQualityRule } from "@/lib/weldQuality";
import { diaryWorkText, diaryManpowerDefaults, diaryStressReleaseText, diaryReportWorkText, diaryReportEquipmentText, type DiaryWork } from "@/lib/constructionDiaryAuto";
import { loadProjectEquipment } from "@/lib/server/projectEquipment";
import { projectEquipmentText } from "@/lib/projectEquipment";
import { readPrivateJson } from "@/lib/server/privateJsonStorage";
import type { ProjectMetadataStore } from "@/data/projectMetadata";
import { validateTrackLayout } from "@lwr/lib/track-editor";

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

async function chunkedPages<T>(ids: string[], build: (part: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    out.push(...await fetchAll((a, b) => build(ids.slice(i, i + 200), a, b)));
  }
  return out;
}

export async function loadDiaryDefaults(body: Record<string, unknown>) {
  const projectId = qualityUuid(body.du_an_id);
  const date = qualityDate(body.date);
  if (!date) throw new QualityApiError("Nhập ngày nhật ký.");
  const [welds, ground, accepted] = await Promise.all([
    fetchAll<DiaryWork>((a, b) => db().from("lich_su_moi_han")
      .select("id,ma_lich_su,cong_nghe_han,so_luong_thuc_hien,tho_han_id").eq("du_an_id", projectId).eq("ngay_thuc_hien", date).order("id").range(a, b)),
    fetchAll<{ moi_han_id: string }>((a, b) => db().from("kiem_tra_moi_han")
      .select("moi_han_id,lich_su_moi_han!inner(du_an_id)").eq("lich_su_moi_han.du_an_id", projectId).eq("ngay_mai", date).order("moi_han_id").range(a, b)),
    fetchAll<{ moi_han_id: string; ket_qua: string }>((a, b) => db().from("dot_nghiem_thu_moi")
      .select("moi_han_id,ket_qua,dot_nghiem_thu!inner(ngay_nghiem_thu,phieu_yeu_cau_nghiem_thu!inner(du_an_id))")
      .eq("dot_nghiem_thu.ngay_nghiem_thu", date).eq("dot_nghiem_thu.phieu_yeu_cau_nghiem_thu.du_an_id", projectId)
      .neq("ket_qua", "Chưa nghiệm thu").order("moi_han_id").range(a, b)),
  ]);
  const ids = [...new Set([...welds.map((w) => w.id), ...ground.map((w) => w.moi_han_id), ...accepted.map((w) => w.moi_han_id)])];
  const [all, points] = await Promise.all([
    chunked<DiaryWork>(ids, (p) => db().from("lich_su_moi_han").select("id,ma_lich_su,cong_nghe_han,so_luong_thuc_hien,ly_trinh,ma_hien_truong").eq("du_an_id", projectId).in("id", p)),
    chunked<{ lich_su_moi_han_id: string; ma_diem: string; ly_trinh: string | null }>(ids, (p) => db().from("toa_do")
      .select("lich_su_moi_han_id,ma_diem,ly_trinh").in("lich_su_moi_han_id", p).order("id")),
  ]);
  const located = new Map(all.map((w) => {
    const point = points.find((p) => p.lich_su_moi_han_id === w.id);
    // Lý trình ưu tiên điểm GPS; dự án không có tọa độ thì lấy lý trình ghi trong nhật ký hàn.
    return [w.id, { ...w, ...point, ly_trinh: point?.ly_trinh || w.ly_trinh || null }];
  }));
  const select = (keys: string[]) => keys.flatMap((id) => located.has(id) ? [located.get(id)!] : []);
  // Máy hàn thực tế dùng trong ngày (nhật ký hàn) — ưu tiên hơn mã máy gán dự án chưa khớp danh mục.
  const dayWeldIds = welds.map((w) => w.id);
  const usedMachineIds = [...new Set((await chunked<{ may_id: string | null }>(dayWeldIds, (p) =>
    db().from("lich_su_moi_han").select("may_id").in("id", p))).map((r) => r.may_id).filter((id): id is string => Boolean(id)))];
  const usedMachines = await chunked<{ id: string; ma_may: string; ten_may: string; model: string | null; loai_may: string | null; cong_nghe_han: string | null; thong_so: unknown }>(
    usedMachineIds, (p) => db().from("thiet_bi").select("id,ma_may,ten_may,model,loai_may,cong_nghe_han,thong_so").in("id", p));
  const [projectEquipment, metadata, project, reportsOnDate, lwr] = await Promise.all([
    loadProjectEquipment(projectId),
    readPrivateJson<ProjectMetadataStore>("project-metadata.json"),
    db().from("du_an").select("nguoi_phu_trach").eq("id", projectId).single(),
    // Báo cáo ngày của ngày này: đúng dự án, hoặc phiếu chưa gắn dự án (du_an_id trống).
    fetchAll<Record<string, unknown>>((a, b) => db().from("bao_cao_ngay_cong_viec")
      .select("*,bao_cao_ngay!inner(du_an_id,ngay_bao_cao)").eq("phan", "hom_nay")
      .eq("bao_cao_ngay.ngay_bao_cao", date).order("id").range(a, b)),
    db().from("lwr_track_layouts").select("layout").eq("project_id", projectId).maybeSingle(),
  ]);
  const headerProject = (r: Record<string, unknown>) => { const h = r.bao_cao_ngay as { du_an_id?: string | null } | { du_an_id?: string | null }[] | null; return (Array.isArray(h) ? h[0] : h)?.du_an_id ?? null; };
  const exactReports = reportsOnDate.filter((r) => headerProject(r) === projectId);
  const reports = exactReports.length > 0 ? exactReports : reportsOnDate.filter((r) => headerProject(r) === null);
  const reportEquipment = await chunked<{ ten_thiet_bi: string | null; so_luong: number | string | null; bo_phan: string | null }>(
    [...new Set(reports.map((r) => String(r.bao_cao_id)))], (p) => db().from("bao_cao_ngay_thiet_bi").select("ten_thiet_bi,so_luong,bo_phan").in("bao_cao_id", p));
  if (project.error) throw project.error;
  if (lwr.error) throw lwr.error;
  const known = new Set(projectEquipment.filter((m) => !m.missing).map((m) => m.code));
  const fromJournal = usedMachines.filter((m) => !known.has(m.ma_may)).map((m) => ({
    id: m.id, code: m.ma_may, name: m.ten_may, model: m.model ?? "", group: "welding" as const, quantity: 1,
  }));
  // Mã gán dự án không khớp danh mục chỉ giữ khi nhật ký không cho biết máy nào.
  const equipment = [...projectEquipment.filter((m) => !m.missing || usedMachines.length === 0), ...fromJournal];
  const layout = lwr.data ? validateTrackLayout(lwr.data.layout) : null;
  if (lwr.data && !layout) throw new Error("Sơ đồ LWR của dự án không hợp lệ; chưa thể tự điền công tác giải tỏa ứng suất.");
  const personnelIds = [...new Set([...(metadata?.[projectId]?.personnelIds ?? []), project.data.nguoi_phu_trach].filter((id): id is string => Boolean(id)))];
  const personnel = await chunked<{ employee_id: string; ho_ten: string; chuc_vu: string | null; trang_thai: string | null }>(personnelIds,
    (part) => db().from("nhan_su").select("employee_id,ho_ten,chuc_vu,trang_thai").in("employee_id", part));
  const welderIds = [...new Set(welds.map((w) => w.tho_han_id).filter((id): id is string => Boolean(id)))];
  const journalPeople = await chunked<{ employee_id: string; ho_ten: string; chuc_vu: string | null; trang_thai: string | null }>(welderIds,
    (part) => db().from("nhan_su").select("employee_id,ho_ten,chuc_vu,trang_thai").in("employee_id", part));
  return {
    ...diaryManpowerDefaults(reports, personnel, project.data.nguoi_phu_trach, welderIds.length, journalPeople),
    thietBi: diaryReportEquipmentText(reportEquipment) || projectEquipmentText(equipment),
    noiDungCongViec: diaryReportWorkText(reports, select(welds.map((w) => w.id))) || [diaryWorkText(select(welds.map((w) => w.id)), "weld"), diaryWorkText(select(ground.map((w) => w.moi_han_id)), "grind"), diaryStressReleaseText(layout, projectId, date)].filter(Boolean).join("\n") || "Chuẩn bị mặt bằng thi công.",
    nghiemThuHangNgay: ["Đạt", "Không đạt"].map((result) => {
      const text = diaryWorkText(select(accepted.filter((w) => w.ket_qua === result).map((w) => w.moi_han_id)), "accept");
      return text ? text.split("\n").map((line) => `${line} Kết quả: ${result}.`).join("\n") : "";
    }).filter(Boolean).join("\n") || "Không có công tác nghiệm thu",
  };
}

type QualityRow = { moi_han_id: string; phien_ban: number | null; tinh_trang: string; du_dieu_kien_rfi: boolean };

export async function loadRfiCandidates(body: Record<string, unknown>) {
  const projectId = qualityUuid(body.du_an_id);
  const f = object(body.filters ?? {});
  const filter = { query: str(f.query), nameFrom: str(f.nameFrom), nameTo: str(f.nameTo), kmFrom: str(f.kmFrom, 40), kmTo: str(f.kmTo, 40),
    dateFrom: qualityDate(f.dateFrom) ?? "", dateTo: qualityDate(f.dateTo) ?? "" };
  const [quality, linked] = await Promise.all([
    fetchAll<QualityRow>((a, b) => db().from("chat_luong_moi_han")
    .select("moi_han_id,phien_ban,tinh_trang,du_dieu_kien_rfi").eq("du_an_id", projectId).order("moi_han_id").range(a, b)),
    fetchAll<{ moi_han_id: string }>((a, b) => db().from("phieu_yeu_cau_nghiem_thu_moi")
    .select("moi_han_id,phieu_yeu_cau_nghiem_thu!inner(du_an_id)").eq("con_hieu_luc", true)
    .eq("phieu_yeu_cau_nghiem_thu.du_an_id", projectId).order("moi_han_id").range(a, b)),
  ]);
  const inRfi = new Set(linked.map((r) => r.moi_han_id));
  // Chỉ mối "Chờ siêu âm và nghiệm thu" — không lấy mối đã siêu âm Đạt / "Chờ ký biên bản".
  const isEligible = (q: QualityRow) =>
    q.du_dieu_kien_rfi && isRfiEligibleStatus(q.tinh_trang) && q.tinh_trang !== "Chờ ký biên bản" && !inRfi.has(q.moi_han_id);
  const eligible = quality.filter(isEligible);
  const ids = eligible.map((q) => q.moi_han_id);
  const [welds, points] = await Promise.all([
    chunked<{ id: string; ma_lich_su: string; ngay_thuc_hien: string | null }>(ids, (p) =>
      db().from("lich_su_moi_han").select("id,ma_lich_su,ngay_thuc_hien").in("id", p)),
    chunked<{ lich_su_moi_han_id: string; ly_trinh: string | null }>(ids, (p) =>
      db().from("toa_do").select("lich_su_moi_han_id,ly_trinh").in("lich_su_moi_han_id", p)),
  ]);
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

/** Initial RFI screen: share authentication and avoid a separate count query. */
export async function loadRfiOverview(body: Record<string, unknown>) {
  const projectId = qualityUuid(body.du_an_id);
  const [rfis, candidates] = await Promise.all([
    listRfis(projectId), loadRfiCandidates({ du_an_id: projectId, filters: {} }),
  ]);
  return { rfis, candidates, so_phieu: `RFI-${String(rfis.length + 1).padStart(3, "0")}` };
}

export async function nextRfiNumber(projectId: string) {
  const { count, error } = await db().from("phieu_yeu_cau_nghiem_thu").select("id", { count: "exact", head: true }).eq("du_an_id", projectId);
  if (error) throw error;
  return `RFI-${String((count ?? 0) + 1).padStart(3, "0")}`;
}

export async function publishRfi(body: Record<string, unknown>, actor: string) {
  if (body.loai_rfi === "theo-doi") {
    const range = object(body.filters ?? {});
    const fields = { nameFrom: str(range.nameFrom, 100), nameTo: str(range.nameTo, 100), kmFrom: str(range.kmFrom, 40), kmTo: str(range.kmTo, 40) };
    try { validateMonitoringRange(fields); } catch (error) { throw new QualityApiError((error as Error).message); }
    const date = qualityDate(body.ngay_moi), number = str(body.so_phieu, 80);
    if (!date || !number) throw new QualityApiError("Nhập ngày mời và số phiếu RFI.");
    const info = object(body.thong_tin ?? {});
    const flag = (v: unknown) => (v === true || v === "1" || v === "true" ? "1" : "");
    const giam_sat = str(info.giam_sat, 200);
    if (!flag(info.tuyen_thuong) && !flag(info.tuyen_ha) && !giam_sat) throw new QualityApiError("Chọn tuyến hoặc nhập nội dung giám sát cho phiếu theo dõi.");
    const payload = { id: qualityUuid(body.id), du_an_id: qualityUuid(body.du_an_id), so_phieu: number, ngay_moi: date, nguoi_lap: actor,
      thong_tin: { dia_diem: str(info.dia_diem), ben_moi: str(info.ben_moi), ben_nhan: str(info.ben_nhan), pham_vi: str(info.pham_vi), giam_sat,
        tuyen_thuong: flag(info.tuyen_thuong), tuyen_ha: flag(info.tuyen_ha), gio_bat_dau: str(info.gio_bat_dau, 10),
        loai_rfi: "theo-doi", ...fields } };
    const { error } = await db().from("phieu_yeu_cau_nghiem_thu").insert(payload);
    if (error) {
      if (error.code !== "23505") throw error;
      const existing = await db().from("phieu_yeu_cau_nghiem_thu").select("*").eq("id", payload.id).single();
      if (existing.error || !existing.data || ["du_an_id", "so_phieu", "ngay_moi", "nguoi_lap"].some((k) => existing.data[k] !== payload[k as keyof typeof payload])
        || Object.entries(payload.thong_tin).some(([k, value]) => existing.data.thong_tin?.[k] !== value)) {
        throw new QualityApiError("Số phiếu hoặc mã yêu cầu đã được dùng. Tải lại danh sách rồi thử lại.", 409);
      }
    }
    return { id: payload.id };
  }
  if (body.loai_rfi && body.loai_rfi !== "nghiem-thu" && body.loai_rfi !== "ca-hai") throw new QualityApiError("Loại RFI không hợp lệ.");
  const ids = body.moi_han_ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 2000) throw new QualityApiError("Chọn 1–2000 mối cho một phiếu.");
  const ngay = qualityDate(body.ngay_moi);
  if (!ngay) throw new QualityApiError("Nhập ngày mời nghiệm thu.");
  const soPhieu = str(body.so_phieu, 80);
  if (!soPhieu) throw new QualityApiError("Nhập số phiếu.");
  const info = object(body.thong_tin ?? {});
  const flag = (v: unknown) => (v === true || v === "1" || v === "true" ? "1" : "");
  const explicitScope = "nt_hinh_hoc" in info || "nt_sieu_am" in info;
  const geometry = explicitScope ? flag(info.nt_hinh_hoc) : "1";
  const ultrasound = explicitScope ? flag(info.nt_sieu_am) : "1";
  if (!geometry && !ultrasound) throw new QualityApiError("Chọn nghiệm thu kích thước hình học, siêu âm hoặc cả hai.");
  const thong_tin = {
    dia_diem: str(info.dia_diem),
    ben_moi: str(info.ben_moi),
    ben_nhan: str(info.ben_nhan),
    pham_vi: str(info.pham_vi),
    giam_sat: str(info.giam_sat, 200),
    tuyen_thuong: flag(info.tuyen_thuong),
    tuyen_ha: flag(info.tuyen_ha),
    gio_bat_dau: str(info.gio_bat_dau, 10),
    loai_rfi: body.loai_rfi === "ca-hai" ? "ca-hai" : "nghiem-thu",
    nt_hinh_hoc: geometry, nt_sieu_am: ultrasound,
  };
  const id = await publishWeldRfi({ id: qualityUuid(body.id), du_an_id: qualityUuid(body.du_an_id), so_phieu: soPhieu, ngay_moi: ngay,
    moi_han_ids: ids.map(qualityUuid), nguoi_lap: actor, thong_tin });
  return { id };
}

export async function listRfis(projectId: string) {
  type Snapshot = { moi_han?: { ma_lich_su?: string; ma_diem?: string; ly_trinh?: string } };
  type Rfi = { id: string; so_phieu: string; ngay_moi: string; trang_thai: string; nguoi_lap: string; thong_tin: Record<string, string>; created_at: string };
  type Link = { phieu_id: string; moi_han_id: string; con_hieu_luc: boolean; du_lieu_chot: Snapshot };
  type Batch = { id: string; phieu_id: string; thong_tin: Record<string, unknown>; created_at: string };
  const [rfis, links, batches] = await Promise.all([
    fetchAll<Rfi>((a, b) => db().from("phieu_yeu_cau_nghiem_thu")
      .select("id,so_phieu,ngay_moi,trang_thai,nguoi_lap,thong_tin,created_at").eq("du_an_id", projectId)
      .order("created_at", { ascending: false }).order("id").range(a, b)),
    fetchAll<Link>((a, b) => db().from("phieu_yeu_cau_nghiem_thu_moi")
      .select("phieu_id,moi_han_id,con_hieu_luc,du_lieu_chot,phieu_yeu_cau_nghiem_thu!inner(du_an_id)")
      .eq("phieu_yeu_cau_nghiem_thu.du_an_id", projectId).order("phieu_id").order("moi_han_id").range(a, b)),
    fetchAll<Batch>((a, b) => db().from("dot_nghiem_thu")
      .select("id,phieu_id,thong_tin,created_at,phieu_yeu_cau_nghiem_thu!inner(du_an_id)")
      .eq("phieu_yeu_cau_nghiem_thu.du_an_id", projectId).order("created_at").order("id").range(a, b)),
  ]);
  const completed = batches.filter((d) => d.thong_tin?.draft !== true);
  const [results, docs, points] = await Promise.all([
    chunkedPages<{ dot_id: string; moi_han_id: string; ket_qua: string; du_lieu_chot: Snapshot }>(completed.map((d) => d.id),
      (ids, a, b) => db().from("dot_nghiem_thu_moi").select("dot_id,moi_han_id,ket_qua,du_lieu_chot").in("dot_id", ids).order("dot_id").order("moi_han_id").range(a, b)),
    chunkedPages<{ dot_id: string; loai: string; tinh_trang_ky: string }>(completed.map((d) => d.id),
      (ids, a, b) => db().from("ho_so_nghiem_thu").select("dot_id,loai,tinh_trang_ky").in("dot_id", ids).order("id").range(a, b)),
    chunkedPages<{ lich_su_moi_han_id: string; ma_diem: string; ly_trinh: string | null }>([...new Set(links.map((l) => l.moi_han_id))],
      (ids, a, b) => db().from("toa_do").select("lich_su_moi_han_id,ma_diem,ly_trinh").in("lich_su_moi_han_id", ids).order("id").range(a, b)),
  ]);
  const required = ["Phụ lục công việc", "Giai đoạn xây dựng", "Hoàn thành công việc"];
  const where = new Map(points.map((p) => [p.lich_su_moi_han_id, p]));
  const linksByRfi = new Map<string, Link[]>();
  for (const link of links) {
    const rows = linksByRfi.get(link.phieu_id) ?? [];
    rows.push(link); linksByRfi.set(link.phieu_id, rows);
  }
  const batchById = new Map(completed.map((d) => [d.id, d]));
  const signedKinds = new Map<string, Set<string>>();
  for (const doc of docs) {
    if (doc.tinh_trang_ky !== "Đã ký") continue;
    const kinds = signedKinds.get(doc.dot_id) ?? new Set<string>();
    kinds.add(doc.loai); signedKinds.set(doc.dot_id, kinds);
  }
  const latestByRfi = new Map<string, Map<string, (typeof results)[number]>>();
  // Respect batch order even when queries are split into chunks.
  const batchOrder = new Map(completed.map((d, i) => [d.id, i]));
  results.sort((a, b) => batchOrder.get(a.dot_id)! - batchOrder.get(b.dot_id)!);
  for (const row of results) {
    const batch = batchById.get(row.dot_id)!;
    const latest = latestByRfi.get(batch.phieu_id) ?? new Map<string, (typeof results)[number]>();
    if (row.ket_qua !== "Chưa nghiệm thu" || !latest.has(row.moi_han_id)) latest.set(row.moi_han_id, row);
    latestByRfi.set(batch.phieu_id, latest);
  }
  return rfis.map((r) => {
    const linked = linksByRfi.get(r.id) ?? [];
    const latest = latestByRfi.get(r.id);
    const tracking = summarizeRfiWelds(linked.map((l) => {
      const result = latest?.get(l.moi_han_id);
      const snap = result?.du_lieu_chot?.moi_han ?? l.du_lieu_chot?.moi_han;
      return {
        moi_han_id: l.moi_han_id, ma_lich_su: snap?.ma_lich_su ?? l.moi_han_id,
        ma_diem: snap?.ma_diem ?? where.get(l.moi_han_id)?.ma_diem ?? null,
        ly_trinh: snap?.ly_trinh ?? where.get(l.moi_han_id)?.ly_trinh ?? null,
        ket_qua: result?.ket_qua ?? "Chưa nghiệm thu",
        da_ky: Boolean(result && required.every((loai) => signedKinds.get(result.dot_id)?.has(loai))),
      };
    }));
    return { ...r, tong_moi: linked.length, con_lai: linked.filter((l) => l.con_hieu_luc).length, tracking };
  });
}

/** Sửa thông tin phiếu YCNT/RFI đã phát (không đổi danh sách mối đã chốt). */
export async function deleteRfi(body: Record<string, unknown>) {
  const id = qualityUuid(body.id);
  const { error } = await db().rpc("xoa_phieu_rfi", { p_id: id });
  if (error) {
    if (error.code === "P0001") throw new QualityApiError(error.message, 409);
    throw error;
  }
  return { id };
}

export async function updateRfi(body: Record<string, unknown>) {
  const id = qualityUuid(body.id);
  const { data: existing, error } = await db().from("phieu_yeu_cau_nghiem_thu").select("*").eq("id", id).single();
  if (error) throw error;
  const soPhieu = str(body.so_phieu, 80);
  const ngay = qualityDate(body.ngay_moi);
  if (!soPhieu) throw new QualityApiError("Nhập số phiếu.");
  if (!ngay) throw new QualityApiError("Nhập ngày mời nghiệm thu.");
  const info = object(body.thong_tin ?? {});
  const prev = object(existing.thong_tin ?? {});
  const flag = (v: unknown) => (v === true || v === "1" || v === "true" ? "1" : "");
  const thong_tin = {
    ...prev,
    dia_diem: str(info.dia_diem),
    ben_moi: str(info.ben_moi),
    ben_nhan: str(info.ben_nhan),
    pham_vi: str(info.pham_vi),
    giam_sat: str(info.giam_sat ?? prev.giam_sat, 200),
    tuyen_thuong: flag(info.tuyen_thuong ?? prev.tuyen_thuong),
    tuyen_ha: flag(info.tuyen_ha ?? prev.tuyen_ha),
    gio_bat_dau: str(info.gio_bat_dau ?? prev.gio_bat_dau, 10),
  };
  if (prev.loai_rfi === "theo-doi" && !thong_tin.tuyen_thuong && !thong_tin.tuyen_ha && !thong_tin.giam_sat) throw new QualityApiError("Chọn tuyến hoặc nhập nội dung giám sát cho phiếu theo dõi.");
  const { error: upd } = await db().from("phieu_yeu_cau_nghiem_thu")
    .update({ so_phieu: soPhieu, ngay_moi: ngay, thong_tin })
    .eq("id", id);
  if (upd) throw upd;
  return { id };
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
  const inspections = await chunked<SavedWeldInspection>(
    links.map((l) => l.moi_han_id), (p) => db().from("kiem_tra_moi_han")
      .select("*").in("moi_han_id", p));
  const rules = await chunked<SavedWeldQualityRule>([...new Set(inspections.flatMap((i) => i.tieu_chuan_id ? [i.tieu_chuan_id] : []))],
    (p) => db().from("tieu_chuan_nghiem_thu_moi_han").select("*").in("id", p));
  const inspectionById = new Map(inspections.map((i) => [i.moi_han_id, i]));
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const missingLength = new Set(inspections.filter((i) => rules.find((r) => r.id === i.tieu_chuan_id)?.dung_sai?.chieu_dai_mai
    && i.gia_tri_do?.chieu_dai_mai == null).map((i) => i.moi_han_id));
  // Vị trí hiện trường của từng mối (lý trình + toạ độ) để phiếu có link dẫn thẳng tới mối.
  const points = await chunked<{ lich_su_moi_han_id: string; ma_diem: string | null; ly_trinh: string | null; kinh_do: number | null; vi_do: number | null }>(
    links.map((l) => l.moi_han_id), (p) => db().from("toa_do").select("lich_su_moi_han_id,ma_diem,ly_trinh,kinh_do,vi_do").in("lich_su_moi_han_id", p));
  const where = new Map<string, (typeof points)[number]>();
  for (const pt of points) { // ưu tiên điểm có toạ độ hợp lệ
    const cur = where.get(pt.lich_su_moi_han_id);
    if (!cur || (cur.vi_do == null && pt.vi_do != null)) where.set(pt.lich_su_moi_han_id, pt);
  }
  const welds = links.map((l) => ({ moi_han_id: l.moi_han_id, con_hieu_luc: l.con_hieu_luc,
    ma_lich_su: l.du_lieu_chot.moi_han?.ma_lich_su ?? "", ngay_thuc_hien: l.du_lieu_chot.moi_han?.ngay_thuc_hien ?? null,
    ly_trinh: where.get(l.moi_han_id)?.ly_trinh ?? null,
    ma_diem: where.get(l.moi_han_id)?.ma_diem ?? null,
    vi_do: where.get(l.moi_han_id)?.vi_do == null ? null : Number(where.get(l.moi_han_id)?.vi_do),
    kinh_do: where.get(l.moi_han_id)?.kinh_do == null ? null : Number(where.get(l.moi_han_id)?.kinh_do), phien_ban: q.get(l.moi_han_id)?.phien_ban ?? 0,
    tinh_trang: q.get(l.moi_han_id)?.tinh_trang ?? "", du_dieu_kien_nghiem_thu: q.get(l.moi_han_id)?.du_dieu_kien_nghiem_thu ?? false,
    thieu_chieu_dai_mai: missingLength.has(l.moi_han_id),
    chieu_dai_mai: inspectionById.get(l.moi_han_id)?.gia_tri_do.chieu_dai_mai ?? null,
    ket_qua_ndt: inspectionById.get(l.moi_han_id)?.ket_qua_ndt ?? null,
    ten_tieu_chuan: ruleById.get(inspectionById.get(l.moi_han_id)?.tieu_chuan_id ?? "")?.ten ?? null,
    ly_do_chua_du_dieu_kien: q.get(l.moi_han_id)?.du_dieu_kien_nghiem_thu ? "" :
      acceptanceIssues(inspectionById.get(l.moi_han_id) ?? null, ruleById.get(inspectionById.get(l.moi_han_id)?.tieu_chuan_id ?? "") ?? null).join(" ") ||
      acceptanceBlockReason(q.get(l.moi_han_id)?.tinh_trang ?? "", missingLength.has(l.moi_han_id)) }));
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
  const phieuId = qualityUuid(body.phieu_id);
  const { data: phieu, error: phieuError } = await db().from("phieu_yeu_cau_nghiem_thu").select("du_an_id,thong_tin,so_phieu,ngay_moi").eq("id", phieuId).single();
  if (phieuError) throw phieuError;
  const scope = rfiScope(phieu.thong_tin);
  const input = object(body.thong_tin ?? {});
  const info = { ...input, rfi_hinh_hoc_so: scope.geometry ? phieu.so_phieu : "", rfi_sieu_am_so: scope.ultrasound ? phieu.so_phieu : "" };
  for (const [kind, needed, field, numberField] of [
    ["hinh-hoc", !scope.geometry, "rfi_hinh_hoc_id", "rfi_hinh_hoc_so"],
    ["sieu-am", !scope.ultrasound, "rfi_sieu_am_id", "rfi_sieu_am_so"],
  ] as const) {
    if (!needed) continue;
    if (!input[field]) throw new QualityApiError(`Đề nghị cung cấp RFI ${kind === "hinh-hoc" ? "kích thước hình học" : "siêu âm"} trước khi hoàn thành và ký biên bản.`, 409);
    const reference = qualityUuid(input[field]);
    const { data: ticket, error } = await db().from("phieu_nt_tach").select("id,so_phieu,ngay_nghiem_thu")
      .eq("id", reference).eq("du_an_id", phieu.du_an_id).eq("loai", kind).single();
    if (error || !ticket?.ngay_nghiem_thu || ticket.ngay_nghiem_thu > ngay) throw new QualityApiError("RFI bổ sung phải đúng dự án, đúng loại và đã nghiệm thu trước ngày hoàn thành.", 409);
    const covered = await chunked<{ moi_han_id: string }>(ket_qua.filter(r => r.ket_qua === "Đạt").map(r => r.moi_han_id), part =>
      db().from("phieu_nt_tach_moi").select("moi_han_id").eq("phieu_id", reference).eq("ket_qua", "Đạt").in("moi_han_id", part));
    const ids = new Set(covered.map(r => r.moi_han_id));
    if (ket_qua.some(r => r.ket_qua === "Đạt" && !ids.has(r.moi_han_id))) throw new QualityApiError("RFI bổ sung chưa có kết quả Đạt cho đủ các mối được nghiệm thu trong biên bản.", 409);
    info[numberField] = ticket.so_phieu;
  }
  const id = await completeWeldAcceptance({ id: qualityUuid(body.id), phieu_id: phieuId, ngay_nghiem_thu: ngay,
    nguoi_lap: actor, ket_qua, thong_tin: info });
  return { id };
}

/** Số mối được chấp nhận trong các đợt nghiệm thu diễn ra vào ngày `date` (tách khỏi ngày hàn). */
export async function acceptedOnDate(body: Record<string, unknown>) {
  const date = qualityDate(body.date);
  if (!date) throw new QualityApiError("Nhập ngày cần xem.");
  const projectId = body.du_an_id ? qualityUuid(body.du_an_id) : null;
  const { data, error } = await db().rpc("dem_moi_nghiem_thu_da_ky", { p_ngay: date, p_du_an_id: projectId });
  if (error) throw error;
  return { count: Number(data ?? 0) };
}

export async function listRecords(projectId: string) {
  const data = await fetchAll((a, b) => db().from("dot_nghiem_thu")
    .select("id,ngay_nghiem_thu,nguoi_lap,thong_tin,created_at,phieu_yeu_cau_nghiem_thu!inner(id,so_phieu,du_an_id),ho_so_nghiem_thu(id,loai,tinh_trang_ky)")
    .eq("phieu_yeu_cau_nghiem_thu.du_an_id", projectId).order("created_at", { ascending: false }).order("id").range(a, b));
  const results = await chunkedPages<{ dot_id: string; moi_han_id: string; ket_qua: string }>(data.map((r) => r.id),
    (ids, a, b) => db().from("dot_nghiem_thu_moi").select("dot_id,moi_han_id,ket_qua").in("dot_id", ids).order("dot_id").order("moi_han_id").range(a, b));
  return data.map((r) => {
    const rows = results.filter((m) => m.dot_id === r.id);
    const draft = r.thong_tin?.draft === true;
    return { ...r, tong_moi: rows.length,
      da_nghiem_thu: draft ? 0 : rows.filter((m) => m.ket_qua === "Đạt").length,
      khong_dat: draft ? 0 : rows.filter((m) => m.ket_qua === "Không đạt").length,
      chua_nghiem_thu: draft ? rows.length : rows.filter((m) => m.ket_qua === "Chưa nghiệm thu").length };
  });
}

export async function loadRecordSet(dotId: string) {
  const [dot, docs, welds, revisions] = await Promise.all([
    db().from("dot_nghiem_thu").select("*,phieu_yeu_cau_nghiem_thu(*,du_an(*))").eq("id", dotId).single(),
    db().from("ho_so_nghiem_thu").select("*").eq("dot_id", dotId).order("loai"),
    db().from("dot_nghiem_thu_moi").select("*").eq("dot_id", dotId),
    db().from("ho_so_nghiem_thu_sua_doi").select("*,ho_so_nghiem_thu!inner(dot_id)").eq("ho_so_nghiem_thu.dot_id", dotId).order("phien_ban"),
  ]);
  for (const r of [dot, docs, welds, revisions]) if (r.error) throw r.error;
  // Bản chốt có thể được lập trước khi mối hàn gắn điểm GPS → bổ sung mã điểm / lý trình còn trống từ toa_do.
  type Snap = { moi_han?: Record<string, unknown> };
  const weldRows = (welds.data ?? []) as { moi_han_id: string; du_lieu_chot: Snap | null }[];
  const needsPoint = weldRows.filter((w) => !w.du_lieu_chot?.moi_han?.ma_diem || !w.du_lieu_chot?.moi_han?.ly_trinh).map((w) => w.moi_han_id);
  if (needsPoint.length) {
    const points = await chunkedPages<{ lich_su_moi_han_id: string; ma_diem: string | null; ly_trinh: string | null }>(
      [...new Set(needsPoint)],
      (ids, a, b) => db().from("toa_do").select("lich_su_moi_han_id,ma_diem,ly_trinh").in("lich_su_moi_han_id", ids).order("id").range(a, b));
    const live = new Map<string, { ma_diem: string | null; ly_trinh: string | null }>();
    for (const p of points) {
      const cur = live.get(p.lich_su_moi_han_id);
      live.set(p.lich_su_moi_han_id, { ma_diem: cur?.ma_diem || p.ma_diem, ly_trinh: cur?.ly_trinh || p.ly_trinh });
    }
    for (const w of weldRows) {
      const p = live.get(w.moi_han_id);
      if (!p) continue;
      const snap = w.du_lieu_chot ?? {};
      const mh = { ...(snap.moi_han ?? {}) };
      if (!mh.ma_diem && p.ma_diem) mh.ma_diem = p.ma_diem;
      if (!mh.ly_trinh && p.ly_trinh) mh.ly_trinh = p.ly_trinh;
      w.du_lieu_chot = { ...snap, moi_han: mh };
    }
  }
  return { dot: dot.data, ho_so: docs.data, moi: weldRows, sua_doi: revisions.data };
}

/** Thêm bản sửa đổi thông tin in (địa điểm, thành phần…); không đụng tới dữ liệu chốt. */
export async function reviseRecord(body: Record<string, unknown>, actor: string) {
  const hoSoId = qualityUuid(body.ho_so_id);
  const lyDo = str(body.ly_do, 1000);
  if (!lyDo) throw new QualityApiError("Cần nêu lý do sửa đổi.");
  const t = object(body.thong_tin);
  const thong_tin: Record<string, string> = { dia_diem: str(t.dia_diem, 300), thanh_phan: str(t.thanh_phan, 1000) };
  // Nội dung tự nhập của BB nghiệm thu hoàn thành (mục 5 a–g).
  for (const key of ["tai_lieu_can_cu", "danh_gia_chat_luong", "dieu_chinh", "so_voi_thiet_ke", "so_voi_hop_dong", "ket_qua_thi_nghiem", "tuan_thu_phccc", "y_kien_khac"]) {
    if (key in t) thong_tin[key] = str(t[key], 3000);
  }
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
  let dotId = body.dot_id ? qualityUuid(body.dot_id) : "";
  if (!dotId) {
    const { data, error } = await db().from("ho_so_nghiem_thu").select("dot_id").eq("id", qualityUuid(body.id)).single();
    if (error) throw error;
    dotId = data.dot_id;
  }
  const { error } = await db().rpc("ky_bo_ho_so_moi_han", { p_dot_id: dotId, p_tinh_trang_ky: body.tinh_trang_ky });
  if (error) throw error;
  return { ok: true, count: 3 };
}

/** Separate records share inspection data with the original workflow, but own their RIF/RFI and results. */
export async function splitAcceptance(body: Record<string, unknown>, actor: string) {
  const project = qualityUuid(body.du_an_id);
  const kind = body.loai;
  if (kind !== "hinh-hoc" && kind !== "sieu-am") throw new QualityApiError("Loại nghiệm thu không hợp lệ.");
  if (body.action === "split-list") {
    const [candidates, tickets] = await Promise.all([
      fetchAll((a,b) => db().from("moi_cho_phieu_nt_tach").select("moi_han_id,ma_lich_su,da_nt_truc_quan,ngay_mai")
        .eq("du_an_id",project).eq("loai",kind).order("ma_lich_su").order("moi_han_id").range(a,b)),
      fetchAll((a,b) => db().from("phieu_nt_tach").select("id,so_phieu,ngay_moi,ngay_nghiem_thu,nguoi_lap,nguoi_nghiem_thu")
        .eq("du_an_id",project).eq("loai",kind).order("ngay_moi",{ascending:false}).order("so_phieu").range(a,b)),
    ]);
    return { candidates, tickets };
  }
  const id = qualityUuid(body.id);
  if (body.action === "split-publish") {
    const ids = body.moi_han_ids, number = str(body.so_phieu,80), date = qualityDate(body.ngay_moi);
    if (!Array.isArray(ids) || !ids.length || ids.length > 200 || !number || !date)
      throw new QualityApiError("Nhập số phiếu, ngày mời và chọn 1–200 mối.");
    const { error } = await db().rpc("phat_phieu_nt_tach", { p_id:id, p_du_an:project, p_loai:kind,
      p_so:number, p_ngay:date, p_moi:ids.map(qualityUuid), p_actor:actor });
    if (error?.code === "23505") throw new QualityApiError("Số phiếu hoặc mối đã được dùng trong nhánh này.",409);
    if (error) throw error;
    return { id };
  }
  const ticket = await db().from("phieu_nt_tach").select("*").eq("id",id).eq("du_an_id",project).eq("loai",kind).single();
  if (ticket.error) throw ticket.error;
  if (body.action === "split-detail") {
    const rows = await db().from("phieu_nt_tach_moi").select("moi_han_id,ma_lich_su,ket_qua,ly_do,du_lieu_chot")
      .eq("phieu_id",id).order("ma_lich_su");
    if (rows.error) throw rows.error;
    const points = await chunked<{ lich_su_moi_han_id: string; ma_diem: string | null; ly_trinh: string | null }>(
      rows.data.map(r => r.moi_han_id), part => db().from("toa_do").select("lich_su_moi_han_id,ma_diem,ly_trinh").in("lich_su_moi_han_id", part));
    const locations = new Map(points.map(p => [p.lich_su_moi_han_id, p]));
    const items = rows.data.map(r => ({ ...r, ma_diem: locations.get(r.moi_han_id)?.ma_diem ?? null, ly_trinh: locations.get(r.moi_han_id)?.ly_trinh ?? null }));
    if (!ticket.data.ngay_nghiem_thu && items.length) {
      const ids = items.map(r => r.moi_han_id);
      const [eligible, inspections] = await Promise.all([
        chunked<{moi_han_id:string; co_the_dat:boolean}>(ids, part => db().from("ung_vien_nt_tach").select("*").eq("loai",kind).eq("du_an_id",project).in("moi_han_id",part)),
        chunked<{moi_han_id:string; phien_ban:number}>(ids, part => db().from("kiem_tra_moi_han").select("moi_han_id,phien_ban").in("moi_han_id",part)),
      ]);
      const evidence = new Map(eligible.map(r => [r.moi_han_id,r]));
      const versions = new Map(inspections.map(r => [r.moi_han_id,r.phien_ban]));
      return { ticket:ticket.data, items:items.map(r => ({...r, current:evidence.get(r.moi_han_id) ?? null, version:versions.get(r.moi_han_id)})) };
    }
    return { ticket:ticket.data, items };
  }
  if (body.action !== "split-complete") throw new QualityApiError("Thao tác không hợp lệ.");
  const date = qualityDate(body.ngay_nghiem_thu);
  if (!date || !Array.isArray(body.results) || !body.results.length || body.results.length>200)
    throw new QualityApiError("Nhập ngày và kết quả nghiệm thu cho từng mối.");
  const results = body.results.map(v => {
    const r = object(v), reason = str(r.ly_do,1000);
    if (!Number.isInteger(r.phien_ban) || (r.ket_qua!=="Đạt" && r.ket_qua!=="Không đạt") || (r.ket_qua==="Không đạt" && !reason))
      throw new QualityApiError("Kết quả hoặc lý do không hợp lệ.");
    return { id:qualityUuid(r.id), phien_ban:r.phien_ban, ket_qua:r.ket_qua, ly_do:reason };
  });
  const { error } = await db().rpc("chot_phieu_nt_tach",{p_id:id,p_ngay:date,p_ket_qua:results,p_actor:actor});
  if (error) throw error;
  return { id };
}
