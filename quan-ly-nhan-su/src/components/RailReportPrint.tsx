"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "@/components/icons";
import PrintFrame from "@/components/PrintFrame";

export type RailReportPrintRow = {
  key: string;
  maLisp: string;
  maHienTruong: string;
  lyTrinh: string;
  lyTrinhCuoi: string;
  ngayHan: string;
  tinhTrang: string;
  /** Mối hàn bổ sung sau: số thứ tự nhỏ hơn nhưng hàn muộn hơn các mối có số lớn hơn → in chữ đỏ. */
  late?: boolean;
};

/** Một hàng của bảng ngang: thanh ray trái (HT/TT) bên trái, ray phải (HP/TP) bên phải, cùng số thứ tự thanh. */
export type RailReportPair = { key: string; left: RailReportPrintRow | null; right: RailReportPrintRow | null };

export type RailReportPrintPayload = {
  pairs: RailReportPair[];
  title: string;
  summary: string[];
  projectLabel: string;
  dateLabel: string;
  leftLabel: string;
  rightLabel: string;
};

/**
 * Mẫu in "BẢNG TỔNG HỢP MỐI HÀN THEO THANH RAY".
 * Nghe sự kiện `rail-report-print` từ màn hình báo cáo; mở ở dạng dialog, in qua PrintFrame (A4 ngang, hai ray trái / phải cạnh nhau).
 */
export default function RailReportPrint({ payload, onClose }: {
  payload: RailReportPrintPayload | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!payload) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [payload, onClose]);

  if (!payload || typeof document === "undefined") return null;

  const { pairs, title, summary, projectLabel, dateLabel, leftLabel, rightLabel } = payload;

  return createPortal(
    <div id="rail-report-print" role="dialog" aria-modal="true" aria-label={title}>
      <style>{PRINT_CSS}</style>
      <div className="print-toolbar">
        <div>
          <div className="toolbar-title">{title}</div>
          <div className="toolbar-sub">
            {projectLabel} · {dateLabel} · {pairs.length.toLocaleString("vi-VN")} vị trí thanh ray
          </div>
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={() => window.print()} className="btn-print">
            <Printer size={16} weight="bold" aria-hidden />
            In / Lưu PDF
          </button>
          <button type="button" onClick={onClose} className="btn-close">
            <X size={16} weight="bold" aria-hidden />
            Đóng
          </button>
        </div>
      </div>

      <article className="sheet">
        <PrintFrame top="10mm" bottom="10mm" left="10mm" right="10mm">
          <header className="doc-header">
            <div className="brand-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Thành Phát" className="brand-logo" />
              <div className="brand-text">
                <p className="company">CÔNG TY CỔ PHẦN CÔNG TRÌNH THÀNH PHÁT</p>
                <p className="company-en">THANH PHAT CONSTRUCTION WORK JOINT STOCK COMPANY</p>
              </div>
            </div>
            <h1>{title}</h1>
            <p className="meta">Dự án: {projectLabel}</p>
          </header>
          <div className="summary">{summary.map((line) => <p key={line}>{line}</p>)}</div>

          <table className="rail-table">
            <colgroup>
              <col className="c-ma" /><col className="c-ht" /><col className="c-km" /><col className="c-km" /><col className="c-ngay" /><col className="c-tt" />
              <col className="c-ma" /><col className="c-ht" /><col className="c-km" /><col className="c-km" /><col className="c-ngay" /><col className="c-tt" />
            </colgroup>
            <thead>
              <tr>
                <th colSpan={6} className="side-head">{leftLabel}</th>
                <th colSpan={6} className="side-head">{rightLabel}</th>
              </tr>
              <tr>
                {[0, 1].flatMap((side) => [
                  <th key={`a${side}`}>Tên mối hàn theo thiết kế</th>,
                  <th key={`b${side}`}>Tên mối hàn tại hiện trường</th>,
                  <th key={`c${side}`}>Lý trình đầu</th>,
                  <th key={`d${side}`}>Lý trình cuối</th>,
                  <th key={`e${side}`}>Ngày hàn</th>,
                  <th key={`f${side}`}>Tình trạng</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {pairs.map((pair) => (
                <tr key={pair.key}>
                  {[pair.left, pair.right].flatMap((row, side) => row ? [
                    <td key={`a${side}`} className={`mono${row.late ? " late" : ""}`}>{row.maLisp}</td>,
                    <td key={`b${side}`} className={`mono${row.late ? " late" : ""}`}>{row.maHienTruong}</td>,
                    <td key={`c${side}`} className={`mono center${row.late ? " late" : ""}`}>{row.lyTrinh}</td>,
                    <td key={`d${side}`} className={`mono center${row.late ? " late" : ""}`}>{row.lyTrinhCuoi}</td>,
                    <td key={`e${side}`} className={`center${row.late ? " late" : ""}`}>{row.ngayHan}</td>,
                    <td key={`f${side}`} className={`center${row.late ? " late" : ""}`}>{row.tinhTrang}</td>,
                  ] : [0, 1, 2, 3, 4, 5].map((n) => <td key={`x${side}${n}`}>&nbsp;</td>))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="late-note">Chữ <span className="late">màu đỏ</span>: mối hàn bổ sung sau (hàn muộn hơn các mối có số thứ tự lớn hơn); ô trống: mối chưa hàn.</p>

        </PrintFrame>
      </article>
    </div>,
    document.body,
  );
}

const PRINT_CSS = `
#rail-report-print { position: fixed; inset: 0; z-index: 2000; background: #e2e8f0; overflow: auto; color: #111; font-family: system-ui, sans-serif; }
#rail-report-print .print-toolbar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #cbd5e1; padding: 10px 14px; }
#rail-report-print .toolbar-title { font-size: 14px; font-weight: 700; color: #0f172a; }
#rail-report-print .toolbar-sub { font-size: 12px; color: #475569; margin-top: 2px; }
#rail-report-print .toolbar-actions { display: flex; gap: 8px; }
#rail-report-print .btn-print, #rail-report-print .btn-close { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
#rail-report-print .btn-print { background: #0047AB; color: #fff; border: 0; }
#rail-report-print .btn-close { background: #fff; color: #334155; border: 1px solid #cbd5e1; }
#rail-report-print .summary { margin: 0 0 6px; font-size: 10pt; font-weight: 700; }
#rail-report-print .summary p { margin: 1px 0; }
#rail-report-print .sheet { width: 297mm; box-sizing: border-box; margin: 16px auto; padding: 0; background: #fff; font-family: 'Times New Roman', serif; }
#rail-report-print .doc-header { text-align: center; margin-bottom: 6px; }
#rail-report-print .brand-row { display: flex; align-items: center; gap: 4mm; padding-bottom: 3mm; margin-bottom: 3mm; border-bottom: 1.2pt solid #0047AB; text-align: left; }
#rail-report-print .brand-logo { width: 17mm; height: 17mm; object-fit: contain; flex: none; }
#rail-report-print .brand-text { min-width: 0; }
#rail-report-print .company-en { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.03em; color: #0047AB; margin: 0; }
#rail-report-print .company { font-size: 12pt; font-weight: 700; margin: 0 0 1px; text-transform: uppercase; color: #0047AB; }
#rail-report-print h1 { font-size: 15pt; font-weight: 700; margin: 2mm 0 2px; text-transform: uppercase; }
#rail-report-print .meta { font-size: 9.5pt; margin: 0 0 6px; font-style: italic; }
#rail-report-print table.rail-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; table-layout: fixed; }
#rail-report-print table.rail-table th, #rail-report-print table.rail-table td { border: 0.4pt solid #444; padding: 2.4pt 3pt; vertical-align: middle; overflow-wrap: anywhere; }
#rail-report-print table.rail-table th { background: #eef2f7; font-weight: 700; text-align: center; font-size: 7pt; line-height: 1.2; }
#rail-report-print table.rail-table .center { text-align: center; }
#rail-report-print .late { color: #d00000; font-weight: 700; }
#rail-report-print .late-note { margin: 4px 0 0; font-size: 7.5pt; font-style: italic; }
#rail-report-print table.rail-table .right { text-align: right; }
#rail-report-print table.rail-table .mono { font-family: 'Courier New', monospace; font-size: 7pt; }
#rail-report-print table.rail-table th.side-head { background: #dbe6f5; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.02em; }
#rail-report-print table.rail-table td:nth-child(6) { border-right: 1.2pt solid #444; }
#rail-report-print col.c-ma { width: 7.6%; }
#rail-report-print col.c-ht { width: 9.6%; }
#rail-report-print col.c-km { width: 7.4%; }
#rail-report-print col.c-ngay { width: 6.4%; }
#rail-report-print col.c-tt { width: 7.6%; }
@media print {
  @page { size: A4 landscape; margin: 0; }
  body:has(#rail-report-print) > :not(#rail-report-print) { display: none !important; }
  #rail-report-print { position: static; overflow: visible; background: #fff; }
  #rail-report-print .print-toolbar { display: none; }
  #rail-report-print .sheet { width: auto; margin: 0; padding: 0; }
  #rail-report-print thead { display: table-header-group; }
  #rail-report-print tr { break-inside: avoid; }
  #rail-report-print, #rail-report-print * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;
