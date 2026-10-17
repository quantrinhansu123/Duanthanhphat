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
        "min-w-[104px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5",
        className,
      )}
    >
      <div className="text-[11px] text-slate-500">{item.label}</div>
      <div className={cn("text-[19px] font-bold leading-7", item.tone)}>{item.value}</div>
    </div>
  );
}
