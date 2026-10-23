"use client";

import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Eye, Pencil, Shapes, Trash2 } from "lucide-react";
import { safeImageUrl } from "@lwr/lib/safe-url";
import {
  compareLongRailDisplay,
  coveringLongRail,
  getPlacementSpan,
  railRowKey,
  trackExtent,
  trackSpanStyle,
  visibleLongRailSpan,
  TRACK_PIXELS_PER_METRE,
  parseChainage,
  formatChainage,
  type PlacementSpan,
  type TrackLayout,
  type TrackPlacement,
} from "@lwr/lib/track-editor";
import type { StructureSymbol } from "@lwr/types/structure";
import type { RailJoint } from "@lwr/types/weld";
import { jointDisplayMethod, weldMethodTone } from "@lwr/lib/weld-track-map";

const SYMBOL_STACK = 48;
const SYMBOL_GAP = 24;
const PAIR_GAP = 56;

interface PlottedPlacement {
  placement: TrackPlacement;
  span: PlacementSpan;
  symbol: StructureSymbol | undefined;
}

function packSymbolLanes(items: PlottedPlacement[]): PlottedPlacement[][] {
  const lanes: PlottedPlacement[][] = [];
  for (const item of items) {
    const centre = (item.span.startMetres + item.span.endMetres) / 2;
    const lane = lanes.find((current) =>
      current.every((other) => Math.abs((other.span.startMetres + other.span.endMetres) / 2 - centre) >= 700),
    );
    if (lane) lane.push(item);
    else lanes.push([item]);
  }
  return lanes;
}

const TRACK_H = 4;
const OVERLAY_H = 20;
const ICON_H = 40;
const DAT_GREEN = "#059669";
const UNRATED_GRAY = "#94a3b8";

function segmentColor(released: boolean | undefined) {
  return released ? DAT_GREEN : UNRATED_GRAY;
}

function overlayTop(trackTop: number) {
  return trackTop - Math.round((OVERLAY_H - TRACK_H) / 2);
}

function SymbolImage({ symbol }: { symbol: StructureSymbol | undefined }) {
  const src = safeImageUrl(symbol?.image_url);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" className="h-10 w-14 shrink-0 object-contain" decoding="async" />
    : <Shapes className="size-6 shrink-0 text-blue-600" aria-hidden="true" />;
}

export const TrackMapCanvas = memo(function TrackMapCanvas({
  joints,
  onSelectJoint,
  layout,
  symbols,
  selectedLongRailId,
  selectedCellId,
  editingPlacementId,
  onSelectLongRail,
  onEditPlacement,
  onRemovePlacement,
  children,
}: {
  joints: RailJoint[];
  onSelectJoint: (joint: RailJoint) => void;
  layout: TrackLayout;
  symbols: StructureSymbol[];
  selectedLongRailId: string | null;
  selectedCellId?: string | null;
  editingPlacementId: string | null;
  onSelectLongRail: (id: string) => void;
  onEditPlacement: (placement: TrackPlacement) => void;
  onRemovePlacement: (id: string) => void;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedCellRef = useRef<HTMLSpanElement>(null);
  const dragState = useRef({ down: false, dragging: false, startX: 0, startLeft: 0 });
  const arrowRaf = useRef(0);
  const arrowPrev = useRef({ left: false, right: false });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const columns = Math.max(...layout.rows.map((item) => item.cells.length), 1);
  const extent = trackExtent(layout.rows);
  const trackWidth = Math.max(1, (extent.endMetres - extent.startMetres) * TRACK_PIXELS_PER_METRE);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    if (left === arrowPrev.current.left && right === arrowPrev.current.right) return;
    arrowPrev.current = { left, right };
    setCanLeft(left);
    setCanRight(right);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (arrowRaf.current) return;
      arrowRaf.current = requestAnimationFrame(() => {
        arrowRaf.current = 0;
        updateArrows();
      });
    };
    // Native horizontal wheel only — avoid non-passive preventDefault jank on every wheel tick.
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (arrowRaf.current) cancelAnimationFrame(arrowRaf.current);
    };
  }, [updateArrows, columns]);

  useEffect(() => {
    selectedCellRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedCellId]);

  function scrollByStep(direction: 1 | -1) {
    scrollRef.current?.scrollBy({
      left: direction * Math.max(320, (scrollRef.current?.clientWidth ?? 600) * 0.7),
      behavior: "smooth",
    });
  }

  const plotted = layout.placements.flatMap((placement): PlottedPlacement[] => {
    const span = getPlacementSpan(layout.rows, placement);
    return span ? [{ placement, span, symbol: symbols.find((item) => item.id === placement.symbolId) }] : [];
  });
  const plottedLongRails = layout.longRails.flatMap((longRail) => {
    const span = visibleLongRailSpan(layout.rows, longRail);
    return span ? [{ longRail, span }] : [];
  });

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white [contain:layout]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <h3 className="text-sm font-bold">Sơ đồ tuyến và dải ray · {columns} thanh / dải</h3>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 hidden items-center gap-2 text-xs text-slate-500 sm:flex">
            <span className="inline-flex items-center gap-1"><span className="h-[3px] w-5 rounded bg-black" />Đường ray</span>
            <span className="inline-flex items-center gap-1"><span className="h-px w-8 border-t-[1.5px] border-dashed border-black" />Đường tim</span>
            <ArrowLeftRight className="size-4" />Shift + lăn chuột / kéo
          </span>
          <button type="button" onClick={() => scrollByStep(-1)} disabled={!canLeft} aria-label="Cuộn sang trái" className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft className="size-4" /></button>
          <button type="button" onClick={() => scrollByStep(1)} disabled={!canRight} aria-label="Cuộn sang phải" className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="cursor-grab overflow-x-auto overscroll-x-contain active:cursor-grabbing"
        data-testid="track-scroll"
        tabIndex={0}
        aria-label="Cuộn ngang sơ đồ tuyến. Dùng Shift + lăn chuột, nút mũi tên, hoặc kéo."
        onPointerDown={(e) => {
          const el = scrollRef.current;
          if (!el || e.button !== 0) return;
          if ((e.target as HTMLElement | null)?.closest("button, a, input, select, textarea, label")) return;
          dragState.current = { down: true, dragging: false, startX: e.clientX, startLeft: el.scrollLeft };
        }}
        onPointerMove={(e) => {
          const el = scrollRef.current;
          const drag = dragState.current;
          if (!el || !drag.down) return;
          const delta = e.clientX - drag.startX;
          if (!drag.dragging && Math.abs(delta) < 8) return;
          drag.dragging = true;
          el.setPointerCapture?.(e.pointerId);
          el.scrollLeft = drag.startLeft - delta;
        }}
        onPointerUp={() => { dragState.current.down = false; dragState.current.dragging = false; }}
        onPointerCancel={() => { dragState.current.down = false; dragState.current.dragging = false; }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); scrollByStep(-1); }
          if (e.key === "ArrowRight") { e.preventDefault(); scrollByStep(1); }
        }}
      >
        <div style={{ width: 150 + trackWidth, minWidth: 150 + trackWidth }}>
          <div className="space-y-0 px-4 py-4">
            {layout.longRails.length === 0 && layout.placements.length === 0 && (
              <p className="mb-3 text-xs text-slate-500">Chưa có thanh dài hoặc công trình. Thêm ở các form phía trên.</p>
            )}
            {layout.rows.map((rail, index) => {
              const key = railRowKey(rail);
              const rowCoverItems = plottedLongRails
                .filter((item) => item.longRail.rowKey === key)
                .map((item) => ({ rail: item.longRail, span: item.span }));
              const coverRuns: { rail: (typeof rowCoverItems)[number]["rail"]; startMetres: number; endMetres: number; cellIds: string[] }[] = [];
              for (const cell of rail.cells) {
                if (!cell.placed && !cell.released) continue;
                const from = parseChainage(cell.from) ?? 0;
                const to = parseChainage(cell.to) ?? 0;
                const cover = coveringLongRail(rowCoverItems, from, to, selectedLongRailId);
                if (!cover) continue;
                const last = coverRuns[coverRuns.length - 1];
                if (last && last.rail.id === cover.rail.id && last.endMetres === from) {
                  last.endMetres = to;
                  last.cellIds.push(cell.id);
                } else coverRuns.push({ rail: cover.rail, startMetres: from, endMetres: to, cellIds: [cell.id] });
              }
              const leftoverRails = rowCoverItems
                .filter(({ span }) => !rail.cells.some((cell) => {
                  if (!cell.placed && !cell.released) return false;
                  const from = parseChainage(cell.from) ?? 0;
                  const to = parseChainage(cell.to) ?? 0;
                  return from < span.endMetres && to > span.startMetres;
                }))
                .map(({ rail: leftover, span }) => ({ rail: leftover, startMetres: span.startMetres, endMetres: span.endMetres, cellIds: [] as string[] }));
              const nestedInside = (
                item: { rail: { id: string }; startMetres: number; endMetres: number },
                list: { rail: { id: string }; startMetres: number; endMetres: number }[],
              ) => list.some((other) => (
                other.rail.id !== item.rail.id
                && other.startMetres <= item.startMetres
                && other.endMetres >= item.endMetres
                && (other.endMetres - other.startMetres) > (item.endMetres - item.startMetres)
              ));
              const railLongRails = [...coverRuns, ...leftoverRails]
                .filter((item) => item.rail.id === selectedLongRailId || !nestedInside(item, [...coverRuns, ...leftoverRails]))
                .sort((a, b) => -compareLongRailDisplay(
                  a.rail,
                  b.rail,
                  selectedLongRailId,
                  a.endMetres - a.startMetres,
                  b.endMetres - b.startMetres,
                ));
              const structureLanes = packSymbolLanes(plotted.filter((item) => item.placement.rowKey === key));
              const stackCount = structureLanes.length;
              const stackH = stackCount === 0 ? 0 : 8 + stackCount * SYMBOL_STACK + SYMBOL_GAP;
              const nextRail = layout.rows[index + 1];
              const prevRail = layout.rows[index - 1];
              const pairNext = Boolean(nextRail && nextRail.line === rail.line);
              const pairPrev = Boolean(prevRail && prevRail.line === rail.line);
              const overlayPad = Math.round((OVERLAY_H - TRACK_H) / 2);
              const trackTop = pairPrev ? overlayPad : Math.max(stackH, 24, overlayPad);
              const labelH = 16;
              const belowRail = pairNext ? overlayPad + labelH : pairPrev ? Math.max(stackH, 28) : 36;
              const rowHeight = trackTop + TRACK_H + belowRail;
              const pairLabelTop = overlayTop(trackTop) + OVERLAY_H + 2;
              return (
                <div key={key}>
                <div className={`grid grid-cols-[110px_1fr] gap-x-2 ${pairPrev ? "items-start" : "items-end"}`} data-testid="symbol-lane">
                  <span className="text-[11px] leading-4 text-slate-500">{rail.line}<br />{rail.rail}</span>
                  <div className="relative" style={{ height: rowHeight, width: trackWidth }}>
                    <div data-testid="track-line" className="absolute inset-x-0 rounded bg-black" style={{ top: trackTop, height: TRACK_H }} />
                    {joints.filter(joint => joint.rowKey === key).map(joint => <button
                      key={joint.id}
                      type="button"
                      aria-label={`Mối hàn tuyến ${rail.line} ${rail.rail} Km${joint.chainage}`}
                      title={`${joint.chainage} · ${joint.welds.map(weld => weld.code).join(", ") || "Chưa hàn"}`}
                      onClick={() => onSelectJoint(joint)}
                      className="absolute z-20 flex size-6 -translate-x-1/2 appearance-none items-center justify-center border-0 bg-transparent p-0"
                      style={{ left: (joint.metres - extent.startMetres) * TRACK_PIXELS_PER_METRE, top: trackTop - 10 }}
                    >
                      <span className={`block size-3 rounded-full border-0 shadow-[0_0_0_1.5px_rgba(255,255,255,0.9)] ${weldMethodTone(jointDisplayMethod(joint, layout.longRails, layout.rows, selectedLongRailId, selectedCellId))}`} />
                    </button>)}
                    {rail.cells.map((cell) => {
                      if (cell.id !== selectedCellId) return null;
                      const from = parseChainage(cell.from);
                      if (from === null) return null;
                      return (
                        <span
                          key={`sel-${cell.id}`}
                          ref={selectedCellRef}
                          data-testid="track-selected-cell"
                          className="pointer-events-none absolute h-px w-px"
                          style={{ left: (from - extent.startMetres) * TRACK_PIXELS_PER_METRE, top: overlayTop(trackTop) }}
                        />
                      );
                    })}
                    {railLongRails.map(({ rail: longRail, startMetres, endMetres, cellIds }) => {
                      const box = trackSpanStyle(startMetres, endMetres, extent.startMetres);
                      const selected = longRail.id === selectedLongRailId;
                      const segments = cellIds.length
                        ? cellIds.map((cellId) => {
                            const cell = rail.cells.find((item) => item.id === cellId);
                            const from = parseChainage(cell?.from ?? "") ?? startMetres;
                            const to = parseChainage(cell?.to ?? "") ?? endMetres;
                            return { cellId, from, to, released: cell?.released, color: segmentColor(cell?.released) };
                          })
                        : [{ cellId: longRail.id, from: startMetres, to: endMetres, released: Boolean(longRail.completedAt), color: segmentColor(Boolean(longRail.completedAt)) }];
                      const cellLabel = cellIds.length && cellIds.length <= 3 ? `${cellIds.join(" ")} · ` : "";
                      const labelColor = segments.every((item) => item.released) ? DAT_GREEN : UNRATED_GRAY;
                      return (
                        <span key={`${longRail.id}:${startMetres}`}>
                          {segments.map((segment) => (
                            <button
                              key={segment.cellId}
                              type="button"
                              data-long-rail={longRail.id}
                              data-testid="track-short-fill"
                              onClick={(event) => {
                                event.stopPropagation();
                                dragState.current.down = false;
                                onSelectLongRail(longRail.id);
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                              title={`${segment.cellId === longRail.id ? "" : `${segment.cellId} · `}${longRail.code} · ${longRail.params.railType}${segment.released ? " · Đạt" : ""} · Km ${formatChainage(segment.from)} – ${formatChainage(segment.to)}`}
                              aria-label={`Xem thông số thanh dài ${longRail.code}`}
                              className={`absolute z-[6] appearance-none rounded-none border-0 p-0 focus-visible:outline-2 ${selected ? "ring-2" : ""}`}
                              style={{
                                left: box.left + (segment.from - startMetres) * TRACK_PIXELS_PER_METRE,
                                width: Math.max(8, (segment.to - segment.from) * TRACK_PIXELS_PER_METRE),
                                top: overlayTop(trackTop),
                                height: OVERLAY_H,
                                backgroundColor: segment.color,
                                outlineColor: segment.color,
                              }}
                            />
                          ))}
                          <span className="pointer-events-none absolute z-10 max-w-full -translate-x-1/2 truncate rounded bg-white px-1.5 py-px text-[11px] font-bold shadow-sm" style={{ left: box.left + box.width / 2, top: pairLabelTop, color: labelColor }}>
                            {cellLabel}{longRail.code} · {longRail.params.railType}
                          </span>
                        </span>
                      );
                    })}
                    {structureLanes.flatMap((items, laneIndex) => items.map(({ placement, span, symbol }) => {
                      const box = trackSpanStyle(span.startMetres, span.endMetres, extent.startMetres);
                      const iconTop = pairPrev ? trackTop + SYMBOL_GAP + 4 + laneIndex * SYMBOL_STACK : 4 + laneIndex * SYMBOL_STACK;
                      const railTop = overlayTop(trackTop);
                      const railBottom = railTop + OVERLAY_H;
                      const iconBottom = iconTop + ICON_H;
                      const guideTop = pairPrev ? railBottom : iconBottom;
                      const guideHeight = pairPrev ? Math.max(6, iconTop - railBottom) : Math.max(6, railTop - iconBottom);
                      const guideWidth = Math.max(box.width, 8);
                      return (
                        <span key={placement.id}>
                        <div
                          aria-hidden
                          data-testid="structure-guide"
                          className="pointer-events-none absolute z-[5] flex items-center justify-center overflow-hidden border border-dashed border-slate-500/70 bg-slate-400/25 px-0.5"
                          style={{ left: box.left, width: guideWidth, top: guideTop, height: guideHeight }}
                        >
                          <span className="max-h-full max-w-full overflow-hidden text-center text-[9px] font-semibold leading-tight text-slate-600 [overflow-wrap:anywhere] line-clamp-2">
                            {placement.label || symbol?.code || symbol?.name}
                          </span>
                        </div>
                        <div
                          data-placement={placement.id}
                          className={`group absolute z-10 flex items-center ${editingPlacementId === placement.id ? "rounded ring-2 ring-blue-400 ring-offset-1" : ""}`}
                          style={{ left: box.left + box.width / 2, top: iconTop, transform: "translateX(-50%)" }}
                        >
                          <button
                            type="button"
                            onClick={() => onEditPlacement(placement)}
                            aria-label={`Chọn ${placement.label} để sửa`}
                            className="flex h-10 w-14 items-center justify-center focus-visible:rounded focus-visible:outline-2 focus-visible:outline-blue-600"
                          >
                            <SymbolImage symbol={symbol} />
                          </button>
                          <div
                            role="tooltip"
                            className="pointer-events-none absolute left-full top-0 z-30 ml-1 w-56 rounded-lg border border-slate-200 bg-white p-2 text-left text-[11px] leading-4 text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                          >
                            <p className="font-semibold text-slate-900">{placement.label}</p>
                            <p>Km {formatChainage(span.startMetres)} – {formatChainage(span.endMetres)}</p>
                            <p>{rail.line} · {rail.rail}</p>
                            {symbol ? <p>{symbol.name}{symbol.code ? ` (${symbol.code})` : ""}</p> : null}
                            <div className="mt-1.5 flex gap-1">
                              <button type="button" aria-label={`Xem ${placement.label}`} title="Xem" className="rounded bg-slate-50 p-1 text-slate-600 hover:bg-slate-100 hover:text-blue-700"><Eye className="size-3.5" /></button>
                              <button type="button" onClick={() => onEditPlacement(placement)} aria-label={`Sửa ${placement.label}`} title="Sửa" className="rounded bg-slate-50 p-1 text-blue-700 hover:bg-blue-50"><Pencil className="size-3.5" /></button>
                              <button type="button" onClick={() => onRemovePlacement(placement.id)} aria-label={`Xóa ${placement.label}`} title="Xóa" className="rounded bg-slate-50 p-1 text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                            </div>
                          </div>
                        </div>
                        </span>
                      );
                    }))}
                  </div>
                </div>
                {pairNext ? (
                  <div className="grid grid-cols-[110px_1fr] gap-x-2" aria-hidden="true">
                    <span />
                    <svg width={trackWidth} height={PAIR_GAP} className="block overflow-visible" data-testid="track-centerline">
                      <line
                        x1="0"
                        y1={PAIR_GAP / 2}
                        x2={trackWidth}
                        y2={PAIR_GAP / 2}
                        stroke="#111"
                        strokeWidth="1.5"
                        strokeDasharray="5 4"
                        strokeLinecap="butt"
                      />
                    </svg>
                  </div>
                ) : nextRail ? (
                  <div className="h-8" aria-hidden="true" />
                ) : null}
                </div>
              );
            })}
            <div className="grid grid-cols-[110px_1fr] gap-x-2 pt-1">
              <span className="text-xs font-medium text-slate-600">Lý trình</span>
              <div className="relative border-t border-slate-200 pt-1" style={{ width: trackWidth, height: 16 }}>
                {layout.rows[0]?.cells.map((cell, index) => (
                  <div
                    key={cell.id}
                    className="absolute flex justify-between text-[10px] text-slate-500"
                    style={trackSpanStyle(parseChainage(cell.from) ?? 0, parseChainage(cell.to) ?? 0, extent.startMetres)}
                  >
                    <span>Km {cell.from}</span>
                    {index === columns - 1 && <span>Km {cell.to}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
});
