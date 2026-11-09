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
  chieuDai: string;
  tinhTrang: string;
  ghiChu: string;
};

export type RailReportPrintPayload = {
  rows: RailReportPrintRow[];
  title: string;
  summary: string[];
  projectLabel: string;
  dateLabel: string;
};

/**
 * Mẫu in "BẢNG TỔNG HỢP MỐI HÀN THEO THANH RAY".
 * Nghe sự kiện `rail-report-print` từ màn hình báo cáo; mở ở dạng dialog, in qua PrintFrame (A4 dọc).
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

  const { rows, title, summary, projectLabel, dateLabel } = payload;

  return createPortal(
    <div id="rail-report-print" role="dialog" aria-modal="true" aria-label={title}>
      <style>{PRINT_CSS}</style>
      <div className="print-toolbar">
        <div>
          <div className="toolbar-title">{title}</div>
          <div className="toolbar-sub">
            {projectLabel} · {dateLabel} · {rows.length.toLocaleString("vi-VN")} thanh ray
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
        <PrintFrame top="12mm" bottom="12mm" left="12mm" right="12mm">
          <header className="doc-header">
            <p className="company">CÔNG TY CỔ PHẦN CÔNG TRÌNH THÀNH PHÁT</p>
            <h1>{title}</h1>
            <p className="meta">Dự án: {projectLabel}</p>
          </header>
          <div className="summary">{summary.map((line) => <p key={line}>{line}</p>)}</div>

          <table className="rail-table">
            <colgroup>
              <col className="c-ma-lisp" />
              <col className="c-ma-ht" />
              <col className="c-km" />
              <col className="c-km" />
              <col className="c-ngay" />
              <col className="c-dai" />
              <col className="c-tt" />
            </colgroup>
            <thead>
              <tr>
                <th>Tên mối hàn theo thiết kế</th>
                <th>Tên mối hàn tại hiện trường</th>
                <th>Lý trình đầu</th>
                <th>Lý trình cuối</th>
                <th>Ngày hàn</th>
                <th>Chiều dài thanh ray (mm)</th>
                <th>Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="mono">{row.maLisp}</td>
                  <td className="mono">{row.maHienTruong}</td>
                  <td className="mono center">{row.lyTrinh}</td>
                  <td className="mono center">{row.lyTrinhCuoi}</td>
                  <td className="center">{row.ngayHan}</td>
                  <td className="mono right">{row.chieuDai}</td>
                  <td className="center">{row.tinhTrang}</td>
                </tr>
              ))}
            </tbody>
          </table>

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
#rail-report-print .sheet { width: 210mm; box-sizing: border-box; margin: 16px auto; padding: 0; background: #fff; font-family: 'Times New Roman', serif; }
#rail-report-print .doc-header { text-align: center; margin-bottom: 6px; }
#rail-report-print .company { font-size: 11pt; font-weight: 700; margin: 0 0 2px; text-transform: uppercase; }
#rail-report-print h1 { font-size: 14pt; font-weight: 700; margin: 0 0 2px; text-transform: uppercase; }
#rail-report-print .meta { font-size: 9.5pt; margin: 0 0 6px; font-style: italic; }
#rail-report-print table.rail-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; table-layout: fixed; }
#rail-report-print table.rail-table th, #rail-report-print table.rail-table td { border: 0.4pt solid #444; padding: 2.4pt 3pt; vertical-align: middle; overflow-wrap: anywhere; }
#rail-report-print table.rail-table th { background: #eef2f7; font-weight: 700; text-align: center; font-size: 7pt; line-height: 1.2; }
#rail-report-print table.rail-table .center { text-align: center; }
#rail-report-print table.rail-table .right { text-align: right; }
#rail-report-print table.rail-table .mono { font-family: 'Courier New', monospace; font-size: 7pt; }
#rail-report-print col.c-ma-lisp { width: 16%; }
#rail-report-print col.c-ma-ht { width: 22%; }
#rail-report-print col.c-km { width: 12%; }
#rail-report-print col.c-ngay { width: 11%; }
#rail-report-print col.c-dai { width: 14%; }
#rail-report-print col.c-tt { width: 13%; }
@media print {
  @page { size: A4 portrait; margin: 0; }
  body:has(#rail-report-print) > :not(#rail-report-print) { display: none !important; }
  #rail-report-print { position: static; overflow: visible; background: #fff; }
  #rail-report-print .print-toolbar { display: none; }
  #rail-report-print .sheet { width: auto; margin: 0; padding: 0; }
  #rail-report-print thead { display: table-header-group; }
  #rail-report-print tr { break-inside: avoid; }
  #rail-report-print, #rail-report-print * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;
