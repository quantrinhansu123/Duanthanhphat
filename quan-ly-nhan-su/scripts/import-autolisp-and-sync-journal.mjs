/**
 * Import điểm Autolisp TT vào toa_do, rồi thử đồng bộ vài nhật ký hàn.
 *
 * WGS trong sample phải theo múi Kiên Giang VN2000 TM-3 104°30′ (EPSG:9207).
 * Không dùng 104°45′ — sẽ lệch +0.25° kinh độ ra biển Phú Quốc.
 * Nếu phát hiện lại: node scripts/fix-toa-do-sea-shift.mjs --apply
 *
 * Usage:
 *   node scripts/import-autolisp-and-sync-journal.mjs
 *   node scripts/import-autolisp-and-sync-journal.mjs --sync=5
 *   node scripts/import-autolisp-and-sync-journal.mjs --sync=0   # chỉ import, không tạo nhật ký
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");

function loadEnv(filePath) {
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!match) continue;
    values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function argValue(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 1);
}

const envPath = [".env.local", ".env"]
  .map((name) => path.join(appDirectory, name))
  .find((filePath) => fs.existsSync(filePath));
if (!envPath) throw new Error("Thiếu .env.local hoặc .env");

const env = loadEnv(envPath);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const syncLimit = Number(argValue("--sync", "5"));
const dataPath = path.join(scriptDirectory, "data", "autolisp-tt-sample.json");
const rows = JSON.parse(fs.readFileSync(dataPath, "utf8"));

function pad(n, w = 4) {
  return String(n).padStart(w, "0");
}

function todayParts() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = pad(now.getMonth() + 1, 2);
  const dd = pad(now.getDate(), 2);
  return { yyyy, mm, dd, yy: yyyy.slice(-2), iso: `${yyyy}-${mm}-${dd}` };
}

async function upsertPoints() {
  const inserts = rows.map((row, index) => ({
    ma_diem: row.code,
    kinh_do: row.lon,
    vi_do: row.lat,
    ly_trinh: row.chainage,
    ghi_chu: `VN2000 X=${row.x} Y=${row.y}`,
    thu_tu: index + 1,
  }));

  // Upsert theo ma_diem — ghi đè toạ độ seed Hà Nội nếu trùng TT0001…
  const { data, error } = await supabase
    .from("toa_do")
    .upsert(inserts, { onConflict: "ma_diem" })
    .select("id, ma_diem, ly_trinh, lich_su_moi_han_id");

  if (error) throw new Error(`Upsert toa_do thất bại: ${error.message}`);
  return data ?? [];
}

async function pickContext() {
  const { data: projects, error: pErr } = await supabase
    .from("du_an")
    .select("id, du_an, ma_du_an")
    .order("du_an", { ascending: true })
    .limit(20);
  if (pErr) throw new Error(`Không đọc du_an: ${pErr.message}`);

  const { data: machines, error: mErr } = await supabase
    .from("thiet_bi")
    .select("id, ma_may, ten_may")
    .order("ma_may", { ascending: true })
    .limit(20);
  if (mErr) throw new Error(`Không đọc thiet_bi: ${mErr.message}`);

  const { data: welders, error: wErr } = await supabase
    .from("nhan_su")
    .select("employee_id, ho_ten, chung_chi")
    .limit(50);
  if (wErr) throw new Error(`Không đọc nhan_su: ${wErr.message}`);

  const project = (projects ?? []).find((p) => p.ma_du_an) ?? projects?.[0];
  const machine = machines?.[0];
  const rawWelder =
    (welders ?? []).find((w) => Array.isArray(w.chung_chi) && w.chung_chi.length > 0) ??
    welders?.[0];
  const welder = rawWelder
    ? { id: rawWelder.employee_id, ho_ten: rawWelder.ho_ten, chung_chi: rawWelder.chung_chi }
    : null;

  if (!project || !machine || !welder) {
    return {
      ok: false,
      reason: `Thiếu dữ liệu nền: dự án=${Boolean(project)}, máy=${Boolean(machine)}, thợ=${Boolean(welder)}`,
      project,
      machine,
      welder,
    };
  }

  const certificates = Array.isArray(welder.chung_chi) ? welder.chung_chi.filter(Boolean) : [];
  return {
    ok: true,
    project: {
      id: project.id,
      ma_du_an: project.ma_du_an,
      ten_du_an: project.du_an,
    },
    machine,
    welder,
    certificate: certificates[0] ?? "",
  };
}

async function nextSystemSeq(sitePrefix, method, day, month, year) {
  const prefix = `${sitePrefix}-${method}-${day}-${month}-${year}-`;
  const { data, error } = await supabase
    .from("lich_su_moi_han")
    .select("ma_lich_su")
    .ilike("ma_lich_su", `${prefix}%`)
    .order("ma_lich_su", { ascending: false })
    .limit(50);
  if (error) {
    // view/table có thể khác tên — fallback seq=1
    console.warn("Không đọc mã hệ thống hiện có:", error.message);
    return 1;
  }
  let max = 0;
  for (const row of data ?? []) {
    const code = String(row.ma_lich_su ?? "");
    const match = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`, "i").exec(code);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

async function syncSample(upserted, context, limit) {
  if (limit <= 0) {
    console.log("Bỏ qua tạo nhật ký (--sync=0).");
    return { created: 0, errors: [] };
  }

  const candidates = upserted
    .filter((row) => !row.lich_su_moi_han_id)
    .sort((a, b) => a.ma_diem.localeCompare(b.ma_diem))
    .slice(0, limit);

  if (!candidates.length) {
    console.log("Không còn điểm TT chưa gắn nhật ký để thử đồng bộ.");
    return { created: 0, errors: [] };
  }

  const { yyyy, mm, dd, yy, iso } = todayParts();
  const sitePrefix = String(context.project.ma_du_an || "PQ")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") || "PQ";
  const method = "FBW";
  let seq = await nextSystemSeq(sitePrefix, method, dd, mm, yy);
  const created = [];
  const errors = [];

  console.log(`\nThử đồng bộ ${candidates.length} điểm → nhật ký (dự án ${context.project.ten_du_an || context.project.ma_du_an})…`);

  for (const point of candidates) {
    const maLichSu = `${sitePrefix}-${method}-${dd}-${mm}-${yy}-${pad(seq)}`;
    const maHienTruong = `${method}-${dd}-${mm}-${yy}-${pad(seq)}`;
    const maMay = `${yyyy}-${Number(mm)}-${Number(dd)}-${pad(seq, 3)}`;
    seq += 1;

    const source = rows.find((r) => r.code === point.ma_diem);
    const rpc = await supabase.rpc("them_nhat_ky_han_co_toa_do_status", {
      p_ma_lich_su: maLichSu,
      p_du_an_id: context.project.id,
      p_tho_han_id: context.welder.id,
      p_nam_thuc_hien: Number(yyyy),
      p_ngay_thuc_hien: iso,
      p_loai_ray: "P50",
      p_loai_moi_han: "Sản xuất",
      p_cong_nghe_han: method,
      p_so_luong_loi: 0,
      p_nguyen_nhan_loi: null,
      p_ghi_chu: `Autolisp ${point.ma_diem}`,
      p_moi_han_lien_ket: null,
      p_may_id: context.machine.id,
      p_chung_chi_su_dung: context.certificate || "FBW",
      p_hach_toan: "HT-SX01",
      p_toa_do_id: point.id,
      p_kinh_do: source?.lon ?? null,
      p_vi_do: source?.lat ?? null,
      p_ly_trinh: point.ly_trinh,
      p_ma_khuyet_tat: null,
      p_tinh_trang_thi_nghiem: "Chờ thí nghiệm",
    });

    if (rpc.error) {
      // Fallback RPC cũ (không có tình trạng thí nghiệm)
      if (rpc.error.code === "PGRST202") {
        const legacy = await supabase.rpc("them_nhat_ky_han_co_toa_do_ndt", {
          p_ma_lich_su: maLichSu,
          p_du_an_id: context.project.id,
          p_tho_han_id: context.welder.id,
          p_nam_thuc_hien: Number(yyyy),
          p_ngay_thuc_hien: iso,
          p_loai_ray: "P50",
          p_loai_moi_han: "Sản xuất",
          p_cong_nghe_han: method,
          p_so_luong_loi: 0,
          p_nguyen_nhan_loi: null,
          p_ghi_chu: `Autolisp ${point.ma_diem}`,
          p_moi_han_lien_ket: null,
          p_may_id: context.machine.id,
          p_chung_chi_su_dung: context.certificate || "FBW",
          p_hach_toan: "HT-SX01",
          p_toa_do_id: point.id,
          p_kinh_do: source?.lon ?? null,
          p_vi_do: source?.lat ?? null,
          p_ly_trinh: point.ly_trinh,
          p_ma_khuyet_tat: null,
        });
        if (legacy.error) {
          errors.push(`${point.ma_diem}: ${legacy.error.message}`);
          continue;
        }
      } else {
        errors.push(`${point.ma_diem}: ${rpc.error.message}`);
        continue;
      }
    }

    // Bổ sung mã hiện trường / mã máy nếu cột tồn tại
    await supabase
      .from("lich_su_moi_han")
      .update({
        ma_hien_truong: maHienTruong,
        ten_moi_han_theo_may: maMay,
      })
      .eq("ma_lich_su", maLichSu);

    // Đảm bảo liên kết toa_do
    const { data: weld } = await supabase
      .from("lich_su_moi_han")
      .select("id")
      .eq("ma_lich_su", maLichSu)
      .maybeSingle();
    if (weld?.id) {
      await supabase.from("toa_do").update({ lich_su_moi_han_id: weld.id }).eq("id", point.id);
    }

    created.push({
      ma_diem: point.ma_diem,
      ma_lich_su: maLichSu,
      ma_hien_truong: maHienTruong,
      ten_moi_han_theo_may: maMay,
      ly_trinh: point.ly_trinh,
    });
    console.log(`  ✓ ${point.ma_diem} → ${maLichSu} · sơn ${maHienTruong} · máy ${maMay}`);
  }

  return { created, errors };
}

async function main() {
  console.log(`Import ${rows.length} điểm Autolisp (TT) vào toa_do…`);
  const upserted = await upsertPoints();
  console.log(`Đã upsert ${upserted.length} dòng.`);

  const sample = upserted.slice(0, 3);
  for (const row of sample) {
    console.log(`  ${row.ma_diem} · ${row.ly_trinh} · linked=${Boolean(row.lich_su_moi_han_id)}`);
  }

  const context = await pickContext();
  if (!context.ok) {
    console.log(`\nChưa thử đồng bộ nhật ký: ${context.reason}`);
    console.log("Import toạ độ xong — mở Nhật ký hàn → Autolisp → nhật ký để tạo hàng loạt trên UI.");
    return;
  }

  console.log(
    `\nNgữ cảnh đồng bộ: dự án=${context.project.ten_du_an || context.project.ma_du_an}, máy=${context.machine.ma_may}, thợ=${context.welder.ho_ten}`,
  );

  const result = await syncSample(upserted, context, Number.isFinite(syncLimit) ? syncLimit : 5);
  if (result.errors?.length) {
    console.log("\nLỗi:");
    for (const err of result.errors.slice(0, 20)) console.log(`  - ${err}`);
  }
  console.log(
    `\nXong. Import ${upserted.length} điểm · tạo thử ${result.created?.length ?? result.created ?? 0} nhật ký.`,
  );
  console.log("Trên UI: Nhật ký hàn → Autolisp → nhật ký để tạo nốt các điểm còn lại.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
