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
  created_at?: string;
  updated_at?: string;
};

export type NewToaDoInput = {
  code: string;
  longitude: number;
  latitude: number;
  chainage?: string;
  note?: string;
  order?: number;
};

function rowToMapPoint(row: ToaDoRow): MapPoint {
  return {
    id: row.id,
    code: row.ma_diem,
    longitude: Number(row.kinh_do),
    latitude: Number(row.vi_do),
    chainage: row.ly_trinh ?? "",
    note: row.ghi_chu ?? "",
    projectId: row.du_an_id,
    order: row.thu_tu,
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

/** Lấy danh sách toạ độ từ Supabase (theo thu_tu, ma_diem). */
export async function fetchMapPointsFromDb(options: { limit?: number; force?: boolean } = {}): Promise<MapPointFetchResult> {
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
  let query = supabase
    .from("toa_do")
    .select("id, ma_diem, kinh_do, vi_do, ly_trinh, ghi_chu, thu_tu, du_an_id")
    .order("thu_tu", { ascending: true })
    .order("ma_diem", { ascending: true });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;

  if (error) {
    return { points: seedMapPoints, source: "seed", error: error.message };
  }

  if (!data?.length) {
    return { points: [], source: "supabase" };
  }

  return { points: data.map((r) => rowToMapPoint(r as ToaDoRow)), source: "supabase" };
}

/** Thêm một điểm toạ độ. */
export async function insertMapPoint(input: NewToaDoInput): Promise<{ point?: MapPoint; error?: string }> {
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
    })
    .select("id, ma_diem, kinh_do, vi_do, ly_trinh, ghi_chu, thu_tu, du_an_id")
    .single();

  if (error) return { error: error.message };
  return { point: rowToMapPoint(data as ToaDoRow) };
}

/** Xóa điểm theo id (uuid). */
export async function deleteMapPoint(id: string): Promise<{ error?: string }> {
  if (!hasSupabaseEnv()) {
    return { error: "Chưa cấu hình Supabase env" };
  }
  const supabase = createClient();
  const { error } = await supabase.from("toa_do").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

/** Đẩy 14 điểm mẫu vào DB (bỏ qua mã đã có). */
export async function seedMapPointsToDb(): Promise<{ inserted: number; error?: string }> {
  if (!hasSupabaseEnv()) {
    return { inserted: 0, error: "Chưa cấu hình Supabase env" };
  }

  const rows = seedMapPoints.map((p, i) => ({
    ma_diem: p.code,
    kinh_do: p.longitude,
    vi_do: p.latitude,
    ly_trinh: p.chainage,
    thu_tu: i + 1,
  }));

  const supabase = createClient();
  const { data, error } = await supabase
    .from("toa_do")
    .upsert(rows, { onConflict: "ma_diem", ignoreDuplicates: true })
    .select("id");

  if (error) return { inserted: 0, error: error.message };
  return { inserted: data?.length ?? 0 };
}

/** Upsert nhiều điểm từ Excel (cập nhật nếu trùng ma_diem). */
export async function upsertMapPoints(
  inputs: NewToaDoInput[],
): Promise<{ upserted: number; error?: string }> {
  if (!hasSupabaseEnv()) {
    return { upserted: 0, error: "Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL / ANON_KEY" };
  }
  if (!inputs.length) return { upserted: 0, error: "Không có dòng hợp lệ để lưu" };

  const rows = inputs.map((input, i) => ({
    ma_diem: input.code.trim().toUpperCase(),
    kinh_do: input.longitude,
    vi_do: input.latitude,
    ly_trinh: input.chainage?.trim() || null,
    ghi_chu: input.note?.trim() || null,
    thu_tu: input.order ?? i + 1,
  }));

  const supabase = createClient();
  const { data, error } = await supabase
    .from("toa_do")
    .upsert(rows, { onConflict: "ma_diem" })
    .select("id");

  if (error) return { upserted: 0, error: error.message };
  return { upserted: data?.length ?? rows.length };
}
