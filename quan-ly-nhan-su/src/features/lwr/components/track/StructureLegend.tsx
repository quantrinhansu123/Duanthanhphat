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
export function StructureLegend({
  layout,
  symbols,
}: {
  layout: TrackLayout;
  symbols: StructureSymbol[];
}) {
  if (layout.placements.length === 0) return null;

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
      <h3 className="text-sm font-bold text-slate-800">Chú thích / Legend · ký hiệu công trình</h3>
      <p className="mt-1 text-xs text-slate-500">
        Trên sơ đồ chỉ hiện biểu tượng trên đường tim. Tên và mã tra cứu tại đây.
      </p>
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
