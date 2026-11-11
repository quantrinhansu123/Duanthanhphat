"use client";

import { useEffect, useState } from "react";
import { TrackPrint } from "@/features/lwr/components/track/TrackPrint";
import { loadTrackLayout } from "@lwr/lib/track-layout-storage";
import { loadStructureSymbols } from "@lwr/lib/structure-storage";
import { loadJournalWelds } from "@lwr/lib/weld-journal";
import { buildRailJoints } from "@lwr/lib/weld-track-map";
import type { TrackLayout } from "@lwr/lib/track-editor";
import type { StructureSymbol } from "@lwr/types/structure";
import type { RailJoint } from "@lwr/types/weld";

type Loaded = { layout: TrackLayout; symbols: StructureSymbol[]; joints: RailJoint[] };

/**
 * In «Phụ lục nghiệm thu giải toả ứng suất» (BBNT - GTUS) theo một RFI GTUS:
 * nạp sơ đồ track map của dự án, chỉ lấy các thanh LWR đã chọn trong RFI và in đúng đoạn Km của chúng.
 */
export default function GtusBbntPrintDialog({ projectId, projectName, lwrIds, onClose }: {
  projectId: string;
  projectName: string;
  lwrIds: string[];
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
  const rails = data.layout.longRails.filter((rail) => lwrIds.includes(rail.id) && Number.isFinite(rail.startMetres) && Number.isFinite(rail.endMetres));
  const start = rails.length ? Math.min(...rails.map((rail) => rail.startMetres as number)) : undefined;
  const end = rails.length ? Math.max(...rails.map((rail) => rail.endMetres as number)) : undefined;
  return (
    <TrackPrint
      layout={data.layout}
      joints={data.joints}
      symbols={data.symbols}
      projectName={projectName}
      initialFormat="BBNT"
      initialRange={start !== undefined && end !== undefined ? { start, end } : undefined}
      onlyLongRailIds={lwrIds}
      onClose={onClose}
    />
  );
}
