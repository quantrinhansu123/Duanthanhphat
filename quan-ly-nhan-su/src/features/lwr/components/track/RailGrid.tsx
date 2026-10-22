"use client";

import { memo } from "react";
import { RAIL_ROWS } from "@lwr/lib/track-data";
import { jointsForRow, weldMethodTone } from "@lwr/lib/weld-track-map";
import { formatChainage, getPlacementSpan, parseChainage, railRowKey, trackExtent, trackSpanStyle, TRACK_PIXELS_PER_METRE, type LongRail } from "@lwr/lib/track-editor";
import type { RailRow } from "@lwr/types/track";
import type { RailJoint } from "@lwr/types/weld";

interface RailGridProps {
  rows?: RailRow[];
  longRails?: LongRail[];
  onSelectLongRail?: (id: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  alertIds?: string[];
  embedded?: boolean;
  joints?: RailJoint[];
  selectedJointId?: string | null;
  onSelectJoint?: (joint: RailJoint) => void;
}

export const RailGrid = memo(function RailGrid({ rows = RAIL_ROWS, longRails = [], onSelectLongRail, selectedId, onSelect, embedded = false, joints = [], selectedJointId, onSelectJoint }: RailGridProps) {
  const extent = trackExtent(rows);
  const width = Math.max(1, (extent.endMetres - extent.startMetres) * TRACK_PIXELS_PER_METRE);
  return <div className="border-t border-slate-200 bg-white">
    <div className="space-y-1 border-b px-4 py-3">
      <h2 className="text-sm font-bold">Sơ đồ 4 dải ray · lý trình thi công thực tế</h2>
      <p className="text-xs text-slate-600">Mối hàn: <span className="rounded border bg-white px-1">Trắng: chưa hàn</span> · <span className="text-blue-700">Xanh: FBW</span> · <span className="text-red-700">Đỏ: nhiệt nhôm</span>. Bấm mối hàn để liên kết nhật ký và điền số mối hàn.</p>
      <p className="text-xs text-slate-500">Đoạn thi công: xám = chưa hoàn thành; xanh lá = đã giải toả. Ray trái/phải nhìn theo chiều lý trình tăng.</p>
    </div>
    <div className={embedded ? "" : "overflow-x-auto"}>
      <div className="space-y-4 px-4 py-3" style={{ width: 150 + width }}>
        {rows.map(row => <div key={railRowKey(row)} className="grid grid-cols-[110px_1fr] gap-x-2">
          <div className="text-[11px]"><b>{row.line}</b><br />{row.rail}</div>
          <div className="relative" style={{ width, height: 115 }}>
            {row.cells.map(cell => {
              const from = parseChainage(cell.from) ?? 0, to = parseChainage(cell.to) ?? 0;
              const box = trackSpanStyle(from, to, extent.startMetres);
              return <button key={cell.id} type="button" onClick={() => onSelect(cell.id)} title={`${cell.id} · ${cell.from} – ${cell.to}`} className={`absolute top-5 h-8 overflow-hidden rounded border bg-slate-100 text-[10px] text-slate-700 ${selectedId === cell.id ? "ring-2 ring-blue-500" : ""}`} style={{ ...box, width: Math.max(1, box.width - 4) }}>
                <span className="block truncate">{cell.id} · {cell.temp}°C</span>
              </button>;
            })}
            {jointsForRow(joints, row).map(joint => {
              const weld = joint.welds[0];
              return <button key={joint.id} type="button" onClick={() => onSelectJoint?.(joint)} title={`${joint.chainage} · ${joint.welds.map(w => w.code).join(", ") || "Chưa hàn — liên kết nhật ký"}`} aria-label={`Mối hàn ${row.line} ${row.rail} Km${joint.chainage}`} className={`absolute top-4 z-10 h-10 w-2 -translate-x-1/2 rounded border ${weldMethodTone(weld?.method)} ${selectedJointId === joint.id ? "ring-2 ring-slate-700" : ""}`} style={{ left: (joint.metres - extent.startMetres) * TRACK_PIXELS_PER_METRE }}>
                {weld && <span className="absolute bottom-full left-1/2 max-w-24 -translate-x-1/2 truncate whitespace-nowrap text-[9px] text-slate-800">{weld.code}</span>}
              </button>;
            })}
            {longRails.filter(rail => rail.rowKey === railRowKey(row)).map(rail => {
              const span = getPlacementSpan(rows, rail);
              if (!span) return null;
              return <button key={rail.id} type="button" onClick={() => onSelectLongRail?.(rail.id)} title={`${rail.code} · ${rail.releaseDate ?? "Chưa có ngày"} · ${formatChainage(span.startMetres)} – ${formatChainage(span.endMetres)}`} className={`absolute top-16 h-7 overflow-hidden rounded border px-1 text-[10px] ${rail.completedAt ? "border-emerald-700 bg-emerald-600 text-white" : "border-slate-400 bg-slate-100 text-slate-600"}`} style={trackSpanStyle(span.startMetres, span.endMetres, extent.startMetres)}>{rail.code} · {rail.releaseDate} · {rail.params.neutralTemp}°C</button>;
            })}
            <span className="absolute bottom-0 left-0 text-[10px] text-slate-500">Km{formatChainage(extent.startMetres)}</span>
            <span className="absolute bottom-0 right-0 text-[10px] text-slate-500">Km{formatChainage(extent.endMetres)}</span>
          </div>
        </div>)}
      </div>
    </div>
  </div>;
});
