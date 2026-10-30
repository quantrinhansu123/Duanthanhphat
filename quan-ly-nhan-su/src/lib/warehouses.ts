import type { Machine } from "@/data/machines";
import { equipmentGroup, equipmentQuantity, type EquipmentGroup } from "@/lib/projectEquipment";

export type Warehouse = { id: string; name: string; address: string };
export type EquipmentLocation = {
  id: string; code: string; name: string; model: string; group: EquipmentGroup;
  warehouseId: string; warehouseName: string; warehouseAddress: string; warehouseQuantity: number;
  projects: { id: string; name: string; quantity: number }[];
};
export type LocationBundle = { warehouses: Warehouse[]; locations: EquipmentLocation[] };

// shortcut: một dòng danh mục có một kho giữ phần chưa gán dự án; tách dòng khi cùng model ở nhiều kho.
export function equipmentLocations(
  machines: Pick<Machine, "id" | "code" | "name" | "model" | "type" | "weldingTechnology" | "specs">[],
  warehouses: Warehouse[], projects: { id: string; name: string }[],
  metadata: Record<string, { status?: string; machineTypes: string[]; machineQuantities?: Record<string, number> }>,
): EquipmentLocation[] {
  return machines.map((machine) => {
    const assigned = projects.filter((p) => metadata[p.id]?.status !== "Hoàn thành" && metadata[p.id]?.machineTypes.includes(machine.code))
      .map((p) => ({ ...p, quantity: metadata[p.id].machineQuantities?.[machine.code] ?? 1 }));
    const warehouseId = String(machine.specs?.warehouseId ?? "");
    const warehouse = warehouses.find((w) => w.id === warehouseId);
    return { id: machine.id, code: machine.code, name: machine.name, model: machine.model, group: equipmentGroup(machine), warehouseId,
      warehouseName: warehouse?.name ?? "Chưa chọn kho", warehouseAddress: warehouse?.address ?? "",
      warehouseQuantity: Math.max(0, equipmentQuantity(machine) - assigned.reduce((sum, p) => sum + p.quantity, 0)), projects: assigned };
  });
}
export function equipmentLocationLabel(location: EquipmentLocation): string {
  const parts = location.projects.map((p) => `Dự án ${p.name}: ${p.quantity} bộ`);
  if (location.warehouseQuantity) parts.push(`${location.warehouseName}${location.warehouseAddress ? ` (${location.warehouseAddress})` : ""}: ${location.warehouseQuantity} bộ`);
  return parts.join("; ") || "Chưa xác định vị trí";
}
