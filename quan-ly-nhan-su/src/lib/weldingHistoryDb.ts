import {
  weldingHistory as seedHistory,
  type WeldingHistoryRecord,
} from "@/data/weldingHistory";
import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

const LOCAL_STORAGE_KEY = "tp_welding_history_custom_v1";

export interface SupabaseWeldRow {
  id: string;
  ma_lich_su?: string | null;
  ngay_thuc_hien?: string | null;
  nam_thuc_hien?: number | null;
  loai_ray?: string | null;
  loai_moi_han?: string | null;
  cong_nghe_han?: string | null;
  so_luong_thuc_hien?: number | null;
  so_luong_loi?: number | null;
  hach_toan?: string | null;
  moi_han_lien_ket?: string | null;
  ghi_chu?: string | null;
  nhan_su?: { ho_ten?: string | null } | null;
  du_an?: { du_an?: string | null } | null;
  may?: { ma_may?: string | null } | null;
}

export interface ViewWeldHistoryRow {
  id: string;
  ngay_thuc_hien?: string | null;
  nam_thuc_hien?: number | null;
  ma_lich_su?: string | null;
  ten_tho_han?: string | null;
  ghi_chu?: string | null;
  moi_han_lien_ket?: string | null;
  so_luong_loi?: number | null;
  ten_may?: string | null;
  loai_ray?: string | null;
  ten_du_an?: string | null;
  ca_han?: string | null;
  hach_toan?: string | null;
  ket_qua?: string | null;
}

function readLocalHistory(): WeldingHistoryRecord[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalHistory(list: WeldingHistoryRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Lỗi lưu LocalStorage cho lịch sử hàn:", err);
  }
}

export type WeldingHistoryLoadResult = {
  records: WeldingHistoryRecord[];
  source: "supabase" | "local" | "seed";
  error?: string;
};

function parseShift(ghiChu?: string | null, idx = 0): WeldingHistoryRecord["shift"] {
  if (!ghiChu) return (idx % 3 === 0 ? "Ca 1" : idx % 3 === 1 ? "Ca 2" : "Ca 3") as WeldingHistoryRecord["shift"];
  if (ghiChu.includes("Ca 1")) return "Ca 1";
  if (ghiChu.includes("Ca 2")) return "Ca 2";
  if (ghiChu.includes("Ca 3")) return "Ca 3";
  return "Ca 1";
}

function parseRank(ghiChu?: string | null): string {
  if (!ghiChu) return "Hạng 1";
  const match = ghiChu.match(/Hạng\s*(\d+|[A-Z]+)/i);
  return match ? match[0] : "Hạng 1";
}

function parseResult(row: SupabaseWeldRow): WeldingHistoryRecord["result"] {
  const ghiChu = row.ghi_chu || "";
  if (ghiChu.includes("Kết quả: Sửa chữa")) return "Sửa chữa";
  if (ghiChu.includes("Kết quả: Không đạt")) return "Không đạt";
  if (ghiChu.includes("Kết quả: Đạt")) return "Đạt";

  if ((row.so_luong_loi ?? 0) > 0) {
    if (ghiChu.toLowerCase().includes("sửa chữa") || (row.moi_han_lien_ket && row.moi_han_lien_ket.startsWith("SC-"))) {
      return "Sửa chữa";
    }
    return "Không đạt";
  }
  return "Đạt";
}

function parseWeldJoint(
  row: { ghi_chu?: string | null; moi_han_lien_ket?: string | null; ma_lich_su?: string | null },
  dateStr: string,
  idx: number,
): string {
  const ghiChu = row.ghi_chu || "";
  const match = ghiChu.match(/Mối hàn:\s*([^\s|]+)/i);
  if (match) return match[1];
  if (row.moi_han_lien_ket) {
    return row.moi_han_lien_ket.replace(/^SC-/, "");
  }
  return row.ma_lich_su || `MH-${dateStr.replace(/-/g, "")}-${String(idx + 1).padStart(2, "0")}`;
}

function mapSupabaseRow(row: SupabaseWeldRow, idx: number): WeldingHistoryRecord {
  const dateStr =
    row.ngay_thuc_hien ||
    `${row.nam_thuc_hien || 2026}-03-${String(15 - (idx % 14)).padStart(2, "0")}`;

  const result = parseResult(row);

  return {
    id: row.id,
    date: dateStr,
    weldingId: row.ma_lich_su || `WH${String(idx + 1).padStart(3, "0")}`,
    welderName: row.nhan_su?.ho_ten || "Thợ hàn chính",
    rank: parseRank(row.ghi_chu),
    weldJoint: parseWeldJoint(row, dateStr, idx),
    machine: row.may?.ma_may || "KCM007-01",
    railType: row.loai_ray || "UIC60",
    project: row.du_an?.du_an || "ĐSCT Bắc – Nam",
    shift: parseShift(row.ghi_chu, idx),
    accountingCode:
      row.hach_toan ||
      (idx % 4 === 0 ? "HT-SX01" : idx % 4 === 1 ? "HT-SX02" : idx % 4 === 2 ? "HT-M01" : "HT-TN01"),
    result,
  };
}

function mapViewRow(row: ViewWeldHistoryRow, idx: number): WeldingHistoryRecord {
  return {
    id: row.id,
    date: row.ngay_thuc_hien || `${row.nam_thuc_hien || 2026}-01-01`,
    weldingId: row.ma_lich_su || `WH${String(idx + 1).padStart(3, "0")}`,
    welderName: row.ten_tho_han || "Thợ hàn chính",
    rank: parseRank(row.ghi_chu),
    weldJoint: parseWeldJoint(row, row.ngay_thuc_hien || "", idx),
    machine: row.ten_may || "KCM007-01",
    railType: row.loai_ray || "UIC60",
    project: row.ten_du_an || "ĐSCT Bắc – Nam",
    shift: (row.ca_han || "Ca 1") as WeldingHistoryRecord["shift"],
    accountingCode: row.hach_toan || "HT-SX01",
    result: (row.ket_qua || "Đạt") as WeldingHistoryRecord["result"],
  };
}

function sanitizePostgrestSearch(value?: string) {
  return (value || "").trim().replace(/[(),"]/g, " ");
}

type WeldingHistoryStatsRpcRow = {
  tong?: number | string | null;
  dat?: number | string | null;
  khong_dat?: number | string | null;
  sua_chua?: number | string | null;
  thong_ke_hach_toan?: unknown;
};

function parseAccountingStats(value: unknown): [string, number][] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): [string, number] | null => {
      if (!item || typeof item !== "object") return null;
      const code = "code" in item && typeof item.code === "string" ? item.code : "";
      const count = "count" in item ? Number(item.count) : 0;
      return code && Number.isFinite(count) ? [code, count] : null;
    })
    .filter((item): item is [string, number] => item !== null);
}

export interface WeldingHistoryFilterParams {
  page?: number;
  pageSize?: number;
  query?: string;
  welder?: string;
  result?: string;
  dateFrom?: string;
  dateTo?: string;
  machines?: string[];
  rails?: string[];
  projects?: string[];
  shifts?: string[];
  accountingCodes?: string[];
}

export interface WeldingHistoryStats {
  total: number;
  pass: number;
  fail: number;
  rework: number;
  accountingCounts: [string, number][];
}

export interface WeldingHistoryPageResult {
  records: WeldingHistoryRecord[];
  totalCount: number;
  stats: WeldingHistoryStats;
  source: "supabase" | "local" | "seed";
  error?: string;
}

function filterInMemoryRecords(
  records: WeldingHistoryRecord[],
  params: WeldingHistoryFilterParams,
): { filtered: WeldingHistoryRecord[]; stats: WeldingHistoryStats } {
  const queryLower = (params.query || "").trim().toLowerCase();
  const welderFilter = params.welder && params.welder !== "Tất cả thợ hàn" ? params.welder : null;
  const resultFilter = params.result && params.result !== "Tất cả kết quả" ? params.result : null;

  const filtered = records.filter((r) => {
    if (welderFilter && r.welderName !== welderFilter) return false;
    if (resultFilter && r.result !== resultFilter) return false;
    if (params.dateFrom && r.date < params.dateFrom) return false;
    if (params.dateTo && r.date > params.dateTo) return false;
    if (params.machines && params.machines.length > 0 && !params.machines.includes(r.machine)) return false;
    if (params.rails && params.rails.length > 0 && !params.rails.includes(r.railType)) return false;
    if (params.projects && params.projects.length > 0 && !params.projects.includes(r.project)) return false;
    if (params.shifts && params.shifts.length > 0 && !params.shifts.includes(r.shift)) return false;
    if (params.accountingCodes && params.accountingCodes.length > 0 && !params.accountingCodes.includes(r.accountingCode)) return false;

    if (queryLower) {
      const match =
        r.weldingId.toLowerCase().includes(queryLower) ||
        r.weldJoint.toLowerCase().includes(queryLower) ||
        r.welderName.toLowerCase().includes(queryLower) ||
        r.machine.toLowerCase().includes(queryLower) ||
        r.project.toLowerCase().includes(queryLower) ||
        (r.accountingCode || "").toLowerCase().includes(queryLower);
      if (!match) return false;
    }
    return true;
  });

  const pass = filtered.filter((r) => r.result === "Đạt").length;
  const fail = filtered.filter((r) => r.result === "Không đạt").length;
  const rework = filtered.filter((r) => r.result === "Sửa chữa").length;

  const acMap = new Map<string, number>();
  filtered.forEach((r) => {
    if (r.accountingCode) {
      acMap.set(r.accountingCode, (acMap.get(r.accountingCode) ?? 0) + 1);
    }
  });

  const accountingCounts = Array.from(acMap.entries()).sort((a, b) => b[1] - a[1]);

  return {
    filtered,
    stats: {
      total: filtered.length,
      pass,
      fail,
      rework,
      accountingCounts,
    },
  };
}

export async function loadWeldingHistoryPage(
  params: WeldingHistoryFilterParams = {},
): Promise<WeldingHistoryPageResult> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, params.pageSize || 25);
  const fromIndex = (page - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;

  if (!isSupabaseConfigured()) {
    const local = readLocalHistory();
    const sourceRecords = local && local.length > 0 ? local : seedHistory;
    const { filtered, stats } = filterInMemoryRecords(sourceRecords, params);
    const paged = filtered.slice(fromIndex, toIndex + 1);
    return {
      records: paged,
      totalCount: stats.total,
      stats,
      source: local && local.length > 0 ? "local" : "seed",
    };
  }

  const supabase = createClient();

  // 1. Thử truy vấn qua view v_lich_su_moi_han_chi_tiet
  try {
    let viewQuery = supabase
      .from("v_lich_su_moi_han_chi_tiet")
      .select("*", { count: "exact" });

    if (params.dateFrom) viewQuery = viewQuery.gte("ngay_thuc_hien", params.dateFrom);
    if (params.dateTo) viewQuery = viewQuery.lte("ngay_thuc_hien", params.dateTo);
    if (params.welder && params.welder !== "Tất cả thợ hàn") viewQuery = viewQuery.eq("ten_tho_han", params.welder);
    if (params.result && params.result !== "Tất cả kết quả") viewQuery = viewQuery.eq("ket_qua", params.result);
    if (params.machines && params.machines.length > 0) viewQuery = viewQuery.in("ten_may", params.machines);
    if (params.rails && params.rails.length > 0) viewQuery = viewQuery.in("loai_ray", params.rails);
    if (params.projects && params.projects.length > 0) viewQuery = viewQuery.in("ten_du_an", params.projects);
    if (params.shifts && params.shifts.length > 0) viewQuery = viewQuery.in("ca_han", params.shifts);
    if (params.accountingCodes && params.accountingCodes.length > 0) viewQuery = viewQuery.in("hach_toan", params.accountingCodes);
    const searchQuery = sanitizePostgrestSearch(params.query);
    if (searchQuery) {
      const q = searchQuery;
      viewQuery = viewQuery.or(`ma_lich_su.ilike.%${q}%,moi_han_lien_ket.ilike.%${q}%,ghi_chu.ilike.%${q}%,ten_tho_han.ilike.%${q}%,ten_du_an.ilike.%${q}%,ten_may.ilike.%${q}%,hach_toan.ilike.%${q}%`);
    }

    // Lấy dữ liệu trang
    const { data: pageData, count: totalCount, error: pageError } = await viewQuery
      .order("ngay_thuc_hien", { ascending: false, nullsFirst: false })
      .range(fromIndex, toIndex);

    if (!pageError && pageData) {
      const total = totalCount ?? pageData.length;
      const { data: statsData, error: statsError } = await supabase.rpc("thong_ke_lich_su_moi_han", {
        p_date_from: params.dateFrom || null,
        p_date_to: params.dateTo || null,
        p_welder: params.welder && params.welder !== "Tất cả thợ hàn" ? params.welder : null,
        p_result: params.result && params.result !== "Tất cả kết quả" ? params.result : null,
        p_machines: params.machines?.length ? params.machines : null,
        p_rails: params.rails?.length ? params.rails : null,
        p_projects: params.projects?.length ? params.projects : null,
        p_shifts: params.shifts?.length ? params.shifts : null,
        p_accounting_codes: params.accountingCodes?.length ? params.accountingCodes : null,
        p_query: searchQuery || null,
      });

      let stats: WeldingHistoryStats | null = null;
      if (!statsError && Array.isArray(statsData) && statsData.length > 0) {
        const row = statsData[0] as WeldingHistoryStatsRpcRow;
        stats = {
          total: Number(row.tong ?? total),
          pass: Number(row.dat ?? 0),
          fail: Number(row.khong_dat ?? 0),
          rework: Number(row.sua_chua ?? 0),
          accountingCounts: parseAccountingStats(row.thong_ke_hach_toan),
        };
      }

      if (!stats) {
        let pass = 0;
        let fail = 0;
        let rework = 0;
        const acMap = new Map<string, number>();
        const statsPageSize = 1000;

        for (let offset = 0; ; offset += statsPageSize) {
          let allQuery = supabase
            .from("v_lich_su_moi_han_chi_tiet")
            .select("id, ket_qua, hach_toan");
          if (params.dateFrom) allQuery = allQuery.gte("ngay_thuc_hien", params.dateFrom);
          if (params.dateTo) allQuery = allQuery.lte("ngay_thuc_hien", params.dateTo);
          if (params.welder && params.welder !== "Tất cả thợ hàn") allQuery = allQuery.eq("ten_tho_han", params.welder);
          if (params.result && params.result !== "Tất cả kết quả") allQuery = allQuery.eq("ket_qua", params.result);
          if (params.machines?.length) allQuery = allQuery.in("ten_may", params.machines);
          if (params.rails?.length) allQuery = allQuery.in("loai_ray", params.rails);
          if (params.projects?.length) allQuery = allQuery.in("ten_du_an", params.projects);
          if (params.shifts?.length) allQuery = allQuery.in("ca_han", params.shifts);
          if (params.accountingCodes?.length) allQuery = allQuery.in("hach_toan", params.accountingCodes);
          if (searchQuery) {
            allQuery = allQuery.or(`ma_lich_su.ilike.%${searchQuery}%,moi_han_lien_ket.ilike.%${searchQuery}%,ghi_chu.ilike.%${searchQuery}%,ten_tho_han.ilike.%${searchQuery}%,ten_du_an.ilike.%${searchQuery}%,ten_may.ilike.%${searchQuery}%,hach_toan.ilike.%${searchQuery}%`);
          }
          const { data: allStatsData, error: allStatsError } = await allQuery.range(offset, offset + statsPageSize - 1);
          if (allStatsError) break;
          const rows = allStatsData ?? [];
          rows.forEach((row: { ket_qua?: string | null; hach_toan?: string | null }) => {
            if (row.ket_qua === "Đạt") pass++;
            else if (row.ket_qua === "Không đạt") fail++;
            else if (row.ket_qua === "Sửa chữa") rework++;
            if (row.hach_toan) acMap.set(row.hach_toan, (acMap.get(row.hach_toan) ?? 0) + 1);
          });
          if (rows.length < statsPageSize) break;
        }
        stats = {
          total,
          pass,
          fail,
          rework,
          accountingCounts: Array.from(acMap.entries()).sort((a, b) => b[1] - a[1]),
        };
      }

      const records = (pageData as unknown as ViewWeldHistoryRow[]).map((row, idx) =>
        mapViewRow(row, fromIndex + idx),
      );

      return {
        records,
        totalCount: total,
        stats,
        source: "supabase",
      };
    }
  } catch {
    // Nếu view chưa tồn tại, tiếp tục sang truy vấn bảng gốc
  }

  // 2. Fallback sang bảng lich_su_moi_han trực tiếp (không giới hạn 100 dòng)
  const rawRows: SupabaseWeldRow[] = [];
  let baseErrorMessage = "";
  const rawPageSize = 1000;
  for (let offset = 0; ; offset += rawPageSize) {
    let baseQuery = supabase
      .from("lich_su_moi_han")
      .select(`
        id,
        ma_lich_su,
        ngay_thuc_hien,
        nam_thuc_hien,
        loai_ray,
        loai_moi_han,
        cong_nghe_han,
        so_luong_thuc_hien,
        so_luong_loi,
        hach_toan,
        moi_han_lien_ket,
        ghi_chu,
        nhan_su:tho_han_id (ho_ten),
        du_an:du_an_id (du_an),
        may:may_id (ma_may)
      `)
      .order("ngay_thuc_hien", { ascending: false, nullsFirst: false });
    if (params.dateFrom) baseQuery = baseQuery.gte("ngay_thuc_hien", params.dateFrom);
    if (params.dateTo) baseQuery = baseQuery.lte("ngay_thuc_hien", params.dateTo);
    if (params.rails?.length) baseQuery = baseQuery.in("loai_ray", params.rails);
    if (params.accountingCodes?.length) baseQuery = baseQuery.in("hach_toan", params.accountingCodes);

    const { data, error } = await baseQuery.range(offset, offset + rawPageSize - 1);
    if (error) {
      baseErrorMessage = formatSupabaseError(error);
      break;
    }
    const rows = (data ?? []) as unknown as SupabaseWeldRow[];
    rawRows.push(...rows);
    if (rows.length < rawPageSize) break;
  }

  if (baseErrorMessage) {
    const local = readLocalHistory();
    const sourceRecords = local && local.length > 0 ? local : seedHistory;
    const { filtered, stats } = filterInMemoryRecords(sourceRecords, params);
    return {
      records: filtered.slice(fromIndex, toIndex + 1),
      totalCount: stats.total,
      stats,
      source: local && local.length > 0 ? "local" : "seed",
      error: baseErrorMessage,
    };
  }

  const allRecords = rawRows.map((row, idx) => mapSupabaseRow(row, idx));
  const { filtered, stats } = filterInMemoryRecords(allRecords, params);
  const paged = filtered.slice(fromIndex, toIndex + 1);

  return {
    records: paged,
    totalCount: stats.total,
    stats,
    source: "supabase",
  };
}

export async function exportAllFilteredWeldingHistory(
  params: WeldingHistoryFilterParams = {},
): Promise<WeldingHistoryRecord[]> {
  if (!isSupabaseConfigured()) {
    const local = readLocalHistory();
    const sourceRecords = local && local.length > 0 ? local : seedHistory;
    const { filtered } = filterInMemoryRecords(sourceRecords, params);
    return filtered;
  }

  const supabase = createClient();

  try {
    const rows: ViewWeldHistoryRow[] = [];
    const pageSize = 1000;
    const searchQuery = sanitizePostgrestSearch(params.query);

    for (let offset = 0; ; offset += pageSize) {
      let viewQuery = supabase
        .from("v_lich_su_moi_han_chi_tiet")
        .select("*")
        .order("ngay_thuc_hien", { ascending: false, nullsFirst: false });
      if (params.dateFrom) viewQuery = viewQuery.gte("ngay_thuc_hien", params.dateFrom);
      if (params.dateTo) viewQuery = viewQuery.lte("ngay_thuc_hien", params.dateTo);
      if (params.welder && params.welder !== "Tất cả thợ hàn") viewQuery = viewQuery.eq("ten_tho_han", params.welder);
      if (params.result && params.result !== "Tất cả kết quả") viewQuery = viewQuery.eq("ket_qua", params.result);
      if (params.machines?.length) viewQuery = viewQuery.in("ten_may", params.machines);
      if (params.rails?.length) viewQuery = viewQuery.in("loai_ray", params.rails);
      if (params.projects?.length) viewQuery = viewQuery.in("ten_du_an", params.projects);
      if (params.shifts?.length) viewQuery = viewQuery.in("ca_han", params.shifts);
      if (params.accountingCodes?.length) viewQuery = viewQuery.in("hach_toan", params.accountingCodes);
      if (searchQuery) {
        viewQuery = viewQuery.or(`ma_lich_su.ilike.%${searchQuery}%,moi_han_lien_ket.ilike.%${searchQuery}%,ghi_chu.ilike.%${searchQuery}%,ten_tho_han.ilike.%${searchQuery}%,ten_du_an.ilike.%${searchQuery}%,ten_may.ilike.%${searchQuery}%,hach_toan.ilike.%${searchQuery}%`);
      }

      const { data, error } = await viewQuery.range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []) as unknown as ViewWeldHistoryRow[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }

    return rows.map(mapViewRow);
  } catch {
    // view fallback
  }

  const rawRows: SupabaseWeldRow[] = [];
  const rawPageSize = 1000;
  for (let offset = 0; ; offset += rawPageSize) {
    const { data, error } = await supabase
      .from("lich_su_moi_han")
      .select(`
        id,
        ma_lich_su,
        ngay_thuc_hien,
        nam_thuc_hien,
        loai_ray,
        loai_moi_han,
        cong_nghe_han,
        so_luong_thuc_hien,
        so_luong_loi,
        hach_toan,
        moi_han_lien_ket,
        ghi_chu,
        nhan_su:tho_han_id (ho_ten),
        du_an:du_an_id (du_an),
        may:may_id (ma_may)
      `)
      .order("ngay_thuc_hien", { ascending: false, nullsFirst: false })
      .range(offset, offset + rawPageSize - 1);
    if (error) throw new Error(formatSupabaseError(error));
    const page = (data ?? []) as unknown as SupabaseWeldRow[];
    rawRows.push(...page);
    if (page.length < rawPageSize) break;
  }

  const allRecords = rawRows.map(mapSupabaseRow);
  const { filtered } = filterInMemoryRecords(allRecords, params);
  return filtered;
}

export async function loadWeldingHistory(): Promise<WeldingHistoryLoadResult> {
  const pageResult = await loadWeldingHistoryPage({ page: 1, pageSize: 1000 });
  return {
    records: pageResult.records,
    source: pageResult.source,
    error: pageResult.error,
  };
}

// Helpers to resolve foreign keys for insert / update
async function resolveForeignKeyIds(record: WeldingHistoryRecord): Promise<{
  duAnId: string | null;
  thoHanId: string | null;
  mayId: string | null;
  errors: string[];
}> {
  const supabase = createClient();
  let duAnId: string | null = null;
  let thoHanId: string | null = null;
  let mayId: string | null = null;
  const errors: string[] = [];

  const normalizeLookup = (value: string | null | undefined) => value?.trim().toLocaleLowerCase("vi-VN") ?? "";

  // 1. Resolve du_an
  if (record.project) {
    try {
      const projects: { id: string; du_an: string | null }[] = [];
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error: pErr } = await supabase
          .from("du_an")
          .select("id,du_an")
          .range(offset, offset + pageSize - 1);
        if (pErr) throw new Error(pErr.message);
        const page = data ?? [];
        projects.push(...page);
        if (page.length < pageSize) break;
      }

      if (projects.length > 0) {
        const pName = normalizeLookup(record.project);
        const matches = projects.filter((project) => normalizeLookup(project.du_an) === pName);
        if (matches.length === 1) duAnId = matches[0].id;
        else if (matches.length > 1) errors.push(`Có nhiều dự án trùng tên "${record.project}"`);
        else errors.push(`Không tìm thấy dự án "${record.project}" trong cơ sở dữ liệu`);
      } else {
        errors.push("Cơ sở dữ liệu chưa có danh mục dự án");
      }
    } catch (e) {
      errors.push(`Lỗi kết nối dự án: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2. Resolve tho_han
  if (record.welderName) {
    try {
      const personnel: { employee_id: string; ho_ten: string | null }[] = [];
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error: perErr } = await supabase
          .from("nhan_su")
          .select("employee_id,ho_ten")
          .range(offset, offset + pageSize - 1);
        if (perErr) throw new Error(perErr.message);
        const page = data ?? [];
        personnel.push(...page);
        if (page.length < pageSize) break;
      }

      if (personnel.length > 0) {
        const wName = normalizeLookup(record.welderName);
        const matches = personnel.filter((person) => normalizeLookup(person.ho_ten) === wName);
        if (matches.length === 1) thoHanId = matches[0].employee_id;
        else if (matches.length > 1) errors.push(`Có nhiều nhân sự trùng tên "${record.welderName}"`);
        else errors.push(`Không tìm thấy thợ hàn "${record.welderName}" trong danh sách nhân sự`);
      } else {
        errors.push("Cơ sở dữ liệu chưa có danh mục nhân sự");
      }
    } catch (e) {
      errors.push(`Lỗi kết nối nhân sự: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 3. Resolve may
  if (record.machine) {
    try {
      const machines: { id: string; ma_may: string | null; ten_may: string | null }[] = [];
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error: mErr } = await supabase
          .from("thiet_bi")
          .select("id,ma_may,ten_may")
          .range(offset, offset + pageSize - 1);
        if (mErr) throw new Error(mErr.message);
        const page = data ?? [];
        machines.push(...page);
        if (page.length < pageSize) break;
      }

      if (machines.length > 0) {
        const mCode = normalizeLookup(record.machine);
        const matches = machines.filter(
          (machine) => normalizeLookup(machine.ma_may) === mCode || normalizeLookup(machine.ten_may) === mCode,
        );
        if (matches.length === 1) mayId = matches[0].id;
        else if (matches.length > 1) errors.push(`Có nhiều máy trùng mã/tên "${record.machine}"`);
        else errors.push(`Không tìm thấy máy hàn "${record.machine}" trong danh mục thiết bị`);
      } else {
        errors.push("Cơ sở dữ liệu chưa có danh mục thiết bị");
      }
    } catch (e) {
      errors.push(`Lỗi kết nối thiết bị: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { duAnId, thoHanId, mayId, errors };
}

export type SaveResult = {
  records: WeldingHistoryRecord[];
  error?: string;
};

export async function saveWeldingHistoryRecord(
  record: WeldingHistoryRecord,
  currentList: WeldingHistoryRecord[],
  isNew: boolean,
): Promise<SaveResult> {
  let finalRecord = { ...record };
  let dbError: string | undefined;

  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const { duAnId, thoHanId, mayId, errors: fkErrors } = await resolveForeignKeyIds(record);

    if (fkErrors.length > 0) {
      dbError = fkErrors.join("; ");
    }

    const isRepair = record.result === "Sửa chữa";
    const errorCount = record.result === "Đạt" ? 0 : 1;
    const noteContent = `Ca: ${record.shift} | Hạng: ${record.rank} | Thợ: ${record.welderName} | Mối hàn: ${record.weldJoint} | Kết quả: ${record.result}`;
    const linkedJoint = isRepair ? (record.weldJoint.startsWith("SC-") ? record.weldJoint : `SC-${record.weldJoint}`) : null;

    if (isNew) {
      // Build insert payload
      const basePayload: Record<string, unknown> = {
        ma_lich_su: record.weldingId,
        ngay_thuc_hien: record.date,
        nam_thuc_hien: Number(record.date.slice(0, 4)) || new Date().getFullYear(),
        loai_ray: record.railType,
        loai_moi_han: "Sản xuất",
        cong_nghe_han: "FBW",
        so_luong_thuc_hien: 1,
        so_luong_loi: errorCount,
        moi_han_lien_ket: linkedJoint,
        ghi_chu: noteContent,
        nguon_du_lieu: "lich-su-han",
      };

      if (duAnId) basePayload.du_an_id = duAnId;
      if (thoHanId) basePayload.tho_han_id = thoHanId;
      if (mayId) basePayload.may_id = mayId;

      if (!dbError) {
        // Try inserting with hach_toan
        try {
          const payloadWithHt = { ...basePayload, hach_toan: record.accountingCode };
          const { data, error } = await supabase
            .from("lich_su_moi_han")
            .insert(payloadWithHt)
            .select("id")
            .single();

          if (error) {
            dbError = formatSupabaseError(error);
          } else if (data) {
            finalRecord = { ...finalRecord, id: data.id };
          }
        } catch (err: unknown) {
          dbError = err instanceof Error ? err.message : String(err);
        }
      }
    } else {
      // Updating existing record
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.id);
      if (isUuid) {
        const updatePayload: Record<string, unknown> = {
          ngay_thuc_hien: record.date,
          ma_lich_su: record.weldingId,
          moi_han_lien_ket: linkedJoint,
          loai_ray: record.railType,
          so_luong_loi: errorCount,
          ghi_chu: noteContent,
        };
        if (duAnId) updatePayload.du_an_id = duAnId;
        if (thoHanId) updatePayload.tho_han_id = thoHanId;
        if (mayId) updatePayload.may_id = mayId;

        try {
          const payloadWithHt = { ...updatePayload, hach_toan: record.accountingCode };
          const { error } = await supabase
            .from("lich_su_moi_han")
            .update(payloadWithHt)
            .eq("id", record.id);

          if (error) {
            dbError = formatSupabaseError(error);
          }
        } catch (err: unknown) {
          dbError = err instanceof Error ? err.message : String(err);
        }
      } else {
        dbError = "Bản ghi chưa có UUID hợp lệ trên Supabase";
      }
    }
  }

  if (isSupabaseConfigured() && dbError) {
    // Không ghi LocalStorage nếu lưu lên Supabase thất bại
    return { records: currentList, error: dbError };
  }

  const nextList = isNew
    ? [finalRecord, ...currentList.filter((r) => r.id !== record.id && r.id !== finalRecord.id)]
    : currentList.map((r) => (r.id === record.id ? finalRecord : r));

  writeLocalHistory(nextList);
  return { records: nextList };
}

export async function quickUpdateAccountingCode(
  id: string,
  newCode: string,
  currentList: WeldingHistoryRecord[],
): Promise<{ records: WeldingHistoryRecord[]; error?: string }> {
  let dbError: string | undefined;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        const { error } = await supabase
          .from("lich_su_moi_han")
          .update({ hach_toan: newCode })
          .eq("id", id);
        if (error) {
          dbError = formatSupabaseError(error);
        }
      } else {
        dbError = "Bản ghi chưa có UUID hợp lệ trên Supabase";
      }
    } catch (err: unknown) {
      dbError = err instanceof Error ? err.message : String(err);
    }
  }

  if (isSupabaseConfigured() && dbError) {
    // Không ghi LocalStorage nếu cập nhật Supabase thất bại
    return { records: currentList, error: dbError };
  }

  const nextList = currentList.map((r) =>
    r.id === id ? { ...r, accountingCode: newCode } : r,
  );
  writeLocalHistory(nextList);
  return { records: nextList };
}

export async function deleteWeldingHistoryRecord(
  id: string,
  currentList: WeldingHistoryRecord[],
): Promise<{ records: WeldingHistoryRecord[]; error?: string }> {
  let dbError: string | undefined;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        const { error } = await supabase.from("lich_su_moi_han").delete().eq("id", id);
        if (error) dbError = formatSupabaseError(error);
      } else {
        dbError = "Bản ghi chưa có UUID hợp lệ trên Supabase";
      }
    } catch (err: unknown) {
      dbError = err instanceof Error ? err.message : String(err);
    }
  }

  if (isSupabaseConfigured() && dbError) {
    // Không xóa trong LocalStorage nếu xóa Supabase thất bại
    return { records: currentList, error: dbError };
  }

  const nextList = currentList.filter((r) => r.id !== id);
  writeLocalHistory(nextList);
  return { records: nextList };
}
