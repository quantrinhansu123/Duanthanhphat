import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

export const OIL_LEVEL_UNITS = ["lít", "%", "cm", "mm"] as const;

export type DailyFuelRow = {
  id: string;
  date: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  /** Mức dầu thực tế sau khi đổ (ô «Thực tế» — báo cáo, định mức). */
  liters: number;
  /** Giữ bằng thực tế (không suy ra từ đã đổ). */
  remaining: number;
  /** Tổng các lần đổ trong ngày (nhập ở «Lịch sử cấp phát»). */
  added: number;
  /** Đã có báo cáo «Thực tế» (nhập ở «Sửa báo cáo»); false = chỉ có lần đổ dầu. */
  hasActual: boolean;
  unit: string;
  personId: string;
  personName: string;
  note: string;
  createdAt?: string;
};

export type DailyFuelFormValues = {
  date: string;
  machineId: string;
  /** Đã đổ thêm trong ngày. */
  added: number;
  /** Mức dầu thực tế (sau khi đổ) — dùng so sánh định mức. */
  actual: number;
  unit: string;
  personId: string;
  note: string;
};

/** Hai ô «Đã đổ» và «Thực tế» độc lập, không cộng/trừ nhau. Chỉ cộng dồn các lần «Đã đổ». */
export const fuelLevelAfter = (values: Pick<DailyFuelFormValues, "actual">) =>
  Math.round((Number(values.actual) || 0) * 100) / 100;


type FuelTableRow = {
  id: string;
  ngay: string;
  may: string;
  so_lit: number | string;
  con_lai?: number | string | null;
  do_them?: number | string | null;
  don_vi?: string | null;
  nguoi_cap: string | null;
  ghi_chu: string | null;
  created_at: string;
};

function isMissingUnitColumn(message: string) {
  return /don_vi/i.test(message) && /schema cache|column|does not exist|42703/i.test(message);
}

function isMissingSplitColumn(message: string) {
  return /con_lai|do_them/i.test(message) && /schema cache|column|does not exist|42703/i.test(message);
}

export async function loadDailyFuelRows(): Promise<{ rows: DailyFuelRow[]; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { rows: [], error: "Chưa cấu hình Supabase" };
  }
  const supabase = createClient();
  let withUnit = await supabase
    .from("cap_dau_hang_ngay")
    .select("id,ngay,may,so_lit,con_lai,do_them,don_vi,nguoi_cap,ghi_chu,created_at")
    .order("ngay", { ascending: false })
    .order("id", { ascending: false });
  // Chưa chạy migration con_lai / do_them → đọc như cũ (còn lại = mức dầu, đổ thêm = 0).
  if (withUnit.error && isMissingSplitColumn(formatSupabaseError(withUnit.error))) {
    withUnit = (await supabase
      .from("cap_dau_hang_ngay")
      .select("id,ngay,may,so_lit,don_vi,nguoi_cap,ghi_chu,created_at")
      .order("ngay", { ascending: false })
      .order("id", { ascending: false })) as unknown as typeof withUnit;
  }

  let tableRows = (withUnit.data ?? []) as FuelTableRow[];
  if (withUnit.error) {
    const message = formatSupabaseError(withUnit.error);
    if (/cap_dau_hang_ngay|relation|does not exist|42P01/i.test(message)) {
      return {
        rows: [],
        error:
          "Cần chạy migration_20260926_cap_dau_hang_ngay.sql trên Supabase để bật báo cáo mức dầu.",
      };
    }
    if (!isMissingUnitColumn(message)) return { rows: [], error: message };
    const plain = await supabase
      .from("cap_dau_hang_ngay")
      .select("id,ngay,may,so_lit,nguoi_cap,ghi_chu,created_at")
      .order("ngay", { ascending: false })
      .order("id", { ascending: false });
    if (plain.error) return { rows: [], error: formatSupabaseError(plain.error) };
    tableRows = (plain.data ?? []) as FuelTableRow[];
  }

  const [machines, people] = await Promise.all([
    supabase.from("thiet_bi").select("id,ma_may,ten_may"),
    supabase.from("nhan_su").select("employee_id,ho_ten"),
  ]);
  const machineById = new Map(
    ((machines.data ?? []) as { id: string; ma_may: string; ten_may: string }[]).map((row) => [row.id, row]),
  );
  const personById = new Map(
    ((people.data ?? []) as { employee_id: string; ho_ten: string }[]).map((row) => [row.employee_id, row.ho_ten]),
  );

  return {
    rows: tableRows.map((row) => {
      const machine = machineById.get(row.may);
      return {
        id: row.id,
        date: row.ngay,
        machineId: row.may,
        machineCode: machine?.ma_may || "—",
        machineName: machine?.ten_may || "",
        liters: Number(row.so_lit) || 0,
        remaining: row.con_lai == null ? Number(row.so_lit) || 0 : Number(row.con_lai) || 0,
        added: row.do_them == null ? 0 : Number(row.do_them) || 0,
        hasActual: row.con_lai === undefined ? true : row.con_lai !== null,
        unit: row.don_vi?.trim() || "lít",
        personId: row.nguoi_cap?.trim() || "",
        personName: (row.nguoi_cap && personById.get(row.nguoi_cap)?.trim()) || "—",
        note: row.ghi_chu?.trim() || "",
        createdAt: row.created_at,
      };
    }),
  };
}

/** Ghi một báo cáo dầu và trả về id dòng đã lưu (để cập nhật danh sách tại chỗ, không tải lại). */
export async function upsertDailyFuel(values: DailyFuelFormValues, id?: string, mode: "report" | "refill" = "report"): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase");
  }
  const supabase = createClient();
  // «Sửa báo cáo» chỉ ghi Thực tế; «Lịch sử cấp phát» chỉ ghi số đã đổ — mỗi luồng không đụng vào ô của luồng kia.
  const payload: Record<string, unknown> = {
    ngay: values.date,
    may: values.machineId,
    ...(mode === "report"
      ? { so_lit: Math.max(0, fuelLevelAfter(values)), con_lai: Math.max(0, fuelLevelAfter(values)) }
      : { do_them: Math.max(0, Number(values.added) || 0) }),
    don_vi: values.unit.trim() || "lít",
    bom_mo: false,
    nguoi_cap: values.personId.trim() || null,
    ghi_chu: values.note.trim() || null,
  };

  const write = async (body: Record<string, unknown>) => {
    if (id) return supabase.from("cap_dau_hang_ngay").update(body).eq("id", id).select("id").single();
    return supabase.from("cap_dau_hang_ngay").upsert(body, { onConflict: "may,ngay" }).select("id").single();
  };

  let { data, error } = await write(payload);
  if (error && mode === "refill" && isMissingSplitColumn(formatSupabaseError(error))) {
    throw new Error("Cần chạy migration_20261123_cap_dau_con_lai_do_them.sql trên Supabase để ghi số đã đổ.");
  }
  if (error && isMissingSplitColumn(formatSupabaseError(error))) {
    const { con_lai: _r, do_them: _a, ...withoutSplit } = payload;
    ({ data, error } = await write(withoutSplit));
  }
  if (error && isMissingUnitColumn(formatSupabaseError(error))) {
    const { don_vi: _unit, ...withoutUnit } = payload;
    ({ data, error } = await write(withoutUnit));
  }
  if (error || !data) throw new Error(error ? formatSupabaseError(error) : "Không lưu được báo cáo mức dầu");
  return String(data.id);
}

/** Xóa riêng số đã đổ của một dòng (giữ báo cáo Thực tế). */
export async function clearDailyFuelRefill(id: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase");
  }
  const supabase = createClient();
  const { error } = await supabase.from("cap_dau_hang_ngay").update({ do_them: 0 }).eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function deleteDailyFuel(id: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase");
  }
  const supabase = createClient();
  const { error } = await supabase.from("cap_dau_hang_ngay").delete().eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}

export function formatFuelDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
