import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Sinh migration SQL ghi 12 tháng (A.5 max, A.6 min) cho 151 trạm từ seed đã generate.
const here = path.dirname(fileURLToPath(import.meta.url));
const { TB15_CLIMATE_SEED } = await import("../src/lib/tb15ClimateSeed.generated.ts");

const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;
const json = (a) => `${quote(JSON.stringify(a))}::jsonb`;
const rows = TB15_CLIMATE_SEED.map(
  (r) => `  (${quote(r.ten_tram)}, ${json(r.t_max_thang)}, ${json(r.t_min_thang)})`,
);

const sql = [
  "-- Ghi 12 tháng (A.5 cao nhất, A.6 thấp nhất) cho 151 trạm khí hậu QCVN 02:2022/BXD.",
  "-- Chạy sau migration_20261124_tb15_khi_hau_seed_151.sql. Idempotent: ghi đè theo ten_tram.",
  "",
  "begin;",
  "",
  "update public.tb15_khi_hau k",
  "set t_max_thang = v.tmax, t_min_thang = v.tmin",
  "from (values",
  rows.join(",\n"),
  ") as v(ten, tmax, tmin)",
  "where k.ten_tram = v.ten;",
  "",
  "notify pgrst, 'reload schema';",
  "commit;",
  "",
].join("\n");

writeFileSync(path.join(here, "..", "..", "supabase", "migration_20261125_khi_hau_thang.sql"), sql, "utf8");
console.log(`written ${rows.length} rows`);
