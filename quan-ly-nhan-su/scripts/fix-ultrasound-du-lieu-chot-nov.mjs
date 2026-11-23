/**
 * Sửa ngày đạt siêu âm trong du_lieu_chot (phiếu đã chốt/đã ký) theo bảng ảnh 11–21/11.
 * node --env-file=.env.local scripts/fix-ultrasound-du-lieu-chot-nov.mjs
 * Thêm --dry-run để chỉ xem.
 */
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Thiếu env Supabase");
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

function readNdt(snap) {
  if (!snap || typeof snap !== "object") return "";
  const top = String(snap.ngay_ndt ?? "").slice(0, 10);
  if (top) return top;
  const kt = snap.kiem_tra;
  if (kt && typeof kt === "object") return String(kt.ngay_ndt ?? "").slice(0, 10);
  return "";
}

function patchSnap(snap, want) {
  const next = snap && typeof snap === "object" ? { ...snap } : {};
  next.ngay_ndt = want;
  next.ket_qua_ndt = next.ket_qua_ndt || "Đạt";
  if (next.kiem_tra && typeof next.kiem_tra === "object") {
    next.kiem_tra = {
      ...next.kiem_tra,
      ngay_ndt: want,
      ket_qua_ndt: next.kiem_tra.ket_qua_ndt || "Đạt",
    };
  }
  return next;
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

// Phiếu siêu âm đã chốt của dự án
const tickets = [];
for (let from = 0; ; from += 200) {
  const { data, error } = await db.from("phieu_nt_tach")
    .select("id,so_phieu,ngay_nghiem_thu,da_ky")
    .eq("du_an_id", pq.id)
    .eq("loai", "sieu-am")
    .not("ngay_nghiem_thu", "is", null)
    .order("id")
    .range(from, from + 199);
  if (error) throw error;
  if (!data?.length) break;
  tickets.push(...data);
  if (data.length < 200) break;
}
console.log(`Phiếu siêu âm đã chốt: ${tickets.length}`);
if (!tickets.length) process.exit(0);

const ticketIds = tickets.map((t) => t.id);
const ticketMeta = new Map(tickets.map((t) => [t.id, t]));

const rows = [];
for (let i = 0; i < ticketIds.length; i += 50) {
  const part = ticketIds.slice(i, i + 50);
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from("phieu_nt_tach_moi")
      .select("phieu_id,moi_han_id,ma_lich_su,ket_qua,du_lieu_chot,ngay_nghiem_thu")
      .in("phieu_id", part)
      .not("ket_qua", "is", null)
      .order("moi_han_id")
      .range(from, from + 499);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 500) break;
  }
}
console.log(`Mối đã chốt trên phiếu: ${rows.length}`);

const weldIds = [...new Set(rows.map((r) => r.moi_han_id))];
const welds = new Map();
for (let i = 0; i < weldIds.length; i += 200) {
  const part = weldIds.slice(i, i + 200);
  const { data, error } = await db.from("lich_su_moi_han")
    .select("id,ma_lich_su,ma_hien_truong")
    .in("id", part);
  if (error) throw error;
  for (const w of data ?? []) welds.set(w.id, w);
}

const stats = new Map();
let updated = 0, skipped = 0, failed = 0, noSeq = 0;
const samples = [];

for (const row of rows) {
  const w = welds.get(row.moi_han_id);
  const snap = row.du_lieu_chot && typeof row.du_lieu_chot === "object" ? row.du_lieu_chot : {};
  const codeFromSnap = snap.ma_lich_su
    || snap.moi_han?.ma_lich_su
    || snap.moi_han?.ma_hien_truong
    || "";
  const seq = seqFrom(
    w?.ma_lich_su || row.ma_lich_su || codeFromSnap,
    w?.ma_hien_truong || snap.moi_han?.ma_hien_truong || "",
  );
  if (seq == null || seq < 1 || seq > 188) {
    noSeq++;
    continue;
  }
  const want = dateForSeq(seq);
  if (!want) { skipped++; continue; }

  const curNdt = readNdt(snap);
  const curNt = String(row.ngay_nghiem_thu ?? "").slice(0, 10);
  const needSnap = curNdt !== want;
  const needNt = Boolean(curNt) && curNt !== want;

  const bucket = stats.get(want) ?? { total: 0, change: 0, already: 0 };
  bucket.total++;
  if (!needSnap && !needNt) {
    bucket.already++;
    stats.set(want, bucket);
    skipped++;
    continue;
  }
  bucket.change++;
  stats.set(want, bucket);

  const code = w?.ma_hien_truong || w?.ma_lich_su || row.ma_lich_su || codeFromSnap;
  if (samples.length < 12) {
    samples.push(`  TT${String(seq).padStart(4, "0")} ${code} · phiếu ${ticketMeta.get(row.phieu_id)?.so_phieu ?? "?"}: ngay_ndt ${curNdt || "—"} → ${want}${needNt ? ` · ngay_nghiem_thu ${curNt} → ${want}` : ""}`);
  }

  if (dryRun) {
    updated++;
    continue;
  }

  const patch = { du_lieu_chot: patchSnap(snap, want) };
  if (row.ngay_nghiem_thu) patch.ngay_nghiem_thu = want;

  const { error } = await db.from("phieu_nt_tach_moi")
    .update(patch)
    .eq("phieu_id", row.phieu_id)
    .eq("moi_han_id", row.moi_han_id);
  if (error) {
    console.error(`Lỗi ${code}: ${error.message}`);
    failed++;
  } else {
    updated++;
  }
}

if (samples.length) {
  console.log("\nMẫu:");
  for (const s of samples) console.log(s);
}

console.log("\nTheo ngày đích:");
for (const [date, a, b] of PLAN) {
  const s = stats.get(date) ?? { total: 0, change: 0, already: 0 };
  console.log(`  ${date} (${a}-${b}): ${s.total} mối · sửa ${s.change} · đã đúng ${s.already}`);
}
console.log(`\n${dryRun ? "Dry-run: sẽ sửa" : "Đã sửa"} ${updated} · bỏ qua ${skipped} · không TT ${noSeq} · lỗi ${failed}`);
