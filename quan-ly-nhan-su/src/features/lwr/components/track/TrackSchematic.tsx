"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight, Check, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Shapes, Trash2 } from "lucide-react";
import { safeImageUrl } from "@lwr/lib/safe-url";
import {
  defaultLongRailParams,
  formatChainage,
  getPlacementSpan,
  nextLongRailCode,
  railRowKey,
  trackExtent,
  type LongRail,
  type PlacementSpan,
  type TrackLayout,
  type TrackPlacement,
} from "@lwr/lib/track-editor";
import type { StructureSymbol } from "@lwr/types/structure";
import { LongRailTable } from "./LongRailTable";

interface TrackSchematicProps {
  layout: TrackLayout;
  symbols: StructureSymbol[];
  ready: boolean;
  symbolError: string | null;
  selectedLongRailId: string | null;
  onReloadSymbols: () => void;
  onPlacement: (placement: TrackPlacement) => boolean;
  onRemove: (id: string) => void;
  onExtend: (count: number) => boolean;
  onLongRail: (longRail: LongRail) => boolean;
  onRemoveLongRail: (id: string) => void;
  onSelectLongRail: (id: string) => void;
  children: ReactNode;
}

const inputClass = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

interface PlottedPlacement {
  placement: TrackPlacement;
  span: PlacementSpan;
  symbol: StructureSymbol | undefined;
}

interface PlottedLongRail {
  longRail: LongRail;
  span: PlacementSpan;
}

/** Only overlapping icon labels need an extra line; adding a structure does not add a card. */
function packSymbolLanes(items: PlottedPlacement[]): PlottedPlacement[][] {
  const lanes: PlottedPlacement[][] = [];
  for (const item of items) {
    const centre = (item.span.startIndex + item.span.endIndex) / 2;
    const lane = lanes.find((current) => current.every((other) => Math.abs((other.span.startIndex + other.span.endIndex) / 2 - centre) >= 1.5));
    if (lane) lane.push(item);
    else lanes.push([item]);
  }
  return lanes;
}

function SymbolImage({ symbol }: { symbol: StructureSymbol | undefined }) {
  const src = safeImageUrl(symbol?.image_url);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" className="h-10 w-14 shrink-0 object-contain" />
    : <Shapes className="size-6 shrink-0 text-blue-600" aria-hidden="true" />;
}

/** One shared horizontal viewport keeps structures aligned with rail cells. */
export function TrackSchematic({
  layout,
  symbols,
  ready,
  symbolError,
  selectedLongRailId,
  onReloadSymbols,
  onPlacement,
  onRemove,
  onExtend,
  onLongRail,
  onRemoveLongRail,
  onSelectLongRail,
  children,
}: TrackSchematicProps) {
  const [rowKey, setRowKey] = useState("UT");
  const [startId, setStartId] = useState("");
  const [endId, setEndId] = useState("");
  const [symbolId, setSymbolId] = useState("");
  const [label, setLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lrRowKey, setLrRowKey] = useState("UT");
  const [lrStartId, setLrStartId] = useState("");
  const [lrEndId, setLrEndId] = useState("");
  const [lrCode, setLrCode] = useState("");
  const [lrLabel, setLrLabel] = useState("");
  const [editingLongRailId, setEditingLongRailId] = useState<string | null>(null);
  const [appendCount, setAppendCount] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);
  const [lrFormError, setLrFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lrNotice, setLrNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ down: boolean; startX: number; startLeft: number }>({ down: false, startX: 0, startLeft: 0 });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.shiftKey) return;
      const canGoDown = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      const canGoUp = el.scrollLeft > 1;
      if ((e.deltaY > 0 && canGoDown) || (e.deltaY < 0 && canGoUp)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, layout]);

  function scrollByStep(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * Math.max(320, (scrollRef.current?.clientWidth ?? 600) * 0.7), behavior: "smooth" });
  }

  const row = layout.rows.find((item) => railRowKey(item) === rowKey) ?? layout.rows[0];
  const startIndex = Math.max(0, row.cells.findIndex((cell) => cell.id === startId));
  const currentStart = row.cells[startIndex];
  const selectedEndIndex = row.cells.findIndex((cell) => cell.id === endId);
  const currentEnd = row.cells[Math.max(startIndex, selectedEndIndex)];
  const currentSymbol = symbols.find((symbol) => symbol.id === symbolId) ?? (symbolId ? undefined : symbols[0]);

  const lrRow = layout.rows.find((item) => railRowKey(item) === lrRowKey) ?? layout.rows[0];
  const lrStartIndex = Math.max(0, lrRow.cells.findIndex((cell) => cell.id === lrStartId));
  const lrCurrentStart = lrRow.cells[lrStartIndex];
  const lrSelectedEndIndex = lrRow.cells.findIndex((cell) => cell.id === lrEndId);
  const lrCurrentEnd = lrRow.cells[Math.max(lrStartIndex, lrSelectedEndIndex)];

  const extent = trackExtent(layout.rows);
  const columns = Math.max(...layout.rows.map((item) => item.cells.length));
  const gridColumns = `repeat(${columns}, minmax(110px, 1fr))`;
  const plotted = layout.placements.flatMap((placement): PlottedPlacement[] => {
    const span = getPlacementSpan(layout.rows, placement);
    return span ? [{ placement, span, symbol: symbols.find((item) => item.id === placement.symbolId) }] : [];
  });
  const plottedLongRails = layout.longRails.flatMap((longRail): PlottedLongRail[] => {
    const span = getPlacementSpan(layout.rows, longRail);
    return span ? [{ longRail, span }] : [];
  });

  function clearEditor() {
    setEditingId(null); setLabel(""); setFormError(null);
  }

  function clearLongRailEditor() {
    setEditingLongRailId(null); setLrCode(""); setLrLabel(""); setLrFormError(null);
  }

  function edit(placement: TrackPlacement) {
    setEditingId(placement.id); setRowKey(placement.rowKey); setStartId(placement.startCellId);
    setEndId(placement.endCellId); setSymbolId(placement.symbolId); setLabel(placement.label);
    setFormError(null); setNotice(null);
  }

  function editLongRail(longRail: LongRail) {
    setEditingLongRailId(longRail.id);
    setLrRowKey(longRail.rowKey);
    setLrStartId(longRail.startCellId);
    setLrEndId(longRail.endCellId);
    setLrCode(longRail.code);
    setLrLabel(longRail.label);
    setLrFormError(null);
    setLrNotice(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!currentSymbol) { setFormError("Hãy chọn ký hiệu đang có trong danh mục công trình."); return; }
    const placement: TrackPlacement = {
      id: editingId ?? crypto.randomUUID(), rowKey: railRowKey(row),
      startCellId: currentStart.id, endCellId: currentEnd.id,
      symbolId: currentSymbol.id, label: label.trim() || currentSymbol.name,
    };
    if (onPlacement(placement)) { clearEditor(); setNotice("Đã lưu công trình trên sơ đồ."); }
  }

  return (
    <section className="space-y-3" aria-label="Bố trí công trình trên tuyến">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Thanh dài trên tuyến</h2>
            <p className="mt-1 text-xs text-slate-500">
              Chọn thanh bắt đầu và kết thúc để tạo một thanh dài (có thể ghép nhiều ô 500 m). Sau đó bấm trên sơ đồ hoặc bảng để xem/lưu thông số.
            </p>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const key = railRowKey(lrRow);
            const existing = editingLongRailId
              ? layout.longRails.find((item) => item.id === editingLongRailId)
              : undefined;
            const code = (lrCode.trim() || existing?.code || nextLongRailCode(layout.longRails, key)).trim();
            if (!code) { setLrFormError("Nhập mã thanh dài."); return; }
            if (layout.longRails.some((item) => item.code === code && item.id !== editingLongRailId)) {
              setLrFormError("Mã thanh dài đã tồn tại.");
              return;
            }
            const spanDraft = {
              rowKey: key,
              startCellId: lrCurrentStart.id,
              endCellId: lrCurrentEnd.id,
            };
            const draft: LongRail = {
              id: editingLongRailId ?? crypto.randomUUID(),
              code,
              label: lrLabel.trim() || code,
              ...spanDraft,
              params: existing?.params ?? defaultLongRailParams(layout.rows, spanDraft),
              updatedAt: new Date().toISOString(),
            };
            if (onLongRail(draft)) {
              clearLongRailEditor();
              setLrFormError(null);
              setLrNotice(editingLongRailId ? "Đã cập nhật thanh dài." : "Đã thêm thanh dài.");
            } else {
              setLrFormError("Không lưu được thanh dài. Kiểm tra chồng lấn hoặc thông báo lỗi phía trên.");
            }
          }}
          className="mt-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-5">
            <label className="text-xs text-slate-600">Dải ray
              <select
                className={inputClass}
                value={railRowKey(lrRow)}
                onChange={(event) => { setLrRowKey(event.target.value); setLrStartId(""); setLrEndId(""); }}
                disabled={!ready}
              >
                {layout.rows.map((item) => (
                  <option key={railRowKey(item)} value={railRowKey(item)}>{item.line} · {item.rail}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">Bắt đầu thanh
              <select className={inputClass} value={lrCurrentStart.id} onChange={(event) => setLrStartId(event.target.value)} disabled={!ready}>
                {lrRow.cells.map((cell) => <option key={cell.id} value={cell.id}>{cell.id} · Km {cell.from}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">Kết thúc thanh
              <select className={inputClass} value={lrCurrentEnd.id} onChange={(event) => setLrEndId(event.target.value)} disabled={!ready}>
                {lrRow.cells.slice(lrStartIndex).map((cell) => <option key={cell.id} value={cell.id}>{cell.id} · Km {cell.to}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">Mã thanh dài
              <input
                className={inputClass}
                value={lrCode}
                onChange={(event) => setLrCode(event.target.value)}
                placeholder={nextLongRailCode(layout.longRails, railRowKey(lrRow))}
                maxLength={40}
                disabled={!ready}
              />
            </label>
            <label className="text-xs text-slate-600">Tên hiển thị
              <input className={inputClass} value={lrLabel} onChange={(event) => setLrLabel(event.target.value)} placeholder="Ví dụ: LWR thượng trái 1" maxLength={120} disabled={!ready} />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex h-10 items-center rounded-md bg-slate-50 px-3 text-xs text-slate-600">
              Km {lrCurrentStart.from} – {lrCurrentEnd.to}
            </div>
            <button type="submit" disabled={!ready} className="flex h-10 items-center gap-1.5 rounded-md bg-teal-700 px-3 text-sm font-medium text-white disabled:opacity-40">
              {editingLongRailId ? <Check className="size-4" /> : <Plus className="size-4" />}
              {editingLongRailId ? "Lưu thanh dài" : "Thêm thanh dài"}
            </button>
            {editingLongRailId && (
              <button type="button" onClick={clearLongRailEditor} className="h-10 rounded-md border px-3 text-sm">Hủy sửa</button>
            )}
          </div>
          {lrFormError && <p role="alert" className="text-sm text-red-700">{lrFormError}</p>}
          {lrNotice && <p role="status" className="text-sm text-emerald-700">{lrNotice}</p>}
        </form>
      </div>

      <LongRailTable
        layout={layout}
        selectedId={selectedLongRailId}
        onSelect={onSelectLongRail}
        onEdit={editLongRail}
        onRemove={(id) => {
          onRemoveLongRail(id);
          if (editingLongRailId === id) clearLongRailEditor();
        }}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-base font-bold">Bố trí công trình trên tuyến</h2><p className="mt-1 text-xs text-slate-500">Chọn phạm vi từ đầu thanh bắt đầu đến cuối thanh kết thúc. Sơ đồ và các ô ray cùng cuộn ngang.</p></div>
          <Link href="/lwr-cong-trinh" className="text-sm font-medium text-blue-700 underline">Danh mục ký hiệu</Link>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <label className="text-xs text-slate-600">Dải ray<select className={inputClass} value={railRowKey(row)} onChange={(event) => { setRowKey(event.target.value); setStartId(""); setEndId(""); }} disabled={!ready}>{layout.rows.map((item) => <option key={railRowKey(item)} value={railRowKey(item)}>{item.line} · {item.rail}</option>)}</select></label>
            <label className="text-xs text-slate-600">Bắt đầu thanh<select className={inputClass} value={currentStart.id} onChange={(event) => setStartId(event.target.value)} disabled={!ready}>{row.cells.map((cell) => <option key={cell.id} value={cell.id}>{cell.id} · Km {cell.from}</option>)}</select></label>
            <label className="text-xs text-slate-600">Kết thúc thanh<select className={inputClass} value={currentEnd.id} onChange={(event) => setEndId(event.target.value)} disabled={!ready}>{row.cells.slice(startIndex).map((cell) => <option key={cell.id} value={cell.id}>{cell.id} · Km {cell.to}</option>)}</select></label>
            <label className="text-xs text-slate-600">Ký hiệu công trình<select className={inputClass} value={currentSymbol?.id ?? ""} onChange={(event) => setSymbolId(event.target.value)} disabled={!ready || !symbols.length}><option value="" disabled>Chọn từ danh mục ký hiệu</option>{symbols.map((symbol) => <option key={symbol.id} value={symbol.id}>{symbol.name} ({symbol.code})</option>)}</select></label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-48 flex-1 text-xs text-slate-600">Tên hiển thị (tùy chọn)<input className={inputClass} value={label} onChange={(event) => setLabel(event.target.value)} placeholder={currentSymbol?.name ?? "Ví dụ: Cầu C1"} maxLength={120} /></label>
            <div className="flex h-10 items-center gap-2 rounded-md bg-slate-50 px-2 text-xs text-slate-600"><SymbolImage symbol={currentSymbol} /><span>Km {currentStart.from} – {currentEnd.to}</span></div>
            <button type="submit" disabled={!ready || !currentSymbol} className="flex h-10 items-center gap-1.5 rounded-md bg-blue-700 px-3 text-sm font-medium text-white disabled:opacity-40">{editingId ? <Check className="size-4" /> : <Plus className="size-4" />}{editingId ? "Lưu thay đổi" : "Thêm lên sơ đồ"}</button>
            {editingId && <button type="button" onClick={clearEditor} className="h-10 rounded-md border px-3 text-sm">Hủy sửa</button>}
            <button type="button" onClick={onReloadSymbols} className="flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm"><RefreshCw className="size-4" />Cập nhật ký hiệu</button>
          </div>
          {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
          {symbolError && <p role="alert" className="text-sm text-red-700">{symbolError}</p>}
          {!symbols.length && ready && !symbolError && <p className="text-sm text-slate-500">Danh mục chưa có ký hiệu. Thêm ký hiệu tại trang Công trình rồi bấm Cập nhật ký hiệu.</p>}
          {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
        </form>
        <form className="mt-4 flex flex-wrap items-end gap-3 border-t pt-3" onSubmit={(event) => {
          event.preventDefault();
          const count = Number(appendCount);
          if (!Number.isInteger(count) || count < 1 || count > 100) { setFormError("Mỗi lần ghép từ 1 đến 100 thanh trên mỗi dải."); return; }
          if (onExtend(count)) { setFormError(null); setNotice(`Đã ghép thêm ${count} thanh × 500 m trên mỗi dải ray.`); }
        }}>
          <label className="text-xs text-slate-600">Số thanh ghép thêm / dải<input type="number" min={1} max={100} step={1} value={appendCount} onChange={(event) => setAppendCount(event.target.value)} className={`${inputClass} max-w-40`} /></label>
          <button disabled={!ready} className="flex h-10 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-800 disabled:opacity-40"><Plus className="size-4" />Ghép thêm thanh</button>
          <p className="pb-2 text-xs text-slate-500">Thanh mới dài 500 m, nhiệt độ khóa mẫu 35°C. Tuyến hiện tại: Km {formatChainage(extent.startMetres)} – {formatChainage(extent.endMetres)}.</p>
        </form>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <h3 className="text-sm font-bold">Sơ đồ tuyến và dải ray · {columns} thanh / dải</h3>
          <div className="flex items-center gap-1.5">
            <span className="mr-1 hidden items-center gap-1 text-xs text-slate-500 sm:flex"><ArrowLeftRight className="size-4" />Lăn chuột / kéo · bấm đoạn teal = thanh dài</span>
            <button type="button" onClick={() => scrollByStep(-1)} disabled={!canLeft} aria-label="Cuộn sang trái" className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft className="size-4" /></button>
            <button type="button" onClick={() => scrollByStep(1)} disabled={!canRight} aria-label="Cuộn sang phải" className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><ChevronRight className="size-4" /></button>
          </div>
        </div>
        <div
          ref={scrollRef}
          className="cursor-grab overflow-x-auto overscroll-x-contain active:cursor-grabbing"
          data-testid="track-scroll"
          tabIndex={0}
          aria-label="Cuộn ngang sơ đồ tuyến và thanh ray. Dùng Shift + lăn chuột, nút mũi tên, hoặc kéo chuột."
          onPointerDown={(e) => {
            const el = scrollRef.current;
            if (!el || e.button !== 0) return;
            dragState.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft };
          }}
          onPointerMove={(e) => {
            const el = scrollRef.current;
            if (!el || !dragState.current.down) return;
            el.scrollLeft = dragState.current.startLeft - (e.clientX - dragState.current.startX);
          }}
          onPointerUp={() => { dragState.current.down = false; }}
          onPointerLeave={() => { dragState.current.down = false; }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") { e.preventDefault(); scrollByStep(-1); }
            if (e.key === "ArrowRight") { e.preventDefault(); scrollByStep(1); }
          }}
        >
          <div style={{ minWidth: `${142 + columns * 118}px` }}>
            <div className="space-y-2 px-4 py-4">
              {layout.longRails.length === 0 && layout.placements.length === 0 && (
                <p className="mb-3 text-xs text-slate-500">Chưa có thanh dài hoặc công trình. Thêm ở các form phía trên.</p>
              )}
              {layout.rows.map((rail) => {
                const key = railRowKey(rail);
                const railLongRails = plottedLongRails.filter((item) => item.longRail.rowKey === key);
                const structureLanes = packSymbolLanes(plotted.filter((item) => item.placement.rowKey === key));
                const lanes = structureLanes.length ? structureLanes : [[] as PlottedPlacement[]];
                return lanes.map((items, laneIndex) => (
                  <div key={`${key}-${laneIndex}`} className="grid grid-cols-[110px_1fr] items-end gap-x-2" data-testid="symbol-lane">
                    <span className="pb-4 text-[11px] text-slate-500">{rail.line}<br />{rail.rail}</span>
                    <div className="relative h-[104px]">
                      <div data-testid="track-line" className="absolute inset-x-0 top-[68px] h-[3px] rounded bg-emerald-600" />
                      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: gridColumns, gap: "8px" }}>
                        {laneIndex === 0 && railLongRails.map(({ longRail, span }) => {
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
                              className={`group/lr relative z-[5] min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-teal-600 ${selected ? "ring-2 ring-teal-500 ring-offset-1" : ""}`}
                              style={{ gridColumn: `${span.startIndex + 1} / ${span.endIndex + 2}`, gridRow: 1 }}
                            >
                              <span className={`absolute inset-x-0 top-[62px] h-[15px] rounded-sm ${selected ? "bg-teal-500/55" : "bg-teal-400/40 group-hover/lr:bg-teal-500/50"}`} />
                              <span className="absolute left-0 top-[61px] h-[17px] w-[3px] rounded bg-teal-700" />
                              <span className="absolute right-0 top-[61px] h-[17px] w-[3px] rounded bg-teal-700" />
                              <span className="absolute left-1/2 top-[78px] z-10 max-w-full -translate-x-1/2 truncate rounded bg-white/90 px-1 text-[10px] font-semibold text-teal-900">
                                {longRail.code}
                              </span>
                            </button>
                          );
                        })}
                        {items.map(({ placement, span, symbol }) => (
                          <div key={placement.id} data-placement={placement.id} data-placement-span className="group relative z-10 min-w-0" style={{ gridColumn: `${span.startIndex + 1} / ${span.endIndex + 2}`, gridRow: 1 }}>
                            <div className="pointer-events-none absolute inset-x-0 top-[62px] h-[15px] bg-amber-300/35" />
                            <div className="pointer-events-none absolute left-0 top-[61px] h-[17px] w-[3px] rounded bg-blue-600" />
                            <div className="pointer-events-none absolute right-0 top-[61px] h-[17px] w-[3px] rounded bg-blue-600" />
                            <div className="absolute left-1/2 top-0 z-10 w-[150px] max-w-full -translate-x-1/2 text-center text-[11px] leading-4">
                              <span className="block truncate font-semibold text-slate-800" title={placement.label}>{placement.label}</span>
                              <span className="block text-[10px] text-slate-500">Km {span.startCell.from} – {span.endCell.to}</span>
                              <span className="sr-only">{placement.startCellId} → {placement.endCellId}</span>
                              {!symbol && <span className="block text-[10px] text-amber-700">Ký hiệu đã xóa khỏi danh mục</span>}
                            </div>
                            <button type="button" data-placement-icon onClick={() => edit(placement)} aria-label={`Chọn ${placement.label} để sửa`} title={`${placement.label} · ${rail.line} · ${rail.rail} · ${placement.startCellId} → ${placement.endCellId}`} className="absolute left-1/2 top-[48px] z-10 flex h-10 w-14 -translate-x-1/2 items-center justify-center mix-blend-multiply focus-visible:rounded focus-visible:outline-2 focus-visible:outline-blue-600"><SymbolImage symbol={symbol} /></button>
                            <div className="absolute left-1/2 top-[82px] z-20 flex -translate-x-1/2 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                              <button onClick={() => edit(placement)} aria-label={`Sửa ${placement.label}`} className="rounded bg-white p-1 text-blue-700 hover:bg-blue-50"><Pencil className="size-3.5" /></button>
                              <button onClick={() => { onRemove(placement.id); if (editingId === placement.id) clearEditor(); }} aria-label={`Xóa ${placement.label}`} className="rounded bg-white p-1 text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ));
              })}
              <div className="grid grid-cols-[110px_1fr] gap-x-2 pt-1">
                <span className="text-xs font-medium text-slate-600">Lý trình</span>
                <div className="grid border-t border-slate-200 pt-1" style={{ gridTemplateColumns: gridColumns, gap: "8px" }}>
                  {layout.rows[0].cells.map((cell, index) => (
                    <div key={cell.id} className="flex justify-between text-[10px] text-slate-500">
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
    </section>
  );
}
