import { Shapes } from "lucide-react";
import { safeImageUrl } from "@lwr/lib/safe-url";
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

const MARKER_W = 40;
const MARKER_H = 28;
const LANE_GAP = 4;
const SAME_CENTRE_PX = 8;
const LEADER_FAN_PX = 6;
const SPAN_H = 6;
const OVERLAP_H = 10;

function SymbolThumb({ symbol }: { symbol: StructureSymbol | undefined }) {
  const src = safeImageUrl(symbol?.image_url);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" className="h-6 w-9 shrink-0 object-contain" decoding="async" />
    : <Shapes className="size-5 shrink-0 text-amber-700" aria-hidden="true" />;
}

function spanMid(span: PlacementSpan) {
  return (span.startMetres + span.endMetres) / 2;
}

function packStructureLanes(items: PlottedPlacement[]): PlottedPlacement[][] {
  const sorted = [...items].sort((a, b) => spanMid(a.span) - spanMid(b.span));
  const lanes: PlottedPlacement[][] = [];
  for (const item of sorted) {
    const centre = spanMid(item.span);
    const lane = lanes.find((current) =>
      current.every((other) => Math.abs(centre - spanMid(other.span)) * TRACK_PIXELS_PER_METRE >= MARKER_W + 4),
    );
    if (lane) lane.push(item);
    else lanes.push([item]);
  }
  return lanes;
}

function laneShiftAbove(laneIndex: number): number {
  return -laneIndex;
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

function centreCluster(
  item: PlottedPlacement,
  all: PlottedPlacement[],
  startMetres: number,
): { index: number; size: number; anchorX: number } {
  const centreM = spanMid(item.span);
  const centreX = (centreM - startMetres) * TRACK_PIXELS_PER_METRE;
  const cluster = all
    .filter((other) => Math.abs((spanMid(other.span) - startMetres) * TRACK_PIXELS_PER_METRE - centreX) < SAME_CENTRE_PX)
    .sort((a, b) => a.placement.id.localeCompare(b.placement.id));
  const index = Math.max(0, cluster.findIndex((other) => other.placement.id === item.placement.id));
  const anchorX =
    cluster.reduce((sum, other) => sum + (spanMid(other.span) - startMetres) * TRACK_PIXELS_PER_METRE, 0) /
    Math.max(1, cluster.length);
  return { index, size: cluster.length, anchorX };
}

/**
 * Đường tim nằm giữa Ray trái / Ray phải của cùng tuyến.
 * Chỉ biểu tượng nhỏ trên bản vẽ — tên/mã xem Legend bên dưới.
 */
export function TrackCenterline({
  structures,
  rows,
  startMetres,
  width,
}: {
  structures?: StructureLayer;
  rows: RailRow[];
  startMetres: number;
  width: number;
}) {
  const plottedStructures: PlottedPlacement[] = (structures?.placements ?? []).flatMap((placement) => {
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
  const structureLanes = packStructureLanes(plottedStructures);
  const laneCount = Math.max(1, structureLanes.length);
  const markerGapAboveAxis = 4;
  const symbolStackH = plottedStructures.length === 0 ? 0 : laneCount * MARKER_H + (laneCount - 1) * LANE_GAP;
  const chainageBandH = OVERLAP_H / 2 + 16;
  const padTop = plottedStructures.length === 0 ? 4 : 4;
  const padBottom = 4;
  const rowHeight = Math.max(
    40,
    padTop + symbolStackH + markerGapAboveAxis + chainageBandH + padBottom,
  );
  const axisY = padTop + symbolStackH + markerGapAboveAxis;
  const giaoThoa = overlapBands(plottedStructures);

  // Extent riêng của tuyến này — không kéo bằng canvas chung (Thượng ≠ Hạ).
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
    <div className="grid grid-cols-[110px_1fr] gap-x-2" data-testid="track-centerline" aria-label="Tim tuyến giữa hai ray">
      <div className="relative text-[10px] font-bold leading-3 text-slate-700" style={{ height: rowHeight }}>
        <span className="absolute left-0 -translate-y-1/2" style={{ top: axisY }}>
          Tim · {rows[0]?.line?.replace(/^TUYẾN\s+/i, "") ?? ""}
        </span>
      </div>
      <div className="relative" style={{ width, height: rowHeight }}>
        {/* Đường tim chỉ dài theo extent tuyến — không kéo full canvas cho bằng tuyến kia */}
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

        {structures &&
          structureLanes.flatMap((laneItems, laneIndex) =>
            laneItems.map((plotted) => {
              const { placement, span, symbol } = plotted;
              const box = trackSpanStyle(span.startMetres, span.endMetres, startMetres);
              const centreX = box.left + box.width / 2;
              const shift = laneShiftAbove(laneIndex);
              const markerTop =
                axisY - markerGapAboveAxis - MARKER_H + shift * (MARKER_H + LANE_GAP);
              const cluster = centreCluster(plotted, plottedStructures, startMetres);
              const fan =
                cluster.size > 1
                  ? (cluster.index - (cluster.size - 1) / 2) * LEADER_FAN_PX
                  : 0;
              const leaderTopX = centreX + fan;
              const leaderBottomX = cluster.size > 1 ? cluster.anchorX : centreX;
              const codeOrName = symbol?.code || placement.label || symbol?.name || "CT";
              const title = `${codeOrName} · Km ${formatChainage(span.startMetres)} – ${formatChainage(span.endMetres)} (xem Legend)`;

              return (
                <div key={placement.id} className="pointer-events-none absolute inset-y-0 z-10" style={{ left: 0, width }}>
                  <span
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
                  <svg
                    aria-hidden
                    className="pointer-events-none absolute left-0 top-0 overflow-visible"
                    width={width}
                    height={rowHeight}
                  >
                    <line
                      x1={leaderTopX}
                      y1={markerTop + MARKER_H}
                      x2={leaderBottomX}
                      y2={axisY}
                      stroke="rgb(245 158 11 / 0.55)"
                      strokeWidth={1.25}
                    />
                  </svg>
                  {cluster.size > 1 && cluster.index === 0 ? (
                    <span
                      aria-hidden
                      className="absolute z-[12] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-600 ring-1 ring-white"
                      style={{ left: leaderBottomX, top: axisY }}
                    />
                  ) : null}
                  <button
                    type="button"
                    data-placement={placement.id}
                    onClick={() => structures.onEditPlacement(placement)}
                    aria-label={`Sửa ${codeOrName}`}
                    title={title}
                    className={`pointer-events-auto absolute z-20 flex -translate-x-1/2 items-center justify-center rounded border bg-white/95 shadow-sm hover:ring-2 hover:ring-blue-400 ${
                      structures.editingPlacementId === placement.id ? "ring-2 ring-blue-500" : "ring-1 ring-amber-400/50"
                    }`}
                    style={{ left: leaderTopX, top: markerTop, width: MARKER_W, height: MARKER_H }}
                  >
                    <SymbolThumb symbol={symbol} />
                  </button>
                </div>
              );
            }),
          )}

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
