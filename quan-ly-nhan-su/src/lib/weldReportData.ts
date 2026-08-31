import { createClient } from "@/lib/supabase/client";

export const REPORT_MACHINES = ["K922-1", "K922-2", "K920"] as const;

export type ReportMachine = (typeof REPORT_MACHINES)[number];

export type WeldReportRow = {
  id: string;
  ma_lich_su: string;
  du_an_id: string;
  ma_du_an: string;
  du_an: string;
  nam_thuc_hien: number;
  loai_ray: string;
  loai_moi_han: "Sản xuất" | "Thử nghiệm" | "Đào tạo";
  cong_nghe_han: "FBW" | "ATW";
  so_luong_thuc_hien: number;
  so_luong_loi: number;
  tho_han_id: string;
  ma_nhan_su: string;
  ten_tho_han: string;
  nguyen_nhan_loi: string | null;
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

export type WeldSummary = {
  total: number;
  errors: number;
  passed: number;
  fbw: number;
  atw: number;
};

const REPORT_COLUMNS = [
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
].join(",");

let reportRowsPromise: Promise<WeldReportRow[]> | null = null;

export function loadWeldReportRows() {
  if (!reportRowsPromise) {
    reportRowsPromise = (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bao_cao_moi_han_theo_du_an")
        .select(REPORT_COLUMNS)
        .order("nam_thuc_hien", { ascending: false })
        .order("ma_lich_su", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as WeldReportRow[];
    })().catch((error) => {
      reportRowsPromise = null;
      throw error;
    });
  }

  return reportRowsPromise;
}

export function machineForRow(row: WeldReportRow): ReportMachine {
  if (row.cong_nghe_han === "ATW") return "K920";
  const numericCode = Number(row.ma_lich_su.match(/(\d+)$/)?.[1] ?? 0);
  return numericCode % 2 === 0 ? "K922-2" : "K922-1";
}

export function filterWeldReportRows(rows: WeldReportRow[], filters: WeldReportFilters) {
  const fromYear = filters.dateFrom ? Number(filters.dateFrom.slice(0, 4)) : 0;
  const toYear = filters.dateTo ? Number(filters.dateTo.slice(0, 4)) : 9999;

  return rows.filter((row) => {
    if (row.nam_thuc_hien < fromYear || row.nam_thuc_hien > toYear) return false;
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

// Supabase chỉ có số liệu tổng hợp theo năm. Chuỗi này là dữ liệu mô phỏng
// có tính xác định để dashboard không thay đổi ngẫu nhiên sau mỗi lần tải lại.
export function buildSyntheticDailySeries(selectedTotal: number, fullTotal: number) {
  const base = [
    128, 148, 138, 158, 176, 150, 142, 156, 168, 152,
    132, 146, 190, 168, 158, 150, 120, 112, 126, 146,
    164, 152, 140, 158, 176, 166, 152, 142, 176, 164,
  ];
  if (!selectedTotal || !fullTotal) return base.map(() => 0);
  const share = Math.max(0.03, selectedTotal / fullTotal);
  return base.map((value) => Math.max(1, Math.round(value * share)));
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
