import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type TongMoiHanNamRow = {
  nam: number;
  tong_moi_han: number;
  tong_loi: number;
  tong_dat: number;
  fbw: number;
  atw: number;
  loi_fbw: number;
  loi_atw: number;
  san_xuat: number;
  thu_nghiem: number;
  dao_tao: number;
  loi_san_xuat: number;
  loi_thu_nghiem: number;
  loi_dao_tao: number;
};

export type TongMoiHanNamDuAnRow = TongMoiHanNamRow & {
  du_an_id: string;
  ma_du_an: string | null;
  du_an: string;
};

export type TongMoiHanNamNhanSuRow = TongMoiHanNamRow & {
  tho_han_id: string;
  ma_nhan_su: string | null;
  ten_tho_han: string;
};

export type TongMoiHanNamPhuongPhapRow = {
  nam: number;
  cong_nghe_han: "FBW" | "ATW";
  tong_moi_han: number;
  tong_loi: number;
  tong_dat: number;
  san_xuat: number;
  thu_nghiem: number;
  dao_tao: number;
};

export type TongMoiHanNamLoaiMoiRow = {
  nam: number;
  loai_moi_han: "Sản xuất" | "Thử nghiệm" | "Đào tạo";
  tong_moi_han: number;
  tong_loi: number;
  tong_dat: number;
  fbw: number;
  atw: number;
};

export type TongMoiHanNamBundle = {
  years: TongMoiHanNamRow[];
  byProject: TongMoiHanNamDuAnRow[];
  byPersonnel: TongMoiHanNamNhanSuRow[];
  byMethod: TongMoiHanNamPhuongPhapRow[];
  byWeldType: TongMoiHanNamLoaiMoiRow[];
  source: "supabase" | "empty";
  error?: string;
};

let cache: Promise<TongMoiHanNamBundle> | null = null;

export function invalidateTongMoiHanNamCache() {
  cache = null;
}

export function loadTongMoiHanNam() {
  if (!cache) {
    cache = fetchTongMoiHanNam().catch((error) => {
      cache = null;
      throw error;
    });
  }
  return cache;
}

async function fetchTongMoiHanNam(): Promise<TongMoiHanNamBundle> {
  if (!isSupabaseConfigured()) {
    return {
      years: [],
      byProject: [],
      byPersonnel: [],
      byMethod: [],
      byWeldType: [],
      source: "empty",
      error: "Chưa cấu hình Supabase",
    };
  }

  const supabase = createClient();

  const [yearsRes, projectRes, personnelRes, methodRes, weldTypeRes] = await Promise.all([
    supabase.from("tong_moi_han_nam").select("*").order("nam", { ascending: true }),
    supabase.from("tong_moi_han_nam_du_an").select("*").order("nam", { ascending: true }),
    supabase.from("tong_moi_han_nam_nhan_su").select("*").order("nam", { ascending: true }),
    supabase.from("tong_moi_han_nam_phuong_phap").select("*").order("nam", { ascending: true }),
    supabase.from("tong_moi_han_nam_loai_moi").select("*").order("nam", { ascending: true }),
  ]);

  const firstError =
    yearsRes.error?.message ||
    projectRes.error?.message ||
    personnelRes.error?.message ||
    methodRes.error?.message ||
    weldTypeRes.error?.message;

  if (firstError) {
    return {
      years: [],
      byProject: [],
      byPersonnel: [],
      byMethod: [],
      byWeldType: [],
      source: "empty",
      error: firstError,
    };
  }

  return {
    years: (yearsRes.data ?? []) as TongMoiHanNamRow[],
    byProject: (projectRes.data ?? []) as TongMoiHanNamDuAnRow[],
    byPersonnel: (personnelRes.data ?? []) as TongMoiHanNamNhanSuRow[],
    byMethod: (methodRes.data ?? []) as TongMoiHanNamPhuongPhapRow[],
    byWeldType: (weldTypeRes.data ?? []) as TongMoiHanNamLoaiMoiRow[],
    source: "supabase",
  };
}

/** Lọc tổng năm theo khoảng năm (từ dateFrom/dateTo ISO). */
export function filterYearTotals(
  rows: TongMoiHanNamRow[],
  dateFrom: string,
  dateTo: string,
  methods: string[] = [],
  weldTypes: string[] = [],
) {
  const startYear = Number(dateFrom.slice(0, 4));
  const endYear = Number(dateTo.slice(0, 4));
  return rows
    .filter((row) => row.nam >= startYear && row.nam <= endYear)
    .map((row) => {
      let actual = row.tong_moi_han;
      let defects = row.tong_loi;
      let target = row.tong_moi_han; // mặc định; caller có thể gắn định mức riêng

      if (methods.length === 1 && methods[0] === "FBW") {
        actual = row.fbw;
        defects = row.loi_fbw;
      } else if (methods.length === 1 && methods[0] === "ATW") {
        actual = row.atw;
        defects = row.loi_atw;
      } else if (methods.length === 2) {
        actual = row.fbw + row.atw;
        defects = row.loi_fbw + row.loi_atw;
      }

      if (weldTypes.length > 0 && weldTypes.length < 3) {
        let typed = 0;
        let typedLoi = 0;
        if (weldTypes.includes("Sản xuất")) {
          typed += row.san_xuat;
          typedLoi += row.loi_san_xuat;
        }
        if (weldTypes.includes("Thử nghiệm")) {
          typed += row.thu_nghiem;
          typedLoi += row.loi_thu_nghiem;
        }
        if (weldTypes.includes("Đào tạo")) {
          typed += row.dao_tao;
          typedLoi += row.loi_dao_tao;
        }
        // Khi lọc loại mối: ưu tiên số theo loại; phương pháp đã cắt ở trên chỉ là gần đúng trên tổng năm.
        if (methods.length === 0) {
          actual = typed;
          defects = typedLoi;
        }
      }

      return {
        year: String(row.nam),
        date: `${row.nam}-01-01`,
        value: actual,
        target,
        defects,
        passed: Math.max(0, actual - defects),
        raw: row,
      };
    });
}
