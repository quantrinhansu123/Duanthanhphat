import type { RecordSet } from "@/lib/weldQualityClient";
import { GEOMETRY_CRITERIA, evaluateGeometry, type GeometryLimits, type GeometryMeasurements } from "@/lib/weldQuality";

export type RecordKind = "phu-luc" | "giai-doan" | "hoan-thanh";
export const ACCEPTANCE_DOCS: { kind: RecordKind; loai: string; title: string }[] = [
  { kind: "phu-luc", loai: "Phụ lục công việc", title: "BIÊN BẢN NGHIỆM THU MỐI HÀN CHẢY GIÁP MÉP" },
  { kind: "giai-doan", loai: "Giai đoạn xây dựng", title: "BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG" },
  { kind: "hoan-thanh", loai: "Hoàn thành công việc", title: "BIÊN BẢN NGHIỆM THU HOÀN THÀNH GIAI ĐOẠN THI CÔNG" },
];

const BOX = "❐";
const ROWS_PER_PAGE = 20;

export const acceptancePrintCss = `
.acceptance-page { box-sizing: border-box; width: 210mm; min-height: 297mm; margin: 0 auto 16px; padding: 12mm 17mm; background: white; color: black; font: 13px/1.35 'Times New Roman', serif; }
.acceptance-page.annex-page { width: 210mm; min-height: 297mm; padding: 6mm 7mm; font: 9px/1.2 'Times New Roman', serif; }
.acceptance-page h2 { font-size: 15px; font-weight: bold; text-align: center; margin: 12px 0 2px; }
.acceptance-page.annex-page h2 { font-size: 12px; margin: 0; padding: 4px 2px; text-transform: uppercase; }
.acceptance-page h3 { font-weight: bold; margin-top: 8px; }
.acceptance-page p { margin: 3px 0; }
.acceptance-page table { width: 100%; border-collapse: collapse; }
.acceptance-page th, .acceptance-page td { border: 1px solid black; padding: 3px; overflow-wrap: anywhere; }
.acceptance-page .annex-sheet { width: 100%; border-collapse: collapse; table-layout: fixed; }
.acceptance-page .annex-sheet > tbody > tr > td { border: 1px solid black; padding: 2px 4px; vertical-align: top; }
.acceptance-page .annex-sheet .title-cell { text-align: center; font-weight: bold; font-size: 12px; text-transform: uppercase; padding: 5px 2px; }
.acceptance-page .annex-sheet .head-left { font-weight: bold; text-transform: uppercase; font-size: 9.5px; line-height: 1.35; }
.acceptance-page .annex-sheet .head-right { width: 28%; font-size: 9px; }
.acceptance-page .annex { font-size: 7.2px; table-layout: fixed; border-collapse: collapse; width: 100%; }
.acceptance-page .annex th { text-align: center; vertical-align: middle; font-weight: bold; padding: 1px; line-height: 1.15; }
.acceptance-page .annex td { height: 15px; text-align: center; padding: 0 1px; vertical-align: middle; }
.acceptance-page .annex-meta-grid { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5px; }
.acceptance-page .annex-meta-grid td { border: 1px solid black; padding: 2px 4px; vertical-align: middle; }
.acceptance-page .annex-foot { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8px; }
.acceptance-page .annex-foot > tbody > tr > td { border: 1px solid black; padding: 3px 4px; vertical-align: top; }
.acceptance-page .annex-tol { width: 100%; border-collapse: collapse; }
.acceptance-page .annex-tol th, .acceptance-page .annex-tol td { font-size: 7.5px; padding: 1px 3px; }
.acceptance-page .annex-sign { width: 100%; border-collapse: collapse; margin-top: 0; }
.acceptance-page .annex-sign th, .acceptance-page .annex-sign td { border: 1px solid black; text-align: center; vertical-align: top; padding: 4px 6px; }
.acceptance-page .annex-sign th { font-weight: bold; text-transform: uppercase; font-size: 9px; }
.acceptance-page .annex-sign td { height: 70px; font-size: 9px; text-align: left; font-weight: normal; }
.acceptance-page .signature { text-align: center; font-weight: bold; margin-top: 10px; min-height: 95px; }
.acceptance-page .signature small { display: block; font-weight: normal; font-style: italic; }
.acceptance-page .dots { border-bottom: 1px dotted black; min-height: 21px; }
.acceptance-page.work-page { font: 12.5px/1.35 'Times New Roman', serif; }
.acceptance-page.work-page h3 { margin-top: 6px; margin-bottom: 2px; }
.acceptance-page .nation { text-align: center; font-weight: bold; line-height: 1.3; }
.acceptance-page .nation .motto { border-bottom: 1px solid black; display: inline-block; padding: 0 8px 1px; }
.acceptance-page .nation .ornament { margin-top: 2px; font-weight: normal; letter-spacing: 1px; }
.acceptance-page .place-date { text-align: right; font-style: italic; margin: 10px 0 8px; }
.acceptance-page .doc-no { text-align: center; margin: 2px 0 8px; }
.acceptance-page .field-row { margin: 1px 0; }
.acceptance-page .field-label { display: inline-block; min-width: 5.2rem; }
.acceptance-page .party { margin: 4px 0 5px; }
.acceptance-page .party .person { margin: 1px 0 1px 1.2rem; }
.acceptance-page .conclude-line { margin: 3px 0 3px 0.5rem; }
.acceptance-page .work-sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 22px; text-align: center; font-weight: bold; text-transform: uppercase; }
.acceptance-page .work-sign div { min-height: 96px; }
.acceptance-page .work-sign small { display: block; margin-top: 4px; font-weight: normal; font-style: italic; text-transform: none; }
.acceptance-page .complete-sign { text-align: center; font-weight: bold; text-transform: uppercase; min-height: 88px; margin-top: 10px; }
.acceptance-page .complete-sign small { display: block; margin-top: 4px; font-weight: normal; font-style: italic; text-transform: none; }
.acceptance-page .complete-sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 8px; }
.acceptance-page .conclude-table { margin: 8px 0 14px; }
.acceptance-page .conclude-table td { padding: 6px 8px; vertical-align: middle; }
.acceptance-page .sign-roster { margin-top: 14px; }
.acceptance-page .sign-roster th, .acceptance-page .sign-roster td { height: 28px; padding: 4px 6px; }
@media print {
  body > *:not(.acceptance-print-root) { display: none !important; }
  .acceptance-print-root { position: static !important; overflow: visible !important; padding: 0 !important; background: white !important; }
  .acceptance-print-root .weld-doc-actions, .acceptance-print-root .weld-print-pack-actions { display: none !important; }
  /* Mỗi tờ/mẫu bắt đầu trang mới — không dính liền nhau. */
  .acceptance-page {
    width: auto; min-height: 0; height: auto; margin: 0; padding: 0;
    break-before: page !important; page-break-before: always !important;
    break-after: auto; page-break-after: auto;
    break-inside: avoid; page-break-inside: avoid;
  }
  .acceptance-page:first-of-type {
    break-before: auto !important; page-break-before: auto !important;
  }
  .acceptance-page.annex-page { padding: 0; }
  .acceptance-page tr { break-inside: avoid; page-break-inside: avoid; }
  .acceptance-page thead { display: table-header-group; }
  @page { size: A4 portrait; margin: 10mm 12mm; }
}`;

const blank = "………………";
const show = (v: unknown) => v == null || v === "" ? blank : String(v);
const dateParts = (v: unknown) => {
  const [y, m, d] = String(v ?? "").slice(0, 10).split("-");
  return y && m && d ? { d, m, y } : { d: "……", m: "……", y: "……" };
};
const timeText = (v: unknown) => {
  const raw = String(v ?? "").trim();
  if (!raw) return "………";
  return raw.slice(0, 5);
};
const labels = ["TƯ VẤN GIÁM SÁT", "NHÀ THẦU CHÍNH", "NHÀ THẦU PHỤ"];
const str = (v: unknown) => (v == null ? "" : String(v));
const unique = (values: unknown[]) => [...new Set(values.map(str).filter(Boolean))];
const kmText = (v: unknown) => {
  const raw = str(v).trim();
  if (!raw) return "…………";
  return raw.replace(/^\s*km\s*/i, "");
};

function mark(on: boolean) {
  return on ? "☑" : BOX;
}

function isDayShift(ca: string) {
  const v = ca.toLocaleLowerCase("vi");
  return /ca\s*1|ngày|sang|day/.test(v);
}
function isNightShift(ca: string) {
  const v = ca.toLocaleLowerCase("vi");
  return /ca\s*[23]|đêm|toi|tối|night/.test(v);
}

export default function WeldAcceptanceRecordPages({ record, kind }: { record: RecordSet; kind?: RecordKind }) {
  const rfi = record.dot.phieu_yeu_cau_nghiem_thu;
  const project = rfi.du_an ?? {};
  const projectName = String(project.du_an ?? project.ten_du_an ?? project.name ?? "");
  const pq = /phú quốc/i.test(projectName);
  const base = { ...((rfi.thong_tin ?? {}) as Record<string, string>), ...((record.dot.thong_tin ?? {}) as Record<string, string>) };
  const rows = [...record.moi].sort((a, b) => String(a.du_lieu_chot.moi_han?.ma_lich_su ?? "").localeCompare(String(b.du_lieu_chot.moi_han?.ma_lich_su ?? ""), "vi", { numeric: true }));

  return <>{ACCEPTANCE_DOCS.filter((d) => !kind || d.kind === kind).map((doc) => {
    const hoSo = record.ho_so.find((h) => h.loai === doc.loai);
    const revision = record.sua_doi?.filter((r) => r.ho_so_id === hoSo?.id).sort((a, b) => a.phien_ban - b.phien_ban).at(-1);
    const t = { ...base, ...(revision?.thong_tin ?? {}) };
    const acceptIso = (record.dot.thong_tin as { draft?: boolean } | undefined)?.draft === true ? rfi.ngay_moi : record.dot.ngay_nghiem_thu;
    const parts = dateParts(acceptIso);
    const day = `${parts.d}/${parts.m}/${parts.y}`;
    const location = t.dia_diem || (pq ? "Đặc khu Phú Quốc, Tỉnh An Giang" : "");
    const packageName = t.goi_thau || (pq ? "Gói thầu XL-03: Cung cấp và thi công lắp đặt hệ thống ray" : "");
    const codes = rows.map((r) => String(r.du_lieu_chot.moi_han?.ma_lich_su ?? "")).filter(Boolean);
    const pointRows = rows.map((r) => r.du_lieu_chot.moi_han ?? {});
    const chainage = pointRows.map((w) => w.ly_trinh).filter(Boolean).map(String);
    if (doc.kind === "phu-luc") {
      const pages = Array.from({ length: Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE)) }, (_, i) => rows.slice(i * ROWS_PER_PAGE, i * ROWS_PER_PAGE + ROWS_PER_PAGE));
      const shifts = unique(pointRows.map((w) => w.ca_han));
      const dayOn = shifts.some(isDayShift);
      const nightOn = shifts.some(isNightShift);
      const welders = unique(pointRows.map((w) => w.ten_tho_han));
      const welderIds = unique(pointRows.map((w) => w.ma_nhan_su));
      const machines = unique(pointRows.map((w) => w.ten_may || w.ma_may));
      const upper = t.tuyen_thuong === "1" || pointRows.some((w) => /^(TT|TP)/i.test(str(w.ma_diem)));
      const lower = t.tuyen_ha === "1" || pointRows.some((w) => /^(HT|HP)/i.test(str(w.ma_diem)));
      const mobile = /un5|lưu động|di động|mobile/i.test(machines.join(" "));
      const fixed = /kcm|k922|cố định|fixed/i.test(machines.join(" "));

      return pages.map((page, pageIndex) => (
        <article className="acceptance-page annex-page" key={`${doc.kind}-${pageIndex}`}>
          <table className="annex-sheet">
            <tbody>
              <tr>
                <td className="head-left">
                  DỰ ÁN: {show(projectName).toUpperCase()}<br />
                  {show(packageName).replace(/^Gói thầu\s*/i, "GÓI THẦU ").toUpperCase()}<br />
                  HẠNG MỤC: THI CÔNG HÀN RAY
                </td>
                <td className="head-right"><b>Địa điểm:</b><br />{show(location)}</td>
              </tr>
              <tr>
                <td className="title-cell" colSpan={2}>{doc.title}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: 0 }}>
                  <table className="annex-meta-grid">
                    <colgroup>
                      <col style={{ width: "42%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "40%" }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td colSpan={2}><b>TÊN TÀI LIỆU:</b> NGHIỆM THU CÔNG TÁC HÀN HIỆN TRƯỜNG (HÀN SẢN XUẤT)</td>
                        <td><b>CA HÀN:</b> {mark(dayOn)} Ngày &nbsp; {mark(nightOn)} Đêm</td>
                      </tr>
                      <tr>
                        <td colSpan={2}><b>RFI/ ITR No:</b> {show(rfi.so_phieu)}</td>
                        <td><b>BIỆN PHÁP HÀN:</b> {mark(fixed)} Hàn cố định &nbsp; {mark(mobile)} Hàn di động</td>
                      </tr>
                      <tr>
                        <td><b>NGÀY NGHIỆM THU:</b> {day}</td>
                        <td colSpan={2}>
                          <b>TÊN THỢ HÀN:</b> {welders.join(", ") || "………………"} &nbsp;
                          <b>ID:</b> {welderIds.join(", ") || "…………"} &nbsp;
                          <b>LÝ TRÌNH:</b> TỪ: {kmText(t.kmFrom || chainage[0])} &nbsp; ĐẾN: {kmText(t.kmTo || chainage.at(-1))}
                        </td>
                      </tr>
                      <tr>
                        <td><b>VỊ TRÍ:</b> {show(t.pham_vi || "………………")}</td>
                        <td><b>TUYẾN:</b><br />{mark(upper)} Tuyến thượng<br />{mark(lower)} Tuyến hạ</td>
                        <td>
                          <b>TÊN MÁY HÀN CHẢY GIÁP MÉP</b><br />
                          Máy hàn: {machines.join(", ") || "………………"}<br />
                          Goòng phẳng: {show(t.goong || t.goong_phang)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: 0 }}>
                  <table className="annex">
                    <colgroup>
                      {[3, 11, 8, 9, 5, 5, 8, 7, 4, 4, 4, 4, 4, 9, 15].map((w, i) => (
                        <col key={i} style={{ width: `${w}%` }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th rowSpan={3}>No.</th>
                        <th rowSpan={3}>TÊN MỐI HÀN</th>
                        <th rowSpan={3}>MÃ HIỆU RAY<br />(60R2 - U75V)</th>
                        <th rowSpan={3}>LÝ TRÌNH<br />MỐI HÀN</th>
                        <th colSpan={2} rowSpan={2}>RAY</th>
                        <th colSpan={8}>NGHIỆM THU KÍCH THƯỚC HÌNH HỌC<br />(ĐẠT/KHÔNG ĐẠT)</th>
                        <th rowSpan={3}>GHI CHÚ</th>
                      </tr>
                      <tr>
                        <th rowSpan={2}>KIỂM TRA TỔNG THỂ MỐI HÀN BẰNG MẮT THƯỜNG</th>
                        <th rowSpan={2}>KIỂM TRA SIÊU ÂM</th>
                        <th colSpan={5}>Kiểm tra độ thẳng và độ phẳng của mối hàn</th>
                        <th rowSpan={2}>Nằm trong giới hạn cho phép</th>
                      </tr>
                      <tr>
                        <th>RAY TRÁI</th>
                        <th>RAY PHẢI</th>
                        {[1, 2, 3, 4, 5].map((n) => <th key={n}>{n}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: ROWS_PER_PAGE }, (_, i) => {
                        const row = page[i];
                        const w = row?.du_lieu_chot.moi_han ?? {};
                        const kt = row?.du_lieu_chot.kiem_tra ?? {};
                        const measurements = (kt.gia_tri_do ?? {}) as Record<string, number | null>;
                        const geometry = row
                          ? evaluateGeometry(
                              measurements as GeometryMeasurements,
                              row.du_lieu_chot.tieu_chuan?.dung_sai as GeometryLimits | null,
                            )
                          : null;
                        const code = str(w.ma_diem);
                        const left = /^(TT|HT)/i.test(code) ? "✓" : "";
                        const right = /^(TP|HP)/i.test(code) ? "✓" : "";
                        const note = str(kt.ghi_chu ?? (row?.ket_qua === "Chưa nghiệm thu" ? "" : row?.ly_do));
                        const inLimit =
                          geometry ?? (row?.ket_qua === "Đạt" || row?.ket_qua === "Không đạt" ? row.ket_qua : "");
                        return (
                          <tr key={i}>
                            <td>{pageIndex * ROWS_PER_PAGE + i + 1}</td>
                            <td>{str(w.ma_lich_su)}</td>
                            <td>{str(w.loai_ray)}</td>
                            <td>{str(w.ly_trinh)}</td>
                            <td>{left}</td>
                            <td>{right}</td>
                            <td>{str(kt.truc_quan)}</td>
                            <td>{str(kt.ket_qua_ndt)}</td>
                            {GEOMETRY_CRITERIA.map((k) => (
                              <td key={k}>{measurements[k] ?? ""}</td>
                            ))}
                            <td />
                            <td>{inLimit}</td>
                            <td>{note}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: 0 }}>
                  <table className="annex-foot">
                    <colgroup>
                      <col style={{ width: "42%" }} />
                      <col style={{ width: "38%" }} />
                      <col style={{ width: "20%" }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td>
                          <p style={{ margin: "0 0 3px" }}>
                            1. Tên tiêu chuẩn áp dụng: TCVN 13965-2:2024 – Ứng dụng đường sắt – Hàn ray – Hàn chảy giáp mối – Phần 2
                          </p>
                          <p style={{ margin: 0 }}>
                            2. Tiêu chuẩn tham chiếu bổ sung cho ray rãnh và các nội dung chưa được quy định chi tiết trong TCVN: CECS 429 : 2016 – Tiêu chuẩn nghiệm thu chất lượng hàn chảy giáp mép ray rãnh cho đường sắt đô thị.
                          </p>
                          <p style={{ margin: "6px 0 0", fontSize: "7.5px" }}>
                            Ghi chú:<br />
                            (1): Đối với độ thẳng theo phương ngang, dung sai dương (+) sẽ làm tăng khổ đường<br />
                            (2): Đối với độ phẳng mặt lăn, chỉ đo giá trị lớn nhất
                          </p>
                          <p style={{ margin: "4px 0 0", textAlign: "right" }}>Trang {pageIndex + 1}/{pages.length}</p>
                        </td>
                        <td style={{ padding: 0 }}>
                          <table className="annex-tol">
                            <thead>
                              <tr>
                                <th>Đối chiếu độ phẳng và thẳng mối hàn</th>
                                <th>Sai số cho phép (mm)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                ["1. Theo chiều dọc trên mặt lăn.", "+0.4 / -0.10"],
                                ["2. Theo chiều ngang trên nấm ray.", "± 0.4 (1)"],
                                ["3. Theo chiều ngang trên các đầu chân ray.", "± 2.0"],
                                ["4. Độ phẳng mặt lăn, được đo trên chiều dài khu vực mài.", "0.2 (2)"],
                                ["5. Chiều dài mài hoàn thiện", "≤ 800"],
                              ].map(([a, b]) => (
                                <tr key={a}>
                                  <td style={{ textAlign: "left" }}>{a}</td>
                                  <td style={{ textAlign: "center" }}>{b}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                        <td><b>GHI CHÚ:</b></td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: 0 }}>
                  <table className="annex-sign">
                    <thead>
                      <tr>
                        <th>ĐẠI DIỆN TƯ VẤN GIÁM SÁT</th>
                        <th>ĐẠI DIỆN NHÀ THẦU CHÍNH</th>
                        <th>ĐẠI DIỆN NHÀ THẦU PHỤ</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {["HỌ VÀ TÊN:", "HỌ VÀ TÊN:", "HỌ VÀ TÊN:"].map((label, i) => (
                          <td key={i}>
                            {label}<br /><br />
                            NGÀY:<br /><br />
                            CHỮ KÝ:
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </article>
      ));
    }
    if (doc.kind === "giai-doan") {
      const tvgs = t.ben_nhan || (pq ? "Công ty cổ phần Tư vấn thiết kế xây dựng công trình giao thông Miền Bắc (TEDI - NORTH)" : blank);
      const ntc = t.ben_moi || (pq ? "Tập đoàn đường sắt quốc gia Việt Nam" : blank);
      const ntp = "Công ty Cổ phần Công trình Thành Phát";
      const weldNames = codes.length ? `${codes.join(", ")}${codes.length > 3 ? ", ………." : ""}` : "……………………";
      const objectText = pointRows.some((w) => w.cong_nghe_han === "ATW")
        ? "Nghiệm thu mối hàn ray"
        : "Nghiệm thu mối hàn chảy giáp mép - Hàn trên tuyến";
      return (
        <article className="acceptance-page work-page" key={doc.kind}>
          <div className="nation">
            CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM<br />
            <span className="motto">Độc lập - Tự do - Hạnh phúc</span>
            <div className="ornament">----------- ✦ -----------</div>
          </div>
          <p className="place-date">
            {pq ? "Phú Quốc" : (location.split(",")[0]?.trim() || "…………")}, ngày {parts.d} tháng {parts.m} năm {parts.y}
          </p>
          <h2>{doc.title}</h2>
          <p className="doc-no">Số: {show(rfi.so_phieu)}/BBNTCV</p>

          <p className="field-row"><span className="field-label">Dự án</span>: {show(projectName)}</p>
          <p className="field-row"><span className="field-label">Gói thầu</span>: {show(packageName)}</p>
          <p className="field-row"><span className="field-label">Hạng mục</span>: Thi công hàn ray</p>
          <p className="field-row"><span className="field-label">Địa điểm</span>: {show(location)}</p>

          <h3>1. Đối tượng nghiệm thu:</h3>
          <p>- {objectText}</p>

          <h3>2. Thời gian nghiệm thu:</h3>
          <p>Bắt đầu&nbsp;&nbsp;: {timeText(t.gio_bat_dau)} ngày {parts.d} tháng {parts.m} năm {parts.y}</p>
          <p>Kết thúc&nbsp;: {timeText(t.gio_ket_thuc)} ngày {parts.d} tháng {parts.m} năm {parts.y}</p>

          <h3>3. Vị trí nghiệm thu:</h3>
          <p>Lý trình: Từ : Km {kmText(t.kmFrom || chainage[0])} đến Km {kmText(t.kmTo || chainage.at(-1))}.</p>
          <p>Tên mối hàn: {weldNames}</p>

          <h3>4. Thành phần trực tiếp tham gia nghiệm thu:</h3>
          {([
            ["a) Tư vấn Giám sát", tvgs],
            ["b) Nhà thầu chính", ntc],
            ["c) Nhà thầu phụ", ntp],
          ] as const).map(([role, company]) => (
            <div className="party" key={role}>
              <p><b>{role}:</b> {company}</p>
              <p className="person">Ông: …………………… &nbsp; Chức vụ: ……………………</p>
              <p className="person">Ông: …………………… &nbsp; Chức vụ: ……………………</p>
            </div>
          ))}

          <h3>5. Kết luận:</h3>
          <p className="conclude-line">{BOX} Chấp thuận nghiệm thu, đồng ý cho triển khai các công việc xây dựng tiếp theo.</p>
          <p className="conclude-line">{BOX} Không đồng ý nghiệm thu.</p>
          <div className="dots" />
          <div className="dots" />

          <h3>6. Các thành phần trực tiếp tham gia nghiệm thu:</h3>
          <div className="work-sign">
            {labels.map((name) => (
              <div key={name}>
                {name}
                <small>(Ký và ghi rõ họ tên)</small>
              </div>
            ))}
          </div>
        </article>
      );
    }

    // (3) Biên bản nghiệm thu hoàn thành công việc — theo mẫu PDF 2 trang.
    const cdt = pq ? "Ban Quản lý dự án - Công ty TNHH MTV BOT tàu điện Phú Quốc" : blank;
    const tvgsHt = t.ben_nhan || (pq ? "Tư vấn giám sát – Công ty CP TVTK XDCT GT Miền Bắc (Tedi North)" : blank);
    const ntcHt = t.ben_moi || (pq ? "Tập đoàn Đường sắt Quốc gia Việt Nam" : blank);
    const ntpHt = "Công ty Cổ phần Công trình Thành Phát";
    const stamp = (title: string) => (
      <div className="complete-sign" key={title}>
        {title}
        <small>(Ký đóng dấu và ghi rõ họ tên)</small>
      </div>
    );
    const personBlock = () => (
      <>
        <p className="person">Ông: …………………… &nbsp; Chức vụ: ……………………</p>
        <p className="person">Ông: …………………… &nbsp; Chức vụ: ……………………</p>
      </>
    );

    return (
      <>
        <article key={`${doc.kind}-1`} className="acceptance-page work-page">
          <div className="nation">
            CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM<br />
            <span className="motto">Độc lập - Tự do - Hạnh phúc</span>
            <div className="ornament">----------- ✦ -----------</div>
          </div>
          <p className="place-date">
            {pq ? "Phú Quốc" : (location.split(",")[0]?.trim() || "…………")}, ngày {parts.d} tháng {parts.m} năm {parts.y}
          </p>
          <h2>{doc.title}</h2>
          <p className="doc-no">Số: {show(rfi.so_phieu)}/BBNTHT</p>

          <p className="field-row"><span className="field-label">Dự án</span>: {show(projectName)}</p>
          <p className="field-row"><span className="field-label">Gói thầu</span>: {show(packageName)}</p>
          <p className="field-row"><span className="field-label">Hạng mục</span>: Thi công hàn ray</p>
          <p className="field-row"><span className="field-label">Địa điểm</span>: {show(location)}</p>

          <h3>1. Đối tượng nghiệm thu:</h3>
          <p>- Nghiệm thu mối hàn ray</p>

          <h3>2. Thời gian nghiệm thu:</h3>
          <p>Bắt đầu&nbsp;&nbsp;: {timeText(t.gio_bat_dau)} ngày {parts.d} tháng {parts.m} năm {parts.y}</p>
          <p>Kết thúc&nbsp;: {timeText(t.gio_ket_thuc)} ngày {parts.d} tháng {parts.m} năm {parts.y}</p>

          <h3>3. Vị trí nghiệm thu:</h3>
          <p>Lý trình : Từ: Km {kmText(t.kmFrom || chainage[0])} đến Km {kmText(t.kmTo || chainage.at(-1))}</p>

          <h3>4. Thành phần trực tiếp tham gia nghiệm thu:</h3>
          <div className="party">
            <p><b>3.1. Chủ đầu tư:</b> {cdt}</p>
            {personBlock()}
          </div>
          <div className="party">
            <p><b>3.2. Tư vấn Giám sát:</b> {tvgsHt}</p>
            {personBlock()}
          </div>
          <div className="party">
            <p><b>3.3. Tư vấn thiết kế:</b></p>
            {personBlock()}
          </div>
          <div className="party">
            <p><b>3.4. Nhà thầu chính:</b> {ntcHt}</p>
            {personBlock()}
          </div>
          <div className="party">
            <p><b>3.5. Nhà thầu phụ:</b> {ntpHt}</p>
            {personBlock()}
          </div>

          <h3>5. Đánh giá công việc đã thực hiện:</h3>
          <p><b>a) Các tài liệu căn cứ nghiệm thu:</b></p>
          <div className="dots" /><div className="dots" />
          <p><b>b) Đánh giá về chất lượng về chất lượng công trình xây dựng so với thiết kế được phê duyệt:</b></p>
          <div className="dots" /><div className="dots" />
        </article>

        <article key={`${doc.kind}-2`} className="acceptance-page work-page">
          <p><b>c) Những điều chỉnh và thay đổi bổ sung trong quá trình thi công so với thiết kế được phê duyệt ( có phụ lục đính kèm):</b></p>
          <div className="dots" /><div className="dots" />
          <p><b>d) Đánh giá chất lượng hạng mục công trình:</b></p>
          <p>- So với thiết kế, chỉ dẫn kỹ thuật: {blank}</p>
          <p>- So với hợp đồng: {blank}</p>
          <p><b>e) Kết quả thí nghiệm, kiểm tra, kiểm định, thử nghiệm, chạy thử theo các yêu cầu kỹ thuật theo quy định của thiết kế xây dựng:</b></p>
          <div className="dots" /><div className="dots" />
          <p><b>f) Tuân thủ các quy định của pháp luật về phòng cháy và chữa cháy, bảo vệ môi trường trong thi công xây dựng công trình và quy định của pháp luật chuyên ngành khác có liên quan</b></p>
          <div className="dots" />
          <p><b>g) Các ý kiến khác nếu có:</b></p>
          <div className="dots" /><div className="dots" />

          <h3>5. Kết luận :</h3>
          <table className="conclude-table">
            <tbody>
              <tr>
                <td>
                  - Chấp thuận nghiệm thu hoàn thành hạng mục công trình hoặc công trình xây dựng để chuyển giai đoạn thi công
                </td>
                <td style={{ width: 40, textAlign: "center" }}>{BOX}</td>
              </tr>
              <tr>
                <td>- Không đồng ý nghiệm thu</td>
                <td style={{ width: 40, textAlign: "center" }}>{BOX}</td>
              </tr>
            </tbody>
          </table>

          <h3>6. Chữ ký các thành phần trực tiếp tham gia nghiệm thu:</h3>
          <div style={{ display: "grid", justifyItems: "center" }}>{stamp("CHỦ ĐẦU TƯ")}</div>
          <div className="complete-sign-row">
            {stamp("TƯ VẤN THIẾT KẾ")}
            {stamp("TƯ VẤN GIÁM SÁT")}
          </div>
          <div className="complete-sign-row">
            {stamp("NHÀ THẦU CHÍNH")}
            {stamp("NHÀ THẦU PHỤ")}
          </div>

          <table className="sign-roster">
            <thead>
              <tr>
                <th>Chức vụ</th>
                <th>Họ và tên</th>
                <th>Chữ ký</th>
              </tr>
            </thead>
            <tbody>
              {["Trưởng ban Ban QLDA", "Giám sát trưởng", "Chủ trì thiết kế", "Chỉ huy trưởng nhà thầu chính", "Chỉ huy trưởng nhà thầu phụ"].map((role) => (
                <tr key={role}>
                  <td>{role}</td>
                  <td />
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </>
    );
  })}</>;
}
