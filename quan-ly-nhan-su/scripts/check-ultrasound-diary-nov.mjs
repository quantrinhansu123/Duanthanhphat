/**
 * Đối chiếu siêu âm trên nhật ký (11–21/11) với bảng khoảng mối.
 * Chạy: node --env-file=.env.local scripts/check-ultrasound-diary-nov.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

/** Mã in nhật ký: ưu tiên mã hiện trường, bỏ PQ-, rút gọn FBW-dd-mm-yy-xxxx → FBW-ddmmyyxxxx. */
function fieldWeldCode(maLichSu, maHienTruong) {
  const raw = String(maHienTruong || maLichSu || "").trim().replace(/^PQ-/i, "");
  const compact = /^(FBW|ATW)-(\d{10,})$/i.exec(raw);
  if (compact) return `${compact[1].toUpperCase()}-${compact[2]}`;
  const m = /^(FBW|ATW)[-_]?(\d{2})[-_]?(\d{2})[-_]?(\d{2})[-_]?(\d+)$/i.exec(raw.replace(/\s+/g, ""));
  if (m) return `${m[1].toUpperCase()}-${m[2]}${m[3]}${m[4]}${m[5].padStart(4, "0")}`;
  return raw;
}

/** Bảng đối chiếu từ ảnh người dùng (ngày → khoảng số cuối mã mối). */
const EXPECTED = [
  ["2026-11-11", 1, 16],
  ["2026-11-12", 17, 34],
  ["2026-11-13", 35, 38],
  ["2026-11-14", 39, 58],
  ["2026-11-16", 59, 88],
  ["2026-11-17", 89, 108],
  ["2026-11-18", 109, 128],
  ["2026-11-19", 129, 148],
  ["2026-11-20", 149, 168],
  ["2026-11-21", 169, 188],
];

/** Số TT cuối mã: FBW-ddmmyyxxxx / FBW-dd-mm-yy-xxxx → xxxx (vd. FBW-1711260173 → 173). */
function seqFromCode(code) {
  const raw = String(code ?? "").trim().toUpperCase();
  const compact = /^(?:FBW|ATW)-(\d{2})(\d{2})(\d{2})(\d+)$/.exec(raw);
  if (compact) return Number(compact[4]);
  const dashed = /^(?:FBW|ATW)-(\d{2})-(\d{2})-(\d{2})-(\d+)$/.exec(raw);
  if (dashed) return Number(dashed[4]);
  const tail = /(\d{4,})$/.exec(raw.replace(/\D/g, ""));
  return tail ? Number(tail[1].slice(-4)) : null;
}

function rangeLabel(nums) {
  if (!nums.length) return "—";
  const sorted = [...nums].sort((a, b) => a - b);
  // Gộp thành các khoảng liên tục
  const parts = [];
  let a = sorted[0], b = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const n = sorted[i];
    if (n === b + 1) { b = n; continue; }
    parts.push(a === b ? String(a) : `${a}-${b}`);
    a = b = n;
  }
  return parts.join(", ");
}

const projects = await db.from("du_an").select("id,du_an,ma_du_an");
if (projects.error) throw projects.error;
const pq = (projects.data ?? []).find((p) =>
  String(p.du_an ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().includes("phu quoc"),
) ?? projects.data?.[0];
if (!pq) {
  console.error("Không tìm thấy dự án.");
  process.exit(1);
}
console.log(`Dự án: ${pq.du_an} (${pq.ma_du_an ?? "—"}) · ${pq.id}\n`);

const rows = [];
for (const [date, from, to] of EXPECTED) {
  // (1) ngày siêu âm thực tế trên phiếu tách
  const byActual = await db.from("phieu_nt_tach_moi")
    .select("moi_han_id,ngay_sieu_am_thuc_te,phieu_nt_tach!inner(du_an_id,loai)")
    .eq("phieu_nt_tach.du_an_id", pq.id)
    .eq("loai", "sieu-am")
    .eq("ngay_sieu_am_thuc_te", date);
  // (2) ngày NDT đạt
  const byNdt = await db.from("kiem_tra_moi_han")
    .select("moi_han_id,ngay_ndt,ket_qua_ndt,lich_su_moi_han!inner(du_an_id,ma_lich_su,ma_hien_truong)")
    .eq("lich_su_moi_han.du_an_id", pq.id)
    .eq("ngay_ndt", date)
    .eq("ket_qua_ndt", "Đạt");

  const idSet = new Set([
    ...(byActual.error ? [] : (byActual.data ?? []).map((r) => r.moi_han_id)),
    ...(byNdt.error ? [] : (byNdt.data ?? []).map((r) => r.moi_han_id)),
  ]);

  let codes = [];
  if (idSet.size) {
    const welds = await db.from("lich_su_moi_han")
      .select("id,ma_lich_su,ma_hien_truong")
      .eq("du_an_id", pq.id)
      .in("id", [...idSet]);
    if (welds.error) throw welds.error;
    codes = (welds.data ?? []).map((w) => fieldWeldCode(w.ma_lich_su, w.ma_hien_truong) || w.ma_lich_su);
  }

  const seqs = codes.map(seqFromCode).filter((n) => Number.isFinite(n));
  const expected = [];
  for (let n = from; n <= to; n++) expected.push(n);
  const got = new Set(seqs);
  const missing = expected.filter((n) => !got.has(n));
  const extra = seqs.filter((n) => n < from || n > to);
  const ok = missing.length === 0 && extra.length === 0 && seqs.length === expected.length;

  rows.push({
    date,
    expected: `${from}-${to}`,
    actual: rangeLabel(seqs),
    count: seqs.length,
    want: expected.length,
    ok,
    missing: missing.length ? rangeLabel(missing) : "",
    extra: extra.length ? rangeLabel(extra) : "",
    sample: codes.slice(0, 3).join(", "),
  });
}

console.log("Ngày       | Kỳ vọng   | Thực tế nhật ký      | SL | Khớp?");
console.log("-".repeat(78));
for (const r of rows) {
  const mark = r.ok ? "OK" : "LECH";
  console.log(`${r.date} | ${r.expected.padEnd(9)} | ${String(r.actual).padEnd(20)} | ${String(r.count).padStart(2)}/${r.want} | ${mark}`);
  if (!r.ok) {
    if (r.missing) console.log(`           thiếu: ${r.missing}`);
    if (r.extra) console.log(`           thừa:  ${r.extra}`);
    if (r.sample) console.log(`           mẫu mã: ${r.sample}`);
  }
}

const allOk = rows.every((r) => r.ok);
console.log(allOk ? "\n→ Khớp toàn bộ bảng ảnh." : "\n→ Có ngày lệch so với ảnh — xem chi tiết trên.");
process.exit(allOk ? 0 : 2);
