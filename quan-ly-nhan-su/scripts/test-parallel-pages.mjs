// So sánh tải tuần tự và song song các trang của view lịch sử mối hàn: phải cùng số dòng, cùng thứ tự id.
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const size = 1000;
const q = (count) => db.from("v_lich_su_moi_han_chi_tiet").select("id", count ? { count: "exact" } : undefined)
  .order("ngay_thuc_hien", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).order("id", { ascending: false });
let t = Date.now();
const seq = [];
for (let o = 0; ; o += size) { const { data, error } = await q(false).range(o, o + size - 1); if (error) throw error; seq.push(...data); if (data.length < size) break; }
const tSeq = Date.now() - t; t = Date.now();
const first = await q(true).range(0, size - 1);
if (first.error) throw first.error;
const par = [...first.data];
const offs = []; for (let o = size; o < first.count; o += size) offs.push(o);
for (const part of await Promise.all(offs.map(async (o) => (await q(false).range(o, o + size - 1)).data))) par.push(...part);
const tPar = Date.now() - t;
console.log({ rows: seq.length, count: first.count, tuanTu_ms: tSeq, songSong_ms: tPar });
if (seq.length !== par.length || seq.some((r, i) => r.id !== par[i].id)) { console.error("KHÁC NHAU"); process.exit(1); }
console.log("OK: cùng số dòng và thứ tự");
