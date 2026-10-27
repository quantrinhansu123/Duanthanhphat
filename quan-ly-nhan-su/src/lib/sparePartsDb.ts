import { createClient } from "@/lib/supabase/client";
import { spareParts as seedParts, type SparePart, type SparePartStatus } from "@/data/spareParts";

const TABLE = "phu_tung_thay_the";

type Row = {
  id: string;
  ma_phu_tung: string;
  ten_phu_tung: string;
  nha_san_xuat: string | null;
  model_tuong_thich: string[] | null;
  nhom: string | null;
  don_vi: string | null;
  ton_kho: number | null;
  ton_toi_thieu: number | null;
  don_gia_vnd: number | null;
  trang_thai: string | null;
  ghi_chu: string | null;
};

function fromRow(row: Row): SparePart {
  return {
    id: row.id,
    code: row.ma_phu_tung,
    name: row.ten_phu_tung,
    manufacturer: row.nha_san_xuat ?? "",
    compatibleModels: row.model_tuong_thich ?? [],
    category: row.nhom ?? "Khác",
    unit: row.don_vi ?? "cái",
    stockQty: Number(row.ton_kho ?? 0),
    minStock: Number(row.ton_toi_thieu ?? 0),
    unitPriceVnd: Number(row.don_gia_vnd ?? 0),
    status: (row.trang_thai ?? "Còn hàng") as SparePartStatus,
    note: row.ghi_chu ?? "",
  };
}

function toRow(part: SparePart) {
  return {
    ma_phu_tung: part.code,
    ten_phu_tung: part.name,
    nha_san_xuat: part.manufacturer,
    model_tuong_thich: part.compatibleModels,
    nhom: part.category,
    don_vi: part.unit,
    ton_kho: part.stockQty,
    ton_toi_thieu: part.minStock,
    don_gia_vnd: part.unitPriceVnd,
    trang_thai: part.status,
    ghi_chu: part.note,
  };
}

function formatError(error: { code?: string; message: string }) {
  if (error.code === "23505") return "Mã phụ tùng đã tồn tại.";
  if (error.code === "42P01" || /schema cache|does not exist/i.test(error.message)) {
    return "Chưa có bảng phu_tung_thay_the trong database — chạy migration_20261027_phu_tung_thay_the.sql.";
  }
  return error.message;
}

/** Danh sách phụ tùng; chưa có bảng thì trả dữ liệu mẫu kèm cảnh báo (chưa lưu được). */
export async function loadSpareParts(): Promise<{ parts: SparePart[]; persisted: boolean; error?: string }> {
  const { data, error } = await createClient().from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) return { parts: seedParts, persisted: false, error: formatError(error) };
  return { parts: (data as Row[]).map(fromRow), persisted: true };
}

export async function insertSparePart(part: SparePart): Promise<{ part?: SparePart; error?: string }> {
  const { data, error } = await createClient().from(TABLE).insert(toRow(part)).select("*").single();
  if (error) return { error: formatError(error) };
  return { part: fromRow(data as Row) };
}

export async function updateSparePart(part: SparePart): Promise<{ part?: SparePart; error?: string }> {
  const { data, error } = await createClient().from(TABLE).update(toRow(part)).eq("id", part.id).select("*").single();
  if (error) return { error: formatError(error) };
  return { part: fromRow(data as Row) };
}

export async function deleteSpareParts(ids: string[]): Promise<{ error?: string }> {
  const { error } = await createClient().from(TABLE).delete().in("id", ids);
  return error ? { error: formatError(error) } : {};
}
