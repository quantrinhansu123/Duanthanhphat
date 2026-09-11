import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";
import type { AppliedReportFilters, DailyVolumePoint } from "@/lib/weldReportData";

/**
 * Dòng tổng hợp nhỏ dùng để dựng nhanh KPI/biểu đồ theo ngày.
 *
 * Hai phiên bản migration đang được sử dụng ở các môi trường khác nhau:
 * - bản cũ: so_luong_thuc_hien / so_luong_loi;
 * - bản mới: so_moi / so_dat / so_khong_dat / ...
 * Giữ cả hai dạng để deploy frontend trước khi migration mới được chạy.
 */
export type WeldDailyRollupRow = {
  ngay_thuc_hien: string;
  du_an_id: string;
  du_an?: string | null;
  ma_du_an?: string | null;
  cong_nghe_han: string;
  loai_moi_han: string;
  so_moi?: number | null;
  so_dat?: number | null;
  so_khong_dat?: number | null;
  so_cho_tn?: number | null;
  so_khong_tn?: number | null;
  so_han_lai?: number | null;
  so_luong_thuc_hien?: number | null;
  so_luong_loi?: number | null;
};

export type WeldDailyRollupSource = "status" | "quantity" | "unavailable";

export type WeldDailyRollupResult = {
  rows: WeldDailyRollupRow[];
  source: WeldDailyRollupSource;
  error?: string;
};

export type WeldDailySummary = {
  total: number;
  errors: number;
  passed: number;
  pending: number;
  untested: number;
  rework: number;
  tested: number;
  fbw: number;
  atw: number;
};

const VIEW_COLUMNS =
  "ngay_thuc_hien,du_an_id,du_an,ma_du_an,cong_nghe_han,loai_moi_han,so_moi,so_dat,so_khong_dat,so_cho_tn,so_khong_tn,so_han_lai";
const STATUS_COLUMNS =
  "ngay_thuc_hien,du_an_id,cong_nghe_han,loai_moi_han,so_moi,so_dat,so_khong_dat,so_cho_tn,so_khong_tn,so_han_lai,du_an:du_an_id(du_an,ma_du_an)";
const QUANTITY_COLUMNS =
  "ngay_thuc_hien,du_an_id,cong_nghe_han,loai_moi_han,so_luong_thuc_hien,so_luong_loi,du_an:du_an_id(du_an,ma_du_an)";

let rollupPromise: Promise<WeldDailyRollupResult> | null = null;

type RawWeldDailyRollupRow = Omit<Partial<WeldDailyRollupRow>, "du_an"> & {
  du_an?: string | { du_an?: string | null; ma_du_an?: string | null } | null;
};

function normalizeRows(data: unknown): WeldDailyRollupRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((value) => value as RawWeldDailyRollupRow)
    .filter((row) => Boolean(row.ngay_thuc_hien && row.du_an_id))
    .map((row) => {
      const nestedProject =
        row.du_an && typeof row.du_an === "object" ? row.du_an : null;
      const projectName = nestedProject ? nestedProject.du_an : row.du_an;
      const projectCode = nestedProject ? nestedProject.ma_du_an : row.ma_du_an;
      return {
        ngay_thuc_hien: String(row.ngay_thuc_hien),
        du_an_id: String(row.du_an_id),
        du_an: projectName == null ? null : String(projectName),
        ma_du_an: projectCode == null ? null : String(projectCode),
        cong_nghe_han: String(row.cong_nghe_han ?? ""),
        loai_moi_han: String(row.loai_moi_han ?? ""),
        so_moi: row.so_moi == null ? null : Number(row.so_moi),
        so_dat: row.so_dat == null ? null : Number(row.so_dat),
        so_khong_dat: row.so_khong_dat == null ? null : Number(row.so_khong_dat),
        so_cho_tn: row.so_cho_tn == null ? null : Number(row.so_cho_tn),
        so_khong_tn: row.so_khong_tn == null ? null : Number(row.so_khong_tn),
        so_han_lai: row.so_han_lai == null ? null : Number(row.so_han_lai),
        so_luong_thuc_hien:
          row.so_luong_thuc_hien == null ? null : Number(row.so_luong_thuc_hien),
        so_luong_loi: row.so_luong_loi == null ? null : Number(row.so_luong_loi),
      };
    });
}

async function loadRollupRows(): Promise<WeldDailyRollupResult> {
  if (!isSupabaseConfigured()) {
    return {
      rows: [],
      source: "unavailable",
      error: "Chưa cấu hình Supabase",
    };
  }

  const supabase = createClient();

  // Thử schema cũ trước vì đó là schema đang có ở môi trường hiện tại.
  const quantityResult = await supabase
    .from("thong_ke_moi_han_theo_ngay")
    .select(QUANTITY_COLUMNS)
    .order("ngay_thuc_hien", { ascending: true })
    .limit(5000);
  if (!quantityResult.error) {
    const rows = normalizeRows(quantityResult.data);
    return { rows, source: "quantity" };
  }

  // Migration đếm dòng mới: nếu schema cũ không còn, đọc các cột trạng thái.
  const statusResult = await supabase
    .from("thong_ke_moi_han_theo_ngay")
    .select(STATUS_COLUMNS)
    .order("ngay_thuc_hien", { ascending: true })
    .limit(5000);
  if (!statusResult.error) {
    return { rows: normalizeRows(statusResult.data), source: "status" };
  }

  // Fallback cuối cho môi trường chỉ expose view tổng hợp mới.
  const viewResult = await supabase
    .from("thong_ke_moi_han_theo_ngay_du_an")
    .select(VIEW_COLUMNS)
    .order("ngay_thuc_hien", { ascending: true })
    .limit(5000);
  if (!viewResult.error) {
    return { rows: normalizeRows(viewResult.data), source: "status" };
  }

  return {
    rows: [],
    source: "unavailable",
    error: formatSupabaseError(quantityResult.error ?? statusResult.error ?? viewResult.error),
  };
}

/** Đọc rollup một lần cho mỗi session; bảng chỉ có vài dòng nên cache Promise an toàn. */
export function loadWeldDailyRollupRows(): Promise<WeldDailyRollupResult> {
  if (!rollupPromise) rollupPromise = loadRollupRows();
  return rollupPromise;
}

export function invalidateWeldDailyRollupCache() {
  rollupPromise = null;
}

export function filterWeldDailyRollupRows(
  rows: WeldDailyRollupRow[],
  filters: AppliedReportFilters,
) {
  const projectNames = new Set(filters.projects);
  const personnelOrMachineFilter = filters.personnel.length > 0 || filters.machines.length > 0;
  return rows.filter((row) => {
    if (filters.dateFrom && row.ngay_thuc_hien < filters.dateFrom) return false;
    if (filters.dateTo && row.ngay_thuc_hien > filters.dateTo) return false;
    if (projectNames.size > 0 && !projectNames.has(row.du_an ?? "")) return false;
    if (filters.methods.length > 0 && !filters.methods.includes(row.cong_nghe_han)) return false;
    if (filters.weldTypes.length > 0 && !filters.weldTypes.includes(row.loai_moi_han)) return false;
    // Rollup không có nhân sự/máy. Không trả số liệu nhanh khi hai bộ lọc này đang dùng.
    if (personnelOrMachineFilter) return false;
    return true;
  });
}

function rowTotal(row: WeldDailyRollupRow) {
  return Math.max(0, Number(row.so_moi ?? row.so_luong_thuc_hien ?? 0));
}

function rowErrors(row: WeldDailyRollupRow) {
  return Math.max(0, Number(row.so_khong_dat ?? row.so_luong_loi ?? 0));
}

export function summarizeWeldDailyRollupRows(rows: WeldDailyRollupRow[]): WeldDailySummary {
  const summary: WeldDailySummary = {
    total: 0,
    errors: 0,
    passed: 0,
    pending: 0,
    untested: 0,
    rework: 0,
    tested: 0,
    fbw: 0,
    atw: 0,
  };

  rows.forEach((row) => {
    const total = rowTotal(row);
    const errors = rowErrors(row);
    const pending = Math.max(0, Number(row.so_cho_tn ?? 0));
    const untested = Math.max(0, Number(row.so_khong_tn ?? 0));
    const passed = row.so_dat == null ? Math.max(0, total - errors) : Math.max(0, Number(row.so_dat));
    summary.total += total;
    summary.errors += errors;
    summary.passed += passed;
    summary.pending += pending;
    summary.untested += untested;
    summary.rework += Math.max(0, Number(row.so_han_lai ?? 0));
    summary.tested += Math.max(0, total - untested);
    if (row.cong_nghe_han === "FBW") summary.fbw += total;
    if (row.cong_nghe_han === "ATW") summary.atw += total;
  });

  return summary;
}

export function buildWeldDailyRollupSeries(
  rows: WeldDailyRollupRow[],
  dateFrom: string,
  dateTo: string,
): DailyVolumePoint[] {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    if (row.ngay_thuc_hien < dateFrom || row.ngay_thuc_hien > dateTo) return;
    counts.set(row.ngay_thuc_hien, (counts.get(row.ngay_thuc_hien) ?? 0) + rowTotal(row));
  });
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { date: iso, value: counts.get(iso) ?? 0 };
  });
}
