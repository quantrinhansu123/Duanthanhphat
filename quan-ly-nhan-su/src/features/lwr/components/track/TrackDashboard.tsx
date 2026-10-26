"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CELL_ID } from "@lwr/lib/track-data";
import {
  createInitialTrackLayout,
  defaultLongRailParams,
  extendRailRows,
  placeShortRailSpan,
  removeShortRail,
  generateRailRows,
  formatChainage,
  getPlacementSpan,
  longRailsOverlap,
  nextLongRailCode,
  parseChainage,
  visibleLongRailSpan,
  patchTrackCell,
  railCellLockTemp,
  railRowKey,
  rowKeysForLine,
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
  loadLongRails,
  preferNewerLongRails,
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
            try {
              localStorage.setItem(storageKey, JSON.stringify(next));
            } catch {
              /* keep in-memory */
            }
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
      void loadLongRails([], projectId).then((remote) => {
        if (!active || remote.source !== "supabase") return;
        setLayout((current) => {
          const rails = preferNewerLongRails(current.longRails, remote.rails);
          const same =
            rails.length === current.longRails.length
            && rails.every((item, index) => item === current.longRails[index]);
          if (same) return current;
          const next = { ...current, longRails: rails };
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
    if (!ready) {
      setError(error ?? "Sơ đồ chưa tải xong. Vui lòng thử lại sau giây lát.");
      return false;
    }
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
      && [selectedLongRail.startMetres, selectedLongRail.endMetres].some((metres) => (layout.jointWeldLinks?.[`${selectedLongRail.rowKey}:km:${metres}`]?.length ?? 0) > 0)
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
      const code = nextLongRailCode(layout.longRails);
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
    if (!commit(nextLayout)) {
      return { ok: false, message: "Không ghi được sơ đồ trên trình duyệt. Kiểm tra dung lượng hoặc quyền lưu dữ liệu trang web." };
    }
    setSelectedLongRailId(target.id);
    void upsertLongRail(target).then((result) => {
      if (!result.ok) setError(result.error ?? "Không lưu đoạn LWR lên Supabase.");
    });
    return {
      ok: true,
      message: created
        ? `Đã tạo đoạn LWR ${target.code} và lưu thông số + nhiệt độ ${temp}°C lên sơ đồ.`
        : `Đã lưu thông số lên đoạn LWR ${target.code} và cập nhật nhiệt độ sơ đồ ${temp}°C.`,
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
      return commit(patchTrackCell(layout, cell.id, patch));
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
    startTransition(() => {
      setSelectedLongRailId(id);
      setSelectedJoint(null);
    });
  }, []);

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
        subtitle={`Tuyến ${(extent.endMetres - extent.startMetres) / 1000} km · ${layout.rows.length} dải ray · ${cells.length} thanh ray · ${layout.longRails.length} đoạn LWR`}
        rangeLabel={`Km ${formatChainage(extent.startMetres)} – ${formatChainage(extent.endMetres)}`}
        stats={[
          { label: "Tổng chiều dài ray", value: `${totalLength / 1000} km`, tone: "text-slate-900" },
          { label: "Đoạn LWR", value: String(layout.longRails.length), tone: "text-teal-700" },
          { label: "Mối hàn (nhật ký)", value: String(weldCount), tone: "text-blue-700" },
          { label: "Đã gắn lý trình", value: `${weldsMapped}/${jointWithWelds} điểm`, tone: "text-emerald-700" },
        ]}
      />
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
          onClearPlan={(line) => {
            const keys = rowKeysForLine(layout.rows, line);
            const hasPlacement = layout.placements.some((item) => keys.has(item.rowKey));
            const hasLongRail = layout.longRails.some((item) => keys.has(item.rowKey));
            if (hasPlacement || hasLongRail) {
              setError(`Còn công trình hoặc đoạn LWR trên ${line}. Xoá các mục đó trước khi xoá rải ray tuyến này.`);
              return false;
            }
            return commit({
              ...layout,
              rows: layout.rows.map((row) => (row.line === line ? { ...row, cells: [] } : row)),
            });
          }}
        >
          {(structures) => <RailGrid
            structures={structures}
            appendError={error}
            rows={layout.rows}
            longRails={layout.longRails}
            selectedLongRailId={selectedLongRailId}
            onSelectLongRail={selectLongRail}
            embedded
            joints={joints}
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
              try {
                const placed = placeShortRailSpan(layout.rows, rowKey, start, end, temps);
                if (!commit({ ...layout, rows: placed.rows })) return false;
                setSelectedId(placed.cellId);
                setSelectedLongRailId(null);
                setSelectedJoint(null);
                setDetailOpen(true);
                return true;
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Không thêm được thanh ngắn.");
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
