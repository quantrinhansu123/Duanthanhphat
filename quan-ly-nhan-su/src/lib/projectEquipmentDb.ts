import type { ProjectEquipment } from "@/lib/projectEquipment";

export async function loadProjectEquipment(projectId: string) {
  const response = await fetch(`/api/project-equipment?${new URLSearchParams({ projectId })}`, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Không tải được thiết bị dự án.");
  return result.equipment as ProjectEquipment[];
}
