"use client";

import { BAND_COLORS } from "@/lib/track-data";
import { tempBand } from "@/lib/track-data";
import { cn } from "@/lib/utils";

interface TempCellProps {
  id: string;
  temp: number;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/** Reusable locking-temperature cell. Colour is derived from the temp band,
 *  so callers only pass raw values. */
export function TempCell({ id, temp, selected = false, onSelect }: TempCellProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(id)}
      aria-pressed={selected}
      aria-label={`${id}: ${temp} độ C`}
      title={`${id}: ${temp}°C`}
      className={cn(
        "rounded-[4px] px-1 py-1 text-center text-white transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500",
        selected && "outline outline-2 outline-offset-1 outline-blue-500",
      )}
      style={{ background: BAND_COLORS[tempBand(temp)] }}
    >
      <span className="text-[12px] font-bold">{temp}°C</span>
    </button>
  );
}
