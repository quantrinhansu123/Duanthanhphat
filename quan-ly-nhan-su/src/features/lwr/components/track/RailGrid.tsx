"use client";

import { memo } from "react";
import { Plus, X } from "lucide-react";
import { RAIL_ROWS } from "@lwr/lib/track-data";
import { jointDisplayMethod, jointsForRow, weldMethodTone } from "@lwr/lib/weld-track-map";
import { coveringLongRail, formatChainage, parseChainage, railRowKey, trackExtent, trackSpanStyle, visibleLongRailSpan, TRACK_PIXELS_PER_METRE, type LongRail } from "@lwr/lib/track-editor";
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

interface RailGridProps {
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
  onAppend?: (rowKey: string) => void;
  onRemove?: (cellId: string) => void;
}

export const RailGrid = memo(function RailGrid({
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
}: RailGridProps) {
  const extent = trackExtent(rows);
  const planned = Math.max(0, (extent.endMetres - extent.startMetres) * TRACK_PIXELS_PER_METRE);
  const lineWidth = planned > 0 ? planned : EMPTY_LINE;
  const width = lineWidth + ADD_GUTTER;
  return <div className="border-t border-slate-200 bg-white">
    <div className="space-y-1 border-b px-4 py-3">
      <h2 className="text-sm font-bold">Sơ đồ 4 dải ray · lý trình thi công thực tế</h2>
      <p className="text-xs text-slate-600">Màu mối hàn theo mục tiêu tính toán / nhật ký: <span className="rounded border bg-white px-1">Trắng: chưa chọn</span> · <span className="text-blue-700">Xanh: FBW</span> · <span className="text-red-700">Đỏ: nhiệt nhôm</span> · <span className="text-amber-700">Vàng: ray đơn</span>.</p>
      <p className="text-xs text-slate-500">Đường đứt là tuyến. Thanh xanh lá = Đạt. Thanh xám mờ = chưa đánh giá. Bấm + để thêm thanh ngắn. Bấm X để xóa ô chưa Đạt.</p>
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
          return <div key={railRowKey(row)} className="grid grid-cols-[110px_1fr] gap-x-2">
          <div className="text-[11px]"><b>{row.line}</b><br />{row.rail}</div>
          <div className="relative" style={{ width, height: 80 }}>
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
              <button
                type="button"
                data-testid="rail-grid-append"
                onClick={() => onAppend(railRowKey(row))}
                aria-label={`Thêm thanh ngắn phía sau ${row.line} ${row.rail}`}
                title="Thêm thanh ngắn trên dải này"
                className="absolute top-5 z-10 flex size-8 items-center justify-center rounded-full border border-dashed border-slate-500 bg-white text-slate-700 hover:border-blue-600 hover:text-blue-700"
                style={{ left: plusLeft }}
              >
                <Plus className="size-4" />
              </button>
            )}
            <span className="absolute bottom-0 left-0 text-[10px] text-slate-500">Km{formatChainage(extent.startMetres)}</span>
            {planned > 0 && <span className="absolute bottom-0 text-[10px] text-slate-500" style={{ left: Math.max(0, lineWidth - 64) }}>Km{formatChainage(extent.endMetres)}</span>}
          </div>
        </div>;
        })}
      </div>
    </div>
  </div>;
});
