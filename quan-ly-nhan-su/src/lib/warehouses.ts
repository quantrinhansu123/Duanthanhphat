import type { Machine } from "@/data/machines";
import { equipmentGroup, equipmentQuantity, type EquipmentGroup } from "@/lib/projectEquipment";
import { parseStockSplits } from "@/lib/stockSplits";

export type Warehouse = {
  id: string;
  name: string;
  address: string;
  /** Người quản lý kho */
  managerName?: string;
  managerPhone?: string;
  /** Người bảo vệ kho */
  guardName?: string;
  guardPhone?: string;
};
export type LocationProject = { id: string; name: string };
export type EquipmentLocation = {
  id: string; code: string; name: string; model: string; group: EquipmentGroup;
  warehouseId: string; warehouseName: string; warehouseAddress: string; warehouseQuantity: number;
  locationProjectId: string;
  projects: { id: string; name: string; quantity: number; missing?: boolean }[];
  excessQuantity: number;
  /** Số lượng theo từng kho khi một mã nằm ở nhiều nơi (specs.stockLocations). Rỗng = dùng warehouseId cũ. */
  stock: { warehouseId: string; warehouseName: string; warehouseAddress: string; quantity: number }[];
};
export type LocationBundle = { warehouses: Warehouse[]; projects: LocationProject[]; locations: EquipmentLocation[] };

// shortcut: một dòng danh mục có một kho giữ phần chưa gán dự án; tách dòng khi cùng model ở nhiều kho.
export function equipmentLocations(
  machines: Pick<Machine, "id" | "code" | "name" | "model" | "type" | "weldingTechnology" | "specs">[],
  warehouses: Warehouse[], projects: { id: string; name: string }[],
  metadata: Record<string, { status?: string; machineTypes: string[]; machineQuantities?: Record<string, number> }>,
): EquipmentLocation[] {
  return machines.map((machine) => {
    const splits = parseStockSplits(machine.specs?.stockLocations).filter((s) => s.quantity > 0);
    if (splits.length) {
      const stock = splits.filter((s) => s.kind === "warehouse").map((s) => {
        const w = warehouses.find((item) => item.id === s.id);
        return { warehouseId: s.id, warehouseName: w?.name ?? "Kho không còn tồn tại", warehouseAddress: w?.address ?? "", quantity: s.quantity };
      });
      const projectsView = splits.filter((s) => s.kind === "project").map((s) => {
        const p = projects.find((item) => item.id === s.id);
        return { id: s.id, name: p?.name ?? `Dự án không còn tồn tại (${s.id})`, quantity: s.quantity, missing: !p };
      });
      return {
        id: machine.id, code: machine.code, name: machine.name, model: machine.model, group: equipmentGroup(machine),
        warehouseId: "", warehouseName: "Nhiều vị trí", warehouseAddress: "", locationProjectId: "",
        warehouseQuantity: 0, projects: projectsView, excessQuantity: 0, stock,
      };
    }
    const assigned = Object.entries(metadata).filter(([, p]) => p.status !== "Hoàn thành" && p.machineTypes.includes(machine.code))
      .map(([id, p]) => {
        const project = projects.find((project) => project.id === id);
        return { id, name: project?.name ?? `Dự án không còn tồn tại (${id})`, quantity: p.machineQuantities?.[machine.code] ?? 1, missing: !project };
      });
    const remaining = equipmentQuantity(machine) - assigned.reduce((sum, p) => sum + p.quantity, 0);
    const warehouseId = String(machine.specs?.warehouseId ?? "");
    const locationProjectId = String(machine.specs?.locationProjectId ?? "");
    const warehouse = warehouses.find((w) => w.id === warehouseId);
    const locationProject = projects.find((p) => p.id === locationProjectId);
    const projectsView = assigned.length
      ? assigned
      : locationProject
        ? [{ id: locationProject.id, name: locationProject.name, quantity: Math.max(1, remaining || 1) }]
        : [];
    return {
      id: machine.id, code: machine.code, name: machine.name, model: machine.model, group: equipmentGroup(machine), warehouseId,
      warehouseName: warehouse?.name ?? (locationProject ? `Dự án ${locationProject.name}` : "Chưa chọn kho"),
      warehouseAddress: warehouse?.address ?? "",
      locationProjectId,
      warehouseQuantity: Math.max(0, remaining), projects: projectsView, excessQuantity: Math.max(0, -remaining), stock: [],
    };
  });
}
export function equipmentLocationLabel(location: EquipmentLocation): string {
  const parts = location.projects.map((p) => `${p.missing ? p.name : `Dự án ${p.name}`}: ${p.quantity} bộ`);
  for (const s of location.stock) parts.push(`${s.warehouseName}${s.warehouseAddress ? ` (${s.warehouseAddress})` : ""}: ${s.quantity} bộ`);
  if (location.stock.length) return parts.join("; ");
  if (location.warehouseId && location.warehouseQuantity) {
    parts.push(`${location.warehouseName}${location.warehouseAddress ? ` (${location.warehouseAddress})` : ""}: ${location.warehouseQuantity} bộ`);
  } else if (!location.projects.length && location.locationProjectId) {
    parts.push(location.warehouseName);
  } else if (!location.projects.length && location.warehouseQuantity) {
    parts.push(`${location.warehouseName}${location.warehouseAddress ? ` (${location.warehouseAddress})` : ""}: ${location.warehouseQuantity} bộ`);
  }
  if (location.excessQuantity) parts.push(`Đang gán vượt ${location.excessQuantity} bộ; cần kiểm tra lại phân công dự án`);
  return parts.join("; ") || "Chưa xác định vị trí";
}
