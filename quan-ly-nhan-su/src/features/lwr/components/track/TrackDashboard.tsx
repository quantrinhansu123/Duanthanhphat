"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CELL_ID } from "@lwr/lib/track-data";
import {
  createInitialTrackLayout,
  extendRailRows,
  generateRailRows,
  formatChainage,
  getPlacementSpan,
  longRailsOverlap,
  parseChainage,
  patchTrackCell,
  trackExtent,
  TRACK_LAYOUT_STORAGE_KEY,
  validateTrackLayout,
  type LongRail,
  type RailCellPatch,
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
import type { RailRow } from "@lwr/types/track";
import type { JournalWeld, RailJoint } from "@lwr/types/weld";
import { TrackHeader } from "./TrackHeader";
import { TrackSchematic } from "./TrackSchematic";
import { RailGrid } from "./RailGrid";
import { RailDetailPanel } from "./RailDetailPanel";
import { LongRailDetailPanel } from "./LongRailDetailPanel";
import { WeldJointPanel } from "./WeldJointPanel";
import { TrackPrint } from "./TrackPrint";
import { loadProjects } from "@/lib/projectsDb";
import type { Project } from "@/data/projects";

interface TrackDashboardProps {
  initialCellId?: string;
}

/** Client boundary for the dashboard: owns the selected-cell state and
 *  composes server-capable presentational components. */
export function TrackDashboard({ initialCellId = DEFAULT_CELL_ID }: TrackDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectError, setProjectError] = useState("");
  useEffect(() => {
    let active = true;
    void loadProjects({ includeProgress: false }).then(result => { if (active) { setProjects(result.projects); setProjectError(result.error ?? ""); } }).catch(cause => { if (active) setProjectError(String(cause)); });
    return () => { active = false; };
  }, []);
  return <div className="space-y-3">
    <label className="block rounded border bg-white p-3 text-sm">Dự án
      <select className="ml-3 rounded border p-2" value={projectId} onChange={e => setProjectId(e.target.value)}>
        <option value="">Sơ đồ hiện có (chưa gán dự án)</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
    {projectError && <p role="status" className="text-xs text-amber-700">Không tải đủ thông tin dự án: {projectError}</p>}
    <ProjectTrackDashboard key={projectId} initialCellId={initialCellId} project={projects.find(p => p.id === projectId)} />
  </div>;
}

function ProjectTrackDashboard({ initialCellId = DEFAULT_CELL_ID, project }: TrackDashboardProps & { project?: Project }) {
  const projectId = project?.id;
  const storageKey = projectId ? `${TRACK_LAYOUT_STORAGE_KEY}:${projectId}` : TRACK_LAYOUT_STORAGE_KEY;
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
  const [journalWelds, setJournalWelds] = useState<JournalWeld[]>([]);
  const [printOpen, setPrintOpen] = useState(false);
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

  const layoutRowsRef = useRef(layout.rows);
  const linksRef = useRef(layout.jointWeldLinks);
  const longRailsRef = useRef(layout.longRails);
  const weldRequest = useRef(0);
  useEffect(() => {
    layoutRowsRef.current = layout.rows;
    linksRef.current = layout.jointWeldLinks;
    longRailsRef.current = layout.longRails;
  }, [layout.rows, layout.jointWeldLinks, layout.longRails]);

  const reloadWelds = useCallback(async (rows?: RailRow[]) => {
    const request = ++weldRequest.current;
    const targetRows = rows ?? layoutRowsRef.current;
    try {
      const result = await loadJournalWelds();
      if (request !== weldRequest.current) return;
      if (result.error) setWeldError(result.error);
      else setWeldError(null);
      const welds = project ? result.welds.filter(weld => weld.project === project.name) : result.welds;
      setJournalWelds(welds);
      const mapped = buildRailJoints(targetRows, welds, 0, linksRef.current, longRailsRef.current);
      setJoints(mapped.joints);
      setWeldCount(welds.length);
      setWeldsMapped(welds.length - mapped.unmatched.length);
    } catch (cause) {
      if (request !== weldRequest.current) return;
      setWeldError(cause instanceof Error ? cause.message : "Không tải được nhật ký hàn.");
      setJoints(buildRailJoints(targetRows, []).joints);
      setWeldCount(0);
      setWeldsMapped(0);
    }
  }, [project]);

  useEffect(() => {
    let active = true;
    void (async () => {
      let localLayout = createInitialTrackLayout();
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored && project) {
          const marks = project.location.match(/(?:Km\s*)?\d+\+\d{1,3}/gi) ?? [];
          const start = parseChainage(marks[0] ?? ""), end = parseChainage(marks[1] ?? "");
          if (start !== null && end !== null && end > start) localLayout = { ...localLayout, rows: generateRailRows(localLayout.rows, start, end) };
        }
        if (stored) {
          const restored = validateTrackLayout(JSON.parse(stored));
          if (!restored) throw new Error("Sơ đồ đã lưu không hợp lệ. Dữ liệu gốc vẫn được giữ; chưa thể chỉnh sửa.");
          localLayout = restored;
        }
        if (!active) return;
        setLayout(localLayout);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Không đọc được sơ đồ đã lưu.");
        setReady(false);
        return;
      }
      void reloadSymbols();
      try {
        const synced = await syncLocalLongRailsToSupabase(localLayout.longRails, projectId);
        if (!active) return;
        if (synced.uploaded > 0) {
          setLongRailSyncNote(`Đã đưa ${synced.uploaded} thanh dài local lên Supabase.`);
        }
        const remote = await loadLongRails(localLayout.longRails, projectId);
        if (!active) return;
        if (remote.error && remote.source === "local") setLongRailSyncNote(remote.error);
        else if (remote.source === "supabase") {
          setLongRailSyncNote(null);
          const next = { ...localLayout, longRails: remote.rails };
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            /* keep in-memory */
          }
          setLayout(next);
        }
      } catch (cause) {
        if (!active) return;
        setLongRailSyncNote(cause instanceof Error ? cause.message : "Không đồng bộ thanh dài Supabase.");
      }
      if (active) setReady(true);
    })();
    const refresh = () => {
      void reloadSymbols();
      void reloadWelds();
      void loadLongRails([], projectId).then((remote) => {
        if (!active || remote.source !== "supabase") return;
        setLayout((current) => {
          const same =
            current.longRails.length === remote.rails.length
            && current.longRails.every((item, index) => {
              const other = remote.rails[index];
              return other && item.id === other.id && item.updatedAt === other.updatedAt;
            });
          if (same) return current;
          const next = { ...current, longRails: remote.rails };
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
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
  }, [reloadSymbols, reloadWelds, storageKey, projectId, project]);

  useEffect(() => {
    void reloadWelds(layout.rows);
  }, [layout.rows, layout.jointWeldLinks, layout.longRails, reloadWelds]);

  useEffect(() => {
    if (selectedLongRailId && !layout.longRails.some((item) => item.id === selectedLongRailId)) {
      setSelectedLongRailId(null);
    }
  }, [layout.longRails, selectedLongRailId]);

  const jointWithWelds = useMemo(() => joints.filter((j) => j.welds.length > 0).length, [joints]);

  function commit(next: TrackLayout): boolean {
    if (!ready) return false;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setLayout(next);
      setError(null);
      return true;
    } catch {
      setError("Không lưu được sơ đồ trên trình duyệt. Kiểm tra dung lượng hoặc quyền lưu dữ liệu trang web.");
      return false;
    }
  }

  function scrollDetailIntoView() {
    // Panel mounts after setState — đợi 2 frame rồi kéo vào khung nhìn.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        detailContainer.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });
  }

  useEffect(() => {
    if (!sideOpen) return;
    scrollDetailIntoView();
  }, [sideOpen, selectedId, selectedJoint?.id, selectedLongRailId]);

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

  function persistLongRail(longRail: LongRail, existing: LongRail | undefined, nextRows?: RailRow[]) {
    if (existing && (existing.rowKey !== longRail.rowKey || existing.startMetres !== longRail.startMetres || existing.endMetres !== longRail.endMetres)
      && [existing.startMetres, existing.endMetres].some(m => (layout.jointWeldLinks?.[`${existing.rowKey}:km:${m}`]?.length ?? 0) > 0)) {
      setError("Đầu đoạn đã liên kết nhật ký hàn. Tháo liên kết trước khi đổi lý trình hoặc dải ray.");
      return false;
    }
    const ok = commit({
      ...layout,
      rows: nextRows ?? layout.rows,
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

  function saveLongRail(draft: LongRail, nextRows?: RailRow[]) {
    const rows = nextRows ?? layout.rows;
    const span = getPlacementSpan(rows, draft);
    if (!span) {
      setError("Thanh dài: lý trình đầu và lý trình cuối phải đúng thứ tự trên cùng một dải ray.");
      return false;
    }
    const overlaps = layout.longRails.some(
      (other) => other.id !== draft.id && longRailsOverlap(rows, draft, other),
    );
    if (overlaps) {
      setError("Thanh dài không được chồng lấn với thanh dài khác trên cùng dải ray.");
      return false;
    }
    const existing = layout.longRails.find((item) => item.id === draft.id);
    const previousJoint = parseChainage(draft.params.jointChainage ?? "");
    const joint = previousJoint !== null && previousJoint >= span.startMetres && previousJoint <= span.endMetres ? previousJoint : span.endMetres;
    const longRail: LongRail = {
      ...draft,
      projectId,
      id: draft.id,
      code: draft.code,
      label: draft.label,
      rowKey: draft.rowKey,
      startCellId: draft.startCellId,
      endCellId: draft.endCellId,
      params: {
        ...(existing?.params ?? draft.params),
        leftLength: joint - span.startMetres,
        rightLength: span.endMetres - joint,
        trackSide: draft.rowKey.endsWith("T") ? "LEFT" : "RIGHT",
        startChainage: formatChainage(span.startMetres),
        endChainage: formatChainage(span.endMetres),
        jointChainage: formatChainage(joint),
        railType: draft.params.railType,
        area: draft.params.area,
        modulus: draft.params.modulus,
        alpha: draft.params.alpha,
      },
      updatedAt: new Date().toISOString(),
    };
    return persistLongRail(longRail, existing, rows);
  }

  function saveLongRailParams(params: StressInput) {
    if (!selectedLongRail) return false;
    const start = parseChainage(params.startChainage ?? ""), end = parseChainage(params.endChainage ?? "");
    if (start === null || end === null) { setError("Nhập lý trình đầu/cuối của đoạn trước khi lưu."); return false; }
    const expectedSide = selectedLongRail.rowKey.endsWith("T") ? "LEFT" : "RIGHT";
    if (params.trackSide !== expectedSide) { setError("Ray trái/phải phải khớp dải ray của đoạn thi công. Đổi dải ray tại phần sửa đoạn thi công."); return false; }
    const longRail: LongRail = {
      ...selectedLongRail,
      startMetres: start,
      endMetres: end,
      params,
      updatedAt: new Date().toISOString(),
    };
    const span = getPlacementSpan(layout.rows, longRail);
    if (!span || layout.longRails.some(other => other.id !== longRail.id && longRailsOverlap(layout.rows, longRail, other))) { setError("Đoạn phải nằm trong tuyến và không chồng lấn đoạn đã lưu."); return false; }
    return persistLongRail({ ...longRail, startCellId: span.startCell.id, endCellId: span.endCell.id }, selectedLongRail);
  }

  function saveCellPatch(patch: RailCellPatch) {
    if (!cell) return false;
    try {
      return commit(patchTrackCell(layout, cell.id, patch));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không cập nhật được đoạn ray.");
      return false;
    }
  }

  function step(direction: 1 | -1) {
    if (!cell || cells.length === 0) return;
    const index = cells.findIndex((item) => item.id === cell.id);
    setSelectedId(cells[(index + direction + cells.length) % cells.length].id);
  }

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Bấm mối hàn để chọn nhật ký tương ứng. Mã và công nghệ hàn được điền từ nhật ký.</p>
        <button type="button" onClick={() => setPrintOpen(true)} className="rounded border bg-white px-3 py-2 text-sm">In sơ đồ A4 / A3 / A3 kéo dài</button>
      </div>
      {printOpen && <TrackPrint projectName={project?.name} layout={layout} joints={joints} onClose={() => setPrintOpen(false)} />}
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
      {/* Overlay panel on xl so opening detail does not shrink the track (avoids layout jitter). */}
      <div className="relative min-w-0" data-testid="track-main">
        <TrackSchematic
          joints={joints}
          onSelectJoint={joint => { setSelectedJoint(joint); setDetailOpen(false); setSelectedLongRailId(null); }}
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
          onPlan={(from, to) => {
            const start = parseChainage(from), end = parseChainage(to);
            if (start === null || end === null) { setError("Nhập lý trình tuyến dạng Km0+000."); return false; }
            try {
              const rows = generateRailRows(layout.rows, start, end);
              const legacy = [...layout.placements, ...layout.longRails].some(item => item.startMetres === undefined);
              if (legacy && JSON.stringify(rows) !== JSON.stringify(layout.rows)) { setError("Hãy lưu lại lý trình thực của công trình/đoạn LWR cũ trước khi thay đổi sơ đồ rải."); return false; }
              if ([...layout.placements, ...layout.longRails].some(item => !getPlacementSpan(rows, item))) { setError("Phạm vi mới không bao phủ công trình hoặc đoạn thi công đã lưu."); return false; }
              if (Object.values(layout.jointWeldLinks ?? {}).some(ids => ids.length) && JSON.stringify(rows) !== JSON.stringify(layout.rows)) { setError("Sơ đồ đã liên kết nhật ký hàn; cần tháo liên kết trước khi rải lại để tránh gắn sai mối hàn."); return false; }
              return commit({ ...layout, rows });
            } catch (cause) { setError(cause instanceof Error ? cause.message : "Không rải được tuyến."); return false; }
          }}
          onClearPlan={() => {
            if (layout.placements.length || layout.longRails.length || Object.values(layout.jointWeldLinks ?? {}).some(ids => ids.length)) { setError("Sơ đồ còn công trình, đoạn thi công hoặc liên kết mối hàn. Xoá các mục liên quan trước để tránh mất dữ liệu."); return false; }
            return commit({ ...layout, rows: layout.rows.map(row => ({ ...row, cells: [] })), jointWeldLinks: {} });
          }}
          onLongRail={saveLongRail}
          onRemoveLongRail={(id) => {
            const rail = layout.longRails.find(item => item.id === id);
            if (rail && [rail.startMetres, rail.endMetres].some(m => (layout.jointWeldLinks?.[`${rail.rowKey}:km:${m}`]?.length ?? 0) > 0)) { setError("Tháo liên kết nhật ký ở đầu đoạn trước khi xoá đoạn thi công."); return; }
            if (!commit({ ...layout, longRails: layout.longRails.filter((item) => item.id !== id) })) return;
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
          }}
        >
          <RailGrid
            rows={layout.rows}
            longRails={layout.longRails}
            onSelectLongRail={id => { setSelectedLongRailId(id); setDetailOpen(false); setSelectedJoint(null); }}
            embedded
            joints={joints}
            selectedJointId={selectedJoint?.id ?? null}
            selectedId={cell?.id ?? ""}
            onSelect={(id) => {
              setSelectedId(id);
              setSelectedJoint(null);
              setSelectedLongRailId(null);
              setDetailOpen(true);
            }}
            onSelectJoint={(joint) => {
              setSelectedJoint(joint);
              setDetailOpen(false);
              setSelectedLongRailId(null);
            }}
          />
        </TrackSchematic>
        {sideOpen && (
          <div
            ref={detailContainer}
            className="mt-3 min-w-0 space-y-3 xl:fixed xl:right-4 xl:top-24 xl:z-40 xl:mt-0 xl:w-[min(560px,calc(100vw-2rem))] xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:overscroll-contain xl:rounded-xl xl:border xl:border-slate-200 xl:bg-white xl:shadow-xl"
          >
            {selectedLongRail ? (
              <LongRailDetailPanel
                longRail={selectedLongRail}
                layout={layout}
                onClose={() => setSelectedLongRailId(null)}
                onSaveParams={saveLongRailParams}
              />
            ) : null}
            {selectedJoint ? (
              <WeldJointPanel
                key={selectedJoint.id}
                joint={joints.find(item => item.id === selectedJoint.id) ?? selectedJoint}
                journalWelds={journalWelds}
                onLink={(weldId) => {
                  const links = { ...layout.jointWeldLinks };
                  if (weldId && Object.entries(links).some(([id, ids]) => id !== selectedJoint.id && ids.includes(weldId))) { setError("Nhật ký này đã gắn với mối hàn khác. Tháo liên kết cũ trước khi chuyển."); return; }
                  links[selectedJoint.id] = weldId ? [weldId] : [];
                  commit({ ...layout, jointWeldLinks: links });
                }}
                onClose={() => setSelectedJoint(null)}
              />
            ) : null}
            {detailOpen && cell ? (
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
