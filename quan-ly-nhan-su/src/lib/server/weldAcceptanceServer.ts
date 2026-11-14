import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { QualityApiError } from "@/lib/server/weldQualityAuth";
import { object, qualityDate, qualityUuid } from "@/lib/server/weldQualityJournal";
import { completeWeldAcceptance, publishWeldRfi } from "@/lib/server/weldQualityDb";
import { rfiScope, rfiChildSigning, SIGNER_KEYS, acceptanceBlockReason, filterRfiCandidates, isRfiEligibleStatus, rfiBlockReason, validateMonitoringRange, type RfiCandidate } from "@/lib/weldAcceptance";
import { summarizeRfiWelds } from "@/lib/rfiTracking";
import { fieldWeldCode } from "@/lib/weldCode";
import { deleteGtusThanh, snapshotGtusThanh } from "@/lib/server/gtusServer";
import { acceptanceIssues, evaluateGeometry, hasRequiredGrindingLength, type SavedWeldInspection, type SavedWeldQualityRule } from "@/lib/weldQuality";
import { diaryWorkText, diaryManpowerDefaults, diaryStressReleaseText, diaryReportWorkText, diaryReportEquipmentText, diaryMachineName, type DiaryWork } from "@/lib/constructionDiaryAuto";
import { loadProjectEquipment } from "@/lib/server/projectEquipment";
import { projectEquipmentText } from "@/lib/projectEquipment";
import { readPrivateJson } from "@/lib/server/privateJsonStorage";
import type { ProjectMetadataStore } from "@/data/projectMetadata";
import { validateTrackLayout } from "@lwr/lib/track-editor";
import { listPayments } from "@/lib/server/weldPayment";

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
  // RFI báo trong ngày (phiếu chính + phiếu tách hình học/siêu âm) và kết quả nghiệm thu phiếu tách trong ngày → vào nhật ký thi công.
  const [mainRfis, splitRfis, splitDone] = await Promise.all([
    fetchAll<{ id: string; so_phieu: string; thong_tin: Record<string, unknown> | null }>((a, b) => db().from("phieu_yeu_cau_nghiem_thu")
      .select("id,so_phieu,thong_tin").eq("du_an_id", projectId).eq("ngay_moi", date).neq("trang_thai", "Đã huỷ").order("so_phieu").range(a, b)).then((rows) => rows.filter((r) => !(r.thong_tin as Record<string, unknown> | null)?.pending)),
    fetchAll<{ id: string; so_phieu: string; loai: string }>((a, b) => db().from("phieu_nt_tach")
      .select("id,so_phieu,loai").eq("du_an_id", projectId).eq("ngay_moi", date).order("so_phieu").range(a, b)),
    fetchAll<{ moi_han_id: string; loai: string; ket_qua: string | null; phieu_nt_tach: { du_an_id: string; ngay_nghiem_thu: string | null } | { du_an_id: string; ngay_nghiem_thu: string | null }[] }>((a, b) => db().from("phieu_nt_tach_moi")
      .select("moi_han_id,loai,ket_qua,phieu_nt_tach!inner(du_an_id,ngay_nghiem_thu)").eq("phieu_nt_tach.du_an_id", projectId).eq("phieu_nt_tach.ngay_nghiem_thu", date).not("ket_qua", "is", null).order("moi_han_id").range(a, b)),
  ]);
  const [mainRfiWelds, splitRfiWelds] = await Promise.all([
    chunked<{ phieu_id: string; moi_han_id: string }>(mainRfis.map((r) => r.id), (p) => db().from("phieu_yeu_cau_nghiem_thu_moi").select("phieu_id,moi_han_id").in("phieu_id", p)),
    chunked<{ phieu_id: string; moi_han_id: string }>(splitRfis.map((r) => r.id), (p) => db().from("phieu_nt_tach_moi").select("phieu_id,moi_han_id").in("phieu_id", p)),
  ]);
  const ids = [...new Set([...welds.map((w) => w.id), ...ground.map((w) => w.moi_han_id), ...accepted.map((w) => w.moi_han_id),
    ...mainRfiWelds.map((w) => w.moi_han_id), ...splitRfiWelds.map((w) => w.moi_han_id), ...splitDone.map((w) => w.moi_han_id)])];
  const [all, points] = await Promise.all([
    chunked<DiaryWork>(ids, (p) => db().from("lich_su_moi_han").select("id,ma_lich_su,cong_nghe_han,so_luong_thuc_hien,ly_trinh,ma_hien_truong").eq("du_an_id", projectId).in("id", p)),
    chunked<{ lich_su_moi_han_id: string; ma_diem: string; ly_trinh: string | null }>(ids, (p) => db().from("toa_do")
      .select("lich_su_moi_han_id,ma_diem,ly_trinh").in("lich_su_moi_han_id", p).order("id")),
  ]);
  void [accepted, splitRfis, splitRfiWelds]; // nhật ký lấy RFI chính phát trong ngày và nghiệm thu đã chốt trong ngày
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
  // Giải toả ứng suất (GTUS) chỉ vào nhật ký vào NGÀY NGHIỆM THU từng thanh; phát phiếu không vào nhật ký.
  type GtusDone = { phieu_id: string; ma_thanh: string; ma_lwr: string | null; ket_qua: string | null; ly_trinh_dau: string; ly_trinh_cuoi: string };
  const gtusRaw = await db().from("gtus_thanh_rfi").select("phieu_id,ma_thanh,ma_lwr,ket_qua,ly_trinh_dau,ly_trinh_cuoi")
    .eq("ngay_nghiem_thu", date).not("ket_qua", "is", null);
  let gtusDone: GtusDone[] = gtusRaw.error ? [] : (gtusRaw.data as GtusDone[]); // chưa có bảng → không có dữ liệu GTUS
  if (gtusDone.length) {
    const owners = await chunked<{ id: string; du_an_id: string }>([...new Set(gtusDone.map((g) => g.phieu_id))], (p) =>
      db().from("phieu_yeu_cau_nghiem_thu").select("id,du_an_id").in("id", p));
    const mine = new Set(owners.filter((o) => o.du_an_id === projectId).map((o) => o.id));
    gtusDone = gtusDone.filter((g) => mine.has(g.phieu_id));
  }
  const kmMetres = (v: string) => { const m = /(\d+)\+(\d+(?:[.,]\d+)?)/.exec(v); return m ? Number(m[1]) * 1000 + Number(m[2].replace(",", ".")) : Number.NaN; };
  /** Mỗi phiếu / kết quả một dòng: tên LWR của các thanh và đoạn Km. */
  const gtusLines = (withResult: boolean) => [...new Set(gtusDone.map((g) => g.phieu_id))].flatMap((phieu) =>
    (withResult ? ["Đạt", "Không đạt"] : [null]).flatMap((result) => {
      const rows = gtusDone.filter((g) => g.phieu_id === phieu && (result === null || g.ket_qua === result));
      if (!rows.length) return [];
      const names = [...new Set(rows.map((g) => g.ma_lwr || g.ma_thanh))].join(", ");
      const starts = rows.map((g) => kmMetres(g.ly_trinh_dau)).filter(Number.isFinite), ends = rows.map((g) => kmMetres(g.ly_trinh_cuoi)).filter(Number.isFinite);
      const from = rows.find((g) => kmMetres(g.ly_trinh_dau) === Math.min(...starts))?.ly_trinh_dau, to = rows.find((g) => kmMetres(g.ly_trinh_cuoi) === Math.max(...ends))?.ly_trinh_cuoi;
      const range = from && to ? ` (Km${from} – Km${to})` : "";
      return [withResult ? `- Nghiệm thu giải toả ứng suất ray ${names}${range}. Kết quả: ${result}.` : `- Giải toả ứng suất ray ${names}${range}.`];
    }));
  return {
    ...diaryManpowerDefaults(),
    thietBi: diaryReportEquipmentText(reportEquipment) || projectEquipmentText(equipment.map((m) => m.group === "welding" ? { ...m, name: diaryMachineName(m.name), model: "" } : m)),
    // Mục hàn lấy theo báo cáo ngày nếu có; mài ray, RFI báo trong ngày và giải tỏa ứng suất luôn được ghép thêm (không bị báo cáo ngày che mất).
    // 3.1 Công việc thực hiện trong ngày (theo Nhật ký hàn): Hàn ray · Mài ray · Giải toả ứng suất (chỉ khi có RFI GTUS phát trong ngày).
    noiDungCongViec: [
      diaryReportWorkText(reports, select(welds.map((w) => w.id))) || diaryWorkText(select(welds.map((w) => w.id)), "weld"),
      diaryWorkText(select(ground.map((w) => w.moi_han_id)), "grind"),
      ...gtusLines(false),
    ].filter(Boolean).join("\n") || "Chuẩn bị mặt bằng thi công.",
    // 3.2 Nghiệm thu công việc xây dựng hàng ngày = nghiệm thu đã chốt trong ngày (hình học / siêu âm, kể cả của RFI phát ngày trước); không có thì để trống.
    nghiemThuHangNgay: [
      ...(["hinh-hoc", "sieu-am"] as const).flatMap((loai) => ["Đạt", "Không đạt"].map((result) => {
        const text = diaryWorkText(select(splitDone.filter((w) => w.loai === loai && w.ket_qua === result).map((w) => w.moi_han_id)), "accept", `Nghiệm thu ${loai === "sieu-am" ? "siêu âm" : "kích thước hình học, trực quan"} mối hàn`);
        return text ? text.split("\n").map((line) => `${line} Kết quả: ${result}.`).join("\n") : "";
      })),
      ...gtusLines(true),
    ].filter(Boolean).join("\n"),
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
  const [rfis, candidates, so_phieu] = await Promise.all([
    listRfis(projectId), loadRfiCandidates({ du_an_id: projectId, filters: {} }), nextRfiNumber(projectId),
  ]);
  return { rfis, candidates, so_phieu };
}

/**
 * Số phiếu kế tiếp = số lớn nhất đang dùng + 1.
 * - RFI chính: RFI-001… (tính cả phiếu tách cũ đánh số kiểu RFI-007 để không trùng).
 * - Phiếu hình học tách: RFI-HH-001…; phiếu siêu âm tách: RFI-SA-001… (mỗi loại một dãy riêng).
 */
export async function nextRfiNumber(projectId: string, kind?: "hinh-hoc" | "sieu-am") {
  const prefix = kind === "hinh-hoc" ? "RFI-HH-" : kind === "sieu-am" ? "RFI-SA-" : "RFI-";
  const [main, split] = await Promise.all([
    kind ? Promise.resolve([] as { so_phieu: string | null }[])
      : fetchAll<{ so_phieu: string | null }>((a, b) => db().from("phieu_yeu_cau_nghiem_thu").select("so_phieu").eq("du_an_id", projectId).order("id").range(a, b)),
    fetchAll<{ so_phieu: string | null }>((a, b) => {
      const q = db().from("phieu_nt_tach").select("so_phieu").eq("du_an_id", projectId);
      return (kind ? q.eq("loai", kind) : q).order("id").range(a, b);
    }),
  ]);
  const pattern = kind ? new RegExp(`^${prefix}(\\d+)$`, "i") : /^RFI-(\d+)(?:-(?:\d+|GTUS))?$/i;
  let highest = 0;
  for (const row of [...main, ...split]) {
    const match = pattern.exec((row.so_phieu ?? "").trim());
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}

export async function publishRfi(body: Record<string, unknown>, actor: string) {
  if (body.loai_rfi === "theo-doi") {
    const range = object(body.filters ?? {});
    const fields = { nameFrom: str(range.nameFrom, 100), nameTo: str(range.nameTo, 100), kmFrom: str(range.kmFrom, 40), kmTo: str(range.kmTo, 40) };
    // Phiếu GTUS chọn theo thanh ray trên track map: không cần khoảng mối / Km.
    const isGtus = object(body.thong_tin ?? {}).cong_viec === "gtus";
    if (!isGtus) { try { validateMonitoringRange(fields); } catch (error) { throw new QualityApiError((error as Error).message); } }
    const date = qualityDate(body.ngay_moi), number = str(body.so_phieu, 80);
    if (!date || !number) throw new QualityApiError("Nhập ngày mời và số phiếu RFI.");
    const info = object(body.thong_tin ?? {});
    const flag = (v: unknown) => (v === true || v === "1" || v === "true" ? "1" : "");
    const giam_sat = str(info.giam_sat, 200);
    if (!flag(info.tuyen_thuong) && !flag(info.tuyen_ha) && !giam_sat) throw new QualityApiError("Chọn tuyến hoặc nhập nội dung giám sát cho phiếu theo dõi.");
    const payload = { id: qualityUuid(body.id), du_an_id: qualityUuid(body.du_an_id), so_phieu: number, ngay_moi: date, nguoi_lap: actor,
      thong_tin: { dia_diem: str(info.dia_diem), ben_moi: str(info.ben_moi), ben_nhan: str(info.ben_nhan), pham_vi: str(info.pham_vi), giam_sat,
        tuyen_thuong: flag(info.tuyen_thuong), tuyen_ha: flag(info.tuyen_ha), gio_bat_dau: str(info.gio_bat_dau, 10),
        loai_rfi: "theo-doi", cong_viec: info.cong_viec === "gtus" ? "gtus" : "", ...fields } };
    if (payload.thong_tin.cong_viec === "gtus") {
      const ids = String(info.lwr_ids ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      if (!ids.length || ids.length > 50) throw new QualityApiError("Chọn 1–50 thanh LWR đã hoàn thành để phát phiếu giải toả ứng suất.");
      const { candidates } = await listGtusCandidates({ du_an_id: payload.du_an_id, exclude_rfi_id: payload.id });
      const eligible = new Map(candidates.map((c) => [c.id, c]));
      const bad = ids.find((id) => !eligible.has(id) || eligible.get(id)!.used);
      if (bad) throw new QualityApiError("Có thanh LWR chưa đủ điều kiện hoặc đã nằm trong phiếu giải toả ứng suất khác. Bấm Tải lại để cập nhật danh sách.", 409);
      Object.assign(payload.thong_tin, { lwr_ids: ids.join(","), lwr_codes: ids.map((id) => eligible.get(id)!.lwr).join(", ") });
      // Lưu danh sách thanh của phiếu (chụp lý trình, chiều dài) để nghiệm thu và thanh toán từng thanh — như mối hàn của RFI nghiệm thu.
      await snapshotGtusThanh(payload.id, ids.map((thanhId) => {
        const c = eligible.get(thanhId)!;
        return { thanh_id: c.id, ma_thanh: c.code, route: c.route, ray: c.rail, ly_trinh_dau: c.from, ly_trinh_cuoi: c.to, chieu_dai: c.lengthMetres, ma_lwr: c.lwr };
      }));
    }
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
  if (explicitScope) {
    if (ids.length > 200) throw new QualityApiError("Chọn tối đa 200 mối cho một phiếu hình học hoặc siêu âm.");
    const accepted = await geometryAcceptedTickets(qualityUuid(body.du_an_id), ids.map(qualityUuid));
    if (!geometry && ids.some((id) => !accepted.has(qualityUuid(id)))) {
      throw new QualityApiError("Phiếu chỉ siêu âm cần các mối đã nghiệm thu hình học Đạt. Chọn cả hai nội dung cho các mối chưa nghiệm thu hình học.");
    }
    if (geometry && accepted.size) {
      throw new QualityApiError("Danh sách có mối đã nghiệm thu hình học Đạt. Phát phiếu chỉ siêu âm riêng cho các mối này.");
    }
  }
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
  const parentId = qualityUuid(body.id), weldIds = ids.map(qualityUuid);
  // Mỗi mối chỉ nằm trong một phiếu hình học / siêu âm đang xử lý: báo rõ phiếu nào đang giữ mối thay vì lỗi ràng buộc của CSDL.
  const kinds = [geometry ? "hinh-hoc" : "", ultrasound ? "sieu-am" : ""].filter(Boolean);
  const held = await chunkedPages<{ moi_han_id: string; ma_lich_su: string; phieu_id: string; loai: string; ket_qua: string | null }>(weldIds, (part, from, to) => db()
    .from("phieu_nt_tach_moi").select("moi_han_id,ma_lich_su,phieu_id,loai,ket_qua").in("moi_han_id", part).in("loai", kinds)
    .order("moi_han_id").order("phieu_id").range(from, to));
  const active = held.filter((row) => row.ket_qua !== "Không đạt");
  if (active.length) {
    const tickets = await db().from("phieu_nt_tach").select("id,so_phieu,phieu_rfi_id").in("id", [...new Set(active.map((row) => row.phieu_id))]);
    if (tickets.error) throw tickets.error;
    const info = new Map(tickets.data.map((t) => [t.id as string, t]));
    const blocking = active.filter((row) => info.get(row.phieu_id)?.phieu_rfi_id !== parentId);
    if (blocking.length) {
      const numbers = [...new Set(blocking.map((row) => info.get(row.phieu_id)?.so_phieu ?? "?"))].join(", ");
      const welds = blocking.slice(0, 3).map((row) => fieldWeldCode(row.ma_lich_su)).join(", ");
      throw new QualityApiError(`${blocking.length} mối đã nằm trong phiếu đang xử lý (${numbers}), ví dụ ${welds}. Mở phiếu đó để nghiệm thu, hoặc xóa phiếu cũ trước khi phát phiếu mới.`, 409);
    }
  }
  let id: string;
  try {
    id = await publishWeldRfi({ id: parentId, du_an_id: qualityUuid(body.du_an_id), so_phieu: soPhieu, ngay_moi: ngay,
      moi_han_ids: weldIds, nguoi_lap: actor, thong_tin });
  } catch (error) {
    if (error instanceof Error && /nt_tach_moi_dang_xu_ly/.test(error.message)) throw new QualityApiError("Có mối đã nằm trong một phiếu hình học hoặc siêu âm khác đang xử lý. Bấm Tải lại để cập nhật danh sách mối.", 409);
    throw error;
  }
  return { id };
}

async function childSigningByRfi(parentIds: string[]) {
  type Child = { phieu_rfi_id: string; loai: string; ngay_nghiem_thu: string | null; da_ky: boolean | null };
  const rows = await chunkedPages<Child>(parentIds, (ids, a, b) => db().from("phieu_nt_tach")
    .select("phieu_rfi_id,loai,ngay_nghiem_thu,da_ky").in("phieu_rfi_id", ids).order("id").range(a, b));
  const groups = new Map<string, Child[]>();
  for (const row of rows) {
    const group = groups.get(row.phieu_rfi_id) ?? [];
    group.push(row);
    groups.set(row.phieu_rfi_id, group);
  }
  return new Map([...groups].map(([id, children]) => [id, rfiChildSigning(children)]));
}

/** Nội dung in nhập tay của phiếu yêu cầu (đối tượng nghiệm thu, nội dung vị trí, ngày giờ, Km) — lưu theo phiếu, dùng chung mọi máy. */
const PRINT_INFO_KEYS = ["doi_tuong", "noi_dung", "ngay_nt", "gio", "km_dau", "km_cuoi", "so_phieu", "ngay_lap", "noi_lap", "ngay_nhan", "dia_diem", "hang_muc", "nguoi_nhan", "chuc_vu_nhan", "kinh_gui", "ntp_ten", "ntp_chuc_vu", "ntc_ten", "ntc_chuc_vu"] as const;
export async function saveRfiPrintInfo(body: Record<string, unknown>) {
  const id = qualityUuid(body.id);
  const values = object(body.values ?? {});
  // Phiếu in có thể là RFI cha (tab 1) hoặc phiếu hình học / siêu âm (tab 2, 3): lưu vào đúng bảng của phiếu.
  let table: "phieu_yeu_cau_nghiem_thu" | "phieu_nt_tach" = "phieu_yeu_cau_nghiem_thu";
  let found = await db().from(table).select("thong_tin").eq("id", id).maybeSingle();
  if (found.error) throw found.error;
  if (!found.data) {
    table = "phieu_nt_tach";
    found = await db().from(table).select("thong_tin").eq("id", id).maybeSingle();
    if (found.error) throw found.error;
    if (!found.data) throw new QualityApiError("Không tìm thấy phiếu để lưu.", 404);
  }
  const thong_tin: Record<string, unknown> = { ...(found.data.thong_tin ?? {}) };
  for (const key of PRINT_INFO_KEYS) {
    const value = str(values[key], 2000);
    if (value) thong_tin[`in_${key}`] = value; else delete thong_tin[`in_${key}`];
  }
  const { error: updateError } = await db().from(table).update({ thong_tin }).eq("id", id);
  if (updateError) throw updateError;
  return { id };
}

/**
 * Thanh ray đủ điều kiện phát RFI giải toả ứng suất = thanh MÀU XÁM trên track map của dự án (sơ đồ lwr_track_layouts):
 * đã rải (placed) và chưa giải toả (released). Lý trình đầu / cuối lấy đúng từ thanh (cell.from → cell.to).
 * Thanh nằm trong RFI GTUS khác thì đánh dấu "used".
 */
export async function listGtusCandidates(body: Record<string, unknown>) {
  const projectId = qualityUuid(body.du_an_id);
  const layoutRow = await db().from("lwr_track_layouts").select("layout").eq("project_id", projectId).maybeSingle();
  if (layoutRow.error) throw layoutRow.error;
  type Cell = { id?: unknown; from?: unknown; to?: unknown; placed?: unknown; released?: unknown };
  type Row = { line?: unknown; rail?: unknown; cells?: Cell[] };
  const layout = (layoutRow.data?.layout ?? {}) as { rows?: Row[]; longRails?: Record<string, unknown>[] };
  const used = new Map<string, string>();
  const rfis = await db().from("phieu_yeu_cau_nghiem_thu").select("id,so_phieu,thong_tin").eq("du_an_id", projectId).limit(2000);
  if (rfis.error) throw rfis.error;
  for (const rfi of rfis.data) {
    const info = (rfi.thong_tin ?? {}) as Record<string, unknown>;
    if (info.cong_viec !== "gtus" || rfi.id === body.exclude_rfi_id) continue; // phát lại cùng yêu cầu (retry) không tự chặn chính nó
    for (const id of String(info.lwr_ids ?? "").split(",").filter(Boolean)) used.set(id, String(rfi.so_phieu));
  }
  const metres = (value: unknown) => {
    const m = /(\d+)\+(\d+(?:[.,]\d+)?)/.exec(String(value ?? ""));
    return m ? Number(m[1]) * 1000 + Number(m[2].replace(",", ".")) : NaN;
  };
  const display = (id: string) => id.replace(/^(UT|UP|DT|DP)/i, (p) => ({ UT: "TT", UP: "TP", DT: "HT", DP: "HP" } as Record<string, string>)[p.toUpperCase()] ?? p);
  const prefixOf = (row: Row) => {
    const line = String(row.line ?? ""), rail = String(row.rail ?? "");
    return /hạ/i.test(line) ? (/phải/i.test(rail) ? "DP" : "DT") : (/phải/i.test(rail) ? "UP" : "UT");
  };
  // Tên LWR: thanh nằm trong đoạn LWR đã lập thì dùng mã đó; thanh chưa có đoạn LWR được đặt tên dự kiến chạy liên tiếp 1→n riêng từng ray
  // (HT0002, HT0003… tiếp theo mã lớn nhất đã dùng của ray đó) để mọi thanh đều có tên.
  const nextNumber = new Map<string, number>();
  for (const rail of layout.longRails ?? []) {
    const m = /^(?:HT|HP|TT|TP)(\d+)$/i.exec(String(rail.code ?? "").trim());
    const key = String(rail.rowKey);
    if (m) nextNumber.set(key, Math.max(nextNumber.get(key) ?? 0, Number(m[1])));
  }
  const candidates = (layout.rows ?? []).flatMap((row) => {
    const prefix = prefixOf(row);
    return (row.cells ?? []).flatMap((cell) => {
      if (!cell.placed || cell.released) return [];
      const start = metres(cell.from), end = metres(cell.to);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
      const id = String(cell.id ?? "");
      if (!id) return [];
      const lwr = (layout.longRails ?? []).find((rail) =>
        String(rail.rowKey) === prefix && Number(rail.startMetres) < end && Number(rail.endMetres) > start);
      let lwrName = lwr ? String(lwr.code ?? "") : "";
      if (!lwrName) {
        const n = (nextNumber.get(prefix) ?? 0) + 1;
        nextNumber.set(prefix, n);
        lwrName = `${display(prefix)}${String(n).padStart(4, "0")}`;
      }
      const adjust = Number.isFinite(Number((cell as { lengthAdjust?: unknown }).lengthAdjust)) ? Number((cell as { lengthAdjust?: unknown }).lengthAdjust) : 0;
      return [{
        id, code: display(id), lwr: lwrName, lwrPlanned: !lwr,
        lengthMetres: Math.round((end - start + adjust) * 1000) / 1000, // chiều dài ray = lý trình cuối − đầu + điều chỉnh
        route: /hạ/i.test(String(row.line ?? "")) ? "ha" as const : "thuong" as const,
        rail: /phải/i.test(String(row.rail ?? "")) ? "phai" as const : "trai" as const,
        startMetres: start, endMetres: end, from: String(cell.from), to: String(cell.to),
        used: used.get(id) ?? null,
      }];
    });
  });
  candidates.sort((a, b) => Number(a.route === "thuong") - Number(b.route === "thuong") || a.startMetres - b.startMetres || a.rail.localeCompare(b.rail));
  return { candidates };
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
  const [results, docs, points, signing] = await Promise.all([
    chunkedPages<{ dot_id: string; moi_han_id: string; ket_qua: string; du_lieu_chot: Snapshot }>(completed.map((d) => d.id),
      (ids, a, b) => db().from("dot_nghiem_thu_moi").select("dot_id,moi_han_id,ket_qua,du_lieu_chot").in("dot_id", ids).order("dot_id").order("moi_han_id").range(a, b)),
    chunkedPages<{ dot_id: string; loai: string; tinh_trang_ky: string }>(completed.map((d) => d.id),
      (ids, a, b) => db().from("ho_so_nghiem_thu").select("dot_id,loai,tinh_trang_ky").in("dot_id", ids).order("id").range(a, b)),
    chunkedPages<{ lich_su_moi_han_id: string; ma_diem: string; ly_trinh: string | null }>([...new Set(links.map((l) => l.moi_han_id))],
      (ids, a, b) => db().from("toa_do").select("lich_su_moi_han_id,ma_diem,ly_trinh").in("lich_su_moi_han_id", ids).order("id").range(a, b)),
    childSigningByRfi(rfis.map(r => r.id)),
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
    return { ...r, child_signing: signing.get(r.id), tong_moi: linked.length, con_lai: linked.filter((l) => l.con_hieu_luc).length, tracking };
  });
}

/** Sửa thông tin phiếu YCNT/RFI đã phát (không đổi danh sách mối đã chốt). */
/**
 * Pending / phát lại phiếu (RFI chính, GTUS, phiếu tách hình học / siêu âm).
 * - "hoan": huỷ hoặc không thực hiện nghiệm thu → phiếu giữ nguyên số, mối vẫn gắn phiếu (không bị phát sang phiếu khác), chờ phát lại.
 * - "phat-lai": đặt ngày mời mới (số phiếu giữ nguyên), bỏ trạng thái pending; ngày cũ + lý do được lưu vào lịch sử phát.
 * Chỉ ghi trong thong_tin (và ngay_moi khi phát lại) nên không cần migration.
 */
export async function setRfiPending(body: Record<string, unknown>, actor: string) {
  const id = qualityUuid(body.id);
  const table = body.kind === "tach" ? "phieu_nt_tach" : "phieu_yeu_cau_nghiem_thu";
  const action = body.hanh_dong === "phat-lai" ? "phat-lai" : body.hanh_dong === "hoan" ? "hoan" : "";
  if (!action) throw new QualityApiError("Hành động không hợp lệ.");
  const cols = table === "phieu_nt_tach" ? "id,so_phieu,ngay_moi,ngay_nghiem_thu,thong_tin" : "id,so_phieu,ngay_moi,thong_tin";
  const { data: row, error } = await db().from(table).select(cols).eq("id", id).single();
  if (error || !row) throw new QualityApiError("Không tìm thấy phiếu.", 404);
  const current = row as unknown as { so_phieu: string; ngay_moi: string; ngay_nghiem_thu?: string | null; thong_tin: Record<string, unknown> | null };
  const info = { ...(current.thong_tin ?? {}) } as Record<string, unknown>;
  const pending = info.pending as { ngay?: string; ly_do?: string } | undefined;
  const history = Array.isArray(info.lich_su_phat) ? [...(info.lich_su_phat as unknown[])] : [];
  const update: Record<string, unknown> = {};
  if (action === "hoan") {
    if (pending) throw new QualityApiError("Phiếu đã ở trạng thái pending.", 409);
    if (current.ngay_nghiem_thu) throw new QualityApiError("Phiếu đã nghiệm thu, không thể chuyển pending.", 409);
    info.pending = { ngay: new Date().toISOString(), ly_do: str(body.ly_do, 300), nguoi: actor };
  } else {
    if (!pending) throw new QualityApiError("Phiếu không ở trạng thái pending.", 409);
    const ngay = qualityDate(body.ngay_moi);
    if (!ngay) throw new QualityApiError("Nhập ngày mời nghiệm thu mới.");
    history.push({ ngay_moi: current.ngay_moi, ngay_hoan: pending.ngay ?? null, ly_do: pending.ly_do ?? "", ngay_phat_lai: new Date().toISOString(), nguoi: actor });
    delete info.pending;
    info.lich_su_phat = history;
    update.ngay_moi = ngay;
  }
  const { error: saveError } = await db().from(table).update({ ...update, thong_tin: info }).eq("id", id);
  if (saveError) throw saveError;
  return { id, pending: action === "hoan" };
}

/** Gắn / gỡ bản scan biên bản đã ký (file PDF nằm trong kho Tài liệu) vào phiếu. Chỉ ghi vào thong_tin nên không cần migration. */
export async function saveBbntScan(body: Record<string, unknown>, actor: string) {
  const id = qualityUuid(body.id);
  const table = body.kind === "tach" ? "phieu_nt_tach" : "phieu_yeu_cau_nghiem_thu";
  const { data: row, error } = await db().from(table).select("id,thong_tin").eq("id", id).single();
  if (error || !row) throw new QualityApiError("Không tìm thấy phiếu.", 404);
  const info = { ...((row.thong_tin ?? {}) as Record<string, unknown>) };
  type ScanEntry = Record<string, unknown>;
  const list: ScanEntry[] = Array.isArray(info.bbnt_scans) ? [...(info.bbnt_scans as ScanEntry[])] : [];
  if (info.bbnt_scan) { list.unshift(info.bbnt_scan as ScanEntry); delete info.bbnt_scan; } // bản cũ chỉ một file
  let next = list;
  if (body.scan === null) {
    // Gỡ một file (theo mã tài liệu / đường dẫn) hoặc gỡ tất cả khi không chỉ rõ.
    const key = str(body.go_doc, 300);
    next = key ? list.filter((entry) => String(entry.doc_id || entry.url) !== key) : [];
  } else {
    const scan = object(body.scan);
    const url = str(scan.url, 500);
    if (!url.startsWith("/api/documents/") && !url.startsWith("https://drive.google.com/")) throw new QualityApiError("Liên kết biên bản không hợp lệ.");
    if (list.length >= 30) throw new QualityApiError("Mỗi phiếu lưu tối đa 30 file biên bản.");
    next = [...list, { doc_id: str(scan.doc_id, 80), url, ten: str(scan.ten, 200), appsheet_path: str(scan.appsheet_path, 300), appsheet_url: str(scan.appsheet_url, 600), ngay: new Date().toISOString(), nguoi: actor }];
  }
  if (next.length) info.bbnt_scans = next; else delete info.bbnt_scans;
  const { error: saveError } = await db().from(table).update({ thong_tin: info }).eq("id", id);
  if (saveError) throw saveError;
  return { id };
}

export async function deleteRfi(body: Record<string, unknown>) {
  const id = qualityUuid(body.id);
  const { error } = await db().rpc("xoa_phieu_rfi", { p_id: id });
  if (error) {
    if (error.code === "P0001") throw new QualityApiError(error.message, 409);
    throw error;
  }
  await deleteGtusThanh(id); // phiếu GTUS: xoá luôn nghiệm thu / thanh toán từng thanh
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
    ...(prev.loai_rfi === "theo-doi" ? { cong_viec: (info.cong_viec ?? prev.cong_viec) === "gtus" ? "gtus" : "" } : {}),
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
    truc_quan: inspectionById.get(l.moi_han_id)?.truc_quan ?? null,
    du_dieu_kien_hinh_hoc: geometryReady(inspectionById.get(l.moi_han_id), ruleById.get(inspectionById.get(l.moi_han_id)?.tieu_chuan_id ?? "")),
    chieu_dai_mai: inspectionById.get(l.moi_han_id)?.gia_tri_do.chieu_dai_mai ?? null,
    ket_qua_ndt: inspectionById.get(l.moi_han_id)?.ket_qua_ndt ?? null,
    ten_tieu_chuan: ruleById.get(inspectionById.get(l.moi_han_id)?.tieu_chuan_id ?? "")?.ten ?? null,
    ly_do_chua_du_dieu_kien: q.get(l.moi_han_id)?.du_dieu_kien_nghiem_thu ? "" :
      acceptanceIssues(inspectionById.get(l.moi_han_id) ?? null, ruleById.get(inspectionById.get(l.moi_han_id)?.tieu_chuan_id ?? "") ?? null).join(" ") ||
      acceptanceBlockReason(q.get(l.moi_han_id)?.tinh_trang ?? "", missingLength.has(l.moi_han_id)) }));
  welds.sort((a, b) => a.ma_lich_su.localeCompare(b.ma_lich_su, "vi", { numeric: true }));
  return { rfi, welds };
}

/** Đủ điều kiện nghiệm thu riêng hình học: đã mài, trực quan Đạt, số đo trong dung sai, có chiều dài mài (nếu tiêu chí yêu cầu). */
function geometryReady(i: SavedWeldInspection | undefined, rule: SavedWeldQualityRule | undefined) {
  if (!i || !rule || !i.ngay_mai || i.truc_quan !== "Đạt" || i.ly_do_loai_nghiem_thu || i.xu_ly_truc_quan === "khong_dat" || i.ket_qua_ndt === "Không đạt") return false;
  try { return evaluateGeometry(i.gia_tri_do ?? {}, rule.dung_sai) === "Đạt" && hasRequiredGrindingLength(i.gia_tri_do ?? {}, rule.dung_sai); } catch { return false; }
}

/** Nghiệm thu CHỈ hình học từ RFI chính: tạo phiếu hình học đã chốt, mối → «Chờ siêu âm»; trả về bộ biên bản hình học để in. */
export async function completeRfiGeometry(body: Record<string, unknown>, actor: string) {
  const ngay = qualityDate(body.ngay_nghiem_thu);
  if (!ngay) throw new QualityApiError("Nhập ngày nghiệm thu.");
  if (!Array.isArray(body.ket_qua) || !body.ket_qua.length || body.ket_qua.length > 2000) throw new QualityApiError("Chọn ít nhất một mối Đạt hình học.");
  const ket_qua = body.ket_qua.map((v) => {
    const r = object(v);
    if (typeof r.phien_ban !== "number" || !Number.isSafeInteger(r.phien_ban)) throw new QualityApiError("Phiên bản không hợp lệ.");
    return { moi_han_id: qualityUuid(r.moi_han_id), phien_ban: r.phien_ban };
  });
  const id = qualityUuid(body.id);
  const { error } = await db().rpc("nt_hinh_hoc_tu_rfi", { p_id: id, p_phieu_id: qualityUuid(body.phieu_id), p_ngay: ngay, p_ket_qua: ket_qua, p_actor: actor });
  if (error) {
    if (error.code === "PGRST202") throw new QualityApiError("Chưa chạy migration 20261108 (nghiệm thu hình học từ RFI) trên Supabase.", 409);
    if (error.code === "23505") throw new QualityApiError("Có mối đã nằm trong một phiếu hình học khác đang xử lý.", 409);
    if (error.code === "P0001") throw new QualityApiError(error.message, 409);
    throw error;
  }
  // Phiếu hình học tách đánh số riêng RFI-HH-xxx (hàm SQL tạm lấy số của RFI chính).
  const { data: created } = await db().from("phieu_nt_tach").select("du_an_id,so_phieu").eq("id", id).single();
  if (created && !/^RFI-HH-\d+$/i.test(created.so_phieu)) {
    const { error: renameError } = await db().from("phieu_nt_tach").update({ so_phieu: await nextRfiNumber(created.du_an_id, "hinh-hoc") }).eq("id", id);
    if (renameError && renameError.code !== "23505") throw renameError;
  }
  const info = object(body.thong_tin ?? {});
  return { id, record: await loadGeometryRecord(id, { dia_diem: str(info.dia_diem), thanh_phan: str(info.thanh_phan, 1000) }) };
}

/** Bộ biên bản của phiếu tách (hình học / siêu âm). Phiếu chưa nghiệm thu → mẫu trống kết quả để in mang ra hiện trường. */
export async function loadGeometryRecord(ticketId: string, extra: Record<string, string> = {}) {
  const { data: ticket, error } = await db().from("phieu_nt_tach").select("*").eq("id", ticketId).single();
  const ultrasound = ticket?.loai === "sieu-am";
  if (error) throw error;
  const pending = !ticket.ngay_nghiem_thu;
  const [rfiRes, projectRes, rows] = await Promise.all([
    ticket.phieu_rfi_id ? db().from("phieu_yeu_cau_nghiem_thu").select("*").eq("id", ticket.phieu_rfi_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db().from("du_an").select("*").eq("id", ticket.du_an_id).maybeSingle(),
    fetchAll<{ moi_han_id: string; ma_lich_su: string; ket_qua: string | null; ly_do: string | null; du_lieu_chot: Record<string, unknown> }>((a, b) =>
      db().from("phieu_nt_tach_moi").select("moi_han_id,ma_lich_su,ket_qua,ly_do,du_lieu_chot").eq("phieu_id", ticketId).order("moi_han_id").range(a, b)),
  ]);
  // Phiếu đã chốt: chỉ in mối Đạt. Phiếu chờ nghiệm thu: in đủ mối, để trống kết quả.
  const printed = pending ? rows : rows.filter((r) => r.ket_qua === "Đạt");
  rows.splice(0, rows.length, ...printed);
  if (rfiRes.error) throw rfiRes.error;
  if (projectRes.error) throw projectRes.error;
  const points = await chunked<{ lich_su_moi_han_id: string; ma_diem: string | null; ly_trinh: string | null }>(rows.map((r) => r.moi_han_id),
    (p) => db().from("toa_do").select("lich_su_moi_han_id,ma_diem,ly_trinh").in("lich_su_moi_han_id", p));
  // Thông tin mối (ca, máy, loại ray…) như bộ biên bản RFI chính.
  const [weldRows, reportRows] = await Promise.all([
    chunked<Record<string, unknown> & { id: string }>(rows.map((r) => r.moi_han_id), (p) => db().from("lich_su_moi_han").select("*").in("id", p)),
    chunked<Record<string, unknown> & { id: string }>(rows.map((r) => r.moi_han_id), (p) => db().from("bao_cao_moi_han_theo_du_an").select("*").in("id", p)).catch(() => []),
  ]);
  const weldInfo = new Map(weldRows.map((w) => [w.id, w]));
  const reportInfo = new Map(reportRows.map((w) => [w.id, w]));
  const where = new Map<string, { ma_diem: string | null; ly_trinh: string | null }>();
  for (const p of points) {
    const cur = where.get(p.lich_su_moi_han_id);
    where.set(p.lich_su_moi_han_id, { ma_diem: cur?.ma_diem || p.ma_diem, ly_trinh: cur?.ly_trinh || p.ly_trinh });
  }
  // Phiếu siêu âm: kèm số phiếu hình học đã nghiệm thu của các mối.
  // RFI tách làm 2 phiếu con (hình học + siêu âm): phụ lục của phiếu nào cũng ghi đủ cả hai số.
  const siblings = ticket.phieu_rfi_id
    ? ((await db().from("phieu_nt_tach").select("so_phieu,loai").eq("phieu_rfi_id", ticket.phieu_rfi_id)).data ?? []) as { so_phieu: string; loai: string }[] : [];
  const siblingNos = (loai: string) => siblings.filter((s) => s.loai === loai).map((s) => s.so_phieu);
  const geometryList = ultrasound ? [...new Set([...(await geometryAcceptedTickets(ticket.du_an_id, rows.map((r) => r.moi_han_id))).values()].map((t) => t.so_phieu).concat(siblingNos("hinh-hoc")))] : [ticket.so_phieu];
  const geometryNos = geometryList.join(", ");
  const ultrasoundNos = ultrasound ? ticket.so_phieu : siblingNos("sieu-am").join(", ");
  const rfi = (rfiRes.data ?? { id: ticket.id, so_phieu: ticket.so_phieu, ngay_moi: ticket.ngay_moi, thong_tin: ticket.thong_tin ?? {} }) as Record<string, unknown>;
  const rfiInfo = (rfi.thong_tin ?? {}) as Record<string, unknown>;
  const moi = rows.map((r) => {
    const d = r.du_lieu_chot ?? {};
    const pt = where.get(r.moi_han_id);
    const mh: Record<string, unknown> = { ma_lich_su: r.ma_lich_su, ...(weldInfo.get(r.moi_han_id) ?? {}), ...(reportInfo.get(r.moi_han_id) ?? {}), ...((d.moi_han as Record<string, unknown>) ?? {}) };
    if (!mh.ma_diem && pt?.ma_diem) mh.ma_diem = pt.ma_diem;
    if (!mh.ly_trinh && pt?.ly_trinh) mh.ly_trinh = pt.ly_trinh;
    return { moi_han_id: r.moi_han_id, ket_qua: pending ? "" : r.ket_qua ?? "Đạt", ly_do: r.ly_do,
      du_lieu_chot: { moi_han: mh, kiem_tra: pending ? {} : (d.kiem_tra as Record<string, unknown>) ?? d, tieu_chuan: (d.tieu_chuan as Record<string, unknown>) ?? { dung_sai: d.dung_sai, ten: d.ten_tieu_chuan } } };
  });
  const docs = ["Phụ lục công việc", "Giai đoạn xây dựng", "Hoàn thành công việc"];
  return {
    dot: { id: ticket.id, ngay_nghiem_thu: ticket.ngay_nghiem_thu, nguoi_lap: ticket.nguoi_nghiem_thu,
      thong_tin: { ...extra, rfi_hinh_hoc_so: geometryNos, rfi_sieu_am_so: ultrasoundNos },
      phieu_yeu_cau_nghiem_thu: { ...rfi, so_phieu: ticket.so_phieu, thong_tin: { ...rfiInfo, nt_hinh_hoc: ultrasound ? "" : "1", nt_sieu_am: ultrasound ? "1" : "" }, du_an: projectRes.data ?? {} } },
    ho_so: docs.map((loai, i) => ({ id: `${ticket.id}-${i}`, loai, tinh_trang_ky: ticket.da_ky ? "Đã ký" : "Chờ ký", du_lieu_chot: null })),
    moi,
    sua_doi: docs.flatMap((_, i) => {
      const saved = (ticket.thong_tin?.in_ho_so as Record<string, { thong_tin: Record<string, string>; ly_do: string; nguoi_sua: string; created_at: string }> | undefined)?.[i];
      return saved ? [{ id: `${ticket.id}-${i}-v1`, ho_so_id: `${ticket.id}-${i}`, phien_ban: 1, ...saved }] : [];
    }),
  };
}

/** Mối đã nghiệm thu trực quan / hình học ĐẠT ở phiếu trực quan riêng (kèm số phiếu, ngày nghiệm thu). */
async function geometryAcceptedTickets(projectId: string, weldIds: string[]) {
  const tickets = await fetchAll<{ id: string; so_phieu: string; ngay_nghiem_thu: string | null }>((a, b) => db().from("phieu_nt_tach")
    .select("id,so_phieu,ngay_nghiem_thu").eq("du_an_id", projectId).eq("loai", "hinh-hoc").not("ngay_nghiem_thu", "is", null).range(a, b));
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const rows = tickets.length && weldIds.length ? await chunked<{ phieu_id: string; moi_han_id: string }>(weldIds, (part) =>
    db().from("phieu_nt_tach_moi").select("phieu_id,moi_han_id").eq("loai", "hinh-hoc").eq("ket_qua", "Đạt").in("moi_han_id", part)) : [];
  const out = new Map<string, { so_phieu: string; ngay_nghiem_thu: string }>();
  for (const r of rows) {
    const t = byId.get(r.phieu_id);
    if (t?.ngay_nghiem_thu) out.set(r.moi_han_id, { so_phieu: t.so_phieu, ngay_nghiem_thu: t.ngay_nghiem_thu });
  }
  return out;
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
    if (kind === "hinh-hoc" && !input[field]) {
      // Phiếu chỉ siêu âm: phần trực quan đã nghiệm thu ở phiếu trực quan riêng → tự tìm, không bắt chọn tay.
      const passedIds = ket_qua.filter((r) => r.ket_qua === "Đạt").map((r) => r.moi_han_id);
      const accepted = await geometryAcceptedTickets(phieu.du_an_id, passedIds);
      const missing = passedIds.filter((id) => !accepted.has(id) || accepted.get(id)!.ngay_nghiem_thu > ngay);
      if (missing.length) throw new QualityApiError(`Có ${missing.length} mối chưa nghiệm thu trực quan ĐẠT trước ngày này; không thể chọn Đạt ở phiếu siêu âm.`, 409);
      info[numberField] = [...new Set([...accepted.values()].map((t) => t.so_phieu))].join(", ");
      continue;
    }
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
  type Parent = { id: string; so_phieu: string; du_an_id: string };
  const data = await fetchAll((a, b) => db().from("dot_nghiem_thu")
    .select("id,ngay_nghiem_thu,nguoi_lap,thong_tin,created_at,phieu_yeu_cau_nghiem_thu!inner(id,so_phieu,du_an_id),ho_so_nghiem_thu(id,loai,tinh_trang_ky)")
    .eq("phieu_yeu_cau_nghiem_thu.du_an_id", projectId).order("created_at", { ascending: false }).order("id").range(a, b)
    .overrideTypes<{ phieu_yeu_cau_nghiem_thu: Parent }[]>());
  const [results, signing] = await Promise.all([
    chunkedPages<{ dot_id: string; moi_han_id: string; ket_qua: string }>(data.map((r) => r.id),
      (ids, a, b) => db().from("dot_nghiem_thu_moi").select("dot_id,moi_han_id,ket_qua").in("dot_id", ids).order("dot_id").order("moi_han_id").range(a, b)),
    childSigningByRfi([...new Set<string>(data.map(r => r.phieu_yeu_cau_nghiem_thu.id))]),
  ]);
  return data.map((r) => {
    const rows = results.filter((m) => m.dot_id === r.id);
    const draft = r.thong_tin?.draft === true;
    return { ...r, child_signing: signing.get(r.phieu_yeu_cau_nghiem_thu.id), tong_moi: rows.length,
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
  // Bộ biên bản của phiếu tách (hình học / siêu âm) có id ảo `<uuid phiếu>-<0..2>`: lưu bản sửa vào phieu_nt_tach.thong_tin.
  const virtual = typeof body.ho_so_id === "string" ? /^(.{36})-([0-2])$/.exec(body.ho_so_id) : null;
  const hoSoId = virtual ? "" : qualityUuid(body.ho_so_id);
  const lyDo = str(body.ly_do, 1000);
  if (!lyDo) throw new QualityApiError("Cần nêu lý do sửa đổi.");
  const t = object(body.thong_tin);
  const thong_tin: Record<string, string> = { dia_diem: str(t.dia_diem, 300), thanh_phan: str(t.thanh_phan, 1000) };
  // Nội dung tự nhập của BB nghiệm thu hoàn thành (mục 5 a–g).
  for (const key of ["tai_lieu_can_cu", "danh_gia_chat_luong", "dieu_chinh", "so_voi_thiet_ke", "so_voi_hop_dong", "ket_qua_thi_nghiem", "tuan_thu_phccc", "y_kien_khac", "ten_moi_han"]) {
    if (key in t) thong_tin[key] = str(t[key], 3000);
  }
  // Thông tin / thời gian trên mẫu sửa được ở bản xem trước (chỉ lưu khi có nhập; để trống = tự lấy từ dữ liệu).
  for (const key of ["ngay_nghiem_thu", "gio_bat_dau", "gio_ket_thuc", "ca_han", "bien_phap", "tuyen", "ten_tho_han", "id_tho_han", "may_han", "goong", "kmFrom", "kmTo", "so_bb", "ben_moi", "ben_nhan", "pham_vi", "ngay_ky_tvgs", "ngay_ky_ntc", "ngay_ky_ntp", "pyc_so", "goi_thau", "ket_luan", ...SIGNER_KEYS,
    ...["cdt", "tvtk"].flatMap((p) => [1, 2].flatMap((i) => [`nguoi_${p}_${i}_ten`, `nguoi_${p}_${i}_cv`]))]) {
    const value = str(t[key], 300);
    if (value) thong_tin[key] = value;
  }
  if (virtual) {
    const ticketId = qualityUuid(virtual[1]);
    const { data: ticket, error: ticketError } = await db().from("phieu_nt_tach").select("thong_tin").eq("id", ticketId).single();
    if (ticketError) throw ticketError;
    const prints = { ...((ticket.thong_tin?.in_ho_so as Record<string, unknown>) ?? {}), [virtual[2]]: { thong_tin, ly_do: lyDo, nguoi_sua: actor, created_at: new Date().toISOString() } };
    const { error: saveError } = await db().from("phieu_nt_tach").update({ thong_tin: { ...(ticket.thong_tin ?? {}), in_ho_so: prints } }).eq("id", ticketId);
    if (saveError) throw saveError;
    return { ok: true };
  }
  const { data: last, error: lastError } = await db().from("ho_so_nghiem_thu_sua_doi").select("phien_ban")
    .eq("ho_so_id", hoSoId).order("phien_ban", { ascending: false }).limit(1);
  if (lastError) throw lastError;
  const { error } = await db().from("ho_so_nghiem_thu_sua_doi")
    .insert({ ho_so_id: hoSoId, phien_ban: (last?.[0]?.phien_ban ?? 0) + 1, thong_tin, ly_do: lyDo, nguoi_sua: actor });
  if (error) throw error; // trùng phiên bản (hai người sửa cùng lúc) → 409 qua ràng buộc unique
  return { ok: true };
}

export async function setSignStatus(body: Record<string, unknown>, actor: string) {
  if (body.tinh_trang_ky !== "Chờ ký" && body.tinh_trang_ky !== "Đã ký") throw new QualityApiError("Tình trạng ký không hợp lệ.");
  let dotId = body.dot_id ? qualityUuid(body.dot_id) : null;
  let parentId = body.phieu_rfi_id ? qualityUuid(body.phieu_rfi_id) : null;
  if (!dotId && !parentId) {
    const { data, error } = await db().from("ho_so_nghiem_thu").select("dot_id").eq("id", qualityUuid(body.id)).single();
    if (error) throw error;
    dotId = data.dot_id;
  }
  if (dotId) {
    const { data, error } = await db().from("dot_nghiem_thu").select("phieu_id").eq("id", dotId).single();
    if (error) throw error;
    parentId = data.phieu_id;
  }
  if (parentId) {
    const { data: children, error } = await db().from("phieu_nt_tach").select("id,loai,ngay_nghiem_thu,da_ky").eq("phieu_rfi_id", parentId);
    if (error) throw error;
    const state = rfiChildSigning(children);
    if (state) {
      const signed = body.tinh_trang_ky === "Đã ký";
      if (signed && !state.canSign) throw new QualityApiError("Cần chốt nghiệm thu các phiếu con trước khi ký cả bộ.", 409);
      const { error: updateError } = await db().from("phieu_nt_tach").update({
        da_ky: signed, nguoi_ky: signed ? actor : null, ngay_ky: signed ? new Date().toISOString() : null,
      }).in("id", children.map(child => child.id));
      if (updateError) throw updateError;
      return { ok: true, count: children.length };
    }
  }
  if (!dotId) throw new QualityApiError("Phiếu RFI chưa có phiếu con để ký.", 409);
  const { error } = await db().rpc("ky_bo_ho_so_moi_han", { p_dot_id: dotId, p_tinh_trang_ky: body.tinh_trang_ky });
  if (error) throw error;
  return { ok: true, count: 3 };
}

/** Phiếu siêu âm tách đã nghiệm thu → hồ sơ chờ ký / đã ký (ký xong mối đạt cả hình học + siêu âm → «Đạt»). */
export async function listSplitRecords(projectId: string, kind: "hinh-hoc" | "sieu-am" = "sieu-am") {
  const tickets = await fetchAll<{ id: string; so_phieu: string; ngay_nghiem_thu: string; nguoi_nghiem_thu: string | null; da_ky: boolean | null; nguoi_ky: string | null; ngay_ky: string | null }>((a, b) =>
    db().from("phieu_nt_tach").select("id,so_phieu,ngay_nghiem_thu,nguoi_nghiem_thu,da_ky,nguoi_ky,ngay_ky").eq("du_an_id", projectId).eq("loai", kind)
      .not("ngay_nghiem_thu", "is", null).order("ngay_nghiem_thu", { ascending: false }).order("so_phieu").range(a, b));
  const items = await chunkedPages<{ phieu_id: string; ket_qua: string | null }>(tickets.map((t) => t.id),
    (ids, a, b) => db().from("phieu_nt_tach_moi").select("phieu_id,ket_qua").in("phieu_id", ids).order("phieu_id").order("moi_han_id").range(a, b));
  return tickets.map((t) => {
    const rows = items.filter((i) => i.phieu_id === t.id);
    return { ...t, da_ky: Boolean(t.da_ky), tong_moi: rows.length, dat: rows.filter((r) => r.ket_qua === "Đạt").length };
  });
}

export async function signSplitRecord(body: Record<string, unknown>, actor: string) {
  const id = qualityUuid(body.id);
  const signed = body.da_ky === true;
  const { data, error } = await db().from("phieu_nt_tach").update({ da_ky: signed, nguoi_ky: signed ? actor : null, ngay_ky: signed ? new Date().toISOString() : null })
    .eq("id", id).not("ngay_nghiem_thu", "is", null).select("id");
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") throw new QualityApiError("Chưa chạy migration 20261108c (ký phiếu siêu âm tách) trên Supabase.", 409);
    throw error;
  }
  if (!data?.length) throw new QualityApiError("Phiếu chưa nghiệm thu hoặc không tồn tại.", 409);
  return { ok: true };
}

/** Gắn lý trình (km) của từng mối để lọc theo khoảng Km ở màn hình phát phiếu tách. */
async function withChainage<T extends { moi_han_id: string }>(rows: T[]) {
  if (!rows.length) return rows.map((r) => ({ ...r, ly_trinh: null as string | null }));
  const points = await chunked<{ lich_su_moi_han_id: string; ly_trinh: string | null }>(rows.map((r) => r.moi_han_id),
    (p) => db().from("toa_do").select("lich_su_moi_han_id,ly_trinh").in("lich_su_moi_han_id", p));
  const km = new Map(points.filter((p) => p.ly_trinh).map((p) => [p.lich_su_moi_han_id, p.ly_trinh as string]));
  return rows.map((r) => ({ ...r, ly_trinh: km.get(r.moi_han_id) ?? null }));
}

/** Thông tin in phiếu tách (giống RFI chính). Chưa chạy migration 20261108d thì báo rõ. */
async function saveSplitInfo(id: string, value: unknown) {
  if (value == null) return;
  const info = object(value);
  const flag = (v: unknown) => (v === true || v === "1" || v === "true" ? "1" : "");
  // Giữ nội dung in đã sửa (in_*) khi cập nhật thông tin phiếu.
  const current = await db().from("phieu_nt_tach").select("thong_tin").eq("id", id).maybeSingle();
  const kept = Object.fromEntries(Object.entries(object(current.data?.thong_tin ?? {})).filter(([k]) => k.startsWith("in_")));
  const thong_tin = { ...kept, dia_diem: str(info.dia_diem), ben_moi: str(info.ben_moi), ben_nhan: str(info.ben_nhan), pham_vi: str(info.pham_vi),
    gio_bat_dau: str(info.gio_bat_dau, 10),
    // Không chọn tuyến → bỏ khoá để phiếu tự xác định tuyến theo mã điểm của mối.
    ...(flag(info.tuyen_thuong) || flag(info.tuyen_ha) ? { tuyen_thuong: flag(info.tuyen_thuong), tuyen_ha: flag(info.tuyen_ha) } : {}) };
  const { error } = await db().from("phieu_nt_tach").update({ thong_tin }).eq("id", id);
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") throw new QualityApiError("Đã lưu phiếu nhưng chưa lưu được thông tin in: cần chạy migration 20261108d trên Supabase.", 409);
    throw error;
  }
}

function ultrasoundTicketNumber(ticket: { phieu_rfi_id: string | null; so_phieu: string }) {
  if (!ticket.phieu_rfi_id) return ticket.so_phieu;
  return ticket.so_phieu.replace(/-HH$/, "") + "-SA";
}

async function forwardGeometryTicket(ticket: {
  id: string; du_an_id: string; phieu_rfi_id: string | null; so_phieu: string;
  ngay_nghiem_thu: string; thong_tin: unknown;
}, actor: string) {
  const { data: passed, error } = await db().from("phieu_nt_tach_moi").select("moi_han_id")
    .eq("phieu_id", ticket.id).eq("ket_qua", "Đạt");
  if (error) throw error;
  if (!passed.length) return { id: ticket.id, so_moi_chuyen: 0 };

  if (ticket.phieu_rfi_id) {
    const sibling = await db().from("phieu_nt_tach").select("id").eq("loai", "sieu-am")
      .eq("phieu_rfi_id", ticket.phieu_rfi_id).maybeSingle();
    if (sibling.error) throw sibling.error;
    if (sibling.data) return { id: ticket.id, sieu_am_id: sibling.data.id, so_moi_chuyen: passed.length };
  }

  const number = ultrasoundTicketNumber(ticket);
  const findExisting = async () => {
    const existing = await db().from("phieu_nt_tach").select("id,phieu_rfi_id").eq("du_an_id", ticket.du_an_id)
      .eq("loai", "sieu-am").eq("so_phieu", number).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return null;
    const rows = await db().from("phieu_nt_tach_moi").select("moi_han_id").eq("phieu_id", existing.data.id);
    if (rows.error) throw rows.error;
    const ids = new Set(rows.data.map(row => row.moi_han_id));
    if (existing.data.phieu_rfi_id || ids.size !== passed.length || passed.some(row => !ids.has(row.moi_han_id))) {
      throw new QualityApiError(`Số phiếu siêu âm ${number} đã được dùng cho danh sách mối khác.`, 409);
    }
    return existing.data.id;
  };
  let sieuAmId = await findExisting();
  let created = false;
  if (!sieuAmId) {
    sieuAmId = crypto.randomUUID();
    const published = await db().rpc("phat_phieu_nt_tach", {
      p_id: sieuAmId, p_du_an: ticket.du_an_id, p_loai: "sieu-am", p_so: number,
      p_ngay: ticket.ngay_nghiem_thu, p_moi: passed.map(row => row.moi_han_id), p_actor: actor,
    });
    if (published.error) {
      const concurrentId = await findExisting();
      if (!concurrentId) throw new QualityApiError(published.error.message, 409);
      sieuAmId = concurrentId;
    } else created = true;
  }
  if (ticket.phieu_rfi_id) {
    const { error: linkError } = await db().from("phieu_nt_tach").update({ phieu_rfi_id: ticket.phieu_rfi_id })
      .eq("id", sieuAmId).is("phieu_rfi_id", null);
    if (linkError) throw linkError;
  }
  if (created) {
    try { await saveSplitInfo(sieuAmId, ticket.thong_tin); }
    catch (e) { return { id: ticket.id, sieu_am_id: sieuAmId, so_moi_chuyen: passed.length, canh_bao: e instanceof Error ? e.message : String(e) }; }
  }
  return { id: ticket.id, sieu_am_id: sieuAmId, so_moi_chuyen: passed.length };
}

async function ticketPaymentRates(project: string, ticketIds: string[]) {
  const rates = new Map<string, Set<number>>();
  // Ghi chú thanh toán các mối của phiếu (khác nhau thì liệt kê, bỏ trùng).
  const notes = new Map<string, Set<string>>();
  if (!ticketIds.length) return { rates, notes };
  const payments = await listPayments(project);
  if (!payments.length) return { rates, notes };
  const byWeld = new Map(payments.map(payment => [payment.moi_han_id, payment.ty_le]));
  const noteByWeld = new Map(payments.filter(payment => payment.ghi_chu?.trim()).map(payment => [payment.moi_han_id, payment.ghi_chu!.trim()]));
  const rows = await chunkedPages<{ phieu_id: string; moi_han_id: string }>(ticketIds, (ids, a, b) => db()
    .from("phieu_nt_tach_moi").select("phieu_id,moi_han_id").in("phieu_id", ids)
    .eq("ket_qua", "Đạt").order("phieu_id").order("moi_han_id").range(a, b));
  for (const row of rows) {
    const values = rates.get(row.phieu_id) ?? new Set<number>();
    values.add(byWeld.get(row.moi_han_id) ?? 0);
    rates.set(row.phieu_id, values);
    const note = noteByWeld.get(row.moi_han_id);
    if (note) notes.set(row.phieu_id, (notes.get(row.phieu_id) ?? new Set<string>()).add(note));
  }
  return { rates, notes };
}

/** Separate records share inspection data with the original workflow, but own their RIF/RFI and results. */
export async function splitAcceptance(body: Record<string, unknown>, actor: string) {
  const project = qualityUuid(body.du_an_id);
  const kind = body.loai;
  if (kind !== "hinh-hoc" && kind !== "sieu-am") throw new QualityApiError("Loại nghiệm thu không hợp lệ.");
  if (body.action === "split-list") {
    const [candidates, ticketRows] = await Promise.all([
      fetchAll((a,b) => db().from("moi_cho_phieu_nt_tach").select("moi_han_id,ma_lich_su,da_nt_truc_quan,ngay_mai,truc_quan")
        .eq("du_an_id",project).eq("loai",kind).order("ma_lich_su").order("moi_han_id").range(a,b)),
      fetchAll((a,b) => db().from("phieu_nt_tach").select("*")
        .eq("du_an_id",project).eq("loai",kind).order("ngay_moi",{ascending:false}).order("so_phieu").range(a,b)),
    ]);
    const { rates, notes } = await ticketPaymentRates(project, ticketRows.filter(t => t.ngay_nghiem_thu).map(t => t.id));
    const tickets = ticketRows.map(t => ({ ...t, payment_rates: [...(rates.get(t.id) ?? [])].sort((a, b) => a - b), payment_notes: [...(notes.get(t.id) ?? [])] }));
    if (kind === "sieu-am") {
      // RFI siêu âm chỉ hiện mối đang «Chờ siêu âm» (đã nghiệm thu hình học ĐẠT, chưa siêu âm / chưa ký).
      const waiting = await fetchAll<{ moi_han_id: string }>((a, b) => db().from("chat_luong_moi_han").select("moi_han_id")
        .eq("du_an_id", project).eq("tinh_trang", "Chờ siêu âm").order("moi_han_id").range(a, b));
      const ids = new Set(waiting.map((r) => r.moi_han_id));
      return { candidates: await withChainage((candidates as { moi_han_id: string }[]).filter((c) => ids.has(c.moi_han_id))), tickets };
    }
    // Phiếu hình học: chỉ hiện mối «Mài xong» (có ngày mài, chưa kết luận trực quan).
    return { candidates: await withChainage((candidates as { moi_han_id: string; truc_quan: string | null }[]).filter((c) => !c.truc_quan)), tickets };
  }
  const id = qualityUuid(body.id);
  if (body.action === "split-publish") {
    const ids = body.moi_han_ids, number = str(body.so_phieu,80), date = qualityDate(body.ngay_moi);
    if (!Array.isArray(ids) || !ids.length || ids.length > 200 || !number || !date)
      throw new QualityApiError("Nhập số phiếu, ngày mời và chọn 1–200 mối.");
    // Báo rõ nguyên nhân thay vì một thông báo chung: số phiếu trùng hay mối đã nằm trong phiếu đang xử lý.
    const sameNumber = await db().from("phieu_nt_tach").select("id", { count: "exact", head: true })
      .eq("du_an_id", project).eq("loai", kind).eq("so_phieu", number);
    if ((sameNumber.count ?? 0) > 0) throw new QualityApiError(`Số phiếu ${number} đã được dùng trong nhánh này. Chọn số khác (gợi ý: ${await nextRfiNumber(project, kind)}).`, 409);
    const { error } = await db().rpc("phat_phieu_nt_tach", { p_id:id, p_du_an:project, p_loai:kind,
      p_so:number, p_ngay:date, p_moi:ids.map(qualityUuid), p_actor:actor });
    if (error?.code === "23505") throw new QualityApiError("Có mối đã nằm trong một phiếu khác đang xử lý của nhánh này. Bấm Tải lại để cập nhật danh sách mối.",409);
    if (error) throw error;
    await saveSplitInfo(id, body.thong_tin);
    return { id };
  }
  if (body.action === "split-update") {
    // Sửa phiếu đã phát: số phiếu, thông tin in; ngày mời chỉ đổi khi chưa nghiệm thu.
    const { data: current, error: curError } = await db().from("phieu_nt_tach").select("*").eq("id", id).eq("du_an_id", project).eq("loai", kind).single();
    if (curError) throw curError;
    const number = str(body.so_phieu, 80), date = qualityDate(body.ngay_moi);
    if (!number || !date) throw new QualityApiError("Nhập số phiếu và ngày mời.");
    if (number !== current.so_phieu) {
      const same = await db().from("phieu_nt_tach").select("id", { count: "exact", head: true }).eq("du_an_id", project).eq("loai", kind).eq("so_phieu", number);
      if ((same.count ?? 0) > 0) throw new QualityApiError(`Số phiếu ${number} đã được dùng trong nhánh này.`, 409);
    }
    if (current.ngay_nghiem_thu && date !== current.ngay_moi) throw new QualityApiError("Phiếu đã nghiệm thu, không đổi được ngày mời.", 409);
    const { error: updError } = await db().from("phieu_nt_tach").update({ so_phieu: number, ngay_moi: date }).eq("id", id);
    if (updError) throw updError;
    await saveSplitInfo(id, body.thong_tin);
    return { id };
  }
  if (body.action === "split-delete") {
    // Xoá phiếu (chưa ký): các mối quay lại trạng thái trước nghiệm thu / danh sách chờ phát phiếu. Phiếu đã ký phải đặt lại «Chờ ký» trước.
    const { data: current, error: curError } = await db().from("phieu_nt_tach").select("*").eq("id", id).eq("du_an_id", project).eq("loai", kind).single();
    if (curError) throw curError;
    if (current.da_ky) throw new QualityApiError("Phiếu đã ký, hãy đặt lại «Chờ ký» trước khi xoá.", 409);
    if (kind === "hinh-hoc" && current.ngay_nghiem_thu) {
      const forwarded = await db().from("phieu_nt_tach").select("id", { count: "exact", head: true })
        .eq("du_an_id", project).eq("loai", "sieu-am").eq("so_phieu", ultrasoundTicketNumber(current));
      if (forwarded.error) throw forwarded.error;
      if ((forwarded.count ?? 0) > 0) throw new QualityApiError(`Phiếu ${current.so_phieu} đã chuyển sang siêu âm. Xoá phiếu siêu âm ở tab 2 trước.`, 409);
    }
    const rows = await db().from("phieu_nt_tach_moi").delete().eq("phieu_id", id);
    if (rows.error) throw rows.error;
    const del = await db().from("phieu_nt_tach").delete().eq("id", id);
    if (del.error) throw del.error;
    return { id };
  }
  const ticket = await db().from("phieu_nt_tach").select("*").eq("id",id).eq("du_an_id",project).eq("loai",kind).single();
  if (ticket.error) throw ticket.error;
  if (body.action === "split-forward-ultrasound") {
    if (kind !== "hinh-hoc" || !ticket.data.ngay_nghiem_thu) {
      throw new QualityApiError("Cần chốt nghiệm thu hình học trước khi chuyển sang siêu âm.", 409);
    }
    return forwardGeometryTicket(ticket.data, actor);
  }
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
  if (kind !== "hinh-hoc") return { id, so_moi_chuyen: 0 };
  try { return await forwardGeometryTicket({ ...ticket.data, ngay_nghiem_thu: date }, actor); }
  catch (e) {
    const reason = e && typeof e === "object" && "message" in e ? e.message : String(e);
    return { id, so_moi_chuyen: 0, canh_bao: `Đã chốt hình học. Bấm «Mở hoặc tạo phiếu siêu âm» để thử lại. ${reason}` };
  }
}
