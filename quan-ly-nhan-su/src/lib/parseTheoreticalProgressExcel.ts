import * as XLSX from "xlsx";
import type { TheoreticalProgressRow } from "@/data/projects";

export type TheoreticalProgressExcelRow = {
  ma_du_an: string;
  du_an: string;
  ngay: string;
  so_moi_han: number;
};

export type TheoreticalProgressParseResult = {
  rows: TheoreticalProgressExcelRow[];
  errors: string[];
  sheetName: string;
};

const HEADER_ALIASES = {
  ma_du_an: ["ma_du_an", "mã dự án", "ma du an", "maduan", "project_code", "ma"],
  du_an: ["du_an", "dự án", "du an", "ten_du_an", "tên dự án", "project", "project_name"],
  ngay: ["ngay", "ngày", "date", "ngay_ke_hoach", "ngày kế hoạch"],
  so_moi_han: [
    "so_moi_han",
    "số mối hàn",
    "so moi han",
    "so_moi_han_du_kien",
    "số mối dự kiến",
    "ke_hoach",
    "planned",
    "qty",
  ],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const cleaned = String(value).trim().replace(/[^\d,-.]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Excel serial date hoặc chuỗi → YYYY-MM-DD */
function parseDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    const y = parsed.y;
    const m = String(parsed.m).padStart(2, "0");
    const d = String(parsed.d).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const vn = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (vn) {
    return `${vn[3]}-${vn[2].padStart(2, "0")}-${vn[1].padStart(2, "0")}`;
  }
  return "";
}

function mapHeaders(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const find = (keys: string[]) => {
    const idx = normalized.findIndex((h) => keys.some((k) => normalizeHeader(k) === h));
    return idx >= 0 ? idx : -1;
  };
  return {
    ma_du_an: find(HEADER_ALIASES.ma_du_an),
    du_an: find(HEADER_ALIASES.du_an),
    ngay: find(HEADER_ALIASES.ngay),
    so_moi_han: find(HEADER_ALIASES.so_moi_han),
  };
}

/** Tải file Excel mẫu: Ngày · Mã dự án · Tên dự án · Số mối hàn dự kiến */
export function downloadTheoreticalProgressExcelTemplate() {
  const data = [
    ["ngay", "ma_du_an", "du_an", "so_moi_han"],
    ["2026-09-01", "DA-001", "Dự án mẫu A", 12],
    ["2026-09-02", "DA-001", "Dự án mẫu A", 15],
    ["2026-09-01", "DA-002", "Dự án mẫu B", 8],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "tien_do_ly_thuyet");
  XLSX.writeFile(wb, "mau-tien-do-moi-han-theo-ngay.xlsx");
}

/** Xuất tiến độ lý thuyết hiện có ra Excel. */
export function exportTheoreticalProgressToExcel(
  rows: Array<{ ngay: string; du_an: string; so_moi_han: number; ma_du_an?: string }>,
  filename = `tien-do-moi-han-${new Date().toISOString().slice(0, 10)}.xlsx`,
) {
  const data = [
    ["ngay", "ma_du_an", "du_an", "so_moi_han"],
    ...rows.map((row) => [row.ngay, row.ma_du_an || "", row.du_an, row.so_moi_han]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 48 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "tien_do_ly_thuyet");
  XLSX.writeFile(wb, filename);
}

export async function parseTheoreticalProgressExcel(
  file: File,
): Promise<TheoreticalProgressParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: ["File không có sheet nào"], sheetName: "" };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (!matrix.length) {
    return { rows: [], errors: ["Sheet trống"], sheetName };
  }

  const headerRow = (matrix[0] ?? []).map((c) => String(c ?? ""));
  const cols = mapHeaders(headerRow);
  const errors: string[] = [];

  if (cols.ngay < 0 || cols.so_moi_han < 0 || (cols.ma_du_an < 0 && cols.du_an < 0)) {
    return {
      rows: [],
      errors: [
        "Thiếu cột bắt buộc. Cần: ngay, so_moi_han, và ma_du_an hoặc du_an (tên dự án).",
      ],
      sheetName,
    };
  }

  const rows: TheoreticalProgressExcelRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    const isEmpty = line.every((c) => c == null || String(c).trim() === "");
    if (isEmpty) continue;

    const ngay = parseDate(line[cols.ngay]);
    const so_moi_han = parseNumber(line[cols.so_moi_han]);
    const ma_du_an = cols.ma_du_an >= 0 ? String(line[cols.ma_du_an] ?? "").trim() : "";
    const du_an = cols.du_an >= 0 ? String(line[cols.du_an] ?? "").trim() : "";

    if (!ngay) {
      errors.push(`Dòng ${i + 1}: ngày không hợp lệ`);
      continue;
    }
    if (so_moi_han == null || so_moi_han < 0) {
      errors.push(`Dòng ${i + 1}: số mối hàn không hợp lệ`);
      continue;
    }
    if (!ma_du_an && !du_an) {
      errors.push(`Dòng ${i + 1}: thiếu mã hoặc tên dự án`);
      continue;
    }

    rows.push({ ma_du_an, du_an, ngay, so_moi_han });
  }

  return { rows, errors, sheetName };
}

/** Gom theo khóa dự án → danh sách tiến độ ngày (cộng dồn nếu trùng ngày). */
export function groupTheoreticalProgressByProject(
  rows: TheoreticalProgressExcelRow[],
): Map<string, TheoreticalProgressRow[]> {
  const byKey = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const key = (row.ma_du_an || row.du_an).trim().toLocaleLowerCase("vi");
    if (!key) continue;
    const dayMap = byKey.get(key) ?? new Map<string, number>();
    dayMap.set(row.ngay, (dayMap.get(row.ngay) ?? 0) + row.so_moi_han);
    byKey.set(key, dayMap);
  }

  const result = new Map<string, TheoreticalProgressRow[]>();
  for (const [key, dayMap] of byKey) {
    result.set(
      key,
      [...dayMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ngay, so_moi_han]) => ({ ngay, so_moi_han })),
    );
  }
  return result;
}
