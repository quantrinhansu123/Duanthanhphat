import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";
import { defaultCertificatesForPersonnelCode, parseCertificateList } from "@/lib/weldingCertificates";

export const REPORT_MACHINES = [
  "KCM007-01",
  "UN5-150ZC2-01",
  "KCM007-02",
  "UN5-150ZC2-02",
] as const;

export type ReportMachine = (typeof REPORT_MACHINES)[number];

export type WeldReportRow = {
  id: string;
  ma_lich_su: string;
  du_an_id: string;
  ma_du_an: string;
  du_an: string;
  nam_thuc_hien: number;
  ngay_thuc_hien?: string | null;
  loai_ray: string;
  loai_moi_han: "Sản xuất" | "Thử nghiệm" | "Đào tạo";
  cong_nghe_han: "FBW" | "ATW";
  so_luong_thuc_hien: number;
  so_luong_loi: number;
  tho_han_id: string;
  ma_nhan_su: string;
  ten_tho_han: string;
  nguyen_nhan_loi: string | null;
  ghi_chu?: string | null;
  moi_han_lien_ket?: string | null;
  may_id?: string | null;
  ma_may?: string | null;
  ten_may?: string | null;
  to_han?: string | null;
  chung_chi_nhan_su?: string[] | null;
  chung_chi_su_dung?: string | null;
};

export type WeldReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  projects?: string[];
  personnel?: string[];
  machines?: string[];
  methods?: string[];
  weldTypes?: string[];
};

export const REPORT_PERIOD_START = "2017-01-01";
export const REPORT_PERIOD_END = "2026-12-31";

export type AppliedReportFilters = {
  dateFrom: string;
  dateTo: string;
  projects: string[];
  personnel: string[];
  machines: string[];
  methods: string[];
  weldTypes: string[];
};

export type WeldSummary = {
  total: number;
  errors: number;
  passed: number;
  fbw: number;
  atw: number;
};

const REPORT_COLUMNS_BASE = [
  "id",
  "ma_lich_su",
  "du_an_id",
  "ma_du_an",
  "du_an",
  "nam_thuc_hien",
  "loai_ray",
  "loai_moi_han",
  "cong_nghe_han",
  "so_luong_thuc_hien",
  "so_luong_loi",
  "tho_han_id",
  "ma_nhan_su",
  "ten_tho_han",
  "nguyen_nhan_loi",
  "ghi_chu",
] as const;

const REPORT_COLUMNS_WITH_LINK = [...REPORT_COLUMNS_BASE, "moi_han_lien_ket"] as const;
const REPORT_COLUMNS_WITH_MACHINE = [
  ...REPORT_COLUMNS_WITH_LINK,
  "may_id",
  "ma_may",
  "ten_may",
] as const;
const REPORT_COLUMNS_WITH_TEAM = [...REPORT_COLUMNS_WITH_MACHINE, "to_han"] as const;
const REPORT_COLUMNS_WITH_CERTIFICATE = [
  ...REPORT_COLUMNS_WITH_TEAM,
  "chung_chi_nhan_su",
  "chung_chi_su_dung",
] as const;
const REPORT_COLUMNS_WITH_DATE = [
  ...REPORT_COLUMNS_WITH_CERTIFICATE,
  "ngay_thuc_hien",
] as const;

let reportRowsPromise: Promise<WeldReportRow[]> | null = null;

export function invalidateWeldReportCache() {
  reportRowsPromise = null;
}

export type WeldJournalInsert = {
  ma_lich_su: string;
  du_an_id: string;
  tho_han_id: string;
  nam_thuc_hien: number;
  ngay_thuc_hien: string;
  loai_ray: string;
  loai_moi_han: WeldReportRow["loai_moi_han"];
  cong_nghe_han: WeldReportRow["cong_nghe_han"];
  so_luong_loi: number;
  nguyen_nhan_loi?: string | null;
  ghi_chu?: string | null;
  moi_han_lien_ket?: string | null;
  may_id: string;
  chung_chi_su_dung: string;
};

export async function insertWeldJournalEntry(payload: WeldJournalInsert) {
  const supabase = createClient();
  const { error } = await supabase.from("lich_su_moi_han").insert({
    ma_lich_su: payload.ma_lich_su.trim(),
    du_an_id: payload.du_an_id,
    tho_han_id: payload.tho_han_id,
    nam_thuc_hien: payload.nam_thuc_hien,
    ngay_thuc_hien: payload.ngay_thuc_hien,
    loai_ray: payload.loai_ray.trim(),
    loai_moi_han: payload.loai_moi_han,
    cong_nghe_han: payload.cong_nghe_han,
    so_luong_thuc_hien: 1,
    so_luong_loi: payload.so_luong_loi,
    nguyen_nhan_loi: payload.nguyen_nhan_loi?.trim() || null,
    ghi_chu: payload.ghi_chu?.trim() || null,
    moi_han_lien_ket: payload.moi_han_lien_ket?.trim() || null,
    may_id: payload.may_id,
    chung_chi_su_dung: payload.chung_chi_su_dung.trim(),
    nguon_du_lieu: "nhat-ky-han",
  });

  if (error) throw error;
  invalidateWeldReportCache();
}

export function uniqueProjectOptions(rows: WeldReportRow[]) {
  const map = new Map<string, { id: string; label: string }>();
  for (const row of rows) {
    map.set(row.du_an_id, { id: row.du_an_id, label: row.du_an });
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

export function getJournalRowDateIso(row: WeldReportRow, index = 0): string {
  if (row.ngay_thuc_hien) return row.ngay_thuc_hien.slice(0, 10);
  const sequence = Number(row.ma_lich_su.match(/(\d+)$/)?.[1] ?? index + 1);
  const day = String(((sequence * 7) % 28) + 1).padStart(2, "0");
  const month = String(((sequence * 5) % 12) + 1).padStart(2, "0");
  return `${row.nam_thuc_hien}-${month}-${day}`;
}

export function formatJournalDateIso(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function listFailedWeldsInDateRange(
  rows: WeldReportRow[],
  dateFrom: string,
  dateTo: string,
) {
  return rows
    .map((row, index) => ({
      row,
      isoDate: getJournalRowDateIso(row, index),
    }))
    .filter(({ row, isoDate }) => row.so_luong_loi > 0 && isoDate >= dateFrom && isoDate <= dateTo)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.row.ma_lich_su.localeCompare(b.row.ma_lich_su))
    .map(({ row, isoDate }) => ({
      value: row.ma_lich_su,
      label: `${row.ma_lich_su} · ${formatJournalDateIso(isoDate)} · ${row.du_an}`,
      isoDate,
    }));
}

export type WeldJournalPageQuery = {
  page: number;
  pageSize?: number;
  query?: string;
  project?: string;
  resultFilter?: string;
};

export type WeldJournalPageResult = {
  rows: WeldReportRow[];
  total: number;
  page: number;
  pageSize: number;
  passCount: number;
  failCount: number;
};

const JOURNAL_PAGE_COLUMNS = [
  ...REPORT_COLUMNS_WITH_DATE,
].join(",");

/** Tải 1 trang nhật ký hàn từ Supabase (mặc định 50 dòng). */
export async function loadWeldJournalPage({
  page,
  pageSize = 50,
  query = "",
  project = "Tất cả dự án",
  resultFilter = "Tất cả",
}: WeldJournalPageQuery): Promise<WeldJournalPageResult> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Chưa cấu hình Supabase. Tạo quan-ly-nhan-su/.env.local với NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const supabase = createClient();
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = query.trim();

  let request = supabase
    .from("bao_cao_moi_han_theo_du_an")
    .select(JOURNAL_PAGE_COLUMNS, { count: "exact" })
    .order("nam_thuc_hien", { ascending: false })
    .order("ngay_thuc_hien", { ascending: false, nullsFirst: false })
    .order("ma_lich_su", { ascending: true });

  if (project && project !== "Tất cả dự án") {
    request = request.eq("du_an", project);
  }
  if (resultFilter === "Đạt") {
    request = request.eq("so_luong_loi", 0);
  } else if (resultFilter === "Không đạt") {
    request = request.gt("so_luong_loi", 0);
  }
  if (q) {
    request = request.or(
      [
        `ten_tho_han.ilike.%${q}%`,
        `du_an.ilike.%${q}%`,
        `ma_lich_su.ilike.%${q}%`,
        `chung_chi_su_dung.ilike.%${q}%`,
        `ma_may.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error, count } = await request.range(from, to);
  if (error) {
    // Fallback nếu thiếu cột máy/ngày — bỏ filter or phức tạp
    const fallback = await supabase
      .from("bao_cao_moi_han_theo_du_an")
      .select(REPORT_COLUMNS_BASE.join(","), { count: "exact" })
      .order("nam_thuc_hien", { ascending: false })
      .order("ma_lich_su", { ascending: true })
      .range(from, to);
    if (fallback.error) throw error;
    const rows = (fallback.data ?? []) as unknown as WeldReportRow[];
    const summary = summarizeJournalRows(rows);
    return {
      rows,
      total: fallback.count ?? rows.length,
      page: safePage,
      pageSize,
      passCount: summary.passed,
      failCount: summary.errors,
    };
  }

  const rows = (data ?? []) as unknown as WeldReportRow[];

  // Đếm đạt / không đạt trên toàn bộ bộ lọc (head count), không chỉ trang hiện tại.
  let passCount = 0;
  let failCount = 0;
  {
    let passReq = supabase
      .from("bao_cao_moi_han_theo_du_an")
      .select("id", { count: "exact", head: true })
      .eq("so_luong_loi", 0);
    let failReq = supabase
      .from("bao_cao_moi_han_theo_du_an")
      .select("id", { count: "exact", head: true })
      .gt("so_luong_loi", 0);
    if (project && project !== "Tất cả dự án") {
      passReq = passReq.eq("du_an", project);
      failReq = failReq.eq("du_an", project);
    }
    if (q) {
      const orFilter = [
        `ten_tho_han.ilike.%${q}%`,
        `du_an.ilike.%${q}%`,
        `ma_lich_su.ilike.%${q}%`,
        `chung_chi_su_dung.ilike.%${q}%`,
        `ma_may.ilike.%${q}%`,
      ].join(",");
      passReq = passReq.or(orFilter);
      failReq = failReq.or(orFilter);
    }
    if (resultFilter === "Đạt") {
      failCount = 0;
      const passRes = await passReq;
      passCount = passRes.count ?? 0;
    } else if (resultFilter === "Không đạt") {
      passCount = 0;
      const failRes = await failReq;
      failCount = failRes.count ?? 0;
    } else {
      const [passRes, failRes] = await Promise.all([passReq, failReq]);
      passCount = passRes.count ?? 0;
      failCount = failRes.count ?? 0;
    }
  }

  return {
    rows,
    total: count ?? rows.length,
    page: safePage,
    pageSize,
    passCount,
    failCount,
  };
}

/** Danh sách dự án nhẹ cho filter/form — không cần load toàn bộ nhật ký. */
export async function loadJournalProjectOptions() {
  if (!isSupabaseConfigured()) return [] as { id: string; label: string }[];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("du_an")
    .select("id,du_an")
    .order("du_an", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id as string, label: row.du_an as string }));
}

/** Mối hàn lỗi trong khoảng ngày — query có giới hạn, dùng cho form liên kết. */
export async function fetchFailedWeldsInDateRange(dateFrom: string, dateTo: string, limit = 200) {
  if (!isSupabaseConfigured()) return [] as ReturnType<typeof listFailedWeldsInDateRange>;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bao_cao_moi_han_theo_du_an")
    .select("ma_lich_su,du_an,ngay_thuc_hien,nam_thuc_hien,so_luong_loi")
    .gt("so_luong_loi", 0)
    .gte("ngay_thuc_hien", dateFrom)
    .lte("ngay_thuc_hien", dateTo)
    .order("ngay_thuc_hien", { ascending: true })
    .limit(limit);
  if (error) {
    // Fallback khi chưa có cột ngày: dùng list rỗng thay vì kéo cả bảng.
    return [];
  }
  return (data ?? []).map((row) => {
    const iso = (row.ngay_thuc_hien as string | null)?.slice(0, 10)
      ?? `${row.nam_thuc_hien}-12-01`;
    return {
      value: row.ma_lich_su as string,
      label: `${row.ma_lich_su} · ${formatJournalDateIso(iso)} · ${row.du_an}`,
      isoDate: iso,
    };
  });
}

export type CertifiedWelderOption = {
  id: string;
  label: string;
  certificates: string[];
};

export function uniqueWelderOptions(rows: WeldReportRow[]): CertifiedWelderOption[] {
  const map = new Map<string, CertifiedWelderOption>();
  for (const row of rows) {
    const certificates = row.chung_chi_nhan_su?.length
      ? parseCertificateList(row.chung_chi_nhan_su)
      : defaultCertificatesForPersonnelCode(row.ma_nhan_su);
    const existing = map.get(row.tho_han_id);
    map.set(row.tho_han_id, {
      id: row.tho_han_id,
      label: row.ten_tho_han,
      certificates: Array.from(new Set([...(existing?.certificates ?? []), ...certificates])),
    });
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

async function fetchWeldReportRows(columns: readonly string[]) {
  const supabase = createClient();
  const pageSize = 1000;
  const rows: WeldReportRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("bao_cao_moi_han_theo_du_an")
      .select(columns.join(","))
      .order("nam_thuc_hien", { ascending: false })
      .order("ma_lich_su", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const page = (data ?? []) as unknown as WeldReportRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export function loadWeldReportRows() {
  if (!reportRowsPromise) {
    reportRowsPromise = (async () => {
      if (!isSupabaseConfigured()) {
        throw new Error(
          "Chưa cấu hình Supabase. Tạo quan-ly-nhan-su/.env.local với NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY, rồi khởi động lại npm run dev.",
        );
      }

      try {
        return await fetchWeldReportRows(REPORT_COLUMNS_WITH_DATE);
      } catch (firstError) {
        const message = formatSupabaseError(firstError);
        const missingOptionalColumn =
          message.includes("may_id") ||
          message.includes("ma_may") ||
          message.includes("ten_may") ||
          message.includes("to_han") ||
          message.includes("chung_chi_nhan_su") ||
          message.includes("chung_chi_su_dung") ||
          message.includes("ngay_thuc_hien") ||
          message.includes("moi_han_lien_ket") ||
          message.includes("column") ||
          message.includes("42703");
        if (!missingOptionalColumn) throw firstError;
        try {
          return await fetchWeldReportRows(REPORT_COLUMNS_WITH_CERTIFICATE);
        } catch {
          try {
            return await fetchWeldReportRows(REPORT_COLUMNS_WITH_TEAM);
          } catch {
            try {
              return await fetchWeldReportRows(REPORT_COLUMNS_WITH_MACHINE);
            } catch {
              try {
                return await fetchWeldReportRows(REPORT_COLUMNS_WITH_LINK);
              } catch {
                return fetchWeldReportRows(REPORT_COLUMNS_BASE);
              }
            }
          }
        }
      }
    })().catch((error) => {
      reportRowsPromise = null;
      throw new Error(formatSupabaseError(error));
    });
  }

  return reportRowsPromise;
}

export function machineForRow(row: WeldReportRow): string {
  return row.ma_may?.trim() || "Chưa gán máy";
}

export function filterWeldReportRows(rows: WeldReportRow[], filters: WeldReportFilters) {
  return rows.filter((row, index) => {
    const performedDate = getJournalRowDateIso(row, index);
    if (filters.dateFrom && performedDate < filters.dateFrom) return false;
    if (filters.dateTo && performedDate > filters.dateTo) return false;
    if (filters.projects?.length && !filters.projects.includes(row.du_an)) return false;
    if (filters.personnel?.length && !filters.personnel.includes(row.ten_tho_han)) return false;
    if (filters.machines?.length && !filters.machines.includes(machineForRow(row))) return false;
    if (filters.methods?.length && !filters.methods.includes(row.cong_nghe_han)) return false;
    if (filters.weldTypes?.length && !filters.weldTypes.includes(row.loai_moi_han)) return false;
    return true;
  });
}

export function summarizeWeldRows(rows: WeldReportRow[]): WeldSummary {
  const summary = rows.reduce(
    (result, row) => {
      result.total += row.so_luong_thuc_hien;
      result.errors += row.so_luong_loi;
      if (row.cong_nghe_han === "FBW") result.fbw += row.so_luong_thuc_hien;
      else result.atw += row.so_luong_thuc_hien;
      return result;
    },
    { total: 0, errors: 0, passed: 0, fbw: 0, atw: 0 },
  );
  summary.passed = summary.total - summary.errors;
  return summary;
}

/** Tổng hợp theo bản ghi nhật ký — mỗi dòng = 1 mối (giống /nhat-ky-han). */
export function summarizeJournalRows(rows: WeldReportRow[]): WeldSummary {
  let passed = 0;
  let failed = 0;
  let fbw = 0;
  let atw = 0;
  for (const row of rows) {
    if (row.so_luong_loi === 0) passed += 1;
    else failed += 1;
    if (row.cong_nghe_han === "FBW") fbw += 1;
    else atw += 1;
  }
  return { total: rows.length, errors: failed, passed, fbw, atw };
}

export function hasLinkedWeld(row: WeldReportRow): boolean {
  return Boolean(row.moi_han_lien_ket?.trim());
}

/** Sửa / hàn lại — đếm mối hàn nhật ký có cột Mối hàn liên kết không trống. */
export function countReworkWelds(rows: WeldReportRow[]): number {
  return rows.filter(hasLinkedWeld).length;
}

export function filterReworkRows(rows: WeldReportRow[]): WeldReportRow[] {
  return rows.filter(hasLinkedWeld);
}

export function groupJournalRows(
  rows: WeldReportRow[],
  keyForRow: (row: WeldReportRow) => string,
) {
  const groups = new Map<string, WeldReportRow[]>();
  for (const row of rows) {
    const key = keyForRow(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return Array.from(groups, ([name, groupRows]) => ({
    name,
    rows: groupRows,
    ...summarizeJournalRows(groupRows),
  }));
}

export function uniqueReportValues(rows: WeldReportRow[], field: "du_an" | "ten_tho_han" | "loai_ray") {
  return Array.from(new Set(rows.map((row) => row[field]))).sort((a, b) =>
    a.localeCompare(b, "vi"),
  );
}

export function groupWeldRows(
  rows: WeldReportRow[],
  keyForRow: (row: WeldReportRow) => string,
) {
  const groups = new Map<string, WeldReportRow[]>();
  for (const row of rows) {
    const key = keyForRow(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return Array.from(groups, ([name, groupRows]) => ({
    name,
    rows: groupRows,
    ...summarizeWeldRows(groupRows),
  }));
}

export type YearVolumePoint = {
  year: number;
  value: number;
  errors: number;
};

export type ErrorReasonRow = {
  label: string;
  count: number;
  pct: number;
};

/** Đếm bản ghi nhật ký theo năm (mỗi dòng = 1 mối). */
export function buildYearlyJournalSeries(rows: WeldReportRow[]): YearVolumePoint[] {
  const byYear = new Map<number, { value: number; errors: number }>();
  for (const row of rows) {
    const current = byYear.get(row.nam_thuc_hien) ?? { value: 0, errors: 0 };
    current.value += 1;
    if (row.so_luong_loi > 0) current.errors += 1;
    byYear.set(row.nam_thuc_hien, current);
  }
  return Array.from(byYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, stats]) => ({ year, ...stats }));
}

/** Tổng hợp sản lượng thật theo năm từ nhật ký hàn (lich_su_moi_han). */
export function buildYearlyVolumeSeries(rows: WeldReportRow[]): YearVolumePoint[] {
  const byYear = new Map<number, { value: number; errors: number }>();
  for (const row of rows) {
    const current = byYear.get(row.nam_thuc_hien) ?? { value: 0, errors: 0 };
    current.value += row.so_luong_thuc_hien;
    current.errors += row.so_luong_loi;
    byYear.set(row.nam_thuc_hien, current);
  }
  return Array.from(byYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, stats]) => ({ year, ...stats }));
}

/** Nhóm nguyên nhân lỗi theo bản ghi nhật ký (mỗi dòng lỗi = 1). */
export function groupJournalErrorReasons(rows: WeldReportRow[], limit = 5): ErrorReasonRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.so_luong_loi <= 0) continue;
    const reason = row.nguyen_nhan_loi?.trim() || "Chưa ghi nguyên nhân";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  if (counts.size === 0) return [];
  const max = Math.max(...counts.values());
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / max) * 100),
    }));
}

/** Nhóm nguyên nhân lỗi thật từ nhật ký hàn. */
export function groupErrorReasons(rows: WeldReportRow[], limit = 5): ErrorReasonRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.so_luong_loi <= 0) continue;
    const reason = row.nguyen_nhan_loi?.trim() || "Chưa ghi nguyên nhân";
    counts.set(reason, (counts.get(reason) ?? 0) + row.so_luong_loi);
  }
  if (counts.size === 0) return [];
  const max = Math.max(...counts.values());
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / max) * 100),
    }));
}

export function formatYearOverYear(current: number, previous: number) {
  if (previous <= 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const formatted = Math.abs(delta)
    .toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .replace(".", ",");
  return { delta, formatted, up: delta >= 0 };
}

export const CHART_MAX_DAYS = 31;

/** Mẫu sản lượng/ngày cố định — Supabase chỉ có tổng theo năm. */
export const DAILY_VOLUME_PATTERN = [
  128, 148, 138, 158, 176, 150, 142, 156, 168, 152,
  132, 146, 190, 168, 158, 150, 120, 112, 126, 146,
  164, 152, 140, 158, 176, 166, 152, 142, 176, 164,
];

export type DailyVolumePoint = {
  date: string;
  value: number;
};

function toIsoDateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Rút gọn khoảng ngày cho biểu đồ (tối đa 31 ngày, kết thúc tại hôm nay hoặc dateTo). */
export function resolveChartDateRange(
  dateFrom: string,
  dateTo: string,
  maxDays = CHART_MAX_DAYS,
) {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let effectiveEnd = end.getTime() > today.getTime() ? today : end;
  if (effectiveEnd.getTime() < start.getTime()) effectiveEnd = start;

  const totalDays =
    Math.round((effectiveEnd.getTime() - start.getTime()) / 86400000) + 1;

  if (totalDays <= maxDays) {
    return {
      from: dateFrom,
      to: toIsoDateLocal(effectiveEnd),
    };
  }

  const fromDate = new Date(effectiveEnd);
  fromDate.setDate(fromDate.getDate() - (maxDays - 1));
  const clampedFrom = fromDate.getTime() < start.getTime() ? start : fromDate;

  return {
    from: toIsoDateLocal(clampedFrom),
    to: toIsoDateLocal(effectiveEnd),
  };
}

/** Tổng hợp theo ngày thực hiện thật; dữ liệu cũ thiếu ngày dùng mốc suy từ mã lịch sử. */
export function buildDailyJournalSeries(
  rows: WeldReportRow[],
  dateFrom: string,
  dateTo: string,
): DailyVolumePoint[] {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

  const counts = new Map<string, number>();
  rows.forEach((row, index) => {
    const iso = getJournalRowDateIso(row, index);
    if (iso >= dateFrom && iso <= dateTo) {
      counts.set(iso, (counts.get(iso) ?? 0) + row.so_luong_thuc_hien);
    }
  });

  const points: DailyVolumePoint[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = toIsoDateLocal(d);
    points.push({ date: iso, value: counts.get(iso) ?? 0 });
  }
  return points;
}

export type DonutArc = {
  dasharray: string;
  transform: string;
};

export function buildDonutArcs(values: number[], radius = 52, center = 70): DonutArc[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  const circumference = 2 * Math.PI * radius;
  let rotation = -90;
  return values.map((value) => {
    const share = value / total;
    const arcLen = share * circumference;
    const seg = {
      dasharray: `${arcLen} ${circumference - arcLen}`,
      transform: `rotate(${rotation} ${center} ${center})`,
    };
    rotation += share * 360;
    return seg;
  });
}

/** Chuỗi sản lượng theo ngày trong khoảng đã chọn (mô phỏng từ mẫu cố định). */
export function buildDailyChartSeries(
  dateFrom: string,
  dateTo: string,
  selectedTotal: number,
  fullTotal: number,
): DailyVolumePoint[] {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const share = fullTotal > 0 ? Math.max(0.03, selectedTotal / fullTotal) : 0.03;

  const points: DailyVolumePoint[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const baseVal = DAILY_VOLUME_PATTERN[i % DAILY_VOLUME_PATTERN.length];
    const value =
      selectedTotal > 0 ? Math.max(1, Math.round(baseVal * share)) : 0;
    points.push({ date: toIsoDateLocal(d), value });
  }
  return points;
}

// Supabase chỉ có số liệu tổng hợp theo năm. Chuỗi này là dữ liệu mô phỏng
// có tính xác định để dashboard không thay đổi ngẫu nhiên sau mỗi lần tải lại.
export function buildSyntheticDailySeries(selectedTotal: number, fullTotal: number) {
  if (!selectedTotal || !fullTotal) return DAILY_VOLUME_PATTERN.map(() => 0);
  const share = Math.max(0.03, selectedTotal / fullTotal);
  return DAILY_VOLUME_PATTERN.map((value) => Math.max(1, Math.round(value * share)));
}

export function allocateSyntheticCounts(total: number, weights: number[]) {
  if (total <= 0) return weights.map(() => 0);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
  const raw = weights.map((weight) => (total * weight) / weightTotal);
  const result = raw.map(Math.floor);
  const remainder = total - result.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; index < remainder; index += 1) {
    result[order[index % order.length].index] += 1;
  }
  return result;
}
