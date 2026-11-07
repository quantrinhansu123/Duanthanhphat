// Quy tắc thuần cho chọn mối phát RFI (giai đoạn 4). Dùng chung cho server và test; không import server-only.

export function rfiScope(info: Record<string, unknown> = {}) {
  const explicit = "nt_hinh_hoc" in info || "nt_sieu_am" in info;
  const on = (value: unknown) => value === "1" || value === true || value === "true";
  return { geometry: explicit ? on(info.nt_hinh_hoc) : true, ultrasound: explicit ? on(info.nt_sieu_am) : true };
}

export function rfiAcceptanceTitle(info: Record<string, unknown> = {}) {
  const scope = rfiScope(info);
  return scope.geometry && scope.ultrasound ? "Nghiệm thu kích thước hình học và siêu âm mối hàn"
    : scope.geometry ? "Nghiệm thu kích thước hình học mối hàn" : "Nghiệm thu siêu âm mối hàn";
}

export type RfiCandidate = {
  id: string;
  ma_lich_su: string;
  ngay_thuc_hien: string | null;
  ly_trinh: string | null;
  phien_ban: number;
  tinh_trang: string;
};

export type RfiCandidateFilter = {
  query?: string;
  nameFrom?: string;
  nameTo?: string;
  dateFrom?: string;
  dateTo?: string;
  kmFrom?: string;
  kmTo?: string;
};

/** "Km12+345", "12+345", "12345", "12,5" (km) → mét. Không hiểu thì null. */
export function parseChainageMeters(value: string | null | undefined): number | null {
  const text = (value ?? "").trim().toLowerCase().replace(/^km\s*/, "");
  if (!text) return null;
  const plus = /^(\d+)\s*\+\s*(\d{1,3}(?:[.,]\d+)?)$/.exec(text);
  if (plus) return Number(plus[1]) * 1000 + Number(plus[2].replace(",", "."));
  if (/^\d+(?:[.,]\d+)?$/.test(text)) return Number(text.replace(",", ".")) * 1000;
  return null;
}

/** So sánh tự nhiên: "PQ-2" đứng trước "PQ-10". */
export function compareWeldCodes(a: string, b: string): number {
  return a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" });
}

export function validateMonitoringRange(range: { nameFrom: string; nameTo: string; kmFrom: string; kmTo: string }) {
  const byName = Boolean(range.nameFrom || range.nameTo), byKm = Boolean(range.kmFrom || range.kmTo);
  if (!byName && !byKm) throw new Error("Nhập khoảng từ mối – đến mối và/hoặc từ Km – đến Km.");
  if (byName && (!range.nameFrom || !range.nameTo)) throw new Error("Nhập đủ từ mối và đến mối.");
  if (byName && compareWeldCodes(range.nameFrom, range.nameTo) > 0) throw new Error("Từ mối phải đứng trước hoặc bằng đến mối.");
  if (byKm) {
    const from = parseChainageMeters(range.kmFrom), to = parseChainageMeters(range.kmTo);
    if (from == null || to == null || !Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      throw new Error("Nhập đủ khoảng lý trình hợp lệ, từ Km không lớn hơn đến Km.");
    }
  }
}

export function filterRfiCandidates(rows: RfiCandidate[], f: RfiCandidateFilter) {
  const q = (f.query ?? "").trim().toLowerCase();
  const kmFrom = f.kmFrom ? parseChainageMeters(f.kmFrom) : null;
  const kmTo = f.kmTo ? parseChainageMeters(f.kmTo) : null;
  if ((f.kmFrom && kmFrom == null) || (f.kmTo && kmTo == null)) throw new Error("Lý trình không hợp lệ (ví dụ Km12+345).");
  const byKm = kmFrom != null || kmTo != null;
  const missingChainage: string[] = [];
  const out = rows.filter((r) => {
    if (q && !r.ma_lich_su.toLowerCase().includes(q)) return false;
    if (f.nameFrom && compareWeldCodes(r.ma_lich_su, f.nameFrom) < 0) return false;
    if (f.nameTo && compareWeldCodes(r.ma_lich_su, f.nameTo) > 0) return false;
    if (f.dateFrom && (!r.ngay_thuc_hien || r.ngay_thuc_hien < f.dateFrom)) return false;
    if (f.dateTo && (!r.ngay_thuc_hien || r.ngay_thuc_hien > f.dateTo)) return false;
    if (byKm) {
      const m = parseChainageMeters(r.ly_trinh);
      if (m == null) { missingChainage.push(r.id); return false; } // thiếu lý trình không lọt vào khoảng km
      if (kmFrom != null && m < kmFrom) return false;
      if (kmTo != null && m > kmTo) return false;
    }
    return true;
  });
  out.sort((a, b) => compareWeldCodes(a.ma_lich_su, b.ma_lich_su));
  return { rows: out, missingChainage };
}

/** Trạng thái được phép đưa vào phiếu RFI nghiệm thu (kể cả đã NDT Đạt nhưng chưa có RFI). */
export const RFI_ELIGIBLE_STATUSES = ["Chờ siêu âm và nghiệm thu", "Chờ siêu âm", "Chờ nghiệm thu", "Chờ thí nghiệm"] as const;

export function isRfiEligibleStatus(tinhTrang: string): boolean {
  return (RFI_ELIGIBLE_STATUSES as readonly string[]).includes(tinhTrang);
}

/** Lý do mối chưa được phát RFI, theo tình trạng chất lượng. */
export function rfiBlockReason(tinhTrang: string): string {
  switch (tinhTrang) {
    case "Đạt":
    case "Nghiệm thu đạt": return "Đã nghiệm thu đạt";
    case "Không đạt": return "Kiểm tra không đạt";
    case "Không thí nghiệm": return "Không thuộc diện thí nghiệm/nghiệm thu";
    case "Hàn":
    case "Chưa có dữ liệu chất lượng": return "Chưa ghi nhận kiểm tra";
    case "Chờ mài": return "Chưa mài hoặc thiếu trực quan/số đo";
    case "Sửa chữa/khắc phục": return "Đang sửa chữa/khắc phục sau trực quan hoặc độ lệch";
    case "Chờ siêu âm và nghiệm thu":
    case "Chờ thí nghiệm": return "Chưa có siêu âm đạt";
    case "Chờ siêu âm": return "Đã nghiệm thu hình học — đang chờ siêu âm";
    case "Chờ nghiệm thu": return "Đã mài đạt — đang chờ nghiệm thu kích thước hình học";
    case "Chờ ký biên bản": return "Đã nghiệm thu — đang chờ ký biên bản";
    default: return "Chưa đủ điều kiện (thiếu trực quan, hình học hoặc NDT theo tiêu chí)";
  }
}

export type AcceptanceDecision = { moi_han_id: string; phien_ban: number; ket_qua: "Đạt" | "Không đạt" | "Chưa nghiệm thu"; ly_do?: string };

export function acceptanceBlockReason(status: string, missingGrindingLength: boolean): string {
  if (missingGrindingLength) return "Thiếu chiều dài mài hoàn thiện (mm). Nhập số đo thực tế và lưu trước khi chọn Đạt.";
  if (status === "Chờ siêu âm và nghiệm thu" || status === "Chờ thí nghiệm") return "Chưa có kết quả NDT đạt và ngày thí nghiệm; kiểm tra lại dữ liệu chất lượng.";
  if (status === "Chờ siêu âm") return "Đã nghiệm thu hình học — cần kết quả siêu âm Đạt và ngày thí nghiệm.";
  if (status === "Chờ nghiệm thu") return "Đã mài đạt — bổ sung đủ số đo (nếu thiếu) rồi hoàn thành nghiệm thu.";
  if (status === "Chờ ký biên bản") return "Đã nghiệm thu Đạt — chuyển sang Hồ sơ để ký bộ biên bản.";
  return rfiBlockReason(status);
}

/** Trạng thái bất thường trên phiếu RFI đã phát — không nên còn «Chờ mài». */
export function isAnomalousRfiWeldStatus(tinhTrang: string): boolean {
  return tinhTrang === "Chờ mài" || tinhTrang === "Hàn" || tinhTrang === "Chưa có dữ liệu chất lượng";
}

/** Mặc định "Đạt" chỉ khi đủ điều kiện nghiệm thu; còn lại "Chưa nghiệm thu" kèm lý do theo tình trạng. */
export function defaultDecisions(welds: {
  moi_han_id: string;
  phien_ban: number;
  du_dieu_kien_nghiem_thu: boolean;
  tinh_trang?: string;
  ly_do_chua_du_dieu_kien?: string;
}[]): AcceptanceDecision[] {
  return welds.map((w) => {
    if (w.du_dieu_kien_nghiem_thu) {
      return { moi_han_id: w.moi_han_id, phien_ban: w.phien_ban, ket_qua: "Đạt" };
    }
    const status = w.tinh_trang ?? "";
    const ly_do = isAnomalousRfiWeldStatus(status)
      ? `Bất thường trên RFI: đang «${status}» — cần Kiểm tra (mài/trực quan/số đo) trước khi nghiệm thu`
      : (w.ly_do_chua_du_dieu_kien || (status ? rfiBlockReason(status) : "Chưa đủ điều kiện nghiệm thu"));
    return { moi_han_id: w.moi_han_id, phien_ban: w.phien_ban, ket_qua: "Chưa nghiệm thu", ly_do };
  });
}

export function summarizeDecisions(d: AcceptanceDecision[]) {
  return {
    total: d.length,
    accepted: d.filter((x) => x.ket_qua === "Đạt").length,
    failed: d.filter((x) => x.ket_qua === "Không đạt").length,
    deferred: d.filter((x) => x.ket_qua === "Chưa nghiệm thu").length,
  };
}
