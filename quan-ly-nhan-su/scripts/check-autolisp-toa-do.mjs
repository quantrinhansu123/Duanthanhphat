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

const { count: ttCount, error } = await sb
  .from("toa_do")
  .select("*", { count: "exact", head: true })
  .like("ma_diem", "TT%");
if (error) throw error;

const { count: linkedTt } = await sb
  .from("toa_do")
  .select("*", { count: "exact", head: true })
  .like("ma_diem", "TT%")
  .not("lich_su_moi_han_id", "is", null);

const { data: sample } = await sb
  .from("toa_do")
  .select("ma_diem, kinh_do, vi_do, ly_trinh, lich_su_moi_han_id")
  .in("ma_diem", ["TT0001", "TT0005", "TT0077"])
  .order("ma_diem");

console.log(
  JSON.stringify(
    {
      daCoTrongDb: true,
      soDiemTT: ttCount,
      daGanNhatKy: linkedTt,
      mau: sample,
    },
    null,
    2,
  ),
);
