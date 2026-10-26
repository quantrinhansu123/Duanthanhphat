import { Map as MapIcon, ChevronDown } from "lucide-react";
import { TRACK_STATS } from "@lwr/lib/track-data";
import type { StatItem } from "@lwr/types/track";
import { StatCard } from "./StatCard";

interface TrackHeaderProps {
  title?: string;
  subtitle?: string;
  stats?: StatItem[];
  rangeLabel?: string;
}

/** Page header: title + stat cards + kilometre-range selector.
 *  Server component — fully driven by props. */
export function TrackHeader({
  title = "LWR/CWR Map Overview",
  subtitle = "Tuyến 10 km · 4 dải ray · 80 đoạn LWR",
  stats = TRACK_STATS,
  rangeLabel = "Km 0–10",
}: TrackHeaderProps) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-start sm:gap-3">
      <div className="col-span-2 min-w-0 sm:min-w-[220px]">
        <h1 className="text-[22px] font-bold leading-tight text-slate-900">{title}</h1>
        <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>
      </div>
      <div className="col-span-2 grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-1 sm:flex-wrap sm:items-stretch">
        {stats.map((s) => (
          <StatCard key={s.label} item={s} />
        ))}
      </div>
      <button
        type="button"
        className="col-span-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-800 shadow-sm sm:col-span-1 sm:w-auto"
      >
        <MapIcon className="h-4 w-4 text-blue-600" />
        {rangeLabel}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
    </div>
  );
}
