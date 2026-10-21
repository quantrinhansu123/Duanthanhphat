"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CELL_ID } from "@/lib/track-data";
import {
  createInitialTrackLayout,
  extendRailRows,
  formatChainage,
  getPlacementSpan,
  parseChainage,
  trackExtent,
  TRACK_LAYOUT_STORAGE_KEY,
  updateRailCell,
  validateTrackLayout,
  type RailCellPatch,
  type TrackLayout,
  type TrackPlacement,
} from "@/lib/track-editor";
import { loadStructureSymbols } from "@/lib/structure-storage";
import { loadJournalWelds } from "@/lib/weld-journal";
import { buildRailJoints } from "@/lib/weld-track-map";
import type { StructureSymbol } from "@/types/structure";
import type { RailJoint } from "@/types/weld";
import { TrackHeader } from "./TrackHeader";
import { TrackSchematic } from "./TrackSchematic";
import { RailGrid } from "./RailGrid";
import { RailDetailPanel } from "./RailDetailPanel";
import { WeldJointPanel } from "./WeldJointPanel";

interface TrackDashboardProps {
  initialCellId?: string;
}

/** Client boundary for the dashboard: owns the selected-cell state and
 *  composes server-capable presentational components. */
export function TrackDashboard({ initialCellId = DEFAULT_CELL_ID }: TrackDashboardProps) {
  const [selectedId, setSelectedId] = useState(initialCellId);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedJoint, setSelectedJoint] = useState<RailJoint | null>(null);
  const detailContainer = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(createInitialTrackLayout);
  const [symbols, setSymbols] = useState<StructureSymbol[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbolError, setSymbolError] = useState<string | null>(null);
  const [weldError, setWeldError] = useState<string | null>(null);
  const [weldCount, setWeldCount] = useState(0);
  const [weldsMapped, setWeldsMapped] = useState(0);
  const [joints, setJoints] = useState<RailJoint[]>([]);
  const cells = layout.rows.flatMap((row) => row.cells);
  const cell = cells.find((item) => item.id === selectedId) ?? cells[0];
  const extent = trackExtent(layout.rows);
  const totalLength = cells.reduce(
    (sum, item) => sum + (parseChainage(item.to) ?? 0) - (parseChainage(item.from) ?? 0),
    0,
  );

  const reloadSymbols = useCallback(async () => {
    try {
      setSymbols(await loadStructureSymbols());
      setSymbolError(null);
    } catch (cause) {
      setSymbolError(cause instanceof Error ? cause.message : "Không tải được danh mục ký hiệu.");
    }
  }, []);

  const reloadWelds = useCallback(async (rows = layout.rows) => {
    try {
      const result = await loadJournalWelds();
      if (result.error) setWeldError(result.error);
      else setWeldError(null);
      const mapped = buildRailJoints(rows, result.welds);
      setJoints(mapped.joints);
      setWeldCount(result.welds.length);
      setWeldsMapped(result.welds.length - mapped.unmatched.length);
    } catch (cause) {
      setWeldError(cause instanceof Error ? cause.message : "Không tải được nhật ký hàn.");
      setJoints(buildRailJoints(rows, []).joints);
      setWeldCount(0);
      setWeldsMapped(0);
    }
  }, [layout.rows]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        const stored = localStorage.getItem(TRACK_LAYOUT_STORAGE_KEY);
        if (stored) {
          const restored = validateTrackLayout(JSON.parse(stored));
          if (!restored) throw new Error("Sơ đồ đã lưu không hợp lệ. Dữ liệu gốc vẫn được giữ; chưa thể chỉnh sửa.");
          setLayout(restored);
        }
        setReady(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Không đọc được sơ đồ đã lưu.");
      }
      void reloadSymbols();
    });
    const refresh = () => {
      void reloadSymbols();
      void reloadWelds();
    };
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
    };
  }, [reloadSymbols, reloadWelds]);

  useEffect(() => {
    void reloadWelds(layout.rows);
  }, [layout.rows, reloadWelds]);

  const jointWithWelds = useMemo(() => joints.filter((j) => j.welds.length > 0).length, [joints]);

  function commit(next: TrackLayout): boolean {
    if (!ready) return false;
    try {
      localStorage.setItem(TRACK_LAYOUT_STORAGE_KEY, JSON.stringify(next));
      setLayout(next);
      setError(null);
      return true;
    } catch {
      setError("Không lưu được sơ đồ trên trình duyệt. Kiểm tra dung lượng hoặc quyền lưu dữ liệu trang web.");
      return false;
    }
  }

  function savePlacement(placement: TrackPlacement) {
    if (!getPlacementSpan(layout.rows, placement)) {
      setError("Thanh bắt đầu và kết thúc phải đúng thứ tự trên cùng một dải ray.");
      return false;
    }
    const exists = layout.placements.some((item) => item.id === placement.id);
    return commit({
      ...layout,
      placements: exists
        ? layout.placements.map((item) => (item.id === placement.id ? placement : item))
        : [...layout.placements, placement],
    });
  }

  function saveCellPatch(patch: RailCellPatch) {
    try {
      return commit({ ...layout, rows: updateRailCell(layout.rows, cell.id, patch) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không cập nhật được đoạn ray.");
      return false;
    }
  }

  function step(direction: 1 | -1) {
    const index = cells.findIndex((item) => item.id === cell.id);
    setSelectedId(cells[(index + direction + cells.length) % cells.length].id);
  }

  if (!cell) return null;

  return (
    <div className="w-full max-w-none space-y-3">
      <TrackHeader
        subtitle={`Tuyến ${(extent.endMetres - extent.startMetres) / 1000} km · ${layout.rows.length} dải ray · ${cells.length} thanh ray`}
        rangeLabel={`Km ${formatChainage(extent.startMetres)} – ${formatChainage(extent.endMetres)}`}
        stats={[
          { label: "Tổng chiều dài ray", value: `${totalLength / 1000} km`, tone: "text-slate-900" },
          { label: "Thanh ray", value: String(cells.length), tone: "text-slate-900" },
          { label: "Mối hàn (nhật ký)", value: String(weldCount), tone: "text-blue-700" },
          { label: "Đã gắn lý trình", value: `${weldsMapped}/${jointWithWelds} điểm`, tone: "text-emerald-700" },
        ]}
      />
      <p className="text-xs text-slate-500">
        Điểm giữa hai thanh ray là mối hàn — lấy từ Nhật ký hàn (Supabase). Ưu tiên khớp theo lý trình GPS.
      </p>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {weldError && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {weldError}
        </p>
      )}
      <div
        className={
          detailOpen || selectedJoint
            ? "grid min-w-0 grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_460px]"
            : "min-w-0"
        }
      >
        <div className="min-w-0" data-testid="track-main">
          <TrackSchematic
            layout={layout}
            symbols={symbols}
            ready={ready}
            symbolError={symbolError}
            onReloadSymbols={() => {
              void reloadSymbols();
            }}
            onPlacement={savePlacement}
            onRemove={(id) => {
              commit({ ...layout, placements: layout.placements.filter((item) => item.id !== id) });
            }}
            onExtend={(count) => commit({ ...layout, rows: extendRailRows(layout.rows, count) })}
          >
            <RailGrid
              rows={layout.rows}
              embedded
              joints={joints}
              selectedJointId={selectedJoint?.id ?? null}
              selectedId={cell.id}
              onSelect={(id) => {
                setSelectedId(id);
                setSelectedJoint(null);
                setDetailOpen(true);
                requestAnimationFrame(() => {
                  if (window.innerWidth < 1280) {
                    detailContainer.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                });
              }}
              onSelectJoint={(joint) => {
                setSelectedJoint(joint);
                setDetailOpen(false);
                requestAnimationFrame(() => {
                  if (window.innerWidth < 1280) {
                    detailContainer.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                });
              }}
            />
          </TrackSchematic>
        </div>
        {(detailOpen || selectedJoint) && (
          <div ref={detailContainer} className="min-w-0 space-y-3 xl:sticky xl:top-0">
            {selectedJoint ? (
              <WeldJointPanel joint={selectedJoint} onClose={() => setSelectedJoint(null)} />
            ) : null}
            {detailOpen ? (
              <RailDetailPanel
                cell={cell}
                onClose={() => setDetailOpen(false)}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
                onChange={saveCellPatch}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
