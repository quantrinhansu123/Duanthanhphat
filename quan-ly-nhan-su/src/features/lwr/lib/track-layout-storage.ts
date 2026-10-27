import { supabase } from "@lwr/lib/supabase";
import {
  createInitialTrackLayout,
  validateTrackLayout,
  type TrackLayout,
} from "@lwr/lib/track-editor";

const TABLE = "lwr_track_layouts";

function isMissingTableError(message: string | undefined) {
  const text = (message ?? "").toLowerCase();
  return (
    (text.includes("lwr_track_layouts") && text.includes("schema cache")) ||
    text.includes("does not exist") ||
    text.includes("could not find the table")
  );
}

export type TrackLayoutLoadResult = {
  layout: TrackLayout | null;
  updatedAt: string | null;
  source: "supabase" | "local";
  error?: string;
};

export type TrackLayoutSaveResult = {
  ok: boolean;
  error?: string;
  skipped?: boolean;
};

/** True when the schematic differs from the empty starter (rows, symbols, welds, or LWR). */
export function trackLayoutHasEdits(layout: TrackLayout): boolean {
  const initial = createInitialTrackLayout();
  const signature = (item: TrackLayout) => JSON.stringify({
    rows: item.rows,
    placements: item.placements,
    installed: item.installed ?? null,
    jointWeldLinks: item.jointWeldLinks ?? null,
    longRailIds: item.longRails.map((rail) => rail.id),
  });
  return signature(layout) !== signature(initial);
}

function layoutRichness(layout: TrackLayout): number {
  return JSON.stringify(layout).length;
}

/**
 * Pick the schematic to show. A timestamped local copy wins when it is newer.
 * A legacy browser cache (no timestamp) is kept when it holds more of the schematic than the server.
 */
export function chooseTrackLayout(input: {
  local: TrackLayout | null;
  localSavedAt: string | null;
  remote: TrackLayout | null;
  remoteUpdatedAt: string | null;
}): { layout: TrackLayout; upload: boolean; from: "local" | "remote" | "initial" } {
  const { local, remote } = input;
  if (!remote && !local) {
    return { layout: createInitialTrackLayout(), upload: false, from: "initial" };
  }
  if (!remote && local) {
    return { layout: local, upload: trackLayoutHasEdits(local), from: "local" };
  }
  if (!local && remote) {
    return { layout: remote, upload: false, from: "remote" };
  }
  const localTime = input.localSavedAt ? Date.parse(input.localSavedAt) : Number.NaN;
  const remoteTime = input.remoteUpdatedAt ? Date.parse(input.remoteUpdatedAt) : Number.NaN;
  if (Number.isFinite(localTime) && (!Number.isFinite(remoteTime) || localTime > remoteTime)) {
    return { layout: local as TrackLayout, upload: true, from: "local" };
  }
  if (Number.isFinite(localTime) && Number.isFinite(remoteTime)) {
    return { layout: remote as TrackLayout, upload: false, from: "remote" };
  }
  if (local && remote && layoutRichness(local) > layoutRichness(remote)) {
    return { layout: local, upload: true, from: "local" };
  }
  return { layout: remote as TrackLayout, upload: false, from: "remote" };
}

export function serializeTrackLayout(layout: TrackLayout, savedAt: string | null): string {
  return JSON.stringify(savedAt ? { ...layout, savedAt } : layout);
}

export function readStoredTrackLayout(raw: string | null): {
  layout: TrackLayout | null;
  savedAt: string | null;
  invalid: boolean;
} {
  if (!raw) return { layout: null, savedAt: null, invalid: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { layout: null, savedAt: null, invalid: true };
  }
  const savedAt = parsed !== null && typeof parsed === "object" && "savedAt" in parsed
    && typeof parsed.savedAt === "string"
    ? parsed.savedAt
    : null;
  const layout = validateTrackLayout(parsed);
  if (!layout) return { layout: null, savedAt, invalid: true };
  return { layout, savedAt, invalid: false };
}

/** Load one schematic. projectId omitted = the unassigned diagram (project_id ''). */
export async function loadTrackLayout(projectId?: string): Promise<TrackLayoutLoadResult> {
  if (!supabase) {
    return { layout: null, updatedAt: null, source: "local", error: "Chưa cấu hình Supabase (.env.local)." };
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select("layout,updated_at")
    .eq("project_id", projectId ?? "")
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error.message)) {
      return {
        layout: null,
        updatedAt: null,
        source: "local",
        error: "Chưa chạy migration lwr_track_layouts. Sơ đồ vẫn lưu trên trình duyệt.",
      };
    }
    return { layout: null, updatedAt: null, source: "local", error: error.message };
  }
  if (!data) return { layout: null, updatedAt: null, source: "supabase" };
  const layout = validateTrackLayout(data.layout);
  if (!layout) {
    return {
      layout: null,
      updatedAt: null,
      source: "local",
      error: "Sơ đồ trên Supabase không hợp lệ. Đang giữ bản trên trình duyệt.",
    };
  }
  const updatedAt = typeof data.updated_at === "string" ? data.updated_at : null;
  return { layout, updatedAt, source: "supabase" };
}

export async function upsertTrackLayout(
  projectId: string | undefined,
  layout: TrackLayout,
  savedAt: string,
): Promise<TrackLayoutSaveResult> {
  if (!supabase) return { ok: true, skipped: true, error: "Chưa cấu hình Supabase." };
  const { error } = await supabase.from(TABLE).upsert(
    { project_id: projectId ?? "", layout, updated_at: savedAt },
    { onConflict: "project_id" },
  );
  if (!error) return { ok: true };
  if (isMissingTableError(error.message)) {
    return { ok: true, skipped: true, error: "Chưa chạy migration lwr_track_layouts. Sơ đồ vẫn lưu trên trình duyệt." };
  }
  return { ok: false, error: error.message };
}

export async function deleteTrackLayout(projectId?: string): Promise<TrackLayoutSaveResult> {
  if (!supabase) return { ok: true, skipped: true };
  const { error } = await supabase.from(TABLE).delete().eq("project_id", projectId ?? "");
  if (!error) return { ok: true };
  if (isMissingTableError(error.message)) {
    return { ok: true, skipped: true, error: "Chưa chạy migration lwr_track_layouts." };
  }
  return { ok: false, error: error.message };
}
