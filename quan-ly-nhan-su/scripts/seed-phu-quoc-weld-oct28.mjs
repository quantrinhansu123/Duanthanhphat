/**
 * Tạo 1 nhật ký hàn Phú Quốc ngày 28/10/2026 + gắn máy có ảnh + lý trình
 * để hiện ảnh xe trên sơ đồ LWR (chế độ Ảnh thiết bị).
 *
 *   node scripts/seed-phu-quoc-weld-oct28.mjs
 */
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

const DATE = "2026-10-28";
const START = "07:00";
const END = "16:00";
const METHOD = "FBW";

function pad(n, w = 4) {
  return String(n).padStart(w, "0");
}

async function main() {
  const { data: projects, error: pErr } = await sb
    .from("du_an")
    .select("id, du_an, ma_du_an")
    .order("du_an");
  if (pErr) throw pErr;

  const project =
    (projects ?? []).find((p) => /ph[uú]\s*qu[oố]c/i.test(`${p.du_an} ${p.ma_du_an}`)) ||
    (projects ?? []).find((p) => /y[eê]n\s*th[uư][oợ]ng/i.test(`${p.du_an}`)) ||
    (projects ?? []).find((p) => /PQ/i.test(String(p.ma_du_an ?? ""))) ||
    projects?.[0];
  if (!project) throw new Error("Không tìm thấy dự án");

  const { data: machines, error: mErr } = await sb
    .from("thiet_bi")
    .select("id, ma_may, ten_may, hinh_anh")
    .order("ma_may");
  if (mErr) throw mErr;
  const machine =
    (machines ?? []).find((m) => m.hinh_anh && !String(m.hinh_anh).endsWith(".svg") && !String(m.hinh_anh).includes("unsplash")) ||
    machines?.[0];
  if (!machine) throw new Error("Không tìm thấy máy");

  const { data: welders, error: wErr } = await sb
    .from("nhan_su")
    .select("employee_id, ho_ten, chung_chi")
    .limit(80);
  if (wErr) throw wErr;
  const welder =
    (welders ?? []).find((w) => Array.isArray(w.chung_chi) && w.chung_chi.length > 0) ||
    welders?.[0];
  if (!welder) throw new Error("Không tìm thấy thợ hàn");

  // Lý trình nằm trên đoạn UT đang hiện (khoảng Km0+500–Km1+000), ưu tiên điểm chưa gắn nhật ký
  const { data: points } = await sb
    .from("toa_do")
    .select("id, ma_diem, ly_trinh, kinh_do, vi_do, lich_su_moi_han_id")
    .like("ma_diem", "TT%")
    .order("ma_diem")
    .limit(200);

  const parseKm = (ly) => {
    const m = String(ly ?? "").match(/Km\s*(\d+)\+(\d+(?:[.,]\d+)?)/i);
    if (!m) return null;
    return Number(m[1]) * 1000 + Number(String(m[2]).replace(",", "."));
  };

  const candidates = (points ?? [])
    .map((p) => ({ ...p, metres: parseKm(p.ly_trinh) }))
    .filter((p) => p.metres != null && p.metres >= 400 && p.metres <= 1200)
    .sort((a, b) => Number(!a.lich_su_moi_han_id) - Number(!b.lich_su_moi_han_id) || a.metres - b.metres);

  const point = candidates.find((p) => !p.lich_su_moi_han_id) || candidates[0] || (points ?? [])[24];
  if (!point) throw new Error("Không tìm thấy điểm toa_do phù hợp");

  const sitePrefix = String(project.ma_du_an || "PQ")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") || "PQ";
  const dd = "28";
  const mm = "10";
  const yy = "26";
  const yyyy = "2026";

  const prefix = `${sitePrefix}-${METHOD}-${dd}-${mm}-${yy}-`;
  const { data: existingCodes } = await sb
    .from("lich_su_moi_han")
    .select("ma_lich_su")
    .ilike("ma_lich_su", `${prefix}%`)
    .order("ma_lich_su", { ascending: false })
    .limit(20);
  let seq = 1;
  for (const row of existingCodes ?? []) {
    const match = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(\\d+)$`, "i").exec(
      String(row.ma_lich_su ?? ""),
    );
    if (match) seq = Math.max(seq, Number(match[1]) + 1);
  }

  const maLichSu = `${prefix}${pad(seq)}`;
  const maHienTruong = `${METHOD}-${dd}-${mm}-${yy}-${pad(seq)}`;
  const maMay = `${yyyy}-${Number(mm)}-${Number(dd)}-${pad(seq, 3)}`;
  const certificate = Array.isArray(welder.chung_chi) ? welder.chung_chi[0] : "FBW";

  console.log(
    JSON.stringify(
      {
        project: { id: project.id, name: project.du_an, code: project.ma_du_an },
        machine: { id: machine.id, code: machine.ma_may, name: machine.ten_may, hasImage: Boolean(machine.hinh_anh) },
        welder: { id: welder.employee_id, name: welder.ho_ten },
        point: { id: point.id, code: point.ma_diem, ly_trinh: point.ly_trinh, metres: point.metres ?? parseKm(point.ly_trinh) },
        maLichSu,
        date: DATE,
      },
      null,
      2,
    ),
  );

  const rpcParams = {
    p_ma_lich_su: maLichSu,
    p_du_an_id: project.id,
    p_tho_han_id: welder.employee_id,
    p_nam_thuc_hien: 2026,
    p_ngay_thuc_hien: DATE,
    p_loai_ray: "P50",
    p_loai_moi_han: "Sản xuất",
    p_cong_nghe_han: METHOD,
    p_so_luong_loi: 0,
    p_nguyen_nhan_loi: null,
    p_ghi_chu: `Seed demo ảnh xe · ${point.ma_diem} · ${DATE}`,
    p_moi_han_lien_ket: null,
    p_may_id: machine.id,
    p_chung_chi_su_dung: certificate || "FBW",
    p_hach_toan: "HT-SX01",
    p_toa_do_id: point.id,
    p_kinh_do: point.kinh_do ?? null,
    p_vi_do: point.vi_do ?? null,
    p_ly_trinh: point.ly_trinh,
    p_ma_khuyet_tat: null,
    p_tinh_trang_thi_nghiem: "Đạt",
  };

  let rpc = await sb.rpc("them_nhat_ky_han_co_toa_do_status", rpcParams);
  if (rpc.error?.code === "PGRST202") {
    const { p_tinh_trang_thi_nghiem: _drop, ...legacyParams } = rpcParams;
    rpc = await sb.rpc("them_nhat_ky_han_co_toa_do_ndt", legacyParams);
  }
  if (rpc.error) throw new Error(`RPC tạo nhật ký thất bại: ${rpc.error.message}`);

  const { data: weld, error: wFindErr } = await sb
    .from("lich_su_moi_han")
    .select("id, ma_lich_su")
    .eq("ma_lich_su", maLichSu)
    .maybeSingle();
  if (wFindErr) throw wFindErr;
  if (!weld?.id) throw new Error("Không đọc lại được nhật ký vừa tạo");

  {
    const extras = {
      ma_hien_truong: maHienTruong,
      ten_moi_han_theo_may: maMay,
      gio_bat_dau: START,
      gio_ket_thuc: END,
      gio_nghi_trua: 1,
    };
    let { error: upErr } = await sb.from("lich_su_moi_han").update(extras).eq("id", weld.id);
    if (upErr && /gio_nghi_trua/.test(upErr.message ?? "")) {
      const { gio_nghi_trua: _drop, ...withoutLunch } = extras;
      ({ error: upErr } = await sb.from("lich_su_moi_han").update(withoutLunch).eq("id", weld.id));
    }
    if (upErr) console.warn("Cập nhật giờ/mã phụ:", upErr.message);
  }

  await sb.from("toa_do").update({ lich_su_moi_han_id: weld.id }).eq("id", point.id);

  console.log(
    JSON.stringify(
      {
        ok: true,
        weldId: weld.id,
        ma_lich_su: maLichSu,
        hours: `${START}–${END}`,
        tip: "Mở sơ đồ LWR → bật «Ảnh thiết bị trên ray» → lọc ngày 28/10/2026 hoặc dự án Phú Quốc",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
