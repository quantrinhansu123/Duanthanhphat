/**
 * Ghi dữ liệu khí hậu theo tháng (QCVN 02:2022/BXD A.5 / A.6) vào bảng public.tb15_khi_hau.
 *
 * Yêu cầu: bảng đã có cột t_max_thang, t_min_thang (jsonb). Nếu chưa, script in ra SQL cần chạy
 * trong Supabase SQL Editor rồi dừng, không ghi gì.
 *
 * Chạy:  node --env-file=.env scripts/sync-tb15-climate-monthly-db.mjs
 *
 * - Trạm đã có trong DB (khớp ten_tram): chỉ cập nhật 12 tháng + nhiệt độ năm (max / min của 12 tháng).
 *   Các cột khác (tỉnh, ghi chú, ...) giữ nguyên.
 * - Trạm QCVN chưa có trong DB: thêm mới.
 */
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

const MIGRATION_SQL = `alter table public.tb15_khi_hau add column if not exists t_max_thang jsonb;
alter table public.tb15_khi_hau add column if not exists t_min_thang jsonb;
notify pgrst, 'reload schema';`;

// --- Đọc seed đã sinh từ PDF QCVN ---
const ts = readFileSync(resolve(root, "src/lib/tb15ClimateSeed.generated.ts"), "utf8");
const lineRe =
  /^\s*\{ id: "([^"]+)", ma_tram: "([^"]*)", ten_tram: "((?:[^"\\]|\\.)*)", tinh: "([^"]*)", t_kk_max: ([-\d.]+), t_kk_min: ([-\d.]+), t_max_thang: \[([^\]]*)\], t_min_thang: \[([^\]]*)\], nguon: "([^"]*)", ghi_chu: "([^"]*)" \},?\s*$/;
const unescape = (s) => s.replace(/\\(.)/g, "$1");
const parseList = (s) => s.split(",").map((x) => Number(x.trim()));

const seed = [];
for (const line of ts.split("\n")) {
  const m = lineRe.exec(line);
  if (!m) continue;
  seed.push({
    id: m[1],
    ma_tram: m[2],
    ten_tram: unescape(m[3]),
    tinh: m[4],
    t_max_thang: parseList(m[7]),
    t_min_thang: parseList(m[8]),
    nguon: m[9],
    ghi_chu: m[10],
  });
}
if (seed.length < 100) {
  console.error("Đọc seed lỗi, chỉ có", seed.length, "dòng");
  process.exit(1);
}
for (const r of seed) {
  if (
    r.t_max_thang.length !== 12 ||
    r.t_min_thang.length !== 12 ||
    [...r.t_max_thang, ...r.t_min_thang].some((v) => !Number.isFinite(v))
  ) {
    console.error("Dữ liệu tháng không hợp lệ:", r.ten_tram);
    process.exit(1);
  }
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Thoát sau một nhịp ngắn để tránh lỗi libuv trên Windows khi đóng khi còn kết nối mở.
const exitLater = (code) => new Promise(() => setTimeout(() => process.exit(code), 100));

// --- Kiểm tra cột tháng đã có chưa ---
const probe = await sb.from("tb15_khi_hau").select("id,ten_tram,t_max_thang,t_min_thang").limit(1000);
if (probe.error) {
  if (/t_(max|min)_thang/i.test(probe.error.message) || probe.error.code === "42703") {
    console.error("Bảng tb15_khi_hau chưa có cột theo tháng. Chạy SQL sau trong Supabase SQL Editor rồi chạy lại script:\n");
    console.error(MIGRATION_SQL);
  } else {
    console.error("Không đọc được tb15_khi_hau:", probe.error.message);
  }
  await exitLater(2);
}

const existing = new Map(probe.data.map((r) => [String(r.ten_tram).trim().toLowerCase(), r]));
let updated = 0;
let inserted = 0;
const failed = [];

for (const r of seed) {
  const derived = { t_kk_max: Math.max(...r.t_max_thang), t_kk_min: Math.min(...r.t_min_thang) };
  const found = existing.get(r.ten_tram.trim().toLowerCase());
  if (found) {
    const { error } = await sb
      .from("tb15_khi_hau")
      .update({ t_max_thang: r.t_max_thang, t_min_thang: r.t_min_thang, ...derived, updated_at: new Date().toISOString() })
      .eq("id", found.id);
    if (error) failed.push(`${r.ten_tram}: ${error.message}`);
    else updated++;
  } else {
    const { error } = await sb.from("tb15_khi_hau").insert({
      id: r.id,
      ma_tram: r.ma_tram,
      ten_tram: r.ten_tram,
      tinh: r.tinh,
      t_max_thang: r.t_max_thang,
      t_min_thang: r.t_min_thang,
      ...derived,
      nguon: r.nguon,
      ghi_chu: r.ghi_chu,
    });
    if (error) failed.push(`${r.ten_tram}: ${error.message}`);
    else inserted++;
  }
}

const after = await sb.from("tb15_khi_hau").select("id,t_max_thang,t_min_thang");
const withMonths = (after.data ?? []).filter((r) => Array.isArray(r.t_max_thang) && Array.isArray(r.t_min_thang)).length;
console.log(`Cập nhật: ${updated}, thêm mới: ${inserted}, lỗi: ${failed.length}`);
console.log(`Trong DB: ${(after.data ?? []).length} trạm, ${withMonths} trạm có đủ dữ liệu tháng.`);
if (failed.length) {
  console.error(failed.slice(0, 10).join("\n"));
  await exitLater(1);
}
