// Quy tắc thuần cho chọn mối phát RFI (giai đoạn 4). Dùng chung cho server và test; không import server-only.

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

/** Lý do mối chưa được phát RFI, theo tình trạng chất lượng. */
export function rfiBlockReason(tinhTrang: string): string {
  switch (tinhTrang) {
    case "Nghiệm thu đạt": return "Đã nghiệm thu đạt";
    case "Không đạt": return "Kiểm tra không đạt";
    case "Không thí nghiệm": return "Không thuộc diện thí nghiệm/nghiệm thu";
    case "Chưa có dữ liệu chất lượng": return "Chưa ghi nhận kiểm tra";
    case "Chờ mài": return "Chưa mài hoặc thiếu trực quan/số đo";
    default: return "Chưa đủ điều kiện (thiếu trực quan, hình học hoặc NDT theo tiêu chí)";
  }
}

export type AcceptanceDecision = { moi_han_id: string; phien_ban: number; ket_qua: "Đạt" | "Không đạt" | "Chưa nghiệm thu"; ly_do?: string };

/** Mặc định "Hoàn thành" cho mối đủ điều kiện nghiệm thu; mối chưa đủ mặc định "Chưa nghiệm thu". */
export function defaultDecisions(welds: { moi_han_id: string; phien_ban: number; du_dieu_kien_nghiem_thu: boolean }[]): AcceptanceDecision[] {
  return welds.map((w) => w.du_dieu_kien_nghiem_thu
    ? { moi_han_id: w.moi_han_id, phien_ban: w.phien_ban, ket_qua: "Đạt" }
    : { moi_han_id: w.moi_han_id, phien_ban: w.phien_ban, ket_qua: "Chưa nghiệm thu", ly_do: "Chưa đủ điều kiện nghiệm thu" });
}

export function summarizeDecisions(d: AcceptanceDecision[]) {
  return {
    total: d.length,
    accepted: d.filter((x) => x.ket_qua === "Đạt").length,
    failed: d.filter((x) => x.ket_qua === "Không đạt").length,
    deferred: d.filter((x) => x.ket_qua === "Chưa nghiệm thu").length,
  };
}
