"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "@/components/icons";
import {
  CHECKLIST_CONCLUSIONS,
  MFBW_PRE_SHIFT_SECTIONS,
  type ChecklistMark,
} from "@/data/machinePreShiftChecklist";
import {
  formatChecklistDate,
  formatChecklistDateTime,
  type PreShiftChecklistRecord,
} from "@/lib/machinePreShiftChecklistDb";

type MachinePreShiftChecklistPrintProps = {
  open: boolean;
  record: PreShiftChecklistRecord | null;
  onClose: () => void;
  onPrint: () => void;
};

function Box({ checked }: { checked: boolean }) {
  return <span className={`box${checked ? " on" : ""}`}>{checked ? "✓" : ""}</span>;
}

function markBoxes(mark: ChecklistMark | "" | undefined) {
  return (
    <span className="marks">
      <span className="mark">
        <Box checked={mark === "D"} /> Đ
      </span>
      <span className="mark">
        <Box checked={mark === "K"} /> K
      </span>
      <span className="mark">
        <Box checked={mark === "NA"} /> NA
      </span>
    </span>
  );
}

export default function MachinePreShiftChecklistPrint({
  open,
  record,
  onClose,
  onPrint,
}: MachinePreShiftChecklistPrintProps) {
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

  if (!open || !record || typeof document === "undefined") return null;

  const failCodes = MFBW_PRE_SHIFT_SECTIONS.flatMap((section) =>
    section.items.filter((item) => record.results[item.ma]?.result === "K").map((item) => item.ma),
  );
  const failCodeText = record.failItemCode || failCodes.join(", ");
  const c04Temp = record.results.C04?.nhietDo?.trim();

  return createPortal(
    <div id="mfbw-checklist-print" role="dialog" aria-modal="true" aria-labelledby="mfbw-checklist-print-title">
      <style>{PRINT_CSS}</style>
      <div className="print-toolbar">
        <div>
          <div id="mfbw-checklist-print-title" className="toolbar-title">
            Checklist kiểm tra máy hàn MFBW trước ca
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
              </div>
            </div>
            <div className="head-meta">
              {record.machineCode} · {record.shift} · {formatChecklistDate(record.date)}
            </div>
          </header>

          <h1 className="form-title">
            CHECKLIST KIỂM TRA
            <br />
            MÁY HÀN MFBW TRƯỚC CA
          </h1>

          <div className="project-line">
            DỰ ÁN: <b>{record.projectName || "................................................................"}</b>
          </div>
          <div className="project-line">
            ĐỊA ĐIỂM: <b>{record.location || "................................................................"}</b>
          </div>

          <div className="meta-grid">
            <div>
              Ngày: <b>{formatChecklistDate(record.date)}</b>
            </div>
            <div>
              Ca: <b>{record.shift}</b>
            </div>
            <div>
              Mã máy: <b>{record.machineCode}</b>
            </div>
            <div>
              Lý trình vị trí: <b>{record.chainage || "...................."}</b>
            </div>
          </div>
          <div className="meta-grid two">
            <div>
              Trưởng ca: <b>{record.shiftLeadName || "................................"}</b>
            </div>
            <div>
              Người kiểm tra: phân công riêng theo từng nhóm A–E
            </div>
          </div>

          <p className="legend">
            Đánh dấu: Đ = Đạt; K = Không đạt; NA = Không áp dụng (phải nêu lý do). Mọi mục bắt buộc phải đạt trước khi vận
            hành.
          </p>

          <table className="main-table">
            <colgroup>
              <col className="c-ma" />
              <col className="c-ten" />
              <col className="c-tieu" />
              <col className="c-mark" />
              <col className="c-note" />
              <col className="c-inspector" />
            </colgroup>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Hạng mục kiểm tra</th>
                <th>Tiêu chí đánh giá</th>
                <th>Đ / K / NA</th>
                <th>Ghi chú</th>
                <th>Người kiểm tra</th>
              </tr>
            </thead>
            <tbody>
              {MFBW_PRE_SHIFT_SECTIONS.map((section) => (
                <FragmentSection key={section.id} letter={section.letter} title={section.title}>
                  {section.items.map((item, index) => {
                    const result = record.results[item.ma];
                    const noteParts = [
                      result?.note?.trim() || "",
                      item.extra === "nhietDo" && c04Temp ? `${c04Temp} °C` : "",
                    ].filter(Boolean);
                    const inspector =
                      record.sectionInspectors?.[section.id]?.name.trim() || record.inspectorName || "";
                    return (
                      <tr key={item.ma}>
                        <td className="ma">{item.ma}</td>
                        <td className="left">{item.ten}</td>
                        <td className="left tieu">
                          {item.tieuChi}
                          {item.extra === "nhietDo" ? ` ${c04Temp || "..........."} °C` : ""}
                        </td>
                        <td>{markBoxes(result?.result)}</td>
                        <td className="left note">{noteParts.join(" · ")}</td>
                        {index === 0 && (
                          <td className="inspector" rowSpan={section.items.length}>
                            {inspector || "...................."}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </FragmentSection>
              ))}
            </tbody>
          </table>

          <div className="foot-block">
            <div className="foot-line">
              <b>Lý do không áp dụng (NA):</b> {record.naReason || "................................................................"}
            </div>
            <div className="foot-title">XỬ LÝ MỤC KHÔNG ĐẠT</div>
            <div className="fail-grid">
              <div>
                Mã mục: <b>{failCodeText || "............"}</b>
              </div>
              <div>
                Mô tả lỗi: <b>{record.failDescription || "................................"}</b>
              </div>
            </div>
            <div className="fail-grid">
              <div>
                Biện pháp khắc phục: <b>{record.remedy || "................................"}</b>
              </div>
              <div>
                Kiểm tra lại lúc: <b>{formatChecklistDateTime(record.recheckAt) || "............"}</b>
              </div>
            </div>
            <div className="conclusion">
              <span className="conclusion-label">KẾT LUẬN:</span>
              {CHECKLIST_CONCLUSIONS.map((item) => (
                <span key={item.id} className="conclusion-opt">
                  <Box checked={record.conclusion === item.id} /> {item.label.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </article>
      </div>
    </div>,
    document.body,
  );
}

function FragmentSection({
  letter,
  title,
  children,
}: {
  letter: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <tr className="section-row">
        <td colSpan={6} className="section-cell">
          {letter}. {title}
        </td>
      </tr>
      {children}
    </>
  );
}

const PRINT_CSS = `
#mfbw-checklist-print {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  background: #e2e8f0;
  color: #000;
}
#mfbw-checklist-print .print-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #cbd5e1;
}
#mfbw-checklist-print .toolbar-title {
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
}
#mfbw-checklist-print .toolbar-sub {
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
}
#mfbw-checklist-print .toolbar-actions {
  display: flex;
  gap: 8px;
}
#mfbw-checklist-print .btn-print,
#mfbw-checklist-print .btn-close {
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
#mfbw-checklist-print .btn-print {
  border: 0;
  background: #0047ab;
  color: #fff;
}
#mfbw-checklist-print .btn-close {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
}
#mfbw-checklist-print .print-stage {
  flex: 1;
  overflow: auto;
  padding: 16px;
}
#mfbw-checklist-print .print-sheet {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto 24px;
  padding: 8mm 10mm 10mm;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
  font: 9.2pt "Times New Roman", Times, serif;
  font-family: "Times New Roman", Times, serif;
  color: #111;
  box-sizing: border-box;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
#mfbw-checklist-print .print-sheet * {
  font-family: "Times New Roman", Times, serif;
}
#mfbw-checklist-print .doc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8mm;
  padding-bottom: 2.5mm;
  border-bottom: 0.45mm solid #1d4ed8;
}
#mfbw-checklist-print .brand {
  display: flex;
  align-items: center;
  gap: 2.5mm;
}
#mfbw-checklist-print .logo-img {
  width: 11mm;
  height: 11mm;
  object-fit: contain;
}
#mfbw-checklist-print .brand-kicker {
  font-size: 6.5pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #0047ab;
  font-family: "Times New Roman", Times, serif;
}
#mfbw-checklist-print .brand-name {
  font-size: 13pt;
  font-weight: 900;
  line-height: 1;
  color: #0b1f4d;
  letter-spacing: 0.06em;
  font-family: "Times New Roman", Times, serif;
}
#mfbw-checklist-print .head-meta {
  font-family: "Times New Roman", Times, serif;
  font-size: 8pt;
  font-weight: 700;
  color: #334155;
}
#mfbw-checklist-print .form-title {
  margin: 4.5mm 0 3mm;
  text-align: center;
  font-size: 16pt;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: 0.04em;
  color: #1e3a8a;
}
#mfbw-checklist-print .project-line {
  text-align: center;
  font-size: 10pt;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  line-height: 1.45;
}
#mfbw-checklist-print .meta-grid {
  display: grid;
  grid-template-columns: 1fr 0.7fr 1fr 1.3fr;
  gap: 1.5mm 4mm;
  margin-top: 3.5mm;
  font-size: 10pt;
}
#mfbw-checklist-print .meta-grid.two {
  grid-template-columns: 1fr 1fr;
  margin-top: 1.6mm;
}
#mfbw-checklist-print .legend {
  margin: 2.4mm 0 2mm;
  font-size: 8.5pt;
  font-style: italic;
}
#mfbw-checklist-print table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
#mfbw-checklist-print th,
#mfbw-checklist-print td {
  border: 0.32mm solid #111;
  padding: 1.1mm 1.2mm;
  vertical-align: middle;
}
#mfbw-checklist-print thead th {
  font-family: "Times New Roman", Times, serif;
  font-size: 8.5pt;
  font-weight: 800;
  text-align: center;
  background: #eef3fb;
}
#mfbw-checklist-print .c-ma { width: 11mm; }
#mfbw-checklist-print .c-ten { width: 36mm; }
#mfbw-checklist-print .c-tieu { width: 62mm; }
#mfbw-checklist-print .c-mark { width: 26mm; }
#mfbw-checklist-print .c-note { width: 24mm; }
#mfbw-checklist-print .c-inspector { width: 28mm; }
#mfbw-checklist-print .inspector {
  text-align: center;
  font-size: 8pt;
  font-weight: 700;
  line-height: 1.25;
}
#mfbw-checklist-print .ma {
  text-align: center;
  font-family: "Times New Roman", Times, serif;
  font-weight: 800;
  font-size: 8.5pt;
}
#mfbw-checklist-print .left { text-align: left; }
#mfbw-checklist-print .tieu { font-size: 8.4pt; }
#mfbw-checklist-print .note { font-size: 8pt; }
#mfbw-checklist-print .section-row td {
  background: #dbe7f8 !important;
  font-family: "Times New Roman", Times, serif;
  font-weight: 800;
  font-size: 8.6pt;
  letter-spacing: 0.03em;
}
#mfbw-checklist-print .marks {
  display: flex;
  justify-content: space-between;
  gap: 0.6mm;
  font-family: "Times New Roman", Times, serif;
  font-size: 7.6pt;
  font-weight: 700;
}
#mfbw-checklist-print .mark {
  display: inline-flex;
  align-items: center;
  gap: 0.5mm;
}
#mfbw-checklist-print .box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.4mm;
  height: 3.4mm;
  border: 0.28mm solid #111;
  font-size: 7pt;
  font-weight: 900;
  line-height: 1;
}
#mfbw-checklist-print .box.on {
  background: #111;
  color: #fff;
}
#mfbw-checklist-print .foot-block {
  margin-top: 3mm;
  font-size: 10pt;
}
#mfbw-checklist-print .foot-line {
  margin-bottom: 2mm;
}
#mfbw-checklist-print .foot-title {
  font-family: "Times New Roman", Times, serif;
  font-weight: 800;
  letter-spacing: 0.04em;
  margin: 1.5mm 0 1.2mm;
}
#mfbw-checklist-print .fail-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 1.5mm 5mm;
  margin-bottom: 1.4mm;
}
#mfbw-checklist-print .conclusion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3.5mm;
  margin-top: 2.5mm;
  font-family: "Times New Roman", Times, serif;
  font-weight: 800;
  font-size: 9.5pt;
}
#mfbw-checklist-print .conclusion-label {
  letter-spacing: 0.04em;
}
#mfbw-checklist-print .conclusion-opt {
  display: inline-flex;
  align-items: center;
  gap: 1.2mm;
  font-weight: 700;
}
@media print {
  @page { size: A4 portrait; margin: 8mm 9mm; }
  html, body {
    background: #fff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body:has(#mfbw-checklist-print) > :not(#mfbw-checklist-print) {
    display: none !important;
  }
  #mfbw-checklist-print {
    position: static;
    inset: auto;
    display: block;
    background: #fff;
    overflow: visible;
  }
  #mfbw-checklist-print .print-toolbar { display: none !important; }
  #mfbw-checklist-print .print-stage { display: contents; }
  #mfbw-checklist-print .print-sheet {
    width: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    box-shadow: none;
  }
}
@media screen {
  #mfbw-checklist-print .print-sheet { zoom: 0.92; }
}
`;
