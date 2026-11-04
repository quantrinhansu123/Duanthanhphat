import type { ProjectEquipment } from "@/lib/projectEquipment";

/**
 * Cache theo phiên: trang Báo cáo ngày gọi hàm này ở mỗi lần đổi ngày/dự án và sau mỗi lần lưu,
 * mỗi lượt trước đây tốn 1–5 giây. Dữ liệu thiết bị dự án chỉ đổi khi người dùng sửa cấu hình.
 */
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; promise: Promise<ProjectEquipment[]> }>();

export async function loadProjectEquipment(projectId: string) {
  const hit = cache.get(projectId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;

  const promise = (async () => {
    const response = await fetch(`/api/project-equipment?${new URLSearchParams({ projectId })}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Không tải được thiết bị dự án.");
    return result.equipment as ProjectEquipment[];
  })();

  cache.set(projectId, { at: Date.now(), promise });
  try {
    return await promise;
  } catch (error) {
    cache.delete(projectId);
    throw error;
  }
}

/** Xoá cache sau khi sửa cấu hình thiết bị của dự án. */
export function invalidateProjectEquipment(projectId?: string) {
  if (projectId) cache.delete(projectId);
  else cache.clear();
}
