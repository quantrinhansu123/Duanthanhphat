"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { formatChainage, getPlacementSpan, railDisplayLabel, type LongRail, type TrackLayout } from "@lwr/lib/track-editor";
import type { StressInput } from "@lwr/lib/stress-release";
import { StressReleaseCalculator, type StressSaveResult } from "./StressReleaseCalculator";
import { ReleaseStatusButtons } from "./RailDetailPanel";

export function LongRailDetailPanel({
  longRail,
  layout,
  onClose,
  onSaveParams,
  onMethodChange,
  onPassChange,
  passed = false,
}: {
  longRail: LongRail;
  layout: TrackLayout;
  onClose: () => void;
  onSaveParams: (params: StressInput) => StressSaveResult | boolean | void;
  onMethodChange?: (method: StressInput["method"]) => void;
  onPassChange?: (passed: boolean) => void;
  passed?: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  const span = getPlacementSpan(layout.rows, longRail);
  const row = span?.row;
  const length = span ? span.endMetres - span.startMetres : null;

  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
  }, [longRail.id]);

  return (
    <aside
      aria-labelledby="long-rail-detail-title"
      className="flex h-[calc(100dvh-100px)] min-h-[400px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-900 xl:sticky xl:top-0"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-white px-4 py-3">
        <div>
          <h2 id="long-rail-detail-title" className="text-lg font-bold">
            Lý trình {longRail.code}
          </h2>
          <p className="text-sm text-slate-500">{longRail.label || "Chưa đặt tên"}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết lý trình" className="rounded-lg border p-2">
          <X className="size-5" />
        </button>
      </header>
      <div ref={content} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
        <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-white p-3 text-sm">
          <div>
            <dt className="text-slate-500">Dải ray</dt>
            <dd className="font-semibold">{row ? `${railDisplayLabel(row.line, row.rail)} (${row.line})` : longRail.rowKey}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Chiều dài</dt>
            <dd className="font-semibold">{length !== null ? `${length} m` : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Lý trình</dt>
            <dd className="font-semibold">
              {span
                ? `Km ${formatChainage(span.startMetres)} – ${formatChainage(span.endMetres)}`
                : `${longRail.startCellId} → ${longRail.endCellId}`}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Trạng thái</dt>
            <dd className="font-semibold">
              {longRail.completedAt ? "Đã giải toả · lý trình khóa" : "Đang thi công · cập nhật lý trình cuối hàng ngày"}
            </dd>
          </div>
        </dl>
        <StressReleaseCalculator
          key={longRail.id}
          compact
          segmentId={longRail.code}
          chainageLocked={Boolean(longRail.completedAt)}
          statusSlot={
            onPassChange
              ? <ReleaseStatusButtons passed={passed} onChange={onPassChange} />
              : undefined
          }
          initialInput={{
            ...longRail.params,
            trackSide: longRail.rowKey.endsWith("T") ? "LEFT" : "RIGHT",
            startChainage: longRail.params.startChainage || (span ? formatChainage(span.startMetres) : ""),
            endChainage: longRail.params.endChainage || (span ? formatChainage(span.endMetres) : ""),
          }}
          onSave={onSaveParams}
          onModeChange={(mode) => onMethodChange?.(mode === "BUFFER" ? "SINGLE" : mode)}
        />
      </div>
    </aside>
  );
}
