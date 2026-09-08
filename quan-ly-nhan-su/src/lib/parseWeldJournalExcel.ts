import * as XLSX from "xlsx";
import type { WeldReportRow, WeldTestStatus } from "@/lib/weldReportData";

export type WeldJournalExcelRow = {
  ngay_thuc_hien: string;
  ma_moi_han: string;
  ma_du_an: string;
  du_an: string;
  ma_nhan_su: string;
  ten_tho_han: string;
  ma_may: string;
  loai_ray: string;
  cong_nghe_han: "FBW" | "ATW";
  loai_moi_han: WeldReportRow["loai_moi_han"];
  tinh_trang_thi_nghiem: WeldTestStatus;
  chung_chi_su_dung: string;
  moi_han_lien_ket: string;
  nguyen_nhan_loi: string;
  ma_khuyet_tat: string[];
  ghi_chu: string;
  ly_trinh: string;
  kinh_do: number | null;
  vi_do: number | null;
  hach_toan: string;
};

export type WeldJournalExcelParseResult = {
  rows: WeldJournalExcelRow[];
  errors: string[];
  sheetName: string;
};

const HEADER_ALIASES: Record<keyof WeldJournalExcelRow, string[]> = {
  ngay_thuc_hien: ["ngay_thuc_hien", "ngày thực hiện", "ngay thuc hien", "ngay", "date"],
  ma_moi_han: ["ma_moi_han", "mã mối hàn", "ma moi han", "ma_lich_su", "mã lịch sử", "welding_code"],
  ma_du_an: ["ma_du_an", "mã dự án", "ma du an", "project_code"],
  du_an: ["du_an", "dự án", "du an", "ten_du_an", "tên dự án", "project"],
  ma_nhan_su: ["ma_nhan_su", "mã nhân sự", "ma nhan su", "welding id", "welding_id"],
  ten_tho_han: ["ten_tho_han", "thợ hàn", "tho han", "nhân sự", "operator", "ho_ten"],
  ma_may: ["ma_may", "mã máy", "ma may", "machine", "machine_code"],
  loai_ray: ["loai_ray", "loại ray", "loai ray", "rail"],
  cong_nghe_han: ["cong_nghe_han", "công nghệ hàn", "cong nghe han", "method", "technology"],
  loai_moi_han: ["loai_moi_han", "loại mối hàn", "loai moi han", "weld_type"],
  tinh_trang_thi_nghiem: [
    "tinh_trang_thi_nghiem",
    "tình trạng thí nghiệm",
    "tinh trang thi nghiem",
    "tình trạng",
    "result",
    "ket_qua",
  ],
  chung_chi_su_dung: ["chung_chi_su_dung", "chứng chỉ sử dụng", "chung chi su dung", "certificate"],
  moi_han_lien_ket: ["moi_han_lien_ket", "mối hàn liên kết", "moi han lien ket", "linked_weld"],
  nguyen_nhan_loi: ["nguyen_nhan_loi", "lý do không đạt", "ly do khong dat", "nguyen nhan loi"],
  ma_khuyet_tat: ["ma_khuyet_tat", "mã khuyết tật", "ma khuyet tat", "ndt"],
  ghi_chu: ["ghi_chu", "ghi chú", "ghi chu", "note"],
  ly_trinh: ["ly_trinh", "lý trình", "ly trinh", "chainage"],
  kinh_do: ["kinh_do", "kinh độ", "kinh do", "longitude", "lon", "lng"],
  vi_do: ["vi_do", "vĩ độ", "vi do", "latitude", "lat"],
  hach_toan: ["hach_toan", "hạch toán", "hach toan", "accounting"],
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

function parseDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const vn = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (vn) return `${vn[3]}-${vn[2].padStart(2, "0")}-${vn[1].padStart(2, "0")}`;
  return "";
}

function mapHeaders(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const find = (keys: string[]) => {
    const idx = normalized.findIndex((h) => keys.some((k) => normalizeHeader(k) === h));
    return idx >= 0 ? idx : -1;
  };
  return Object.fromEntries(
    (Object.keys(HEADER_ALIASES) as (keyof WeldJournalExcelRow)[]).map((key) => [
      key,
      find(HEADER_ALIASES[key]),
    ]),
  ) as Record<keyof WeldJournalExcelRow, number>;
}

function parseMethod(value: unknown): "FBW" | "ATW" | null {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "FBW" || raw.includes("TIẾP XÚC") || raw.includes("TIEP XUC")) return "FBW";
  if (raw === "ATW" || raw.includes("NHÔM") || raw.includes("NHOM") || raw.includes("THERMIT")) return "ATW";
  return null;
}

function parseWeldType(value: unknown): WeldReportRow["loai_moi_han"] | null {
  const raw = String(value ?? "").trim().toLocaleLowerCase("vi");
  if (!raw) return "Sản xuất";
  if (raw.includes("đào tạo") || raw.includes("dao tao") || raw.includes("training")) return "Đào tạo";
  if (raw.includes("thử") || raw.includes("thu nghiem") || raw.includes("test")) return "Thử nghiệm";
  if (raw.includes("sản xuất") || raw.includes("san xuat") || raw.includes("production")) return "Sản xuất";
  return null;
}

function parseTestStatus(value: unknown): WeldTestStatus {
  const raw = String(value ?? "").trim().toLocaleLowerCase("vi");
  if (!raw) return "Chờ thí nghiệm";
  if (raw.includes("không thí nghiệm") || raw.includes("khong thi nghiem")) return "Không thí nghiệm";
  if (raw.includes("không đạt") || raw.includes("khong dat") || raw.includes("fail")) return "Không đạt";
  if (raw === "đạt" || raw === "dat" || raw.includes("pass")) return "Đạt";
  if (raw.includes("chờ") || raw.includes("cho")) return "Chờ thí nghiệm";
  return "Chờ thí nghiệm";
}

function parseDefectCodes(value: unknown): string[] {
  if (value == null || value === "") return [];
  return String(value)
    .split(/[,;/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Tải mẫu Excel nhập nhật ký hàn. */
export function downloadWeldJournalExcelTemplate() {
  const headers = [
    "ngay_thuc_hien",
    "ma_moi_han",
    "ma_du_an",
    "du_an",
    "ma_nhan_su",
    "ten_tho_han",
    "ma_may",
    "loai_ray",
    "cong_nghe_han",
    "loai_moi_han",
    "tinh_trang_thi_nghiem",
    "chung_chi_su_dung",
    "moi_han_lien_ket",
    "nguyen_nhan_loi",
    "ma_khuyet_tat",
    "ghi_chu",
    "ly_trinh",
    "kinh_do",
    "vi_do",
    "hach_toan",
  ];
  const sample = [
    "2026-09-07",
    "",
    "DA-001",
    "Dự án mẫu",
    "NS001",
    "Nguyễn Văn A",
    "KCM007",
    "UIC60",
    "FBW",
    "Sản xuất",
    "Chờ thí nghiệm",
    "",
    "",
    "",
    "",
    "",
    "Km0+100",
    105.84,
    21.02,
    "HT-SX01",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "nhat_ky_han");
  XLSX.writeFile(wb, "mau-nhat-ky-han.xlsx");
}

export async function parseWeldJournalExcel(file: File): Promise<WeldJournalExcelParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], errors: ["File không có sheet nào"], sheetName: "" };

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  if (!matrix.length) return { rows: [], errors: ["Sheet trống"], sheetName };

  const headerRow = (matrix[0] ?? []).map((c) => String(c ?? ""));
  const cols = mapHeaders(headerRow);
  const errors: string[] = [];

  if (cols.ngay_thuc_hien < 0) {
    return { rows: [], errors: ["Thiếu cột ngay_thuc_hien (Ngày thực hiện)."], sheetName };
  }
  if (cols.du_an < 0 && cols.ma_du_an < 0) {
    return { rows: [], errors: ["Thiếu cột du_an hoặc ma_du_an."], sheetName };
  }
  if (cols.ten_tho_han < 0 && cols.ma_nhan_su < 0) {
    return { rows: [], errors: ["Thiếu cột ten_tho_han hoặc ma_nhan_su."], sheetName };
  }
  if (cols.ma_may < 0) {
    return { rows: [], errors: ["Thiếu cột ma_may."], sheetName };
  }
  if (cols.cong_nghe_han < 0) {
    return { rows: [], errors: ["Thiếu cột cong_nghe_han (FBW/ATW)."], sheetName };
  }

  const rows: WeldJournalExcelRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    if (line.every((c) => c == null || String(c).trim() === "")) continue;

    const ngay_thuc_hien = parseDate(line[cols.ngay_thuc_hien]);
    const cong_nghe_han = parseMethod(line[cols.cong_nghe_han]);
    const loai_moi_han =
      cols.loai_moi_han >= 0 ? parseWeldType(line[cols.loai_moi_han]) : ("Sản xuất" as const);
    const ma_may = String(line[cols.ma_may] ?? "").trim();
    const du_an = cols.du_an >= 0 ? String(line[cols.du_an] ?? "").trim() : "";
    const ma_du_an = cols.ma_du_an >= 0 ? String(line[cols.ma_du_an] ?? "").trim() : "";
    const ten_tho_han = cols.ten_tho_han >= 0 ? String(line[cols.ten_tho_han] ?? "").trim() : "";
    const ma_nhan_su = cols.ma_nhan_su >= 0 ? String(line[cols.ma_nhan_su] ?? "").trim() : "";

    if (!ngay_thuc_hien) {
      errors.push(`Dòng ${i + 1}: ngày thực hiện không hợp lệ`);
      continue;
    }
    if (!cong_nghe_han) {
      errors.push(`Dòng ${i + 1}: công nghệ hàn phải là FBW hoặc ATW`);
      continue;
    }
    if (!loai_moi_han) {
      errors.push(`Dòng ${i + 1}: loại mối hàn không hợp lệ`);
      continue;
    }
    if (!ma_may) {
      errors.push(`Dòng ${i + 1}: thiếu mã máy`);
      continue;
    }
    if (!du_an && !ma_du_an) {
      errors.push(`Dòng ${i + 1}: thiếu dự án`);
      continue;
    }
    if (!ten_tho_han && !ma_nhan_su) {
      errors.push(`Dòng ${i + 1}: thiếu thợ hàn`);
      continue;
    }

    const status =
      cols.tinh_trang_thi_nghiem >= 0
        ? parseTestStatus(line[cols.tinh_trang_thi_nghiem])
        : ("Chờ thí nghiệm" as const);

    rows.push({
      ngay_thuc_hien,
      ma_moi_han: cols.ma_moi_han >= 0 ? String(line[cols.ma_moi_han] ?? "").trim() : "",
      ma_du_an,
      du_an,
      ma_nhan_su,
      ten_tho_han,
      ma_may,
      loai_ray: cols.loai_ray >= 0 ? String(line[cols.loai_ray] ?? "").trim() || "UIC60" : "UIC60",
      cong_nghe_han,
      loai_moi_han,
      tinh_trang_thi_nghiem: status,
      chung_chi_su_dung:
        cols.chung_chi_su_dung >= 0 ? String(line[cols.chung_chi_su_dung] ?? "").trim() : "",
      moi_han_lien_ket:
        cols.moi_han_lien_ket >= 0 ? String(line[cols.moi_han_lien_ket] ?? "").trim() : "",
      nguyen_nhan_loi:
        cols.nguyen_nhan_loi >= 0 ? String(line[cols.nguyen_nhan_loi] ?? "").trim() : "",
      ma_khuyet_tat: cols.ma_khuyet_tat >= 0 ? parseDefectCodes(line[cols.ma_khuyet_tat]) : [],
      ghi_chu: cols.ghi_chu >= 0 ? String(line[cols.ghi_chu] ?? "").trim() : "",
      ly_trinh: cols.ly_trinh >= 0 ? String(line[cols.ly_trinh] ?? "").trim() : "",
      kinh_do: cols.kinh_do >= 0 ? parseNumber(line[cols.kinh_do]) : null,
      vi_do: cols.vi_do >= 0 ? parseNumber(line[cols.vi_do]) : null,
      hach_toan: cols.hach_toan >= 0 ? String(line[cols.hach_toan] ?? "").trim() || "HT-SX01" : "HT-SX01",
    });
  }

  return { rows, errors, sheetName };
}
