import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";
import {
  NDT_DEFECT_MAP,
  WELD_TEST_STATUSES,
  type AppliedReportFilters,
  type ErrorReasonRow,
} from "@/lib/weldReportData";
import {
  loadMachineReportSummary,
  type MachineReportSummary,
} from "@/lib/machineRunSchedulesDb";

export type OverviewAggregateSummary = {
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

export type OverviewMachineAggregate = {
  code: string;
  total: number;
  errors: number;
};

export type OverviewProjectAggregate = {
  id: string;
  code: string;
  name: string;
  total: number;
  passed: number;
  errors: number;
};

export type OverviewAggregateResult = {
  summary: OverviewAggregateSummary;
  machineRows: OverviewMachineAggregate[];
  projectRows: OverviewProjectAggregate[];
  errorReasonRows: ErrorReasonRow[];
  doneBeforePlanYear: number;
  source: "supabase" | "unavailable";
  error?: string;
};

const aggregatePromises = new Map<string, Promise<OverviewAggregateResult>>();

const EMPTY_SUMMARY: OverviewAggregateSummary = {
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

export const EMPTY_OVERVIEW_AGGREGATE: OverviewAggregateResult = {
  summary: EMPTY_SUMMARY,
  machineRows: [],
  projectRows: [],
  errorReasonRows: [],
  doneBeforePlanYear: 0,
  source: "unavailable",
};

// Supabase's fluent query builder has a different concrete type for every
// chained filter. Keeping this small boundary untyped avoids leaking that
// implementation detail through the aggregate helpers below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AggregateQuery = any;

function applyFilters(query: AggregateQuery, filters: Partial<AppliedReportFilters>) {
  let next = query;
  if (filters.dateFrom) next = next.gte("ngay_thuc_hien", filters.dateFrom);
  if (filters.dateTo) next = next.lte("ngay_thuc_hien", filters.dateTo);
  if (filters.projects?.length) next = next.in("du_an", filters.projects);
  if (filters.personnel?.length) next = next.in("ten_tho_han", filters.personnel);
  if (filters.machines?.length) next = next.in("ma_may", filters.machines);
  if (filters.methods?.length) next = next.in("cong_nghe_han", filters.methods);
  if (filters.weldTypes?.length) next = next.in("loai_moi_han", filters.weldTypes);
  return next;
}

async function countRows(
  supabase: ReturnType<typeof createClient>,
  filters: Partial<AppliedReportFilters>,
  modify?: (query: AggregateQuery) => AggregateQuery,
) {
  let query = supabase
    .from("bao_cao_moi_han_theo_du_an")
    .select("id", { count: "exact", head: true });
  query = applyFilters(query, filters);
  if (modify) query = modify(query);
  const result = await query;
  if (result.error) throw result.error;
  return result.count ?? 0;
}

function makeErrorReasonRows(rows: Array<{ nguyen_nhan_loi?: string | null; ma_khuyet_tat?: unknown; so_luong_loi?: number | null }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (Number(row.so_luong_loi ?? 0) <= 0) continue;
    const codes = Array.isArray(row.ma_khuyet_tat)
      ? row.ma_khuyet_tat.map((code) => String(code)).filter(Boolean)
      : [];
    if (codes.length > 0) {
      for (const code of codes) {
        const label = NDT_DEFECT_MAP[code] || code;
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    } else {
      const label = row.nguyen_nhan_loi?.trim() || "Chưa ghi nguyên nhân";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const max = Math.max(...counts.values(), 0);
  if (!max) return [];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => ({ label, count, pct: Math.round((count / max) * 100) }));
}

async function loadErrorReasons(
  supabase: ReturnType<typeof createClient>,
  filters: Partial<AppliedReportFilters>,
): Promise<ErrorReasonRow[]> {
  let query = supabase
    .from("bao_cao_moi_han_theo_du_an")
    .select("nguyen_nhan_loi,ma_khuyet_tat,so_luong_loi")
    .gt("so_luong_loi", 0)
    .limit(1000);
  query = applyFilters(query, filters);
  const result = await query;
  // ma_khuyet_tat is optional on older deployments. The fallback still gives
  // the same reason grouping for the legacy rows.
  if (result.error && /ma_khuyet_tat/.test(result.error.message ?? "")) {
    let fallback = supabase
      .from("bao_cao_moi_han_theo_du_an")
      .select("nguyen_nhan_loi,so_luong_loi")
      .gt("so_luong_loi", 0)
      .limit(1000);
    fallback = applyFilters(fallback, filters);
    const fallbackResult = await fallback;
    if (fallbackResult.error) throw fallbackResult.error;
    return makeErrorReasonRows((fallbackResult.data ?? []) as Array<{ nguyen_nhan_loi?: string | null; so_luong_loi?: number | null }>);
  }
  if (result.error) throw result.error;
  return makeErrorReasonRows((result.data ?? []) as Array<{ nguyen_nhan_loi?: string | null; ma_khuyet_tat?: unknown; so_luong_loi?: number | null }>);
}

async function loadProjectAggregates(
  supabase: ReturnType<typeof createClient>,
): Promise<OverviewProjectAggregate[]> {
  const result = await supabase
    .from("tong_moi_han_nam_du_an")
    .select("du_an_id,ma_du_an,du_an,tong_moi_han,tong_loi,tong_dat")
    .order("du_an", { ascending: true });
  if (result.error) throw result.error;
  const byProject = new Map<string, OverviewProjectAggregate>();
  for (const raw of result.data ?? []) {
    const row = raw as {
      du_an_id?: string;
      ma_du_an?: string | null;
      du_an?: string | null;
      tong_moi_han?: number | null;
      tong_loi?: number | null;
      tong_dat?: number | null;
    };
    const id = String(row.du_an_id ?? row.du_an ?? "");
    const name = String(row.du_an ?? "").trim();
    if (!id || !name) continue;
    const current = byProject.get(id) ?? {
      id,
      code: String(row.ma_du_an ?? "").trim(),
      name,
      total: 0,
      passed: 0,
      errors: 0,
    };
    current.total += Number(row.tong_moi_han ?? 0);
    current.errors += Number(row.tong_loi ?? 0);
    current.passed += Number(row.tong_dat ?? Math.max(0, Number(row.tong_moi_han ?? 0) - Number(row.tong_loi ?? 0)));
    byProject.set(id, current);
  }
  return [...byProject.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "vi"));
}

async function loadMachineAggregates(): Promise<OverviewMachineAggregate[]> {
  const rows: MachineReportSummary[] = await loadMachineReportSummary();
  return rows
    .filter((row) => row.machineCode.trim())
    .map((row) => ({
      code: row.machineCode,
      total: row.weldCount,
      errors: row.failedWeldCount,
    }));
}

/**
 * Tải các số tổng hợp nhỏ cho trạng thái "Tất cả dữ liệu".
 * Các truy vấn đều là SELECT/HEAD; không tạo, sửa hay xóa dữ liệu DB.
 */
async function loadOverviewAggregatesUncached(
  filters: Partial<AppliedReportFilters> = {},
): Promise<OverviewAggregateResult> {
  if (!isSupabaseConfigured()) {
    return { ...EMPTY_OVERVIEW_AGGREGATE, error: "Chưa cấu hình Supabase" };
  }

  const supabase = createClient();
  const currentYear = new Date().getFullYear();

  try {
    const totalPromise = countRows(supabase, filters);
    const statusPromise = Promise.all(
      WELD_TEST_STATUSES.map((status) => countRows(supabase, filters, (query) => query.eq("tinh_trang_thi_nghiem", status))),
    ).catch(async () => {
      // Môi trường cũ có thể chưa có cột trạng thái. Khi đó vẫn hiển thị
      // tổng/không đạt theo so_luong_loi, còn hai nhóm trạng thái đặc biệt = 0.
      const total = await totalPromise;
      const failed = await countRows(supabase, filters, (query) => query.gt("so_luong_loi", 0));
      return [0, Math.max(0, total - failed), failed, 0];
    });
    const fbwPromise = countRows(supabase, filters, (query) => query.eq("cong_nghe_han", "FBW"));
    const atwPromise = countRows(supabase, filters, (query) => query.eq("cong_nghe_han", "ATW"));
    const reworkPromise = countRows(supabase, filters, (query) => query.not("moi_han_lien_ket", "is", null).neq("moi_han_lien_ket", ""));

    const [total, statuses, fbw, atw, rework, errorReasonRows, projectRows, machineRows, yearRows] = await Promise.all([
      totalPromise,
      statusPromise,
      fbwPromise,
      atwPromise,
      reworkPromise,
      loadErrorReasons(supabase, filters).catch(() => []),
      loadProjectAggregates(supabase).catch(() => []),
      loadMachineAggregates().catch(() => []),
      supabase.from("tong_moi_han_nam").select("nam,tong_moi_han").order("nam", { ascending: true }),
    ]);

    const [pending, passed, failed, untested] = statuses;
    const summary: OverviewAggregateSummary = {
      total,
      errors: failed,
      passed,
      pending,
      untested,
      rework,
      tested: passed + failed,
      fbw,
      atw,
    };
    const doneBeforePlanYear = yearRows.error
      ? 0
      : ((yearRows.data ?? []) as Array<{ nam?: number; tong_moi_han?: number }>).reduce(
          (sum, row) => (Number(row.nam) < currentYear ? sum + Number(row.tong_moi_han ?? 0) : sum),
          0,
        );

    return {
      summary,
      machineRows,
      projectRows,
      errorReasonRows,
      doneBeforePlanYear,
      source: "supabase",
      error: yearRows.error ? formatSupabaseError(yearRows.error) : undefined,
    };
  } catch (error) {
    return {
      ...EMPTY_OVERVIEW_AGGREGATE,
      source: "unavailable",
      error: formatSupabaseError(error),
    };
  }
}

function aggregateCacheKey(filters: Partial<AppliedReportFilters>) {
  return [
    filters.dateFrom ?? "",
    filters.dateTo ?? "",
    ...(filters.projects ?? []),
    "|",
    ...(filters.personnel ?? []),
    "|",
    ...(filters.machines ?? []),
    "|",
    ...(filters.methods ?? []),
    "|",
    ...(filters.weldTypes ?? []),
  ].join("\0");
}

/** Cache trong một session để chuyển tab quay lại không phát sinh lại 10 truy vấn tổng hợp. */
export function loadOverviewAggregates(
  filters: Partial<AppliedReportFilters> = {},
): Promise<OverviewAggregateResult> {
  const key = aggregateCacheKey(filters);
  const cached = aggregatePromises.get(key);
  if (cached) return cached;
  const request = loadOverviewAggregatesUncached(filters);
  aggregatePromises.set(key, request);
  return request;
}

export function invalidateOverviewAggregateCache() {
  aggregatePromises.clear();
}
