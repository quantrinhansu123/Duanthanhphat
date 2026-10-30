import { NextResponse } from "next/server";
import type { ProjectMetadata, ProjectMetadataStore } from "@/data/projectMetadata";
import { formatSupabaseError } from "@/lib/supabase/env";
import { readPrivateJson, writePrivateJson } from "@/lib/server/privateJsonStorage";
import { requireAccess } from "@/lib/server/requireAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { equipmentQuantity } from "@/lib/projectEquipment";

const FILE_PATH = "project-metadata.json";
const statuses = new Set(["Đang triển khai", "Hoàn thành", "Tạm dừng"]);

function cleanArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => typeof item === "string" ? item.trim().slice(0, 300) : "").filter(Boolean))).slice(0, 1000);
}

function cleanDateArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.slice(0, 10) : ""))
        .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)),
    ),
  )
    .sort()
    .slice(0, 2000);
}

function validate(value: unknown): ProjectMetadata {
  const input = value && typeof value === "object" ? value as Partial<ProjectMetadata> : {};
  const machineTypes = cleanArray(input.machineTypes);
  const machineQuantities: Record<string, number> = {};
  for (const code of machineTypes) {
    const quantity = input.machineQuantities?.[code] ?? 1;
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new RangeError(`Số lượng bộ của ${code} phải là số nguyên dương.`);
    machineQuantities[code] = quantity;
  }
  return {
    status: statuses.has(input.status || "") ? input.status as ProjectMetadata["status"] : "Đang triển khai",
    personnelIds: cleanArray(input.personnelIds),
    machineTypes,
    machineQuantities,
    weldTypes: cleanArray(input.weldTypes),
    railTypes: cleanArray(input.railTypes),
    offDays: cleanDateArray(input.offDays),
  };
}

async function validateEquipment(projectId: string, metadata: ProjectMetadata, store: ProjectMetadataStore) {
  if (!metadata.machineTypes.length) return;
  const { data, error } = await createAdminClient().from("thiet_bi").select("ma_may,thong_so").in("ma_may", metadata.machineTypes);
  if (error) throw error;
  for (const code of metadata.machineTypes) {
    const machine = data?.find((r) => r.ma_may === code);
    const quantity = metadata.machineQuantities?.[code] ?? 1;
    const existing = store[projectId];
    const assigned = existing?.machineTypes.includes(code) ? existing.machineQuantities?.[code] ?? 1 : 0;
    if (!machine) {
      if (assigned && quantity === assigned) continue;
      throw new RangeError(`Thiết bị ${code} không còn trong danh mục. Hãy chọn lại mã thiết bị.`);
    }
    const stock = equipmentQuantity({ specs: machine.thong_so });
    if (quantity > stock) throw new RangeError(`Số bộ ${code} vượt số lượng trong danh mục.`);
    const previous = existing?.status === "Hoàn thành" ? 0 : assigned;
    const elsewhere = Object.entries(store).filter(([id, p]) => id !== projectId && p.status !== "Hoàn thành" && p.machineTypes.includes(code))
      .reduce((sum, [, p]) => sum + (p.machineQuantities?.[code] ?? 1), 0);
    if (metadata.status !== "Hoàn thành" && quantity > previous && quantity + elsewhere > stock) throw new RangeError(`${code}: số lượng còn có thể gán là ${Math.max(0, stock - elsewhere)} bộ.`);
  }
}

export async function GET() {
  const denied = await requireAccess("quan-ly-du-an", "view");
  if (denied) return denied;
  try {
    const metadata = await readPrivateJson<ProjectMetadataStore>(FILE_PATH);
    return NextResponse.json({ metadata: metadata ?? {} });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await requireAccess("quan-ly-du-an", "edit");
  if (denied) return denied;
  try {
    const body = await request.json() as { projectId?: unknown; metadata?: unknown; store?: Record<string, unknown> };
    const currentStore = await readPrivateJson<ProjectMetadataStore>(FILE_PATH) ?? {};
    if (body.store && typeof body.store === "object") {
      for (const [id, meta] of Object.entries(body.store)) {
        const metadata = validate(meta);
        await validateEquipment(id.trim(), metadata, currentStore);
        currentStore[id.trim()] = metadata;
      }
      await writePrivateJson(FILE_PATH, currentStore);
      return NextResponse.json({ metadata: currentStore });
    }
    const projectId = typeof body.projectId === "string" ? body.projectId.trim().slice(0, 180) : "";
    if (!projectId) return NextResponse.json({ error: "Thiếu mã dự án." }, { status: 400 });
    const metadata = validate(body.metadata);
    await validateEquipment(projectId, metadata, currentStore);
    currentStore[projectId] = metadata;
    await writePrivateJson(FILE_PATH, currentStore);
    return NextResponse.json({ metadata: currentStore[projectId] });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: error instanceof RangeError ? 400 : 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAccess("quan-ly-du-an", "delete");
  if (denied) return denied;
  try {
    const projectId = new URL(request.url).searchParams.get("projectId")?.trim();
    if (!projectId) return NextResponse.json({ error: "Thiếu mã dự án." }, { status: 400 });
    const store = await readPrivateJson<ProjectMetadataStore>(FILE_PATH) ?? {};
    delete store[projectId];
    await writePrivateJson(FILE_PATH, store);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}
