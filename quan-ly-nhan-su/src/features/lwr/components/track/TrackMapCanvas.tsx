"use client";

import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { trackExtent, TRACK_PIXELS_PER_METRE, type TrackLayout } from "@lwr/lib/track-editor";

export const TrackMapCanvas = memo(function TrackMapCanvas({
  layout,
  children,
}: {
  layout: TrackLayout;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ down: false, dragging: false, startX: 0, startLeft: 0 });
  const arrowRaf = useRef(0);
  const arrowPrev = useRef({ left: false, right: false });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const columns = Math.max(...layout.rows.map((item) => item.cells.length), 1);
  const extent = trackExtent(layout.rows);
  const plannedWidth = (extent.endMetres - extent.startMetres) * TRACK_PIXELS_PER_METRE;
  const trackWidth = plannedWidth > 0 ? plannedWidth : 240;

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

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white [contain:layout]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <h3 className="text-sm font-bold">Sơ đồ tuyến và dải ray · {columns} thanh / dải</h3>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 hidden items-center gap-2 text-xs text-slate-500 sm:flex"><ArrowLeftRight className="size-4" />Shift + lăn chuột / kéo</span>
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
        <div style={{ width: `max(100%, ${150 + trackWidth + 56}px)` }}>
          {children}
        </div>
      </div>
    </div>
  );
});
