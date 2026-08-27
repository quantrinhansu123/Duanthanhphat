"use client";

import { REPORT_TABS } from "@/data/reportTabs";

type ReportTabBarProps = {
  activeId: string;
  onNavigate: (id: string) => void;
};

const icons: Record<string, React.ReactNode> = {
  "bc-tong-quan": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  ),
  "bc-chat-luong": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  "bc-may-moc": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3" />
    </svg>
  ),
  "bc-nhan-su": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

export default function ReportTabBar({ activeId, onNavigate }: ReportTabBarProps) {
  return (
    <div className="shrink-0 border-b border-[#e2e8f0] bg-[#f8fafc] px-3.5 sm:px-6 py-2 sm:py-2.5">
      <div className="table-scroll overflow-x-auto">
        <div
          className="inline-flex min-w-max sm:min-w-0 sm:w-full gap-1.5 rounded-xl border border-[#d9e2f1] bg-[#f1f5f9] p-1 shadow-2xs"
          role="tablist"
        >
          {REPORT_TABS.map((tab) => {
            const active = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onNavigate(tab.id)}
                className={`flex shrink-0 sm:flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 sm:px-3.5 py-2 text-[12.5px] sm:text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
                  active
                    ? "bg-[#0047AB] text-white shadow-xs"
                    : "text-[#64748b] hover:bg-white/80 hover:text-[#0f172a]"
                }`}
              >
                <span className={active ? "text-white" : "text-[#64748b]"}>{icons[tab.id]}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
