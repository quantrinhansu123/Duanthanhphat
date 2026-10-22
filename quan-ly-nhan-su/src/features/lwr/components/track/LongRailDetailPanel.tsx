"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { formatChainage, getPlacementSpan, type LongRail, type TrackLayout } from "@lwr/lib/track-editor";
import type { StressInput } from "@lwr/lib/stress-release";
import { StressReleaseCalculator } from "./StressReleaseCalculator";

export function LongRailDetailPanel({
  longRail,
  layout,
  onClose,
  onSaveParams,
}: {
  longRail: LongRail;
  layout: TrackLayout;
  onClose: () => void;
  onSaveParams: (params: StressInput) => boolean | void;
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
            Thanh dài {longRail.code}
          </h2>
          <p className="text-sm text-slate-500">{longRail.label || "Chưa đặt tên"}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết thanh dài" className="rounded-lg border p-2">
          <X className="size-5" />
        </button>
      </header>
      <div ref={content} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
        <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-white p-3 text-sm">
          <div>
            <dt className="text-slate-500">Dải ray</dt>
            <dd className="font-semibold">{row ? `${row.line} · ${row.rail}` : longRail.rowKey}</dd>
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
            <dt className="text-slate-500">Cập nhật</dt>
            <dd className="font-semibold">
              {new Date(longRail.updatedAt).toLocaleString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
        </dl>
        <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">
          Toàn bộ thông số giải toả gắn với thanh dài này. Bấm <b>Lưu thông số</b> để giữ lại và xem lại sau.
        </p>
        <StressReleaseCalculator
          key={`${longRail.id}-${longRail.updatedAt}`}
          compact
          segmentId={longRail.code}
          initialInput={{
            ...longRail.params,
            trackSide: longRail.rowKey.endsWith("T") ? "LEFT" : "RIGHT",
            startChainage: longRail.params.startChainage || (span ? formatChainage(span.startMetres) : ""),
            endChainage: longRail.params.endChainage || (span ? formatChainage(span.endMetres) : ""),
          }}
          onSave={onSaveParams}
        />
      </div>
    </aside>
  );
}
