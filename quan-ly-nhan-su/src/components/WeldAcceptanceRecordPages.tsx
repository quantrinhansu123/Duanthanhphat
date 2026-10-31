import type { RecordSet } from "@/lib/weldQualityClient";
import { GEOMETRY_CRITERIA, evaluateGeometry, type GeometryLimits, type GeometryMeasurements } from "@/lib/weldQuality";

export type RecordKind = "phu-luc" | "giai-doan" | "hoan-thanh";
export const ACCEPTANCE_DOCS: { kind: RecordKind; loai: string; title: string }[] = [
  { kind: "phu-luc", loai: "Phụ lục công việc", title: "PHỤ LỤC BIÊN BẢN NGHIỆM THU MỐI HÀN" },
  { kind: "giai-doan", loai: "Giai đoạn xây dựng", title: "BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG" },
  { kind: "hoan-thanh", loai: "Hoàn thành công việc", title: "BIÊN BẢN NGHIỆM THU HOÀN THÀNH GIAI ĐOẠN THI CÔNG" },
];

export const acceptancePrintCss = `
.acceptance-page { box-sizing: border-box; width: 210mm; min-height: 297mm; margin: 0 auto 16px; padding: 12mm 17mm; background: white; color: black; font: 13px/1.35 'Times New Roman', serif; }
.acceptance-page h2 { font-size: 15px; font-weight: bold; text-align: center; margin: 12px 0 2px; }
.acceptance-page h3 { font-weight: bold; margin-top: 8px; }
.acceptance-page p { margin: 3px 0; }
.acceptance-page table { width: 100%; border-collapse: collapse; }
.acceptance-page th, .acceptance-page td { border: 1px solid black; padding: 3px; overflow-wrap: anywhere; }
.acceptance-page .annex { font-size: 8px; table-layout: fixed; }
.acceptance-page .annex th { text-align: center; }
.acceptance-page .annex td { height: 21px; text-align: center; }
.acceptance-page .signature { text-align: center; font-weight: bold; margin-top: 10px; min-height: 95px; }
.acceptance-page .signature small { display: block; font-weight: normal; font-style: italic; }
.acceptance-page .dots { border-bottom: 1px dotted black; min-height: 21px; }
@media print {
  body > *:not(.acceptance-print-root) { display: none !important; }
  .acceptance-print-root { position: static !important; overflow: visible !important; padding: 0 !important; background: white !important; }
  .acceptance-print-root .weld-doc-actions, .acceptance-print-root .weld-print-pack-actions { display: none !important; }
  .acceptance-page { width: auto; min-height: 273mm; margin: 0; padding: 0; break-before: page; }
  .acceptance-page tr { break-inside: avoid; }
  .acceptance-page thead { display: table-header-group; }
  @page { size: A4; margin: 12mm 17mm; }
}`;

const blank = "………………";
const show = (v: unknown) => v == null || v === "" ? blank : String(v);
const dateText = (v: unknown) => {
  const [y, m, d] = String(v ?? "").slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : blank;
};
const labels = ["TƯ VẤN GIÁM SÁT", "NHÀ THẦU CHÍNH", "NHÀ THẦU PHỤ"];

export default function WeldAcceptanceRecordPages({ record, kind }: { record: RecordSet; kind?: RecordKind }) {
  const rfi = record.dot.phieu_yeu_cau_nghiem_thu;
  const project = rfi.du_an ?? {};
  const projectName = String(project.du_an ?? project.ten_du_an ?? project.name ?? "");
  const pq = /phú quốc/i.test(projectName);
  const base = { ...((rfi.thong_tin ?? {}) as Record<string, string>), ...((record.dot.thong_tin ?? {}) as Record<string, string>) };
  const rows = [...record.moi].sort((a, b) => String(a.du_lieu_chot.moi_han?.ma_lich_su ?? "").localeCompare(String(b.du_lieu_chot.moi_han?.ma_lich_su ?? ""), "vi", { numeric: true }));
  const participants = [
    ["Chủ đầu tư", pq ? "Ban Quản lý dự án - Công ty TNHH MTV BOT tàu điện Phú Quốc" : blank],
    ["Tư vấn giám sát", base.ben_nhan || (pq ? "Công ty CP TVTK XDCT GT Miền Bắc (TEDI - NORTH)" : blank)],
    ["Tư vấn thiết kế", blank],
    ["Nhà thầu chính", base.ben_moi || (pq ? "Tập đoàn Đường sắt Quốc gia Việt Nam" : blank)],
    ["Nhà thầu phụ", "Công ty Cổ phần Công trình Thành Phát"],
  ];

  function signatures(names: string[]) {
    return <div style={{ display: "grid", gridTemplateColumns: `repeat(${names.length}, 1fr)`, gap: 12 }}>
      {names.map((name) => <div key={name} className="signature">{name}<small>(Ký và ghi rõ họ tên)</small></div>)}
    </div>;
  }

  return <>{ACCEPTANCE_DOCS.filter((d) => !kind || d.kind === kind).map((doc) => {
    const hoSo = record.ho_so.find((h) => h.loai === doc.loai);
    const revision = record.sua_doi?.filter((r) => r.ho_so_id === hoSo?.id).sort((a, b) => a.phien_ban - b.phien_ban).at(-1);
    const t = { ...base, ...(revision?.thong_tin ?? {}) };
    const day = dateText((record.dot.thong_tin as { draft?: boolean } | undefined)?.draft === true ? rfi.ngay_moi : record.dot.ngay_nghiem_thu);
    const location = t.dia_diem || (pq ? "Đặc khu Phú Quốc, tỉnh An Giang" : "");
    const packageName = t.goi_thau || (pq ? "Gói thầu XL-03: Cung cấp và thi công lắp đặt hệ thống ray" : "");
    const codes = rows.map((r) => String(r.du_lieu_chot.moi_han?.ma_lich_su ?? "")).filter(Boolean);
    const pointRows = rows.map((r) => r.du_lieu_chot.moi_han ?? {});
    const chainage = pointRows.map((w) => w.ly_trinh).filter(Boolean).map(String);
    const range = `Từ ${show(t.kmFrom || chainage[0])} đến ${show(t.kmTo || chainage.at(-1))}`;
    const header = <>
      <p style={{ textAlign: "center", fontWeight: "bold" }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br /><span style={{ borderBottom: "1px solid" }}>Độc lập - Tự do - Hạnh phúc</span></p>
      <p style={{ textAlign: "right", fontStyle: "italic", marginTop: 12 }}>{pq ? "Phú Quốc" : show(location)}, ngày {day}</p>
      <h2>{doc.title}</h2>
      <p style={{ textAlign: "center", fontStyle: "italic" }}>Số: {show(rfi.so_phieu)}/{doc.kind === "giai-doan" ? "BBNTCV" : "BBNTHT"}</p>
      <p><b>Dự án:</b> {show(projectName)}</p><p><b>Gói thầu:</b> {show(packageName)}</p>
      <p><b>Hạng mục:</b> Thi công hàn ray</p><p><b>Địa điểm:</b> {show(location)}</p>
      {t.pham_vi && <p><b>Phạm vi:</b> {t.pham_vi}</p>}
    </>;
    const intro = <>
      <h3>1. Đối tượng nghiệm thu:</h3><p>- Nghiệm thu mối hàn {pointRows.some((w) => w.cong_nghe_han === "ATW") ? "ray" : "chảy giáp mép - Hàn trên tuyến"}</p>
      <h3>2. Thời gian nghiệm thu:</h3><p>Bắt đầu: {show(t.gio_bat_dau)} ngày {day}</p><p>Kết thúc: {show(t.gio_ket_thuc)} ngày {day}</p>
      <h3>3. Vị trí nghiệm thu:</h3><p>Lý trình: {range}</p><p>Tên mối hàn: {codes.join(", ") || blank}</p>
      <h3>4. Thành phần trực tiếp tham gia nghiệm thu:</h3>
      {t.thanh_phan && <p style={{ whiteSpace: "pre-wrap" }}>{t.thanh_phan}</p>}
      {participants.filter((_, i) => doc.kind === "hoan-thanh" || [1, 3, 4].includes(i)).map(([role, company]) => <div key={role}>
        <p><b>{role}: {company}</b></p>
        <p>Ông/Bà: …………………………… &emsp; Chức vụ: ……………………………</p>
        <p>Ông/Bà: …………………………… &emsp; Chức vụ: ……………………………</p>
      </div>)}
    </>;
    if (doc.kind === "phu-luc") {
      const pages = Array.from({ length: Math.max(1, Math.ceil(rows.length / 20)) }, (_, i) => rows.slice(i * 20, i * 20 + 20));
      return pages.map((page, pageIndex) => <article className="acceptance-page" key={`${doc.kind}-${pageIndex}`}>
        <p style={{ textAlign: "center", fontWeight: "bold" }}>DỰ ÁN: {show(projectName).toUpperCase()}<br />{show(packageName).toUpperCase()}<br />HẠNG MỤC: THI CÔNG HÀN RAY</p>
        <h2 style={{ fontSize: 12 }}>{doc.title}</h2><p style={{ textAlign: "center", fontWeight: "bold" }}>NGHIỆM THU CÔNG TÁC HÀN HIỆN TRƯỜNG</p>
        <p>RFI / ITR No: {show(rfi.so_phieu)} &emsp; Ngày nghiệm thu: {day} &emsp; Trang {pageIndex + 1}/{pages.length}</p>
        <p>Địa điểm: {show(location)} &emsp; Tuyến: {t.tuyen_thuong === "1" ? "☑" : "☐"} Thượng &emsp; {t.tuyen_ha === "1" ? "☑" : "☐"} Hạ</p>
        <p>Lý trình: {range}</p>
        {t.pham_vi && <p>Phạm vi: {t.pham_vi}</p>}
        <p>Tên thợ hàn: {[...new Set(page.map((r) => r.du_lieu_chot.moi_han?.ten_tho_han).filter(Boolean))].join(", ") || blank}</p>
        <p>Máy hàn: {[...new Set(page.map((r) => r.du_lieu_chot.moi_han?.ten_may ?? r.du_lieu_chot.moi_han?.ma_may).filter(Boolean))].join(", ") || blank} &emsp; Ca hàn: {[...new Set(page.map((r) => r.du_lieu_chot.moi_han?.ca_han).filter(Boolean))].join(", ") || blank}</p>
        <table className="annex"><colgroup>{[3, 15, 7, 9, 5, 5, 7, 7, 6, 6, 6, 6, 5, 7, 6].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
          <thead><tr><th rowSpan={2}>No.</th><th rowSpan={2}>TÊN MỐI HÀN</th><th rowSpan={2}>MÃ HIỆU RAY</th><th rowSpan={2}>LÝ TRÌNH</th><th rowSpan={2}>RAY TRÁI</th><th rowSpan={2}>RAY PHẢI</th><th rowSpan={2}>TRỰC QUAN</th><th rowSpan={2}>SIÊU ÂM</th><th colSpan={5}>NGHIỆM THU KÍCH THƯỚC HÌNH HỌC (mm)</th><th rowSpan={2}>TRONG GIỚI HẠN</th><th rowSpan={2}>GHI CHÚ</th></tr><tr>{["1. Dọc mặt lăn", "2. Ngang nấm ray", "3. Ngang chân ray", "4. Phẳng mặt lăn", "5. Dài mài"].map((s) => <th key={s}>{s}</th>)}</tr></thead>
          <tbody>{Array.from({ length: 20 }, (_, i) => {
            const row = page[i], w = row?.du_lieu_chot.moi_han ?? {}, kt = row?.du_lieu_chot.kiem_tra ?? {};
            const measurements = (kt.gia_tri_do ?? {}) as Record<string, number | null>;
            const geometry = row ? evaluateGeometry(measurements as GeometryMeasurements, row.du_lieu_chot.tieu_chuan?.dung_sai as GeometryLimits | null) : null;
            const note = kt.ghi_chu ?? (row?.ket_qua === "Chưa nghiệm thu" ? "" : row?.ly_do) ?? "";
            return <tr key={i}><td>{pageIndex * 20 + i + 1}</td><td>{String(w.ma_lich_su ?? "")}</td><td>{String(w.loai_ray ?? "")}</td><td>{String(w.ly_trinh ?? "")}</td><td>{String(w.ma_diem ?? "").match(/^(TT|HT)/) ? "✓" : ""}</td><td>{String(w.ma_diem ?? "").match(/^(TP|HP)/) ? "✓" : ""}</td><td>{String(kt.truc_quan ?? "")}</td><td>{String(kt.ket_qua_ndt ?? "")}</td>{GEOMETRY_CRITERIA.map((k) => <td key={k}>{measurements[k] ?? ""}</td>)}<td /><td>{geometry ?? ""}</td><td>{String(note)}</td></tr>;
          })}</tbody>
        </table>
        <p><b>Tiêu chuẩn áp dụng:</b> {[...new Set(page.map((r) => (r.du_lieu_chot.tieu_chuan as { ten?: string } | undefined)?.ten).filter(Boolean))].join("; ") || blank}</p>
        <p>1. Theo chiều dọc trên mặt lăn. 2. Theo chiều ngang trên nấm ray.<br />3. Theo chiều ngang trên các đầu chân ray. 4. Độ phẳng mặt lăn trên khu vực mài.<br />5. Chiều dài mài hoàn thiện: ……………… mm.</p>
        <p>Ghi chú: Kết quả chưa kiểm tra để trống, ghi nhận tại hiện trường.</p>
        {signatures(labels)}
      </article>);
    }
    return <div key={doc.kind}>
      <article className="acceptance-page">{header}{intro}
        {doc.kind === "giai-doan" ? <>
          <h3>5. Kết luận:</h3><p>☐ Chấp thuận nghiệm thu, đồng ý cho triển khai các công việc xây dựng tiếp theo.</p><p>☐ Không đồng ý nghiệm thu.</p><div className="dots" />
          <h3>6. Các thành phần trực tiếp tham gia nghiệm thu:</h3>{signatures(labels)}
        </> : <>
          <h3>5. Đánh giá công việc đã thực hiện:</h3>
          <p><b>a) Các tài liệu căn cứ nghiệm thu:</b></p><div className="dots" /><div className="dots" />
          <p><b>b) Đánh giá chất lượng công trình xây dựng so với thiết kế được phê duyệt:</b></p><div className="dots" /><div className="dots" />
        </>}
      </article>
      {doc.kind === "hoan-thanh" && <article className="acceptance-page">
        <p><b>c) Những điều chỉnh và thay đổi bổ sung trong quá trình thi công so với thiết kế được phê duyệt (có phụ lục đính kèm):</b></p><div className="dots" /><div className="dots" />
        <p><b>d) Đánh giá chất lượng hạng mục công trình:</b></p><p>- So với thiết kế, chỉ dẫn kỹ thuật: {blank}</p><p>- So với hợp đồng: {blank}</p>
        <p><b>e) Kết quả thí nghiệm, kiểm tra, kiểm định, thử nghiệm, chạy thử theo yêu cầu kỹ thuật của thiết kế:</b></p><div className="dots" /><div className="dots" />
        <p><b>f) Tuân thủ quy định về phòng cháy, chữa cháy, bảo vệ môi trường trong thi công và quy định chuyên ngành liên quan:</b></p><div className="dots" /><div className="dots" />
        <p><b>g) Các ý kiến khác:</b></p><div className="dots" /><div className="dots" />
        <h3>6. Kết luận:</h3><p>☐ Chấp thuận nghiệm thu hoàn thành hạng mục để chuyển giai đoạn thi công.</p><p>☐ Không đồng ý nghiệm thu.</p>
        <h3>7. Chữ ký các thành phần trực tiếp tham gia nghiệm thu:</h3>
        {signatures(["CHỦ ĐẦU TƯ"])}{signatures(["TƯ VẤN THIẾT KẾ", "TƯ VẤN GIÁM SÁT"])}{signatures(["NHÀ THẦU CHÍNH", "NHÀ THẦU PHỤ"])}
        <table><thead><tr><th>Chức vụ</th><th>Họ và tên</th><th>Chữ ký</th></tr></thead><tbody>{["Trưởng ban Ban QLDA", "Giám sát trưởng", "Chủ trì thiết kế", "Chỉ huy trưởng nhà thầu chính", "Chỉ huy trưởng nhà thầu phụ"].map((s) => <tr key={s}><td>{s}</td><td /><td /></tr>)}</tbody></table>
      </article>}
    </div>;
  })}</>;
}
