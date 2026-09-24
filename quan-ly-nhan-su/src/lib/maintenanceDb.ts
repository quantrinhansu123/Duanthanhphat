import {
  maintenanceEvents as seedEvents,
  type MaintenanceAssignee,
  type MaintenanceEvent,
  type MaintenanceImageAsset,
} from "@/data/maintenance";
import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

type DbMaintenanceRow = {
  id: string;
  created_at: string;
  may_id: string;
  ngay: string;
  gio: string;
  thoi_luong_phut: number;
  cong_viec: string;
  loai: MaintenanceEvent["type"];
  trang_thai: MaintenanceEvent["status"];
  ket_qua: MaintenanceEvent["result"] | null;
  nhac_nho: string | null;
  nhan_su: string[] | null;
  ghi_chu: string | null;
  hinh_anh: unknown;
};

type MachineCodeRow = {
  id: string;
  ma_may: string;
};

type PersonnelPhotoRow = {
  ho_ten: string;
  hinh_anh: string | null;
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
  result?: MaintenanceEvent["result"];
  reminder?: string;
  assigneeNames: string[];
  note?: string;
  imageAssets: MaintenanceImageAsset[];
};

const MAINTENANCE_COLUMNS = [
  "id",
  "created_at",
  "may_id",
  "ngay",
  "gio",
  "thoi_luong_phut",
  "cong_viec",
  "loai",
  "trang_thai",
  "ket_qua",
  "nhac_nho",
  "nhan_su",
  "ghi_chu",
  "hinh_anh",
].join(",");

const MAINTENANCE_COLUMNS_LEGACY = [
  "id",
  "created_at",
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

function isMissingResultReminderColumn(error: unknown) {
  const message = formatSupabaseError(error).toLowerCase();
  return message.includes("ket_qua") || message.includes("nhac_nho");
}

function normalizeResult(value: unknown): MaintenanceEvent["result"] {
  if (value === "Đạt" || value === "Không đạt" || value === "Cần theo dõi" || value === "Chưa có") {
    return value;
  }
  return "Chưa có";
}

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

function sortEvents(events: MaintenanceEvent[]) {
  return [...events].sort(
    (a, b) =>
      (b.createdAt ?? `${b.date}T${b.time}`).localeCompare(
        a.createdAt ?? `${a.date}T${a.time}`,
      ),
  );
}

function resolveAssignees(
  names: string[] | null | undefined,
  photosByName: Map<string, string>,
): MaintenanceAssignee[] {
  return (names ?? []).map((name) => {
    const trimmed = name.trim();
    return {
      name: trimmed,
      photo: photosByName.get(trimmed.toLocaleLowerCase("vi")) || "",
    };
  });
}

function rowToEvent(
  row: DbMaintenanceRow,
  machineCode: string,
  photosByName: Map<string, string> = new Map(),
): MaintenanceEvent {
  const assets = parseImageAssets(row.hinh_anh);
  return {
    id: row.id,
    createdAt: row.created_at,
    date: row.ngay.slice(0, 10),
    time: row.gio.slice(0, 5),
    durationMin: Number(row.thoi_luong_phut),
    title: row.cong_viec,
    machine: machineCode,
    type: row.loai,
    status: row.trang_thai,
    result: normalizeResult(row.ket_qua),
    reminder: row.nhac_nho?.trim() || undefined,
    assignees: resolveAssignees(row.nhan_su, photosByName),
    note: row.ghi_chu?.trim() || undefined,
    images: assets.map((asset) => asset.secureUrl),
    imageAssets: assets,
    persisted: true,
  };
}

async function loadMachineCodes() {
  const { data, error } = await createClient()
    .from("thiet_bi")
    .select("id,ma_may");
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []) as MachineCodeRow[];
}

async function loadPersonnelPhotosByName() {
  const photosByName = new Map<string, string>();
  if (!isSupabaseConfigured()) return photosByName;
  const supabase = createClient();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("nhan_su")
      .select("ho_ten,hinh_anh")
      .order("ho_ten", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(formatSupabaseError(error));
    const page = (data ?? []) as PersonnelPhotoRow[];
    for (const row of page) {
      const name = row.ho_ten?.trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase("vi");
      if (photosByName.has(key)) continue;
      photosByName.set(key, row.hinh_anh?.trim() || "");
    }
    if (page.length < pageSize) break;
  }
  return photosByName;
}

export async function loadMaintenanceEvents(): Promise<{
  events: MaintenanceEvent[];
  source: "supabase" | "seed";
  error?: string;
}> {
  // Chỉ dùng seed khi chưa cấu hình Supabase. Khi đã kết nối DB thì không trộn
  // dữ liệu mock (tránh hiện nhân sự giả như Phạm Văn Minh trên lịch thật).
  if (!isSupabaseConfigured()) return { events: seedEvents, source: "seed" };
  try {
    const supabase = createClient();
    const [machines, photosByName] = await Promise.all([
      loadMachineCodes(),
      loadPersonnelPhotosByName().catch(() => new Map<string, string>()),
    ]);
    let maintenance = await supabase
      .from("lich_su_bao_tri_may")
      .select(MAINTENANCE_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (maintenance.error && isMissingResultReminderColumn(maintenance.error)) {
      maintenance = await supabase
        .from("lich_su_bao_tri_may")
        .select(MAINTENANCE_COLUMNS_LEGACY)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
    }
    if (maintenance.error) throw maintenance.error;
    const codes = new Map(machines.map((machine) => [machine.id, machine.ma_may]));
    const saved = ((maintenance.data ?? []) as unknown as DbMaintenanceRow[]).map((row) =>
      rowToEvent(row, codes.get(row.may_id) ?? "Chưa xác định", photosByName),
    );
    return { events: sortEvents(saved), source: "supabase" };
  } catch (error) {
    return {
      events: [],
      source: "supabase",
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
  const photosByName = await loadPersonnelPhotosByName().catch(
    () => new Map<string, string>(),
  );

  let maintenance = await supabase
    .from("lich_su_bao_tri_may")
    .select(MAINTENANCE_COLUMNS)
    .eq("may_id", machineRow.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (maintenance.error && isMissingResultReminderColumn(maintenance.error)) {
    maintenance = await supabase
      .from("lich_su_bao_tri_may")
      .select(MAINTENANCE_COLUMNS_LEGACY)
      .eq("may_id", machineRow.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  }
  if (maintenance.error) throw new Error(formatSupabaseError(maintenance.error));
  return ((maintenance.data ?? []) as unknown as DbMaintenanceRow[]).map((row) =>
    rowToEvent(row, machineRow.ma_may, photosByName),
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
    ket_qua: normalizeResult(input.result),
    nhac_nho: input.reminder?.trim() || null,
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
  let { data, error } = await request.select(MAINTENANCE_COLUMNS).single();
  if (error && isMissingResultReminderColumn(error)) {
    const { ket_qua: _ketQua, nhac_nho: _nhacNho, ...legacyPayload } = payload;
    const legacyRequest = input.id
      ? supabase.from("lich_su_bao_tri_may").update(legacyPayload).eq("id", input.id)
      : supabase.from("lich_su_bao_tri_may").insert(legacyPayload);
    ({ data, error } = await legacyRequest.select(MAINTENANCE_COLUMNS_LEGACY).single());
    if (!error && data) {
      const photosByName = await loadPersonnelPhotosByName().catch(
        () => new Map<string, string>(),
      );
      const event = rowToEvent(data as unknown as DbMaintenanceRow, machine.ma_may, photosByName);
      return {
        ...event,
        result: normalizeResult(input.result),
        reminder: input.reminder?.trim() || undefined,
      };
    }
  }
  if (error) throw new Error(formatSupabaseError(error));
  const photosByName = await loadPersonnelPhotosByName().catch(
    () => new Map<string, string>(),
  );
  return rowToEvent(data as unknown as DbMaintenanceRow, machine.ma_may, photosByName);
}
