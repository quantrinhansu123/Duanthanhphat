import {
  maintenanceEvents as seedEvents,
  type MaintenanceEvent,
  type MaintenanceImageAsset,
} from "@/data/maintenance";
import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

type DbMaintenanceRow = {
  id: string;
  may_id: string;
  ngay: string;
  gio: string;
  thoi_luong_phut: number;
  cong_viec: string;
  loai: MaintenanceEvent["type"];
  trang_thai: MaintenanceEvent["status"];
  nhan_su: string[] | null;
  ghi_chu: string | null;
  hinh_anh: unknown;
};

type MachineCodeRow = {
  id: string;
  ma_may: string;
};

export type MaintenanceSaveInput = {
  id?: string;
  date: string;
  time: string;
  durationMin: number;
  title: string;
  machine: string;
  type: MaintenanceEvent["type"];
  status: MaintenanceEvent["status"];
  assigneeNames: string[];
  note?: string;
  imageAssets: MaintenanceImageAsset[];
};

const MAINTENANCE_COLUMNS = [
  "id",
  "may_id",
  "ngay",
  "gio",
  "thoi_luong_phut",
  "cong_viec",
  "loai",
  "trang_thai",
  "nhan_su",
  "ghi_chu",
  "hinh_anh",
].join(",");

function parseImageAssets(value: unknown): MaintenanceImageAsset[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const publicId = String(row.publicId ?? row.public_id ?? "").trim();
    const secureUrl = String(row.secureUrl ?? row.secure_url ?? "").trim();
    if (!publicId || !secureUrl) return [];
    return [{
      publicId,
      secureUrl,
      name: String(row.name ?? publicId.split("/").at(-1) ?? "Ảnh bảo trì"),
      bytes: Number.isFinite(Number(row.bytes)) ? Number(row.bytes) : undefined,
    }];
  });
}

function rowToEvent(row: DbMaintenanceRow, machineCode: string): MaintenanceEvent {
  const assets = parseImageAssets(row.hinh_anh);
  return {
    id: row.id,
    date: row.ngay.slice(0, 10),
    time: row.gio.slice(0, 5),
    durationMin: Number(row.thoi_luong_phut),
    title: row.cong_viec,
    machine: machineCode,
    type: row.loai,
    status: row.trang_thai,
    assignees: (row.nhan_su ?? []).map((name) => ({ name, photo: "" })),
    note: row.ghi_chu?.trim() || undefined,
    images: assets.map((asset) => asset.secureUrl),
    imageAssets: assets,
    persisted: true,
  };
}

function mergeEvents(primary: MaintenanceEvent[], fallback: MaintenanceEvent[]) {
  const merged = new Map<string, MaintenanceEvent>();
  for (const event of [...fallback, ...primary]) merged.set(event.id, event);
  return Array.from(merged.values()).sort(
    (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
  );
}

async function loadMachineCodes() {
  const { data, error } = await createClient()
    .from("thiet_bi")
    .select("id,ma_may");
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []) as MachineCodeRow[];
}

export async function loadMaintenanceEvents(): Promise<{
  events: MaintenanceEvent[];
  source: "supabase" | "seed";
  error?: string;
}> {
  if (!isSupabaseConfigured()) return { events: seedEvents, source: "seed" };
  try {
    const supabase = createClient();
    const [machines, maintenance] = await Promise.all([
      loadMachineCodes(),
      supabase
        .from("lich_su_bao_tri_may")
        .select(MAINTENANCE_COLUMNS)
        .order("ngay", { ascending: false })
        .order("gio", { ascending: false }),
    ]);
    if (maintenance.error) throw maintenance.error;
    const codes = new Map(machines.map((machine) => [machine.id, machine.ma_may]));
    const saved = ((maintenance.data ?? []) as unknown as DbMaintenanceRow[]).map((row) =>
      rowToEvent(row, codes.get(row.may_id) ?? "Chưa xác định"),
    );
    return { events: mergeEvents(saved, seedEvents), source: "supabase" };
  } catch (error) {
    return {
      events: seedEvents,
      source: "seed",
      error: formatSupabaseError(error),
    };
  }
}

export async function loadMachineMaintenanceEvents(machineCode: string): Promise<MaintenanceEvent[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const machine = await supabase
    .from("thiet_bi")
    .select("id,ma_may")
    .eq("ma_may", machineCode)
    .maybeSingle();
  if (machine.error) throw new Error(formatSupabaseError(machine.error));
  if (!machine.data) return [];
  const machineRow = machine.data as MachineCodeRow;

  const maintenance = await supabase
    .from("lich_su_bao_tri_may")
    .select(MAINTENANCE_COLUMNS)
    .eq("may_id", machineRow.id)
    .order("ngay", { ascending: false })
    .order("gio", { ascending: false });
  if (maintenance.error) throw new Error(formatSupabaseError(maintenance.error));
  return ((maintenance.data ?? []) as unknown as DbMaintenanceRow[]).map((row) =>
    rowToEvent(row, machineRow.ma_may),
  );
}

async function resolveMachine(machineCode: string): Promise<MachineCodeRow> {
  const { data, error } = await createClient()
    .from("thiet_bi")
    .select("id,ma_may")
    .eq("ma_may", machineCode)
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as MachineCodeRow;
}

function toDbPayload(input: MaintenanceSaveInput, machineId: string) {
  return {
    may_id: machineId,
    ngay: input.date,
    gio: input.time,
    thoi_luong_phut: Math.max(1, Math.round(input.durationMin)),
    cong_viec: input.title.trim(),
    loai: input.type,
    trang_thai: input.status,
    nhan_su: input.assigneeNames,
    ghi_chu: input.note?.trim() || null,
    hinh_anh: input.imageAssets,
  };
}

export async function saveMaintenanceEvent(input: MaintenanceSaveInput): Promise<MaintenanceEvent> {
  if (!isSupabaseConfigured()) throw new Error("Chưa cấu hình Supabase.");
  const machine = await resolveMachine(input.machine);
  const supabase = createClient();
  const payload = toDbPayload(input, machine.id);
  const request = input.id
    ? supabase.from("lich_su_bao_tri_may").update(payload).eq("id", input.id)
    : supabase.from("lich_su_bao_tri_may").insert(payload);
  const { data, error } = await request.select(MAINTENANCE_COLUMNS).single();
  if (error) throw new Error(formatSupabaseError(error));
  return rowToEvent(data as unknown as DbMaintenanceRow, machine.ma_may);
}
