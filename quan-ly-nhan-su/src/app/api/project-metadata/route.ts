import { NextResponse } from "next/server";
import type { ProjectMetadata, ProjectMetadataStore } from "@/data/projectMetadata";
import { formatSupabaseError } from "@/lib/supabase/env";
import { readPrivateJson, writePrivateJson } from "@/lib/server/privateJsonStorage";

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
  return {
    status: statuses.has(input.status || "") ? input.status as ProjectMetadata["status"] : "Đang triển khai",
    personnelIds: cleanArray(input.personnelIds),
    machineTypes: cleanArray(input.machineTypes),
    weldTypes: cleanArray(input.weldTypes),
    railTypes: cleanArray(input.railTypes),
    offDays: cleanDateArray(input.offDays),
  };
}

export async function GET() {
  try {
    const metadata = await readPrivateJson<ProjectMetadataStore>(FILE_PATH);
    return NextResponse.json({ metadata: metadata ?? {} });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { projectId?: unknown; metadata?: unknown; store?: Record<string, unknown> };
    const currentStore = await readPrivateJson<ProjectMetadataStore>(FILE_PATH) ?? {};
    if (body.store && typeof body.store === "object") {
      for (const [id, meta] of Object.entries(body.store)) {
        currentStore[id.trim()] = validate(meta);
      }
      await writePrivateJson(FILE_PATH, currentStore);
      return NextResponse.json({ metadata: currentStore });
    }
    const projectId = typeof body.projectId === "string" ? body.projectId.trim().slice(0, 180) : "";
    if (!projectId) return NextResponse.json({ error: "Thiếu mã dự án." }, { status: 400 });
    currentStore[projectId] = validate(body.metadata);
    await writePrivateJson(FILE_PATH, currentStore);
    return NextResponse.json({ metadata: currentStore[projectId] });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
