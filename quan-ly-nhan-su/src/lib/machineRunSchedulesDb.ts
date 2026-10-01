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

type EquipmentRow = { id: string; ma_may: string; ten_may: string; thong_so?: unknown };
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

function readOilQuota(thongSo: unknown): number | null {
  if (!thongSo || typeof thongSo !== "object") return null;
  const raw = (thongSo as Record<string, unknown>).oilQuota;
  const value = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AssignmentDbRow = {
  id: string;
  ngay: string;
  may_id: string | null;
  ma_may: string;
  ten_may: string | null;
  du_an_id: string | null;
  ten_du_an: string | null;
  tho_han_id: string | null;
  ten_tho_han: string | null;
  cong_nghe_han: string | null;
  loai_moi_han: string | null;
  ca: string[] | null;
  so_moi_han: number | null;
  so_moi_loi: number | null;
  so_ban_ghi: number | null;
};

function asUuid(value: string) {
  return UUID_RE.test(value) ? value : null;
}

function assignmentGroupKey(row: {
  date: string;
  machineCode: string;
  projectId: string;
  personInChargeId: string;
  weldMethod?: string;
  weldType?: string;
}) {
  return [
    row.date,
    row.machineCode,
    row.projectId,
    row.personInChargeId,
    row.weldMethod || "",
    row.weldType || "",
  ].join("|");
}

function missingAssignmentTableMessage(error: unknown) {
  const message = formatSupabaseError(error);
  if (/phan_cong_may|schema cache|42P01|PGRST205/i.test(message)) {
    return "Chưa có bảng phan_cong_may. Chạy supabase/migration_20261001_phan_cong_may.sql trên Supabase.";
  }
  return message;
}

function mapAssignmentRow(row: AssignmentDbRow): MachineRunSchedule {
  const shifts = row.ca ?? [];
  const weldCount = Number(row.so_moi_han) || 0;
  const failedWeldCount = Number(row.so_moi_loi) || 0;
  const machineCode = row.ma_may || "Chưa gán máy";
  return {
    id: row.id,
    date: String(row.ngay).slice(0, 10),
    machineId: row.may_id || `code:${machineCode}`,
    machineCode,
    machineName: row.ten_may || machineCode,
    location: "—",
    operatingHours: Math.max(shifts.length, 1) * HOURS_PER_WELD_SHIFT,
    projectId: row.du_an_id || "",
    projectName: row.ten_du_an || "Chưa gắn dự án",
    personInChargeId: row.tho_han_id || "",
    personInChargeName: row.ten_tho_han || "Chưa xác định",
    fuelAddedLiters: 0,
    pumpOpened: false,
    machineCondition: failedWeldCount > 0 ? "Có mối lỗi" : "Bình thường",
    conditionDescription: `${weldCount} mối · ${failedWeldCount} lỗi · ${Number(row.so_ban_ghi) || 0} bản ghi nhật ký`,
    recommendation: shifts.length ? `Ca: ${shifts.join(", ")}` : "",
    imageAssets: [],
    source: "journal",
    weldCount,
    failedWeldCount,
    shifts,
    journalEntryCount: Number(row.so_ban_ghi) || 0,
    weldMethod: row.cong_nghe_han || "—",
    weldType: row.loai_moi_han || "—",
  };
}

/** Danh sách đã lưu trong phan_cong_may. Không tổng hợp nhật ký khi mở trang. */
export async function loadMachineRunScheduleBundle(): Promise<MachineRunScheduleBundle> {
  if (!isSupabaseConfigured()) return seedBundle("Chưa cấu hình Supabase");

  const supabase = createClient();
  try {
    const [assignmentResult, machineResult, projectResult, personnelResult] = await Promise.all([
      supabase
        .from("phan_cong_may")
        .select("id,ngay,may_id,ma_may,ten_may,du_an_id,ten_du_an,tho_han_id,ten_tho_han,cong_nghe_han,loai_moi_han,ca,so_moi_han,so_moi_loi,so_ban_ghi")
        .order("ngay", { ascending: false }),
      supabase.from("thiet_bi").select("id,ma_may,ten_may,thong_so").order("ma_may", { ascending: true }),
      supabase.from("du_an").select("id,du_an").order("du_an", { ascending: true }),
      supabase.from("nhan_su").select("employee_id,ho_ten").order("ho_ten", { ascending: true }),
    ]);

    const lookupError = machineResult.error ?? projectResult.error ?? personnelResult.error;
    if (lookupError) throw lookupError;

    const machines = ((machineResult.data ?? []) as EquipmentRow[]).map((row) => ({
      id: row.id,
      code: row.ma_may,
      name: row.ten_may,
      oilQuota: readOilQuota(row.thong_so),
    }));
    const projects = ((projectResult.data ?? []) as ProjectRow[]).map((row) => ({
      id: row.id,
      label: row.du_an,
    }));
    const personnel = ((personnelResult.data ?? []) as PersonnelRow[]).map((row) => ({
      id: row.employee_id,
      label: row.ho_ten,
    }));

    if (assignmentResult.error) {
      return {
        schedules: [],
        machines,
        projects,
        personnel,
        source: "supabase",
        error: missingAssignmentTableMessage(assignmentResult.error),
      };
    }

    const machineById = new Map(machines.map((machine) => [machine.id, machine]));
    const schedules = ((assignmentResult.data ?? []) as AssignmentDbRow[]).map((row) => {
      const schedule = mapAssignmentRow(row);
      const machine = schedule.machineId ? machineById.get(schedule.machineId) : undefined;
      if (!machine) return schedule;
      return {
        ...schedule,
        machineCode: machine.code,
        machineName: machine.name || schedule.machineName,
      };
    });

    return { schedules, machines, projects, personnel, source: "supabase" };
  } catch (error) {
    return {
      schedules: [],
      machines: [],
      projects: [],
      personnel: [],
      source: "supabase",
      error: formatSupabaseError(error),
    };
  }
}

/** Tổng hợp nhật ký hàn trong khoảng ngày và ghi vào phan_cong_may. */
export async function importMachineRunReport(dateFrom: string, dateTo: string) {
  if (!isSupabaseConfigured()) throw new Error("Chưa cấu hình Supabase");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    throw new Error("Chọn từ ngày và đến ngày.");
  }
  if (dateFrom > dateTo) throw new Error("Từ ngày phải trước hoặc bằng đến ngày.");

  const supabase = createClient();
  const [journalRows, machineResult] = await Promise.all([
    loadWeldReportRows(dateFrom, dateTo, { mode: "full" }),
    supabase.from("thiet_bi").select("id,ma_may,ten_may"),
  ]);
  if (machineResult.error) throw new Error(formatSupabaseError(machineResult.error));

  const machines = ((machineResult.data ?? []) as EquipmentRow[]).map((row) => ({
    id: row.id,
    code: row.ma_may,
    name: row.ten_may,
  }));
  const machineById = new Map(machines.map((machine) => [machine.id, machine]));
  const machineByCode = new Map(machines.map((machine) => [machine.code.toLowerCase(), machine]));

  const schedules = aggregateWeldJournalToSchedules(journalRows)
    .filter((row) => row.date >= dateFrom && row.date <= dateTo)
    .map((row) => {
      const machine = machineById.get(row.machineId) ?? machineByCode.get(row.machineCode.toLowerCase());
      if (!machine) return row;
      return {
        ...row,
        machineId: machine.id,
        machineCode: machine.code,
        machineName: machine.name || row.machineName,
      };
    });

  const { error: deleteError } = await supabase
    .from("phan_cong_may")
    .delete()
    .gte("ngay", dateFrom)
    .lte("ngay", dateTo);
  if (deleteError) throw new Error(missingAssignmentTableMessage(deleteError));

  const payload = schedules.map((row) => ({
    ngay: row.date,
    may_id: asUuid(row.machineId),
    ma_may: row.machineCode || "Chưa gán máy",
    ten_may: row.machineName || row.machineCode || "",
    du_an_id: asUuid(row.projectId),
    ten_du_an: row.projectName || "",
    tho_han_id: asUuid(row.personInChargeId),
    ten_tho_han: row.personInChargeName || "",
    cong_nghe_han: row.weldMethod || "",
    loai_moi_han: row.weldType || "",
    ca: row.shifts ?? [],
    so_moi_han: row.weldCount ?? 0,
    so_moi_loi: row.failedWeldCount ?? 0,
    so_ban_ghi: row.journalEntryCount ?? 0,
    nhom: assignmentGroupKey(row),
  }));

  const batchSize = 200;
  for (let offset = 0; offset < payload.length; offset += batchSize) {
    const { error } = await supabase.from("phan_cong_may").insert(payload.slice(offset, offset + batchSize));
    if (error) throw new Error(missingAssignmentTableMessage(error));
  }

  return payload.length;
}

/** Nhật ký hàn thuộc đúng một dòng phân công đã lưu. */
export async function loadScheduleJournalDetails(schedule: MachineRunSchedule): Promise<WeldReportRow[]> {
  if (!isSupabaseConfigured()) throw new Error("Chưa cấu hình Supabase");
  const supabase = createClient();
  const pageSize = 1000;
  const rows: WeldReportRow[] = [];

  for (let from = 0; from < 20000; from += pageSize) {
    let request = supabase
      .from("bao_cao_moi_han_theo_du_an")
      .select("id,ma_lich_su,du_an_id,du_an,ngay_thuc_hien,loai_moi_han,cong_nghe_han,so_luong_thuc_hien,so_luong_loi,tho_han_id,ten_tho_han,may_id,ma_may,ten_may,ca_han,tinh_trang_thi_nghiem,nguyen_nhan_loi")
      .eq("ngay_thuc_hien", schedule.date)
      .order("ma_lich_su", { ascending: true })
      .range(from, from + pageSize - 1);

    if (schedule.projectId) request = request.eq("du_an_id", schedule.projectId);
    if (schedule.personInChargeId) request = request.eq("tho_han_id", schedule.personInChargeId);
    if (schedule.weldMethod && schedule.weldMethod !== "—") request = request.eq("cong_nghe_han", schedule.weldMethod);
    if (schedule.weldType && schedule.weldType !== "—") request = request.eq("loai_moi_han", schedule.weldType);

    const { data, error } = await request;
    if (error) throw new Error(formatSupabaseError(error));
    const chunk = (data ?? []) as WeldReportRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }

  return rows.filter((row) => {
    const machineCode = row.ma_may?.trim() || "Chưa gán máy";
    if (schedule.machineId && !schedule.machineId.startsWith("code:")) {
      return row.may_id === schedule.machineId || machineCode === schedule.machineCode;
    }
    return machineCode === schedule.machineCode;
  });
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
