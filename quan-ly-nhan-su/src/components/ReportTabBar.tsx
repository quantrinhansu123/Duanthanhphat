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
  "quan-ly-du-an": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

export default function ReportTabBar({ activeId, onNavigate }: ReportTabBarProps) {
  return (
    <div className="shrink-0 border-b border-[#e8eef8] bg-[#eef2f8] px-3 pb-3 pt-2">
      <div
        className="flex gap-1.5 rounded-xl border border-[#e8ebf0] bg-white p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
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
              className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-[13px] font-semibold transition ${
                active
                  ? "bg-[#1565d8] text-white shadow-[0_2px_8px_rgba(21,101,216,0.35)]"
                  : "text-[#5d6b7d] hover:bg-[#f3f6fb] hover:text-[#16233a]"
              }`}
            >
              <span className={active ? "text-white" : "text-[#64748b]"}>{icons[tab.id]}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
