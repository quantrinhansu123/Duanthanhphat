import { supabase } from "@lwr/lib/supabase";
import { parseLongRail, type LongRail } from "@lwr/lib/track-editor";

const TABLE = "lwr_long_rails";

function isMissingTableError(message: string | undefined) {
  const text = (message ?? "").toLowerCase();
  return (
    text.includes("lwr_long_rails") ||
    text.includes("schema cache") ||
    text.includes("does not exist") ||
    text.includes("could not find the table")
  );
}

interface LongRailRow {
  id: string;
  code: string;
  label: string;
  row_key: string;
  start_cell_id: string;
  end_cell_id: string;
  params: unknown;
  updated_at: string;
}

function fromRow(row: LongRailRow): LongRail | null {
  return parseLongRail({
    id: row.id,
    code: row.code,
    label: row.label,
    rowKey: row.row_key,
    startCellId: row.start_cell_id,
    endCellId: row.end_cell_id,
    params: row.params,
    updatedAt: row.updated_at,
  });
}

function toRow(rail: LongRail): LongRailRow {
  return {
    id: rail.id,
    code: rail.code,
    label: rail.label,
    row_key: rail.rowKey,
    start_cell_id: rail.startCellId,
    end_cell_id: rail.endCellId,
    params: rail.params,
    updated_at: rail.updatedAt,
  };
}

export type LongRailLoadResult = {
  rails: LongRail[];
  source: "supabase" | "local";
  error?: string;
};

/** Load long rails from Supabase; caller supplies local cache when table/config missing. */
export async function loadLongRails(localFallback: LongRail[] = []): Promise<LongRailLoadResult> {
  if (!supabase) {
    return { rails: localFallback, source: "local", error: "Chưa cấu hình Supabase (.env.local)." };
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,code,label,row_key,start_cell_id,end_cell_id,params,updated_at")
    .order("updated_at", { ascending: false });
  if (error) {
    if (isMissingTableError(error.message)) {
      return {
        rails: localFallback,
        source: "local",
        error: "Chưa chạy migration lwr_long_rails. Đang dùng dữ liệu local.",
      };
    }
    return { rails: localFallback, source: "local", error: error.message };
  }
  const rails = (data as LongRailRow[] | null ?? [])
    .map(fromRow)
    .filter((item): item is LongRail => item !== null);
  return { rails, source: "supabase" };
}

/** Insert or update one long rail on Supabase. No-ops when client missing / table not ready. */
export async function upsertLongRail(rail: LongRail): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!supabase) return { ok: true, skipped: true, error: "Chưa cấu hình Supabase." };
  const { error } = await supabase.from(TABLE).upsert(toRow(rail), { onConflict: "id" });
  if (!error) return { ok: true };
  if (isMissingTableError(error.message)) {
    return { ok: true, skipped: true, error: "Chưa chạy migration lwr_long_rails." };
  }
  return { ok: false, error: error.message };
}

export async function deleteLongRailRemote(id: string): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!supabase) return { ok: true, skipped: true };
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (!error) return { ok: true };
  if (isMissingTableError(error.message)) {
    return { ok: true, skipped: true, error: "Chưa chạy migration lwr_long_rails." };
  }
  return { ok: false, error: error.message };
}

/** Push local-only rails that are not yet on the server (one-time migrate). */
export async function syncLocalLongRailsToSupabase(localRails: LongRail[]): Promise<{ uploaded: number; error?: string }> {
  if (!supabase || !localRails.length) return { uploaded: 0 };
  const remote = await loadLongRails([]);
  if (remote.source !== "supabase") return { uploaded: 0, error: remote.error };
  const remoteIds = new Set(remote.rails.map((item) => item.id));
  const missing = localRails.filter((item) => !remoteIds.has(item.id));
  let uploaded = 0;
  for (const rail of missing) {
    const result = await upsertLongRail(rail);
    if (!result.ok) return { uploaded, error: result.error };
    if (!result.skipped) uploaded += 1;
  }
  return { uploaded };
}
