import * as XLSX from "xlsx";
import { GEOMETRY_CRITERIA, GEOMETRY_LABELS, parseWeldMeasurement, type SavedWeldInspection } from "@/lib/weldQuality";
import type { WeldReportRow } from "@/lib/weldReportData";
import { PHRASES } from "@/i18n/phrases";

export function qualityExcelColumns(row: WeldReportRow) {
  const i = row.kiem_tra_chat_luong;
  return {
    "Tình trạng chất lượng": row.tinh_trang_chat_luong ?? "Chưa tải chất lượng",
    "Phiên bản kiểm tra": row.phien_ban_chat_luong ?? 0,
    "ID tiêu chí chất lượng": i?.tieu_chuan_id ?? "",
    "Ngày hoàn thành mài": i?.ngay_mai ?? "",
    "Kiểm tra trực quan": i?.truc_quan ?? "",
    ...Object.fromEntries(GEOMETRY_CRITERIA.map((k) => [`${GEOMETRY_LABELS[k]} (mm)`, i?.gia_tri_do[k] ?? ""])),
    "Phương pháp NDT": i?.phuong_phap_ndt ?? "Siêu âm",
    "Ngày NDT": i?.ngay_ndt ?? "",
    "Kết quả NDT": i?.ket_qua_ndt ?? "",
    "Ghi chú kiểm tra": i?.ghi_chu ?? "",
  };
}

type QualityExcelPatch = { moi_han_id: string; phien_ban: number; patch: Partial<SavedWeldInspection> };

export async function parseWeldQualityExcel(file: File): Promise<QualityExcelPatch[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("File không có trang dữ liệu.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const records: QualityExcelPatch[] = [];
  const column = (r: Record<string, unknown>, key: string) => r[key] ?? r[PHRASES[key] ?? key] ?? "";
  const seen = new Set<string>();
  const date = (v: unknown) => {
    if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
    if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`; }
    return String(v).trim();
  };
  rows.forEach((r, index) => {
    const id = String(column(r, "Mã bản ghi")).trim();
    if (!id && Object.values(r).every((v) => v === "")) return;
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new Error(`Dòng ${index + 2}: cần Mã bản ghi UUID từ file xuất nhật ký.`);
    if (seen.has(id)) throw new Error(`Dòng ${index + 2}: trùng Mã bản ghi.`);
    seen.add(id);
    const rawVersion = column(r, "Phiên bản kiểm tra");
    const version = Number(rawVersion);
    if (rawVersion == null || rawVersion === "" || !Number.isSafeInteger(version) || version < 0) throw new Error(`Dòng ${index + 2}: thiếu hoặc sai Phiên bản kiểm tra. Hãy xuất lại nhật ký.`);
    const patch: Partial<SavedWeldInspection> = {};
    for (const [header, key] of [["ID tiêu chí chất lượng", "tieu_chuan_id"], ["Ngày hoàn thành mài", "ngay_mai"], ["Kiểm tra trực quan", "truc_quan"],
      ["Phương pháp NDT", "phuong_phap_ndt"], ["Ngày NDT", "ngay_ndt"], ["Kết quả NDT", "ket_qua_ndt"], ["Ghi chú kiểm tra", "ghi_chu"]] as const) {
      const value = column(r, header);
      if (value !== undefined && value !== null && value !== "") {
        let parsed = key === "ngay_mai" || key === "ngay_ndt" ? date(value) : String(value).trim();
        if (key === "truc_quan" || key === "ket_qua_ndt") {
          if (parsed === PHRASES["Đạt"]) parsed = "Đạt";
          if (parsed === PHRASES["Không đạt"]) parsed = "Không đạt";
        }
        if (key === "phuong_phap_ndt") {
          for (const method of ["Siêu âm", "Từ tính", "Thẩm thấu"]) if (parsed === (PHRASES[method] ?? method.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) parsed = method;
        }
        Object.assign(patch, { [key]: parsed });
      }
    }
    const measurements: SavedWeldInspection["gia_tri_do"] = {};
    for (const k of GEOMETRY_CRITERIA) {
      const value = column(r, `${GEOMETRY_LABELS[k]} (mm)`);
      if (value !== undefined && value !== null && value !== "") {
        try { measurements[k] = parseWeldMeasurement(value); }
        catch { throw new Error(`Dòng ${index + 2}: sai số đo ${GEOMETRY_LABELS[k]}.`); }
      }
    }
    if (Object.keys(measurements).length) patch.gia_tri_do = measurements;
    if (Object.keys(patch).length) records.push({ moi_han_id: id, phien_ban: version, patch });
  });
  if (!records.length) throw new Error("Không có kiểm tra để nhập. Xuất Excel nhật ký và điền các cột kiểm tra; ô trống giữ dữ liệu hiện tại.");
  return records;
}
