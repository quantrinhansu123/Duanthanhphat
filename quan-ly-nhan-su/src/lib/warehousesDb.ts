import type { LocationBundle, Warehouse } from "@/lib/warehouses";

async function result<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Không tải được thông tin kho.");
  return body as T;
}
export async function loadWarehouses() {
  return (await result<{ warehouses: Warehouse[] }>(await fetch("/api/warehouses", { cache: "no-store" }))).warehouses;
}
export async function saveWarehouse(warehouse: { id?: string; name: string; address: string }) {
  return result<{ warehouse: Warehouse }>(await fetch("/api/warehouses", { method: warehouse.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(warehouse) }));
}
export async function deleteWarehouse(id: string) {
  await result(await fetch(`/api/warehouses?${new URLSearchParams({ id })}`, { method: "DELETE" }));
}
export async function loadEquipmentLocations() {
  return result<LocationBundle>(await fetch("/api/equipment-locations", { cache: "no-store" }));
}
