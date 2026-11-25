import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const srcPath = path.join(root, "quan-ly-nhan-su/src/lib/tb15ClimateSeed.generated.ts");
const outPath = path.join(root, "supabase/migration_20261124_tb15_khi_hau_seed_151.sql");

const src = fs.readFileSync(srcPath, "utf8");
const match = src.match(/export const TB15_CLIMATE_SEED[^=]*=\s*(\[[\s\S]*\]);?\s*$/);
if (!match) {
  console.error("Cannot parse TB15_CLIMATE_SEED");
  process.exit(1);
}
const rows = eval(match[1]);
const esc = (s) => String(s ?? "").replace(/'/g, "''");

const values = rows
  .map(
    (r) =>
      `('${esc(r.id)}'::uuid, '${esc(r.ma_tram)}', '${esc(r.ten_tram)}', '${esc(r.tinh)}', ${r.t_kk_max}, ${r.t_kk_min}, '${esc(r.nguon || "QCVN 02:2022/BXD")}', '${esc(r.ghi_chu || "")}')`,
  )
  .join(",\n  ");

const sql = `-- Seed đủ ${rows.length} trạm QCVN A.5/A.6 (cột Năm).
-- Chạy sau migration_20261123_tb15_dau_vao.sql (cần unique ten_tram).
-- Idempotent: upsert theo ten_tram.

insert into public.tb15_khi_hau (id, ma_tram, ten_tram, tinh, t_kk_max, t_kk_min, nguon, ghi_chu)
values
  ${values}
on conflict (ten_tram) do update set
  ma_tram = excluded.ma_tram,
  tinh = excluded.tinh,
  t_kk_max = excluded.t_kk_max,
  t_kk_min = excluded.t_kk_min,
  nguon = excluded.nguon,
  ghi_chu = excluded.ghi_chu,
  updated_at = now();

notify pgrst, 'reload schema';
`;

fs.writeFileSync(outPath, sql);
console.log(`Wrote ${outPath} (${rows.length} stations)`);
