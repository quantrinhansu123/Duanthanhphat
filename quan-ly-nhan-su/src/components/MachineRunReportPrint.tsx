"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Eye, Printer, X } from "@/components/icons";
import { formatScheduleDate, type MachineRunSchedule } from "@/data/machineAssignments";
import type { DailyFuelRow } from "@/lib/dailyFuelDb";
import PrintFrame from "@/components/PrintFrame";

export type MachineRunReportRow = MachineRunSchedule & {
  oilLiters?: number | null;
  oilUnit?: string;
  oilLow?: boolean;
  oilQuota?: number | null;
};

type MachineRunReportPrintProps = {
  open: boolean;
  rows: MachineRunReportRow[];
  dateFrom: string;
  dateTo: string;
  projectLabel?: string;
  autoPrint?: boolean;
  onClose: () => void;
  onPrint: () => void;
};

function fuelKey(date: string, machineId: string) {
  return `${date}|${machineId}`;
}

function isLiterUnit(unit?: string | null) {
  const value = (unit || "lít").trim().toLowerCase();
  return value === "lít" || value === "lit" || value === "l";
}

export function buildMachineRunReportRows(
  schedules: MachineRunSchedule[],
  fuelRows: DailyFuelRow[],
  oilQuotaByMachine: Map<string, number | null | undefined>,
): MachineRunReportRow[] {
  const fuelMap = new Map<string, DailyFuelRow>();
  for (const row of fuelRows) fuelMap.set(fuelKey(row.date, row.machineId), row);

  return schedules.map((row) => {
    const oil = fuelMap.get(fuelKey(row.date, row.machineId));
    const quota = oilQuotaByMachine.get(row.machineId) ?? null;
    const unit = (oil?.unit || "lít").trim().toLowerCase();
    const isLiter = isLiterUnit(unit);
    const oilLow =
      oil != null && quota != null && isLiter && oil.liters < quota;
    return {
      ...row,
      oilLiters: oil?.liters ?? null,
      oilUnit: oil?.unit || "lít",
      oilLow,
      oilQuota: quota,
    };
  });
}

function rangeLabel(from: string, to: string) {
  if (from && to) return `${formatScheduleDate(from)} – ${formatScheduleDate(to)}`;
  if (from) return `Từ ${formatScheduleDate(from)}`;
  if (to) return `Đến ${formatScheduleDate(to)}`;
  return "Toàn bộ";
}

function resolveProjectLabel(projectLabel: string, rows: MachineRunReportRow[]) {
  const fromProp = projectLabel.trim();
  if (fromProp) return fromProp;
  const names = [...new Set(rows.map((row) => row.projectName?.trim()).filter(Boolean))];
  if (names.length === 0) return "";
  if (names.length <= 2) return names.join("; ");
  return `${names[0]}; ${names[1]} (+${names.length - 2})`;
}

function formatAvgFuel(totalLiters: number, totalWelds: number) {
  if (totalLiters <= 0 || totalWelds <= 0) return "—";
  const avg = totalLiters / totalWelds;
  return `${avg.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} lít/mối`;
}

export default function MachineRunReportPrint({
  open,
  rows,
  dateFrom,
  dateTo,
  projectLabel = "",
  autoPrint = false,
  onClose,
  onPrint,
}: MachineRunReportPrintProps) {
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

  useEffect(() => {
    if (!open || !autoPrint) return;
    const timer = window.setTimeout(() => onPrint(), 80);
    return () => window.clearTimeout(timer);
  }, [open, autoPrint, onPrint]);

  if (!open || typeof document === "undefined") return null;

  const totalWelds = rows.reduce((sum, row) => sum + (row.weldCount ?? 0), 0);
  const totalFailed = rows.reduce((sum, row) => sum + (row.failedWeldCount ?? 0), 0);
  const machineCount = new Set(rows.map((row) => row.machineId)).size;
  const oilByDayMachine = new Map<string, number>();
  for (const row of rows) {
    if (row.oilLiters == null || !isLiterUnit(row.oilUnit)) continue;
    oilByDayMachine.set(fuelKey(row.date, row.machineId), row.oilLiters);
  }
  const totalFuelLiters = [...oilByDayMachine.values()].reduce((sum, liters) => sum + liters, 0);
  const headerProject = resolveProjectLabel(projectLabel, rows);

  return createPortal(
    <div id="machine-run-report-print" role="dialog" aria-modal="true" aria-labelledby="machine-run-report-print-title">
      <style>{PRINT_CSS}</style>
      <div className="print-toolbar">
        <div>
          <div id="machine-run-report-print-title" className="toolbar-title">
            Báo cáo thiết bị / lịch chạy máy
          </div>
          <div className="toolbar-sub">
            Khoảng {rangeLabel(dateFrom, dateTo)}
            {headerProject ? ` · ${headerProject}` : ""} — khổ A4 dọc, xem trước rồi in hoặc lưu PDF
          </div>
        </div>
        <div className="toolbar-actions">
          <span className="btn-view" title="Đang xem trang báo cáo">
            <Eye size={16} weight="bold" aria-hidden />
            Xem báo cáo
          </span>
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
          <PrintFrame>
            <header className="doc-head">
              <div className="brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Thành Phát" className="logo-img" />
                <div>
                  <div className="brand-kicker">CÔNG TY CỔ PHẦN CÔNG TRÌNH</div>
                  <div className="brand-name">THÀNH PHÁT</div>
                  <div className="brand-kicker">CONSTRUCTION WORK JOINT STOCK COMPANY</div>
                </div>
              </div>
              <h1>BÁO CÁO THIẾT BỊ / LỊCH CHẠY MÁY</h1>
              <div className="meta-line">
                <span>
                  Dự án: <b>{headerProject || "—"}</b>
                </span>
                <span>
                  Khoảng ngày: <b>{rangeLabel(dateFrom, dateTo)}</b>
                </span>
                <span>
                  Ngày in: <b>{new Date().toLocaleDateString("vi-VN")}</b>
                </span>
              </div>
            </header>

            <div className="summary-grid">
              <div>
                <div className="summary-label">Lượt chạy</div>
                <div className="summary-value">{rows.length.toLocaleString("vi-VN")}</div>
              </div>
              <div>
                <div className="summary-label">Tổng mối hàn</div>
                <div className="summary-value">{totalWelds.toLocaleString("vi-VN")}</div>
              </div>
              <div>
                <div className="summary-label">Mối lỗi</div>
                <div className="summary-value fail">{totalFailed.toLocaleString("vi-VN")}</div>
              </div>
              <div>
                <div className="summary-label">Số máy</div>
                <div className="summary-value">{machineCount.toLocaleString("vi-VN")}</div>
              </div>
              <div className="summary-wide">
                <div className="summary-label">Tiêu hao NL TB</div>
                <div className="summary-value">{formatAvgFuel(totalFuelLiters, totalWelds)}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Ngày</th>
                  <th>Máy</th>
                  <th>PP hàn</th>
                  <th>Loại mối</th>
                  <th>Ca</th>
                  <th className="num">Mối hàn</th>
                  <th className="num">Lỗi</th>
                  <th>Thợ hàn</th>
                  <th className="num">Mức dầu</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty">
                      Chưa có dữ liệu báo cáo trong khoảng đã chọn.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="num">{index + 1}</td>
                      <td className="mono">{formatScheduleDate(row.date)}</td>
                      <td>
                        <div className="machine-code">{row.machineCode}</div>
                        <div className="machine-name">{row.machineName}</div>
                      </td>
                      <td className="center">{row.weldMethod || "—"}</td>
                      <td>{row.weldType || "—"}</td>
                      <td className="center">{(row.shifts ?? []).join(", ") || "—"}</td>
                      <td className="num">{(row.weldCount ?? 0).toLocaleString("vi-VN")}</td>
                      <td className="num fail">{(row.failedWeldCount ?? 0).toLocaleString("vi-VN")}</td>
                      <td>{row.personInChargeName || "—"}</td>
                      <td className={`num ${row.oilLow ? "fail" : ""}`}>
                        {row.oilLiters == null
                          ? "—"
                          : `${row.oilLiters.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ${row.oilUnit || "lít"}`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </PrintFrame>
        </article>
      </div>
    </div>,
    document.body,
  );
}

const PRINT_CSS = `
#machine-run-report-print {
  position: fixed; inset: 0; z-index: 2200; background: #e2e8f0; overflow: auto;
  color: #0f172a; font-family: system-ui, sans-serif;
}
#machine-run-report-print .print-toolbar {
  position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 12px;
  align-items: center; justify-content: space-between; background: #fff;
  border-bottom: 1px solid #cbd5e1; padding: 12px 16px;
}
#machine-run-report-print .toolbar-title { font-size: 15px; font-weight: 700; }
#machine-run-report-print .toolbar-sub { margin-top: 2px; font-size: 12px; color: #64748b; }
#machine-run-report-print .toolbar-actions { display: flex; flex-wrap: wrap; gap: 8px; }
#machine-run-report-print .btn-view,
#machine-run-report-print .btn-print,
#machine-run-report-print .btn-close {
  display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px;
  border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid #cbd5e1;
}
#machine-run-report-print .btn-view { background: #eff6ff; color: #0047AB; border-color: #bfdbfe; }
#machine-run-report-print .btn-print { background: #0047AB; color: #fff; border-color: #0047AB; }
#machine-run-report-print .btn-close { background: #fff; color: #334155; }
#machine-run-report-print .print-stage { padding: 16px; }
#machine-run-report-print .print-sheet {
  width: 210mm; max-width: 100%; margin: 0 auto; box-sizing: border-box; background: #fff;
  padding: 10mm 8mm; color: #111; font-family: "Times New Roman", Times, serif;
  font-size: 10.5px; line-height: 1.35; box-shadow: 0 8px 24px rgba(15,23,42,.12);
}
#machine-run-report-print .doc-head { text-align: center; margin-bottom: 10px; }
#machine-run-report-print .brand {
  display: flex; align-items: center; justify-content: center; gap: 8px; text-align: left;
  margin-bottom: 6px;
}
#machine-run-report-print .logo-img {
  width: 12mm; height: 12mm; object-fit: contain; flex-shrink: 0;
}
#machine-run-report-print .brand-kicker {
  font-size: 8px; font-weight: 700; letter-spacing: .04em; color: #0047ab;
}
#machine-run-report-print .brand-name {
  font-size: 14px; font-weight: 900; line-height: 1.05; letter-spacing: .06em; color: #0b1f4d;
}
#machine-run-report-print h1 {
  margin: 6px 0 8px; font-size: 15px; font-weight: 700; letter-spacing: .02em;
}
#machine-run-report-print .meta-line {
  display: flex; flex-wrap: wrap; gap: 6px 16px; justify-content: center; font-size: 10.5px;
}
#machine-run-report-print .summary-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 10px 0 12px;
}
#machine-run-report-print .summary-grid > div {
  border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 6px; text-align: center;
}
#machine-run-report-print .summary-wide { grid-column: span 1; }
#machine-run-report-print .summary-label { font-size: 9px; color: #64748b; text-transform: uppercase; }
#machine-run-report-print .summary-value { margin-top: 2px; font-size: 13px; font-weight: 700; font-family: ui-monospace, monospace; }
#machine-run-report-print .summary-value.fail,
#machine-run-report-print .fail { color: #be123c; }
#machine-run-report-print table { width: 100%; border-collapse: collapse; table-layout: fixed; }
#machine-run-report-print th, #machine-run-report-print td {
  border: 1px solid #94a3b8; padding: 3px 4px; vertical-align: top; word-wrap: break-word;
}
#machine-run-report-print thead th {
  background: #f1f5f9; font-size: 9px; text-transform: uppercase; letter-spacing: .03em;
}
#machine-run-report-print th:nth-child(1), #machine-run-report-print td:nth-child(1) { width: 6%; }
#machine-run-report-print th:nth-child(2), #machine-run-report-print td:nth-child(2) { width: 10%; }
#machine-run-report-print th:nth-child(3), #machine-run-report-print td:nth-child(3) { width: 22%; }
#machine-run-report-print th:nth-child(4), #machine-run-report-print td:nth-child(4) { width: 8%; }
#machine-run-report-print th:nth-child(5), #machine-run-report-print td:nth-child(5) { width: 10%; }
#machine-run-report-print th:nth-child(6), #machine-run-report-print td:nth-child(6) { width: 8%; }
#machine-run-report-print th:nth-child(7), #machine-run-report-print td:nth-child(7) { width: 8%; }
#machine-run-report-print th:nth-child(8), #machine-run-report-print td:nth-child(8) { width: 7%; }
#machine-run-report-print th:nth-child(9), #machine-run-report-print td:nth-child(9) { width: 12%; }
#machine-run-report-print th:nth-child(10), #machine-run-report-print td:nth-child(10) { width: 9%; }
#machine-run-report-print .num, #machine-run-report-print .center { text-align: center; }
#machine-run-report-print td.num { text-align: right; font-family: ui-monospace, monospace; }
#machine-run-report-print .mono { font-family: ui-monospace, monospace; white-space: nowrap; }
#machine-run-report-print .machine-code { font-weight: 700; font-family: ui-monospace, monospace; color: #0047AB; }
#machine-run-report-print .machine-name { font-size: 9px; color: #475569; }
#machine-run-report-print .empty { text-align: center; color: #64748b; padding: 18px 8px; }
@media print {
  @page { size: A4 portrait; margin: 0; }
  body * { visibility: hidden !important; }
  #machine-run-report-print, #machine-run-report-print * { visibility: visible !important; }
  #machine-run-report-print { position: static !important; background: #fff !important; overflow: visible !important; }
  #machine-run-report-print .print-toolbar { display: none !important; }
  #machine-run-report-print .print-stage { padding: 0 !important; }
  #machine-run-report-print .print-sheet { width: auto !important; max-width: none !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
}
`;
