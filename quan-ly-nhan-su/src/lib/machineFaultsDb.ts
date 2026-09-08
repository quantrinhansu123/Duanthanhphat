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
  created_at: string;
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
    createdAt: row.created_at,
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
      .select("id, nhom, stt, trieu_chung, nguyen_nhan_khac_phuc, nguon_bang, active, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

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

export type CreateMachineFaultInput = {
  section: MachineFaultSection;
  symptom: string;
  probableCause: string;
  remedy: string;
  sourceReference?: string;
  order?: number;
};

export async function createMachineFault(input: CreateMachineFaultInput): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase nên không thể thêm lỗi thiết bị.");
  }
  const symptom = input.symptom.trim();
  const probableCause = input.probableCause.trim();
  const remedy = input.remedy.trim();
  if (!symptom || !probableCause || !remedy) {
    throw new Error("Vui lòng nhập đủ triệu chứng, nguyên nhân và cách khắc phục.");
  }

  const supabase = createClient();
  let order = input.order;
  if (!order || order < 1) {
    const { data, error } = await supabase
      .from("thu_vien_loi_thiet_bi")
      .select("stt")
      .eq("nhom", input.section)
      .order("stt", { ascending: false })
      .limit(1);
    if (error) throw new Error(formatSupabaseError(error));
    order = Number(data?.[0]?.stt ?? 0) + 1;
  }

  const { error } = await supabase.from("thu_vien_loi_thiet_bi").insert({
    id: `mf-custom-${crypto.randomUUID()}`,
    nhom: input.section,
    stt: order,
    trieu_chung: symptom,
    nguyen_nhan_khac_phuc: [{ nguyen_nhan: probableCause, khac_phuc: remedy }],
    nguon_bang: input.sourceReference?.trim() || "Bổ sung vận hành",
    active: true,
  });
  if (error) throw new Error(formatSupabaseError(error));
}
