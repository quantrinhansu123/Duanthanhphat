import { requireAccess } from "@/lib/server/requireAccess";
import { createClient } from "@/lib/supabase/server";
import { readProjectCwrRails } from "@lwr/lib/cwr-rail-storage";

export async function GET(request: Request) {
  const denied = await requireAccess("lwr-cong-thuc-tb10015");
  if (denied) return denied;
  try {
    const db = await createClient();
    const project = new URL(request.url).searchParams.get("project");
    const headers = { "Cache-Control": "private, no-store" };
    if (project !== null) {
      return Response.json(await readProjectCwrRails(db, project), { headers });
    }
    const { data, error } = await db.from("du_an").select("id,name:du_an").order("du_an");
    if (error) throw error;
    return Response.json(data, { headers });
  } catch {
    return Response.json({ error: "Không đọc được dữ liệu dự án hoặc thanh ray từ Supabase. Vui lòng thử lại." }, { status: 503 });
  }
}
