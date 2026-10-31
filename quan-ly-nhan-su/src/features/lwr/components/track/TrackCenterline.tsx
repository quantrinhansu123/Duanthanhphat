"use client";

import { useEffect, useMemo, useState } from "react";
import { Shapes, Truck, UserRound } from "lucide-react";
import { safeImageUrl } from "@lwr/lib/safe-url";
import {
  formatMachineDayHours,
  machineDayTone,
  safeMachineImageUrl,
  safeWelderImageUrl,
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
import { MachineDayDetailModal } from "./MachineDayDetailModal";

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
/** Khối máy gọn: xe + avatar chồng góc + ngày (không kéo ngang/dài tên). */
const MARKER_W_IMAGE = 72;
const MARKER_H_IMAGE = 52;
const LABEL_H = 14;
const MACHINE_BLOCK_H = MARKER_H_IMAGE + 2 + LABEL_H;
/** Khoảng trống giữa hai ô ký hiệu trong cùng cụm — đủ rộng để nhìn rõ từng hình. */
const CLUSTER_GAP = 10;
/**
 * Gom công trình khi tâm gần nhau hơn bề ngang một ô.
 * Trước đây 12px quá hẹp: hai ô 40px vẫn chồng lên nhau vì không được xếp hàng.
 */
const SAME_CENTRE_PX = MARKER_W;
const SPAN_H = 6;
const OVERLAP_H = 10;
const TAB_MAX_W = 168;
const DAY_BAND_H = 6;
/**
 * Gióng ảnh lên mối hàn trên thanh ray trên (hàng đầu cặp trái/phải trong RailGrid).
 * Hàng ray height 64, nút mối top:20 size-8, space-y-1 giữa hàng ray và tim.
 */
const UPPER_RAIL_ROW_H = 64;
const UPPER_RAIL_GAP = 4;
const UPPER_RAIL_WELD_CENTER_Y = 20 + 16;
const UPPER_RAIL_WELD_TIP_Y = -(UPPER_RAIL_GAP + UPPER_RAIL_ROW_H - UPPER_RAIL_WELD_CENTER_Y);
/** Khoảng đáy khối ảnh → chấm mối trên ray. */
const MACHINE_GAP_TO_RAIL = 6;
const WORKER_BADGE = 34;
/** Hai ngày gần nhau hơn (px) → xen kẽ độ cao để khỏi đè. */
const MACHINE_STAGGER_PX = 84;
const MACHINE_STAGGER_LIFT = 28;

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

function clusterHalfWidth(count: number, markerW: number) {
  if (count <= 0) return 0;
  return (count * markerW + (count - 1) * CLUSTER_GAP) / 2;
}

function recomputeAnchor(items: PlottedPlacement[], startMetres: number) {
  if (items.length === 0) return 0;
  return (
    items.reduce(
      (sum, item) => sum + (spanMid(item.span) - startMetres) * TRACK_PIXELS_PER_METRE,
      0,
    ) / items.length
  );
}

/**
 * Sau khi gom theo tâm, gộp tiếp các cụm mà hộp ký hiệu vẫn đè lên nhau
 * (ví dụ 3 công trình lệch nhau 20–30 px quanh cùng lý trình).
 */
function mergeOverlappingClusters(
  clusters: StructureCluster[],
  startMetres: number,
  markerW: number,
): StructureCluster[] {
  if (clusters.length < 2) return clusters;
  let list = [...clusters].sort((a, b) => a.anchorX - b.anchorX);
  let changed = true;
  while (changed) {
    changed = false;
    const next: StructureCluster[] = [];
    for (const cluster of list) {
      const prev = next[next.length - 1];
      if (!prev) {
        next.push({ id: cluster.id, items: [...cluster.items], anchorX: cluster.anchorX });
        continue;
      }
      const prevRight = prev.anchorX + clusterHalfWidth(prev.items.length, markerW);
      const nextLeft = cluster.anchorX - clusterHalfWidth(cluster.items.length, markerW);
      if (nextLeft < prevRight + CLUSTER_GAP) {
        prev.items = [...prev.items, ...cluster.items].sort((a, b) =>
          a.placement.id.localeCompare(b.placement.id),
        );
        prev.anchorX = recomputeAnchor(prev.items, startMetres);
        changed = true;
      } else {
        next.push({ id: cluster.id, items: [...cluster.items], anchorX: cluster.anchorX });
      }
    }
    list = next;
  }
  return list;
}

/** Gom công trình cùng (hoặc gần) một điểm tim → xếp hàng ngang, không chồng ô. */
function clusterStructures(
  items: PlottedPlacement[],
  startMetres: number,
  markerW: number = MARKER_W,
): StructureCluster[] {
  const sorted = [...items].sort((a, b) => spanMid(a.span) - spanMid(b.span));
  const clusters: StructureCluster[] = [];
  for (const item of sorted) {
    const centreX = (spanMid(item.span) - startMetres) * TRACK_PIXELS_PER_METRE;
    const hit = clusters.find((cluster) => Math.abs(cluster.anchorX - centreX) < SAME_CENTRE_PX);
    if (hit) {
      hit.items.push(item);
      hit.anchorX = recomputeAnchor(hit.items, startMetres);
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
  return mergeOverlappingClusters(clusters, startMetres, markerW);
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
  if (!src) return <Truck className="size-8 shrink-0 text-slate-500" aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={cutout ?? fallback ?? machine.id}
      src={src}
      alt=""
      className="h-[3.25rem] w-[4.5rem] shrink-0 object-contain drop-shadow"
      decoding="async"
      onError={() => {
        if (!useFallback && fallback && fallback !== src) setUseFallback(true);
      }}
    />
  );
}

function WorkerBadge({ machine }: { machine: MachineOnTrack }) {
  const src = safeWelderImageUrl(machine.welderImageUrl);
  const label = machine.welderName && machine.welderName !== "—" ? machine.welderName : "Công nhân";
  if (!src) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-slate-500 shadow"
        style={{ width: WORKER_BADGE, height: WORKER_BADGE }}
        title={label}
        aria-label={label}
      >
        <UserRound className="size-4" aria-hidden />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      title={label}
      className="shrink-0 rounded-full border-2 border-white object-cover shadow"
      style={{ width: WORKER_BADGE, height: WORKER_BADGE }}
      decoding="async"
    />
  );
}

/** Xen kẽ độ cao khi hai điểm gần nhau trên trục X. */
function machineLiftByIndex(sortedXs: number[], index: number): number {
  if (index <= 0) return 0;
  const gap = Math.abs(sortedXs[index]! - sortedXs[index - 1]!);
  if (gap >= MACHINE_STAGGER_PX) return 0;
  const prevLift = machineLiftByIndex(sortedXs, index - 1);
  return prevLift === 0 ? MACHINE_STAGGER_LIFT : 0;
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
}: {
  structures?: StructureLayer;
  /** Ảnh máy (danh-sach-may) gắn theo lý trình nhật ký — chồng lên sơ đồ chính. */
  machines?: MachineOnTrack[];
  rows: RailRow[];
  startMetres: number;
  width: number;
}) {
  const [hoverClusterId, setHoverClusterId] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const markerW = MARKER_W;
  const markerH = MARKER_H;
  const machineH = MACHINE_BLOCK_H;
  const showMachines = machines.some((machine) => machine.line === rows[0]?.line);

  const plottedStructures: PlottedPlacement[] = useMemo(
    () => {
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
    [structures, rows],
  );

  const clusters = useMemo(
    () => clusterStructures(plottedStructures, startMetres, markerW),
    [plottedStructures, startMetres, markerW],
  );

  const machinesOnLine = useMemo(() => {
    if (machines.length === 0) return [];
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
    if (!Number.isFinite(lineStart) || !Number.isFinite(lineEnd)) return [];
    // Giữ ngày nếu đoạn hàn giao với phạm vi tuyến.
    return machines.filter(
      (item) => item.line === rows[0]?.line && item.metres >= lineStart - 1 && item.metres <= lineEnd + 1,
    );
  }, [machines, rows]);

  const machinePlacements = useMemo(() => {
    const ranked = [...machinesOnLine]
      .map((day) => ({ day, x: (day.metres - startMetres) * TRACK_PIXELS_PER_METRE }))
      .sort((a, b) => a.x - b.x);
    const xs = ranked.map((item) => item.x);
    return ranked.map((item, index) => ({
      ...item,
      lift: machineLiftByIndex(xs, index),
      toneIndex: machinesOnLine.findIndex((day) => day.id === item.day.id),
    }));
  }, [machinesOnLine, startMetres]);

  useEffect(() => {
    if (!showMachines) setActiveDayId(null);
  }, [showMachines]);

  const activeDay = useMemo(
    () => machinesOnLine.find((day) => day.id === activeDayId) ?? null,
    [machinesOnLine, activeDayId],
  );

  const markerGapAboveAxis = 4;
  const symbolStackH = plottedStructures.length === 0 ? 0 : markerH;
  const chainageBandH = OVERLAP_H / 2 + 16;
  const hoverExtra = hoverClusterId ? 56 : 0;
  /** Ảnh máy overflow lên sát ray trên; tim chỉ chừa công trình + lý trình. */
  const padTop = 4 + (showMachines ? 10 : 0);
  const padBottom = 4;
  const rowHeight = Math.max(
    40,
    padTop + hoverExtra + symbolStackH + markerGapAboveAxis + chainageBandH + padBottom,
  );
  const axisY = padTop + hoverExtra + symbolStackH + markerGapAboveAxis;
  /** Đáy khối ảnh sát chấm mối trên ray trên. */
  const machineBottomY = UPPER_RAIL_WELD_TIP_Y - MACHINE_GAP_TO_RAIL;
  const machineBaseTop = machineBottomY - machineH;
  const markerTop = axisY - markerGapAboveAxis - markerH;
  const giaoThoa = overlapBands(plottedStructures);

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
      className={`grid grid-cols-[110px_1fr] gap-x-2 ${showMachines ? "relative z-30 overflow-visible" : ""}`}
      data-testid="track-centerline"
      aria-label="Tim tuyến giữa hai ray"
    >
      <div className="relative text-[10px] font-bold leading-3 text-slate-700" style={{ height: rowHeight }}>
        <span className="absolute left-0 -translate-y-1/2" style={{ top: axisY }}>
          Tim · {rows[0]?.line?.replace(/^TUYẾN\s+/i, "") ?? ""}
        </span>
      </div>
      <div className={`relative ${showMachines ? "overflow-visible" : ""}`} style={{ width, height: rowHeight }}>
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

        {machinePlacements.map(({ day, x, lift, toneIndex }) => {
            const tone = machineDayTone(toneIndex >= 0 ? toneIndex : 0);
            const box = trackSpanStyle(day.startMetres, day.endMetres, startMetres);
            const open = activeDayId === day.id;
            const label = day.machineCode || day.machineName;
            const welderLabel = day.welderName && day.welderName !== "—" ? day.welderName : "";
            const dayText = formatDayLabel(day.date);
            const hoursText = formatMachineDayHours(day.operatingHours);
            const top = machineBaseTop - lift;
            const stemTop = top + machineH;
            const stemHeight = Math.max(2, UPPER_RAIL_WELD_TIP_Y - stemTop);
            return (
              <div
                key={day.id}
                className="pointer-events-none absolute inset-y-0 z-20 overflow-visible"
                style={{ left: 0, width }}
                data-machine-day={day.id}
              >
                {/* Dải ngày mỏng trên tim */}
                <span
                  aria-hidden
                  className="absolute z-[11] -translate-y-1/2 rounded-full"
                  title={`${dayText} · ${hoursText} · ${day.weldCount} mối · Km ${formatChainage(day.startMetres)} – ${formatChainage(day.endMetres)}`}
                  style={{
                    left: box.left,
                    width: Math.max(12, box.width),
                    top: axisY,
                    height: DAY_BAND_H,
                    background: tone.fill,
                  }}
                />
                {/* Gióng ngắn xuống mối trên ray trên */}
                <span
                  aria-hidden
                  className="absolute z-[12] w-px -translate-x-1/2"
                  style={{
                    left: x,
                    top: stemTop,
                    height: stemHeight,
                    background: tone.ring,
                    opacity: 0.55,
                  }}
                />
                <span
                  aria-hidden
                  className="absolute z-[13] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
                  style={{ left: x, top: UPPER_RAIL_WELD_TIP_Y, background: tone.ring }}
                  title={day.weldCode ? `Mối cuối (ray trên): ${day.weldCode}` : "Mối hàn ray trên"}
                />
                <button
                  type="button"
                  data-testid="machine-on-track"
                  data-machine-metres={String(day.metres)}
                  aria-expanded={open}
                  aria-haspopup="dialog"
                  className={`pointer-events-auto absolute z-40 -translate-x-1/2 bg-transparent p-0 ${
                    open ? "rounded-md ring-2 ring-amber-400 ring-offset-1" : ""
                  }`}
                  style={{ left: x, top, width: MARKER_W_IMAGE, height: machineH }}
                  title={`Nhấn để xem nhật ký chạy máy · ${dayText} · ${label}${welderLabel ? ` · ${welderLabel}` : ""}`}
                  onClick={() => setActiveDayId(day.id)}
                >
                  <span className="relative flex flex-col items-center gap-0.5">
                    <span className="relative inline-flex items-end justify-center" style={{ height: MARKER_H_IMAGE, width: MARKER_W_IMAGE }}>
                      <MachineThumb machine={day} />
                      <span className="absolute -bottom-1 -right-1">
                        <WorkerBadge machine={day} />
                      </span>
                      {day.weldCount > 1 ? (
                        <span className="absolute -left-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-800/90 px-1 text-[8px] font-bold leading-none text-white">
                          {day.weldCount}
                        </span>
                      ) : null}
                    </span>
                    <span className="max-w-full truncate rounded bg-white/90 px-1 text-center text-[9px] font-semibold leading-[14px] text-slate-800">
                      {dayText}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}

        {activeDay ? (
          <MachineDayDetailModal day={activeDay} onClose={() => setActiveDayId(null)} />
        ) : null}

        {structures &&
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
                  <div className="flex items-center" style={{ gap: CLUSTER_GAP }}>
                    {cluster.items.map((plotted, index) => {
                      const codeOrName = structureLabel(plotted);
                      const selected =
                        structures.editingPlacementId === plotted.placement.id
                        || (open && activeId === plotted.placement.id);
                      /** Trong cụm ≥2: lệch hình sang trái/phải thay vì luôn căn giữa — dễ đọc khi gần nhau. */
                      const iconShift =
                        cluster.items.length <= 1
                          ? "justify-center"
                          : index % 2 === 0
                            ? "justify-start pl-0.5"
                            : "justify-end pr-0.5";
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
                          className={`flex shrink-0 items-center rounded border bg-white/95 shadow-sm hover:ring-2 hover:ring-blue-400 ${iconShift} ${
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
