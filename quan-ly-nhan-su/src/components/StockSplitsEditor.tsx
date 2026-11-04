"use client";

import { sumStockSplits, type StockSplit } from "@/lib/stockSplits";

type Option = { id: string; name: string };

/**
 * Nhập "mã này có bao nhiêu ở mỗi nơi". Tổng các dòng = tổng số lượng của mã.
 * Dùng chung cho vật tư (danh mục máy) và phụ tùng thay thế.
 */
export default function StockSplitsEditor({
  splits,
  onChange,
  warehouses,
  projects,
  unit = "bộ",
  readOnly,
  allowProjects = true,
}: {
  splits: StockSplit[];
  onChange: (next: StockSplit[]) => void;
  warehouses: Option[];
  projects: Option[];
  unit?: string;
  readOnly?: boolean;
  allowProjects?: boolean;
}) {
  const nameOf = (s: StockSplit) =>
    (s.kind === "warehouse" ? warehouses : projects).find((o) => o.id === s.id)?.name ?? "Vị trí không còn tồn tại";
  const total = sumStockSplits(splits);
  const used = new Set(splits.map((s) => `${s.kind}:${s.id}`));
  const free = [
    ...warehouses.map((w) => ({ value: `warehouse:${w.id}`, label: `Kho · ${w.name}` })),
    ...(allowProjects ? projects.map((p) => ({ value: `project:${p.id}`, label: `Dự án · ${p.name}` })) : []),
  ].filter((o) => !used.has(o.value));

  function update(index: number, patch: Partial<StockSplit>) {
    onChange(splits.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <div className="space-y-2">
      {splits.length === 0 && <p className="text-xs text-slate-500">Chưa chia theo vị trí. Thêm kho / dự án và số lượng tại từng nơi.</p>}
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {splits.map((s, index) => (
          <li key={`${s.kind}:${s.id}`} className="flex items-center gap-2 px-2 py-1.5 text-xs sm:text-sm">
            <span className="min-w-0 flex-1 break-words">
              <span className="text-slate-500">{s.kind === "warehouse" ? "Kho" : "Dự án"} · </span>
              <span className="font-semibold">{nameOf(s)}</span>
            </span>
            <input
              aria-label={`Số lượng tại ${nameOf(s)}`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              disabled={readOnly}
              value={s.quantity}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => update(index, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              className="w-20 shrink-0 rounded border border-slate-300 px-2 py-1.5 text-right font-mono"
            />
            <span className="w-8 shrink-0 text-slate-500">{unit}</span>
            {!readOnly && (
              <button type="button" onClick={() => onChange(splits.filter((_, i) => i !== index))} className="shrink-0 rounded px-2 py-1 text-rose-600 hover:bg-rose-50" aria-label={`Bỏ ${nameOf(s)}`}>
                Xóa
              </button>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && free.length > 0 && (
        <select
          aria-label="Thêm vị trí"
          value=""
          onChange={(e) => {
            const [kind, ...rest] = e.target.value.split(":");
            if (!kind) return;
            onChange([...splits, { kind: kind as StockSplit["kind"], id: rest.join(":"), quantity: 0 }]);
          }}
          className="h-9 w-full rounded-lg border border-dashed border-slate-300 bg-white px-2 text-xs text-slate-700"
        >
          <option value="">+ Thêm vị trí (kho / dự án)…</option>
          {free.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      <p className="text-xs font-semibold text-slate-700">
        Tổng: <span className="font-mono">{total.toLocaleString("vi-VN")}</span> {unit}
      </p>
    </div>
  );
}
