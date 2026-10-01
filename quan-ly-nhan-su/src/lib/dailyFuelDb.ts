import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

export const OIL_LEVEL_UNITS = ["lít", "%", "cm", "mm"] as const;

export type DailyFuelRow = {
  id: string;
  date: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  liters: number;
  unit: string;
  personId: string;
  personName: string;
  note: string;
  createdAt?: string;
};

export type DailyFuelFormValues = {
  date: string;
  machineId: string;
  liters: number;
  unit: string;
  personId: string;
  note: string;
};

type FuelTableRow = {
  id: string;
  ngay: string;
  may: string;
  so_lit: number | string;
  don_vi?: string | null;
  nguoi_cap: string | null;
  ghi_chu: string | null;
  created_at: string;
};

function isMissingUnitColumn(message: string) {
  return /don_vi/i.test(message) && /schema cache|column|does not exist|42703/i.test(message);
}

export async function loadDailyFuelRows(): Promise<{ rows: DailyFuelRow[]; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { rows: [], error: "Chưa cấu hình Supabase" };
  }
  const supabase = createClient();
  const withUnit = await supabase
    .from("cap_dau_hang_ngay")
    .select("id,ngay,may,so_lit,don_vi,nguoi_cap,ghi_chu,created_at")
    .order("ngay", { ascending: false })
    .order("id", { ascending: false });

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
        unit: row.don_vi?.trim() || "lít",
        personId: row.nguoi_cap?.trim() || "",
        personName: (row.nguoi_cap && personById.get(row.nguoi_cap)?.trim()) || "—",
        note: row.ghi_chu?.trim() || "",
        createdAt: row.created_at,
      };
    }),
  };
}

export async function upsertDailyFuel(values: DailyFuelFormValues, id?: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase");
  }
  const supabase = createClient();
  const payload: Record<string, unknown> = {
    ngay: values.date,
    may: values.machineId,
    so_lit: Math.max(0, Number(values.liters) || 0),
    don_vi: values.unit.trim() || "lít",
    bom_mo: false,
    nguoi_cap: values.personId.trim() || null,
    ghi_chu: values.note.trim() || null,
  };

  const write = async (body: Record<string, unknown>) => {
    if (id) return supabase.from("cap_dau_hang_ngay").update(body).eq("id", id);
    return supabase.from("cap_dau_hang_ngay").upsert(body, { onConflict: "may,ngay" });
  };

  let { error } = await write(payload);
  if (error && isMissingUnitColumn(formatSupabaseError(error))) {
    const { don_vi: _unit, ...withoutUnit } = payload;
    ({ error } = await write(withoutUnit));
  }
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
