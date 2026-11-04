/** Một mã hàng có thể nằm ở nhiều vị trí (kho / dự án) với số lượng riêng, không cần tách mã. */
export type StockSplit = { kind: "warehouse" | "project"; id: string; quantity: number };

/** Đọc mảng tách vị trí từ JSON (thong_so / cột jsonb), bỏ dòng sai và gộp trùng vị trí. */
export function parseStockSplits(value: unknown): StockSplit[] {
  if (!Array.isArray(value)) return [];
  const merged = new Map<string, StockSplit>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { kind, id, quantity } = item as Record<string, unknown>;
    const qty = Number(quantity);
    if ((kind !== "warehouse" && kind !== "project") || typeof id !== "string" || !id || !Number.isFinite(qty) || qty < 0) continue;
    const key = `${kind}:${id}`;
    const prev = merged.get(key);
    merged.set(key, { kind, id, quantity: (prev?.quantity ?? 0) + qty });
  }
  return [...merged.values()];
}

export function sumStockSplits(splits: StockSplit[]): number {
  return splits.reduce((sum, s) => sum + (Number.isFinite(s.quantity) ? s.quantity : 0), 0);
}

/** Một lần đổi vị trí kho / dự án của thiết bị (lưu trong specs.stockHistory, mới nhất ở cuối). */
export type StockHistoryEntry = { at: string; by: string; from: string; to: string };

export function parseStockHistory(value: unknown): StockHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { at, by, from, to } = item as Record<string, unknown>;
    return typeof at === "string" && typeof to === "string"
      ? [{ at, by: typeof by === "string" ? by : "", from: typeof from === "string" ? from : "", to }]
      : [];
  });
}

/** Định dạng mốc thời gian an toàn: ngày + giờ ngắn, giá trị hỏng thì trả về chuỗi gốc. */
export function formatStockMoment(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

/** Mô tả vị trí hiện tại bằng chữ để so sánh / ghi lịch sử luân chuyển. */
export function describeStockLocation(
  specs: Record<string, unknown> | undefined,
  warehouses: { id: string; name: string; address?: string }[],
  projects: { id: string; name: string }[],
): string {
  const whName = (id: string) => { const w = warehouses.find((o) => o.id === id); return w ? `${w.name}${w.address ? ` (${w.address})` : ""}` : "(đã xóa)"; };
  const splits = parseStockSplits(specs?.stockLocations).filter((s) => s.quantity > 0);
  if (splits.length) {
    return splits
      .map((s) => `${s.kind === "warehouse" ? "Kho" : "Dự án"} ${s.kind === "warehouse" ? whName(s.id) : (projects.find((o) => o.id === s.id)?.name ?? "(đã xóa)")}: ${s.quantity} bộ`)
      .join("; ");
  }
  const qty = Number(specs?.quantity);
  const qtyText = Number.isFinite(qty) && qty > 0 ? `: ${qty} bộ` : "";
  const warehouseId = String(specs?.warehouseId ?? "");
  if (warehouseId) return `Kho ${whName(warehouseId)}${qtyText}`;
  const projectId = String(specs?.locationProjectId ?? "");
  if (projectId) return `Dự án ${projects.find((p) => p.id === projectId)?.name ?? "(đã xóa)"}${qtyText}`;
  return "Chưa chọn vị trí";
}
