"use client";

import type { Icon } from "@phosphor-icons/react";
import { REPORT_TABS } from "@/data/reportTabs";
import { SquaresFour, ShieldCheck, Wrench, Users } from "@/components/icons";

type ReportTabBarProps = {
  activeId: string;
  onNavigate: (id: string) => void;
};

const icons: Record<string, Icon> = {
  "bc-tong-quan": SquaresFour,
  "bc-chat-luong": ShieldCheck,
  "bc-may-moc": Wrench,
  "bc-nhan-su": Users,
};

export default function ReportTabBar({ activeId, onNavigate }: ReportTabBarProps) {
  return (
    <div className="shrink-0 border-b border-slate-200/80 bg-slate-50/70 px-3.5 sm:px-6 py-2 sm:py-2.5">
      <div className="table-scroll overflow-x-auto">
        <div
          className="inline-flex min-w-max sm:min-w-0 sm:w-full gap-1.5 rounded-xl border border-slate-200 bg-slate-100/90 p-1 shadow-xs"
          role="tablist"
        >
          {REPORT_TABS.map((tab) => {
            const active = tab.id === activeId;
            const TabIcon = icons[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onNavigate(tab.id)}
                className={`flex shrink-0 sm:flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047ab]/25 ${
                  active
                    ? "bg-[#0047AB] text-white shadow-xs"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                {TabIcon ? (
                  <TabIcon
                    size={17}
                    weight={active ? "fill" : "regular"}
                    aria-hidden
                    className={active ? "text-white" : "text-slate-500"}
                  />
                ) : null}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
