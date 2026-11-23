import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const ts = readFileSync(resolve(root, "src/lib/tb15ClimateSeed.generated.ts"), "utf8");
const rows = [];
const re =
  /\{\s*id:\s*"([^"]+)",\s*ma_tram:\s*"([^"]*)",\s*ten_tram:\s*"([^"]*)",\s*tinh:\s*"([^"]*)",\s*t_kk_max:\s*([-\d.]+),\s*t_kk_min:\s*([-\d.]+),\s*nguon:\s*"([^"]*)",\s*ghi_chu:\s*"([^"]*)"\s*\}/g;
let m;
while ((m = re.exec(ts))) {
  rows.push({
    id: m[1],
    ma_tram: m[2],
    ten_tram: m[3],
    tinh: m[4],
    t_kk_max: Number(m[5]),
    t_kk_min: Number(m[6]),
    nguon: m[7],
    ghi_chu: m[8],
  });
}
if (rows.length < 100) {
  console.error("Parsed too few climate rows:", rows.length);
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = "system-configuration";
const path = "tb15-catalogs.json";

const empty = {
  khi_hau: [],
  loai_ray: [],
  mac_thep: [],
  ket_cau_duong: [],
  do_cung_goi: [],
  on_dinh_nen: [],
  he_so_tai: [],
  so_do_tai: [],
};

let bundle = { ...empty };
const { data: signed } = await sb.storage.from(bucket).createSignedUrl(path, 60);
if (signed?.signedUrl) {
  try {
    const res = await fetch(`${signed.signedUrl}${signed.signedUrl.includes("?") ? "&" : "?"}v=${Date.now()}`);
    if (res.ok) bundle = { ...empty, ...(await res.json()) };
  } catch {
    /* keep empty defaults */
  }
}

bundle.khi_hau = rows;
const blob = Buffer.from(JSON.stringify(bundle, null, 2), "utf8");
const { error } = await sb.storage.from(bucket).upload(path, blob, {
  contentType: "application/json",
  upsert: true,
});
if (error) {
  console.error(error);
  process.exit(1);
}
console.log(`OK: uploaded ${rows.length} climate stations. Sample:`, rows[0].ten_tram, rows[0].t_kk_max, rows[0].t_kk_min);
