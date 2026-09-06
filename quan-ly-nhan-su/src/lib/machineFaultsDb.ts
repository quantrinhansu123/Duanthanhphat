import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";
import {
  machineFaultLibrary as seedFaults,
  type FaultCase,
  type MachineFault,
  type MachineFaultSection,
} from "@/data/error-library";

type DbFaultRow = {
  id: string;
  nhom: MachineFaultSection;
  stt: number;
  trieu_chung: string;
  nguyen_nhan_khac_phuc: unknown;
  nguon_bang: string;
  active: boolean | null;
};

function parseCases(value: unknown): FaultCase[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const probableCause = String(row.nguyen_nhan ?? row.probableCause ?? "").trim();
      const remedy = String(row.khac_phuc ?? row.remedy ?? "").trim();
      if (!probableCause && !remedy) return null;
      return { probableCause, remedy };
    })
    .filter((item): item is FaultCase => Boolean(item));
}

function rowToFault(row: DbFaultRow): MachineFault {
  return {
    id: row.id,
    section: row.nhom,
    order: row.stt,
    symptom: row.trieu_chung,
    cases: parseCases(row.nguyen_nhan_khac_phuc),
    sourceReference: row.nguon_bang,
    active: row.active !== false,
  };
}

export async function loadMachineFaultLibrary(): Promise<{
  items: MachineFault[];
  source: "supabase" | "seed";
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { items: seedFaults.filter((item) => item.active), source: "seed" };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("thu_vien_loi_thiet_bi")
      .select("id, nhom, stt, trieu_chung, nguyen_nhan_khac_phuc, nguon_bang, active")
      .eq("active", true)
      .order("nhom", { ascending: true })
      .order("stt", { ascending: true });

    if (error) throw error;
    const items = ((data ?? []) as DbFaultRow[]).map(rowToFault);
    if (items.length === 0) {
      return { items: seedFaults.filter((item) => item.active), source: "seed" };
    }
    return { items, source: "supabase" };
  } catch (error) {
    return {
      items: seedFaults.filter((item) => item.active),
      source: "seed",
      error: error instanceof Error ? error.message : formatSupabaseError(error),
    };
  }
}
