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
  if (res.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("weld-quality-login-required"));
  if (!res.ok) throw new WeldQualityRequestError(data.error ?? "Không kết nối được dữ liệu kiểm tra chất lượng.", res.status);
  return data as T;
}

export async function qualityRequest<T>(body: Record<string, unknown>): Promise<T> {
  return response<T>(await fetch("/api/weld-quality", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify(body), cache: "no-store" }));
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

export async function markQualityPass(entries: WeldQualitySelection[], kind: "visual" | "ndt", date: string, method: string) {
  try { return await qualityRequest<{ results: { id: string; error?: string; phien_ban?: number }[] }>({ action: "mark-pass", entries, kind, date, method }); }
  finally { notifyWeldQualityChanged(); }
}

// ---- Giai đoạn 4–6: RFI, nghiệm thu, hồ sơ ----
import type { AcceptanceDecision, RfiCandidate, RfiCandidateFilter } from "@/lib/weldAcceptance";

export type RfiSummary = { id: string; so_phieu: string; ngay_moi: string; trang_thai: string; nguoi_lap: string;
  thong_tin: Record<string, string>; created_at: string; tong_moi: number; con_lai: number };
export type RfiWeld = { moi_han_id: string; con_hieu_luc: boolean; ma_lich_su: string; ma_diem?: string | null; ngay_thuc_hien: string | null; ly_trinh: string | null; vi_do: number | null; kinh_do: number | null; phien_ban: number; tinh_trang: string; du_dieu_kien_nghiem_thu: boolean };
export type RecordSummary = { id: string; ngay_nghiem_thu: string; nguoi_lap: string; created_at: string;
  phieu_yeu_cau_nghiem_thu: { id: string; so_phieu: string }; ho_so_nghiem_thu: { id: string; loai: string; tinh_trang_ky: string }[] };
export type RecordSet = { dot: Record<string, unknown> & { phieu_yeu_cau_nghiem_thu: Record<string, unknown> & { du_an: Record<string, unknown> } };
  ho_so: { id: string; loai: string; tinh_trang_ky: string; du_lieu_chot: unknown }[];
  sua_doi?: { id: string; ho_so_id: string; phien_ban: number; thong_tin: Record<string, string>; ly_do: string; nguoi_sua: string; created_at: string }[];
  moi: { moi_han_id: string; ket_qua: string; ly_do: string | null; du_lieu_chot: { moi_han?: Record<string, unknown>; kiem_tra?: Record<string, unknown> } }[] };

export const loadRfiCandidates = (du_an_id: string, filters: RfiCandidateFilter) =>
  qualityRequest<{ rows: RfiCandidate[]; missingChainage: string[]; excluded: Record<string, number>; total: number }>({ action: "rfi-candidates", du_an_id, filters });
export const loadRfiNumber = (du_an_id: string) => qualityRequest<{ so_phieu: string }>({ action: "rfi-number", du_an_id });
export async function publishRfi(input: { id: string; du_an_id: string; so_phieu: string; ngay_moi: string; moi_han_ids: string[]; thong_tin: Record<string, string>; loai_rfi?: "nghiem-thu" | "theo-doi"; filters?: RfiCandidateFilter }) {
  try { return await qualityRequest<{ id: string }>({ action: "rfi-publish", ...input }); } finally { notifyWeldQualityChanged(); }
}
export const loadRfis = (du_an_id: string) => qualityRequest<{ rfis: RfiSummary[] }>({ action: "rfi-list", du_an_id });
export const loadRfiDetail = (id: string) => qualityRequest<{ rfi: RfiSummary & { du_an_id: string }; welds: RfiWeld[] }>({ action: "rfi-detail", id });
export async function completeAcceptance(input: { id: string; phieu_id: string; ngay_nghiem_thu: string; ket_qua: AcceptanceDecision[]; thong_tin: Record<string, string> }) {
  try { return await qualityRequest<{ id: string }>({ action: "accept-complete", ...input }); } finally { notifyWeldQualityChanged(); }
}
export const loadRecords = (du_an_id: string) => qualityRequest<{ records: RecordSummary[] }>({ action: "record-list", du_an_id });
export const loadRecordSet = (id: string) => qualityRequest<RecordSet>({ action: "record-set", id });
export const setRecordSign = (id: string, tinh_trang_ky: "Chờ ký" | "Đã ký") => qualityRequest<{ ok: true }>({ action: "record-sign", id, tinh_trang_ky });

export const loadDashboardQuality = (filters: { projects?: string[]; dateFrom?: string; dateTo?: string }) =>
  qualityRequest<{ accepted: WeldReportRow[]; waiting: WeldReportRow[] }>({ action: "dashboard-quality", filters });

export const loadAcceptedOnDate = (date: string, du_an_id?: string | null) =>
  qualityRequest<{ count: number }>({ action: "accepted-on-date", date, du_an_id: du_an_id || undefined });

export const reviseRecord = (ho_so_id: string, thong_tin: { dia_diem: string; thanh_phan: string }, ly_do: string) =>
  qualityRequest<{ ok: true }>({ action: "record-revise", ho_so_id, thong_tin, ly_do });
