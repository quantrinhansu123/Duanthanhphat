"use client";

import { cn } from "@/lib/utils";

interface PanelTabsProps {
  tabs: string[];
  active: string;
  onChange?: (tab: string) => void;
}

/** Reusable controlled tab strip for the detail panel. */
export function PanelTabs({ tabs, active, onChange }: PanelTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Chi tiết đoạn ray"
      className="mx-4 mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-slate-100 p-1 text-center text-[12px]"
    >
      {tabs.map((t) => {
        const isActive = t === active;
        return (
          <button
            key={t}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(t)}
            className={cn(
              "rounded-md py-1 transition",
              isActive
                ? "bg-white font-semibold text-blue-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
