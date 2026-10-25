import { Eye, Pencil, Shapes, Trash2 } from "lucide-react";
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

const MARKER_W = 64;
const MARKER_H = 48;
const LANE_GAP = 8;
/** Hai mốc coi là trùng tâm nếu lệch dưới ngưỡng này (px) → xòe đường dẫn. */
const SAME_CENTRE_PX = 8;
/** Lệch ngang đầu đường dẫn mỗi tầng khi trùng lý trình. */
const LEADER_FAN_PX = 8;
/** Độ dày vạch lý trình công trình trên đường tim. */
const SPAN_H = 10;
/** Độ dày vạch giao thoa (nổi hơn vạch đơn). */
const OVERLAP_H = 16;

function SymbolThumb({ symbol }: { symbol: StructureSymbol | undefined }) {
  const src = safeImageUrl(symbol?.image_url);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" className="h-11 w-16 shrink-0 object-contain" decoding="async" />
    : <Shapes className="size-8 shrink-0 text-amber-700" aria-hidden="true" />;
}

function spanMid(span: PlacementSpan) {
  return (span.startMetres + span.endMetres) / 2;
}

/** Xếp mốc công trình thành các tầng để không đè nhau — chỉ định vị, không che tim tuyến. */
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

/**
 * Xếp tầng ký hiệu chỉ phía trên đường tim (0 = sát tim, 1/2/… = lên cao hơn)
 * để không đè tên tuyến và mốc lý trình phía dưới.
 */
function laneShiftAbove(laneIndex: number): number {
  return -laneIndex;
}

interface MetreBand {
  startMetres: number;
  endMetres: number;
}

/**
 * Đoạn giao thoa: vùng lý trình có ≥ 2 công trình chồng nhau.
 * Sweep theo mét → các khoảng depth ≥ 2.
 */
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

/** Các công trình giao thoa (chồng lý trình) với một placement. */
function overlappingPeers(item: PlottedPlacement, all: PlottedPlacement[]): PlottedPlacement[] {
  return all.filter((other) => {
    if (other.placement.id === item.placement.id) return false;
    return other.span.startMetres < item.span.endMetres && item.span.startMetres < other.span.endMetres;
  });
}

/**
 * Chỉ số trong cụm trùng tâm (cùng lý trình gần như nhau) để xòe đường dẫn.
 * Trả về { index, size, anchorX } — anchorX là tâm chung trên trục.
 */
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
  /** Công trình thuộc tuyến này (Thượng/Hạ): khớp rowKey hoặc cùng line (dữ liệu cũ theo ray). */
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
  /** Khoảng trống giữa đáy ô ký hiệu và đường tim. */
  const markerGapAboveAxis = 8;
  const symbolStackH = laneCount * MARKER_H + (laneCount - 1) * LANE_GAP;
  const chainageBandH = OVERLAP_H / 2 + 18;
  const padTop = 8;
  const padBottom = 6;
  const rowHeight = Math.max(
    96,
    padTop + symbolStackH + markerGapAboveAxis + chainageBandH + padBottom,
  );
  /** Đường tim nằm dưới cụm ký hiệu. */
  const axisY = padTop + symbolStackH + markerGapAboveAxis;
  const giaoThoa = overlapBands(plottedStructures);

  /** Mốc lý trình ~500 m trên đường tim (Bước 1 khai tuyến). */
  const chainageTicks = (() => {
    let endMetres = startMetres;
    for (const row of rows) {
      for (const cell of row.cells) {
        const to = parseChainage(cell.to);
        if (to !== null && to > endMetres) endMetres = to;
      }
    }
    const ticks: { metres: number; key: string }[] = [];
    if (endMetres <= startMetres) return ticks;
    const step = 500;
    let metres = Math.ceil(startMetres / step) * step;
    if (startMetres % step === 0) metres = startMetres;
    for (; metres <= endMetres; metres += step) {
      ticks.push({ metres, key: `km-${metres}` });
    }
    if (endMetres % step !== 0) {
      ticks.push({ metres: endMetres, key: `km-end-${endMetres}` });
    }
    return ticks;
  })();

  return (
    <div className="grid grid-cols-[110px_1fr] gap-x-2" data-testid="track-centerline" aria-label="Tim tuyến">
      <div className="relative text-[11px] font-bold leading-4 text-slate-800" style={{ height: rowHeight }}>
        <span className="absolute left-0 -translate-y-1/2" style={{ top: axisY }}>
          {rows[0]?.line}
        </span>
      </div>
      <div className="relative" style={{ width, height: rowHeight }}>
        <div aria-hidden className="absolute left-0 h-px w-full border-t border-dashed border-slate-500" style={{ top: axisY }} />

        {chainageTicks.map(({ metres, key }) => {
          const x = (metres - startMetres) * TRACK_PIXELS_PER_METRE;
          return (
            <span key={key} className="pointer-events-none absolute z-[3] -translate-x-1/2" style={{ left: x, top: axisY + OVERLAP_H / 2 + 2 }} aria-hidden>
              <span className="mx-auto block h-3.5 w-0.5 bg-slate-700" />
              <span className="block whitespace-nowrap text-center text-[10px] font-bold leading-3 text-slate-800">
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
              const row = rows.find((item) => railRowKey(item) === placement.rowKey);
              const centreX = box.left + box.width / 2;
              const shift = laneShiftAbove(laneIndex);
              /** Đáy ô ký hiệu cách đường tim `markerGapAboveAxis`; tầng cao hơn lên phía trên. */
              const markerTop =
                axisY - markerGapAboveAxis - MARKER_H + shift * (MARKER_H + LANE_GAP);
              const peers = overlappingPeers(plotted, plottedStructures);
              const cluster = centreCluster(plotted, plottedStructures, startMetres);
              const fan =
                cluster.size > 1
                  ? (cluster.index - (cluster.size - 1) / 2) * LEADER_FAN_PX
                  : 0;
              const leaderTopX = centreX + fan;
              const leaderBottomX = cluster.size > 1 ? cluster.anchorX : centreX;
              const titlePeers =
                peers.length > 0
                  ? ` · Giao thoa: ${peers.map((p) => p.placement.label).join(", ")}`
                  : "";
              /** Luôn kẻ đường dẫn xuống tim vì ký hiệu nằm phía trên. */
              const needsLeader = true;
              const leaderFromY = markerTop + MARKER_H;
              const leaderToY = axisY;

              return (
                <div key={placement.id} className="pointer-events-none absolute inset-y-0 z-10" style={{ left: 0, width }}>
                  {/* Đoạn lý trình riêng — dày, đứt nét amber */}
                  <span
                    aria-hidden
                    className="absolute -translate-y-1/2 rounded-full border border-amber-600/50"
                    style={{
                      left: box.left,
                      width: Math.max(10, box.width),
                      top: axisY,
                      height: SPAN_H,
                      backgroundImage:
                        "repeating-linear-gradient(90deg, rgb(251 191 36 / 0.92) 0 6px, rgb(251 191 36 / 0.25) 6px 10px)",
                    }}
                  />
                  {needsLeader ? (
                    <svg
                      aria-hidden
                      className="pointer-events-none absolute left-0 top-0 overflow-visible"
                      width={width}
                      height={rowHeight}
                    >
                      <line
                        x1={leaderTopX}
                        y1={leaderFromY}
                        x2={leaderBottomX}
                        y2={leaderToY}
                        stroke="rgb(245 158 11 / 0.65)"
                        strokeWidth={1.5}
                      />
                    </svg>
                  ) : null}
                  {cluster.size > 1 && cluster.index === 0 ? (
                    <span
                      aria-hidden
                      title={`Trùng lý trình · ${cluster.size} công trình`}
                      className="absolute z-[12] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-600 ring-2 ring-white"
                      style={{ left: leaderBottomX, top: axisY }}
                    />
                  ) : null}
                  <div
                    data-placement={placement.id}
                    className={`group pointer-events-auto absolute z-20 flex -translate-x-1/2 items-center hover:z-30 focus-within:z-30 ${
                      structures.editingPlacementId === placement.id ? "rounded ring-2 ring-blue-400 ring-offset-1" : ""
                    } ${peers.length > 0 ? "ring-2 ring-amber-500/80 ring-offset-1" : "ring-1 ring-amber-400/60"}`}
                    style={{ left: leaderTopX, top: markerTop, height: MARKER_H }}
                  >
                    <button
                      type="button"
                      onClick={() => structures.onEditPlacement(placement)}
                      aria-label={`Chọn ${placement.label} để sửa${titlePeers}`}
                      title={`${placement.label} · Km ${formatChainage(span.startMetres)} – ${formatChainage(span.endMetres)}${titlePeers}`}
                      className="flex h-12 w-16 items-center justify-center rounded-md bg-white/95 shadow-md focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      <SymbolThumb symbol={symbol} />
                    </button>
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 w-56 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-left text-[11px] leading-4 text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                    >
                      <p className="font-semibold text-slate-900">{placement.label}</p>
                      <p>
                        Km {formatChainage(span.startMetres)} – {formatChainage(span.endMetres)}
                      </p>
                      {row ? <p>{row.line}</p> : null}
                      {symbol ? (
                        <p>
                          {symbol.name}
                          {symbol.code ? ` (${symbol.code})` : ""}
                        </p>
                      ) : null}
                      {peers.length > 0 ? (
                        <p className="mt-1 rounded bg-amber-50 px-1.5 py-1 text-amber-900">
                          Giao thoa lý trình với{" "}
                          {peers.map((p) => p.placement.label).join(", ")}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex gap-1">
                        <button type="button" aria-label={`Xem ${placement.label}`} title="Xem" className="rounded bg-slate-50 p-1 text-slate-600 hover:bg-slate-100 hover:text-blue-700">
                          <Eye className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => structures.onEditPlacement(placement)} aria-label={`Sửa ${placement.label}`} title="Sửa" className="rounded bg-slate-50 p-1 text-blue-700 hover:bg-blue-50">
                          <Pencil className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => structures.onRemovePlacement(placement.id)} aria-label={`Xóa ${placement.label}`} title="Xóa" className="rounded bg-slate-50 p-1 text-red-600 hover:bg-red-50">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }),
          )}

        {/* Vạch giao thoa — dày, sọc chéo nổi bật */}
        {giaoThoa.map((band) => {
          const box = trackSpanStyle(band.startMetres, band.endMetres, startMetres);
          const w = Math.max(12, box.width);
          return (
            <span
              key={`overlap-${band.startMetres}-${band.endMetres}`}
              aria-hidden
              title={`Giao thoa · Km ${formatChainage(band.startMetres)} – ${formatChainage(band.endMetres)}`}
              className="pointer-events-none absolute z-[11] -translate-y-1/2 rounded-md"
              style={{
                left: box.left,
                width: w,
                top: axisY,
                height: OVERLAP_H,
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgb(180 83 9) 0 4px, rgb(253 224 71) 4px 8px)",
                boxShadow: "0 0 0 1.5px rgb(146 64 14 / 0.55), 0 1px 3px rgb(0 0 0 / 0.12)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
