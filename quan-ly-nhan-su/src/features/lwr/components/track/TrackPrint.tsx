"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatChainage,
  getPlacementSpan,
  parseChainage,
  railCellLockTemp,
  railRowKey,
  sliceLayoutForPrint,
  trackExtent,
  TRACK_PIXELS_PER_METRE,
  visibleLongRailSpan,
  type TrackLayout,
} from "@lwr/lib/track-editor";
import { calculateStressRelease, formatStressNumber, type StressInput } from "@lwr/lib/stress-release";
import type { StructureSymbol } from "@lwr/types/structure";
import type { RailJoint } from "@lwr/types/weld";
import { RailGrid } from "./RailGrid";
import { StructureLegend } from "./StructureLegend";

const noop = () => {};

function releaseTempLabel(params: StressInput): string {
  try {
    return formatStressNumber(calculateStressRelease(params).averageTemp);
  } catch {
    return Number.isFinite(params.airTemp) ? formatStressNumber(params.airTemp) : "—";
  }
}

const FORMATS = {
  A4: { label: "A4 ngang", size: "297mm 210mm", width: "297mm", px: 1000 },
  A3: { label: "A3 ngang", size: "420mm 297mm", width: "420mm", px: 1500 },
  LONG: { label: "A3 kéo dài (841 × 297 mm)", size: "841mm 297mm", width: "841mm", px: 3100 },
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

  const shortRows = useMemo(() => {
    if (!sliced || !printRange) return [];
    return sliced.rows.flatMap((row) =>
      row.cells
        .filter((cell) => cell.placed || cell.released)
        .map((cell) => {
          const from = parseChainage(cell.from) ?? 0;
          const to = parseChainage(cell.to) ?? 0;
          const cover = sliced.longRails.find((rail) => {
            if (rail.rowKey !== railRowKey(row)) return false;
            const span = getPlacementSpan(sliced.rows, rail) ?? visibleLongRailSpan(sliced.rows, rail);
            return Boolean(span && from < span.endMetres && to > span.startMetres);
          });
          const temp = railCellLockTemp(cell);
          const status = !cell.released
            ? "Chưa giải toả"
            : temp >= 30
              ? "Giải toả · T≥30"
              : "Giải toả · T<30";
          return {
            id: cell.id,
            line: row.line,
            rail: row.rail,
            from: cell.from,
            to: cell.to,
            length: Math.max(0, to - from),
            temp,
            leftTemp: cell.leftTemp ?? temp,
            rightTemp: cell.rightTemp ?? temp,
            status,
            lwr: cover?.code ?? "—",
          };
        }),
    );
  }, [sliced, printRange]);

  const lwrRows = useMemo(() => {
    if (!sliced) return [];
    return sliced.longRails.flatMap((rail) => {
      const span = getPlacementSpan(sliced.rows, rail) ?? visibleLongRailSpan(sliced.rows, rail);
      if (!span) return [];
      const row = sliced.rows.find((item) => railRowKey(item) === rail.rowKey);
      return [{
        rail,
        span,
        line: row?.line ?? "—",
        side: row?.rail ?? "—",
      }];
    });
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

  const contentPx = sliced
    ? 150 + 56 + 32 + Math.max(240, (printRange!.end - printRange!.start) * TRACK_PIXELS_PER_METRE)
    : 400;
  const fit = Math.min(1, config.px / contentPx);

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
      #lwr-track-print article { width:${config.width}; box-sizing:border-box; margin:16px auto; padding:10mm; background:white; font:10pt 'Times New Roman',serif; }
      #lwr-track-print h1 { font-size:15pt; text-align:center; font-weight:bold; margin:4px; }
      #lwr-track-print h2 { font-size:11pt; margin:10px 0 4px; }
      #lwr-track-print p { margin:3px 0; }
      #lwr-track-print table { border-collapse:collapse; width:100%; margin-top:6px; font-size:9pt; }
      #lwr-track-print th,#lwr-track-print td { border:1px solid #888; padding:4px 6px; text-align:left; }
      #lwr-track-print tr { break-inside:avoid; }
      @media print {
        @page { size:${config.size}; margin:8mm; }
        body:has(#lwr-track-print) > :not(#lwr-track-print) { display:none!important; }
        #lwr-track-print { position:static; overflow:visible; background:white; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
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
          <p>CÔNG TY CỔ PHẦN CÔNG TRÌNH THÀNH PHÁT</p>
          <h1>SƠ ĐỒ TUYẾN VÀ GIẢI TOẢ ỨNG SUẤT LWR</h1>
          <p>Dự án: {projectName ?? "Chưa gán dự án"}</p>
          <p>
            Đoạn in: Km{formatChainage(printRange.start)} – Km{formatChainage(printRange.end)}
            {" · "}
            {(printRange.end - printRange.start) / 1000} km
            {" · "}
            {stamp}
          </p>
          <p style={{ fontSize: "8pt", color: "#555" }}>
            Tuyến đầy đủ: Km{formatChainage(extent.startMetres)} – Km{formatChainage(extent.endMetres)}.
            Chọn đoạn ngắn hơn nếu sơ đồ không vừa một trang.
          </p>

          <div style={{ zoom: fit, fontFamily: "system-ui, sans-serif" }}>
            <RailGrid
              rows={sliced.rows}
              longRails={sliced.longRails}
              joints={filteredJoints}
              selectedId=""
              onSelect={noop}
              embedded
              structures={{
                placements: sliced.placements,
                symbols,
                editingPlacementId: null,
                onEditPlacement: noop,
                onRemovePlacement: noop,
              }}
            />
          </div>

          <StructureLegend layout={sliced} symbols={symbols} />

          <h2>Tổng hợp từng thanh ngắn trong đoạn in</h2>
          <table>
            <thead>
              <tr>
                <th>Mã thanh</th>
                <th>Tuyến · Ray</th>
                <th>Lý trình</th>
                <th>Dài (m)</th>
                <th>T trái</th>
                <th>T phải</th>
                <th>T khóa</th>
                <th>Trạng thái</th>
                <th>LWR</th>
              </tr>
            </thead>
            <tbody>
              {shortRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.line} · {row.rail}</td>
                  <td>Km{row.from} – {row.to}</td>
                  <td>{row.length}</td>
                  <td>{row.leftTemp}</td>
                  <td>{row.rightTemp}</td>
                  <td>{row.temp}</td>
                  <td>{row.status}</td>
                  <td>{row.lwr}</td>
                </tr>
              ))}
              {shortRows.length === 0 ? (
                <tr><td colSpan={9}>Chưa có thanh ngắn trong đoạn đã chọn.</td></tr>
              ) : null}
            </tbody>
          </table>

          <h2>Tổng hợp đoạn LWR trong đoạn in</h2>
          <table>
            <thead>
              <tr>
                <th>Mã LWR</th>
                <th>Tuyến · Ray</th>
                <th>Lý trình</th>
                <th>Dài (m)</th>
                <th>Nhiệt độ giải toả (°C)</th>
                <th>Hoàn thành</th>
              </tr>
            </thead>
            <tbody>
              {lwrRows.map(({ rail, span, line, side }) => (
                <tr key={rail.id}>
                  <td>{rail.label && rail.label !== rail.code ? `${rail.code} · ${rail.label}` : rail.code}</td>
                  <td>{line} · {side}</td>
                  <td>Km{formatChainage(span.startMetres)} – {formatChainage(span.endMetres)}</td>
                  <td>{span.endMetres - span.startMetres}</td>
                  <td>{releaseTempLabel(rail.params)}</td>
                  <td>{rail.completedAt ? "Có" : "Chưa"}</td>
                </tr>
              ))}
              {lwrRows.length === 0 ? (
                <tr><td colSpan={6}>Chưa có đoạn LWR trong đoạn đã chọn.</td></tr>
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
