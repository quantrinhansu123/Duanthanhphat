import { createClient } from "@/lib/supabase/client";
import { invalidateWeldReportCache, type WeldJournalPageQuery, type WeldJournalPageResult, type WeldReportRow } from "@/lib/weldReportData";
import type { SavedWeldInspection, SavedWeldQualityRule, WeldQualitySelection } from "@/lib/weldQuality";
import type { WeldQualitySummary } from "@/lib/server/weldQualityDb";
import { invalidateOverviewAggregateCache } from "@/lib/overviewAggregates";
import type { ReportWeather } from "@/lib/reportWeather";

export const loadReportWeather = (du_an_id: string, date: string) =>
  qualityRequest<ReportWeather>({ action: "report-weather", du_an_id, date });

export function notifyWeldQualityChanged() {
  invalidateWeldReportCache();
  invalidateOverviewAggregateCache();
  window.dispatchEvent(new Event("weld-quality-changed"));
}

export class WeldQualityRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Token đăng nhập Supabase; không có thì để server quyết định (Basic Auth hoặc báo cần đăng nhập). */
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await createClient().auth.getSession();
    return data.session ? { "X-Supabase-Token": data.session.access_token } : {};
  } catch { return {}; }
}

async function response<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new WeldQualityRequestError(data.error ?? "Không kết nối được dữ liệu kiểm tra chất lượng.", res.status);
  return data as T;
}

// Các thao tác chỉ đọc: nếu cùng một yêu cầu đang chạy thì dùng chung kết quả (tránh gọi trùng khi nhiều khối cùng mở / React chạy hiệu ứng hai lần).
const READ_ONLY_ACTIONS = new Set(["rfi-overview", "rfi-number", "rfi-candidates", "split-list", "split-detail", "report-weather", "diary-defaults", "rules-list"]);
const inFlight = new Map<string, Promise<unknown>>();

export function qualityRequest<T>(body: Record<string, unknown>): Promise<T> {
  const send = async () => response<T>(await fetch("/api/weld-quality", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify(body), cache: "no-store" }));
  if (!READ_ONLY_ACTIONS.has(String(body.action))) return send();
  const key = JSON.stringify(body);
  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const promise = send().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

export const loadQualityJournal = (filters: WeldJournalPageQuery) => qualityRequest<WeldJournalPageResult>({ action: "list", filters });
export const exportQualityJournal = (filters: WeldJournalPageQuery) => qualityRequest<{ rows: WeldReportRow[] }>({ action: "export", filters });
export const selectFilteredQuality = (filters: WeldJournalPageQuery) => qualityRequest<{ entries: WeldQualitySelection[] }>({ action: "selection", filters });
export async function loadQualityInspection(id: string) {
  return response<{ inspection: SavedWeldInspection | null; summary: WeldQualitySummary; rules: SavedWeldQualityRule[];
    weld: { id: string; ma_lich_su: string; du_an_id: string; cong_nghe_han: string; loai_moi_han: string; so_luong_thuc_hien: number } }>(
    await fetch(`/api/weld-quality?id=${encodeURIComponent(id)}`, { cache: "no-store", headers: await authHeaders() }));
}

export async function saveQualityInspection(inspection: SavedWeldInspection) {
  const result = await qualityRequest<{ inspection: SavedWeldInspection }>({ action: "save", inspection });
  notifyWeldQualityChanged();
  return result.inspection;
}

export type WeldQualityBulkEntry = WeldQualitySelection & {
  ket_qua?: "Đạt" | "Không đạt";
  ghi_chu?: string | null;
};

export async function markQualityPass(
  entries: WeldQualityBulkEntry[],
  kind: "grind" | "visual" | "ndt",
  date: string,
  method: string,
) {
  try {
    return await qualityRequest<{ results: { id: string; error?: string; phien_ban?: number }[] }>({
      action: "mark-pass",
      fillDeviationMax: kind === "visual",
      entries,
      kind,
      date,
      method,
    });
  } finally {
    notifyWeldQualityChanged();
  }
}

/** Đưa các mối về «Chờ mài» (xoá ngày mài và kết quả kiểm tra). */
export async function resetToWaitingGrind(entries: WeldQualityBulkEntry[]) {
  try {
    return await qualityRequest<{ results: { id: string; error?: string; phien_ban?: number }[] }>({ action: "reset-grind", entries });
  } finally {
    notifyWeldQualityChanged();
  }
}

// ---- Giai đoạn 4–6: RFI, nghiệm thu, hồ sơ ----
import type { AcceptanceDecision, RfiCandidate, RfiCandidateFilter, rfiChildSigning } from "@/lib/weldAcceptance";
import type { RfiTracking } from "@/lib/rfiTracking";

export type RfiSummary = { id: string; so_phieu: string; ngay_moi: string; trang_thai: string; nguoi_lap: string;
  thong_tin: Record<string, string>; created_at: string; tong_moi: number; con_lai: number; tracking?: RfiTracking;
  child_signing?: ReturnType<typeof rfiChildSigning> };
export type RfiWeld = { moi_han_id: string; con_hieu_luc: boolean; ma_lich_su: string; ma_diem?: string | null; ngay_thuc_hien: string | null; ly_trinh: string | null; vi_do: number | null; kinh_do: number | null; phien_ban: number; tinh_trang: string; du_dieu_kien_nghiem_thu: boolean; thieu_chieu_dai_mai?: boolean; ly_do_chua_du_dieu_kien?: string; chieu_dai_mai?: number | null; ket_qua_ndt?: string | null; ten_tieu_chuan?: string | null; truc_quan?: string | null; du_dieu_kien_hinh_hoc?: boolean };
export type RecordSummary = { id: string; ngay_nghiem_thu: string; nguoi_lap: string; created_at: string;
  tong_moi?: number; da_nghiem_thu?: number; khong_dat?: number; chua_nghiem_thu?: number;
  thong_tin?: Record<string, unknown> | null;
  child_signing?: ReturnType<typeof rfiChildSigning>;
  phieu_yeu_cau_nghiem_thu: { id: string; so_phieu: string }; ho_so_nghiem_thu: { id: string; loai: string; tinh_trang_ky: string }[] };
export type RecordSet = { dot: Record<string, unknown> & { phieu_yeu_cau_nghiem_thu: Record<string, unknown> & { du_an: Record<string, unknown> } };
  ho_so: { id: string; loai: string; tinh_trang_ky: string; du_lieu_chot: unknown }[];
  sua_doi?: { id: string; ho_so_id: string; phien_ban: number; thong_tin: Record<string, string>; ly_do: string; nguoi_sua: string; created_at: string }[];
  moi: { moi_han_id: string; ket_qua: string; ly_do: string | null; du_lieu_chot: { moi_han?: Record<string, unknown>; kiem_tra?: Record<string, unknown>; tieu_chuan?: Record<string, unknown> } }[] };

export const loadRfiCandidates = (du_an_id: string, filters: RfiCandidateFilter) =>
  qualityRequest<{ rows: RfiCandidate[]; missingChainage: string[]; excluded: Record<string, number>; total: number }>({ action: "rfi-candidates", du_an_id, filters });
export const loadRfiNumber = (du_an_id: string, loai?: "hinh-hoc" | "sieu-am", phieu_rfi_id?: string) => qualityRequest<{ so_phieu: string }>({ action: "rfi-number", du_an_id, ...(loai ? { loai } : {}), ...(phieu_rfi_id ? { phieu_rfi_id } : {}) });
export const loadRfiOverview = (du_an_id: string) => qualityRequest<{
  rfis: RfiSummary[]; so_phieu: string;
  candidates: { rows: RfiCandidate[]; missingChainage: string[]; excluded: Record<string, number>; total: number };
}>({ action: "rfi-overview", du_an_id });
export async function publishRfi(input: { id: string; du_an_id: string; so_phieu: string; ngay_moi: string; moi_han_ids: string[]; thong_tin: Record<string, string>; loai_rfi?: "nghiem-thu" | "theo-doi" | "ca-hai"; filters?: RfiCandidateFilter }) {
  try { return await qualityRequest<{ id: string }>({ action: "rfi-publish", ...input }); } finally { notifyWeldQualityChanged(); }
}
/** Lưu nội dung in nhập tay của phiếu yêu cầu (đối tượng, nội dung vị trí, ngày giờ, Km). */
export const saveRfiPrintInfo = (id: string, values: Record<string, string>) => qualityRequest<{ id: string }>({ action: "rfi-print-save", id, values });
export const loadRfis = (du_an_id: string) => qualityRequest<{ rfis: RfiSummary[] }>({ action: "rfi-list", du_an_id });
export async function deleteRfi(id: string) {
  const result = await qualityRequest<{ id: string }>({ action: "rfi-delete", id });
  notifyWeldQualityChanged();
  return result;
}
export const loadRfiDetail = (id: string) => qualityRequest<{ rfi: RfiSummary & { du_an_id: string }; welds: RfiWeld[] }>({ action: "rfi-detail", id });
export async function updateRfi(input: { id: string; so_phieu: string; ngay_moi: string; thong_tin: Record<string, string> }) {
  try { return await qualityRequest<{ id: string }>({ action: "rfi-update", ...input }); } finally { notifyWeldQualityChanged(); }
}
export async function completeAcceptance(input: { id: string; phieu_id: string; ngay_nghiem_thu: string; ket_qua: AcceptanceDecision[]; thong_tin: Record<string, string> }) {
  try { return await qualityRequest<{ id: string }>({ action: "accept-complete", ...input }); } finally { notifyWeldQualityChanged(); }
}
/** Nghiệm thu chỉ hình học từ RFI chính → phiếu hình học đã chốt, mối «Chờ siêu âm»; trả bộ biên bản hình học để in. */
export async function completeGeometryAcceptance(input: { id: string; phieu_id: string; ngay_nghiem_thu: string; ket_qua: { moi_han_id: string; phien_ban: number }[]; thong_tin: Record<string, string> }) {
  try { return await qualityRequest<{ id: string; record: RecordSet }>({ action: "accept-complete-geometry", ...input }); } finally { notifyWeldQualityChanged(); }
}
export type SplitRecordSummary = { id: string; so_phieu: string; ngay_nghiem_thu: string; nguoi_nghiem_thu: string | null; da_ky: boolean; nguoi_ky: string | null; ngay_ky: string | null; tong_moi: number; dat: number };
export const loadSplitRecords = (du_an_id: string, loai: "hinh-hoc" | "sieu-am" = "sieu-am") => qualityRequest<{ records: SplitRecordSummary[] }>({ action: "split-record-list", du_an_id, loai });
export async function signSplitRecord(id: string, da_ky: boolean) {
  try { return await qualityRequest<{ ok: boolean }>({ action: "split-record-sign", id, da_ky }); } finally { notifyWeldQualityChanged(); }
}
export const loadGeometryRecord = (id: string) => qualityRequest<RecordSet>({ action: "geometry-record", id });
export const loadRecords = (du_an_id: string) => qualityRequest<{ records: RecordSummary[] }>({ action: "record-list", du_an_id });
export const loadRecordSet = (id: string) => qualityRequest<RecordSet>({ action: "record-set", id });
export const setRecordSign = (id: string, tinh_trang_ky: "Chờ ký" | "Đã ký") => qualityRequest<{ ok: true }>({ action: "record-sign", id, tinh_trang_ky });
/** Ký / bỏ ký đồng bộ cả bộ 3 biên bản của một đợt. */
export async function setRecordSetSign(dot_id: string, tinh_trang_ky: "Chờ ký" | "Đã ký") {
  const result = await qualityRequest<{ ok: true; count?: number }>({ action: "record-sign", dot_id, tinh_trang_ky });
  notifyWeldQualityChanged();
  return result;
}
export async function setRfiChildSign(phieu_rfi_id: string, tinh_trang_ky: "Chờ ký" | "Đã ký") {
  await qualityRequest({ action: "record-sign", phieu_rfi_id, tinh_trang_ky });
  notifyWeldQualityChanged();
}

export type DashboardQualityData = { accepted: WeldReportRow[]; waiting: WeldReportRow[]; acceptance?: WeldReportRow[]; signing?: WeldReportRow[];
  ground?: WeldReportRow[]; ultrasound?: WeldReportRow[]; paid?: WeldReportRow[]; partialPaid?: WeldReportRow[]; unpaid?: WeldReportRow[] };
export const loadDashboardQuality = (filters: { projects?: string[]; dateFrom?: string; dateTo?: string }) =>
  qualityRequest<DashboardQualityData>({ action: "dashboard-quality", filters });

export const loadAcceptedOnDate = (date: string, du_an_id?: string | null) =>
  qualityRequest<{ count: number }>({ action: "accepted-on-date", date, du_an_id: du_an_id || undefined });

export const reviseRecord = (ho_so_id: string, thong_tin: Record<string, string>, ly_do: string) =>
  qualityRequest<{ ok: true }>({ action: "record-revise", ho_so_id, thong_tin, ly_do });

/** Báo thanh toán đã đổi: cho cửa sổ hiện tại (sự kiện) và các tab khác của trình duyệt (storage event). */
export const PAYMENT_CHANGED_KEY = "weld-payment-changed-at";
function announcePaymentChange() {
  window.dispatchEvent(new Event("weld-payment-changed"));
  try { window.localStorage.setItem(PAYMENT_CHANGED_KEY, String(Date.now())); } catch { /* bỏ qua khi không ghi được */ }
}
export type WeldPayment = { moi_han_id: string; ngay_thanh_toan: string; ty_le: number; ghi_chu: string | null };
export const loadWeldPayments = (du_an_id: string) => qualityRequest<{ payments: WeldPayment[] }>({ action: "payment-list", du_an_id });
/** Thanh toán của đúng các mối đang hiện (danh sách nhật ký hàn). */
export const loadWeldPaymentsOf = (moi_han_ids: string[]) => qualityRequest<{ payments: WeldPayment[]; ultrasoundRates: Record<string, number> }>({ action: "payment-map", moi_han_ids });
export const loadTicketWelds = (du_an_id: string, phieu_id: string) => qualityRequest<{ moi_han_ids: string[] }>({ action: "payment-ticket", du_an_id, phieu_id });
export async function saveWeldPayments(du_an_id: string, moi_han_ids: string[], ngay_thanh_toan: string, ty_le: number, ghi_chu: string) {
  const result = await qualityRequest<{ count: number }>({ action: "payment-set", du_an_id, moi_han_ids, ngay_thanh_toan, ty_le, ghi_chu });
  announcePaymentChange();
  return result;
}
export async function saveTicketPayments(du_an_id: string, phieu_id: string, ngay_thanh_toan: string, ty_le: number, ghi_chu: string) {
  const result = await qualityRequest<{ count: number }>({ action: "payment-set", du_an_id, phieu_id, ngay_thanh_toan, ty_le, ghi_chu });
  announcePaymentChange();
  return result;
}
export async function clearWeldPayments(du_an_id: string, moi_han_ids: string[]) {
  const result = await qualityRequest<{ count: number }>({ action: "payment-clear", du_an_id, moi_han_ids });
  announcePaymentChange();
  return result;
}
