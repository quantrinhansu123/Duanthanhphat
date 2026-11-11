"use client";

import { useEffect, useState } from "react";
import { TrackPrint } from "@/features/lwr/components/track/TrackPrint";
import { loadTrackLayout } from "@lwr/lib/track-layout-storage";
import { loadStructureSymbols } from "@lwr/lib/structure-storage";
import { loadJournalWelds } from "@lwr/lib/weld-journal";
import { buildRailJoints } from "@lwr/lib/weld-track-map";
import { parseChainage, type TrackLayout } from "@lwr/lib/track-editor";
import type { StructureSymbol } from "@lwr/types/structure";
import type { RailJoint } from "@lwr/types/weld";

type Loaded = { layout: TrackLayout; symbols: StructureSymbol[]; joints: RailJoint[] };

/**
 * In «Phụ lục nghiệm thu giải toả ứng suất» (BBNT - GTUS) theo một RFI GTUS:
 * nạp sơ đồ track map của dự án, chỉ lấy các thanh ray đã chọn trong RFI và in đúng đoạn Km của chúng.
 */
export default function GtusBbntPrintDialog({ projectId, projectName, cellIds, onClose }: {
  projectId: string;
  projectName: string;
  /** Mã các thanh ray (cell) đã chọn trong RFI. */
  cellIds: string[];
  onClose: () => void;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [layoutResult, symbols, welds] = await Promise.all([
          loadTrackLayout(projectId),
          loadStructureSymbols().catch(() => [] as StructureSymbol[]),
          loadJournalWelds().catch(() => ({ welds: [] })),
        ]);
        if (!active) return;
        if (!layoutResult.layout) { setError(layoutResult.error ?? "Dự án chưa có sơ đồ track map."); return; }
        const layout = layoutResult.layout;
        const projectWelds = welds.welds.filter((weld) => !projectName || weld.project === projectName);
        const joints = buildRailJoints(layout.rows, projectWelds, 0, layout.jointWeldLinks, layout.longRails).joints;
        setData({ layout, symbols, joints });
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Không tải được sơ đồ track map."); }
    })();
    return () => { active = false; };
  }, [projectId, projectName]);

  if (error) {
    return (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-900/60 p-4">
        <div className="max-w-md rounded-xl bg-white p-5 text-sm shadow-xl">
          <p role="alert" className="text-red-700">{error}</p>
          <button type="button" className="mt-3 h-10 rounded-lg border border-slate-300 px-4 font-semibold" onClick={onClose}>Đóng</button>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div role="status" className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-900/60 text-sm font-semibold text-white">
        Đang tải sơ đồ track map…
      </div>
    );
  }
  const spans = data.layout.rows.flatMap((row) => row.cells.filter((cell) => cellIds.includes(cell.id)).flatMap((cell) => {
    const from = parseChainage(cell.from), to = parseChainage(cell.to);
    return from !== null && to !== null && to > from ? [{ from, to }] : [];
  }));
  const start = spans.length ? Math.min(...spans.map((x) => x.from)) : undefined;
  const end = spans.length ? Math.max(...spans.map((x) => x.to)) : undefined;
  return (
    <TrackPrint
      layout={data.layout}
      joints={data.joints}
      symbols={data.symbols}
      projectName={projectName}
      initialFormat="BBNT"
      initialRange={start !== undefined && end !== undefined ? { start, end } : undefined}
      onlyCellIds={cellIds}
      onClose={onClose}
    />
  );
}
