import { createClient } from "@/lib/supabase/client";
import { projects as seedProjects, type Project } from "@/data/projects";
import type { ProjectMetadata, ProjectMetadataStore } from "@/data/projectMetadata";
import { deleteProjectMetadata, loadProjectMetadata, saveProjectMetadata } from "@/lib/projectMetadataClient";

/** Một dòng tiến độ lý thuyết trong JSONB bảng du_an. */
export type TheoreticalProgressRow = {
  ngay: string;
  so_moi_han: number;
};

/** Dòng phẳng để hiển thị bảng: Ngày · Dự án · Số mối hàn */
export type TheoreticalProgressViewRow = TheoreticalProgressRow & {
  du_an_id: string;
  du_an: string;
};

export type DuAnRow = {
  id: string;
  ma_du_an: string | null;
  du_an: string;
  nguoi_phu_trach: string | null;
  vi_tri?: string | null;
  ngay_bat_dau?: string | null;
  ngay_ket_thuc?: string | null;
  tong_moi_han_du_kien?: number | null;
  tien_do_ly_thuyet: unknown;
  created_at: string;
  updated_at: string;
};

const DU_AN_COLUMNS_BASE = "id,ma_du_an,du_an,nguoi_phu_trach,tien_do_ly_thuyet,created_at,updated_at";
const DU_AN_COLUMNS = `${DU_AN_COLUMNS_BASE},vi_tri,ngay_bat_dau,ngay_ket_thuc,tong_moi_han_du_kien`;

let projectsPromise: Promise<{ projects: Project[]; source: "supabase" | "seed"; error?: string }> | null =
  null;

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export function normalizeTheoreticalProgress(raw: unknown): TheoreticalProgressRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const ngay = typeof row.ngay === "string" ? row.ngay.slice(0, 10) : "";
      const so_moi_han = Number(row.so_moi_han);
      if (!ngay || !Number.isFinite(so_moi_han) || so_moi_han < 0) return null;
      return { ngay, so_moi_han: Math.round(so_moi_han) };
    })
    .filter((row): row is TheoreticalProgressRow => row !== null)
    .sort((a, b) => a.ngay.localeCompare(b.ngay));
}

export function projectDurationDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

function toIsoDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeOffDays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(
    raw
      .map((item) => (typeof item === "string" ? item.slice(0, 10) : ""))
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)),
  )].sort();
}

export function clampOffDaysToRange(offDays: string[], startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return normalizeOffDays(offDays);
  return normalizeOffDays(offDays).filter((day) => day >= startDate && day <= endDate);
}

export function projectWorkingDays(
  startDate: string,
  endDate: string,
  offDays: string[] = [],
): number {
  const total = projectDurationDays(startDate, endDate);
  if (total <= 0) return 0;
  const offInRange = clampOffDaysToRange(offDays, startDate, endDate).length;
  return Math.max(0, total - offInRange);
}

/** Chia đều tổng mối hàn theo ngày làm việc; ngày nghỉ = 0. Phần dư cộng từ ngày làm việc đầu. */
export function buildDailyWeldPlan(
  totalWelds: number,
  startDate: string,
  endDate: string,
  offDays: string[] = [],
): TheoreticalProgressRow[] {
  const days = projectDurationDays(startDate, endDate);
  const total = Math.max(0, Math.round(totalWelds || 0));
  if (days <= 0) return [];

  const offSet = new Set(clampOffDaysToRange(offDays, startDate, endDate));
  const start = new Date(`${startDate}T00:00:00`);
  const allDates = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return toIsoDateLocal(date);
  });
  const workDates = allDates.filter((ngay) => !offSet.has(ngay));

  if (workDates.length === 0 || total <= 0) {
    return allDates.map((ngay) => ({ ngay, so_moi_han: 0 }));
  }

  const base = Math.floor(total / workDates.length);
  const remainder = total % workDates.length;
  let workIndex = 0;
  return allDates.map((ngay) => {
    if (offSet.has(ngay)) return { ngay, so_moi_han: 0 };
    const so_moi_han = base + (workIndex < remainder ? 1 : 0);
    workIndex += 1;
    return { ngay, so_moi_han };
  });
}

function hydrateProjectPlan(project: Project): Project {
  const offDays = clampOffDaysToRange(project.offDays ?? [], project.startDate, project.endDate);
  if (project.theoreticalProgress?.length) {
    return { ...project, offDays };
  }
  return {
    ...project,
    offDays,
    theoreticalProgress: buildDailyWeldPlan(
      project.plannedWeldCount,
      project.startDate,
      project.endDate,
      offDays,
    ),
  };
}

const CANONICAL_RAIL_CODES = ["CR100", "60R2", "60E1", "60N", "50N", "P50"];

export function inferRailTypesFromName(name: string): string[] {
  const upper = name.toUpperCase();
  return CANONICAL_RAIL_CODES.filter((code) => upper.includes(code));
}

export function duAnRowToProject(row: DuAnRow, managerName = "", metadata?: ProjectMetadata): Project {
  const existingProgress = normalizeTheoreticalProgress(row.tien_do_ly_thuyet);
  const startDate = row.ngay_bat_dau?.slice(0, 10) || existingProgress[0]?.ngay || row.created_at.slice(0, 10);
  const endDate = row.ngay_ket_thuc?.slice(0, 10) || existingProgress.at(-1)?.ngay || startDate;
  const plannedWeldCount = Math.max(
    0,
    Math.round(
      Number(row.tong_moi_han_du_kien) ||
        existingProgress.reduce((sum, item) => sum + item.so_moi_han, 0),
    ),
  );
  const fallbackRails = inferRailTypesFromName(row.du_an);
  const fallbackPersonnel = row.nguoi_phu_trach ? [row.nguoi_phu_trach] : [];
  const personnelIds = metadata?.personnelIds?.length ? metadata.personnelIds : fallbackPersonnel;
  const railTypes = metadata?.railTypes?.length ? metadata.railTypes : fallbackRails;
  const offDays = clampOffDaysToRange(metadata?.offDays ?? [], startDate, endDate);

  return {
    id: row.id,
    name: row.du_an,
    manager: managerName,
    managerId: row.nguoi_phu_trach ?? undefined,
    plant: "",
    staffCount: personnelIds.length,
    machineCount: (metadata?.machineTypes ?? []).length,
    status: metadata?.status ?? "Đang triển khai",
    startDate,
    endDate,
    location: row.vi_tri?.trim() || "here",
    plannedWeldCount,
    personnelIds,
    machineTypes: metadata?.machineTypes ?? [],
    weldTypes: metadata?.weldTypes ?? [],
    railTypes,
    offDays,
    theoreticalProgress:
      existingProgress.length > 0
        ? existingProgress
        : buildDailyWeldPlan(plannedWeldCount, startDate, endDate, offDays),
    maDuAn: row.ma_du_an ?? undefined,
  };
}

export function flattenTheoreticalProgress(projects: Project[]): TheoreticalProgressViewRow[] {
  return projects
    .flatMap((project) =>
      (project.theoreticalProgress ?? []).map((row) => ({
        ...row,
        du_an_id: project.id,
        du_an: project.name,
      })),
    )
    .sort((a, b) => b.ngay.localeCompare(a.ngay) || a.du_an.localeCompare(b.du_an, "vi"));
}

/** Tổng mối hàn dự kiến — cộng cột Số mối hàn trong tiến độ lý thuyết. */
export function sumTheoreticalWelds(project: Pick<Project, "theoreticalProgress">): number {
  return (project.theoreticalProgress ?? []).reduce((sum, row) => sum + row.so_moi_han, 0);
}

export function loadProjects() {
  if (!projectsPromise) {
    projectsPromise = fetchProjects().catch((error) => {
      projectsPromise = null;
      throw error;
    });
  }
  return projectsPromise;
}

export function invalidateProjectsCache() {
  projectsPromise = null;
}

async function fetchProjects() {
  if (!hasSupabaseEnv()) {
    return {
      projects: seedProjects.map(hydrateProjectPlan),
      source: "seed" as const,
      error: "Chưa cấu hình Supabase env",
    };
  }

  const supabase = createClient();
  const primaryResult = await supabase
    .from("du_an")
    .select(DU_AN_COLUMNS)
    .order("du_an", { ascending: true });
  let data: unknown[] | null = primaryResult.data;
  let error = primaryResult.error;

  if (error && (error.message.includes("column") || error.code === "42703" || error.code === "PGRST204")) {
    const legacyFallback = await supabase
      .from("du_an")
      .select(DU_AN_COLUMNS_BASE)
      .order("du_an", { ascending: true });
    data = legacyFallback.data as unknown[] | null;
    error = legacyFallback.error;
  }

  if (error) {
    return {
      projects: seedProjects.map(hydrateProjectPlan),
      source: "seed" as const,
      error: error.message,
    };
  }

  if (!data?.length) {
    return { projects: [], source: "supabase" as const };
  }

  const [{ data: personnelRows }, metadata] = await Promise.all([
    supabase.from("nhan_su").select("employee_id,ho_ten"),
    loadProjectMetadata().catch(() => ({} as ProjectMetadataStore)),
  ]);
  const managerNames = new Map(
    (personnelRows ?? []).map((person) => [String(person.employee_id), String(person.ho_ten ?? "")]),
  );

  return {
    projects: (data as DuAnRow[]).map((row) =>
      duAnRowToProject(
        row,
        row.nguoi_phu_trach ? managerNames.get(row.nguoi_phu_trach) ?? "" : "",
        metadata[row.id],
      ),
    ),
    source: "supabase" as const,
  };
}

export async function saveTheoreticalProgress(
  projectId: string,
  rows: TheoreticalProgressRow[],
): Promise<{ error?: string }> {
  if (!hasSupabaseEnv()) {
    return { error: "Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL / ANON_KEY" };
  }

  const normalized = normalizeTheoreticalProgress(rows);
  const tong = normalized.reduce((sum, row) => sum + row.so_moi_han, 0);
  const ngayBatDau = normalized[0]?.ngay;
  const ngayKetThuc = normalized.at(-1)?.ngay;
  const supabase = createClient();

  // Cập nhật khung ngày + tổng trước (trigger có thể tạo kế hoạch tạm).
  if (ngayBatDau && ngayKetThuc) {
    const { error: metaError } = await supabase
      .from("du_an")
      .update({
        ngay_bat_dau: ngayBatDau,
        ngay_ket_thuc: ngayKetThuc,
        tong_moi_han_du_kien: tong,
      })
      .eq("id", projectId);
    if (metaError) return { error: metaError.message };
  }

  // Ghi đè đúng tiến độ từ Excel / nguồn ngoài (không đụng trigger chia đều).
  const { error } = await supabase
    .from("du_an")
    .update({
      tien_do_ly_thuyet: normalized,
      tong_moi_han_du_kien: tong,
    })
    .eq("id", projectId);

  if (error) return { error: error.message };
  invalidateProjectsCache();
  return {};
}

export async function insertDuAn(payload: {
  name: string;
  maDuAn?: string;
  manager: string;
  managerId?: string;
  location: string;
  startDate: string;
  endDate: string;
  plannedWeldCount: number;
  status?: Project["status"];
  personnelIds?: string[];
  machineTypes?: string[];
  weldTypes?: string[];
  railTypes?: string[];
  offDays?: string[];
}): Promise<{ project?: Project; error?: string }> {
  if (!hasSupabaseEnv()) {
    return { error: "Chưa cấu hình Supabase env" };
  }

  const name = payload.name.trim();
  if (!name) return { error: "Vui lòng nhập tên dự án" };

  const offDays = clampOffDaysToRange(payload.offDays ?? [], payload.startDate, payload.endDate);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("du_an")
    .insert({
      du_an: name,
      ma_du_an: payload.maDuAn?.trim() || null,
      nguoi_phu_trach: payload.managerId || null,
      vi_tri: payload.location.trim(),
      ngay_bat_dau: payload.startDate,
      ngay_ket_thuc: payload.endDate,
      tong_moi_han_du_kien: Math.max(0, Math.round(payload.plannedWeldCount)),
      tien_do_ly_thuyet: buildDailyWeldPlan(
        payload.plannedWeldCount,
        payload.startDate,
        payload.endDate,
        offDays,
      ),
    })
    .select(DU_AN_COLUMNS)
    .single();

  if (error) return { error: error.message };
  const metadata: ProjectMetadata = {
    status: payload.status ?? "Đang triển khai",
    personnelIds: payload.personnelIds ?? [],
    machineTypes: payload.machineTypes ?? [],
    weldTypes: payload.weldTypes ?? [],
    railTypes: payload.railTypes ?? [],
    offDays,
  };
  try {
    await saveProjectMetadata(String(data.id), metadata);
  } catch (metadataError) {
    console.warn("Could not save project metadata:", metadataError);
  }
  invalidateProjectsCache();
  return {
    project: duAnRowToProject(data as DuAnRow, payload.manager.trim(), metadata),
  };
}

export async function updateDuAn(
  projectId: string,
  patch: {
    name?: string;
    manager?: string;
    managerId?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    plannedWeldCount?: number;
    status?: Project["status"];
    personnelIds?: string[];
    machineTypes?: string[];
    weldTypes?: string[];
    railTypes?: string[];
    offDays?: string[];
  },
): Promise<{ project?: Project; error?: string }> {
  if (!hasSupabaseEnv()) {
    return { error: "Chưa cấu hình Supabase env" };
  }

  const body: Record<string, string | number | TheoreticalProgressRow[] | null> = {};
  if (patch.name !== undefined) body.du_an = patch.name.trim();
  if (patch.managerId !== undefined) body.nguoi_phu_trach = patch.managerId || null;
  if (patch.location !== undefined) body.vi_tri = patch.location.trim();
  if (patch.startDate !== undefined) body.ngay_bat_dau = patch.startDate;
  if (patch.endDate !== undefined) body.ngay_ket_thuc = patch.endDate;
  if (patch.plannedWeldCount !== undefined) {
    body.tong_moi_han_du_kien = Math.max(0, Math.round(patch.plannedWeldCount));
  }

  const offDays =
    patch.startDate !== undefined && patch.endDate !== undefined
      ? clampOffDaysToRange(patch.offDays ?? [], patch.startDate, patch.endDate)
      : normalizeOffDays(patch.offDays);

  if (
    patch.startDate !== undefined &&
    patch.endDate !== undefined &&
    patch.plannedWeldCount !== undefined
  ) {
    body.tien_do_ly_thuyet = buildDailyWeldPlan(
      patch.plannedWeldCount,
      patch.startDate,
      patch.endDate,
      offDays,
    );
  }

  const supabase = createClient();
  let updatedRow: DuAnRow | null = null;
  if (Object.keys(body).length > 0) {
    const { data, error } = await supabase
      .from("du_an")
      .update(body)
      .eq("id", projectId)
      .select(DU_AN_COLUMNS)
      .single();

    if (error) return { error: error.message };
    updatedRow = data as DuAnRow;
  } else {
    const { data, error } = await supabase
      .from("du_an")
      .select(DU_AN_COLUMNS)
      .eq("id", projectId)
      .single();
    if (error) return { error: error.message };
    updatedRow = data as DuAnRow;
  }

  const metadata: ProjectMetadata = {
    status: patch.status ?? "Đang triển khai",
    personnelIds: patch.personnelIds ?? [],
    machineTypes: patch.machineTypes ?? [],
    weldTypes: patch.weldTypes ?? [],
    railTypes: patch.railTypes ?? [],
    offDays,
  };
  try {
    await saveProjectMetadata(projectId, metadata);
  } catch (metadataError) {
    console.warn("Could not save project metadata:", metadataError);
  }
  invalidateProjectsCache();
  return { project: duAnRowToProject(updatedRow, patch.manager?.trim() ?? "", metadata) };
}

export async function deleteDuAn(projectId: string): Promise<{ error?: string }> {
  if (!hasSupabaseEnv()) {
    return { error: "Chưa cấu hình Supabase env" };
  }

  const supabase = createClient();
  const { error } = await supabase.from("du_an").delete().eq("id", projectId);
  if (error) return { error: error.message };
  try {
    await deleteProjectMetadata(projectId);
  } catch (metadataError) {
    console.warn("Could not delete project metadata:", metadataError);
  }
  invalidateProjectsCache();
  return {};
}
