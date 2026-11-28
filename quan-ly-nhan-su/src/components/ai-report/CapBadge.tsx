"use client";

import type { ModuleCapability } from "@/lib/aiReportDemo";

const STYLES: Record<ModuleCapability, { label: string; cls: string }> = {
  real: {
    label: "Có thật trên máy này",
    cls: "border-emerald-300 bg-emerald-50 text-emerald-900",
  },
  sim: {
    label: "Mô phỏng · dữ liệu mẫu",
    cls: "border-amber-300 bg-amber-50 text-amber-950",
  },
  plan: {
    label: "Kế hoạch · chưa build",
    cls: "border-slate-300 bg-slate-100 text-slate-700",
  },
};

export default function CapBadge({
  capability,
  compact = false,
}: {
  capability: ModuleCapability;
  compact?: boolean;
}) {
  const s = STYLES[capability];
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap ${s.cls} ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]"
      }`}
    >
      {s.label}
    </span>
  );
}
