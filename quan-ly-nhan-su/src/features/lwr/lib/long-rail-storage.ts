import { supabase } from "@lwr/lib/supabase";
import { parseLongRail, type LongRail } from "@lwr/lib/track-editor";

const TABLE = "lwr_long_rails";

function isMissingTableError(message: string | undefined) {
  const text = (message ?? "").toLowerCase();
  return (
    (text.includes("lwr_long_rails") && text.includes("schema cache")) ||
    text.includes("does not exist") ||
    text.includes("could not find the table")
  );
}

function isUniqueCodeError(message: string | undefined) {
  const text = (message ?? "").toLowerCase();
  return text.includes("lwr_long_rails_code_unique") || (text.includes("duplicate key") && text.includes("code"));
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

/** DB `code` column: bare mã khi chưa gán dự án, hoặc `projectId:mã` khi đã gán. */
export function storageCode(rail: Pick<LongRail, "code" | "projectId">): string {
  return rail.projectId ? `${rail.projectId}:${rail.code}` : rail.code;
}

/** Mã hiển thị bị trùng trong cùng sơ đồ (không lưu được lên unique code). */
export function duplicateLongRailCodes(rails: LongRail[]): string[] {
  const counts = new Map<string, number>();
  for (const rail of rails) {
    const key = storageCode(rail);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([code]) => code);
}

function fromRow(row: LongRailRow): LongRail | null {
  const meta = row.params && typeof row.params === "object" && "placement" in row.params
    ? row.params.placement : undefined;
  const projectId = meta && typeof meta === "object" && "projectId" in meta && typeof meta.projectId === "string" ? meta.projectId : undefined;
  return parseLongRail({
    ...(meta && typeof meta === "object" ? meta : {}),
    id: row.id,
    code: projectId && row.code.startsWith(`${projectId}:`) ? row.code.slice(projectId.length + 1) : row.code,
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
    code: storageCode(rail),
    label: rail.label,
    row_key: rail.rowKey,
    start_cell_id: rail.startCellId,
    end_cell_id: rail.endCellId,
    params: { ...rail.params, placement: { projectId: rail.projectId, startMetres: rail.startMetres, endMetres: rail.endMetres, releaseDate: rail.releaseDate, completedAt: rail.completedAt } },
    updated_at: rail.updatedAt,
  };
}

export type LongRailLoadResult = {
  rails: LongRail[];
  source: "supabase" | "local";
  error?: string;
};

/** Keep the newer copy of each rail so a local method change is not overwritten. */
export function preferNewerLongRails(local: LongRail[], remote: LongRail[]): LongRail[] {
  const localById = new Map(local.map((rail) => [rail.id, rail]));
  const localByCode = new Map(local.map((rail) => [storageCode(rail), rail]));
  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();
  const merged: LongRail[] = [];
  for (const remoteRail of remote) {
    seenIds.add(remoteRail.id);
    seenCodes.add(storageCode(remoteRail));
    const localRail = localById.get(remoteRail.id) ?? localByCode.get(storageCode(remoteRail));
    if (!localRail) {
      merged.push(remoteRail);
      continue;
    }
    seenIds.add(localRail.id);
    const localTime = Date.parse(localRail.updatedAt);
    const remoteTime = Date.parse(remoteRail.updatedAt);
    const pick =
      Number.isFinite(localTime) && Number.isFinite(remoteTime) && localTime >= remoteTime
        ? localRail
        : remoteRail;
    // Prefer remote id when codes match but UUIDs differ — avoids unique code insert conflicts later.
    if (pick === localRail && localRail.id !== remoteRail.id && storageCode(localRail) === storageCode(remoteRail)) {
      merged.push({ ...localRail, id: remoteRail.id });
    } else {
      merged.push(pick);
    }
  }
  for (const rail of local) {
    if (seenIds.has(rail.id) || seenCodes.has(storageCode(rail))) continue;
    merged.push(rail);
  }
  return merged;
}

/** Load long rails from Supabase; caller supplies local cache when table/config missing. */
export async function loadLongRails(localFallback: LongRail[] = [], projectId?: string): Promise<LongRailLoadResult> {
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
    .filter((item): item is LongRail => item !== null && item.projectId === projectId);
  return { rails, source: "supabase" };
}

/**
 * Insert or update one long rail.
 * Upsert theo id; nếu mã (code) đã thuộc UUID khác thì xoá bản cũ rồi ghi đè — tránh lỗi
 * lwr_long_rails_code_unique khi local tạo lại đoạn với UUID mới.
 */
export async function upsertLongRail(rail: LongRail): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!supabase) return { ok: true, skipped: true, error: "Chưa cấu hình Supabase." };
  const row = toRow(rail);

  const { data: byCode, error: lookupError } = await supabase
    .from(TABLE)
    .select("id")
    .eq("code", row.code)
    .maybeSingle();
  if (lookupError && !isMissingTableError(lookupError.message)) {
    return { ok: false, error: lookupError.message };
  }
  if (isMissingTableError(lookupError?.message)) {
    return { ok: true, skipped: true, error: "Chưa chạy migration lwr_long_rails." };
  }
  if (byCode?.id && byCode.id !== row.id) {
    const { error: deleteError } = await supabase.from(TABLE).delete().eq("id", byCode.id);
    if (deleteError) {
      if (isMissingTableError(deleteError.message)) {
        return { ok: true, skipped: true, error: "Chưa chạy migration lwr_long_rails." };
      }
      return { ok: false, error: deleteError.message };
    }
  }

  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: "id" });
  if (!error) return { ok: true };
  if (isMissingTableError(error.message)) {
    return { ok: true, skipped: true, error: "Chưa chạy migration lwr_long_rails." };
  }
  if (isUniqueCodeError(error.message)) {
    return {
      ok: false,
      error: `Mã đoạn LWR «${rail.code}» đã tồn tại trên máy chủ. Bấm «Đánh số lại TT/TP/HT/HP» hoặc đổi mã rồi lưu lại.`,
    };
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
export async function syncLocalLongRailsToSupabase(localRails: LongRail[], projectId?: string): Promise<{ uploaded: number; error?: string }> {
  if (!supabase || !localRails.length) return { uploaded: 0 };
  const remote = await loadLongRails([], projectId);
  if (remote.source !== "supabase") return { uploaded: 0, error: remote.error };
  const remoteIds = new Set(remote.rails.map((item) => item.id));
  const missing = localRails.filter((item) => !remoteIds.has(item.id));
  let uploaded = 0;
  for (const rail of missing) {
    // upsertLongRail gỡ bản remote trùng mã (UUID khác) trước khi ghi.
    const result = await upsertLongRail(rail);
    if (!result.ok) return { uploaded, error: result.error };
    if (!result.skipped) uploaded += 1;
  }
  return { uploaded };
}
