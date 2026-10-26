"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, Plus, RefreshCw, Shapes } from "lucide-react";
import { safeImageUrl } from "@lwr/lib/safe-url";
import {
  formatChainage,
  getPlacementSpan,
  lineTrackExtent,
  parseChainage,
  railRowKey,
  trackLineNames,
  type TrackLayout,
  type TrackPlacement,
} from "@lwr/lib/track-editor";
import type { StructureSymbol } from "@lwr/types/structure";
import type { RailJoint } from "@lwr/types/weld";
import { TrackMapCanvas } from "./TrackMapCanvas";
import { StructureLegend } from "./StructureLegend";
import type { StructureLayer } from "./RailGrid";

interface TrackSchematicProps {
  joints: RailJoint[];
  onSelectJoint: (joint: RailJoint) => void;
  layout: TrackLayout;
  symbols: StructureSymbol[];
  ready: boolean;
  symbolError: string | null;
  selectedCellId?: string | null;
  onReloadSymbols: () => void;
  onPlacement: (placement: TrackPlacement) => boolean;
  onRemove: (id: string) => void;
  onExtend: (count: number, line: string) => boolean;
  onPlan: (line: string, start: string, end: string) => boolean;
  onClearPlan: (line: string) => boolean;
  children: (structures: StructureLayer) => ReactNode;
}

const inputClass = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

function SymbolImage({ symbol }: { symbol: StructureSymbol | undefined }) {
  const src = safeImageUrl(symbol?.image_url);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" className="h-10 w-14 shrink-0 object-contain" decoding="async" />
    : <Shapes className="size-6 shrink-0 text-blue-600" aria-hidden="true" />;
}

/** Forms + memoized map canvas — form edits must not redraw the whole track. */
export function TrackSchematic({
  joints,
  onSelectJoint,
  layout,
  symbols,
  ready,
  symbolError,
  selectedCellId,
  onReloadSymbols,
  onPlacement,
  onRemove,
  onExtend,
  onPlan,
  onClearPlan,
  children,
}: TrackSchematicProps) {
  const lineNames = trackLineNames(layout.rows);
  const [planLine, setPlanLine] = useState(lineNames[0] ?? "TUYẾN THƯỢNG");
  const [rowKey, setRowKey] = useState("UT");
  const [structureFrom, setStructureFrom] = useState("");
  const [structureTo, setStructureTo] = useState("");
  const [planFrom, setPlanFrom] = useState("0+000");
  const [planTo, setPlanTo] = useState("");
  const [symbolId, setSymbolId] = useState("");
  const [label, setLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [appendCount, setAppendCount] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const row = layout.rows.find((item) => railRowKey(item) === rowKey) ?? layout.rows[0];
  const currentSymbol = symbols.find((symbol) => symbol.id === symbolId) ?? (symbolId ? undefined : symbols[0]);
  const planLineRows = layout.rows.filter((item) => item.line === planLine);
  const hasCellsOnPlanLine = planLineRows.some((item) => item.cells.length > 0);
  const hasCells = layout.rows.some((item) => item.cells.length > 0);
  const lineExtent = lineTrackExtent(layout.rows, planLine);

  useEffect(() => {
    if (!lineNames.includes(planLine) && lineNames[0]) setPlanLine(lineNames[0]);
  }, [lineNames, planLine]);

  useEffect(() => {
    if (!ready) return;
    if (lineExtent.endMetres > lineExtent.startMetres) {
      setPlanFrom(formatChainage(lineExtent.startMetres));
      setPlanTo(formatChainage(lineExtent.endMetres));
    } else {
      setPlanFrom("0+000");
      setPlanTo("");
    }
  }, [ready, planLine, lineExtent.startMetres, lineExtent.endMetres]);

  const clearEditor = useCallback(() => {
    setEditingId(null); setLabel(""); setFormError(null);
  }, []);

  const edit = useCallback((placement: TrackPlacement) => {
    const owner = layout.rows.find((item) => railRowKey(item) === placement.rowKey);
    const lineAnchor =
      layout.rows.find((item) => item.line === owner?.line && item.rail === "Ray trái")
      ?? owner
      ?? layout.rows[0];
    setEditingId(placement.id);
    setRowKey(railRowKey(lineAnchor));
    setStructureFrom(formatChainage(getPlacementSpan(layout.rows, placement)?.startMetres ?? 0));
    setStructureTo(formatChainage(getPlacementSpan(layout.rows, placement)?.endMetres ?? 0));
    setSymbolId(placement.symbolId);
    setLabel(placement.label);
    setFormError(null);
    setNotice(null);
  }, [layout.rows]);

  const removePlacement = useCallback((id: string) => {
    onRemove(id);
    setEditingId((current) => (current === id ? null : current));
  }, [onRemove]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const startMetres = parseChainage(structureFrom);
    const endMetres = parseChainage(structureTo);
    const span = startMetres === null || endMetres === null ? null : getPlacementSpan(layout.rows, { rowKey, startCellId: "", endCellId: "", startMetres, endMetres });
    if (!span) { setFormError("Nhập lý trình đầu/cuối hợp lệ trong phạm vi tuyến đã rải."); return; }
    if (!currentSymbol) { setFormError("Hãy chọn ký hiệu đang có trong danh mục công trình."); return; }
    const lineAnchor =
      layout.rows.find((item) => item.line === row.line && item.rail === "Ray trái") ?? row;
    const placement: TrackPlacement = {
      id: editingId ?? crypto.randomUUID(),
      rowKey: railRowKey(lineAnchor),
      startCellId: span.startCell.id,
      endCellId: span.endCell.id,
      startMetres: span.startMetres,
      endMetres: span.endMetres,
      symbolId: currentSymbol.id,
      label: label.trim() || currentSymbol.name,
    };
    if (onPlacement(placement)) { clearEditor(); setNotice("Đã lưu công trình trên sơ đồ."); }
  }

  return (
    <section className="space-y-3" aria-label="Bố trí công trình trên tuyến">
      <form className="flex min-w-0 flex-wrap items-end gap-3 rounded-lg border bg-white p-4" onSubmit={(e) => {
        e.preventDefault();
        if (onPlan(planLine, planFrom, planTo)) {
          setNotice(`Đã rải ${planLine}: Km ${planFrom} – ${planTo}. Tuyến kia giữ nguyên chiều dài riêng.`);
        }
      }}>
        <div className="w-full">
          <h2 className="font-bold">Bước 1 · Khai tuyến (riêng Thượng / Hạ)</h2>
          <p className="text-xs text-slate-500">
            Mỗi tuyến rải độc lập vì chiều dài và công trình khác nhau. Chọn Thượng hoặc Hạ → nhập đầu–cuối → Rải.
            Chỉ cập nhật 2 ray trái/phải của tuyến đang chọn; tuyến còn lại không đổi.
          </p>
        </div>
        <label className="w-full text-xs text-slate-600 sm:w-auto sm:flex-1">Tuyến cần rải
          <select className={inputClass} value={planLine} onChange={(e) => setPlanLine(e.target.value)} disabled={!ready}>
            {lineNames.map((line) => <option key={line} value={line}>{line}</option>)}
          </select>
        </label>
        <label className="w-full text-xs sm:w-auto sm:flex-1">Lý trình đầu tuyến<input className={inputClass} value={planFrom} onChange={(e) => setPlanFrom(e.target.value)} placeholder="Km0+000" /></label>
        <label className="w-full text-xs sm:w-auto sm:flex-1">Chốt lý trình cuối tuyến<input className={inputClass} value={planTo} onChange={(e) => setPlanTo(e.target.value)} placeholder="Km17+584" required /></label>
        <button disabled={!ready} className="h-10 rounded border bg-blue-700 px-3 text-sm text-white">Rải / cập nhật {planLine.replace(/^TUYẾN\s+/i, "")}</button>
        <button
          type="button"
          disabled={!ready || !hasCellsOnPlanLine}
          onClick={() => {
            if (onClearPlan(planLine)) {
              setNotice(`Đã xoá rải ray ${planLine} (kèm công trình / LWR / liên kết hàn trên tuyến).`);
            }
          }}
          className="h-10 rounded border px-3 text-sm text-red-700"
          title="Xoá rải ray tuyến đang chọn; công trình và đoạn LWR trên tuyến sẽ xoá kèm (có hỏi xác nhận)."
        >
          Xoá rải {planLine.replace(/^TUYẾN\s+/i, "")}
        </button>
        {hasCellsOnPlanLine && lineExtent.endMetres > lineExtent.startMetres ? (
          <p className="w-full text-xs text-emerald-700">
            Đang chọn {planLine}: Km {formatChainage(lineExtent.startMetres)} – {formatChainage(lineExtent.endMetres)}
            {" · "}
            {(lineExtent.endMetres - lineExtent.startMetres) / 1000} km
          </p>
        ) : (
          <p className="w-full text-xs text-slate-500">{planLine}: chưa rải.</p>
        )}
        <ul className="w-full space-y-0.5 text-[11px] text-slate-600">
          {lineNames.map((line) => {
            const span = lineTrackExtent(layout.rows, line);
            const independent = span.endMetres > span.startMetres;
            return (
              <li key={line}>
                {line}:{" "}
                {independent
                  ? `Km ${formatChainage(span.startMetres)} – ${formatChainage(span.endMetres)} · ${(span.endMetres - span.startMetres) / 1000} km`
                  : "chưa rải"}
              </li>
            );
          })}
        </ul>
        <p className="w-full text-[11px] font-medium text-slate-500">
          Thượng và Hạ độc lập — không bắt buộc cùng chiều dài.
        </p>
      </form>

      <TrackMapCanvas layout={layout}>
        {children({ placements: layout.placements, symbols, editingPlacementId: editingId, onEditPlacement: edit, onRemovePlacement: removePlacement })}
      </TrackMapCanvas>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-base font-bold">Bước 2 · Nhập công trình trên tuyến</h2><p className="mt-1 text-xs text-slate-500">Chỉ chọn tuyến Thượng hoặc Hạ (không phân ray trái/phải). Biểu tượng trên đường tim giữa 2 ray; tên/mã xem Chú thích / Legend bên dưới.</p></div>
          <Link href="/lwr-cong-trinh" className="text-sm font-medium text-blue-700 underline">Danh mục ký hiệu</Link>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <label className="text-xs text-slate-600">Tuyến (Thượng / Hạ)<select className={inputClass} value={row?.line ?? ""} onChange={(event) => { const first = layout.rows.find((item) => item.line === event.target.value && item.rail === "Ray trái") ?? layout.rows.find((item) => item.line === event.target.value); if (first) { setRowKey(railRowKey(first)); setStructureFrom(""); setStructureTo(""); } }} disabled={!ready}>{Array.from(new Map(layout.rows.map((item) => [item.line, item.line])).keys()).map((line) => <option key={line} value={line}>{line}</option>)}</select></label>
            <label className="text-xs text-slate-600">Lý trình đầu công trình<input className={inputClass} value={structureFrom} onChange={e => setStructureFrom(e.target.value)} placeholder="Km0+123" /></label>
            <label className="text-xs text-slate-600">Lý trình cuối công trình<input className={inputClass} value={structureTo} onChange={e => setStructureTo(e.target.value)} placeholder="Km0+789" /></label>
            <label className="text-xs text-slate-600">Ký hiệu công trình<select className={inputClass} value={currentSymbol?.id ?? ""} onChange={(event) => setSymbolId(event.target.value)} disabled={!ready || !symbols.length}><option value="" disabled>Chọn từ danh mục ký hiệu</option>{symbols.map((symbol) => <option key={symbol.id} value={symbol.id}>{symbol.name} ({symbol.code})</option>)}</select></label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-48 flex-1 text-xs text-slate-600">Tên hiển thị (tùy chọn)<input className={inputClass} value={label} onChange={(event) => setLabel(event.target.value)} placeholder={currentSymbol?.name ?? "Ví dụ: Cầu C1"} maxLength={120} /></label>
            <div className="flex h-10 items-center gap-2 rounded-md bg-slate-50 px-2 text-xs text-slate-600"><SymbolImage symbol={currentSymbol} /><span>{`${structureFrom} – ${structureTo}`}</span></div>
            <button type="submit" disabled={!ready || !currentSymbol || !hasCells} className="flex h-10 items-center gap-1.5 rounded-md bg-blue-700 px-3 text-sm font-medium text-white disabled:opacity-40">{editingId ? <Check className="size-4" /> : <Plus className="size-4" />}{editingId ? "Lưu thay đổi" : "Thêm lên sơ đồ"}</button>
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
          if (!Number.isInteger(count) || count < 1 || count > 100) { setFormError("Mỗi lần ghép từ 1 đến 100 thanh trên mỗi dải của tuyến đang chọn."); return; }
          if (onExtend(count, planLine)) {
            setFormError(null);
            setNotice(`Đã ghép thêm ${count} thanh × 500 m trên 2 ray của ${planLine}.`);
          }
        }}>
          <label className="text-xs text-slate-600">Số thanh ghép thêm / dải (theo tuyến Bước 1)
            <input type="number" min={1} max={100} step={1} value={appendCount} onChange={(event) => setAppendCount(event.target.value)} className={`${inputClass} max-w-40`} />
          </label>
          <button disabled={!ready} className="flex h-10 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-800 disabled:opacity-40">
            <Plus className="size-4" />Ghép thêm · {planLine.replace(/^TUYẾN\s+/i, "")}
          </button>
          <p className="pb-2 text-xs text-slate-500">
            {hasCellsOnPlanLine && lineExtent.endMetres > lineExtent.startMetres
              ? `Ghép trên ${planLine}: Km ${formatChainage(lineExtent.startMetres)} – ${formatChainage(lineExtent.endMetres)}. Thanh mới 500 m, T khóa 35°C.`
              : `Chưa rải ${planLine}. Dùng Bước 1 hoặc ghép sẽ tạo từ Km 0+000.`}
          </p>
        </form>
      </div>

      <StructureLegend layout={layout} symbols={symbols} />
    </section>
  );
}
