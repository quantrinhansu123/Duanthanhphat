export type StructureStatus = "active" | "maintenance" | "inactive";

export interface StructureSymbol {
  id: string;
  code: string;
  name: string;
  name_en: string | null;
  line: string | null;
  km_start: number | null;
  km_end: number | null;
  status: StructureStatus;
  managing_unit: string | null;
  note: string | null;
  image_url: string | null;
  created_at: string;
}

export type StructureInput = Omit<StructureSymbol, "id" | "created_at">;
