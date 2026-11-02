"use client";

import { Shapes } from "lucide-react";
import { safeImageUrl } from "@lwr/lib/safe-url";
import { formatChainage, getPlacementSpan, railRowKey, type TrackLayout } from "@lwr/lib/track-editor";
import type { StructureSymbol } from "@lwr/types/structure";

function SymbolThumb({ symbol }: { symbol: StructureSymbol | undefined }) {
  const src = safeImageUrl(symbol?.image_url);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" className="h-8 w-12 object-contain" decoding="async" />
    : <Shapes className="size-6 text-amber-700" aria-hidden="true" />;
}

/** Chú thích ký hiệu công trình — tách khỏi sơ đồ cho đỡ rối. */
const LEGEND_ORDER = ["Ga", "Cầu", "Hầm", "Ghi"] as const;
function legendCategory(name: string) {
  const v = name.toLocaleLowerCase("vi");
  if (/\bga\b|nhà ga/.test(v)) return 0;
  if (/cầu/.test(v)) return 1;
  if (/hầm/.test(v)) return 2;
  if (/ghi/.test(v)) return 3;
  return 4;
}

export function StructureLegend({
  layout,
  symbols,
  compact = false,
}: {
  layout: TrackLayout;
  symbols: StructureSymbol[];
  /** Dạng in: một hàng ngang cuối trang — Ga · Cầu · Hầm · Ghi, mỗi loại ký hiệu một lần. */
  compact?: boolean;
}) {
  if (layout.placements.length === 0) return null;

  if (compact) {
    const used = new Map<string, StructureSymbol>();
    for (const placement of layout.placements) {
      const symbol = symbols.find((item) => item.id === placement.symbolId);
      if (symbol) used.set(symbol.id, symbol);
    }
    const items = [...used.values()].sort(
      (a, b) => legendCategory(a.name) - legendCategory(b.name) || a.name.localeCompare(b.name, "vi"),
    );
    if (items.length === 0) return null;
    return (
      <section aria-label="Chú thích ký hiệu công trình" data-testid="structure-legend" style={{ marginTop: "4mm" }}>
        <b style={{ fontSize: "9pt" }}>Chú thích / Legend: </b>
        <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "4mm 8mm", alignItems: "center", verticalAlign: "middle" }}>
          {items.map((symbol) => (
            <span key={symbol.id} style={{ display: "inline-flex", alignItems: "center", gap: "2mm", fontSize: "9pt" }}>
              <SymbolThumb symbol={symbol} />{symbol.name}
            </span>
          ))}
        </span>
      </section>
    );
  }

  const rows = layout.placements.map((placement) => {
    const symbol = symbols.find((item) => item.id === placement.symbolId);
    const span = getPlacementSpan(layout.rows, placement);
    const owner = layout.rows.find((row) => railRowKey(row) === placement.rowKey);
    return { placement, symbol, span, line: owner?.line ?? "—" };
  });

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4"
      aria-label="Chú thích ký hiệu công trình"
      data-testid="structure-legend"
    >
      <h3 className="text-sm font-bold text-slate-800">
        Chú thích / Legend
        <span className="mt-0.5 block text-xs font-semibold text-slate-600">Ký hiệu công trình</span>
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">Ký hiệu</th>
              <th className="py-2 pr-3 font-medium">Mã</th>
              <th className="py-2 pr-3 font-medium">Tên</th>
              <th className="py-2 pr-3 font-medium">Tuyến</th>
              <th className="py-2 font-medium">Lý trình</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ placement, symbol, span, line }) => (
              <tr key={placement.id} className="border-b border-slate-100">
                <td className="py-2 pr-3"><SymbolThumb symbol={symbol} /></td>
                <td className="py-2 pr-3 font-mono text-xs">{symbol?.code ?? "—"}</td>
                <td className="py-2 pr-3">{placement.label || symbol?.name || "—"}</td>
                <td className="py-2 pr-3 text-xs text-slate-600">{line}</td>
                <td className="py-2 text-xs">
                  {span
                    ? `Km ${formatChainage(span.startMetres)} – ${formatChainage(span.endMetres)}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
