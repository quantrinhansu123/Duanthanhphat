import { getMachineCategory, type Machine } from "@/data/machines";

export type EquipmentGroup = "welding" | "other" | "materials";
export const EQUIPMENT_GROUP_LABELS: Record<EquipmentGroup, string> = {
  welding: "Máy hàn",
  other: "Máy và thiết bị khác",
  materials: "Vật tư",
};
export function equipmentGroup(machine: Pick<Machine, "type" | "name" | "model" | "weldingTechnology" | "specs">): EquipmentGroup {
  const stored = machine.specs?.equipmentGroup;
  if (stored === "other" || stored === "welding" || stored === "materials") return stored;
  if (/vật tư|vat tu|phụ tùng|phu tung|vật liệu|consumable|spare/i.test(`${machine.type} ${machine.name}`)) return "materials";
  return getMachineCategory(machine) === "Phương tiện" || /mài|khoan|cắt|phát điện|nâng|kích|máy nén|máy bơm/i.test(`${machine.type} ${machine.name}`) ? "other" : "welding";
}
export function equipmentQuantity(machine: Pick<Machine, "specs">): number {
  const value = Number(machine.specs?.quantity ?? 1);
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}
export type ProjectEquipment = { id: string; code: string; name: string; model: string; group: EquipmentGroup; quantity: number; missing?: boolean };
export function assignedEquipment(machines: Pick<Machine, "id" | "code" | "name" | "model" | "type" | "weldingTechnology" | "specs">[], project: { machineTypes: string[]; machineQuantities?: Record<string, number> }): ProjectEquipment[] {
  const selected = new Set(project.machineTypes);
  const rows: ProjectEquipment[] = machines.filter((m) => selected.has(m.code)).map((m) => ({
    id: m.id, code: m.code, name: m.name, model: m.model, group: equipmentGroup(m), quantity: project.machineQuantities?.[m.code] ?? 1,
  }));
  for (const code of selected) if (!machines.some((m) => m.code === code)) rows.push({ id: `unlinked:${code}`, code, name: `${code} — chưa liên kết danh mục`, model: "", group: "welding", quantity: 0, missing: true });
  const order: Record<EquipmentGroup, number> = { welding: 0, other: 1, materials: 2 };
  return rows.sort((a, b) => order[a.group] - order[b.group] || a.code.localeCompare(b.code, "vi"));
}
/** "Tên (model)"; bỏ ngoặc khi model trùng tên. */
export const equipmentLabel = (m: { name: string; model: string }) =>
  m.model && m.model.trim().toLowerCase() !== m.name.trim().toLowerCase() ? `${m.name} (${m.model})` : m.name;
export function projectEquipmentText(equipment: ProjectEquipment[]): string {
  return ([ ["welding", "1. Máy hàn"], ["other", "2. Máy và thiết bị khác"], ["materials", "3. Vật tư"] ] as const).map(([group, title]) => {
    const rows = equipment.filter((m) => m.group === group && !m.missing); // mã chưa liên kết danh mục không in ra mẫu
    return `${title}:\n${rows.map((m) => m.missing ? `- ${m.name}; cần gán lại trong dự án` : `- ${equipmentLabel(m)}: ${m.quantity} bộ`).join("\n")}`;
  }).join("\n");
}
