/**
 * Upload SVG icons + seed structure_symbols on Supabase.
 * Usage (from thanhphatquanlyhanray):
 *   node --env-file=../quan-ly-nhan-su/.env.local scripts/seed-structure-symbols.mjs
 * or with local .env.local that has URL + SERVICE_ROLE (or ANON) key.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const symbolsDir = resolve(root, "public/symbols");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[name]) process.env[name] = value;
  }
}

loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, "../quan-ly-nhan-su/.env.local"));

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key).");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const BUCKET = "structure-images";

const PRESETS = [
  ["GH-TR", "Ghi rẽ trái", "Left turnout", "turnout-left", "Ghi rẽ trái trên sơ đồ ray"],
  ["GH-PH", "Ghi rẽ phải", "Right turnout", "turnout-right", "Ghi rẽ phải trên sơ đồ ray"],
  ["GH-BC", "Ghi bắt chéo", "Crossing", "crossing", "Ghi bắt chéo / crossing"],
  ["GH-HT", "Ghi hình thoi", "Diamond crossing", "diamond", "Ghi hình thoi"],
  ["CAU", "Cầu", "Bridge", "bridge", "Công trình cầu"],
  ["HAM", "Hầm", "Tunnel", "tunnel", "Công trình hầm"],
  ["CT-DAU", "Đầu cầu / Đầu hầm", "Bridge / Tunnel entrance", "entrance", "Điểm đầu cầu hoặc hầm"],
  ["CT-CUOI", "Cuối cầu / Cuối hầm", "Bridge / Tunnel exit", "exit", "Điểm cuối cầu hoặc hầm"],
  ["VHC-HAN", "Vùng hạn chế hàn ray", "Non-welding zone", "non-welding", "Vùng không cho phép hàn ray"],
];

async function ensureBucket() {
  const options = {
    public: true,
    fileSizeLimit: 5242880,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"],
  };
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets ?? []).some((b) => b.id === BUCKET || b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, options);
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  const { error: updateError } = await supabase.storage.updateBucket(BUCKET, options);
  if (updateError) throw updateError;
}

async function uploadSvg(fileBase) {
  const filePath = resolve(symbolsDir, `${fileBase}.svg`);
  if (!existsSync(filePath)) throw new Error(`Missing icon: ${filePath}`);
  const body = readFileSync(filePath);
  const objectPath = `presets/${fileBase}.svg`;
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, body, {
    contentType: "image/svg+xml",
    upsert: true,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

async function main() {
  console.log("Supabase:", url);
  await ensureBucket();

  let upserted = 0;
  for (const [code, name, name_en, file, note] of PRESETS) {
    const image_url = await uploadSvg(file);
    const { data: existing, error: findErr } = await supabase
      .from("structure_symbols")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (findErr) throw findErr;

    const payload = {
      code,
      name,
      name_en,
      line: null,
      km_start: null,
      km_end: null,
      status: "active",
      managing_unit: "Thành Phát",
      note,
      image_url,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase.from("structure_symbols").update(payload).eq("id", existing.id);
      if (error) throw error;
      console.log("update", code, image_url);
    } else {
      const { error } = await supabase.from("structure_symbols").insert(payload);
      if (error) throw error;
      console.log("insert", code, image_url);
    }
    upserted += 1;
  }

  console.log(`Done: ${upserted} symbols seeded.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
