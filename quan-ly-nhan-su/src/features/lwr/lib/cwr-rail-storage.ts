import type { SupabaseClient } from "@supabase/supabase-js";
import { preferNewerLongRails } from "./long-rail-storage";
import { readCwrRail, type CwrRail } from "./cwr-rail";

/** Project diagrams also hold legacy rails with no standalone project-scoped row. */
export async function readProjectCwrRails(db: SupabaseClient, projectId: string) {
  async function readTable() {
    const rails: CwrRail[] = [];
    const limit = 500;
    for (let from = 0; ; from += limit) {
      let query = db.from("lwr_long_rails").select("id,code,label,params,updatedAt:updated_at");
      const path = "params->placement->>projectId";
      query = projectId ? query.eq(path, projectId) : query.or(`${path}.is.null,${path}.eq.""`);
      const { data, error } = await query.order("id").range(from, from + limit - 1);
      if (error) throw error;
      rails.push(...data.map((row) => readCwrRail(row, projectId)));
      if (data.length < limit) return rails;
    }
  }
  const [diagram, table] = await Promise.all([
    db.from("lwr_track_layouts").select("rails:layout->longRails").eq("project_id", projectId).maybeSingle(),
    readTable(),
  ]);
  if (diagram.error) throw diagram.error;
  const stored: unknown = diagram.data?.rails ?? [];
  if (!Array.isArray(stored)) throw new Error("Dữ liệu thanh ray trong sơ đồ không hợp lệ.");
  const rails = stored.map((row) => {
    if (!row || typeof row.id !== "string" || typeof row.code !== "string") throw new Error("Thanh ray trong sơ đồ thiếu mã nhận diện.");
    return readCwrRail(row, projectId);
  });
  return preferNewerLongRails(rails, table).sort((a, b) => a.code.localeCompare(b.code, "vi", { numeric: true }));
}
