import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/server/requireAccess";
import { readPrivateJson } from "@/lib/server/privateJsonStorage";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSupabaseError } from "@/lib/supabase/env";
import { equipmentLocations, type Warehouse } from "@/lib/warehouses";
import type { ProjectMetadataStore } from "@/data/projectMetadata";
import type { MachineSpecs } from "@/data/machines";

export async function GET() {
  const denied = await requireAccess(null);
  if (denied) return denied;
  try {
    const db = createAdminClient();
    const [warehouses, metadata] = await Promise.all([readPrivateJson<Warehouse[]>("warehouses.json"), readPrivateJson<ProjectMetadataStore>("project-metadata.json")]);
    const machines = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("thiet_bi").select("id,ma_may,ten_may,model,loai_may,cong_nghe_han,thong_so").order("id").range(from, from + 999);
      if (error) throw error;
      machines.push(...(data ?? []).map((r) => ({ id: r.id, code: r.ma_may, name: r.ten_may, model: r.model ?? "", type: r.loai_may ?? "", weldingTechnology: r.cong_nghe_han ?? "", specs: r.thong_so as MachineSpecs })));
      if (!data || data.length < 1000) break;
    }
    const projects = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("du_an").select("id,du_an").order("id").range(from, from + 999);
      if (error) throw error;
      projects.push(...(data ?? []).map((p) => ({ id: p.id, name: p.du_an })));
      if (!data || data.length < 1000) break;
    }
    return NextResponse.json({ warehouses: warehouses ?? [], locations: equipmentLocations(machines, warehouses ?? [], projects, metadata ?? {}) });
  } catch (e) { return NextResponse.json({ error: formatSupabaseError(e) }, { status: 500 }); }
}
