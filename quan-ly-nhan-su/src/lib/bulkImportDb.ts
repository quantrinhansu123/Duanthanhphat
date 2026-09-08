import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/env";

export type ProjectWeldRow = {
  id: string;
  ma_lich_su: string;
  ma_du_an: string;
  du_an: string;
  nam_thuc_hien: number;
  loai_ray: string;
  loai_moi_han: "Thử nghiệm" | "Đào tạo" | "Sản xuất";
  cong_nghe_han: "FBW" | "ATW";
  so_luong_thuc_hien: number;
  so_luong_loi: number;
  ma_nhan_su: string;
  ten_tho_han: string;
  nguyen_nhan_loi: string | null;
};

export type WelderSummaryRow = {
  tho_han_id: string;
  ma_nhan_su: string;
  ho_ten: string;
  thuc_hien_fbw: number;
  thuc_hien_atw: number;
  loi_fbw: number;
  loi_atw: number;
  tong_thuc_hien: number;
  tong_loi: number;
};

export type YearSummaryRow = {
  nam_thuc_hien: number;
  thu_nghiem_dao_tao_fbw: number;
  thu_nghiem_dao_tao_atw: number;
  san_xuat_fbw: number;
  san_xuat_atw: number;
  loi_fbw: number;
  loi_atw: number;
  tong_thuc_hien: number;
  tong_loi: number;
};

export type WeldData = {
  projects: ProjectWeldRow[];
  welders: WelderSummaryRow[];
  years: YearSummaryRow[];
};

// Read in bounded pages so Supabase's response limit cannot truncate totals.
async function readAllRows<T>(
  queryPage: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: unknown;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await queryPage(rows.length, rows.length + pageSize - 1);
    if (error) throw new Error(formatSupabaseError(error));
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length === 0) return rows;
  }
}

export async function fetchBulkImportData(): Promise<WeldData> {
  const supabase = createClient();
  const [projects, welders, years] = await Promise.all([
    readAllRows<ProjectWeldRow>((from, to) => supabase
      .from("bao_cao_moi_han_theo_du_an")
      .select("id,ma_lich_su,ma_du_an,du_an,nam_thuc_hien,loai_ray,loai_moi_han,cong_nghe_han,so_luong_thuc_hien,so_luong_loi,ma_nhan_su,ten_tho_han,nguyen_nhan_loi")
      .order("ngay_thuc_hien", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(from, to)),
    readAllRows<WelderSummaryRow>((from, to) => supabase
      .from("bao_cao_moi_han_theo_tho")
      .select("tho_han_id,ma_nhan_su,ho_ten,thuc_hien_fbw,thuc_hien_atw,loi_fbw,loi_atw,tong_thuc_hien,tong_loi")
      .order("ma_nhan_su", { ascending: true })
      .order("tho_han_id", { ascending: true })
      .range(from, to)),
    readAllRows<YearSummaryRow>((from, to) => supabase
      .from("bao_cao_moi_han_theo_nam")
      .select("nam_thuc_hien,thu_nghiem_dao_tao_fbw,thu_nghiem_dao_tao_atw,san_xuat_fbw,san_xuat_atw,loi_fbw,loi_atw,tong_thuc_hien,tong_loi")
      .order("nam_thuc_hien", { ascending: true })
      .range(from, to)),
  ]);
  return { projects, welders, years };
}
