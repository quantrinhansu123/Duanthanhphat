import { createClient } from "@/lib/supabase/client";
import { projects as seedProjects, type Project } from "@/data/projects";

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

/** Chia đều tổng mối hàn theo số ngày; phần dư được cộng từ ngày đầu tiên. */
export function buildDailyWeldPlan(
  totalWelds: number,
  startDate: string,
  endDate: string,
): TheoreticalProgressRow[] {
  const days = projectDurationDays(startDate, endDate);
  const total = Math.max(0, Math.round(totalWelds || 0));
  if (days <= 0 || total <= 0) return [];

  const base = Math.floor(total / days);
  const remainder = total % days;
  const start = new Date(`${startDate}T00:00:00`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return {
      ngay: toIsoDateLocal(date),
      so_moi_han: base + (index < remainder ? 1 : 0),
    };
  });
}

function hydrateProjectPlan(project: Project): Project {
  if (project.theoreticalProgress?.length) return project;
  return {
    ...project,
    theoreticalProgress: buildDailyWeldPlan(
      project.plannedWeldCount,
      project.startDate,
      project.endDate,
    ),
  };
}

export function duAnRowToProject(row: DuAnRow): Project {
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
  return {
    id: row.id,
    name: row.du_an,
    manager: row.nguoi_phu_trach ?? "",
    plant: "",
    staffCount: 0,
    machineCount: 0,
    status: "Đang triển khai",
    startDate,
    endDate,
    location: row.vi_tri?.trim() || "Chưa cập nhật",
    plannedWeldCount,
    personnelIds: [],
    machineTypes: [],
    weldTypes: [],
    theoreticalProgress:
      existingProgress.length > 0
        ? existingProgress
        : buildDailyWeldPlan(plannedWeldCount, startDate, endDate),
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
    const fallback = await supabase
      .from("du_an")
      .select(DU_AN_COLUMNS_BASE)
      .order("du_an", { ascending: true });
    data = fallback.data as unknown[] | null;
    error = fallback.error;
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

  return {
    projects: (data as DuAnRow[]).map(duAnRowToProject),
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
  const supabase = createClient();
  const { error } = await supabase
    .from("du_an")
    .update({ tien_do_ly_thuyet: normalized })
    .eq("id", projectId);

  if (error) return { error: error.message };
  invalidateProjectsCache();
  return {};
}

export async function insertDuAn(payload: {
  name: string;
  maDuAn?: string;
  location: string;
  startDate: string;
  endDate: string;
  plannedWeldCount: number;
}): Promise<{ project?: Project; error?: string }> {
  if (!hasSupabaseEnv()) {
    return { error: "Chưa cấu hình Supabase env" };
  }

  const name = payload.name.trim();
  if (!name) return { error: "Vui lòng nhập tên dự án" };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("du_an")
    .insert({
      du_an: name,
      ma_du_an: payload.maDuAn?.trim() || null,
      vi_tri: payload.location.trim(),
      ngay_bat_dau: payload.startDate,
      ngay_ket_thuc: payload.endDate,
      tong_moi_han_du_kien: Math.max(0, Math.round(payload.plannedWeldCount)),
      tien_do_ly_thuyet: buildDailyWeldPlan(
        payload.plannedWeldCount,
        payload.startDate,
        payload.endDate,
      ),
    })
    .select(DU_AN_COLUMNS)
    .single();

  if (error) return { error: error.message };
  invalidateProjectsCache();
  return { project: duAnRowToProject(data as DuAnRow) };
}

export async function updateDuAn(
  projectId: string,
  patch: {
    name?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    plannedWeldCount?: number;
  },
): Promise<{ project?: Project; error?: string }> {
  if (!hasSupabaseEnv()) {
    return { error: "Chưa cấu hình Supabase env" };
  }

  const body: Record<string, string | number | TheoreticalProgressRow[]> = {};
  if (patch.name !== undefined) body.du_an = patch.name.trim();
  if (patch.location !== undefined) body.vi_tri = patch.location.trim();
  if (patch.startDate !== undefined) body.ngay_bat_dau = patch.startDate;
  if (patch.endDate !== undefined) body.ngay_ket_thuc = patch.endDate;
  if (patch.plannedWeldCount !== undefined) {
    body.tong_moi_han_du_kien = Math.max(0, Math.round(patch.plannedWeldCount));
  }

  if (
    patch.startDate !== undefined &&
    patch.endDate !== undefined &&
    patch.plannedWeldCount !== undefined
  ) {
    body.tien_do_ly_thuyet = buildDailyWeldPlan(
      patch.plannedWeldCount,
      patch.startDate,
      patch.endDate,
    );
  }

  if (Object.keys(body).length === 0) {
    return { error: "Không có thay đổi để lưu" };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("du_an")
    .update(body)
    .eq("id", projectId)
    .select(DU_AN_COLUMNS)
    .single();

  if (error) return { error: error.message };
  invalidateProjectsCache();
  return { project: duAnRowToProject(data as DuAnRow) };
}

export async function deleteDuAn(projectId: string): Promise<{ error?: string }> {
  if (!hasSupabaseEnv()) {
    return { error: "Chưa cấu hình Supabase env" };
  }

  const supabase = createClient();
  const { error } = await supabase.from("du_an").delete().eq("id", projectId);
  if (error) return { error: error.message };
  invalidateProjectsCache();
  return {};
}
