"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "@/components/icons";
import {
  formatStressNumber,
  releaseMethodLabel,
  type StressInput,
  type StressResult,
} from "@lwr/lib/stress-release";
import type { BufferGapRow } from "@lwr/lib/buffer-gap";
import { BufferGapTable } from "./BufferGapTable";

export type StressPrintRow = [string, number | string | null, string];

type StressReleasePrintProps = {
  open: boolean;
  modeLabel: string;
  buffer: boolean;
  rollers: boolean;
  segmentId?: string;
  railLabel: string;
  input: StressInput;
  inputRows: StressPrintRow[];
  tension: StressPrintRow[];
  compression: StressPrintRow[];
  rows: StressPrintRow[];
  gapRows: BufferGapRow[];
  notices: string[];
  result: StressResult;
  onClose: () => void;
  onPrint: () => void;
};

function cellValue(value: number | string | null, unit: string) {
  if (value === null) return "Không áp dụng";
  if (typeof value === "string") return unit ? `${value} ${unit}` : value;
  return `${formatStressNumber(value)} ${unit}`.trim();
}

export function StressReleasePrint({
  open,
  modeLabel,
  buffer,
  segmentId,
  railLabel,
  input,
  inputRows,
  tension,
  compression,
  rows,
  gapRows,
  notices,
  result,
  onClose,
  onPrint,
}: StressReleasePrintProps) {
  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const stamp = (() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  })();

  const extraLimits: StressPrintRow[] = [
    ["Giới hạn trên nhiệt độ khóa ray thiết kế", result.lockTempUpper, "°C"],
    ["Giới hạn dưới nhiệt độ khóa ray thiết kế", result.lockTempLower, "°C"],
  ];
  const offsetIndex = inputRows.findIndex(([label]) => String(label).includes("Biên độ khóa"));
  const withLimits = offsetIndex >= 0
    ? [...inputRows.slice(0, offsetIndex + 1), ...extraLimits, ...inputRows.slice(offsetIndex + 1)]
    : [...inputRows, ...extraLimits];
  const printInputs: StressPrintRow[] = [
    ...withLimits,
  ];

  return createPortal(
    <div id="stress-release-print" role="dialog" aria-modal="true" aria-labelledby="stress-release-print-title">
      <style>{PRINT_CSS}</style>
      <div className="print-toolbar">
        <div>
          <div id="stress-release-print-title" className="toolbar-title">
            Bảng tính toán giải tỏa ứng suất {railLabel}
          </div>
          <div className="toolbar-sub">Khổ A4 dọc — kiểm tra rồi in hoặc lưu PDF</div>
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={onPrint} className="btn-print">
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
        <article className="print-sheet">
          <header className="doc-head">
            <div className="brand">
              <img src="/logo.png" alt="" className="logo-img" />
              <div>
                <div className="brand-kicker">CÔNG TY CỔ PHẦN CÔNG TRÌNH</div>
                <div className="brand-name">THÀNH PHÁT</div>
                <div className="brand-sub">Hệ thống quản lý hàn ray</div>
              </div>
            </div>
            <div className="head-meta">
              <div>Mẫu {railLabel}</div>
              <div>{stamp}</div>
              {segmentId ? <div>Đoạn: {segmentId}</div> : null}
            </div>
          </header>

          <h1 className="form-title">BẢNG TÍNH TOÁN GIẢI TỎA ỨNG SUẤT</h1>
          <p className="form-sub">
            BẢNG TÍNH {railLabel.toUpperCase()}
            {buffer ? " · KHE HỞ RAY VÙNG ĐỆM" : ""}
          </p>
          <p className="form-method">{modeLabel}</p>

          <div className="meta-grid">
            {segmentId ? (
              <div>
                Đoạn ray: <b>{segmentId}</b>
              </div>
            ) : (
              <div>
                Đoạn ray: <b>................................</b>
              </div>
            )}
            <div>
              Phương pháp: <b>{modeLabel}</b>
            </div>
            <div>Loại ray: <b>{railLabel}</b></div>
          </div>
          <p className="legend">
            Ray trái/phải của tuyến nhìn theo chiều lý trình tăng. L₁/L₂: phía Km giảm/Km tăng của vị trí kéo trên cùng một ray. Biến dạng tự do xét trên toàn chiều
            dài giải toả; phần Kéo hiển thị chiều dài co, phần Nén hiển thị chiều dài giãn. Lực nhiệt xét theo dải
            khóa đường T ± {formatStressNumber(input.lockTempOffset)}°C.
            {!buffer
              ? ` Phương pháp: ${releaseMethodLabel(result.releaseMethod)}.`
              : ` Khe hở cấu tạo ag = ${formatStressNumber(input.structuralGap)} mm. Giới hạn dưới dùng Δgiãn tại nhiệt độ cao nhất, giới hạn trên dùng Δco tại nhiệt độ thấp nhất.`}
            {result.skipPull && !buffer
              ? ` Nhiệt độ môi trường ≥ ${formatStressNumber(result.skipThreshold)}°C: giải toả tự nhiên, chiều dài kéo = 0.`
              : ""}
          </p>

          <h2 className="section-h">I. Thông số đầu vào</h2>
          <table className="kv-table">
            <tbody>
              {chunkPairs(printInputs).map((pair, index) => (
                <tr key={index}>
                  {pair.map(([label, value, unit]) => (
                    <FragmentPair key={String(label)} label={label} value={cellValue(value, unit)} />
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

          <h2 className="section-h">II. Biến dạng nhiệt</h2>
          <div className="thermal-pair">
            <section className="box">
              <h3 className="box-h">Kéo (nhiệt độ giảm)</h3>
              <p className="box-note">Biên độ giảm nhiệt độ lớn nhất</p>
              <table>
                <tbody>
                  {tension.map(([label, value, unit]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      <td>{cellValue(value, unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="box">
              <h3 className="box-h">Nén (nhiệt độ tăng)</h3>
              <p className="box-note">Biên độ tăng nhiệt độ lớn nhất</p>
              <table>
                <tbody>
                  {compression.map(([label, value, unit]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      <td>{cellValue(value, unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          {buffer ? (
            <>
              <h2 className="section-h">III. Khe hở tính toán (dự phòng)</h2>
              <BufferGapTable rows={gapRows} />
            </>
          ) : (
            <>
              <h2 className="section-h">III. Kết quả giải toả</h2>
              <table className="result-table simple">
                <tbody>
                  {rows.map(([label, value, unit]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      <td>{cellValue(value, unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {notices.length > 0 ? (
            <div className="alert">
              {notices.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          ) : null}

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

          <p className="foot">
            Mẫu tính theo Bảng tính toán giải tỏa ứng suất {railLabel} · Dùng cho mục đích kỹ thuật nội bộ · In lúc {stamp}
          </p>
        </article>
      </div>
    </div>,
    document.body,
  );
}

function chunkPairs(rows: StressPrintRow[]) {
  const pairs: StressPrintRow[][] = [];
  for (let i = 0; i < rows.length; i += 2) pairs.push(rows.slice(i, i + 2));
  return pairs;
}

function FragmentPair({ label, value }: { label: string; value: string }) {
  return (
    <>
      <td className="k">{label}</td>
      <td className="v">{value}</td>
    </>
  );
}

const PRINT_CSS = `
#stress-release-print {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  background: #e2e8f0;
  color: #000;
}
#stress-release-print .print-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #cbd5e1;
}
#stress-release-print .toolbar-title {
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
}
#stress-release-print .toolbar-sub {
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
}
#stress-release-print .toolbar-actions { display: flex; gap: 8px; }
#stress-release-print .btn-print,
#stress-release-print .btn-close {
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
#stress-release-print .btn-print { border: 0; background: #7e22ce; color: #fff; }
#stress-release-print .btn-close { border: 1px solid #cbd5e1; background: #fff; color: #334155; }
#stress-release-print .print-stage {
  flex: 1;
  overflow: auto;
  padding: 16px;
}
#stress-release-print .print-sheet {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto 24px;
  padding: 9mm 11mm 11mm;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
  font: 9.2pt "Times New Roman", Times, serif;
  line-height: 1.15;
  color: #111;
  box-sizing: border-box;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
#stress-release-print .print-sheet * {
  font-family: "Times New Roman", Times, serif;
}
#stress-release-print .doc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8mm;
  padding-bottom: 2.5mm;
  border-bottom: 0.5mm solid #9333ea;
}
#stress-release-print .brand {
  display: flex;
  align-items: center;
  gap: 2.5mm;
}
#stress-release-print .logo-img {
  width: 12mm;
  height: 12mm;
  object-fit: contain;
}
#stress-release-print .brand-kicker {
  font-size: 6.5pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #7e22ce;
}
#stress-release-print .brand-name {
  font-size: 13.5pt;
  font-weight: 900;
  line-height: 1;
  color: #581c87;
  letter-spacing: 0.06em;
}
#stress-release-print .brand-sub {
  margin-top: 0.6mm;
  font-size: 7.5pt;
  color: #475569;
}
#stress-release-print .head-meta {
  text-align: right;
  font-size: 8pt;
  font-weight: 700;
  color: #334155;
  line-height: 1.45;
}
#stress-release-print .form-title {
  margin: 4mm 0 1mm;
  text-align: center;
  font-size: 15.5pt;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #6b21a8;
}
#stress-release-print .form-sub {
  margin: 0;
  text-align: center;
  font-size: 10.5pt;
  font-weight: 800;
  letter-spacing: 0.04em;
}
#stress-release-print .form-method {
  margin: 0.8mm 0 0;
  text-align: center;
  font-size: 10pt;
  font-weight: 700;
  color: #7e22ce;
}
#stress-release-print .meta-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  gap: 1.2mm 4mm;
  margin-top: 3.5mm;
  font-size: 9.5pt;
}
#stress-release-print .legend {
  margin: 2mm 0 3mm;
  font-size: 8pt;
  font-style: italic;
  color: #334155;
  line-height: 1.4;
}
#stress-release-print .section-h {
  margin: 2.5mm 0 1.2mm;
  padding: 1.2mm 2mm;
  background: #f3e8ff;
  border-left: 1.1mm solid #9333ea;
  font-size: 10pt;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6b21a8;
}
#stress-release-print table {
  width: 100%;
  border-collapse: collapse;
}
#stress-release-print .kv-table td {
  border: 0.28mm solid #c4a3dc;
  padding: 0.65mm 2mm;
  vertical-align: middle;
  font-size: 8.6pt;
}
#stress-release-print .kv-table .k {
  width: 28%;
  background: #faf5ff;
  color: #334155;
}
#stress-release-print .kv-table .v {
  width: 22%;
  font-weight: 700;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
#stress-release-print .kv-table .empty {
  background: #fff;
  border-color: #fff;
}
#stress-release-print .thermal-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3mm;
}
#stress-release-print .box {
  border: 0.32mm solid #a477bd;
  overflow: hidden;
}
#stress-release-print .box-h {
  margin: 0;
  padding: 1.6mm 2.2mm 0.4mm;
  background: #6b21a8;
  color: #fff;
  font-size: 9pt;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
#stress-release-print .box-note {
  margin: 0;
  padding: 0 2.2mm 1.4mm;
  background: #6b21a8;
  color: #e9d5ff;
  font-size: 7.5pt;
  font-style: italic;
}
#stress-release-print .box table { width: 100%; }
#stress-release-print .box th,
#stress-release-print .box td {
  padding: 1mm 2.2mm;
  border-bottom: 0.2mm solid #e9d5ff;
  font-size: 8.6pt;
}
#stress-release-print .box tr:last-child th,
#stress-release-print .box tr:last-child td { border-bottom: 0; }
#stress-release-print .box th {
  font-weight: 400;
  text-align: left;
  color: #334155;
}
#stress-release-print .box td {
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
#stress-release-print .result-table th,
#stress-release-print .result-table td {
  border: 0.28mm solid #a477bd;
  padding: 0.7mm 2mm;
  font-size: 8.8pt;
}
#stress-release-print .result-table thead th {
  background: #f3e8ff;
  font-weight: 800;
  text-align: center;
}
#stress-release-print .result-table td { text-align: right; font-variant-numeric: tabular-nums; }
#stress-release-print .result-table td.left,
#stress-release-print .result-table.simple th {
  text-align: left;
  font-weight: 400;
  width: 68%;
}
#stress-release-print .result-table.simple td {
  font-weight: 700;
  width: 32%;
}
#stress-release-print .buffer-gap-table td { text-align: center; }
#stress-release-print .buffer-gap-table th[rowspan] { width: 28%; text-align: left; font-weight: 400; }
#stress-release-print .buffer-gap-table tr { break-inside: avoid; }
#stress-release-print .alert {
  margin-top: 3mm;
  padding: 2.2mm 2.8mm;
  border: 0.32mm solid #b45309;
  background: #fffbeb;
  color: #7c2d12;
  font-size: 8pt;
}
#stress-release-print .alert p { margin: 0 0 1mm; }
#stress-release-print .alert p:last-child { margin: 0; }
#stress-release-print .sign-row {
  break-inside: avoid;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8mm;
  margin-top: 5mm;
}
#stress-release-print .sign { text-align: center; font-size: 9pt; }
#stress-release-print .sign .role {
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
#stress-release-print .sign .hint {
  margin-top: 0.6mm;
  font-size: 8pt;
  color: #64748b;
}
#stress-release-print .sign .line {
  margin: 10mm 4mm 0;
  border-top: 0.25mm solid #7e22ce;
  padding-top: 1.4mm;
  font-size: 7.5pt;
  color: #94a3b8;
}
#stress-release-print .foot {
  margin-top: 5mm;
  padding-top: 2mm;
  border-top: 0.2mm solid #d8b4fe;
  font-size: 7.5pt;
  color: #64748b;
  text-align: center;
}
@media print {
  @page { size: A4 portrait; margin: 8mm 9mm; }
  html, body {
    background: #fff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body:has(#stress-release-print) > :not(#stress-release-print) {
    display: none !important;
  }
  #stress-release-print {
    position: static;
    inset: auto;
    display: block;
    background: #fff;
    overflow: visible;
  }
  #stress-release-print .print-toolbar { display: none !important; }
  #stress-release-print .print-stage { display: contents; }
  #stress-release-print .print-sheet {
    width: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    box-shadow: none;
  }
}
@media screen {
  #stress-release-print .print-sheet { zoom: 0.92; }
}
`;
