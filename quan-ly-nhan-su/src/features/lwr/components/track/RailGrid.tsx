"use client";

import { memo, useEffect, useId, useRef, useState } from "react";
import { Eye, Pencil, Plus, Shapes, Trash2, X } from "lucide-react";
import { safeImageUrl } from "@lwr/lib/safe-url";
import type { StructureSymbol } from "@lwr/types/structure";
import { RAIL_ROWS } from "@lwr/lib/track-data";
import { jointDisplayMethod, jointsForRow, weldMethodTone } from "@lwr/lib/weld-track-map";
import { coveringLongRail, formatChainage, getPlacementSpan, type PlacementSpan, type TrackPlacement, parseChainage, railRowKey, trackExtent, trackSpanStyle, visibleLongRailSpan, RAIL_SEGMENT_LENGTH_METRES, TRACK_PIXELS_PER_METRE, type LongRail } from "@lwr/lib/track-editor";
import type { RailRow } from "@lwr/types/track";
import type { RailJoint } from "@lwr/types/weld";

const EMPTY_LINE = 240;
const ADD_GUTTER = 56;
const DAT_GREEN = "#059669";
const UNRATED_GRAY = "#94a3b8";

function contrastText(hex: string) {
  const value = hex.replace("#", "");
  if (value.length < 6) return "#fff";
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? "#0f172a" : "#fff";
}

function chipDeleteButton(cellId: string, box: { left: number; width: number }, onRemove?: (id: string) => void) {
  if (!onRemove) return null;
  const width = Math.max(1, box.width - 4);
  return (
    <button
      type="button"
      data-testid="rail-grid-remove"
      aria-label={`Xóa ${cellId}`}
      title="Xóa thanh ngắn"
      onClick={(event) => {
        event.stopPropagation();
        onRemove(cellId);
      }}
      className="absolute z-[4] flex size-5 items-center justify-center rounded-full border border-slate-300 bg-white text-red-600 shadow-sm hover:border-red-400 hover:bg-red-50"
      style={{ left: box.left + width - 22, top: 22 }}
    >
      <X className="size-3" />
    </button>
  );
}

export interface StructureLayer {
  placements: TrackPlacement[];
  symbols: StructureSymbol[];
  editingPlacementId: string | null;
  onEditPlacement: (placement: TrackPlacement) => void;
  onRemovePlacement: (id: string) => void;
}

interface PlottedPlacement {
  placement: TrackPlacement;
  span: PlacementSpan;
  symbol: StructureSymbol | undefined;
}

const SYMBOL_STACK = 48;
const ICON_H = 40;
const LINE_Y = 34;
// Narrow structures still need room for their label.
const GUIDE_MIN_W = 80;

function SymbolImage({ symbol }: { symbol: StructureSymbol | undefined }) {
  const src = safeImageUrl(symbol?.image_url);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" className="h-10 w-14 shrink-0 object-contain" decoding="async" />
    : <Shapes className="size-6 shrink-0 text-blue-600" aria-hidden="true" />;
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

interface RailGridProps {
  structures?: StructureLayer;
  rows?: RailRow[];
  longRails?: LongRail[];
  onSelectLongRail?: (id: string | null) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  alertIds?: string[];
  embedded?: boolean;
  joints?: RailJoint[];
  selectedJointId?: string | null;
  onSelectJoint?: (joint: RailJoint) => void;
  selectedLongRailId?: string | null;
  onAppend?: (rowKey: string, from: string, to: string) => boolean | void;
  onRemove?: (cellId: string) => void;
  appendError?: string | null;
}

export const RailGrid = memo(function RailGrid({
  structures,
  rows = RAIL_ROWS,
  longRails = [],
  onSelectLongRail,
  selectedId,
  onSelect,
  embedded = false,
  joints = [],
  selectedJointId,
  onSelectJoint,
  selectedLongRailId,
  onAppend,
  onRemove,
  appendError,
}: RailGridProps) {
  const [appendDraft, setAppendDraft] = useState<{ rowKey: string; from: string; to: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();
  const [submitted, setSubmitted] = useState(false);
  const appendOpen = appendDraft !== null;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (appendOpen) dialog?.showModal();
    else dialog?.close();
  }, [appendOpen]);
  const extent = trackExtent(rows);
  const planned = Math.max(0, (extent.endMetres - extent.startMetres) * TRACK_PIXELS_PER_METRE);
  const lineWidth = planned > 0 ? planned : EMPTY_LINE;
  const width = lineWidth + ADD_GUTTER;
  return <div className="border-t border-slate-200 bg-white">
    <div className="space-y-1 border-b px-4 py-3">
      <h2 className="text-sm font-bold">Sơ đồ 4 dải ray · lý trình thi công thực tế</h2>
      <p className="text-xs text-slate-600">Màu mối hàn theo mục tiêu tính toán / nhật ký: <span className="rounded border bg-white px-1">Trắng: chưa chọn</span> · <span className="text-blue-700">Xanh: FBW</span> · <span className="text-red-700">Đỏ: nhiệt nhôm</span> · <span className="text-amber-700">Vàng: ray đơn</span>.</p>
      <p className="text-xs text-slate-500">Đường đứt là tuyến. Thanh xanh lá = Đạt. Thanh xám mờ = chưa đánh giá. Bấm + để nhập lý trình và thêm thanh ngắn đúng vị trí. Bấm X để xóa ô chưa Đạt.</p>
    </div>
    <div className={embedded ? "" : "overflow-x-auto"}>
      <div className="space-y-4 px-4 py-3" style={{ width: 150 + width }}>
        {rows.map(row => {
          const lastVisible = [...row.cells].reverse().find((cell) => cell.released || cell.placed);
          const lastEnd = lastVisible ? parseChainage(lastVisible.to) : null;
          const plusLeft = lastEnd === null ? 8 : (lastEnd - extent.startMetres) * TRACK_PIXELS_PER_METRE + 8;
          const rowLongRails = longRails.flatMap((rail) => {
            if (rail.rowKey !== railRowKey(row)) return [];
            const span = visibleLongRailSpan(rows, rail);
            return span ? [{ rail, span }] : [];
          });
          const key = railRowKey(row);
          const structureLanes = packSymbolLanes((structures?.placements ?? []).flatMap((placement): PlottedPlacement[] => {
            if (placement.rowKey !== key) return [];
            const span = getPlacementSpan(rows, placement);
            return span ? [{ placement, span, symbol: structures?.symbols.find((item) => item.id === placement.symbolId) }] : [];
          }));
          // Structures sit above the rail line, so the row grows by their stacked height.
          const offset = structureLanes.length ? 8 + structureLanes.length * SYMBOL_STACK : 0;
          return <div key={key} className="grid grid-cols-[110px_1fr] gap-x-2">
          <div className="text-[11px]" style={{ paddingTop: offset }}><b>{row.line}</b><br />{row.rail}</div>
          <div className="relative" style={{ width, height: 80 + offset }}>
            {structures && structureLanes.flatMap((items, laneIndex) => items.map(({ placement, span, symbol }) => {
              const box = trackSpanStyle(span.startMetres, span.endMetres, extent.startMetres);
              const iconTop = 4 + laneIndex * SYMBOL_STACK;
              const guideTop = iconTop + ICON_H;
              const guideHeight = Math.max(6, offset + LINE_Y - 16 - guideTop);
              return (
                <span key={placement.id}>
                  <div
                    aria-hidden
                    data-testid="structure-guide"
                    className="pointer-events-none absolute z-[5] flex items-center justify-center overflow-hidden border border-dashed border-slate-500/70 bg-slate-400/25 px-0.5"
                    style={{ left: box.left + box.width / 2 - Math.max(box.width, GUIDE_MIN_W) / 2, width: Math.max(box.width, GUIDE_MIN_W), top: guideTop, height: guideHeight }}
                  >
                    <span className="max-h-full max-w-full overflow-hidden text-center text-[9px] font-semibold leading-tight text-slate-600 [overflow-wrap:anywhere] line-clamp-3">
                      {placement.label || symbol?.code || symbol?.name}
                    </span>
                  </div>
                  <div
                    data-placement={placement.id}
                    className={`group absolute z-10 hover:z-30 focus-within:z-30 flex items-center ${structures.editingPlacementId === placement.id ? "rounded ring-2 ring-blue-400 ring-offset-1" : ""}`}
                    style={{ left: box.left + box.width / 2, top: iconTop, transform: "translateX(-50%)" }}
                  >
                    <button
                      type="button"
                      onClick={() => structures.onEditPlacement(placement)}
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
                      <p>{row.line} · {row.rail}</p>
                      {symbol ? <p>{symbol.name}{symbol.code ? ` (${symbol.code})` : ""}</p> : null}
                      <div className="mt-1.5 flex gap-1">
                        <button type="button" aria-label={`Xem ${placement.label}`} title="Xem" className="rounded bg-slate-50 p-1 text-slate-600 hover:bg-slate-100 hover:text-blue-700"><Eye className="size-3.5" /></button>
                        <button type="button" onClick={() => structures.onEditPlacement(placement)} aria-label={`Sửa ${placement.label}`} title="Sửa" className="rounded bg-slate-50 p-1 text-blue-700 hover:bg-blue-50"><Pencil className="size-3.5" /></button>
                        <button type="button" onClick={() => structures.onRemovePlacement(placement.id)} aria-label={`Xóa ${placement.label}`} title="Xóa" className="rounded bg-slate-50 p-1 text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                      </div>
                    </div>
                  </div>
                </span>
              );
            }))}
            <div className="absolute inset-x-0 bottom-0" style={{ top: offset }}>
            <svg
              data-testid="rail-grid-line"
              className="pointer-events-none absolute left-0 top-[34px] overflow-visible"
              width={lineWidth}
              height="2"
              aria-hidden
            >
              <line
                x1="0"
                y1="1"
                x2={lineWidth}
                y2="1"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                strokeLinecap="butt"
              />
            </svg>
            {row.cells.map(cell => {
              const from = parseChainage(cell.from) ?? 0, to = parseChainage(cell.to) ?? 0;
              const box = trackSpanStyle(from, to, extent.startMetres);
              const cover = coveringLongRail(rowLongRails, from, to, selectedLongRailId);
              if (!cell.released && !cell.placed) {
                return <button
                  key={cell.id}
                  type="button"
                  onClick={() => { onSelect(cell.id); onSelectLongRail?.(cover?.rail.id ?? null); }}
                  title={`${cell.id} · ${cell.from} – ${cell.to} · Chưa rải`}
                  aria-label={`${cell.id}: chưa rải thanh ngắn`}
                  className={`absolute top-5 h-8 bg-transparent ${selectedId === cell.id ? "ring-2 ring-blue-500" : ""}`}
                  style={{ ...box, width: Math.max(1, box.width - 4) }}
                />;
              }
              if (cover) {
                const tone = cell.released ? DAT_GREEN : UNRATED_GRAY;
                const selected = selectedId === cell.id || selectedLongRailId === cover.rail.id;
                return (
                  <span key={cell.id}>
                    <button
                      type="button"
                      data-testid="rail-grid-short"
                      onClick={() => { onSelect(cell.id); onSelectLongRail?.(cover.rail.id); }}
                      title={`${cell.id} thuộc ${cover.rail.code} · ${cover.rail.params.railType} · ${cell.from} – ${cell.to}${cell.released ? " · Đạt" : ""}`}
                      aria-label={`${cell.id}: thanh ngắn của ${cover.rail.code}`}
                      className={`absolute top-5 z-[1] h-8 overflow-hidden rounded border ${cell.released ? "" : "pr-5 "}text-[10px] font-semibold leading-tight ${selected ? "ring-2 ring-offset-1" : ""}`}
                      style={{ ...box, width: Math.max(1, box.width - 4), backgroundColor: selected ? `${tone}e6` : cell.released ? tone : `${tone}c7`, borderColor: tone, color: contrastText(tone), outlineColor: tone }}
                    >
                      <span className="block truncate">{cell.id} · {cover.rail.code}</span>
                      <span className="block truncate text-[9px] font-medium opacity-90">{cover.rail.params.railType}{cell.released ? " · Đạt" : ""}</span>
                    </button>
                    {!cell.released && chipDeleteButton(cell.id, box, onRemove)}
                  </span>
                );
              }
              return <span key={cell.id}>
                <button type="button" onClick={() => { onSelect(cell.id); onSelectLongRail?.(null); }} title={`${cell.id} · ${cell.from} – ${cell.to} · ${cell.released ? "Đạt" : "Thanh ngắn"}`} className={`absolute top-5 z-[1] h-8 overflow-hidden rounded border ${cell.released ? "" : "pr-5 "}text-[10px] ${cell.released ? "border-emerald-700 bg-emerald-600 text-white" : "border-slate-400 bg-slate-100 text-slate-700"} ${selectedId === cell.id ? "ring-2 ring-blue-500" : ""}`} style={{ ...box, width: Math.max(1, box.width - 4) }}>
                  <span className="block truncate">{cell.id} · {cell.temp}°C</span>
                </button>
                {!cell.released && chipDeleteButton(cell.id, box, onRemove)}
              </span>;
            })}
            {jointsForRow(joints, row).map(joint => {
              const weld = joint.welds[0];
              const method = jointDisplayMethod(joint, longRails, rows, selectedLongRailId, selectedId);
              return (
                <button
                  key={joint.id}
                  type="button"
                  onClick={() => onSelectJoint?.(joint)}
                  title={`${joint.chainage} · ${weld?.code ?? method ?? "Chưa hàn — liên kết nhật ký"}`}
                  aria-label={`Mối hàn ${row.line} ${row.rail} Km${joint.chainage}`}
                  className={`absolute z-10 flex h-8 w-5 -translate-x-1/2 appearance-none items-center justify-center border-0 bg-transparent p-0 ${selectedJointId === joint.id ? "rounded-sm ring-1 ring-slate-600 ring-offset-1" : ""}`}
                  style={{ left: (joint.metres - extent.startMetres) * TRACK_PIXELS_PER_METRE, top: 20 }}
                >
                  <span className={`block h-5 w-[4px] rounded-full border-0 shadow-sm ${weldMethodTone(method)}`} />
                  {weld && <span className="absolute bottom-full left-1/2 max-w-24 -translate-x-1/2 truncate whitespace-nowrap text-[9px] text-slate-800">{weld.code}</span>}
                </button>
              );
            })}
            {onAppend && (
              <div className="absolute top-5 z-20" style={{ left: plusLeft }}>
                <button
                  type="button"
                  data-testid="rail-grid-append"
                  onClick={() => {
                    const key = railRowKey(row);
                    const start = lastEnd ?? extent.startMetres;
                    setSubmitted(false);
                    setAppendDraft({
                      rowKey: key,
                      from: formatChainage(start),
                      to: formatChainage(start + RAIL_SEGMENT_LENGTH_METRES),
                    });
                  }}
                  aria-label={`Thêm thanh ngắn phía sau ${row.line} ${row.rail}`}
                  title="Nhập lý trình để thêm thanh ngắn"
                  className="flex size-8 items-center justify-center rounded-full border border-dashed border-slate-500 bg-white text-slate-700 hover:border-blue-600 hover:text-blue-700"
                >
                  <Plus className="size-4" />
                </button>

              </div>
            )}
            </div>
          </div>
        </div>;
        })}
      </div>
    </div>
    <dialog
      ref={dialogRef}
      aria-labelledby={dialogTitleId}
      onCancel={() => setAppendDraft(null)}
      onClose={() => setAppendDraft(null)}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/40"
    >
      {appendDraft && <form onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (onAppend?.(appendDraft.rowKey, appendDraft.from, appendDraft.to) !== false) setAppendDraft(null);
      }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id={dialogTitleId} className="font-semibold">Thêm thanh ngắn</h3>
          <button type="button" aria-label="Đóng popup" onClick={() => setAppendDraft(null)} className="rounded p-1 hover:bg-slate-100"><X className="size-5" /></button>
        </div>
        <p className="mb-4 text-sm text-slate-600">Nhập lý trình tùy chọn cho {rows.find(row => railRowKey(row) === appendDraft.rowKey)?.line} · {rows.find(row => railRowKey(row) === appendDraft.rowKey)?.rail}.</p>
        <label className="block text-sm font-medium">
          Lý trình đầu
          <input autoFocus required className="mt-1 w-full rounded-lg border px-3 py-2" value={appendDraft.from} onChange={event => { setSubmitted(false); setAppendDraft({ ...appendDraft, from: event.target.value }); }} placeholder="0+000" aria-label="Lý trình đầu thanh ngắn" />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Lý trình cuối
          <input required className="mt-1 w-full rounded-lg border px-3 py-2" value={appendDraft.to} onChange={event => { setSubmitted(false); setAppendDraft({ ...appendDraft, to: event.target.value }); }} placeholder="0+250" aria-label="Lý trình cuối thanh ngắn" />
        </label>
        <p className="mt-2 text-xs text-slate-500">Ví dụ: 12+000 đến 12+250. Lý trình cuối phải lớn hơn lý trình đầu.</p>
        {submitted && appendError && <p role="alert" className="mt-3 text-sm text-red-700">{appendError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setAppendDraft(null)}>Hủy</button>
          <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">Thêm</button>
        </div>
      </form>}
    </dialog>
  </div>;
});
