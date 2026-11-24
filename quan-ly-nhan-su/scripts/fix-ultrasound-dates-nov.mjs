/**
 * Chỉnh ngày siêu âm đạt (ngay_ndt) theo bảng ảnh 11–21/11.
 * Nếu DB đã có cột/RPC ngày siêu âm thực tế → ghi luôn ngay_sieu_am_thuc_te.
 *
 * node --env-file=.env.local scripts/fix-ultrasound-dates-nov.mjs
 * node --env-file=.env.local scripts/fix-ultrasound-dates-nov.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const PLAN = [
  ["2026-11-11", 1, 16],
  ["2026-11-12", 17, 34],
  ["2026-11-13", 35, 38],
  ["2026-11-14", 39, 58],
  ["2026-11-15", 59, 66],
  ["2026-11-16", 67, 88],
  ["2026-11-17", 89, 108],
  ["2026-11-18", 109, 128],
  ["2026-11-19", 129, 148],
  ["2026-11-20", 149, 168],
  ["2026-11-21", 169, 188],
];

function seqFrom(maLichSu, maHienTruong) {
  const raw = String(maHienTruong || maLichSu || "").trim().toUpperCase().replace(/^PQ-/i, "");
  const compact = /^(?:FBW|ATW)-(\d{2})(\d{2})(\d{2})(\d+)$/.exec(raw);
  if (compact) return Number(compact[4]);
  const dashed = /^(?:FBW|ATW)-(\d{2})-(\d{2})-(\d{2})-(\d+)$/.exec(raw);
  if (dashed) return Number(dashed[4]);
  return null;
}

function dateForSeq(n) {
  for (const [date, a, b] of PLAN) if (n >= a && n <= b) return date;
  return null;
}

const projects = await db.from("du_an").select("id,du_an,ma_du_an");
if (projects.error) throw projects.error;
const pq = (projects.data ?? []).find((p) =>
  String(p.du_an ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().includes("phu quoc"),
);
if (!pq) {
  console.error("Không tìm thấy dự án Phú Quốc");
  process.exit(1);
}
console.log(`${dryRun ? "[DRY-RUN] " : ""}Dự án: ${pq.du_an}\n`);

const allWelds = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("lich_su_moi_han")
    .select("id,ma_lich_su,ma_hien_truong")
    .eq("du_an_id", pq.id)
    .order("id")
    .range(from, from + 999);
  if (error) throw error;
  if (!data?.length) break;
  allWelds.push(...data);
  if (data.length < 1000) break;
}

const bySeq = new Map();
for (const w of allWelds) {
  const seq = seqFrom(w.ma_lich_su, w.ma_hien_truong);
  if (seq == null || seq < 1 || seq > 188) continue;
  const code = String(w.ma_hien_truong || w.ma_lich_su || "");
  const prev = bySeq.get(seq);
  if (!prev || (/FBW/i.test(code) && !/FBW/i.test(prev.code))) {
    bySeq.set(seq, { id: w.id, code, seq });
  }
}

const missingSeq = [];
for (let n = 1; n <= 188; n++) if (!bySeq.has(n)) missingSeq.push(n);
if (missingSeq.length) {
  console.warn(`Thiếu TT trong DB: ${missingSeq.join(", ")}`);
}

const targets = [...bySeq.values()].map((w) => ({ ...w, date: dateForSeq(w.seq) })).filter((w) => w.date);
const byDate = Map.groupBy ? Map.groupBy(targets, (t) => t.date) : null;
const groups = new Map();
for (const t of targets) {
  if (!groups.has(t.date)) groups.set(t.date, []);
  groups.get(t.date).push(t);
}
for (const [date, list] of [...groups.entries()].sort()) {
  const s = list.map((x) => x.seq).sort((a, b) => a - b);
  console.log(`  ${date}: ${s[0]}-${s[s.length - 1]} (${s.length} mối)`);
}

// Kiểm tra cột / RPC ngày siêu âm thực tế
const colProbe = await db.from("phieu_nt_tach_moi").select("moi_han_id,ngay_sieu_am_thuc_te").limit(1);
const hasActualCol = !colProbe.error;
console.log(`\nCột ngay_sieu_am_thuc_te: ${hasActualCol ? "có" : "CHƯA CÓ — chỉ cập nhật ngay_ndt (nhật ký vẫn đọc được)"}`);

if (dryRun) {
  console.log("\nDry-run — không ghi DB.");
  process.exit(0);
}

let ndtOk = 0, ndtFail = 0, saOk = 0, saFail = 0;

// Batch cập nhật ngay_ndt theo từng ngày
for (const [date, list] of groups) {
  const ids = list.map((t) => t.id);
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const { error } = await db.from("kiem_tra_moi_han")
      .update({ ngay_ndt: date, ket_qua_ndt: "Đạt" })
      .in("moi_han_id", chunk);
    if (error) {
      console.error(`NDT ${date} chunk: ${error.message}`);
      ndtFail += chunk.length;
    } else {
      ndtOk += chunk.length;
    }
  }
}

// Phiếu ĐÃ KÝ hiển thị ảnh chụp (du_lieu_chot) → sửa ngay_ndt trong snapshot các bảng phiếu.
const dateById0 = new Map(targets.map((t) => [t.id, t.date]));
function patchSnap(snap, date) {
  const s = snap && typeof snap === "object" ? { ...snap } : {};
  let changed = false;
  if ("ngay_ndt" in s && s.ngay_ndt !== date) { s.ngay_ndt = date; changed = true; }
  if (s.kiem_tra && typeof s.kiem_tra === "object") {
    if (s.kiem_tra.ngay_ndt !== date) { s.kiem_tra = { ...s.kiem_tra, ngay_ndt: date }; changed = true; }
  } else if (!("ngay_ndt" in s)) { s.kiem_tra = { ket_qua_ndt: "Đạt", ngay_ndt: date }; changed = true; }
  return changed ? s : null;
}
let snapOk = 0, snapFail = 0;
for (const table of ["phieu_nt_tach_moi", "phieu_yeu_cau_nghiem_thu_moi", "dot_nghiem_thu_moi"]) {
  const ids = targets.map((t) => t.id);
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const { data, error } = await db.from(table).select("*").in("moi_han_id", chunk);
    if (error) { console.error(`Snapshot ${table}: ${error.message}`); snapFail += chunk.length; continue; }
    for (const row of data ?? []) {
      if (table === "phieu_nt_tach_moi" && row.loai !== "sieu-am") continue;
      const date = dateById0.get(row.moi_han_id);
      const next = date ? patchSnap(row.du_lieu_chot, date) : null;
      if (!next) continue;
      let q = db.from(table).update({ du_lieu_chot: next }).eq("moi_han_id", row.moi_han_id);
      q = table === "phieu_nt_tach_moi" ? q.eq("phieu_id", row.phieu_id).eq("loai", row.loai)
        : table === "dot_nghiem_thu_moi" ? q.eq("dot_id", row.dot_id) : q.eq("phieu_id", row.phieu_id);
      const up = await q;
      if (up.error) { console.error(`Snapshot ${table} ${row.moi_han_id}: ${up.error.message}`); snapFail++; } else snapOk++;
    }
  }
}
console.log(`Snapshot phiếu đã ký: ${snapOk} ok / ${snapFail} lỗi`);

if (hasActualCol) {
  // Lấy liên kết phiếu siêu âm cho các mối
  const idAll = targets.map((t) => t.id);
  const links = [];
  for (let i = 0; i < idAll.length; i += 100) {
    const chunk = idAll.slice(i, i + 100);
    const { data, error } = await db.from("phieu_nt_tach_moi")
      .select("phieu_id,moi_han_id")
      .eq("loai", "sieu-am")
      .in("moi_han_id", chunk);
    if (error) {
      console.error(`Link SA: ${error.message}`);
      break;
    }
    links.push(...(data ?? []));
  }
  // Nhóm theo (phieu_id, date)
  const buckets = new Map();
  const dateById = new Map(targets.map((t) => [t.id, t.date]));
  for (const row of links) {
    const date = dateById.get(row.moi_han_id);
    if (!date) continue;
    const key = `${row.phieu_id}|${date}`;
    if (!buckets.has(key)) buckets.set(key, { phieu_id: row.phieu_id, date, ids: [] });
    buckets.get(key).ids.push(row.moi_han_id);
  }
  for (const b of buckets.values()) {
    const { data, error } = await db.rpc("ghi_ngay_sieu_am_thuc_te", {
      p_phieu_id: b.phieu_id,
      p_du_an_id: pq.id,
      p_moi_han_ids: b.ids,
      p_ngay: b.date,
    });
    if (error) {
      // fallback update trực tiếp
      const up = await db.from("phieu_nt_tach_moi")
        .update({ ngay_sieu_am_thuc_te: b.date })
        .eq("phieu_id", b.phieu_id)
        .eq("loai", "sieu-am")
        .in("moi_han_id", b.ids);
      if (up.error) {
        console.error(`SA ${b.date} phiếu ${b.phieu_id}: ${error.message} / ${up.error.message}`);
        saFail += b.ids.length;
      } else {
        saOk += b.ids.length;
        await db.from("phieu_nt_tach").update({ nhat_ky_theo_ngay_sieu_am: true }).eq("id", b.phieu_id);
      }
    } else {
      saOk += Number(data) || b.ids.length;
    }
  }
} else {
  console.log("\nGợi ý: chạy migration_20261120_ngay_sieu_am_thuc_te.sql trên Supabase SQL Editor rồi chạy lại script này để ghi ngày siêu âm thực tế.");
}

console.log(`\nXong: ngay_ndt ${ndtOk} ok / ${ndtFail} lỗi; ngay_sieu_am_thuc_te ${saOk} ok / ${saFail} lỗi`);
console.log("Đối chiếu: node --env-file=.env.local scripts/check-ultrasound-diary-nov.mjs");
