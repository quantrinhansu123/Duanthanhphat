import type { StructureInput, StructureSymbol } from "@lwr/types/structure";

/** Built-in illustrations follow the application's schematic legend. */
export const STRUCTURE_PRESETS: StructureInput[] = [
  ["GH-TR", "Ghi rẽ trái", "Left turnout", "turnout-left"],
  ["GH-PH", "Ghi rẽ phải", "Right turnout", "turnout-right"],
  ["GH-BC", "Ghi bắt chéo", "Crossing", "crossing"],
  ["GH-HT", "Ghi hình thoi", "Diamond crossing", "diamond"],
  ["CAU", "Cầu", "Bridge", "bridge"],
  ["HAM", "Hầm", "Tunnel", "tunnel"],
  ["CT-DAU", "Đầu cầu / Đầu hầm", "Bridge / Tunnel entrance", "entrance"],
  ["CT-CUOI", "Cuối cầu / Cuối hầm", "Bridge / Tunnel exit", "exit"],
  ["VHC-HAN", "Vùng hạn chế hàn ray", "Non-welding zone", "non-welding"],
].map(([code, name, name_en, file]) => ({
  code, name, name_en, image_url: `/symbols/${file}.svg`,
  line: null, km_start: null, km_end: null, status: "active",
  managing_unit: null, note: "Ký hiệu minh họa dùng trong sơ đồ quản lý ray.",
}));

export function addMissingStructurePresets(rows: StructureSymbol[]): StructureSymbol[] {
  const existing = new Set(rows.flatMap((row) => [row.code.toLowerCase(), row.name.trim().toLowerCase()]));
  const additions = STRUCTURE_PRESETS.filter((preset) => !existing.has(preset.code.toLowerCase()) && !existing.has(preset.name.toLowerCase()));
  return [...rows, ...additions.map((preset) => ({ ...preset, id: crypto.randomUUID(), created_at: new Date().toISOString() }))];
}
