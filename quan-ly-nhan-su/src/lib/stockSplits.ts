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
