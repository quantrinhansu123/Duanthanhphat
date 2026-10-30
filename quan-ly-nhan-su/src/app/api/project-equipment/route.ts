import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/server/requireAccess";
import { loadProjectEquipment } from "@/lib/server/projectEquipment";
import { formatSupabaseError } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const denied = await requireAccess(null);
  if (denied) return denied;
  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) return NextResponse.json({ error: "Mã dự án không hợp lệ." }, { status: 400 });
  try { return NextResponse.json({ equipment: await loadProjectEquipment(projectId) }); }
  catch (error) { return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 }); }
}
