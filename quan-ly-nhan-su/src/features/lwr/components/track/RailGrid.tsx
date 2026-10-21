"use client";

import { memo } from "react";
import { ArrowLeftRight, Link2, TriangleAlert } from "lucide-react";
import { RAIL_ROWS, tempBand } from "@lwr/lib/track-data";
import { jointsForRow, weldStatusTone } from "@lwr/lib/weld-track-map";
import type { RailRow } from "@lwr/types/track";
import type { RailJoint } from "@lwr/types/weld";
import { TempCell } from "./TempCell";
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
  alertIds,
  embedded = false,
  joints = [],
  selectedJointId = null,
  onSelectJoint,
}: RailGridProps) {
  const columns = Math.max(...rows.map((row) => row.cells.length), 1);
  const gridStyle = { gridTemplateColumns: buildTemplate(columns) };
  const hotIds = alertIds ?? rows.flatMap((row) => row.cells.filter((cell) => tempBand(cell.temp) === "gt40").map((cell) => cell.id));
  const hasCells = rows.some((row) => row.cells.length > 0);

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
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600">
            Chưa giải tỏa
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-[12px] font-semibold text-white">
            Đã giải tỏa
          </span>
        </div>
      </div>

      <div className={embedded ? "" : "overflow-x-auto"}>
        {!hasCells ? (
          <div className="px-4 py-6">
            <p className="text-center text-sm text-slate-500">
              Ban đầu chưa có ô nhiệt độ. Dùng <span className="font-semibold text-slate-700">Ghép thêm thanh</span> phía trên — sau khi thêm, ô sẽ hiện trên sơ đồ.
            </p>
            <div className="mx-auto mt-4 grid max-w-xl gap-2 sm:grid-cols-2">
              {rows.map((row) => (
                <div
                  key={row.line + row.rail}
                  className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                >
                  <span className="font-semibold text-slate-800">{row.line}</span>
                  <span className="mt-0.5 block">{row.rail}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
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
                        {hotIds.includes(c.id) && (
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
                        released={Boolean(c.released)}
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
        )}
      </div>
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
