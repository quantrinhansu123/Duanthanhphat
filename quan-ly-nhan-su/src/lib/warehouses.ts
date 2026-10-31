import type { Machine } from "@/data/machines";
import { equipmentGroup, equipmentQuantity, type EquipmentGroup } from "@/lib/projectEquipment";

export type Warehouse = { id: string; name: string; address: string };
export type EquipmentLocation = {
  id: string; code: string; name: string; model: string; group: EquipmentGroup;
  warehouseId: string; warehouseName: string; warehouseAddress: string; warehouseQuantity: number;
  projects: { id: string; name: string; quantity: number; missing?: boolean }[];
  excessQuantity: number;
};
export type LocationBundle = { warehouses: Warehouse[]; locations: EquipmentLocation[] };

// shortcut: một dòng danh mục có một kho giữ phần chưa gán dự án; tách dòng khi cùng model ở nhiều kho.
export function equipmentLocations(
  machines: Pick<Machine, "id" | "code" | "name" | "model" | "type" | "weldingTechnology" | "specs">[],
  warehouses: Warehouse[], projects: { id: string; name: string }[],
  metadata: Record<string, { status?: string; machineTypes: string[]; machineQuantities?: Record<string, number> }>,
): EquipmentLocation[] {
  return machines.map((machine) => {
    const assigned = Object.entries(metadata).filter(([, p]) => p.status !== "Hoàn thành" && p.machineTypes.includes(machine.code))
      .map(([id, p]) => {
        const project = projects.find((project) => project.id === id);
        return { id, name: project?.name ?? `Dự án không còn tồn tại (${id})`, quantity: p.machineQuantities?.[machine.code] ?? 1, missing: !project };
      });
    const remaining = equipmentQuantity(machine) - assigned.reduce((sum, p) => sum + p.quantity, 0);
    const warehouseId = String(machine.specs?.warehouseId ?? "");
    const warehouse = warehouses.find((w) => w.id === warehouseId);
    return { id: machine.id, code: machine.code, name: machine.name, model: machine.model, group: equipmentGroup(machine), warehouseId,
      warehouseName: warehouse?.name ?? "Chưa chọn kho", warehouseAddress: warehouse?.address ?? "",
      warehouseQuantity: Math.max(0, remaining), projects: assigned, excessQuantity: Math.max(0, -remaining) };
  });
}
export function equipmentLocationLabel(location: EquipmentLocation): string {
  const parts = location.projects.map((p) => `${p.missing ? p.name : `Dự án ${p.name}`}: ${p.quantity} bộ`);
  if (location.warehouseQuantity) parts.push(`${location.warehouseName}${location.warehouseAddress ? ` (${location.warehouseAddress})` : ""}: ${location.warehouseQuantity} bộ`);
  if (location.excessQuantity) parts.push(`Đang gán vượt ${location.excessQuantity} bộ; cần kiểm tra lại phân công dự án`);
  return parts.join("; ") || "Chưa xác định vị trí";
}
