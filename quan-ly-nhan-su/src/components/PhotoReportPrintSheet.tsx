"use client";

import type { PhotoReport } from "@/lib/photoReportDb";

/** Có nội dung đáng in (ảnh / ghi chú / tiêu đề). */
export function photoReportHasContent(report: PhotoReport | null | undefined): boolean {
  if (!report) return false;
  if (report.goiThau.trim() || report.hangMuc.trim()) return true;
  return report.items.some((item) => item.anh || item.noiDung.trim());
}

const SHEET_CSS = `
.photo-report-sheet {
  width: 210mm;
  min-height: 297mm;
  padding: 12mm;
  box-sizing: border-box;
  background: #fff;
  color: #000;
  font: 13px/1.5 "Times New Roman", Times, serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.photo-report-sheet .photo-head {
  text-align: center;
  font-weight: 700;
  text-transform: uppercase;
}
.photo-report-sheet .photo-title {
  margin: 8px 0 0;
  font-size: 18px;
  font-weight: 800;
}
.photo-report-sheet .photo-date {
  font-size: 12px;
  font-weight: 400;
  text-transform: none;
}
.photo-report-sheet .photo-table {
  width: 100%;
  margin-top: 12px;
  border-collapse: collapse;
  table-layout: fixed;
}
.photo-report-sheet .photo-table td {
  border: 1px solid #000;
  padding: 6px;
  vertical-align: top;
  text-align: left;
  font-weight: 400;
}
.photo-report-sheet .photo-cell-img {
  height: 62mm;
  text-align: center;
  vertical-align: middle;
}
.photo-report-sheet .photo-cell-img img {
  display: block;
  margin: 0 auto;
  max-height: 58mm;
  max-width: 100%;
  object-fit: contain;
}
`;

type PhotoReportPrintSheetProps = {
  projectName: string;
  date: string;
  report: PhotoReport;
  className?: string;
};

/** Một trang mẫu báo cáo ảnh (A4 dọc) — dùng chung khi in cùng báo cáo ngày. */
export default function PhotoReportPrintSheet({
  projectName,
  date,
  report,
  className = "",
}: PhotoReportPrintSheetProps) {
  const printItems = report.items.length % 2 ? [...report.items, { id: "pad", noiDung: "", anh: "" }] : report.items;
  const rows = Array.from({ length: printItems.length / 2 }, (_, i) => printItems.slice(i * 2, i * 2 + 2));
  const [y, m, d] = date.split("-");

  return (
    <article className={`photo-report-sheet print-sheet photo-sheet ${className}`.trim()}>
      <style>{SHEET_CSS}</style>
      <div className="photo-head">
        <div>Dự án: {projectName}</div>
        <div>{report.goiThau}</div>
        <div>Hạng mục: {report.hangMuc}</div>
        <h2 className="photo-title">Báo cáo ảnh</h2>
        <div className="photo-date">
          Ngày {d} tháng {m} năm {y}
        </div>
      </div>
      <table className="photo-table">
        <tbody>
          {rows.flatMap((pair, i) => [
            <tr key={`n${i}`}>
              {pair.map((it, j) => (
                <td key={j} className="photo-cell-note">
                  <b>Nội dung: </b>
                  {it.noiDung}
                </td>
              ))}
            </tr>,
            <tr key={`a${i}`}>
              {pair.map((it, j) => (
                <td key={j} className="photo-cell-img">
                  {it.anh ? <img src={it.anh} alt="" /> : null}
                </td>
              ))}
            </tr>,
          ])}
        </tbody>
      </table>
    </article>
  );
}
