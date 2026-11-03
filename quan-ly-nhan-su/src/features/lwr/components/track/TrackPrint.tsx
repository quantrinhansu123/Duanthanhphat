"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  displayRailCode,
  formatChainage,
  getPlacementSpan,
  isLongRailReleased,
  parseChainage,
  railDisplayLabel,
  railRowKey,
  sliceLayoutForPrint,
  trackExtent,
  TRACK_PIXELS_PER_METRE,
  visibleLongRailSpan,
  type LongRail,
  type TrackLayout,
} from "@lwr/lib/track-editor";
import { calculateStressRelease, ceilAbs, DEFAULT_STRESS_INPUT, formatStressNumber, type StressInput } from "@lwr/lib/stress-release";
import type { StructureSymbol } from "@lwr/types/structure";
import type { RailJoint } from "@lwr/types/weld";
import { RailGrid } from "./RailGrid";
import { StructureLegend } from "./StructureLegend";

const noop = () => {};

/** Chiều dài kéo trên bảng in: làm tròn đến mm nguyên (ceil theo độ lớn). */
function formatPullMm(value: number) {
  if (!Number.isFinite(value)) return "—";
  return ceilAbs(value, 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

/** Giờ hiện trường trên bảng in: 09:37:47 26/10/2026. */
function formatFieldTime(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")}:${get("second")} ${get("day")}/${get("month")}/${get("year")}`;
}

type LwrPrintSummary = {
  tempLabel: string;
  methodLabel: string;
  /** Chiều dài kéo thiết kế: tính toán nếu T&lt;ngưỡng, = 0 nếu T≥ngưỡng. */
  designPullMm: string;
  /** Chiều dài kéo thực tế = thiết kế + chuyển vị mốc; = 0 khi giải toả tự nhiên. */
  actualPullMm: string;
  startTimeLabel: string;
  endTimeLabel: string;
};

/** Tóm tắt bảng in: T&lt;ngưỡng → Có lực căng; T≥ngưỡng → Tự nhiên (kéo = 0). */
function lwrPrintSummary(params: StressInput): LwrPrintSummary {
  const startTimeLabel = formatFieldTime(params.startTime);
  const endTimeLabel = formatFieldTime(params.endTime);
  try {
    const result = calculateStressRelease(params);
    const tensor = result.releaseMethod === "TENSOR";
    return {
      tempLabel: formatStressNumber(result.averageTemp),
      methodLabel: tensor ? "Có lực căng" : "Tự nhiên",
      // calculatedPullLength = 0 khi T≥ngưỡng; ngược lại = giá trị tính toán (chưa bù Mt+Mp), mm nguyên.
      designPullMm: formatPullMm(result.calculatedPullLength),
      // pullLength = thiết kế + chuyển vị mốc; = 0 khi tự nhiên — mm nguyên.
      actualPullMm: formatPullMm(result.pullLength),
      startTimeLabel,
      endTimeLabel,
    };
  } catch {
    const temp = Number.isFinite(params.airTemp) ? params.airTemp : Number.NaN;
    const avgFallback = Number.isFinite(params.leftTemp) && Number.isFinite(params.rightTemp)
      ? (params.leftTemp + params.rightTemp) / 2
      : temp;
    const tensor = Number.isFinite(avgFallback) ? avgFallback < 30 : false;
    return {
      tempLabel: Number.isFinite(avgFallback) ? formatStressNumber(avgFallback) : "—",
      methodLabel: Number.isFinite(avgFallback) ? (tensor ? "Có lực căng" : "Tự nhiên") : "—",
      designPullMm: "—",
      actualPullMm: "—",
      startTimeLabel,
      endTimeLabel,
    };
  }
}

/** A4 ngang chia 2 trang (sơ đồ / tổng hợp) hoặc A3 đứng gọn một trang.
 *  `px` ≈ bề rộng in hữu ích (A4 ngang trừ lề) — dùng để phóng to/thu nhỏ sơ đồ cho đầy giấy. */
const FORMATS = {
  A4: { label: "A4 ngang (2 trang)", size: "297mm 210mm", width: "297mm", px: 1000, split: true },
  A3: { label: "A3 đứng (1 trang)", size: "297mm 420mm", width: "297mm", px: 1000, split: false },
};

const RANGE_PRESETS_KM = [1, 2, 3, 5] as const;

export function TrackPrint({
  layout,
  joints,
  symbols,
  onClose,
  projectName,
}: {
  layout: TrackLayout;
  joints: RailJoint[];
  symbols: StructureSymbol[];
  onClose: () => void;
  projectName?: string;
}) {
  const extent = trackExtent(layout.rows);
  const defaultSpanM = Math.min(2000, Math.max(500, extent.endMetres - extent.startMetres));
  const [format, setFormat] = useState<keyof typeof FORMATS>("A4");
  const [fromDraft, setFromDraft] = useState(formatChainage(extent.startMetres));
  const [toDraft, setToDraft] = useState(formatChainage(Math.min(extent.endMetres, extent.startMetres + defaultSpanM)));
  const [rangeError, setRangeError] = useState<string | null>(null);

  const printRange = useMemo(() => {
    const start = parseChainage(fromDraft);
    const end = parseChainage(toDraft);
    if (start === null || end === null || end <= start) return null;
    return { start, end };
  }, [fromDraft, toDraft]);

  const sliced = useMemo(() => {
    if (!printRange) return null;
    try {
      return sliceLayoutForPrint(layout, printRange.start, printRange.end);
    } catch {
      return null;
    }
  }, [layout, printRange]);

  const config = FORMATS[format];
  const stamp = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  const lwrRows = useMemo(() => {
    if (!sliced) return [];
    const fromLongRails = sliced.longRails.flatMap((rail) => {
      const span = getPlacementSpan(sliced.rows, rail) ?? visibleLongRailSpan(sliced.rows, rail);
      if (!span) return [];
      const row = sliced.rows.find((item) => railRowKey(item) === rail.rowKey);
      return [{
        code: displayRailCode(rail.label && rail.label !== rail.code ? `${rail.code} · ${rail.label}` : rail.code),
        railLabel: row ? railDisplayLabel(row.line, row.rail) : "—",
        span,
        summary: lwrPrintSummary(rail.params),
        neutralTemp: formatStressNumber(rail.params.neutralTemp),
        completed: isLongRailReleased(sliced.rows, rail) ? "Đạt" : "Chưa",
      }];
    });
    if (fromLongRails.length) return fromLongRails;

    // Dự án chỉ tô thanh ngắn (chưa tạo đoạn LWR): gom từng thanh đã rải thành dòng tổng hợp.
    return sliced.rows.flatMap((row) => row.cells.flatMap((cell) => {
      if (!cell.placed) return [];
      const startMetres = parseChainage(cell.from);
      const endMetres = parseChainage(cell.to);
      if (startMetres === null || endMetres === null || endMetres <= startMetres) return [];
      const leftTemp = Number.isFinite(cell.leftTemp) ? Number(cell.leftTemp) : cell.temp;
      const rightTemp = Number.isFinite(cell.rightTemp) ? Number(cell.rightTemp) : cell.temp;
      const params: StressInput = {
        ...DEFAULT_STRESS_INPUT,
        leftLength: endMetres - startMetres,
        rightLength: 0,
        leftTemp,
        rightTemp,
        startChainage: cell.from,
        endChainage: cell.to,
      };
      const stub: LongRail = {
        id: cell.id,
        code: cell.id,
        label: cell.id,
        rowKey: railRowKey(row),
        startCellId: cell.id,
        endCellId: cell.id,
        startMetres,
        endMetres,
        params,
        updatedAt: "",
      };
      return [{
        code: displayRailCode(cell.id),
        railLabel: railDisplayLabel(row.line, row.rail),
        span: { startMetres, endMetres },
        summary: lwrPrintSummary(params),
        neutralTemp: formatStressNumber(params.neutralTemp),
        completed: cell.released || isLongRailReleased(sliced.rows, stub) ? "Đạt" : "Chưa",
      }];
    }));
  }, [sliced]);

  function applyPresetKm(km: number) {
    const start = parseChainage(fromDraft) ?? extent.startMetres;
    const end = Math.min(extent.endMetres, start + km * 1000);
    setFromDraft(formatChainage(start));
    setToDraft(formatChainage(end));
    setRangeError(null);
  }

  function validateRange(): boolean {
    if (!printRange) {
      setRangeError("Nhập lý trình đầu/cuối hợp lệ, cuối lớn hơn đầu (ví dụ 0+000 – 2+000).");
      return false;
    }
    if (printRange.end - printRange.start > 15000) {
      setRangeError("Mỗi lần in tối đa 15 km để vừa khổ giấy. Chọn đoạn ngắn hơn.");
      return false;
    }
    setRangeError(null);
    return true;
  }

  // Chiều rộng nội dung sơ đồ (nhãn dải + ray). Phóng to/thu nhỏ để bề ngang đầy khổ giấy.
  // Bề rộng thật của sơ đồ = nhãn dải (150) + đường ray + lề thêm ray (56) + đệm hai bên.
  // Tính theo phạm vi các ray ĐÃ CẮT (có thể dài hơn đoạn in, ví dụ ray kết thúc ở Km2+100 khi in tới Km2+000).
  const slicedExtent = sliced ? trackExtent(sliced.rows) : null;
  const diagramMetres = slicedExtent ? Math.max(slicedExtent.endMetres - slicedExtent.startMetres, printRange ? printRange.end - printRange.start : 0) : 0;
  const contentPx = sliced
    ? 150 + 56 + 48 + Math.max(200, diagramMetres * TRACK_PIXELS_PER_METRE)
    : 400;
  const fitByWidth = Math.min(3, Math.max(0.35, config.px / contentPx));
  // Sơ đồ phải nằm gọn trong MỘT trang: thu nhỏ thêm theo chiều cao còn lại (trừ lề, tiêu đề, legend).
  const diagramRef = useRef<HTMLDivElement>(null);
  const [naturalH, setNaturalH] = useState(0);
  const pageHeightMm = format === "A4" ? 210 : 420;
  const reservedMm = config.split ? 92 : 150; // lề trên+dưới 32 + đầu trang, tiêu đề mục, legend (và bảng tổng hợp nếu in 1 trang)
  const availHeightPx = Math.max(150, (pageHeightMm - reservedMm) * 3.7795);
  const fit = naturalH > 0 ? Math.min(fitByWidth, Math.max(0.3, availHeightPx / naturalH)) : fitByWidth;
  useLayoutEffect(() => {
    const el = diagramRef.current;
    if (!el) return;
    // Đo chiều cao tự nhiên (zoom = 1) để tính tỉ lệ; khôi phục zoom ngay trong cùng frame.
    const previous = el.style.zoom;
    el.style.zoom = "1";
    const height = el.getBoundingClientRect().height;
    el.style.zoom = previous;
    if (height > 0) setNaturalH(height);
  }, [sliced, format, printRange]);

  const filteredJoints = useMemo(() => {
    if (!printRange) return [];
    return joints.filter((joint) => joint.metres >= printRange.start && joint.metres <= printRange.end);
  }, [joints, printRange]);

  return createPortal(
    <div id="lwr-track-print" role="dialog" aria-modal="true" aria-label="Xem trước bản in sơ đồ tuyến">
      <style>{`
      #lwr-track-print { position:fixed; inset:0; z-index:2100; background:#e2e8f0; overflow:auto; color:#111; }
      #lwr-track-print .toolbar { position:sticky; top:0; z-index:1; display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:12px; background:white; border-bottom:1px solid #aaa; }
      #lwr-track-print .toolbar button, #lwr-track-print select, #lwr-track-print .toolbar input { border:1px solid #aaa; border-radius:4px; padding:6px 10px; }
      #lwr-track-print article { width:${config.width}; box-sizing:border-box; margin:16px auto; padding:20mm 12mm 12mm 20mm; background:white; font:10pt 'Times New Roman',serif; }
      #lwr-track-print .print-header { text-align:center; margin:0 0 8px; }
      #lwr-track-print .print-header .company { margin:0; font-size:11pt; font-weight:bold; letter-spacing:0.02em; }
      #lwr-track-print h1 { font-size:16pt; text-align:center; font-weight:bold; margin:6px 0 4px; text-transform:uppercase; }
      #lwr-track-print .print-header .meta { margin:2px 0; font-size:10pt; }
      #lwr-track-print h2.section-title { font-size:12pt; font-weight:bold; margin:10px 0 6px; text-align:left; border-bottom:1px solid #333; padding-bottom:2px; }
      #lwr-track-print .diagram-frame { width:100%; overflow:hidden; }
      #lwr-track-print .diagram-scale { transform-origin:top left; width:max-content; max-width:none; }
      #lwr-track-print p { margin:3px 0; }
      #lwr-track-print table.lwr-summary { border-collapse:collapse; width:100%; table-layout:fixed; margin-top:6px; font-size:8pt; }
      #lwr-track-print table.lwr-summary th,#lwr-track-print table.lwr-summary td { border:1px solid #888; padding:2px 3px; text-align:center; vertical-align:middle; overflow:hidden; }
      #lwr-track-print table.lwr-summary th { font-size:7.5pt; background:#f3f4f6; line-height:1.2; }
      #lwr-track-print table.lwr-summary td { white-space:nowrap; }
      #lwr-track-print table.lwr-summary col.c-code { width:11%; }
      #lwr-track-print table.lwr-summary col.c-line { width:4%; }
      #lwr-track-print table.lwr-summary col.c-km { width:9%; }
      #lwr-track-print table.lwr-summary col.c-len { width:4%; }
      #lwr-track-print table.lwr-summary col.c-temp { width:5.5%; }
      #lwr-track-print table.lwr-summary col.c-method { width:7%; }
      #lwr-track-print table.lwr-summary col.c-pull { width:5%; }
      #lwr-track-print table.lwr-summary col.c-time { width:10%; }
      #lwr-track-print table.lwr-summary col.c-done { width:5%; }
      #lwr-track-print table.lwr-summary td.c-code { text-align:left; font-weight:600; }
      #lwr-track-print tr { break-inside:avoid; }
      @media print {
        @page { size:${config.size}; margin:15mm 15mm 15mm 20mm; }
        body:has(#lwr-track-print) > :not(#lwr-track-print) { display:none!important; }
        #lwr-track-print, #lwr-track-print * { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
        #lwr-track-print { position:static; overflow:visible; background:white; }
        #lwr-track-print [data-testid="rail-grid-installed"] line { stroke:#dc2626 !important; stroke-width:calc(3px / var(--fit)) !important; }
        #lwr-track-print .toolbar { display:none; }
        #lwr-track-print article { width:auto; margin:0; padding:0; break-after:page; }
        #lwr-track-print article:last-child { break-after:auto; }
        #lwr-track-print thead { display:table-header-group; }
            }
    `}</style>
      <div className="toolbar">
        <select aria-label="Khổ giấy" value={format} onChange={(e) => setFormat(e.target.value as keyof typeof FORMATS)}>
          {Object.entries(FORMATS).map(([id, item]) => (
            <option key={id} value={id}>{item.label}</option>
          ))}
        </select>
        <label className="text-sm">
          Km đầu
          <input
            className="ml-1 w-24"
            value={fromDraft}
            onChange={(e) => { setFromDraft(e.target.value); setRangeError(null); }}
            placeholder="0+000"
            aria-label="Lý trình đầu đoạn in"
          />
        </label>
        <label className="text-sm">
          Km cuối
          <input
            className="ml-1 w-24"
            value={toDraft}
            onChange={(e) => { setToDraft(e.target.value); setRangeError(null); }}
            placeholder="2+000"
            aria-label="Lý trình cuối đoạn in"
          />
        </label>
        {RANGE_PRESETS_KM.map((km) => (
          <button key={km} type="button" onClick={() => applyPresetKm(km)}>
            {km} km
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setFromDraft(formatChainage(extent.startMetres));
            setToDraft(formatChainage(extent.endMetres));
            setRangeError(null);
          }}
        >
          Cả tuyến
        </button>
        <button
          type="button"
          onClick={() => {
            if (!validateRange()) return;
            window.print();
          }}
        >
          In / lưu PDF
        </button>
        <button type="button" onClick={onClose}>Đóng</button>
        {rangeError ? <span className="text-sm text-red-700">{rangeError}</span> : null}
      </div>

      {!sliced || !printRange ? (
        <article>
          <p>Nhập đoạn Km hợp lệ để xem trước bản in.</p>
        </article>
      ) : (
        <article>
          <header className="print-header">
            <p className="company">CÔNG TY CỔ PHẦN CÔNG TRÌNH THÀNH PHÁT</p>
            <h1>SƠ ĐỒ GIẢI TOẢ ỨNG SUẤT RAY HÀN DÀI</h1>
            <p className="meta">Dự án: {projectName ?? "Chưa gán dự án"}</p>
            <p className="meta">
              Đoạn in: Km{formatChainage(printRange.start)} – Km{formatChainage(printRange.end)}
              {" · "}
              {(printRange.end - printRange.start) / 1000} km
              {" · "}
              {stamp}
            </p>
          </header>

          <h2 className="section-title">1. Sơ đồ theo dõi giải toả ứng suất</h2>
          <div className="diagram-frame">
            <div
              ref={diagramRef}
              className="diagram-scale"
              style={{
                zoom: fit,
                fontFamily: "system-ui, sans-serif",
                ["--fit" as string]: fit,
              }}
            >
              <RailGrid
                rows={sliced.rows}
                longRails={sliced.longRails}
                joints={filteredJoints}
                installed={sliced.installed}
                selectedId=""
                onSelect={noop}
                embedded
                compact
                structures={{
                  placements: sliced.placements,
                  symbols,
                  editingPlacementId: null,
                  onEditPlacement: noop,
                  onRemovePlacement: noop,
                }}
              />
            </div>
          </div>
          <StructureLegend layout={sliced} symbols={symbols} compact />
          {config.split ? <div style={{ breakAfter: "page" }} /> : null}

          <h2 className="section-title">2. Tổng hợp thông tin giải toả ứng suất</h2>
          <table className="lwr-summary">
            <colgroup>
              <col className="c-code" />
              <col className="c-line" />
              <col className="c-km" />
              <col className="c-km" />
              <col className="c-len" />
              <col className="c-temp" />
              <col className="c-temp" />
              <col className="c-method" />
              <col className="c-pull" />
              <col className="c-pull" />
              <col className="c-time" />
              <col className="c-time" />
              <col className="c-done" />
            </colgroup>
            <thead>
              <tr>
                <th>Mã LWR</th>
                <th>Tuyến · Ray</th>
                <th>Lý trình đầu</th>
                <th>Lý trình cuối</th>
                <th>Dài (m)</th>
                <th>Nhiệt độ giải toả TB (°C)</th>
                <th>Nhiệt độ khoá thiết kế 35±5 (°C)</th>
                <th>Phương pháp</th>
                <th>Kéo TK (mm)</th>
                <th>Kéo TT (mm)</th>
                <th>Bắt đầu</th>
                <th>Kết thúc</th>
                <th>Hoàn thành</th>
              </tr>
            </thead>
            <tbody>
              {lwrRows.map((row) => (
                <tr key={`${row.code}-${row.span.startMetres}-${row.span.endMetres}`}>
                  <td className="c-code">{row.code}</td>
                  <td>{row.railLabel.split(" ")[0]}</td>
                  <td>Km{formatChainage(row.span.startMetres)}</td>
                  <td>Km{formatChainage(row.span.endMetres)}</td>
                  <td>{row.span.endMetres - row.span.startMetres}</td>
                  <td>{row.summary.tempLabel}</td>
                  <td>{row.neutralTemp}</td>
                  <td>{row.summary.methodLabel}</td>
                  <td>{row.summary.designPullMm}</td>
                  <td>{row.summary.actualPullMm}</td>
                  <td>{row.summary.startTimeLabel}</td>
                  <td>{row.summary.endTimeLabel}</td>
                  <td>{row.completed}</td>
                </tr>
              ))}
              {lwrRows.length === 0 ? (
                <tr><td colSpan={13}>Chưa có đoạn LWR / thanh đã rải trong đoạn đã chọn.</td></tr>
              ) : null}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "space-around", marginTop: "6mm", marginBottom: "6mm" }}>
            <b>Người lập</b><b>Người kiểm tra</b><b>Đại diện bên A</b>
          </div>
        </article>
      )}
    </div>,
    document.body,
  );
}
