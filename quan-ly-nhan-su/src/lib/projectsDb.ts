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
  tien_do_ly_thuyet: unknown;
  created_at: string;
  updated_at: string;
};

const DU_AN_COLUMNS = "id,ma_du_an,du_an,nguoi_phu_trach,tien_do_ly_thuyet,created_at,updated_at";

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

export function duAnRowToProject(row: DuAnRow): Project {
  return {
    id: row.id,
    name: row.du_an,
    manager: row.nguoi_phu_trach ?? "",
    plant: "",
    staffCount: 0,
    machineCount: 0,
    status: "Đang triển khai",
    startDate: row.created_at.slice(0, 10),
    personnelIds: [],
    machineTypes: [],
    weldTypes: [],
    theoreticalProgress: normalizeTheoreticalProgress(row.tien_do_ly_thuyet),
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
    return { projects: seedProjects, source: "seed" as const, error: "Chưa cấu hình Supabase env" };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("du_an")
    .select(DU_AN_COLUMNS)
    .order("du_an", { ascending: true });

  if (error) {
    return { projects: seedProjects, source: "seed" as const, error: error.message };
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
      tien_do_ly_thuyet: [],
    })
    .select(DU_AN_COLUMNS)
    .single();

  if (error) return { error: error.message };
  invalidateProjectsCache();
  return { project: duAnRowToProject(data as DuAnRow) };
}

export async function updateDuAn(
  projectId: string,
  patch: { name?: string },
): Promise<{ project?: Project; error?: string }> {
  if (!hasSupabaseEnv()) {
    return { error: "Chưa cấu hình Supabase env" };
  }

  const body: Record<string, string> = {};
  if (patch.name !== undefined) body.du_an = patch.name.trim();

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
