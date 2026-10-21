"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "@/components/icons";
import {
  DEFAULT_WORK_TYPES,
  workMachineLabel,
  type DailyEquipmentItem,
  type DailyIncidentItem,
  type DailyWorkItem,
  type DailyWorkType,
} from "@/lib/dailyReportDb";

const TICK = "✓";
const MIN_WORK_ROWS = 5;
const MIN_FOOT_ROWS = 3;

type PrintWorkRow = {
  hangMuc: string;
  item: DailyWorkItem | null;
  fallbackDonVi: string;
  fallbackMay: string;
};

type DailyWorkReportPrintProps = {
  open: boolean;
  reportDate: string;
  weather: string;
  temperature: string;
  workTypes: DailyWorkType[];
  workToday: DailyWorkItem[];
  workNext: DailyWorkItem[];
  equipment: DailyEquipmentItem[];
  incidents: DailyIncidentItem[];
  autoPrint?: boolean;
  onClose: () => void;
  onPrint: () => void;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function weekdayVi(iso: string) {
  const date = parseIsoDate(iso);
  if (!date) return "";
  return ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"][date.getDay()] ?? "";
}

function displayDateShort(iso: string) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y.slice(-2)}` : iso;
}

function addDaysIso(iso: string, days: number) {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isInternalNote(note: string) {
  return /điền từ nhật ký/i.test(note);
}

function printNote(item: DailyWorkItem | null) {
  if (!item) return "";
  const names = item.tenMoiHan.trim();
  const note = isInternalNote(item.ghiChu) ? "" : item.ghiChu.trim();
  return [names, note].filter(Boolean).join(" · ");
}

function isTicked(value: string) {
  return Boolean(value.trim());
}

function matchWorkRow(type: DailyWorkType, rows: DailyWorkItem[], used: Set<string>) {
  return rows.find((row) => {
    if (used.has(row.id)) return false;
    if (row.congViecId && row.congViecId === type.id) return true;
    return row.hangMuc.trim().toLocaleLowerCase("vi") === type.ten.trim().toLocaleLowerCase("vi");
  });
}

function alignCatalogRows(types: DailyWorkType[], rows: DailyWorkItem[]): PrintWorkRow[] {
  const catalog = types.length > 0 ? types : DEFAULT_WORK_TYPES;
  const used = new Set<string>();
  const matched = catalog.map((type) => {
    const found = matchWorkRow(type, rows, used);
    if (found) used.add(found.id);
    return {
      hangMuc: found?.hangMuc || type.ten,
      item: found ?? null,
      fallbackDonVi: type.donViMacDinh || "mối hàn",
      fallbackMay: type.loaiMayMacDinh,
    };
  });
  const extras = rows
    .filter((row) => !used.has(row.id))
    .map((row) => ({
      hangMuc: row.hangMuc,
      item: row,
      fallbackDonVi: row.donVi,
      fallbackMay: "",
    }));
  return padWorkRows([...matched, ...extras]);
}

function alignNextRows(types: DailyWorkType[], rows: DailyWorkItem[]): PrintWorkRow[] {
  if (rows.length > 0) {
    return padWorkRows(
      rows.map((row) => ({
        hangMuc: row.hangMuc,
        item: row,
        fallbackDonVi: "",
        fallbackMay: "",
      })),
    );
  }
  const catalog = types.length > 0 ? types : DEFAULT_WORK_TYPES;
  return padWorkRows(
    catalog.map((type) => ({
      hangMuc: type.ten,
      item: null,
      fallbackDonVi: "",
      fallbackMay: "",
    })),
  );
}

function padWorkRows(rows: PrintWorkRow[]): PrintWorkRow[] {
  const next = [...rows];
  while (next.length < MIN_WORK_ROWS) {
    next.push({ hangMuc: "", item: null, fallbackDonVi: "", fallbackMay: "" });
  }
  return next;
}

function padFooter<T>(rows: T[], empty: T): T[] {
  const next = [...rows];
  while (next.length < MIN_FOOT_ROWS) next.push(empty);
  return next;
}

function machineNames(row: PrintWorkRow) {
  const machines = row.item?.mayChay ?? [];
  if (machines.length > 0) {
    return machines.map((m) => workMachineLabel(m)).filter(Boolean);
  }
  return row.fallbackMay ? [row.fallbackMay] : [];
}

function machineTimes(row: PrintWorkRow, field: "gioBatDau" | "gioKetThuc") {
  return (row.item?.mayChay ?? []).map((m) => m[field].trim()).filter(Boolean);
}

function manpowerRange(row: PrintWorkRow, field: "gioBatDau" | "gioKetThuc") {
  const times = machineTimes(row, field);
  if (times.length === 0) return "";
  return field === "gioBatDau" ? times.reduce((a, b) => (a < b ? a : b)) : times.reduce((a, b) => (a > b ? a : b));
}

function Lines({ values }: { values: string[] }) {
  if (values.length === 0) return null;
  return (
    <>
      {values.map((value, index) => (
        <div key={`${value}-${index}`}>{value}</div>
      ))}
    </>
  );
}

function WorkBodyRows({ rows, numbered }: { rows: PrintWorkRow[]; numbered: boolean }) {
  let serial = 0;
  return (
    <>
      {rows.map((row, index) => {
        const showNumber = numbered && Boolean(row.hangMuc.trim() || row.item);
        if (showNumber) serial += 1;
        const item = row.item;
        return (
          <tr key={`work-${index}`}>
            <td className="tt">{showNumber ? serial : ""}</td>
            <td className="hang-muc">{row.hangMuc}</td>
            <td className="tick">{item && isTicked(item.tuyenThuong) ? TICK : ""}</td>
            <td className="tick">{item && isTicked(item.tuyenThuong) ? TICK : ""}</td>
            <td className="tick">{item && isTicked(item.tuyenHa) ? TICK : ""}</td>
            <td className="tick">{item && isTicked(item.tuyenHa) ? TICK : ""}</td>
            <td>{item?.donVi || row.fallbackDonVi}</td>
            <td>{item?.denHomQua ?? ""}</td>
            <td>{item?.homNay ?? ""}</td>
            <td>{item?.tichLuy ?? ""}</td>
            <td />
            <td className="wrap">
              <Lines values={machineNames(row)} />
            </td>
            <td>
              <Lines values={machineTimes(row, "gioBatDau")} />
            </td>
            <td>
              <Lines values={machineTimes(row, "gioKetThuc")} />
            </td>
            <td className="wrap">{item?.chtTen ?? ""}</td>
            <td className="wrap">{item?.kySuTen ?? ""}</td>
            <td className="wrap">{item?.laiMayTen ?? ""}</td>
            <td className="wrap">{item?.thoVanHanhTen ?? ""}</td>
            <td className="wrap">{item?.congNhanTen ?? ""}</td>
            <td>{manpowerRange(row, "gioBatDau")}</td>
            <td>{manpowerRange(row, "gioKetThuc")}</td>
            <td className="wrap note">{printNote(item)}</td>
          </tr>
        );
      })}
    </>
  );
}

export default function DailyWorkReportPrint({
  open,
  reportDate,
  weather,
  temperature,
  workTypes,
  workToday,
  workNext,
  equipment,
  incidents,
  autoPrint = false,
  onClose,
  onPrint,
}: DailyWorkReportPrintProps) {
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

  const printedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      printedRef.current = false;
      return;
    }
    if (!autoPrint || printedRef.current) return;
    printedRef.current = true;
    const timer = window.setTimeout(() => onPrint(), 80);
    return () => window.clearTimeout(timer);
  }, [open, autoPrint, onPrint]);

  if (!open || typeof document === "undefined") return null;

  const types = workTypes.length > 0 ? workTypes : DEFAULT_WORK_TYPES;
  const todayRows = alignCatalogRows(types, workToday);
  const nextRows = alignNextRows(types, workNext);
  const equipmentRows = padFooter(equipment, null);
  const incidentRows = padFooter(incidents, null);
  const nextDate = displayDateShort(addDaysIso(reportDate, 1));

  return createPortal(
    <div id="daily-report-print" role="dialog" aria-modal="true" aria-labelledby="daily-report-print-title">
      <style>{PRINT_CSS}</style>
      <div className="print-toolbar">
        <div>
          <div id="daily-report-print-title" className="toolbar-title">
            Mẫu báo cáo công việc ngày
          </div>
          <div className="toolbar-sub">Khổ A4 ngang — kiểm tra rồi in hoặc lưu PDF</div>
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
            <div className="brand brand-left">
              <img src="/logo.png" alt="" className="logo-img" />
              <div>
                <div className="brand-kicker">CÔNG TY CỔ PHẦN CÔNG TRÌNH</div>
                <div className="brand-name">THÀNH PHÁT</div>
                <div className="brand-en">CONSTRUCTION WORK JOINT STOCK COMPANY</div>
              </div>
            </div>
            <div className="doc-title-block">
              <div>DỰ ÁN: TUYẾN TÀU ĐIỆN ĐÔ THỊ LOẠI 1 TẠI ĐẶC KHU PHÚ QUỐC</div>
              <div>GÓI THẦU SỐ XL-03: CUNG CẤP VÀ THI CÔNG LẮP ĐẶT HỆ THỐNG RAY</div>
              <div>HẠNG MỤC: THI CÔNG HÀN RAY</div>
              <div>ĐỊA ĐIỂM XÂY DỰNG: ĐẶC KHU PHÚ QUỐC - TỈNH AN GIANG</div>
            </div>
            <div className="brand brand-right">
              <div className="vnr-mark" aria-hidden>
                <span className="vnr-bar vnr-blue" />
                <span className="vnr-bar vnr-red" />
                <span className="vnr-bar vnr-cyan" />
              </div>
              <div>
                <div className="vnr-code">VNR</div>
                <div className="vnr-name">ĐƯỜNG SẮT VIỆT NAM</div>
              </div>
            </div>
          </header>

          <div className="meta-line">
            <span>
              {weekdayVi(reportDate)} Ngày: <b>{displayDateShort(reportDate)}</b>
            </span>
            <span>
              Thời tiết: <b>{weather || "............"}</b>
            </span>
            <span>
              Nhiệt độ trung bình: <b>{temperature ? `${temperature}°C` : "............"}</b>
            </span>
          </div>

          <table className="main-table">
            <colgroup>
              <col className="c-tt" />
              <col className="c-hang" />
              <col className="c-tick" />
              <col className="c-tick" />
              <col className="c-tick" />
              <col className="c-tick" />
              <col className="c-unit" />
              <col className="c-num" />
              <col className="c-num" />
              <col className="c-num" />
              <col className="c-num" />
              <col className="c-may" />
              <col className="c-time" />
              <col className="c-time" />
              <col className="c-man" />
              <col className="c-man" />
              <col className="c-man" />
              <col className="c-man" />
              <col className="c-man" />
              <col className="c-time" />
              <col className="c-time" />
              <col className="c-note" />
            </colgroup>
            <thead>
              <tr>
                <th colSpan={22} className="form-title">
                  BÁO CÁO CÔNG VIỆC NGÀY
                </th>
              </tr>
              <tr>
                <th rowSpan={3}>TT</th>
                <th rowSpan={3}>Hạng mục công việc</th>
                <th colSpan={4}>Vị trí</th>
                <th colSpan={5}>Năng suất</th>
                <th colSpan={3}>Máy móc, thiết bị</th>
                <th colSpan={7}>Nhân lực</th>
                <th rowSpan={3}>Ghi chú</th>
              </tr>
              <tr>
                <th colSpan={2}>Tuyến thượng</th>
                <th colSpan={2}>Tuyến hạ</th>
                <th rowSpan={2}>Đơn vị</th>
                <th rowSpan={2}>
                  Đầu hôm
                  <br />
                  qua
                </th>
                <th rowSpan={2}>Hôm nay</th>
                <th rowSpan={2}>Tích lũy</th>
                <th rowSpan={2}>Thiết kế</th>
                <th rowSpan={2}>Loại</th>
                <th colSpan={2}>Thời gian làm việc</th>
                <th rowSpan={2}>CHT</th>
                <th rowSpan={2}>Kỹ sư</th>
                <th rowSpan={2}>Lái máy</th>
                <th rowSpan={2}>
                  Thợ vận
                  <br />
                  hành
                </th>
                <th rowSpan={2}>
                  Công
                  <br />
                  nhân
                </th>
                <th colSpan={2}>Thời gian làm việc</th>
              </tr>
              <tr>
                <th>Ray trái</th>
                <th>Ray phải</th>
                <th>Ray trái</th>
                <th>Ray phải</th>
                <th>Bắt đầu</th>
                <th>Kết thúc</th>
                <th>Bắt đầu</th>
                <th>Kết thúc</th>
              </tr>
            </thead>
            <tbody>
              <tr className="section-row">
                <td className="section-letter">A</td>
                <td colSpan={21} className="section-title">
                  CÔNG VIỆC NGÀY HÔM NAY
                </td>
              </tr>
              <WorkBodyRows rows={todayRows} numbered={false} />
              <tr className="section-row">
                <td className="section-letter">B</td>
                <td colSpan={21} className="section-title">
                  CÔNG VIỆC NGÀY TIẾP THEO
                  <span className="next-date">{nextDate}</span>
                </td>
              </tr>
              <WorkBodyRows rows={nextRows} numbered />
            </tbody>
          </table>

          <div className="foot-grid">
            <table className="foot-table">
              <thead>
                <tr>
                  <th colSpan={4} className="foot-head">
                    THIẾT BỊ SỬ DỤNG
                  </th>
                </tr>
                <tr>
                  <th className="stt">STT</th>
                  <th>Thiết bị</th>
                  <th>Số lượng</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {equipmentRows.map((row, index) => (
                  <tr key={row?.id ?? `eq-${index}`}>
                    <td className="stt">{row ? index + 1 : ""}</td>
                    <td className="left">{row?.tenThietBi ?? ""}</td>
                    <td>{row?.soLuong ?? ""}</td>
                    <td className="left">{row?.ghiChu ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="foot-table">
              <thead>
                <tr>
                  <th colSpan={6} className="foot-head">
                    SỰ CỐ - KHÓ KHĂN - VƯỚNG MẮC
                  </th>
                </tr>
                <tr>
                  <th className="stt">STT</th>
                  <th>Nội dung</th>
                  <th>Người báo cáo</th>
                  <th>Bộ phận báo cáo</th>
                  <th>Phương án xử lý</th>
                  <th>Tình trạng xử lý</th>
                </tr>
              </thead>
              <tbody>
                {incidentRows.map((row, index) => (
                  <tr key={row?.id ?? `inc-${index}`}>
                    <td className="stt">{row ? index + 1 : ""}</td>
                    <td className="left">{row?.noiDung ?? ""}</td>
                    <td className="left">{row?.nguoiBaoCao ?? ""}</td>
                    <td className="left">{row?.boPhanBaoCao ?? ""}</td>
                    <td className="left">{row?.phuongAnXuLy ?? ""}</td>
                    <td className="left">{row?.tinhTrangXuLy ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </div>,
    document.body,
  );
}

const PRINT_CSS = `
#daily-report-print {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  background: #e2e8f0;
  color: #000;
}
#daily-report-print .print-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #cbd5e1;
}
#daily-report-print .toolbar-title {
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
}
#daily-report-print .toolbar-sub {
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
}
#daily-report-print .toolbar-actions {
  display: flex;
  gap: 8px;
}
#daily-report-print .btn-print,
#daily-report-print .btn-close {
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
#daily-report-print .btn-print {
  border: 0;
  background: #0047ab;
  color: #fff;
}
#daily-report-print .btn-close {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
}
#daily-report-print .print-stage {
  flex: 1;
  overflow: auto;
  padding: 16px;
}
#daily-report-print .print-sheet {
  width: 297mm;
  min-height: 210mm;
  margin: 0 auto 24px;
  padding: 5mm 5.5mm 6mm;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
  font: 8pt "Times New Roman", Times, serif;
  color: #000;
  box-sizing: border-box;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
#daily-report-print .print-sheet,
#daily-report-print .print-sheet * {
  font-family: "Times New Roman", Times, serif !important;
}
#daily-report-print .doc-head {
  display: grid;
  grid-template-columns: 58mm 1fr 48mm;
  gap: 4mm;
  align-items: center;
}
#daily-report-print .brand {
  display: flex;
  align-items: center;
  gap: 2.5mm;
}
#daily-report-print .brand-right {
  justify-content: flex-end;
  text-align: right;
}
#daily-report-print .logo-img {
  width: 12mm;
  height: 12mm;
  object-fit: contain;
}
#daily-report-print .brand-kicker {
  font-size: 6.2pt;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #0047ab;
}
#daily-report-print .brand-name {
  font-size: 13pt;
  font-weight: 900;
  line-height: 1;
  color: #0b1f4d;
  letter-spacing: 0.04em;
}
#daily-report-print .brand-en {
  margin-top: 0.6mm;
  font-size: 5pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #64748b;
}
#daily-report-print .doc-title-block {
  text-align: center;
  font-size: 8.2pt;
  font-weight: 700;
  line-height: 1.35;
  text-transform: uppercase;
}
#daily-report-print .vnr-mark {
  display: flex;
  flex-direction: column;
  gap: 1.1mm;
}
#daily-report-print .vnr-bar {
  display: block;
  width: 11mm;
  height: 1.7mm;
  border-radius: 0.3mm;
}
#daily-report-print .vnr-blue { background: #1d4ed8; }
#daily-report-print .vnr-red { background: #dc2626; }
#daily-report-print .vnr-cyan { background: #22d3ee; }
#daily-report-print .vnr-code {
  font-size: 16pt;
  font-weight: 900;
  line-height: 1;
  color: #1d4ed8;
  letter-spacing: 0.08em;
}
#daily-report-print .vnr-name {
  margin-top: 0.8mm;
  font-size: 6pt;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: 0.03em;
}
#daily-report-print .meta-line {
  display: flex;
  justify-content: flex-end;
  gap: 8mm;
  margin: 2.2mm 0 1.6mm;
  font-size: 8pt;
}
#daily-report-print .meta-line b {
  font-weight: 800;
}
#daily-report-print table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
#daily-report-print th,
#daily-report-print td {
  border: 0.35mm solid #111;
  padding: 0.7mm 0.6mm;
  vertical-align: middle;
  text-align: center;
  font-weight: 400;
  word-wrap: break-word;
}
#daily-report-print thead th {
  font-weight: 700;
  background: #fff;
}
#daily-report-print .form-title {
  font-size: 11pt;
  font-weight: 900;
  letter-spacing: 0.08em;
  padding: 1.4mm 0;
}
#daily-report-print .c-tt { width: 7mm; }
#daily-report-print .c-hang { width: 32mm; }
#daily-report-print .c-tick { width: 8.5mm; }
#daily-report-print .c-unit { width: 11mm; }
#daily-report-print .c-num { width: 10mm; }
#daily-report-print .c-may { width: 24mm; }
#daily-report-print .c-time { width: 10.5mm; }
#daily-report-print .c-man { width: 14mm; }
#daily-report-print .c-note { width: 20mm; }
#daily-report-print .hang-muc,
#daily-report-print .wrap,
#daily-report-print .note,
#daily-report-print td.left {
  text-align: left;
  padding-left: 1.1mm;
}
#daily-report-print .tt,
#daily-report-print .tick {
  font-weight: 700;
}
#daily-report-print tbody td {
  height: 7.4mm;
}
#daily-report-print .section-row td {
  background: #f7c7a4 !important;
  font-weight: 800;
  text-align: left;
  height: 6.4mm;
}
#daily-report-print .section-letter {
  text-align: center;
  font-size: 9pt;
}
#daily-report-print .section-title {
  letter-spacing: 0.04em;
  padding-left: 2mm;
}
#daily-report-print .next-date {
  margin-left: 8mm;
  font-weight: 800;
}
#daily-report-print .foot-grid {
  display: grid;
  grid-template-columns: 0.9fr 1.4fr;
  gap: 5mm;
  margin-top: 3.5mm;
}
#daily-report-print .foot-table th,
#daily-report-print .foot-table td {
  height: 6.2mm;
}
#daily-report-print .foot-head {
  font-weight: 800;
  letter-spacing: 0.04em;
}
#daily-report-print .stt { width: 10mm; }
@media print {
  @page { size: A4 landscape; margin: 6mm; }
  html, body {
    background: #fff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body:has(#daily-report-print) > :not(#daily-report-print) {
    display: none !important;
  }
  #daily-report-print {
    position: static;
    inset: auto;
    display: block;
    background: #fff;
    overflow: visible;
  }
  #daily-report-print .print-toolbar {
    display: none !important;
  }
  #daily-report-print .print-stage {
    display: contents;
  }
  #daily-report-print .print-sheet {
    width: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    box-shadow: none;
    zoom: 1;
  }
}
@media screen {
  #daily-report-print .print-sheet {
    zoom: 0.82;
  }
}
`;
