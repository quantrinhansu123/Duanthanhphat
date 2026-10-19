import type { StatItem } from "@/types/track";
import { cn } from "@/lib/utils";

interface StatCardProps {
  item: StatItem;
  className?: string;
}

/** Reusable header stat card (label + highlighted value). */
export function StatCard({ item, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "min-w-[104px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs",
        className,
      )}
    >
      <div className="text-xs font-medium text-slate-500">{item.label}</div>
      <div className={cn("mt-1 text-2xl font-semibold leading-8 tabular-nums", item.tone)}>{item.value}</div>
    </div>
  );
}
