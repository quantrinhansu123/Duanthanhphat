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
  .select("ma_diem, kinh_do, vi_do")
  .in("ma_diem", ["TT0001", "TT0025", "TP0001", "TP0025"]);
if (error) throw error;
console.log(JSON.stringify(data, null, 2));
