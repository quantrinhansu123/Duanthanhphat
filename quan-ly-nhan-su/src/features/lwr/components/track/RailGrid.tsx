"use client";

import { memo } from "react";
import { ArrowLeftRight, Link2, TriangleAlert } from "lucide-react";
import { RAIL_ROWS } from "@lwr/lib/track-data";
import { jointsForRow, weldStatusTone } from "@lwr/lib/weld-track-map";
import type { RailRow } from "@lwr/types/track";
import type { RailJoint } from "@lwr/types/weld";
import { TempCell } from "./TempCell";
import { BandLegend } from "./BandLegend";
import { cn } from "@lwr/lib/utils";

interface RailGridProps {
  rows?: RailRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  alertIds?: string[];
  embedded?: boolean;
  joints?: RailJoint[];
  selectedJointId?: string | null;
  onSelectJoint?: (joint: RailJoint) => void;
}

function buildTemplate(columns: number) {
  // Fixed tracks avoid expensive 1fr reflow while scrolling / opening selects.
  const parts = ["110px"];
  for (let i = 0; i < columns; i += 1) {
    parts.push("110px");
    if (i < columns - 1) parts.push("28px");
  }
  return parts.join(" ");
}

/** 4-rail locking-temperature grid. Joints between cells = mối hàn từ nhật ký. */
export const RailGrid = memo(function RailGrid({
  rows = RAIL_ROWS,
  selectedId,
  onSelect,
  alertIds = ["DT-05"],
  embedded = false,
  joints = [],
  selectedJointId = null,
  onSelectJoint,
}: RailGridProps) {
  const columns = Math.max(...rows.map((row) => row.cells.length), 1);
  const gridStyle = { gridTemplateColumns: buildTemplate(columns) };

  return (
    <div className={embedded ? "border-t border-slate-200 bg-white" : "rounded-lg border border-slate-200 bg-white"}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <h2 className="text-[15px] font-bold text-slate-900">Sơ đồ 4 dải ray</h2>
        <span className="flex items-center gap-1 text-[12px] text-slate-500">
          <ArrowLeftRight className="h-3.5 w-3.5" /> Giữa các thanh = mối hàn từ nhật ký
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-800">
            <Link2 className="h-3.5 w-3.5" />
            Mối hàn nhật ký
          </span>
          <span className="rounded-md bg-slate-100 px-3 py-1 text-[12.5px] font-semibold text-slate-900">
            Nhiệt độ khóa
          </span>
        </div>
      </div>

      <div className={embedded ? "" : "overflow-x-auto"}>
        <div className="space-y-4 px-4 py-3" style={{ minWidth: `${142 + columns * 118}px` }}>
          {rows.map((row) => {
            const rowJoints = jointsForRow(joints, row);
            return (
              <div key={row.line + row.rail}>
                <div className="grid items-end gap-x-1" style={gridStyle}>
                  <div />
                  {row.cells.flatMap((c, index) => {
                    const nodes = [
                      <div key={`h-${c.id}`} className="pb-1 text-center text-[11px] text-slate-500">
                        {c.id}
                        {alertIds.includes(c.id) && (
                          <TriangleAlert className="ml-1 inline h-3.5 w-3.5 text-red-500" />
                        )}
                      </div>,
                    ];
                    if (index < row.cells.length - 1) {
                      nodes.push(<div key={`hs-${c.id}`} />);
                    }
                    return nodes;
                  })}
                </div>

                <div className="grid items-stretch gap-x-1" style={gridStyle}>
                  <div className="leading-tight">
                    <div className="text-[11.5px] font-bold text-slate-900">{row.line}</div>
                    <div className="text-[11.5px] text-slate-500">{row.rail}</div>
                  </div>
                  {row.cells.flatMap((c, index) => {
                    const joint = rowJoints.find((item) => item.leftCellId === c.id);
                    const nodes = [
                      <TempCell
                        key={`c-${c.id}`}
                        id={c.id}
                        temp={c.temp}
                        selected={c.id === selectedId}
                        onSelect={onSelect}
                      />,
                    ];
                    if (index < row.cells.length - 1) {
                      nodes.push(
                        <JointMark
                          key={`j-${c.id}`}
                          joint={joint}
                          selected={joint?.id === selectedJointId}
                          onSelect={onSelectJoint}
                        />,
                      );
                    }
                    return nodes;
                  })}
                </div>

                <div className="mt-1 grid gap-x-1" style={gridStyle}>
                  <div />
                  {row.cells.flatMap((c, index) => {
                    const joint = rowJoints.find((item) => item.leftCellId === c.id);
                    const nodes = [
                      <div key={`f-${c.id}`} className="flex justify-between text-[10.5px] text-slate-500">
                        <span>{c.from}</span>
                        <span>{c.to}</span>
                      </div>,
                    ];
                    if (index < row.cells.length - 1) {
                      nodes.push(
                        <div key={`fc-${c.id}`} className="text-center text-[9px] font-medium text-slate-400">
                          {joint?.chainage ?? ""}
                        </div>,
                      );
                    }
                    return nodes;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {!embedded && <BandLegend />}
    </div>
  );
});

function JointMark({
  joint,
  selected,
  onSelect,
}: {
  joint?: RailJoint;
  selected?: boolean;
  onSelect?: (joint: RailJoint) => void;
}) {
  if (!joint) {
    return <div className="mx-auto h-full w-2 rounded-full bg-slate-200" aria-hidden />;
  }
  const weld = joint.welds[0];
  const count = joint.welds.length;
  const tone = weld
    ? weldStatusTone(weld.status, weld.failed)
    : "bg-white text-slate-400 border-dashed border-slate-300";

  return (
    <button
      type="button"
      title={
        weld
          ? `${weld.code} · ${joint.chainage}${count > 1 ? ` (+${count - 1})` : ""}`
          : `Chưa có mối hàn · ${joint.chainage}`
      }
      onClick={() => onSelect?.(joint)}
      className={cn(
        "mx-auto flex h-full min-h-[36px] w-6 flex-col items-center justify-center rounded-md border text-[9px] font-bold",
        tone,
        selected && "ring-2 ring-blue-500 ring-offset-1",
      )}
    >
      {weld ? (count > 1 ? String(count) : "●") : "○"}
    </button>
  );
}
