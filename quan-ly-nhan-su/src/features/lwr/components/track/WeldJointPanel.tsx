"use client";

import { X } from "lucide-react";
import { weldStatusTone } from "@lwr/lib/weld-track-map";
import type { RailJoint } from "@lwr/types/weld";

interface WeldJointPanelProps {
  joint: RailJoint;
  onClose: () => void;
}

/** Chi tiết mối hàn tại một ranh giới giữa hai thanh ray. */
export function WeldJointPanel({ joint, onClose }: WeldJointPanelProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mối hàn giữa thanh</div>
          <h3 className="mt-0.5 text-[15px] font-bold text-slate-900">
            {joint.leftCellId} → {joint.rightCellId}
          </h3>
          <p className="text-[12px] text-slate-500">Lý trình {joint.chainage}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 p-4">
        {joint.welds.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
            Chưa có nhật ký hàn gắn lý trình gần điểm này.
          </p>
        ) : (
          joint.welds.map((weld) => (
            <div key={weld.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-[#0b4c8f]">{weld.code}</span>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${weldStatusTone(weld.status, weld.failed)}`}
                >
                  {weld.status}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                <div>
                  <dt className="text-slate-400">Ngày</dt>
                  <dd className="font-medium text-slate-800">{weld.date || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Lý trình</dt>
                  <dd className="font-medium text-slate-800">{weld.chainage || "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-400">Dự án</dt>
                  <dd className="font-medium text-slate-800">{weld.project}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Thợ hàn</dt>
                  <dd className="font-medium text-slate-800">{weld.welder}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Công nghệ</dt>
                  <dd className="font-medium text-slate-800">
                    {weld.method} · {weld.weldType}
                  </dd>
                </div>
              </dl>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
