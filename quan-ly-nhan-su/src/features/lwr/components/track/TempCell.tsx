"use client";

import { cn } from "@lwr/lib/utils";

interface TempCellProps {
  id: string;
  temp: number;
  released?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/** Rail segment chip. Gray until stress release has passed, then green. */
export function TempCell({ id, temp, released = false, selected = false, onSelect }: TempCellProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(id)}
      aria-pressed={selected}
      aria-label={`${id}: ${temp} độ C, ${released ? "đã giải tỏa ứng suất" : "chưa giải tỏa ứng suất"}`}
      title={`${id}: ${temp}°C · ${released ? "Đã giải tỏa" : "Chưa giải tỏa"}`}
      className={cn(
        "rounded-[4px] px-1 py-1 text-center transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500",
        selected && "outline outline-2 outline-offset-1 outline-blue-500",
        released
          ? "bg-emerald-600 text-white"
          : "border border-slate-300 bg-slate-100 text-slate-600",
      )}
    >
      <span className="text-[12px] font-bold">{temp}°C</span>
    </button>
  );
}
