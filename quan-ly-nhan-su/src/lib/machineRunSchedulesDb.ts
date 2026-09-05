import {
  machineRunSchedules as seedSchedules,
  type LookupOption,
  type MachineOption,
  type MachineRunSchedule,
} from "@/data/machineAssignments";
import { machines as seedMachines } from "@/data/machines";
import { projects as seedProjects } from "@/data/projects";
import { welders as seedWelders } from "@/data/welders";
import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

type MachineRunScheduleRow = {
  id: string;
  ngay: string;
  may_id: string;
  ma_may: string;
  ten_may: string;
  vi_tri: string;
  so_gio_hoat_dong: number | string;
  du_an_id: string;
  du_an: string;
  nguoi_phu_trach_id: string;
  nguoi_phu_trach: string;
};

type EquipmentRow = { id: string; ma_may: string; ten_may: string };
type ProjectRow = { id: string; du_an: string };
type PersonnelRow = { employee_id: string; ho_ten: string };

type MachineReportRow = {
  may_id: string;
  ma_may: string;
  ten_may: string;
  vi_tri_hien_tai: string | null;
  trang_thai: string;
  so_luot_chay: number | string;
  tong_gio_hoat_dong: number | string;
  tong_moi_han: number | string;
  tong_moi_han_loi: number | string;
};

export type MachineReportSummary = {
  machineId: string;
  machineCode: string;
  machineName: string;
  location: string;
  status: string;
  runCount: number;
  operatingHours: number;
  weldCount: number;
  failedWeldCount: number;
};

export type MachineRunScheduleFormValues = {
  date: string;
  machineId: string;
  location: string;
  operatingHours: number;
  projectId: string;
  personInChargeId: string;
};

export type MachineRunScheduleBundle = {
  schedules: MachineRunSchedule[];
  machines: MachineOption[];
  projects: LookupOption[];
  personnel: LookupOption[];
  source: "supabase" | "seed";
  error?: string;
};

function rowToSchedule(row: MachineRunScheduleRow): MachineRunSchedule {
  return {
    id: row.id,
    date: row.ngay,
    machineId: row.may_id,
    machineCode: row.ma_may,
    machineName: row.ten_may,
    location: row.vi_tri,
    operatingHours: Number(row.so_gio_hoat_dong),
    projectId: row.du_an_id,
    projectName: row.du_an,
    personInChargeId: row.nguoi_phu_trach_id,
    personInChargeName: row.nguoi_phu_trach,
  };
}

function seedBundle(error?: string): MachineRunScheduleBundle {
  return {
    schedules: seedSchedules,
    machines: seedMachines.map((machine) => ({
      id: `seed-${machine.code.toLowerCase()}`,
      code: machine.code,
      name: machine.name,
    })),
    projects: seedProjects.map((project) => ({ id: `seed-project-${project.id}`, label: project.name })),
    personnel: seedWelders.map((person) => ({ id: `seed-person-${person.id}`, label: person.name })),
    source: "seed",
    error,
  };
}

export async function loadMachineOptions(): Promise<MachineOption[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("thiet_bi")
    .select("id,ma_may,ten_may")
    .order("ma_may", { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  return ((data ?? []) as EquipmentRow[]).map((row) => ({
    id: row.id,
    code: row.ma_may,
    name: row.ten_may,
  }));
}

export async function loadMachineReportSummary(): Promise<MachineReportSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const result = await supabase
    .from("bao_cao_may")
    .select("may_id,ma_may,ten_may,trang_thai,so_luot_chay,tong_gio_hoat_dong,tong_moi_han,tong_moi_han_loi,vi_tri_hien_tai")
    .order("ma_may", { ascending: true });
  let reportRows: MachineReportRow[];
  if (result.error) {
    const message = formatSupabaseError(result.error);
    if (!message.includes("vi_tri_hien_tai")) throw new Error(message);
    const fallback = await supabase
      .from("bao_cao_may")
      .select("may_id,ma_may,ten_may,trang_thai,so_luot_chay,tong_gio_hoat_dong,tong_moi_han,tong_moi_han_loi")
      .order("ma_may", { ascending: true });
    if (fallback.error) throw new Error(formatSupabaseError(fallback.error));
    reportRows = (fallback.data ?? []).map((row) => ({ ...row, vi_tri_hien_tai: null })) as MachineReportRow[];
  } else {
    reportRows = (result.data ?? []) as MachineReportRow[];
  }
  return reportRows.map((row) => ({
    machineId: row.may_id,
    machineCode: row.ma_may,
    machineName: row.ten_may,
    location: row.vi_tri_hien_tai ?? "",
    status: row.trang_thai,
    runCount: Number(row.so_luot_chay),
    operatingHours: Number(row.tong_gio_hoat_dong),
    weldCount: Number(row.tong_moi_han),
    failedWeldCount: Number(row.tong_moi_han_loi),
  }));
}

export async function loadMachineRunScheduleBundle(): Promise<MachineRunScheduleBundle> {
  if (!isSupabaseConfigured()) return seedBundle("Chưa cấu hình Supabase");

  const supabase = createClient();
  try {
    const [scheduleResult, machineResult, projectResult, personnelResult] = await Promise.all([
      supabase
        .from("bao_cao_lich_chay_may")
        .select("id,ngay,may_id,ma_may,ten_may,vi_tri,so_gio_hoat_dong,du_an_id,du_an,nguoi_phu_trach_id,nguoi_phu_trach")
        .order("ngay", { ascending: false })
        .order("ma_may", { ascending: true }),
      supabase.from("thiet_bi").select("id,ma_may,ten_may").order("ma_may", { ascending: true }),
      supabase.from("du_an").select("id,du_an").order("du_an", { ascending: true }),
      supabase.from("nhan_su").select("employee_id,ho_ten").order("ho_ten", { ascending: true }),
    ]);

    const firstError = scheduleResult.error ?? machineResult.error ?? projectResult.error ?? personnelResult.error;
    if (firstError) throw firstError;

    return {
      schedules: ((scheduleResult.data ?? []) as MachineRunScheduleRow[]).map(rowToSchedule),
      machines: ((machineResult.data ?? []) as EquipmentRow[]).map((row) => ({
        id: row.id,
        code: row.ma_may,
        name: row.ten_may,
      })),
      projects: ((projectResult.data ?? []) as ProjectRow[]).map((row) => ({ id: row.id, label: row.du_an })),
      personnel: ((personnelResult.data ?? []) as PersonnelRow[]).map((row) => ({
        id: row.employee_id,
        label: row.ho_ten,
      })),
      source: "supabase",
    };
  } catch (error) {
    return seedBundle(formatSupabaseError(error));
  }
}

export async function insertMachineRunSchedule(values: MachineRunScheduleFormValues) {
  const supabase = createClient();
  const { error } = await supabase.from("nhat_ky_chay_may").insert({
    ngay: values.date,
    may: values.machineId,
    vi_tri: values.location.trim(),
    so_gio_hoat_dong: values.operatingHours,
    du_an: values.projectId,
    nguoi_phu_trach: values.personInChargeId,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function updateMachineRunSchedule(id: string, values: MachineRunScheduleFormValues) {
  const supabase = createClient();
  const { error } = await supabase
    .from("nhat_ky_chay_may")
    .update({
      ngay: values.date,
      may: values.machineId,
      vi_tri: values.location.trim(),
      so_gio_hoat_dong: values.operatingHours,
      du_an: values.projectId,
      nguoi_phu_trach: values.personInChargeId,
    })
    .eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function deleteMachineRunSchedule(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("nhat_ky_chay_may").delete().eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}
