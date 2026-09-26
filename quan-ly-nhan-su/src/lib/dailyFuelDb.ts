import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

export type DailyFuelRow = {
  id: string;
  date: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  liters: number;
  pumpOpened: boolean;
  personId: string;
  personName: string;
  note: string;
  createdAt?: string;
};

export type DailyFuelFormValues = {
  date: string;
  machineId: string;
  liters: number;
  pumpOpened: boolean;
  personId: string;
  note: string;
};

type ViewRow = {
  id: string;
  ngay: string;
  may_id: string;
  ma_may: string;
  ten_may: string;
  so_lit: number | string;
  bom_mo: boolean | null;
  nguoi_cap_id: string | null;
  nguoi_cap: string | null;
  ghi_chu: string | null;
  created_at: string;
};

function mapRow(row: ViewRow): DailyFuelRow {
  return {
    id: row.id,
    date: row.ngay,
    machineId: row.may_id,
    machineCode: row.ma_may,
    machineName: row.ten_may,
    liters: Number(row.so_lit) || 0,
    pumpOpened: row.bom_mo === true,
    personId: row.nguoi_cap_id?.trim() || "",
    personName: row.nguoi_cap?.trim() || "—",
    note: row.ghi_chu?.trim() || "",
    createdAt: row.created_at,
  };
}

export async function loadDailyFuelRows(): Promise<{ rows: DailyFuelRow[]; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { rows: [], error: "Chưa cấu hình Supabase" };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bao_cao_cap_dau_hang_ngay")
    .select("id,ngay,may_id,ma_may,ten_may,so_lit,bom_mo,nguoi_cap_id,nguoi_cap,ghi_chu,created_at")
    .order("ngay", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    const message = formatSupabaseError(error);
    if (/bao_cao_cap_dau_hang_ngay|cap_dau_hang_ngay|relation|does not exist|42P01/i.test(message)) {
      return {
        rows: [],
        error:
          "Cần chạy migration_20260926_cap_dau_hang_ngay.sql trên Supabase để bật mục Cấp dầu hàng ngày.",
      };
    }
    return { rows: [], error: message };
  }

  return { rows: ((data ?? []) as ViewRow[]).map(mapRow) };
}

export async function upsertDailyFuel(values: DailyFuelFormValues, id?: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase");
  }
  const supabase = createClient();
  const payload = {
    ngay: values.date,
    may: values.machineId,
    so_lit: Math.max(0, Number(values.liters) || 0),
    bom_mo: values.pumpOpened,
    nguoi_cap: values.personId.trim() || null,
    ghi_chu: values.note.trim() || null,
  };

  if (id) {
    const { error } = await supabase.from("cap_dau_hang_ngay").update(payload).eq("id", id);
    if (error) throw new Error(formatSupabaseError(error));
    return;
  }

  const { error } = await supabase.from("cap_dau_hang_ngay").upsert(payload, {
    onConflict: "may,ngay",
  });
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
