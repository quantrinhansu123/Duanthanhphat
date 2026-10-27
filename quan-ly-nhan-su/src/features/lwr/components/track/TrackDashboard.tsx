"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CELL_ID } from "@lwr/lib/track-data";
import {
  createInitialTrackLayout,
  defaultLongRailParams,
  extendRailRows,
  placeShortRailSpanOnLine,
  removeShortRail,
  addInstalledRange,
  removeInstalledRange,
  generateRailRows,
  formatChainage,
  getPlacementSpan,
  countReleasedLwrSegments,
  isLongRailReleased,
  renumberLongRails,
  longRailsOverlap,
  nextLongRailCode,
  parseChainage,
  visibleLongRailSpan,
  patchTrackCell,
  railCellLockTemp,
  railRowKey,
  rowKeysForLine,
  syncLongRailCompletedAt,
  trackExtent,
  TRACK_LAYOUT_STORAGE_KEY,
  type LongRail,
  type RailCellPatch,
  type TrackLayout,
  type TrackPlacement,
} from "@lwr/lib/track-editor";
import type { StressInput } from "@lwr/lib/stress-release";
import {
  deleteLongRailRemote,
  loadLongRails,
  preferNewerLongRails,
  syncLocalLongRailsToSupabase,
  upsertLongRail,
} from "@lwr/lib/long-rail-storage";
import {
  chooseTrackLayout,
  deleteTrackLayout,
  loadTrackLayout,
  readStoredTrackLayout,
  serializeTrackLayout,
  trackLayoutHasEdits,
  upsertTrackLayout,
} from "@lwr/lib/track-layout-storage";
import { loadStructureSymbols } from "@lwr/lib/structure-storage";
import { loadJournalWelds } from "@lwr/lib/weld-journal";
import { buildMachineOnTrack, loadMachineImageMap } from "@lwr/lib/machine-images";
import { buildRailJoints } from "@lwr/lib/weld-track-map";
import type { StructureSymbol } from "@lwr/types/structure";
import type { RailRow } from "@lwr/types/track";
import type { JournalWeld, RailJoint } from "@lwr/types/weld";
import { TrackHeader } from "./TrackHeader";
import { TrackSchematic } from "./TrackSchematic";
import { RailGrid } from "./RailGrid";
import { RailDetailPanel } from "./RailDetailPanel";
import type { StressSaveResult } from "./StressReleaseCalculator";
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
  return <div className="min-w-0 space-y-3">
    <label className="block min-w-0 rounded border bg-white p-3 text-sm">Dự án
      <select className="mt-1 block w-full min-w-0 rounded border p-2" value={projectId} onChange={e => setProjectId(e.target.value)}>
        <option value="">Sơ đồ hiện có (chưa gán dự án)</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
    {projectError && <p role="status" className="text-xs text-amber-700">Không tải đủ thông tin dự án: {projectError}</p>}
    <ProjectTrackDashboard key={projectId} initialCellId={initialCellId} project={projects.find(p => p.id === projectId)} projects={projects} onAssigned={setProjectId} />
  </div>;
}

function ProjectTrackDashboard({ initialCellId = DEFAULT_CELL_ID, project, projects = [], onAssigned }: TrackDashboardProps & { project?: Project; projects?: Project[]; onAssigned?: (projectId: string) => void }) {
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
  const [layoutSyncNote, setLayoutSyncNote] = useState<string | null>(null);
  const [symbolError, setSymbolError] = useState<string | null>(null);
  const [weldError, setWeldError] = useState<string | null>(null);
  const [weldCount, setWeldCount] = useState(0);
  const [weldsMapped, setWeldsMapped] = useState(0);
  const [joints, setJoints] = useState<RailJoint[]>([]);
  const [journalWelds, setJournalWelds] = useState<JournalWeld[]>([]);
  const [machineImages, setMachineImages] = useState<Record<string, string>>({});
  const [printOpen, setPrintOpen] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [assignTo, setAssignTo] = useState("");
  /** Đã xác nhận tiếp tục khi chưa gán dự án (hỏi lại khi đổi dự án vì component remount theo key). */
  const projectAcknowledged = useRef(false);
  const savedAtRef = useRef<string | null>(null);
  const editVersion = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const lastLayoutSave = useRef<Promise<{ ok: boolean; error?: string; skipped?: boolean }>>(
    Promise.resolve({ ok: true }),
  );

  function rememberLocal(next: TrackLayout, savedAt: string | null = savedAtRef.current): boolean {
    try {
      localStorage.setItem(storageKey, serializeTrackLayout(next, savedAt));
      return true;
    } catch {
      return false;
    }
  }

  function enqueueLayoutSave(next: TrackLayout, savedAt: string) {
    const run = saveQueue.current.then(() => upsertTrackLayout(projectId, next, savedAt));
    lastLayoutSave.current = run;
    saveQueue.current = run.then(() => undefined, () => undefined);
    return run;
  }

  function noteLayoutSave(result: { ok: boolean; error?: string; skipped?: boolean }, savedAt: string) {
    if (savedAtRef.current !== savedAt) return;
    if (!result.ok) setError(result.error ?? "Không lưu sơ đồ lên Supabase.");
    else if (result.skipped && result.error) setLayoutSyncNote(result.error);
    else setLayoutSyncNote(null);
  }

  /** Chưa gán dự án → hỏi "Bạn đã chọn/gán dự án chưa?" trước khi mở hoặc lưu thanh ray dài. */
  const ensureProject = useCallback(() => {
    if (projectId || projectAcknowledged.current) return true;
    const proceed = window.confirm(
      "Bạn đã chọn/gán dự án chưa?" +
        " Sơ đồ đang CHƯA gán dự án — chọn dự án ở ô «Dự án» phía trên để dữ liệu thuộc đúng dự án." +
        " Bấm OK để vẫn tiếp tục (không gán dự án), Hủy để quay lại chọn dự án.",
    );
    if (proceed) projectAcknowledged.current = true;
    return proceed;
  }, [projectId]);
  const cells = layout.rows.flatMap((row) => row.cells);
  const cell = cells.find((item) => item.id === selectedId) ?? cells[0];
  const selectedLongRail = layout.longRails.find((item) => item.id === selectedLongRailId) ?? null;
  const extent = trackExtent(layout.rows);
  const totalLength = cells.reduce(
    (sum, item) => sum + (parseChainage(item.to) ?? 0) - (parseChainage(item.from) ?? 0),
    0,
  );
  /** Đếm khớp nút Đạt / chip Giải toả bên dưới (đoạn LWR + thanh Đạt chưa gắn LWR). */
  const releasedLongRailCount = countReleasedLwrSegments(layout.rows, layout.longRails);
  const sideOpen = detailOpen || Boolean(selectedJoint);

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
      const seenEdits = editVersion.current;
      let localLayout = createInitialTrackLayout();
      let storedSavedAt: string | null = null;
      let storedLayout: TrackLayout | null = null;
      try {
        const stored = readStoredTrackLayout(localStorage.getItem(storageKey));
        // Không tự rải cả Thượng+Hạ cùng một đoạn Km — hai tuyến độc lập, người dùng rải từng tuyến ở Bước 1.
        if (stored.invalid) throw new Error("Sơ đồ đã lưu không hợp lệ. Dữ liệu gốc vẫn được giữ; chưa thể chỉnh sửa.");
        if (stored.layout) {
          localLayout = stored.layout;
          storedLayout = stored.layout;
          storedSavedAt = stored.savedAt;
        }
        savedAtRef.current = storedSavedAt;
        if (!active) return;
        setLayout(localLayout);
        // Local edits must not wait for the remote sync to finish.
        setReady(true);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Không đọc được sơ đồ đã lưu.");
        setReady(false);
        return;
      }
      void reloadSymbols();
      try {
        const remoteLayout = await loadTrackLayout(projectId);
        if (!active) return;
        if (remoteLayout.error && remoteLayout.source === "local") {
          setLayoutSyncNote(remoteLayout.error);
        } else if (remoteLayout.source === "supabase" && editVersion.current === seenEdits) {
          const chosen = chooseTrackLayout({
            local: storedLayout,
            localSavedAt: storedSavedAt,
            remote: remoteLayout.layout,
            remoteUpdatedAt: remoteLayout.updatedAt,
          });
          if (chosen.from === "remote") {
            const savedAt = remoteLayout.updatedAt;
            savedAtRef.current = savedAt;
            localLayout = {
              ...chosen.layout,
              longRails: preferNewerLongRails(localLayout.longRails, chosen.layout.longRails),
            };
            setLayout(localLayout);
            rememberLocal(localLayout, savedAt);
          } else if (chosen.upload) {
            const savedAt = storedSavedAt ?? new Date().toISOString();
            savedAtRef.current = savedAt;
            rememberLocal(chosen.layout, savedAt);
            const uploaded = await enqueueLayoutSave(chosen.layout, savedAt);
            if (!active) return;
            if (savedAtRef.current === savedAt) {
              if (!uploaded.ok) setLayoutSyncNote(uploaded.error ?? "Không đưa sơ đồ lên Supabase.");
              else if (uploaded.skipped && uploaded.error) setLayoutSyncNote(uploaded.error);
              else setLayoutSyncNote("Đã đưa sơ đồ local lên Supabase.");
            }
          }
        }
      } catch (cause) {
        if (active) setLayoutSyncNote(cause instanceof Error ? cause.message : "Không đồng bộ sơ đồ Supabase.");
      }
      try {
        const synced = await syncLocalLongRailsToSupabase(localLayout.longRails, projectId);
        if (!active) return;
        if (synced.uploaded > 0) {
          setLongRailSyncNote(`Đã đưa ${synced.uploaded} đoạn LWR local lên Supabase.`);
        }
        const remote = await loadLongRails(localLayout.longRails, projectId);
        if (!active) return;
        if (remote.error && remote.source === "local") setLongRailSyncNote(remote.error);
        else if (remote.source === "supabase") {
          setLongRailSyncNote(null);
          setLayout((current) => {
            const next = { ...current, longRails: preferNewerLongRails(current.longRails, remote.rails) };
            rememberLocal(next);
            return next;
          });
        }
      } catch (cause) {
        if (!active) return;
        setLongRailSyncNote(cause instanceof Error ? cause.message : "Không đồng bộ đoạn LWR Supabase.");
      }
      if (active) setReady(true);
    })();
    const refresh = () => {
      void reloadSymbols();
      void reloadWelds();
      void loadTrackLayout(projectId).then((remoteLayout) => {
        if (!active || remoteLayout.source !== "supabase" || !remoteLayout.layout || !remoteLayout.updatedAt) return;
        const remoteTime = Date.parse(remoteLayout.updatedAt);
        const localTime = savedAtRef.current ? Date.parse(savedAtRef.current) : Number.NaN;
        if (Number.isFinite(localTime) && localTime >= remoteTime) return;
        const savedAt = remoteLayout.updatedAt;
        const schematic = remoteLayout.layout;
        savedAtRef.current = savedAt;
        setLayout((current) => {
          const next = {
            ...schematic,
            longRails: preferNewerLongRails(current.longRails, schematic.longRails),
          };
          rememberLocal(next, savedAt);
          return next;
        });
      });
      void loadLongRails([], projectId).then((remote) => {
        if (!active || remote.source !== "supabase") return;
        setLayout((current) => {
          const rails = preferNewerLongRails(current.longRails, remote.rails);
          const same =
            rails.length === current.longRails.length
            && rails.every((item, index) => item === current.longRails[index]);
          if (same) return current;
          const next = { ...current, longRails: rails };
          rememberLocal(next);
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
    let active = true;
    void loadMachineImageMap().then((map) => {
      if (active) setMachineImages(map);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedLongRailId && !layout.longRails.some((item) => item.id === selectedLongRailId)) {
      setSelectedLongRailId(null);
    }
  }, [layout.longRails, selectedLongRailId]);

  const machineMarkers = useMemo(
    () => buildMachineOnTrack(journalWelds, machineImages),
    [journalWelds, machineImages],
  );

  const jointWithWelds = useMemo(() => joints.filter((j) => j.welds.length > 0).length, [joints]);
  /** Số mối hàn nhật ký nằm trong các đoạn LWR đã giải toả. */
  const releasedWeldCount = useMemo(() => {
    const spans = layout.longRails
      .filter((rail) => isLongRailReleased(layout.rows, rail))
      .map((rail) => ({ rowKey: rail.rowKey, span: getPlacementSpan(layout.rows, rail) ?? visibleLongRailSpan(layout.rows, rail) }))
      .filter((item): item is { rowKey: string; span: NonNullable<typeof item.span> } => item.span !== null);
    return joints.reduce(
      (sum, joint) => (spans.some((item) => item.rowKey === joint.rowKey && joint.metres >= item.span.startMetres && joint.metres <= item.span.endMetres) ? sum + joint.welds.length : sum),
      0,
    );
  }, [joints, layout.longRails, layout.rows]);

  function commit(next: TrackLayout): boolean {
    if (!ready) {
      setError(error ?? "Sơ đồ chưa tải xong. Vui lòng thử lại sau giây lát.");
      return false;
    }
    const savedAt = new Date().toISOString();
    editVersion.current += 1;
    savedAtRef.current = savedAt;
    if (!rememberLocal(next, savedAt)) {
      setError("Không lưu được sơ đồ trên trình duyệt. Kiểm tra dung lượng hoặc quyền lưu dữ liệu trang web.");
      return false;
    }
    setLayout(next);
    setError(null);
    void enqueueLayoutSave(next, savedAt).then((result) => noteLayoutSave(result, savedAt));
    return true;
  }

  const sideWasOpen = useRef(false);
  useEffect(() => {
    const justOpened = sideOpen && !sideWasOpen.current;
    sideWasOpen.current = sideOpen;
    // Chỉ cuộn khi mới mở panel — chuyển thanh/ray không scroll lại (tránh giật lag).
    if (!justOpened) return;
    // Overlay cố định trên xl: không cần kéo trang.
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches) return;
    requestAnimationFrame(() => {
      detailContainer.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
    });
  }, [sideOpen]);

  function savePlacement(input: TrackPlacement | TrackPlacement[]) {
    const batch = Array.isArray(input) ? input : [input];
    if (!batch.length) return false;
    for (const placement of batch) {
      if (!getPlacementSpan(layout.rows, placement)) {
        setError("Thanh bắt đầu và kết thúc phải đúng thứ tự trên cùng một dải ray.");
        return false;
      }
    }
    let placements = [...layout.placements];
    for (const placement of batch) {
      const index = placements.findIndex((item) => item.id === placement.id);
      if (index >= 0) placements[index] = placement;
      else placements = [...placements, placement];
    }
    return commit({ ...layout, placements });
  }

  function persistLongRail(longRail: LongRail, existing: LongRail | undefined, nextRows?: RailRow[]) {
    if (!ensureProject()) return false;
    if (existing && (existing.rowKey !== longRail.rowKey || existing.startMetres !== longRail.startMetres || existing.endMetres !== longRail.endMetres)
      && (
        [existing.startMetres, existing.endMetres].some(m => (layout.jointWeldLinks?.[`${existing.rowKey}:km:${m}`]?.length ?? 0) > 0)
        || (layout.jointWeldLinks?.[`${existing.rowKey}:lwr:${existing.id}:start`]?.length ?? 0) > 0
        || (layout.jointWeldLinks?.[`${existing.rowKey}:lwr:${existing.id}:end`]?.length ?? 0) > 0
      )) {
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
    void upsertLongRail(longRail).then((result) => {
      if (!result.ok) setError(result.error ?? "Không lưu đoạn LWR lên Supabase.");
      else if (result.skipped && result.error) setLongRailSyncNote(result.error);
      else setLongRailSyncNote(null);
    });
    return true;
  }

  function saveLongRail(draft: LongRail, nextRows?: RailRow[]) {
    const rows = nextRows ?? layout.rows;
    const span = getPlacementSpan(rows, draft);
    if (!span) {
      setError("Lý trình đầu và lý trình cuối phải đúng thứ tự trên cùng một dải ray.");
      return false;
    }
    const overlaps = layout.longRails.some(
      (other) => other.id !== draft.id && longRailsOverlap(rows, draft, other),
    );
    if (overlaps) {
      setError("Đoạn LWR không được chồng lấn với đoạn LWR khác trên cùng dải ray.");
      return false;
    }
    const existing = layout.longRails.find((item) => item.id === draft.id);
    if (
      existing?.completedAt
      && draft.completedAt
      && (existing.startMetres !== draft.startMetres || existing.endMetres !== draft.endMetres || existing.rowKey !== draft.rowKey)
    ) {
      setError("Đoạn đã giải toả xong — lý trình bị khóa. Bỏ tick Hoàn thành nếu cần sửa.");
      return false;
    }
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
        airTemp: draft.params.airTemp,
        area: draft.params.area,
        modulus: draft.params.modulus,
        alpha: draft.params.alpha,
      },
      updatedAt: new Date().toISOString(),
    };
    return persistLongRail(longRail, existing, rows);
  }

  function saveLongRailParams(params: StressInput): StressSaveResult {
    if (!ready) return { ok: false, message: "Sơ đồ chưa tải xong. Đợi giây lát rồi bấm Lưu thông số lại." };
    if (!ensureProject()) return { ok: false, message: "Chưa gán dự án — chọn dự án ở ô «Dự án» rồi bấm Lưu thông số lại." };
    if (!selectedLongRail) return { ok: false, message: "Chưa chọn đoạn LWR. Bấm đoạn trên sơ đồ rồi Lưu thông số." };
    const start = parseChainage(params.startChainage ?? "");
    const end = parseChainage(params.endChainage ?? "");
    if (start === null || end === null) {
      return { ok: false, message: "Nhập lý trình đầu và lý trình cuối đúng dạng Km (ví dụ 0+000), cuối lớn hơn đầu." };
    }
    if (
      selectedLongRail.completedAt
      && (selectedLongRail.startMetres !== start || selectedLongRail.endMetres !== end)
    ) {
      return { ok: false, message: "Đoạn đã giải toả xong — lý trình bị khóa. Bỏ tick Hoàn thành ở form lý trình nếu cần sửa." };
    }
    const expectedSide = selectedLongRail.rowKey.endsWith("T") ? "LEFT" : "RIGHT";
    if (params.trackSide !== expectedSide) {
      return { ok: false, message: `Ray ${params.trackSide === "LEFT" ? "trái" : "phải"} không khớp dải của ${selectedLongRail.code}. Đổi dải ray ở phần sửa đoạn thi công.` };
    }
    if (
      (selectedLongRail.startMetres !== start || selectedLongRail.endMetres !== end)
      && (
        [selectedLongRail.startMetres, selectedLongRail.endMetres].some((metres) => (layout.jointWeldLinks?.[`${selectedLongRail.rowKey}:km:${metres}`]?.length ?? 0) > 0)
        || (layout.jointWeldLinks?.[`${selectedLongRail.rowKey}:lwr:${selectedLongRail.id}:start`]?.length ?? 0) > 0
        || (layout.jointWeldLinks?.[`${selectedLongRail.rowKey}:lwr:${selectedLongRail.id}:end`]?.length ?? 0) > 0
      )
    ) {
      return { ok: false, message: "Đầu đoạn đã liên kết nhật ký hàn. Tháo liên kết trước khi đổi lý trình." };
    }
    const longRail: LongRail = {
      ...selectedLongRail,
      startMetres: start,
      endMetres: end,
      params,
      updatedAt: new Date().toISOString(),
    };
    const span = getPlacementSpan(layout.rows, longRail);
    if (!span) return { ok: false, message: "Lý trình đầu/cuối phải nằm trong tuyến đã rải." };
    if (layout.longRails.some((other) => other.id !== longRail.id && longRailsOverlap(layout.rows, longRail, other))) {
      return { ok: false, message: "Không lưu được: đoạn này chồng lấn đoạn LWR khác trên cùng dải ray." };
    }
    const ok = persistLongRail({ ...longRail, startCellId: span.startCell.id, endCellId: span.endCell.id }, selectedLongRail);
    if (!ok) return { ok: false, message: "Không ghi được sơ đồ trên trình duyệt. Kiểm tra dung lượng hoặc quyền lưu dữ liệu trang web." };
    return { ok: true, message: `Đã lưu thông số đoạn LWR ${selectedLongRail.code}.` };
  }

  function saveCellCalculator(params: StressInput): StressSaveResult {
    if (!ready) return { ok: false, message: "Sơ đồ chưa tải xong. Đợi giây lát rồi bấm Lưu thông số lại." };
    if (!ensureProject()) return { ok: false, message: "Chưa gán dự án — chọn dự án ở ô «Dự án» rồi bấm Lưu thông số lại." };
    if (!cell) return { ok: false, message: "Chưa chọn thanh ngắn." };
    const row = layout.rows.find((item) => item.cells.some((itemCell) => itemCell.id === cell.id));
    if (!row) return { ok: false, message: `Không tìm thấy dải ray chứa ${cell.id}.` };
    const from = parseChainage(cell.from);
    const to = parseChainage(cell.to);
    if (from === null || to === null || to <= from) {
      return { ok: false, message: "Lý trình thanh ngắn không hợp lệ." };
    }
    const key = railRowKey(row);
    const covering = layout.longRails.filter((rail) => {
      if (rail.rowKey !== key) return false;
      const span = getPlacementSpan(layout.rows, rail);
      return Boolean(span && span.startMetres < to && span.endMetres > from);
    });
    const leftTemp = Number.isFinite(params.leftTemp) ? params.leftTemp : (cell.leftTemp ?? cell.temp);
    const rightTemp = Number.isFinite(params.rightTemp) ? params.rightTemp : (cell.rightTemp ?? cell.temp);
    const temp = Number.isFinite(params.neutralTemp)
      ? params.neutralTemp
      : railCellLockTemp({ temp: cell.temp, leftTemp, rightTemp });
    let target: LongRail;
    let created = false;
    if (covering.length === 0) {
      const draftSpan = {
        rowKey: key,
        startCellId: cell.id,
        endCellId: cell.id,
        startMetres: from,
        endMetres: to,
      };
      const code = nextLongRailCode(layout.longRails, key);
      target = {
        id: crypto.randomUUID(),
        code,
        label: code,
        ...draftSpan,
        releaseDate: new Date().toISOString().slice(0, 10),
        params: {
          ...defaultLongRailParams(layout.rows, draftSpan, params.railType),
          ...params,
          startChainage: params.startChainage || cell.from,
          endChainage: params.endChainage || cell.to,
          leftTemp,
          rightTemp,
          neutralTemp: temp,
        },
        updatedAt: new Date().toISOString(),
      };
      created = true;
    } else {
      target = (selectedLongRail && covering.some((rail) => rail.id === selectedLongRail.id))
        ? selectedLongRail
        : covering.slice().sort((a, b) => ((a.endMetres ?? 0) - (a.startMetres ?? 0)) - ((b.endMetres ?? 0) - (b.startMetres ?? 0)))[0];
      target = {
        ...target,
        params: {
          ...target.params,
          ...params,
          startChainage: target.params.startChainage || params.startChainage,
          endChainage: target.params.endChainage || params.endChainage,
          leftTemp,
          rightTemp,
          neutralTemp: temp,
        },
        updatedAt: new Date().toISOString(),
      };
    }
    let nextLayout: TrackLayout = {
      ...layout,
      longRails: created
        ? [...layout.longRails, target]
        : layout.longRails.map((item) => (item.id === target.id ? target : item)),
    };
    try {
      nextLayout = patchTrackCell(nextLayout, cell.id, { leftTemp, rightTemp });
    } catch (cause) {
      return { ok: false, message: cause instanceof Error ? cause.message : "Không cập nhật được nhiệt độ thanh." };
    }
    // Đạt trước → Lưu thông số: gắn completedAt để thẻ “Đoạn LWR đã giải toả” đếm đúng.
    nextLayout = syncLongRailCompletedAt(nextLayout);
    if (!commit(nextLayout)) {
      return { ok: false, message: "Không ghi được sơ đồ trên trình duyệt. Kiểm tra dung lượng hoặc quyền lưu dữ liệu trang web." };
    }
    const saved = nextLayout.longRails.find((item) => item.id === target.id) ?? target;
    setSelectedLongRailId(saved.id);
    void upsertLongRail(saved).then((result) => {
      if (!result.ok) setError(result.error ?? "Không lưu đoạn LWR lên Supabase.");
    });
    return {
      ok: true,
      message: created
        ? `Đã tạo đoạn LWR ${saved.code} và lưu thông số + nhiệt độ ${temp}°C lên sơ đồ.`
        : `Đã lưu thông số lên đoạn LWR ${saved.code} và cập nhật nhiệt độ sơ đồ ${temp}°C.`,
    };
  }

  function cellOnSelectedLongRail(item: typeof cell) {
    if (!selectedLongRail || !item) return false;
    const row = layout.rows.find((entry) => entry.cells.some((cellItem) => cellItem.id === item.id));
    if (!row || railRowKey(row) !== selectedLongRail.rowKey) return false;
    const from = parseChainage(item.from);
    const to = parseChainage(item.to);
    const span = getPlacementSpan(layout.rows, selectedLongRail) ?? visibleLongRailSpan(layout.rows, selectedLongRail);
    if (from === null || to === null || !span) return false;
    return from < span.endMetres && to > span.startMetres;
  }

  function markLongRailPass(passed: boolean) {
    if (!selectedLongRail) return;
    const span = getPlacementSpan(layout.rows, selectedLongRail) ?? visibleLongRailSpan(layout.rows, selectedLongRail);
    if (!span) {
      setError("Không xác định được phạm vi thanh LWR trên sơ đồ.");
      return;
    }
    try {
      setSelectedId(span.startCell.id);
      let next = layout;
      for (const item of span.row.cells) {
        const from = parseChainage(item.from);
        const to = parseChainage(item.to);
        if (from === null || to === null) continue;
        if (!(from < span.endMetres && to > span.startMetres)) continue;
        next = patchTrackCell(next, item.id, { released: passed });
      }
      const longRails = next.longRails.map((rail) => {
        if (rail.id !== selectedLongRail.id) return rail;
        return {
          ...rail,
          completedAt: passed ? rail.completedAt || new Date().toISOString() : undefined,
          updatedAt: new Date().toISOString(),
        };
      });
      if (!commit({ ...next, longRails })) return;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không cập nhật được trạng thái giải toả.");
    }
  }

  function saveCellPatch(patch: RailCellPatch) {
    if (!cell) return false;
    try {
      let next = patchTrackCell(layout, cell.id, patch);
      // Đồng bộ completedAt với nút Đạt bên dưới — thẻ “Đoạn LWR đã giải toả” đếm theo sơ đồ.
      if (patch.released !== undefined) {
        const before = new Map(next.longRails.map((rail) => [rail.id, rail.completedAt]));
        next = syncLongRailCompletedAt(next);
        const changed = next.longRails.filter((rail) => before.get(rail.id) !== rail.completedAt);
        if (changed.length > 0 && !ensureProject()) return false;
        if (!commit(next)) return false;
        for (const rail of changed) {
          void upsertLongRail(rail).then((result) => {
            if (!result.ok) setError(result.error ?? "Không đồng bộ trạng thái giải toả LWR lên Supabase.");
          });
        }
        return true;
      }
      return commit(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không cập nhật được đoạn ray.");
      return false;
    }
  }

  function step(direction: 1 | -1) {
    if (!cell || cells.length === 0) return;
    const index = cells.findIndex((item) => item.id === cell.id);
    const nextId = cells[(index + direction + cells.length) % cells.length].id;
    startTransition(() => setSelectedId(nextId));
  }

  const selectCell = useCallback((id: string) => {
    startTransition(() => {
      setSelectedId(id);
      setSelectedJoint(null);
      setDetailOpen(true);
    });
  }, []);

  const selectLongRail = useCallback((id: string | null) => {
    if (id && !ensureProject()) return;
    startTransition(() => {
      setSelectedLongRailId(id);
      setSelectedJoint(null);
    });
  }, [ensureProject]);

  /** Đánh số lại mọi đoạn LWR theo TT/TP/HT/HP, 1→n từng dải ray theo trình tự thi công. */
  async function renumberAll() {
    if (!ensureProject()) return;
    if (!layout.longRails.length) {
      setError("Chưa có đoạn LWR để đánh số.");
      return;
    }
    const next = renumberLongRails(layout.rows, layout.longRails);
    const changed = next.filter((rail, index) => rail.code !== layout.longRails[index].code);
    if (!changed.length) {
      setSavedNote("Mã các đoạn LWR đã đúng quy tắc TT/TP/HT/HP, không cần đánh số lại.");
      return;
    }
    if (!window.confirm(`Đánh số lại ${changed.length} đoạn LWR theo TT/TP/HT/HP (1→n từng dải ray, theo lý trình thi công)? Mã cũ sẽ bị thay.`)) return;
    if (!commit({ ...layout, longRails: next })) return;
    for (const rail of changed) {
      const result = await upsertLongRail({ ...rail, projectId: projectId ?? rail.projectId });
      if (!result.ok) {
        setError(result.error ?? "Không lưu đoạn LWR lên Supabase.");
        return;
      }
    }
    setError(null);
    setSavedNote(`Đã đánh số lại ${changed.length} đoạn LWR theo TT/TP/HT/HP.`);
  }

  /** Chuyển sơ đồ đang chưa gán dự án sang một dự án (đoạn LWR + bố cục). */
  async function assignToProject(targetId: string) {
    const target = projects.find((item) => item.id === targetId);
    if (!target || projectId) return;
    if (!window.confirm(`Gán toàn bộ sơ đồ hiện tại (${layout.longRails.length} đoạn LWR) vào dự án «${target.name}»? Sơ đồ chưa gán dự án sẽ được chuyển sang dự án này.`)) return;
    const key = `${TRACK_LAYOUT_STORAGE_KEY}:${targetId}`;
    try {
      const remote = await loadTrackLayout(targetId);
      const remoteHasEdits = Boolean(remote.layout && trackLayoutHasEdits(remote.layout));
      if ((localStorage.getItem(key) || remoteHasEdits) && !window.confirm("Dự án này đã có sơ đồ riêng. Ghi đè bằng sơ đồ hiện tại?")) return;
      await saveQueue.current;
      const moved = layout.longRails.map((rail) => ({ ...rail, projectId: targetId }));
      const next = { ...layout, longRails: moved };
      const savedAt = new Date().toISOString();
      const saved = await upsertTrackLayout(targetId, next, savedAt);
      if (!saved.ok) {
        setError(saved.error ?? "Không lưu sơ đồ lên Supabase.");
        return;
      }
      localStorage.setItem(key, serializeTrackLayout(next, savedAt));
      for (const rail of moved) {
        const result = await upsertLongRail(rail);
        if (!result.ok) {
          setError(result.error ?? "Không lưu đoạn LWR lên Supabase.");
          return;
        }
      }
      const removed = await deleteTrackLayout();
      if (!removed.ok) {
        setError(removed.error ?? "Không xoá được sơ đồ chưa gán dự án trên Supabase.");
        return;
      }
      localStorage.removeItem(TRACK_LAYOUT_STORAGE_KEY);
      if (saved.skipped && saved.error) setLayoutSyncNote(saved.error);
    } catch {
      setError("Không gán được dự án: kiểm tra dung lượng hoặc quyền lưu dữ liệu trang web.");
      return;
    }
    onAssigned?.(targetId);
  }

  async function saveAll() {
    if (!ensureProject()) return;
    if (!commit(layout)) return;
    setSavingAll(true);
    const layoutResult = await lastLayoutSave.current;
    if (!layoutResult.ok) {
      setSavingAll(false);
      setError(layoutResult.error ?? "Không lưu sơ đồ lên Supabase.");
      return;
    }
    let failed: string | null = null;
    for (const rail of layout.longRails) {
      const result = await upsertLongRail({ ...rail, projectId: projectId ?? rail.projectId });
      if (!result.ok) {
        failed = result.error ?? "Không lưu được đoạn LWR lên Supabase.";
        break;
      }
    }
    setSavingAll(false);
    if (failed) {
      setError(failed);
      return;
    }
    setError(null);
    const where = layoutResult.skipped ? "trên trình duyệt" : "lên Supabase";
    setSavedNote(`Đã lưu sơ đồ ${where} lúc ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · ${layout.longRails.length} đoạn LWR · ${project ? `dự án «${project.name}»` : "chưa gán dự án"}`);
  }

  const selectJoint = useCallback((joint: RailJoint) => {
    startTransition(() => {
      setSelectedJoint(joint);
      setDetailOpen(false);
      setSelectedLongRailId(null);
    });
  }, []);

  return (
    <div className="w-full min-w-0 max-w-none space-y-3">
      <TrackHeader
        subtitle={`Tuyến ${(extent.endMetres - extent.startMetres) / 1000} km · ${layout.rows.length} dải ray · ${cells.length} thanh ray · ${releasedLongRailCount} đoạn LWR đã giải toả`}
        rangeLabel={`Km ${formatChainage(extent.startMetres)} – ${formatChainage(extent.endMetres)}`}
        stats={[
          { label: "Tổng chiều dài ray", value: `${totalLength / 1000} km`, tone: "text-slate-900" },
          {
            label: "Đoạn LWR đã giải toả",
            value: String(releasedLongRailCount),
            tone: "text-teal-700",
          },
          { label: "Mối hàn (nhật ký)", value: String(weldCount), tone: "text-blue-700" },
          { label: "Số mối hàn giải toả", value: `${releasedWeldCount} mối`, tone: "text-emerald-700" },
        ]}
      />
      <div
        role="status"
        className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm ${project ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}
      >
        <span>
          {project ? <>Đang gán dự án: <b>{project.name}</b></> : <><b>Chưa gán dự án.</b> Chọn dự án ở ô «Dự án» phía trên trước khi mở hoặc lưu thanh ray dài.</>}
          {savedNote && <span className="ml-2 text-xs opacity-80">{savedNote}</span>}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {!project && projects.length > 0 && (
            <>
              <select aria-label="Chọn dự án để gán" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="max-w-[260px] rounded border bg-white px-2 py-2 text-sm text-slate-900">
                <option value="">Chọn dự án để gán…</option>
                {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <button type="button" onClick={() => void assignToProject(assignTo)} disabled={!assignTo || !ready} className="rounded border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50">Gán dự án</button>
            </>
          )}
          <button type="button" onClick={() => void renumberAll()} disabled={!ready} className="rounded border bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-50" title="Đánh số lại TT/TP/HT/HP, 1→n từng dải ray theo trình tự thi công">Đánh số lại TT/TP/HT/HP</button>
          <button type="button" onClick={() => void saveAll()} disabled={savingAll || !ready} className="rounded bg-[#0047AB] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {savingAll ? "Đang lưu…" : "Lưu sơ đồ"}
          </button>
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Bấm mối hàn để chọn nhật ký tương ứng. Mã và công nghệ hàn được điền từ nhật ký.</p>
        <button type="button" onClick={() => setPrintOpen(true)} className="rounded border bg-white px-3 py-2 text-sm">In sơ đồ A4 / A3 / A3 kéo dài</button>
      </div>
      {printOpen && <TrackPrint projectName={project?.name} layout={layout} joints={joints} symbols={symbols} onClose={() => setPrintOpen(false)} />}
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
      {layoutSyncNote && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {layoutSyncNote}
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
          onSelectJoint={selectJoint}
          layout={layout}
          symbols={symbols}
          ready={ready}
          symbolError={symbolError}
          selectedCellId={cell?.id ?? null}
          onReloadSymbols={() => {
            void reloadSymbols();
          }}
          onPlacement={savePlacement}
          onRemove={(id) => {
            commit({ ...layout, placements: layout.placements.filter((item) => item.id !== id) });
          }}
          onExtend={(count, line) => commit({ ...layout, rows: extendRailRows(layout.rows, count, line) })}
          onPlan={(line, from, to) => {
            const start = parseChainage(from);
            const end = parseChainage(to);
            if (start === null || end === null) { setError("Nhập lý trình tuyến dạng Km0+000."); return false; }
            try {
              const rows = generateRailRows(layout.rows, start, end, line);
              const keys = rowKeysForLine(layout.rows, line);
              const onLine = <T extends { rowKey: string; startMetres?: number }>(items: T[]) =>
                items.filter((item) => keys.has(item.rowKey));
              const linePlacements = onLine(layout.placements);
              const lineLongRails = onLine(layout.longRails);
              const legacy = [...linePlacements, ...lineLongRails].some((item) => item.startMetres === undefined);
              const lineRowsBefore = layout.rows.filter((row) => row.line === line);
              const lineRowsAfter = rows.filter((row) => row.line === line);
              if (legacy && JSON.stringify(lineRowsAfter) !== JSON.stringify(lineRowsBefore)) {
                setError(`Hãy lưu lại lý trình thực của công trình/đoạn LWR trên ${line} trước khi thay đổi sơ đồ rải.`);
                return false;
              }
              if ([...linePlacements, ...lineLongRails].some((item) => !getPlacementSpan(rows, item))) {
                setError(`Phạm vi mới của ${line} không bao phủ công trình hoặc đoạn thi công đã lưu trên tuyến này.`);
                return false;
              }
              const lineChanged = JSON.stringify(lineRowsAfter) !== JSON.stringify(lineRowsBefore);
              const lineHasWeldLinks = Object.entries(layout.jointWeldLinks ?? {}).some(([jointId, ids]) => {
                if (!ids.length) return false;
                const jointRowKey = jointId.split(":")[0];
                return keys.has(jointRowKey);
              });
              if (lineChanged && lineHasWeldLinks) {
                setError(`Sơ đồ ${line} đã liên kết nhật ký hàn; tháo liên kết trên tuyến này trước khi rải lại.`);
                return false;
              }
              return commit({ ...layout, rows });
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Không rải được tuyến.");
              return false;
            }
          }}
          onInstall={(lines, from, to) => {
            const start = parseChainage(from);
            const end = parseChainage(to);
            if (start === null || end === null || end <= start) {
              setError("Nhập lý trình đã lắp dạng 0+000, cuối lớn hơn đầu.");
              return false;
            }
            return commit({ ...layout, installed: addInstalledRange(layout.installed, lines, start, end) });
          }}
          onRemoveInstalled={(line, index) => {
            commit({ ...layout, installed: removeInstalledRange(layout.installed, line, index) });
          }}
          onClearPlan={(line) => {
            const keys = rowKeysForLine(layout.rows, line);
            const linePlacements = layout.placements.filter((item) => keys.has(item.rowKey));
            const lineLongRails = layout.longRails.filter((item) => keys.has(item.rowKey));
            const lineWeldLinkCount = Object.entries(layout.jointWeldLinks ?? {}).filter(([jointId, ids]) => {
              if (!ids.length) return false;
              return keys.has(jointId.split(":")[0]);
            }).length;

            if (linePlacements.length || lineLongRails.length || lineWeldLinkCount) {
              const parts = [
                linePlacements.length ? `${linePlacements.length} công trình` : "",
                lineLongRails.length ? `${lineLongRails.length} đoạn LWR` : "",
                lineWeldLinkCount ? `${lineWeldLinkCount} liên kết hàn` : "",
              ].filter(Boolean);
              const ok = window.confirm(
                `Xoá rải ray ${line} sẽ xoá luôn ${parts.join(", ")} trên tuyến này.\nTuyến còn lại không đổi. Tiếp tục?`,
              );
              if (!ok) return false;
            }

            const removedLongRailIds = lineLongRails.map((item) => item.id);
            const next: TrackLayout = {
              ...layout,
              rows: layout.rows.map((row) => (row.line === line ? { ...row, cells: [] } : row)),
              installed: layout.installed ? { ...layout.installed, [line]: [] } : undefined,
              placements: layout.placements.filter((item) => !keys.has(item.rowKey)),
              longRails: layout.longRails.filter((item) => !keys.has(item.rowKey)),
              jointWeldLinks: Object.fromEntries(
                Object.entries(layout.jointWeldLinks ?? {}).filter(([jointId]) => !keys.has(jointId.split(":")[0])),
              ),
            };
            if (!commit(next)) return false;

            if (selectedLongRailId && removedLongRailIds.includes(selectedLongRailId)) {
              setSelectedLongRailId(null);
            }
            for (const id of removedLongRailIds) {
              void deleteLongRailRemote(id).then((result) => {
                if (!result.ok) setError(result.error ?? "Không xoá được đoạn LWR trên Supabase.");
              });
            }
            return true;
          }}
        >
          {(structures) => <RailGrid
            structures={structures}
            installed={layout.installed}
            appendError={error}
            rows={layout.rows}
            longRails={layout.longRails}
            selectedLongRailId={selectedLongRailId}
            onSelectLongRail={selectLongRail}
            embedded
            joints={joints}
            machineMarkers={machineMarkers}
            selectedJointId={selectedJoint?.id ?? null}
            selectedId={cell?.id ?? ""}
            onSelect={selectCell}
            onSelectJoint={selectJoint}
            onAppend={(rowKey, from, to, temps) => {
              const start = parseChainage(from);
              const end = parseChainage(to);
              if (start === null || end === null || end <= start) {
                setError("Nhập lý trình đầu/cuối dạng 0+000, cuối lớn hơn đầu.");
                return false;
              }
              if (
                temps
                && (!Number.isFinite(temps.leftTemp) || !Number.isFinite(temps.rightTemp))
              ) {
                setError("Nhập nhiệt độ ray trái/phải là số hữu hạn.");
                return false;
              }
              const anchor = layout.rows.find((item) => railRowKey(item) === rowKey);
              if (!anchor) {
                setError("Không tìm thấy dải ray trên sơ đồ.");
                return false;
              }
              try {
                // Lắp theo tuyến (Thượng/Hạ): cùng lúc cả 2 ray trái+phải.
                const placed = placeShortRailSpanOnLine(layout.rows, anchor.line, start, end, temps);
                if (!commit({ ...layout, rows: placed.rows })) return false;
                setSelectedId(placed.cellIds[0] ?? "");
                setSelectedLongRailId(null);
                setSelectedJoint(null);
                setDetailOpen(Boolean(placed.cellIds[0]));
                return true;
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Không thêm được đoạn ray trên tuyến.");
                return false;
              }
            }}
            onRemove={(cellId) => {
              try {
                const nextRows = removeShortRail(layout.rows, cellId);
                if (!commit({ ...layout, rows: nextRows })) return;
                if (selectedId !== cellId) return;
                const row = nextRows.find((item) => item.cells.some((itemCell) => itemCell.id === cellId));
                const previous = row ? [...row.cells].reverse().find((itemCell) => itemCell.released || itemCell.placed) : undefined;
                if (previous) setSelectedId(previous.id);
                else setDetailOpen(false);
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Không xóa được thanh ngắn.");
              }
            }}
          />}
        </TrackSchematic>
        {sideOpen && (
          <div
            ref={detailContainer}
            className="mt-3 min-w-0 space-y-3 xl:fixed xl:right-4 xl:top-24 xl:z-40 xl:mt-0 xl:w-[min(560px,calc(100vw-2rem))] xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:overscroll-contain xl:rounded-xl xl:border xl:border-slate-200 xl:bg-white xl:shadow-xl"
          >
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
                trackSide={layout.rows.find(row => row.cells.some(item => item.id === cell.id))?.rail === "Ray phải" ? "RIGHT" : "LEFT"}
                onClose={() => setDetailOpen(false)}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
                onChange={saveCellPatch}
                onSaveParams={saveCellCalculator}
                onRemove={() => {
                  try {
                    const nextRows = removeShortRail(layout.rows, cell.id);
                    if (!commit({ ...layout, rows: nextRows })) return false;
                    const row = nextRows.find((item) => item.cells.some((itemCell) => itemCell.id === cell.id));
                    const previous = row ? [...row.cells].reverse().find((itemCell) => itemCell.released || itemCell.placed) : undefined;
                    if (previous) setSelectedId(previous.id);
                    else setDetailOpen(false);
                    return true;
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : "Không xóa được thanh ngắn.");
                    return false;
                  }
                }}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
