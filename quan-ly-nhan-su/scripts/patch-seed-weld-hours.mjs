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

async function tryUpdate(body) {
  const { error } = await sb.from("lich_su_moi_han").update(body).eq("id", id);
  return error;
}

let err = await tryUpdate({
  gio_bat_dau: "07:00",
  gio_ket_thuc: "16:00",
  gio_nghi_trua: 1,
  ma_hien_truong: "FBW-28-10-26-0032",
  ten_moi_han_theo_may: "2026-10-28-032",
});
if (err && /gio_nghi_trua/.test(err.message ?? "")) {
  err = await tryUpdate({
    gio_bat_dau: "07:00",
    gio_ket_thuc: "16:00",
    ma_hien_truong: "FBW-28-10-26-0032",
    ten_moi_han_theo_may: "2026-10-28-032",
  });
}
if (err) {
  console.error(err);
  process.exit(1);
}

const { data } = await sb
  .from("bao_cao_moi_han_theo_du_an")
  .select("id, ma_lich_su, gio_bat_dau, gio_ket_thuc, may_id, ma_may, ngay_thuc_hien, du_an")
  .eq("id", id)
  .maybeSingle();
console.log(JSON.stringify({ ok: true, data }, null, 2));
