"use client";

import { useEffect, useMemo, useState } from "react";
import { Shapes, Truck } from "lucide-react";
import { safeImageUrl } from "@lwr/lib/safe-url";
import {
  formatMachineDayHours,
  machineDayTone,
  safeMachineImageUrl,
  type MachineOnTrack,
} from "@lwr/lib/machine-images";
import type { StructureSymbol } from "@lwr/types/structure";
import type { StructureLayer } from "./RailGrid";
import {
  getPlacementSpan,
  parseChainage,
  type PlacementSpan,
  type TrackPlacement,
  formatChainage,
  railRowKey,
  trackSpanStyle,
  TRACK_PIXELS_PER_METRE,
} from "@lwr/lib/track-editor";
import type { RailRow } from "@lwr/types/track";

interface PlottedPlacement {
  placement: TrackPlacement;
  span: PlacementSpan;
  symbol: StructureSymbol | undefined;
}

interface StructureCluster {
  id: string;
  items: PlottedPlacement[];
  anchorX: number;
}

const MARKER_W = 40;
const MARKER_H = 28;
const MARKER_W_IMAGE = 96;
const MARKER_H_IMAGE = 78;
const CLUSTER_GAP = 6;
const SAME_CENTRE_PX = 12;
const SPAN_H = 6;
const OVERLAP_H = 10;
const TAB_MAX_W = 168;
const DAY_BAND_H = 14;

function SymbolThumb({
  symbol,
  large = false,
}: {
  symbol: StructureSymbol | undefined;
  large?: boolean;
}) {
  const src = safeImageUrl(symbol?.image_url);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img
        src={src}
        alt=""
        className={`shrink-0 object-contain ${large ? "h-12 w-[4.25rem]" : "h-6 w-9"}`}
        decoding="async"
      />
    : <Shapes className={`shrink-0 text-amber-700 ${large ? "size-8" : "size-5"}`} aria-hidden="true" />;
}

function spanMid(span: PlacementSpan) {
  return (span.startMetres + span.endMetres) / 2;
}

function structureLabel(item: PlottedPlacement) {
  return item.symbol?.code || item.placement.label || item.symbol?.name || "CT";
}

/** Gom công trình cùng (hoặc gần) một điểm tim → xếp hàng ngang. */
function clusterStructures(items: PlottedPlacement[], startMetres: number): StructureCluster[] {
  const sorted = [...items].sort((a, b) => spanMid(a.span) - spanMid(b.span));
  const clusters: StructureCluster[] = [];
  for (const item of sorted) {
    const centreX = (spanMid(item.span) - startMetres) * TRACK_PIXELS_PER_METRE;
    const hit = clusters.find((cluster) => Math.abs(cluster.anchorX - centreX) < SAME_CENTRE_PX);
    if (hit) {
      hit.items.push(item);
      hit.anchorX =
        hit.items.reduce((sum, other) => sum + (spanMid(other.span) - startMetres) * TRACK_PIXELS_PER_METRE, 0) /
        hit.items.length;
    } else {
      clusters.push({
        id: item.placement.id,
        items: [item],
        anchorX: centreX,
      });
    }
  }
  for (const cluster of clusters) {
    cluster.items.sort((a, b) => a.placement.id.localeCompare(b.placement.id));
  }
  return clusters;
}

function markerLeft(cluster: StructureCluster, index: number, markerW: number) {
  const n = cluster.items.length;
  const rowW = n * markerW + (n - 1) * CLUSTER_GAP;
  return cluster.anchorX - rowW / 2 + index * (markerW + CLUSTER_GAP);
}

interface MetreBand {
  startMetres: number;
  endMetres: number;
}

function overlapBands(items: PlottedPlacement[]): MetreBand[] {
  if (items.length < 2) return [];
  const events: { at: number; delta: number }[] = [];
  for (const item of items) {
    events.push({ at: item.span.startMetres, delta: 1 }, { at: item.span.endMetres, delta: -1 });
  }
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);
  const bands: MetreBand[] = [];
  let depth = 0;
  let bandStart: number | null = null;
  for (const event of events) {
    const prev = depth;
    depth += event.delta;
    if (prev < 2 && depth >= 2) bandStart = event.at;
    if (prev >= 2 && depth < 2 && bandStart !== null && event.at > bandStart) {
      bands.push({ startMetres: bandStart, endMetres: event.at });
      bandStart = null;
    }
  }
  return bands;
}

/**
 * Đường tim nằm giữa Ray trái / Ray phải của cùng tuyến.
 * Công trình chồng điểm → xếp ngang; hover mới bung tab chi tiết.
 */
function MachineThumb({ machine }: { machine: MachineOnTrack }) {
  const cutout = safeMachineImageUrl(machine.imageUrl);
  const raw = (machine.imageUrl ?? "").trim();
  const fallback =
    raw.startsWith("/may-han/")
      ? raw
      : (() => {
          try {
            const u = new URL(raw);
            return u.protocol === "https:" && u.hostname.endsWith("cloudinary.com") ? raw : null;
          } catch {
            return null;
          }
        })();
  const [useFallback, setUseFallback] = useState(false);
  const src = useFallback ? fallback : (cutout ?? fallback);
  if (!src) return <Truck className="size-10 shrink-0 text-slate-500" aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={cutout ?? fallback ?? machine.id}
      src={src}
      alt=""
      className="h-14 w-[5.5rem] shrink-0 object-contain drop-shadow-md"
      decoding="async"
      onError={() => {
        if (!useFallback && fallback && fallback !== src) setUseFallback(true);
      }}
    />
  );
}

function formatDayLabel(date: string | null) {
  if (!date) return "Không rõ ngày";
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

export function TrackCenterline({
  structures,
  machines = [],
  rows,
  startMetres,
  width,
  imageMode = false,
}: {
  structures?: StructureLayer;
  /** Ảnh máy từ danh-sach-may, gắn theo lý trình nhật ký — chỉ dùng khi imageMode. */
  machines?: MachineOnTrack[];
  rows: RailRow[];
  startMetres: number;
  width: number;
  /** Chế độ ảnh thiết bị: ẩn công trình, hiện ảnh máy theo tọa độ nhật ký. */
  imageMode?: boolean;
}) {
  const [hoverClusterId, setHoverClusterId] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const markerW = MARKER_W;
  const markerH = MARKER_H;
  const machineW = MARKER_W_IMAGE;
  const machineH = MARKER_H_IMAGE;

  const plottedStructures: PlottedPlacement[] = useMemo(
    () => {
      if (imageMode) return [];
      return (structures?.placements ?? []).flatMap((placement) => {
        const lineName = rows[0]?.line;
        if (!lineName) return [];
        const owner = rows.find((row) => railRowKey(row) === placement.rowKey);
        if (!owner || owner.line !== lineName) return [];
        const span = getPlacementSpan(rows, placement)
          ?? getPlacementSpan(rows, { ...placement, rowKey: railRowKey(rows[0]) });
        return span
          ? [{ placement, span, symbol: structures?.symbols.find((item) => item.id === placement.symbolId) }]
          : [];
      });
    },
    [structures, rows, imageMode],
  );

  const clusters = useMemo(
    () => clusterStructures(plottedStructures, startMetres),
    [plottedStructures, startMetres],
  );

  const machinesOnLine = useMemo(() => {
    if (!imageMode || machines.length === 0) return [];
    let lineStart = Number.POSITIVE_INFINITY;
    let lineEnd = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      for (const cell of row.cells) {
        const from = parseChainage(cell.from);
        const to = parseChainage(cell.to);
        if (from !== null && from < lineStart) lineStart = from;
        if (to !== null && to > lineEnd) lineEnd = to;
      }
    }
    if (!Number.isFinite(lineStart) || !Number.isFinite(lineEnd)) return machines;
    // Giữ ngày nếu đoạn hàn giao với phạm vi tuyến.
    return machines.filter(
      (item) => item.endMetres >= lineStart - 1 && item.startMetres <= lineEnd + 1,
    );
  }, [imageMode, machines, rows]);

  useEffect(() => {
    if (!imageMode) setActiveDayId(null);
  }, [imageMode]);

  useEffect(() => {
    if (!activeDayId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveDayId(null);
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-machine-day]")) return;
      setActiveDayId(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [activeDayId]);

  const markerGapAboveAxis = imageMode ? 0 : 4;
  const symbolStackH = imageMode
    ? 0
    : (plottedStructures.length === 0 ? 0 : markerH);
  const chainageBandH = OVERLAP_H / 2 + 16;
  const hoverExtra = !imageMode && hoverClusterId ? 56 : 0;
  /** Chế độ ảnh: luôn chừa nửa ảnh + chỗ popup; trục tim cố định để ảnh không nhảy khi click. */
  const padTop = imageMode
    ? Math.max(8, machineH / 2 + 58)
    : 4;
  const padBottom = imageMode
    ? Math.max(chainageBandH + 4, machineH / 2 + 4)
    : 4;
  const rowHeight = Math.max(
    imageMode ? machineH + chainageBandH + 72 : 40,
    padTop + hoverExtra + symbolStackH + markerGapAboveAxis + chainageBandH + padBottom,
  );
  const axisY = imageMode
    ? padTop
    : padTop + hoverExtra + symbolStackH + markerGapAboveAxis;
  /** Ảnh cân giữa tim; nửa trên/dưới được đè lên ray trái/phải. */
  const markerTop = imageMode
    ? axisY - machineH / 2
    : axisY - markerGapAboveAxis - markerH;
  const giaoThoa = imageMode ? [] : overlapBands(plottedStructures);

  let lineStart = Number.POSITIVE_INFINITY;
  let lineEnd = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    for (const cell of row.cells) {
      const from = parseChainage(cell.from);
      const to = parseChainage(cell.to);
      if (from !== null && from < lineStart) lineStart = from;
      if (to !== null && to > lineEnd) lineEnd = to;
    }
  }
  const hasLineSpan = Number.isFinite(lineStart) && Number.isFinite(lineEnd) && lineEnd > lineStart;
  const axisBox = hasLineSpan ? trackSpanStyle(lineStart, lineEnd, startMetres) : null;

  const chainageTicks = (() => {
    const ticks: { metres: number; key: string }[] = [];
    if (!hasLineSpan) return ticks;
    const step = 500;
    let metres = Math.ceil(lineStart / step) * step;
    if (lineStart % step === 0) metres = lineStart;
    for (; metres <= lineEnd; metres += step) {
      ticks.push({ metres, key: `km-${metres}` });
    }
    if (lineEnd % step !== 0) {
      ticks.push({ metres: lineEnd, key: `km-end-${lineEnd}` });
    }
    return ticks;
  })();

  return (
    <div
      className={`grid grid-cols-[110px_1fr] gap-x-2 ${imageMode ? "relative z-30 overflow-visible" : ""}`}
      data-testid="track-centerline"
      aria-label="Tim tuyến giữa hai ray"
    >
      <div className="relative text-[10px] font-bold leading-3 text-slate-700" style={{ height: rowHeight }}>
        <span className="absolute left-0 -translate-y-1/2" style={{ top: axisY }}>
          Tim · {rows[0]?.line?.replace(/^TUYẾN\s+/i, "") ?? ""}
        </span>
      </div>
      <div className={`relative ${imageMode ? "overflow-visible" : ""}`} style={{ width, height: rowHeight }}>
        {axisBox ? (
          <div
            aria-hidden
            className="absolute border-t-2 border-dashed border-slate-600"
            style={{ top: axisY, left: axisBox.left, width: axisBox.width }}
          />
        ) : null}

        {chainageTicks.map(({ metres, key }) => {
          const x = (metres - startMetres) * TRACK_PIXELS_PER_METRE;
          return (
            <span key={key} className="pointer-events-none absolute z-[3] -translate-x-1/2" style={{ left: x, top: axisY + OVERLAP_H / 2 + 1 }} aria-hidden>
              <span className="mx-auto block h-3 w-0.5 bg-slate-800" />
              <span className="block whitespace-nowrap text-center text-[9px] font-bold leading-3 text-slate-800">
                {formatChainage(metres)}
              </span>
            </span>
          );
        })}

        {imageMode &&
          machinesOnLine.map((day, index) => {
            const tone = machineDayTone(index);
            const box = trackSpanStyle(day.startMetres, day.endMetres, startMetres);
            const x = (day.metres - startMetres) * TRACK_PIXELS_PER_METRE;
            const open = activeDayId === day.id;
            const label = day.machineCode || day.machineName;
            const dayText = formatDayLabel(day.date);
            const hoursText = formatMachineDayHours(day.operatingHours);
            return (
              <div
                key={day.id}
                className="pointer-events-none absolute inset-y-0 z-20"
                style={{ left: 0, width }}
                data-machine-day={day.id}
              >
                {/* Bôi màu cả đoạn hàn trong ngày */}
                <span
                  aria-hidden
                  className="absolute z-[11] -translate-y-1/2 rounded-sm border"
                  title={`${dayText} · ${hoursText} · ${day.weldCount} mối · Km ${formatChainage(day.startMetres)} – ${formatChainage(day.endMetres)}`}
                  style={{
                    left: box.left,
                    width: Math.max(12, box.width),
                    top: axisY,
                    height: DAY_BAND_H,
                    background: tone.fill,
                    borderColor: tone.ring,
                  }}
                />
                {/* 1 ảnh đại diện / ngày — căn giữa tim, được đè lên ray; click xem giờ */}
                <button
                  type="button"
                  data-testid="machine-on-track"
                  data-machine-metres={String(day.metres)}
                  aria-expanded={open}
                  className={`pointer-events-auto absolute z-40 -translate-x-1/2 rounded-md border bg-white/90 px-1 pb-0.5 pt-1 shadow-md ${
                    open ? "ring-2 ring-amber-400" : "ring-1 ring-slate-300/70"
                  }`}
                  style={{ left: x, top: markerTop, width: machineW, height: machineH }}
                  title={`Nhấn để xem giờ hoạt động · ${dayText} · ${label}`}
                  onClick={() => setActiveDayId((current) => (current === day.id ? null : day.id))}
                >
                  <span className="flex flex-col items-center gap-0.5">
                    <MachineThumb machine={day} />
                    <span className="w-full truncate text-center text-[9px] font-bold leading-3 text-slate-900">
                      {dayText}
                    </span>
                  </span>
                  {day.weldCount > 1 ? (
                    <span className="absolute -right-1 -top-1 rounded-full bg-slate-800 px-1.5 text-[9px] font-bold text-white">
                      {day.weldCount}
                    </span>
                  ) : null}
                </button>
                {open ? (
                  <div
                    role="status"
                    data-testid="machine-day-hours"
                    className="pointer-events-none absolute z-50 -translate-x-1/2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 shadow-md"
                    style={{ left: x, top: markerTop - 62, minWidth: 148, maxWidth: 200 }}
                  >
                    <span className="block text-[10px] font-bold text-amber-950">{dayText}</span>
                    <span className="mt-0.5 block text-[11px] font-bold text-slate-900">
                      Giờ hoạt động: {hoursText}
                    </span>
                    {day.workTimeRange ? (
                      <span className="block font-mono text-[9px] text-slate-600">{day.workTimeRange}</span>
                    ) : (
                      <span className="block text-[9px] text-slate-500">Ước lượng 1 ca (chưa nhập giờ BĐ/KT)</span>
                    )}
                    <span className="mt-0.5 block truncate text-[9px] text-slate-700">{label}</span>
                    <span className="block font-mono text-[9px] text-slate-500">
                      Km {formatChainage(day.startMetres)} – {formatChainage(day.endMetres)}
                      {" · "}
                      {day.weldCount} mối
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}

        {!imageMode && structures &&
          clusters.map((cluster) => {
            const open = hoverClusterId === cluster.id;
            const activeId = activeTabId && cluster.items.some((item) => item.placement.id === activeTabId)
              ? activeTabId
              : cluster.items[0]?.placement.id;
            const activeItem = cluster.items.find((item) => item.placement.id === activeId) ?? cluster.items[0];
            const rowW = cluster.items.length * markerW + (cluster.items.length - 1) * CLUSTER_GAP;

            return (
              <div
                key={cluster.id}
                className="pointer-events-none absolute inset-y-0 z-10"
                style={{ left: 0, width }}
                onMouseLeave={() => {
                  setHoverClusterId((current) => (current === cluster.id ? null : current));
                  setActiveTabId(null);
                }}
              >
                {cluster.items.map((plotted) => {
                  const box = trackSpanStyle(plotted.span.startMetres, plotted.span.endMetres, startMetres);
                  return (
                    <span
                      key={`span-${plotted.placement.id}`}
                      aria-hidden
                      className="absolute -translate-y-1/2 rounded-full border border-amber-600/40"
                      style={{
                        left: box.left,
                        width: Math.max(8, box.width),
                        top: axisY,
                        height: SPAN_H,
                        backgroundImage:
                          "repeating-linear-gradient(90deg, rgb(251 191 36 / 0.85) 0 5px, rgb(251 191 36 / 0.2) 5px 9px)",
                      }}
                    />
                  );
                })}

                <svg
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-0 overflow-visible"
                  width={width}
                  height={rowHeight}
                >
                  {cluster.items.map((plotted, index) => {
                    const left = markerLeft(cluster, index, markerW);
                    const topX = left + markerW / 2;
                    return (
                      <line
                        key={`lead-${plotted.placement.id}`}
                        x1={topX}
                        y1={markerTop + markerH}
                        x2={cluster.anchorX}
                        y2={axisY}
                        stroke="rgb(245 158 11 / 0.55)"
                        strokeWidth={1.25}
                      />
                    );
                  })}
                </svg>

                {cluster.items.length > 1 ? (
                  <span
                    aria-hidden
                    className="absolute z-[12] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-600 ring-1 ring-white"
                    style={{ left: cluster.anchorX, top: axisY }}
                  />
                ) : null}

                <div
                  className="pointer-events-auto absolute z-20"
                  style={{ left: cluster.anchorX - rowW / 2, top: markerTop, width: rowW, height: markerH }}
                  onMouseEnter={() => {
                    setHoverClusterId(cluster.id);
                    setActiveTabId(cluster.items[0]?.placement.id ?? null);
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    {cluster.items.map((plotted) => {
                      const codeOrName = structureLabel(plotted);
                      const selected =
                        structures.editingPlacementId === plotted.placement.id
                        || (open && activeId === plotted.placement.id);
                      return (
                        <button
                          key={plotted.placement.id}
                          type="button"
                          data-placement={plotted.placement.id}
                          onClick={() => structures.onEditPlacement(plotted.placement)}
                          onMouseEnter={() => setActiveTabId(plotted.placement.id)}
                          onFocus={() => {
                            setHoverClusterId(cluster.id);
                            setActiveTabId(plotted.placement.id);
                          }}
                          aria-label={`Sửa ${codeOrName}`}
                          title={`${codeOrName} · Km ${formatChainage(plotted.span.startMetres)} – ${formatChainage(plotted.span.endMetres)}`}
                          className={`flex shrink-0 items-center justify-center rounded border bg-white/95 shadow-sm hover:ring-2 hover:ring-blue-400 ${
                            selected ? "ring-2 ring-blue-500" : "ring-1 ring-amber-400/50"
                          }`}
                          style={{ width: markerW, height: markerH }}
                        >
                          <SymbolThumb symbol={plotted.symbol} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {open && activeItem ? (
                  <div
                    role="tablist"
                    aria-label="Chi tiết công trình"
                    className="pointer-events-auto absolute z-30 -translate-x-1/2 rounded-md border border-amber-300 bg-white/98 p-1 shadow-md"
                    style={{
                      left: cluster.anchorX,
                      top: Math.max(0, markerTop - 52),
                      minWidth: Math.min(TAB_MAX_W, Math.max(rowW, 120)),
                      maxWidth: TAB_MAX_W,
                    }}
                  >
                    {cluster.items.length > 1 ? (
                      <div className="mb-1 flex flex-wrap gap-0.5 border-b border-amber-100 pb-1">
                        {cluster.items.map((plotted) => {
                          const code = structureLabel(plotted);
                          const on = plotted.placement.id === activeId;
                          return (
                            <button
                              key={`tab-${plotted.placement.id}`}
                              type="button"
                              role="tab"
                              aria-selected={on}
                              onMouseEnter={() => setActiveTabId(plotted.placement.id)}
                              onClick={() => {
                                setActiveTabId(plotted.placement.id);
                                structures.onEditPlacement(plotted.placement);
                              }}
                              className={`max-w-[72px] truncate rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                                on ? "bg-amber-100 text-amber-950" : "bg-slate-50 text-slate-600 hover:bg-amber-50"
                              }`}
                              title={code}
                            >
                              {code}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      role="tabpanel"
                      onClick={() => structures.onEditPlacement(activeItem.placement)}
                      className="block w-full rounded px-1 py-0.5 text-left hover:bg-amber-50"
                    >
                      <span className="block truncate text-[10px] font-bold text-slate-900">
                        {structureLabel(activeItem)}
                      </span>
                      <span className="block truncate text-[9px] text-slate-600">
                        {activeItem.symbol?.name || activeItem.placement.label || "Công trình"}
                      </span>
                      <span className="block font-mono text-[9px] text-slate-500">
                        Km {formatChainage(activeItem.span.startMetres)} – {formatChainage(activeItem.span.endMetres)}
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

        {giaoThoa.map((band) => {
          const box = trackSpanStyle(band.startMetres, band.endMetres, startMetres);
          return (
            <span
              key={`overlap-${band.startMetres}-${band.endMetres}`}
              aria-hidden
              title={`Giao thoa · Km ${formatChainage(band.startMetres)} – ${formatChainage(band.endMetres)}`}
              className="pointer-events-none absolute z-[11] -translate-y-1/2 rounded-sm"
              style={{
                left: box.left,
                width: Math.max(10, box.width),
                top: axisY,
                height: OVERLAP_H,
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgb(180 83 9) 0 3px, rgb(253 224 71) 3px 6px)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
