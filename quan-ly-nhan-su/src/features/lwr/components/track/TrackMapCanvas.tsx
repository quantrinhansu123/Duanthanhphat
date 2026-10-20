"use client";

import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Pencil, Shapes, Trash2 } from "lucide-react";
import { safeImageUrl } from "@lwr/lib/safe-url";
import {
  getPlacementSpan,
  railRowKey,
  type LongRail,
  type PlacementSpan,
  type TrackLayout,
  type TrackPlacement,
} from "@lwr/lib/track-editor";
import type { StructureSymbol } from "@lwr/types/structure";

const CELL_W = 110;
const CELL_GAP = 8;

interface PlottedPlacement {
  placement: TrackPlacement;
  span: PlacementSpan;
  symbol: StructureSymbol | undefined;
}

function packSymbolLanes(items: PlottedPlacement[]): PlottedPlacement[][] {
  const lanes: PlottedPlacement[][] = [];
  for (const item of items) {
    const centre = (item.span.startIndex + item.span.endIndex) / 2;
    const lane = lanes.find((current) =>
      current.every((other) => Math.abs((other.span.startIndex + other.span.endIndex) / 2 - centre) >= 1.5),
    );
    if (lane) lane.push(item);
    else lanes.push([item]);
  }
  return lanes;
}

function SymbolImage({ symbol }: { symbol: StructureSymbol | undefined }) {
  const src = safeImageUrl(symbol?.image_url);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" className="h-10 w-14 shrink-0 object-contain" decoding="async" />
    : <Shapes className="size-6 shrink-0 text-blue-600" aria-hidden="true" />;
}

function spanStyle(span: PlacementSpan): { left: number; width: number } {
  const left = span.startIndex * (CELL_W + CELL_GAP);
  const cells = span.endIndex - span.startIndex + 1;
  const width = cells * CELL_W + (cells - 1) * CELL_GAP;
  return { left, width };
}

export const TrackMapCanvas = memo(function TrackMapCanvas({
  layout,
  symbols,
  selectedLongRailId,
  editingPlacementId,
  onSelectLongRail,
  onEditPlacement,
  onRemovePlacement,
  children,
}: {
  layout: TrackLayout;
  symbols: StructureSymbol[];
  selectedLongRailId: string | null;
  editingPlacementId: string | null;
  onSelectLongRail: (id: string) => void;
  onEditPlacement: (placement: TrackPlacement) => void;
  onRemovePlacement: (id: string) => void;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ down: false, dragging: false, startX: 0, startLeft: 0 });
  const arrowRaf = useRef(0);
  const arrowPrev = useRef({ left: false, right: false });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const columns = Math.max(...layout.rows.map((item) => item.cells.length), 1);
  const trackWidth = columns * CELL_W + Math.max(0, columns - 1) * CELL_GAP;

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
    const span = getPlacementSpan(layout.rows, longRail);
    return span ? [{ longRail, span }] : [];
  });

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white [contain:layout]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <h3 className="text-sm font-bold">Sơ đồ tuyến và dải ray · {columns} thanh / dải</h3>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 hidden items-center gap-1 text-xs text-slate-500 sm:flex">
            <ArrowLeftRight className="size-4" />Shift + lăn chuột / kéo · bấm đoạn teal = thanh dài
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
        <div style={{ width: 142 + trackWidth, minWidth: 142 + trackWidth }}>
          <div className="space-y-2 px-4 py-4">
            {layout.longRails.length === 0 && layout.placements.length === 0 && (
              <p className="mb-3 text-xs text-slate-500">Chưa có thanh dài hoặc công trình. Thêm ở các form phía trên.</p>
            )}
            {layout.rows.map((rail) => {
              const key = railRowKey(rail);
              const railLongRails = plottedLongRails.filter((item) => item.longRail.rowKey === key);
              const structureLanes = packSymbolLanes(plotted.filter((item) => item.placement.rowKey === key));
              const stackCount = Math.max(structureLanes.length, 1);
              const labelStack = 56;
              const trackTop = 12 + stackCount * labelStack;
              const rowHeight = trackTop + 36;
              return (
                <div key={key} className="grid grid-cols-[110px_1fr] items-end gap-x-2" data-testid="symbol-lane">
                  <span className="pb-4 text-[11px] text-slate-500">{rail.line}<br />{rail.rail}</span>
                  <div className="relative" style={{ height: rowHeight, width: trackWidth }}>
                    <div data-testid="track-line" className="absolute inset-x-0 h-[3px] rounded bg-emerald-600" style={{ top: trackTop }} />
                    {railLongRails.map(({ longRail, span }) => {
                      const box = spanStyle(span);
                      const selected = longRail.id === selectedLongRailId;
                      return (
                        <button
                          key={longRail.id}
                          type="button"
                          data-long-rail={longRail.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            dragState.current.down = false;
                            onSelectLongRail(longRail.id);
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          title={`${longRail.code} · ${longRail.label} · Km ${span.startCell.from} – ${span.endCell.to}`}
                          aria-label={`Xem thông số thanh dài ${longRail.code}`}
                          className={`absolute z-[5] rounded-sm focus-visible:outline-2 focus-visible:outline-teal-600 ${selected ? "ring-2 ring-teal-500 ring-offset-1" : ""}`}
                          style={{ left: box.left, width: box.width, top: 0, height: rowHeight }}
                        >
                          <span className={`absolute inset-x-0 h-[15px] rounded-sm ${selected ? "bg-teal-500/55" : "bg-teal-400/40"}`} style={{ top: trackTop - 6 }} />
                          <span className="absolute left-0 h-[17px] w-[3px] rounded bg-teal-700" style={{ top: trackTop - 7 }} />
                          <span className="absolute right-0 h-[17px] w-[3px] rounded bg-teal-700" style={{ top: trackTop - 7 }} />
                          <span className="absolute left-1/2 z-10 max-w-full -translate-x-1/2 truncate rounded bg-white/90 px-1 text-[10px] font-semibold text-teal-900" style={{ top: trackTop + 10 }}>
                            {longRail.code}
                          </span>
                        </button>
                      );
                    })}
                    {structureLanes.flatMap((items, laneIndex) => items.map(({ placement, span, symbol }) => {
                      const box = spanStyle(span);
                      const stackTop = 4 + laneIndex * labelStack;
                      return (
                        <div
                          key={placement.id}
                          data-placement={placement.id}
                          className="group absolute z-10"
                          style={{ left: box.left, width: box.width, top: 0, height: rowHeight }}
                        >
                          {laneIndex === 0 && (
                            <>
                              <div className="pointer-events-none absolute inset-x-0 h-[15px] bg-amber-300/35" style={{ top: trackTop - 6 }} />
                              <div className="pointer-events-none absolute left-0 h-[17px] w-[3px] rounded bg-blue-600" style={{ top: trackTop - 7 }} />
                              <div className="pointer-events-none absolute right-0 h-[17px] w-[3px] rounded bg-blue-600" style={{ top: trackTop - 7 }} />
                            </>
                          )}
                          <div className="absolute left-1/2 z-10 w-[150px] max-w-full -translate-x-1/2 text-center text-[11px] leading-4" style={{ top: stackTop }}>
                            <span className="block truncate font-semibold text-slate-800" title={placement.label}>{placement.label}</span>
                            <span className="block text-[10px] text-slate-500">Km {span.startCell.from} – {span.endCell.to}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onEditPlacement(placement)}
                            aria-label={`Chọn ${placement.label} để sửa`}
                            title={`${placement.label} · ${rail.line} · ${rail.rail}`}
                            className="absolute left-1/2 z-10 flex h-10 w-14 -translate-x-1/2 items-center justify-center focus-visible:rounded focus-visible:outline-2 focus-visible:outline-blue-600"
                            style={{ top: stackTop + 28 }}
                          >
                            <SymbolImage symbol={symbol} />
                          </button>
                          <div
                            className="absolute left-1/2 z-20 flex -translate-x-1/2 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                            style={{ top: trackTop + 14 }}
                          >
                            <button type="button" onClick={() => onEditPlacement(placement)} aria-label={`Sửa ${placement.label}`} className="rounded bg-white p-1 text-blue-700 hover:bg-blue-50"><Pencil className="size-3.5" /></button>
                            <button
                              type="button"
                              onClick={() => onRemovePlacement(placement.id)}
                              aria-label={`Xóa ${placement.label}`}
                              className="rounded bg-white p-1 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                          {editingPlacementId === placement.id && (
                            <span className="pointer-events-none absolute inset-0 rounded ring-2 ring-blue-400 ring-offset-1" />
                          )}
                        </div>
                      );
                    }))}
                  </div>
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
                    style={{ left: index * (CELL_W + CELL_GAP), width: CELL_W }}
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
