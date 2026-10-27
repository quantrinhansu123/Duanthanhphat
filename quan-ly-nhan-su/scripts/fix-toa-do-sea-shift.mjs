/**
 * Sửa điểm Autolisp TT ra biển do convert VN2000 sai kinh tuyến trục.
 *
 * Nguyên nhân: CAD/sample dùng CM 104°45′ (EPSG:9208) thay vì Kiên Giang 104°30′ (EPSG:9207).
 * Hệ quả: kinh độ WGS lệch +0.25° (~27 km) ra phía đông → ra biển Phú Quốc.
 * Các dải TP/HT/HP đã đúng (~103.99°E); chỉ 77 điểm TT0001–TT0077 bị lệch.
 *
 * Usage:
 *   node scripts/fix-toa-do-sea-shift.mjs           # dry-run
 *   node scripts/fix-toa-do-sea-shift.mjs --apply   # ghi DB
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const CM_WRONG = 104.75;
const CM_KIEN_GIANG = 104.5;
const LON_SHIFT = CM_WRONG - CM_KIEN_GIANG; // 0.25°

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

const apply = process.argv.includes("--apply");
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await sb
  .from("toa_do")
  .select("id, ma_diem, kinh_do, vi_do, ghi_chu")
  .like("ma_diem", "TT%")
  .gt("kinh_do", 104.1)
  .lt("kinh_do", 104.4)
  .gte("vi_do", 9.8)
  .lte("vi_do", 10.6)
  .order("ma_diem");

if (error) throw error;

const rows = data ?? [];
console.log(`Tìm thấy ${rows.length} điểm TT nghi ra biển (lon 104.1–104.4).`);
if (rows.length === 0) {
  console.log("Không cần sửa.");
  process.exit(0);
}

const preview = rows.slice(0, 5).map((r) => ({
  code: r.ma_diem,
  from: Number(r.kinh_do),
  to: Number(r.kinh_do) - LON_SHIFT,
  lat: Number(r.vi_do),
}));
console.log(JSON.stringify({ apply, shiftDeg: -LON_SHIFT, preview }, null, 2));

if (!apply) {
  console.log("Dry-run. Chạy lại với --apply để cập nhật toa_do.");
  process.exit(0);
}

let updated = 0;
for (const row of rows) {
  const lon = Number(row.kinh_do) - LON_SHIFT;
  const note = String(row.ghi_chu ?? "").trim();
  const tag = `fixed CM ${CM_WRONG}→${CM_KIEN_GIANG}`;
  const ghi_chu = note.includes(tag) ? note : note ? `${note} · ${tag}` : tag;
  const { error: upErr } = await sb
    .from("toa_do")
    .update({ kinh_do: lon, ghi_chu })
    .eq("id", row.id);
  if (upErr) throw upErr;
  updated += 1;
}

console.log(`Đã sửa ${updated} điểm. Kiểm tra lại bản đồ toạ độ.`);
