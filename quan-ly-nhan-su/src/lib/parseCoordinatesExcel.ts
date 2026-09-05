import * as XLSX from "xlsx";
import type { NewToaDoInput } from "@/lib/mapPointsDb";
import type { MapPoint } from "@/data/mapPoints";

const HEADER_ALIASES: Record<
  keyof Pick<
    NewToaDoInput,
    "code" | "longitude" | "latitude" | "chainage" | "note" | "order" | "weldCode" | "weldId"
  >,
  string[]
> = {
  code: ["ma_diem", "mã điểm", "ma diem", "code", "madinh", "điểm", "diem", "point_code"],
  longitude: ["kinh_do", "kinh độ", "kinh do", "longitude", "lon", "lng", "x"],
  latitude: ["vi_do", "vĩ độ", "vi do", "latitude", "lat", "y"],
  chainage: ["ly_trinh", "lý trình", "ly trinh", "chainage", "km"],
  note: ["ghi_chu", "ghi chú", "ghi chu", "note", "mô tả", "mo ta"],
  order: ["thu_tu", "thứ tự", "thu tu", "order", "stt", "no"],
  weldCode: ["ma_moi_han", "mã mối hàn", "ma moi han", "ma_lich_su", "mã lịch sử", "weld_code", "weldcode"],
  weldId: ["lich_su_moi_han_id", "mối hàn id", "moi han id", "weld_id", "weldid", "moi_han_id"],
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
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value).trim().replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function mapHeaders(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const find = (keys: string[]) => {
    const idx = normalized.findIndex((h) => keys.some((k) => normalizeHeader(k) === h));
    return idx >= 0 ? idx : -1;
  };

  return {
    code: find(HEADER_ALIASES.code),
    longitude: find(HEADER_ALIASES.longitude),
    latitude: find(HEADER_ALIASES.latitude),
    chainage: find(HEADER_ALIASES.chainage),
    note: find(HEADER_ALIASES.note),
    order: find(HEADER_ALIASES.order),
    weldCode: find(HEADER_ALIASES.weldCode),
    weldId: find(HEADER_ALIASES.weldId),
  };
}

export type ExcelParseResult = {
  rows: NewToaDoInput[];
  errors: string[];
  sheetName: string;
};

/** Đọc file Excel/CSV → danh sách toạ độ (bao gồm ma_moi_han và lich_su_moi_han_id). */
export async function parseCoordinatesExcel(file: File): Promise<ExcelParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
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

  if (cols.code < 0 || cols.longitude < 0 || cols.latitude < 0) {
    return {
      rows: [],
      errors: [
        "Thiếu cột bắt buộc. Cần ít nhất: ma_diem (hoặc Mã điểm), kinh_do (Kinh độ), vi_do (Vĩ độ).",
      ],
      sheetName,
    };
  }

  const rows: NewToaDoInput[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    const isEmpty = line.every((c) => c == null || String(c).trim() === "");
    if (isEmpty) continue;

    const code = String(line[cols.code] ?? "").trim();
    const longitude = parseNumber(line[cols.longitude]);
    const latitude = parseNumber(line[cols.latitude]);
    const chainage =
      cols.chainage >= 0 ? String(line[cols.chainage] ?? "").trim() : undefined;
    const note = cols.note >= 0 ? String(line[cols.note] ?? "").trim() : undefined;
    const order = cols.order >= 0 ? parseNumber(line[cols.order]) : i;
    const weldCode =
      cols.weldCode >= 0 ? String(line[cols.weldCode] ?? "").trim() : undefined;
    const weldId =
      cols.weldId >= 0 ? String(line[cols.weldId] ?? "").trim() : undefined;

    if (!code) {
      errors.push(`Dòng ${i + 1}: thiếu mã điểm`);
      continue;
    }
    if (longitude == null || latitude == null) {
      errors.push(`Dòng ${i + 1} (${code}): kinh độ / vĩ độ không hợp lệ`);
      continue;
    }
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      errors.push(`Dòng ${i + 1} (${code}): toạ độ ngoài khoảng hợp lệ`);
      continue;
    }

    rows.push({
      code,
      longitude,
      latitude,
      chainage: chainage || undefined,
      note: note || undefined,
      order: order ?? i,
      weldCode: weldCode || undefined,
      weldId: weldId || undefined,
    });
  }

  return { rows, errors, sheetName };
}

/** Tải file Excel mẫu bao gồm liên kết mối hàn. */
export function downloadCoordinatesExcelTemplate() {
  const data = [
    [
      "ma_diem",
      "kinh_do",
      "vi_do",
      "ly_trinh",
      "thu_tu",
      "ghi_chu",
      "ma_moi_han",
      "lich_su_moi_han_id",
    ],
    ["TT0001", 105.8412, 21.0245, "Km0+000.00", 1, "Mối hàn đầu tuyến", "R4W-030-30-0001", ""],
    ["TT0002", 105.8415, 21.0228, "Km0+025.00", 2, "Mối hàn tiếp giáp", "", "551f7e85-f16c-4ef0-8780-5c30e48daa88"],
    ["TT0003", 105.842, 21.021, "Km0+050.00", 3, "Điểm toạ độ độc lập", "", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "toa_do");
  XLSX.writeFile(wb, "mau-toa-do-gps.xlsx");
}

/** Xuất danh sách toạ độ GPS kèm thông tin mối hàn ra Excel. */
export function exportCoordinatesToExcel(
  points: MapPoint[],
  filename = "danh-sach-toa-do-gps.xlsx",
) {
  const headers = [
    "ma_diem",
    "kinh_do",
    "vi_do",
    "ly_trinh",
    "thu_tu",
    "ghi_chu",
    "ma_moi_han",
    "lich_su_moi_han_id",
    "ten_tho_han",
    "ten_may",
    "ten_du_an",
    "ket_qua_moi_han",
    "ngay_thuc_hien",
  ];

  const rows = points.map((p) => [
    p.code,
    p.longitude,
    p.latitude,
    p.chainage || "",
    p.order ?? 0,
    p.note || "",
    p.weldCode || "",
    p.weldId || "",
    p.welderName || "",
    p.machineName || "",
    p.projectName || "",
    p.result || "",
    p.performedDate || "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "toa_do_gps");
  XLSX.writeFile(wb, filename);
}

