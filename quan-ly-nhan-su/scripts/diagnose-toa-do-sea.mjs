import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(appDirectory, ".env.local"), "utf8")
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^\s*([^#=]+)=(.*)$/);
      return match ? [[match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, "")]] : [];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await sb
  .from("toa_do")
  .select("id, ma_diem, kinh_do, vi_do, ly_trinh, ghi_chu")
  .order("ma_diem");

if (error) {
  console.error(error);
  process.exit(1);
}

const rows = data ?? [];
const parseVn = (note) => {
  const m = String(note ?? "").match(/VN2000\s+X=([-\d.]+)\s+Y=([-\d.]+)/i);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
};

const buckets = {
  land: [],
  sea: [],
  noNote: [],
};

for (const r of rows) {
  const lon = Number(r.kinh_do);
  const lat = Number(r.vi_do);
  const vn = parseVn(r.ghi_chu);
  const item = {
    code: r.ma_diem,
    lon,
    lat,
    vn,
    // Nếu đã convert bằng CM 104.75 thì lon≈f(E,104.75); đúng Kiên Giang CM 104.5 → lon−0.25
    lonFixed: lon - 0.25,
  };
  if (lon > 104.1 && lat > 9.5 && lat < 11) buckets.sea.push(item);
  else if (lon >= 103.7 && lon <= 104.1) buckets.land.push(item);
  else buckets.noNote.push(item);
}

console.log(
  JSON.stringify(
    {
      total: rows.length,
      sea: buckets.sea.length,
      landPhuQuoc: buckets.land.length,
      other: buckets.noNote.length,
      seaSample: buckets.sea.slice(0, 5),
      landSample: buckets.land.slice(0, 5),
      seaWithVn: buckets.sea.filter((r) => r.vn).length,
      // So sánh: điểm land có Y easting tương tự sea không?
      seaY: buckets.sea.filter((r) => r.vn).slice(0, 3).map((r) => r.vn.y),
      landY: buckets.land.filter((r) => r.vn).slice(0, 3).map((r) => r.vn.y),
    },
    null,
    2,
  ),
);
