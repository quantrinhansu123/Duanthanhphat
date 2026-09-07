/**
 * Đồng bộ du_an.tien_do_ly_thuyet: dự kiến = thực tế + 5.
 * - Có ngày: mỗi ngày count(bản ghi) + 5
 * - Chỉ có năm: mốc YYYY-01-01 = count năm đó + 5
 *
 * Chạy: node --env-file=.env.local scripts/sync-dinh-muc-moi-han.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fetchAllHistory(projectId) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("lich_su_moi_han")
      .select("ngay_thuc_hien,nam_thuc_hien")
      .eq("du_an_id", projectId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function buildPlan(rows) {
  const byDate = new Map();
  const byYear = new Map();

  for (const row of rows) {
    const ngay = row.ngay_thuc_hien ? String(row.ngay_thuc_hien).slice(0, 10) : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(ngay)) {
      byDate.set(ngay, (byDate.get(ngay) ?? 0) + 1);
      continue;
    }
    const nam = Number(row.nam_thuc_hien);
    if (Number.isFinite(nam) && nam >= 1990 && nam <= 2100) {
      byYear.set(nam, (byYear.get(nam) ?? 0) + 1);
    }
  }

  const tienDo = [];
  for (const [ngay, thucTe] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    tienDo.push({ ngay, so_moi_han: thucTe + 5 });
  }
  for (const [nam, thucTe] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const ngay = `${nam}-01-01`;
    // Nếu năm đó đã có ngày chi tiết thì không thêm mốc năm (tránh cộng trùng).
    const hasDailyInYear = [...byDate.keys()].some((d) => d.startsWith(`${nam}-`));
    if (hasDailyInYear) continue;
    tienDo.push({ ngay, so_moi_han: thucTe + 5 });
  }

  tienDo.sort((a, b) => a.ngay.localeCompare(b.ngay));
  return tienDo;
}

async function syncOne(project) {
  const rows = await fetchAllHistory(project.id);
  const tienDo = buildPlan(rows);
  const tong = tienDo.reduce((sum, row) => sum + row.so_moi_han, 0);
  const ngayBatDau = tienDo[0]?.ngay ?? null;
  const ngayKetThuc = tienDo[tienDo.length - 1]?.ngay ?? null;

  const patch = {
    tien_do_ly_thuyet: tienDo,
    tong_moi_han_du_kien: tong,
    updated_at: new Date().toISOString(),
  };
  if (ngayBatDau) patch.ngay_bat_dau = ngayBatDau;
  if (ngayKetThuc) patch.ngay_ket_thuc = ngayKetThuc;

  const { error: updateError } = await supabase.from("du_an").update(patch).eq("id", project.id);
  if (updateError) throw new Error(`${project.du_an}: ${updateError.message}`);

  // Trigger chia đều có thể ghi đè — ghi lại định mức chính xác.
  const { error: overwriteError } = await supabase
    .from("du_an")
    .update({
      tien_do_ly_thuyet: tienDo,
      tong_moi_han_du_kien: tong,
    })
    .eq("id", project.id);
  if (overwriteError) throw new Error(`${project.du_an} (overwrite): ${overwriteError.message}`);

  return {
    name: project.du_an,
    history: rows.length,
    days: tienDo.length,
    tong,
    sample: tienDo.slice(0, 3),
  };
}

async function main() {
  const { data: rpcCount, error: rpcError } = await supabase.rpc("dong_bo_dinh_muc_moi_han_tat_ca");
  if (!rpcError) {
    console.log(`RPC OK · ${rpcCount} dự án (cần SQL mới hỗ trợ cả bản ghi chỉ có năm)`);
  } else {
    console.log(`RPC chưa sẵn sàng · đồng bộ bằng client (${rpcError.message})`);
  }

  const { data: projects, error } = await supabase
    .from("du_an")
    .select("id,du_an,ma_du_an")
    .order("du_an");
  if (error) throw error;

  let synced = 0;
  let tongKh = 0;
  for (const project of projects ?? []) {
    const result = await syncOne(project);
    synced += 1;
    tongKh += result.tong;
    console.log(
      `- ${result.name}: ${result.history} bản ghi · ${result.days} mốc · KH ${result.tong}` +
        (result.sample.length
          ? ` · ví dụ ${result.sample.map((r) => `${r.ngay}=${r.so_moi_han}`).join(", ")}`
          : " · chưa có nhật ký"),
    );
  }
  console.log(`Xong · ${synced} dự án · tổng KH ${tongKh} (dự kiến = thực tế + 5)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
