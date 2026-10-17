import { BAND_COLORS, BAND_LABELS } from "@/lib/track-data";
import type { BandLabel } from "@/types/track";

interface BandLegendProps {
  items?: BandLabel[];
}

/** Reusable temperature-band legend footer. */
export function BandLegend({ items = BAND_LABELS }: BandLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-4 py-2.5">
      {items.map((b) => (
        <span key={b.band} className="flex items-center gap-1.5 text-[12px] text-slate-600">
          <span
            className="inline-block h-3 w-3 rounded-[3px]"
            style={{ background: BAND_COLORS[b.band] }}
          />
          {b.label}
        </span>
      ))}
    </div>
  );
}
