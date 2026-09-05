import { createClient } from "@/lib/supabase/client";
import { mapPoints as seedMapPoints, type MapPoint } from "@/data/mapPoints";

export type ToaDoRow = {
  id: string;
  ma_diem: string;
  kinh_do: number;
  vi_do: number;
  ly_trinh: string | null;
  ghi_chu: string | null;
  thu_tu: number;
  du_an_id: string | null;
  lich_su_moi_han_id?: string | null;
  // Các cột từ view bao_cao_moi_han_gps
  toa_do_id?: string;
  ly_trinh_toa_do?: string | null;
  ghi_chu_toa_do?: string | null;
  moi_han_id?: string | null;
  ma_lich_su?: string | null;
  ngay_thuc_hien?: string | null;
  ket_qua_moi_han?: string | null;
  ten_tho_han?: string | null;
  ma_may?: string | null;
  ten_may?: string | null;
  ten_du_an?: string | null;
};

export type NewToaDoInput = {
  code: string;
  longitude: number;
  latitude: number;
  chainage?: string;
  note?: string;
  order?: number;
  weldId?: string;
};

function rowToMapPoint(row: ToaDoRow): MapPoint {
  const isLinked = Boolean(row.lich_su_moi_han_id || row.moi_han_id);
  const machine = row.ma_may
    ? `${row.ma_may}${row.ten_may ? ` · ${row.ten_may}` : ""}`
    : undefined;

  return {
    id: row.toa_do_id || row.id,
    code: row.ma_diem,
    longitude: Number(row.kinh_do),
    latitude: Number(row.vi_do),
    chainage: row.ly_trinh_toa_do ?? row.ly_trinh ?? "",
    note: row.ghi_chu_toa_do ?? row.ghi_chu ?? "",
    projectId: row.du_an_id,
    order: row.thu_tu,
    weldId: row.lich_su_moi_han_id || row.moi_han_id || null,
    weldCode: row.ma_lich_su || null,
    welderName: row.ten_tho_han || null,
    machineName: machine || null,
    projectName: row.ten_du_an || null,
    result: row.ket_qua_moi_han || null,
    performedDate: row.ngay_thuc_hien || null,
    isLinked,
  };
}

type MapPointFetchResult = {
  points: MapPoint[];
  source: "supabase" | "seed";
  error?: string;
};

const mapPointRequests = new Map<string, Promise<MapPointFetchResult>>();

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

/** Lấy danh sách toạ độ từ Supabase: ưu tiên view bao_cao_moi_han_gps */
export async function fetchMapPointsFromDb(
  options: { limit?: number; force?: boolean } = {},
): Promise<MapPointFetchResult> {
  const { limit, force = false } = options;
  if (force) mapPointRequests.clear();
  const cacheKey = limit ? `limit:${limit}` : "all";
  const cached = mapPointRequests.get(cacheKey);
  if (cached) return cached;

  const request = fetchMapPoints(limit);
  mapPointRequests.set(cacheKey, request);
  const result = await request;
  if (result.error) mapPointRequests.delete(cacheKey);
  return result;
}

async function fetchMapPoints(limit?: number): Promise<MapPointFetchResult> {
  if (!hasSupabaseEnv()) {
    return { points: seedMapPoints, source: "seed", error: "Chưa cấu hình Supabase env" };
  }

  const supabase = createClient();

  // 1. Thử truy vấn từ view, phân trang để không bị giới hạn max-rows của PostgREST.
  const pageSize = 1000;
  const viewRows: ToaDoRow[] = [];
  let viewError = "";
  for (let offset = 0; ; offset += pageSize) {
    let queryView = supabase
      .from("bao_cao_moi_han_gps")
      .select("*")
      .order("thu_tu", { ascending: true })
      .order("ma_diem", { ascending: true });
    queryView = limit
      ? queryView.limit(limit)
      : queryView.range(offset, offset + pageSize - 1);
    const viewRes = await queryView;
    if (viewRes.error) {
      viewError = viewRes.error.message;
      break;
    }
    const page = (viewRes.data ?? []) as ToaDoRow[];
    viewRows.push(...page);
    if (limit || page.length < pageSize) break;
  }

  if (!viewError) {
    return { points: viewRows.map(rowToMapPoint), source: "supabase" };
  }

  // 2. Nếu view chưa tạo, fallback về bảng toa_do và vẫn phân trang đầy đủ.
  const tableRows: ToaDoRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("toa_do")
      .select("id, ma_diem, kinh_do, vi_do, ly_trinh, ghi_chu, thu_tu, du_an_id, lich_su_moi_han_id")
      .order("thu_tu", { ascending: true })
      .order("ma_diem", { ascending: true });
    query = limit ? query.limit(limit) : query.range(offset, offset + pageSize - 1);
    const { data, error } = await query;
    if (error) return { points: seedMapPoints, source: "seed", error: error.message };
    const page = (data ?? []) as ToaDoRow[];
    tableRows.push(...page);
    if (limit || page.length < pageSize) break;
  }

  return { points: tableRows.map(rowToMapPoint), source: "supabase" };
}

/** Lấy danh sách điểm GPS chưa liên kết với mối hàn nào */
export async function fetchUnlinkedGpsPoints(): Promise<MapPoint[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("toa_do")
    .select("id, ma_diem, kinh_do, vi_do, ly_trinh, ghi_chu, thu_tu, du_an_id, lich_su_moi_han_id")
    .is("lich_su_moi_han_id", null)
    .order("thu_tu", { ascending: true });

  if (error || !data) return [];
  return data.map((r) => rowToMapPoint(r as ToaDoRow));
}

/** Thêm một điểm toạ độ mới */
export async function insertMapPoint(
  input: NewToaDoInput,
): Promise<{ point?: MapPoint; error?: string }> {
  if (!hasSupabaseEnv()) {
    return { error: "Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL / ANON_KEY" };
  }

  const code = input.code.trim().toUpperCase();
  if (!code) return { error: "Nhập mã điểm" };
  if (!Number.isFinite(input.longitude) || !Number.isFinite(input.latitude)) {
    return { error: "Kinh độ / vĩ độ không hợp lệ" };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("toa_do")
    .insert({
      ma_diem: code,
      kinh_do: input.longitude,
      vi_do: input.latitude,
      ly_trinh: input.chainage?.trim() || null,
      ghi_chu: input.note?.trim() || null,
      thu_tu: input.order ?? 0,
      lich_su_moi_han_id: input.weldId || null,
    })
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { point: rowToMapPoint(data as ToaDoRow) };
}

/** Liên kết điểm GPS với mối hàn */
export async function linkGpsPointToWeld(pointId: string, weldId: string): Promise<boolean> {
  if (!hasSupabaseEnv()) return false;
  const supabase = createClient();
  const { error } = await supabase
    .from("toa_do")
    .update({ lich_su_moi_han_id: weldId })
    .eq("id", pointId);
  return !error;
}

export async function deleteMapPoint(id: string): Promise<{ error?: string }> {
  if (!hasSupabaseEnv()) return { error: "Chưa cấu hình Supabase" };
  const supabase = createClient();
  const { error } = await supabase.from("toa_do").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function upsertMapPoints(
  rows: NewToaDoInput[],
): Promise<{ upserted?: number; error?: string }> {
  if (!hasSupabaseEnv()) return { error: "Chưa cấu hình Supabase" };
  if (!rows.length) return { upserted: 0 };
  const supabase = createClient();
  const inserts = rows.map((r, idx) => ({
    ma_diem: r.code.trim().toUpperCase(),
    kinh_do: r.longitude,
    vi_do: r.latitude,
    ly_trinh: r.chainage?.trim() || null,
    ghi_chu: r.note?.trim() || null,
    thu_tu: r.order ?? idx + 1,
    lich_su_moi_han_id: r.weldId || null,
  }));
  const { error, data } = await supabase
    .from("toa_do")
    .upsert(inserts, { onConflict: "ma_diem" })
    .select("id");
  if (error) return { error: error.message };
  return { upserted: data?.length ?? inserts.length };
}

export async function seedMapPointsToDb(): Promise<{ inserted?: number; error?: string }> {
  if (!hasSupabaseEnv()) return { error: "Chưa cấu hình Supabase" };
  const seedInputs: NewToaDoInput[] = seedMapPoints.map((p, idx) => ({
    code: p.code,
    longitude: p.longitude,
    latitude: p.latitude,
    chainage: p.chainage,
    note: p.note,
    order: p.order ?? idx + 1,
  }));
  const res = await upsertMapPoints(seedInputs);
  return { inserted: res.upserted, error: res.error };
}
