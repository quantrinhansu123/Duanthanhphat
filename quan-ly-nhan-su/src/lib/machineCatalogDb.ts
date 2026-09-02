import { machines as seedMachines, type Machine } from "@/data/machines";
import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

type MachineCatalogRow = {
  id: string;
  ma_may: string;
  ten_may: string;
  vi_tri_hien_tai: string | null;
  hinh_anh: string | null;
  trang_thai: string;
};

const validStatuses = new Set<Machine["status"]>([
  "Đang làm việc",
  "Sẵn sàng",
  "Bảo trì",
  "Hỏng",
]);

function normalizeStatus(status: string): Machine["status"] {
  if (validStatuses.has(status as Machine["status"])) return status as Machine["status"];
  if (status === "Hoạt động") return "Đang làm việc";
  return status === "Bảo trì" ? "Bảo trì" : status === "Hỏng" ? "Hỏng" : "Sẵn sàng";
}

function rowToMachine(row: MachineCatalogRow): Machine {
  const seed = seedMachines.find((machine) => machine.code === row.ma_may);
  const status = normalizeStatus(row.trang_thai);
  return {
    id: row.id,
    code: row.ma_may,
    name: row.ten_may,
    model: seed?.model ?? row.ma_may.split("-")[0] ?? "Khác",
    plant: seed?.plant ?? "Chưa cập nhật",
    location: row.vi_tri_hien_tai?.trim() || seed?.location || "Chưa cập nhật",
    status,
    available: status === "Sẵn sàng",
    weldCount: seed?.weldCount ?? 0,
    image: row.hinh_anh || seed?.image || "/may-han/k920.svg",
    serialNumber: seed?.serialNumber ?? "—",
    yearInstalled: seed?.yearInstalled ?? new Date().getFullYear(),
    operator: seed?.operator ?? "—",
    team: seed?.team ?? "—",
    lastMaintenance: seed?.lastMaintenance ?? "—",
    nextMaintenance: seed?.nextMaintenance ?? "—",
    operatingHours: seed?.operatingHours ?? 0,
    errorRate: seed?.errorRate ?? "—",
    note: seed?.note ?? "",
  };
}

export async function loadMachineCatalog(): Promise<{ machines: Machine[]; source: "supabase" | "seed"; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { machines: seedMachines, source: "seed", error: "Chưa cấu hình Supabase" };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("thiet_bi")
    .select("id,ma_may,ten_may,vi_tri_hien_tai,hinh_anh,trang_thai")
    .order("ma_may", { ascending: true });
  if (error) {
    return { machines: seedMachines, source: "seed", error: formatSupabaseError(error) };
  }
  return {
    machines: ((data ?? []) as MachineCatalogRow[]).map(rowToMachine),
    source: "supabase",
  };
}

function machinePayload(machine: Machine) {
  return {
    ma_may: machine.code.trim(),
    ten_may: machine.name.trim(),
    vi_tri_hien_tai: machine.location.trim(),
    trang_thai: machine.status,
    hinh_anh: machine.image || null,
  };
}

export async function createMachine(machine: Machine): Promise<Machine> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("thiet_bi")
    .insert(machinePayload(machine))
    .select("id,ma_may,ten_may,vi_tri_hien_tai,hinh_anh,trang_thai")
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  const saved = rowToMachine(data as MachineCatalogRow);
  return {
    ...machine,
    id: saved.id,
    code: saved.code,
    name: saved.name,
    location: saved.location,
    status: saved.status,
    available: saved.available,
    image: saved.image,
  };
}

export async function updateMachine(machine: Machine) {
  const supabase = createClient();
  const { error } = await supabase
    .from("thiet_bi")
    .update(machinePayload(machine))
    .eq("id", machine.id);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function deleteMachine(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("thiet_bi").delete().eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}
