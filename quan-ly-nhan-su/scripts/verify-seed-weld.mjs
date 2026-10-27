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

const id = "2c022d26-f037-44b8-bcc6-fe2112540153";
const { data: weld, error } = await sb
  .from("lich_su_moi_han")
  .select("id, ma_lich_su, ngay_thuc_hien, may_id, ma_may, ten_may, gio_bat_dau, gio_ket_thuc, du_an_id")
  .eq("id", id)
  .maybeSingle();
const { data: gps } = await sb
  .from("bao_cao_moi_han_gps")
  .select("lich_su_moi_han_id, ma_lich_su, ly_trinh_toa_do, ten_du_an, may_id, ma_may, ten_may, ngay_thuc_hien")
  .eq("lich_su_moi_han_id", id)
  .maybeSingle();
const { data: view } = await sb
  .from("bao_cao_moi_han_theo_du_an")
  .select("id, ma_lich_su, du_an, may_id, ma_may, ten_may, gio_bat_dau, gio_ket_thuc, ngay_thuc_hien")
  .eq("id", id)
  .maybeSingle();

console.log(JSON.stringify({ error, weld, gps, view }, null, 2));
