"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CELL_ID } from "@lwr/lib/track-data";
import {
  createInitialTrackLayout,
  defaultLongRailParams,
  extendRailRows,
  formatChainage,
  getPlacementSpan,
  longRailsOverlap,
  parseChainage,
  trackExtent,
  TRACK_LAYOUT_STORAGE_KEY,
  validateTrackLayout,
  type LongRail,
  type TrackLayout,
  type TrackPlacement,
} from "@lwr/lib/track-editor";
import type { StressInput } from "@lwr/lib/stress-release";
import {
  deleteLongRailRemote,
  loadLongRails,
  syncLocalLongRailsToSupabase,
  upsertLongRail,
} from "@lwr/lib/long-rail-storage";
import { loadStructureSymbols } from "@lwr/lib/structure-storage";
import { loadJournalWelds } from "@lwr/lib/weld-journal";
import { buildRailJoints } from "@lwr/lib/weld-track-map";
import type { StructureSymbol } from "@lwr/types/structure";
import type { RailJoint } from "@lwr/types/weld";
import { TrackHeader } from "./TrackHeader";
import { TrackSchematic } from "./TrackSchematic";
import { RailGrid } from "./RailGrid";
import { RailDetailPanel } from "./RailDetailPanel";
import { LongRailDetailPanel } from "./LongRailDetailPanel";
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
  const [selectedLongRailId, setSelectedLongRailId] = useState<string | null>(null);
  const detailContainer = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(createInitialTrackLayout);
  const [symbols, setSymbols] = useState<StructureSymbol[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [longRailSyncNote, setLongRailSyncNote] = useState<string | null>(null);
  const [symbolError, setSymbolError] = useState<string | null>(null);
  const [weldError, setWeldError] = useState<string | null>(null);
  const [weldCount, setWeldCount] = useState(0);
  const [weldsMapped, setWeldsMapped] = useState(0);
  const [joints, setJoints] = useState<RailJoint[]>([]);
  const cells = layout.rows.flatMap((row) => row.cells);
  const cell = cells.find((item) => item.id === selectedId) ?? cells[0];
  const selectedLongRail = layout.longRails.find((item) => item.id === selectedLongRailId) ?? null;
  const extent = trackExtent(layout.rows);
  const totalLength = cells.reduce(
    (sum, item) => sum + (parseChainage(item.to) ?? 0) - (parseChainage(item.from) ?? 0),
    0,
  );
  const sideOpen = detailOpen || Boolean(selectedJoint) || Boolean(selectedLongRail);

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
    void (async () => {
      let localLayout = createInitialTrackLayout();
      try {
        const stored = localStorage.getItem(TRACK_LAYOUT_STORAGE_KEY);
        if (stored) {
          const restored = validateTrackLayout(JSON.parse(stored));
          if (!restored) throw new Error("Sơ đồ đã lưu không hợp lệ. Dữ liệu gốc vẫn được giữ; chưa thể chỉnh sửa.");
          localLayout = restored;
        }
        if (!active) return;
        setLayout(localLayout);
        setReady(true);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Không đọc được sơ đồ đã lưu.");
        setReady(true);
      }
      void reloadSymbols();
      try {
        const synced = await syncLocalLongRailsToSupabase(localLayout.longRails);
        if (!active) return;
        if (synced.uploaded > 0) {
          setLongRailSyncNote(`Đã đưa ${synced.uploaded} thanh dài local lên Supabase.`);
        }
        const remote = await loadLongRails(localLayout.longRails);
        if (!active) return;
        if (remote.error && remote.source === "local") setLongRailSyncNote(remote.error);
        else if (remote.source === "supabase") {
          setLongRailSyncNote(null);
          const next = { ...localLayout, longRails: remote.rails };
          try {
            localStorage.setItem(TRACK_LAYOUT_STORAGE_KEY, JSON.stringify(next));
          } catch {
            /* keep in-memory */
          }
          setLayout(next);
        }
      } catch (cause) {
        if (!active) return;
        setLongRailSyncNote(cause instanceof Error ? cause.message : "Không đồng bộ thanh dài Supabase.");
      }
    })();
    const refresh = () => {
      void reloadSymbols();
      void reloadWelds();
      void loadLongRails().then((remote) => {
        if (remote.source !== "supabase") return;
        setLayout((current) => {
          const next = { ...current, longRails: remote.rails };
          try {
            localStorage.setItem(TRACK_LAYOUT_STORAGE_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        });
      });
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

  useEffect(() => {
    if (selectedLongRailId && !layout.longRails.some((item) => item.id === selectedLongRailId)) {
      setSelectedLongRailId(null);
    }
  }, [layout.longRails, selectedLongRailId]);

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

  function scrollDetailIntoView() {
    requestAnimationFrame(() => {
      if (window.innerWidth < 1280) {
        detailContainer.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
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

  function persistLongRail(longRail: LongRail, existing: LongRail | undefined) {
    const ok = commit({
      ...layout,
      longRails: existing
        ? layout.longRails.map((item) => (item.id === longRail.id ? longRail : item))
        : [...layout.longRails, longRail],
    });
    if (!ok) return false;
    setSelectedLongRailId(longRail.id);
    setDetailOpen(false);
    setSelectedJoint(null);
    scrollDetailIntoView();
    void upsertLongRail(longRail).then((result) => {
      if (!result.ok) setError(result.error ?? "Không lưu thanh dài lên Supabase.");
      else if (result.skipped && result.error) setLongRailSyncNote(result.error);
      else setLongRailSyncNote(null);
    });
    return true;
  }

  function saveLongRail(draft: LongRail) {
    const span = getPlacementSpan(layout.rows, draft);
    if (!span) {
      setError("Thanh dài: thanh bắt đầu và kết thúc phải đúng thứ tự trên cùng một dải ray.");
      return false;
    }
    const overlaps = layout.longRails.some(
      (other) => other.id !== draft.id && longRailsOverlap(layout.rows, draft, other),
    );
    if (overlaps) {
      setError("Thanh dài không được chồng lấn với thanh dài khác trên cùng dải ray.");
      return false;
    }
    const existing = layout.longRails.find((item) => item.id === draft.id);
    const length = span.endMetres - span.startMetres;
    const longRail: LongRail = {
      id: draft.id,
      code: draft.code,
      label: draft.label,
      rowKey: draft.rowKey,
      startCellId: draft.startCellId,
      endCellId: draft.endCellId,
      params: {
        ...(existing?.params ?? draft.params ?? defaultLongRailParams(layout.rows, draft)),
        leftLength: length,
      },
      updatedAt: new Date().toISOString(),
    };
    return persistLongRail(longRail, existing);
  }

  function saveLongRailParams(params: StressInput) {
    if (!selectedLongRail) return;
    const longRail: LongRail = {
      ...selectedLongRail,
      params,
      updatedAt: new Date().toISOString(),
    };
    commit({
      ...layout,
      longRails: layout.longRails.map((item) => (item.id === longRail.id ? longRail : item)),
    });
    void upsertLongRail(longRail).then((result) => {
      if (!result.ok) setError(result.error ?? "Không lưu thông số lên Supabase.");
      else if (result.skipped && result.error) setLongRailSyncNote(result.error);
      else setLongRailSyncNote(null);
    });
  }

  function step(direction: 1 | -1) {
    const index = cells.findIndex((item) => item.id === cell.id);
    setSelectedId(cells[(index + direction + cells.length) % cells.length].id);
  }

  if (!cell) return null;

  return (
    <div className="w-full max-w-none space-y-3">
      <TrackHeader
        subtitle={`Tuyến ${(extent.endMetres - extent.startMetres) / 1000} km · ${layout.rows.length} dải ray · ${cells.length} thanh ray · ${layout.longRails.length} thanh dài`}
        rangeLabel={`Km ${formatChainage(extent.startMetres)} – ${formatChainage(extent.endMetres)}`}
        stats={[
          { label: "Tổng chiều dài ray", value: `${totalLength / 1000} km`, tone: "text-slate-900" },
          { label: "Thanh dài", value: String(layout.longRails.length), tone: "text-teal-700" },
          { label: "Mối hàn (nhật ký)", value: String(weldCount), tone: "text-blue-700" },
          { label: "Đã gắn lý trình", value: `${weldsMapped}/${jointWithWelds} điểm`, tone: "text-emerald-700" },
        ]}
      />
      <p className="text-xs text-slate-500">
        Điểm giữa hai thanh ray là mối hàn — lấy từ Nhật ký hàn (Supabase). Thanh dài lưu Supabase bảng{" "}
        <code className="rounded bg-slate-100 px-1">lwr_long_rails</code>.
      </p>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {longRailSyncNote && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {longRailSyncNote}
        </p>
      )}
      {weldError && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {weldError}
        </p>
      )}
      <div
        className={
          sideOpen
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
            selectedLongRailId={selectedLongRailId}
            onReloadSymbols={() => {
              void reloadSymbols();
            }}
            onPlacement={savePlacement}
            onRemove={(id) => {
              commit({ ...layout, placements: layout.placements.filter((item) => item.id !== id) });
            }}
            onExtend={(count) => commit({ ...layout, rows: extendRailRows(layout.rows, count) })}
            onLongRail={saveLongRail}
            onRemoveLongRail={(id) => {
              commit({ ...layout, longRails: layout.longRails.filter((item) => item.id !== id) });
              if (selectedLongRailId === id) setSelectedLongRailId(null);
              void deleteLongRailRemote(id).then((result) => {
                if (!result.ok) setError(result.error ?? "Không xóa thanh dài trên Supabase.");
                else if (result.skipped && result.error) setLongRailSyncNote(result.error);
              });
            }}
            onSelectLongRail={(id) => {
              setSelectedLongRailId(id);
              setDetailOpen(false);
              setSelectedJoint(null);
              scrollDetailIntoView();
            }}
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
                setSelectedLongRailId(null);
                setDetailOpen(true);
                scrollDetailIntoView();
              }}
              onSelectJoint={(joint) => {
                setSelectedJoint(joint);
                setDetailOpen(false);
                setSelectedLongRailId(null);
                scrollDetailIntoView();
              }}
            />
          </TrackSchematic>
        </div>
        {sideOpen && (
          <div ref={detailContainer} className="min-w-0 space-y-3 xl:sticky xl:top-0">
            {selectedLongRail ? (
              <LongRailDetailPanel
                longRail={selectedLongRail}
                layout={layout}
                onClose={() => setSelectedLongRailId(null)}
                onSaveParams={saveLongRailParams}
              />
            ) : null}
            {selectedJoint ? (
              <WeldJointPanel joint={selectedJoint} onClose={() => setSelectedJoint(null)} />
            ) : null}
            {detailOpen ? (
              <RailDetailPanel
                cell={cell}
                onClose={() => setDetailOpen(false)}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
