"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import PrintFrame from "@/components/PrintFrame";
import { Printer, X } from "@/components/icons";

export type Tb15PrintSection = {
  heading: string;
  note?: string;
  pairs?: [string, string][];
  table?: { headers: string[]; rows: string[][] };
};

export type Tb15PrintPage = {
  kicker: string;
  title: string;
  subtitle?: string;
  sections: Tb15PrintSection[];
};

function stampNow() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
}

function chunkPairs(rows: [string, string][]) {
  const pairs: [string, string][][] = [];
  for (let i = 0; i < rows.length; i += 2) pairs.push(rows.slice(i, i + 2));
  return pairs;
}

/** Tờ A4 kiểu bảng tính giải tỏa ứng suất: một article cho mỗi sheet. */
export function Tb15SheetPrint({
  pages,
  onClose,
}: {
  pages: Tb15PrintPage[];
  onClose: () => void;
}) {
  const stamp = stampNow();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (typeof document === "undefined" || pages.length === 0) return null;

  return createPortal(
    <div id="tb15-sheet-print" role="dialog" aria-modal="true" aria-labelledby="tb15-sheet-print-title">
      <style>{PRINT_CSS}</style>
      <div className="print-toolbar">
        <div>
          <div id="tb15-sheet-print-title" className="toolbar-title">
            {pages.length === 1 ? pages[0].title : `Bảng tính TB 10015 — ${pages.length} sheet`}
          </div>
          <div className="toolbar-sub">Khổ A4 dọc — kiểm tra rồi in hoặc lưu PDF</div>
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={() => window.print()} className="btn-print">
            <Printer size={16} weight="bold" aria-hidden />
            In
          </button>
          <button type="button" onClick={onClose} className="btn-close" aria-label="Đóng">
            <X size={16} weight="bold" aria-hidden />
            Đóng
          </button>
        </div>
      </div>
      <div className="print-stage">
        {pages.map((page) => (
          <article key={page.kicker} className="print-sheet">
            <PrintFrame>
              <header className="doc-head">
                <div className="brand">
                  {/* Logo in bản in, cùng cách với tờ tính GTUS. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="" className="logo-img" />
                  <div>
                    <div className="brand-kicker">CÔNG TY CỔ PHẦN CÔNG TRÌNH</div>
                    <div className="brand-name">THÀNH PHÁT</div>
                    <div className="brand-kicker">CONSTRUCTION WORK JOINT STOCK COMPANY</div>
                  </div>
                </div>
                <div className="head-meta">
                  <div>TB 10015-2012</div>
                  <div>{page.kicker}</div>
                  <div>{stamp}</div>
                </div>
              </header>
              <h1 className="form-title">{page.title}</h1>
              {page.subtitle ? <p className="form-sub">{page.subtitle}</p> : null}
              {page.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="section-h">{section.heading}</h2>
                  {section.note ? <p className="legend">{section.note}</p> : null}
                  {section.pairs && section.pairs.length > 0 ? (
                    <table className="kv-table">
                      <tbody>
                        {chunkPairs(section.pairs).map((pair, index) => (
                          <tr key={index}>
                            {pair.map(([label, value]) => (
                              <Pair key={label} label={label} value={value} />
                            ))}
                            {pair.length === 1 ? (
                              <>
                                <td className="k empty" />
                                <td className="v empty" />
                              </>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                  {section.table ? (
                    <table className="data-table">
                      <thead>
                        <tr>
                          {section.table.headers.map((header) => <th key={header}>{header}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.rows.length === 0 ? (
                          <tr>
                            <td colSpan={section.table.headers.length}>Không có số liệu.</td>
                          </tr>
                        ) : section.table.rows.map((row, index) => (
                          <tr key={index}>
                            {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </section>
              ))}
              <div className="sign-row">
                <div className="sign">
                  <div className="role">Người lập</div>
                  <div className="hint">(Ký, họ tên)</div>
                  <div className="line">&nbsp;</div>
                </div>
                <div className="sign">
                  <div className="role">Người kiểm tra</div>
                  <div className="hint">(Ký, họ tên)</div>
                  <div className="line">&nbsp;</div>
                </div>
                <div className="sign">
                  <div className="role">Phê duyệt</div>
                  <div className="hint">(Ký, họ tên)</div>
                  <div className="line">&nbsp;</div>
                </div>
              </div>
              <p className="foot">Mẫu tính theo TB 10015-2012 · Dùng cho mục đích kỹ thuật nội bộ · In lúc {stamp}</p>
            </PrintFrame>
          </article>
        ))}
      </div>
    </div>,
    document.body,
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <>
      <td className="k">{label}</td>
      <td className="v">{value}</td>
    </>
  );
}

const PRINT_CSS = `
#tb15-sheet-print {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  background: #e2e8f0;
  color: #000;
}
#tb15-sheet-print .print-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #cbd5e1;
}
#tb15-sheet-print .toolbar-title { font-size: 14px; font-weight: 800; color: #0f172a; }
#tb15-sheet-print .toolbar-sub { margin-top: 2px; font-size: 12px; color: #64748b; }
#tb15-sheet-print .toolbar-actions { display: flex; gap: 8px; }
#tb15-sheet-print .btn-print,
#tb15-sheet-print .btn-close {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
#tb15-sheet-print .btn-print { border: 0; background: #7e22ce; color: #fff; }
#tb15-sheet-print .btn-close { border: 1px solid #cbd5e1; background: #fff; color: #334155; }
#tb15-sheet-print .print-stage { flex: 1; overflow: auto; padding: 16px; }
#tb15-sheet-print .print-sheet {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto 24px;
  padding: 9mm 11mm 11mm;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
  font: 9.2pt "Times New Roman", Times, serif;
  line-height: 1.25;
  color: #111;
  box-sizing: border-box;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
#tb15-sheet-print .print-sheet * { font-family: "Times New Roman", Times, serif; }
#tb15-sheet-print .doc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8mm;
  padding-bottom: 2.5mm;
  border-bottom: 0.5mm solid #9333ea;
}
#tb15-sheet-print .brand { display: flex; align-items: center; gap: 2.5mm; }
#tb15-sheet-print .logo-img { width: 12mm; height: 12mm; object-fit: contain; }
#tb15-sheet-print .brand-kicker { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.04em; color: #7e22ce; }
#tb15-sheet-print .brand-name { font-size: 13.5pt; font-weight: 900; line-height: 1; color: #581c87; letter-spacing: 0.06em; }
#tb15-sheet-print .head-meta { text-align: right; font-size: 8pt; font-weight: 700; color: #334155; line-height: 1.45; }
#tb15-sheet-print .form-title {
  margin: 4mm 0 1mm;
  text-align: center;
  font-size: 14pt;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #6b21a8;
}
#tb15-sheet-print .form-sub { margin: 0 0 2mm; text-align: center; font-size: 10pt; font-weight: 700; }
#tb15-sheet-print .section-h {
  margin: 3mm 0 1.2mm;
  padding: 1.2mm 2mm;
  background: #f3e8ff;
  border-left: 1.1mm solid #9333ea;
  font-size: 10pt;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #6b21a8;
}
#tb15-sheet-print .legend { margin: 0 0 1.5mm; font-size: 8pt; font-style: italic; color: #334155; }
#tb15-sheet-print table { width: 100%; border-collapse: collapse; }
#tb15-sheet-print .kv-table td {
  border: 0.28mm solid #c4a3dc;
  padding: 0.7mm 2mm;
  vertical-align: middle;
  font-size: 8.6pt;
}
#tb15-sheet-print .kv-table .k { width: 28%; background: #faf5ff; color: #334155; }
#tb15-sheet-print .kv-table .v { width: 22%; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
#tb15-sheet-print .kv-table .empty { background: #fff; border-color: #fff; }
#tb15-sheet-print .data-table th,
#tb15-sheet-print .data-table td {
  border: 0.28mm solid #a477bd;
  padding: 0.7mm 1.4mm;
  font-size: 8pt;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
#tb15-sheet-print .data-table th {
  background: #f3e8ff;
  font-weight: 800;
  text-align: center;
}
#tb15-sheet-print .data-table td:first-child,
#tb15-sheet-print .data-table th:first-child { text-align: left; }
#tb15-sheet-print .data-table tr { break-inside: avoid; }
#tb15-sheet-print .sign-row {
  break-inside: avoid;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8mm;
  margin-top: 6mm;
}
#tb15-sheet-print .sign { text-align: center; font-size: 9pt; }
#tb15-sheet-print .sign .role { font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
#tb15-sheet-print .sign .hint { margin-top: 0.6mm; font-size: 8pt; color: #64748b; }
#tb15-sheet-print .sign .line { margin: 12mm 4mm 0; border-top: 0.25mm solid #7e22ce; padding-top: 1.4mm; }
#tb15-sheet-print .foot {
  margin-top: 5mm;
  padding-top: 2mm;
  border-top: 0.2mm solid #d8b4fe;
  font-size: 7.5pt;
  color: #64748b;
  text-align: center;
}
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body:has(#tb15-sheet-print) > :not(#tb15-sheet-print) { display: none !important; }
  #tb15-sheet-print { position: static; inset: auto; display: block; background: #fff; overflow: visible; }
  #tb15-sheet-print .print-toolbar { display: none !important; }
  #tb15-sheet-print .print-stage { display: contents; }
  #tb15-sheet-print .print-sheet {
    width: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    box-shadow: none;
    break-after: page;
  }
  #tb15-sheet-print .print-sheet:last-child { break-after: auto; }
}
@media screen {
  #tb15-sheet-print .print-sheet { zoom: 0.92; }
}
`;
