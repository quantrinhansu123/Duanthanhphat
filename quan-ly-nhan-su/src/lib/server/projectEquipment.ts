import "server-only";
import type { ProjectMetadataStore } from "@/data/projectMetadata";
import type { MachineSpecs } from "@/data/machines";
import { readPrivateJson } from "@/lib/server/privateJsonStorage";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignedEquipment } from "@/lib/projectEquipment";

export async function loadProjectEquipment(projectId: string) {
  const metadata = await readPrivateJson<ProjectMetadataStore>("project-metadata.json") ?? {};
  const project = metadata[projectId] ?? { machineTypes: [] };
  if (!project.machineTypes.length) return [];
  const { data, error } = await createAdminClient().from("thiet_bi")
    .select("id,ma_may,ten_may,model,loai_may,cong_nghe_han,thong_so").in("ma_may", project.machineTypes);
  if (error) throw error;
  return assignedEquipment((data ?? []).map((r) => ({ id: r.id, code: r.ma_may, name: r.ten_may, model: r.model ?? "", type: r.loai_may ?? "", weldingTechnology: r.cong_nghe_han ?? "", specs: r.thong_so as MachineSpecs })), project);
}
