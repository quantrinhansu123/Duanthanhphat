import {
  machineRunSchedules as seedSchedules,
  type LookupOption,
  type MachineOperationImageAsset,
  type MachineOption,
  type MachineRunSchedule,
} from "@/data/machineAssignments";
import { machines as seedMachines } from "@/data/machines";
import { projects as seedProjects } from "@/data/projects";
import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";
import {
  getJournalRowDateIso,
  loadWeldReportRows,
  resolveWeldShift,
  type WeldReportRow,
} from "@/lib/weldReportData";

/** Mỗi ca hàn quy ước ~8 giờ máy khi tổng hợp từ nhật ký. */
export const HOURS_PER_WELD_SHIFT = 8;

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
  fuelAddedLiters: number;
  pumpOpened: boolean;
  machineCondition: string;
  conditionDescription: string;
  recommendation: string;
  imageAssets: MachineOperationImageAsset[];
};

export type MachineRunScheduleBundle = {
  schedules: MachineRunSchedule[];
  machines: MachineOption[];
  projects: LookupOption[];
  personnel: LookupOption[];
  source: "supabase" | "seed";
  error?: string;
};

/** Gom bản ghi nhật ký hàn → 1 dòng / (ngày · máy · dự án · thợ · PP hàn · loại mối). */
export function aggregateWeldJournalToSchedules(rows: WeldReportRow[]): MachineRunSchedule[] {
  type Acc = {
    date: string;
    machineId: string;
    machineCode: string;
    machineName: string;
    projectId: string;
    projectName: string;
    personInChargeId: string;
    personInChargeName: string;
    weldMethod: string;
    weldType: string;
    shifts: Set<string>;
    weldCount: number;
    failedWeldCount: number;
    journalEntryCount: number;
  };

  const groups = new Map<string, Acc>();

  rows.forEach((row, index) => {
    const date = getJournalRowDateIso(row, index);
    if (!date) return;

    const machineCode = row.ma_may?.trim() || "Chưa gán máy";
    const machineId = row.may_id?.trim() || `code:${machineCode}`;
    const projectId = row.du_an_id?.trim() || "";
    const projectName = row.du_an?.trim() || "Chưa gắn dự án";
    const personInChargeId = row.tho_han_id?.trim() || "";
    const personInChargeName = row.ten_tho_han?.trim() || "Chưa xác định";
    const weldMethod = row.cong_nghe_han?.trim() || "—";
    const weldType = row.loai_moi_han?.trim() || "—";
    const key = `${date}|${machineId}|${projectId}|${personInChargeId}|${weldMethod}|${weldType}`;

    let acc = groups.get(key);
    if (!acc) {
      acc = {
        date,
        machineId,
        machineCode,
        machineName: row.ten_may?.trim() || machineCode,
        projectId,
        projectName,
        personInChargeId,
        personInChargeName,
        weldMethod,
        weldType,
        shifts: new Set<string>(),
        weldCount: 0,
        failedWeldCount: 0,
        journalEntryCount: 0,
      };
      groups.set(key, acc);
    }

    acc.shifts.add(resolveWeldShift(row));
    acc.weldCount += Number(row.so_luong_thuc_hien) || 0;
    acc.failedWeldCount += Number(row.so_luong_loi) || 0;
    acc.journalEntryCount += 1;
    if (!acc.machineName && row.ten_may) acc.machineName = row.ten_may.trim();
  });

  return Array.from(groups.values())
    .map((acc) => {
      const shifts = Array.from(acc.shifts).sort((a, b) => a.localeCompare(b, "vi"));
      const shiftCount = Math.max(shifts.length, 1);
      const operatingHours = shiftCount * HOURS_PER_WELD_SHIFT;
      return {
        id: `journal:${acc.date}:${acc.machineId}:${acc.projectId}:${acc.personInChargeId}:${acc.weldMethod}:${acc.weldType}`,
        date: acc.date,
        machineId: acc.machineId,
        machineCode: acc.machineCode,
        machineName: acc.machineName,
        location: "—",
        operatingHours,
        projectId: acc.projectId,
        projectName: acc.projectName,
        personInChargeId: acc.personInChargeId,
        personInChargeName: acc.personInChargeName,
        fuelAddedLiters: 0,
        pumpOpened: false,
        machineCondition: acc.failedWeldCount > 0 ? "Có mối lỗi" : "Bình thường",
        conditionDescription: `${acc.weldCount} mối · ${acc.failedWeldCount} lỗi · ${acc.journalEntryCount} bản ghi nhật ký`,
        recommendation: shifts.length ? `Ca: ${shifts.join(", ")}` : "",
        imageAssets: [],
        source: "journal" as const,
        weldCount: acc.weldCount,
        failedWeldCount: acc.failedWeldCount,
        shifts,
        journalEntryCount: acc.journalEntryCount,
        weldMethod: acc.weldMethod,
        weldType: acc.weldType,
      } satisfies MachineRunSchedule;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.machineCode.localeCompare(b.machineCode, "vi"));
}

function seedBundle(error?: string): MachineRunScheduleBundle {
  return {
    schedules: seedSchedules.map((row) => ({ ...row, source: "manual" as const })),
    machines: seedMachines.map((machine) => ({
      id: `seed-${machine.code.toLowerCase()}`,
      code: machine.code,
      name: machine.name,
    })),
    projects: seedProjects.map((project) => ({ id: `seed-project-${project.id}`, label: project.name })),
    personnel: [],
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

/** Bundle lịch chạy máy — tổng hợp từ nhật ký hàn (không nhập tay). */
export async function loadMachineRunScheduleBundle(): Promise<MachineRunScheduleBundle> {
  if (!isSupabaseConfigured()) return seedBundle("Chưa cấu hình Supabase");

  const supabase = createClient();
  try {
    const [journalRows, machineResult, projectResult, personnelResult] = await Promise.all([
      loadWeldReportRows(undefined, undefined, { mode: "full" }),
      supabase.from("thiet_bi").select("id,ma_may,ten_may").order("ma_may", { ascending: true }),
      supabase.from("du_an").select("id,du_an").order("du_an", { ascending: true }),
      supabase.from("nhan_su").select("employee_id,ho_ten").order("ho_ten", { ascending: true }),
    ]);

    const lookupError = machineResult.error ?? projectResult.error ?? personnelResult.error;
    if (lookupError) throw lookupError;

    const machines = ((machineResult.data ?? []) as EquipmentRow[]).map((row) => ({
      id: row.id,
      code: row.ma_may,
      name: row.ten_may,
    }));
    const machineById = new Map(machines.map((m) => [m.id, m]));
    const machineByCode = new Map(machines.map((m) => [m.code.toLowerCase(), m]));

    const schedules = aggregateWeldJournalToSchedules(journalRows).map((row) => {
      const fromId = machineById.get(row.machineId);
      const fromCode = machineByCode.get(row.machineCode.toLowerCase());
      const machine = fromId ?? fromCode;
      if (!machine) return row;
      return {
        ...row,
        machineId: machine.id,
        machineCode: machine.code,
        machineName: machine.name || row.machineName,
      };
    });

    const knownIds = new Set(machines.map((m) => m.id));
    for (const row of schedules) {
      if (!knownIds.has(row.machineId)) {
        machines.push({ id: row.machineId, code: row.machineCode, name: row.machineName });
        knownIds.add(row.machineId);
      }
    }

    const projects = ((projectResult.data ?? []) as ProjectRow[]).map((row) => ({
      id: row.id,
      label: row.du_an,
    }));
    const knownProjects = new Set(projects.map((p) => p.id));
    for (const row of schedules) {
      if (row.projectId && !knownProjects.has(row.projectId)) {
        projects.push({ id: row.projectId, label: row.projectName });
        knownProjects.add(row.projectId);
      }
    }

    const personnel = ((personnelResult.data ?? []) as PersonnelRow[]).map((row) => ({
      id: row.employee_id,
      label: row.ho_ten,
    }));
    const knownPeople = new Set(personnel.map((p) => p.id));
    for (const row of schedules) {
      if (row.personInChargeId && !knownPeople.has(row.personInChargeId)) {
        personnel.push({ id: row.personInChargeId, label: row.personInChargeName });
        knownPeople.add(row.personInChargeId);
      }
    }

    return {
      schedules,
      machines,
      projects,
      personnel,
      source: "supabase",
    };
  } catch (error) {
    return seedBundle(formatSupabaseError(error));
  }
}

export async function insertMachineRunSchedule(_values: MachineRunScheduleFormValues) {
  throw new Error("Lịch chạy máy chỉ tổng hợp từ nhật ký hàn — không thêm thủ công.");
}

export async function updateMachineRunSchedule(_id: string, _values: MachineRunScheduleFormValues) {
  throw new Error("Lịch chạy máy chỉ tổng hợp từ nhật ký hàn — không sửa thủ công.");
}

export async function deleteMachineRunSchedule(_id: string) {
  throw new Error("Lịch chạy máy chỉ tổng hợp từ nhật ký hàn — không xóa thủ công.");
}
