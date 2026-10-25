"use client";

import { Fragment, memo, useEffect, useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { StructureSymbol } from "@lwr/types/structure";
import { RAIL_ROWS } from "@lwr/lib/track-data";
import { jointDisplayMethod, jointsForRow, weldMethodTone } from "@lwr/lib/weld-track-map";
import { coveringLongRail, formatChainage, type TrackPlacement, parseChainage, railRowKey, trackExtent, trackSpanStyle, visibleLongRailSpan, RAIL_SEGMENT_LENGTH_METRES, TRACK_PIXELS_PER_METRE, type LongRail } from "@lwr/lib/track-editor";
import type { RailRow } from "@lwr/types/track";
import type { RailJoint } from "@lwr/types/weld";

import { TrackCenterline } from "./TrackCenterline";

const EMPTY_LINE = 240;
const ADD_GUTTER = 56;
const DAT_GREEN = "#059669";
const UNRATED_GRAY = "#94a3b8";
/** Giải toả xong mà T < 30°C */
const STRESS_LOW_ORANGE = "#ea580c";
const STRESS_PASS_TEMP_C = 30;

function contrastText(hex: string) {
  const value = hex.replace("#", "");
  if (value.length < 6) return "#fff";
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? "#0f172a" : "#fff";
}

/** Xám khi tạo; xanh nếu giải toả T≥30; cam nếu T<30. */
function releaseTone(released: boolean, tempC: number) {
  if (!released) return UNRATED_GRAY;
  return tempC >= STRESS_PASS_TEMP_C ? DAT_GREEN : STRESS_LOW_ORANGE;
}

function longRailTone(rail: LongRail, cellReleased?: boolean, cellTemp?: number) {
  const done = Boolean(rail.completedAt) || Boolean(cellReleased);
  const tempC = rail.params.neutralTemp ?? rail.params.airTemp ?? cellTemp ?? STRESS_PASS_TEMP_C;
  return releaseTone(done, tempC);
}

/** Mã trên thanh ngắn: LWR01-500m-35oC (500 = chiều dài đoạn). */
function shortRailChipLabel(code: string, lengthMetres: number, tempC: number) {
  return `${code}-${lengthMetres}m-${tempC}oC`;
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
      className="absolute z-[5] flex size-6 items-center justify-center rounded-full border border-red-300 bg-white text-red-600 shadow-md hover:border-red-500 hover:bg-red-50"
      style={{ left: box.left + Math.max(0, width - 26), top: 18 }}
    >
      <X className="size-3.5" strokeWidth={2.5} />
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
      <h2 className="text-sm font-bold">Sơ đồ 4 dải ray · đường tim giữa 2 ray · lý trình thi công</h2>
      <p className="text-xs text-slate-600">Màu thanh: <span className="font-semibold text-slate-500">xám</span> = đã tạo · <span className="font-semibold text-emerald-700">xanh</span> = giải toả T≥30°C · <span className="font-semibold text-orange-600">cam</span> = giải toả T&lt;30°C. Mối hàn: xanh FBW · đỏ nhiệt nhôm · vàng ray đơn.</p>
      <p className="text-xs text-slate-500">Đường tim nằm giữa Ray trái/phải mỗi tuyến (mốc ~500 m). Ký hiệu công trình chỉ hiện biểu tượng — tra tên ở Legend. Bấm thanh để sửa nhiệt độ / giải toả.</p>
    </div>
    <div className={embedded ? "" : "overflow-x-auto"}>
      <div className="space-y-1 px-4 py-3" style={{ width: 150 + width }}>
        {rows.map((row, rowIndex) => {
          const lastVisible = [...row.cells].reverse().find((cell) => cell.released || cell.placed);
          const lastEnd = lastVisible ? parseChainage(lastVisible.to) : null;
          const plusLeft = lastEnd === null ? 8 : (lastEnd - extent.startMetres) * TRACK_PIXELS_PER_METRE + 8;
          const rowLongRails = longRails.flatMap((rail) => {
            if (rail.rowKey !== railRowKey(row)) return [];
            const span = visibleLongRailSpan(rows, rail);
            return span ? [{ rail, span }] : [];
          });
          const key = railRowKey(row);
          return <Fragment key={key}><div className="grid grid-cols-[110px_1fr] gap-x-2">
          <div className="text-[11px] font-semibold leading-4 text-slate-700" style={{ paddingTop: 26 }}>{row.rail}</div>
          <div className="relative" style={{ width, height: 64 }}>
            <div className="absolute inset-x-0 bottom-0" style={{ top: 0 }}>
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
                const tempC = cover.rail.params.neutralTemp ?? cover.rail.params.airTemp ?? cell.temp;
                const tone = longRailTone(cover.rail, cell.released, cell.temp);
                const done = Boolean(cover.rail.completedAt) || Boolean(cell.released);
                const selected = selectedId === cell.id || selectedLongRailId === cover.rail.id;
                const lengthM = Math.max(0, to - from);
                const label = shortRailChipLabel(cover.rail.code, lengthM, tempC);
                const statusNote = !done
                  ? "Chưa giải toả"
                  : tempC >= STRESS_PASS_TEMP_C
                    ? "Giải toả · T≥30"
                    : "Giải toả · T<30";
                return (
                  <span key={cell.id}>
                    <button
                      type="button"
                      data-testid="rail-grid-short"
                      onClick={() => { onSelect(cell.id); onSelectLongRail?.(cover.rail.id); }}
                      title={`${label} · ${cell.id} · ${cover.rail.params.railType} · Km ${cell.from} – ${cell.to} · ${statusNote}`}
                      aria-label={`${label}: thanh ngắn của ${cover.rail.code}`}
                      className={`absolute top-5 z-[1] h-8 overflow-hidden rounded border pr-7 px-1 text-[10px] font-semibold leading-tight ${selected ? "ring-2 ring-offset-1" : ""}`}
                      style={{ ...box, width: Math.max(1, box.width - 4), backgroundColor: selected ? `${tone}e6` : done ? tone : `${tone}c7`, borderColor: tone, color: contrastText(tone), outlineColor: tone }}
                    >
                      <span className="block truncate">{label}</span>
                      {done ? <span className="block truncate text-[9px] font-medium opacity-90">{statusNote}</span> : null}
                    </button>
                    {chipDeleteButton(cell.id, box, onRemove)}
                  </span>
                );
              }
              const lengthM = Math.max(0, to - from);
              const bareLabel = shortRailChipLabel(cell.id, lengthM, cell.temp);
              const done = Boolean(cell.released);
              const tone = releaseTone(done, cell.temp);
              const statusNote = !done
                ? "Chưa giải toả"
                : cell.temp >= STRESS_PASS_TEMP_C
                  ? "Giải toả · T≥30"
                  : "Giải toả · T<30";
              return <span key={cell.id}>
                <button
                  type="button"
                  onClick={() => { onSelect(cell.id); onSelectLongRail?.(null); }}
                  title={`${bareLabel} · Km ${cell.from} – ${cell.to} · ${statusNote}`}
                  className={`absolute top-5 z-[1] h-8 overflow-hidden rounded border pr-7 px-1 text-[10px] font-semibold leading-tight ${selectedId === cell.id ? "ring-2 ring-offset-1" : ""}`}
                  style={{
                    ...box,
                    width: Math.max(1, box.width - 4),
                    backgroundColor: selectedId === cell.id ? `${tone}e6` : done ? tone : `${tone}c7`,
                    borderColor: tone,
                    color: contrastText(tone),
                    outlineColor: tone,
                  }}
                >
                  <span className="block truncate">{bareLabel}</span>
                  {done ? <span className="block truncate text-[9px] font-medium opacity-90">{statusNote}</span> : null}
                </button>
                {chipDeleteButton(cell.id, box, onRemove)}
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
                  className={`absolute z-10 flex size-8 -translate-x-1/2 appearance-none items-center justify-center border-0 bg-transparent p-0 ${selectedJointId === joint.id ? "rounded-full ring-2 ring-slate-700 ring-offset-1" : ""}`}
                  style={{ left: (joint.metres - extent.startMetres) * TRACK_PIXELS_PER_METRE, top: 20 }}
                >
                  <span className={`block size-4 rounded-full border-2 shadow-md ${weldMethodTone(method)}`} />
                  {weld && <span className="absolute bottom-full left-1/2 mb-0.5 max-w-24 -translate-x-1/2 truncate whitespace-nowrap text-[9px] font-medium text-slate-800">{weld.code}</span>}
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
        </div>
        {rows[rowIndex + 1]?.line === row.line && (rowIndex === 0 || rows[rowIndex - 1].line !== row.line) && (
          <TrackCenterline structures={structures} rows={[row, rows[rowIndex + 1]]} startMetres={extent.startMetres} width={lineWidth} />
        )}
        </Fragment>;
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
