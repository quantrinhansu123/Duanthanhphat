import { addMissingStructurePresets } from "@lwr/lib/structure-presets";
import { supabase } from "@lwr/lib/supabase";
import type { StructureSymbol } from "@lwr/types/structure";

export const STRUCTURE_LOCAL_KEY = "structure-symbols-v1";
const PRESETS_KEY = "structure-symbols-presets-v1";

function isMissingTableError(message: string | undefined) {
  const text = (message ?? "").toLowerCase();
  return (
    text.includes("structure_symbols") ||
    text.includes("schema cache") ||
    text.includes("does not exist") ||
    text.includes("could not find the table")
  );
}

function loadLocalSymbols(): StructureSymbol[] {
  const current: unknown = JSON.parse(localStorage.getItem(STRUCTURE_LOCAL_KEY) ?? "[]");
  if (!Array.isArray(current)) throw new Error("Dữ liệu danh mục ký hiệu không hợp lệ.");
  const rows = current as StructureSymbol[];
  if (localStorage.getItem(PRESETS_KEY)) return rows;
  const seeded = addMissingStructurePresets(rows);
  localStorage.setItem(STRUCTURE_LOCAL_KEY, JSON.stringify(seeded));
  localStorage.setItem(PRESETS_KEY, "1");
  return seeded;
}

/** Shared catalog for the manager and the track placement selector. */
export async function loadStructureSymbols(): Promise<StructureSymbol[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("structure_symbols")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) return (data ?? []) as StructureSymbol[];
    // Chưa chạy migration → dùng localStorage, không chặn Track Map.
    if (isMissingTableError(error.message)) return loadLocalSymbols();
    throw new Error(error.message);
  }
  return loadLocalSymbols();
}
