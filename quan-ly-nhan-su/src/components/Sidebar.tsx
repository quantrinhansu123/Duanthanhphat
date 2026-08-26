"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { navigation } from "@/data/navigation";

const icons: Record<string, React.ReactNode> = {
  "nhan-su": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  "dao-tao": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 10L12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
    </svg>
  ),
  "may-moc": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  ),
  "du-an": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <path d="M12 11v6M9 14h6" />
    </svg>
  ),
  "ky-thuat": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  "bao-cao": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  ),
  "du-lieu-lich-su": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  ),
  "quan-tri": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
};

type SidebarProps = {
  activeId?: string;
  onNavigate?: (id: string) => void;
  collapsed?: boolean;
  onToggle?: () => void;
};

export default function Sidebar({
  activeId = "ho-so-nhan-su",
  onNavigate,
  collapsed = false,
  onToggle,
}: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<string[]>(["nhan-su"]);

  useEffect(() => {
    const group = navigation.find((g) => g.children.some((c) => c.id === activeId));
    if (group) {
      setOpenGroups((prev) => (prev.includes(group.id) ? prev : [...prev, group.id]));
    }
  }, [activeId]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <aside
      className={`relative flex h-screen flex-col overflow-hidden bg-[#0a254f] text-white transition-[width] duration-200 ${
        collapsed ? "w-[78px]" : "w-[280px]"
      }`}
      style={{ background: "linear-gradient(180deg,#071633 0%,#0a254f 55%,#0d2b6b 100%)" }}
    >
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="relative h-11 w-11 flex-none overflow-hidden rounded-full bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.15)]">
          <Image src="/logo.png" alt="Thành Phát" fill className="object-cover" sizes="44px" />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[16px] font-extrabold tracking-[0.06em]">THÀNH PHÁT</div>
            <div className="mt-0.5 truncate text-[11px] font-medium text-[#93b4e8]">Rail Welding Management</div>
          </div>
        )}
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-2">
        <div className={`mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7f9fd4] ${collapsed ? "text-center" : ""}`}>
          {collapsed ? "•••" : "Chức năng hệ thống"}
        </div>

        <div className="flex flex-col gap-1 pb-2">
          {navigation.map((item) => {
            const isOpen = openGroups.includes(item.id);
            const isChildActive = item.children.some((c) => c.id === activeId);

            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (collapsed) {
                      onNavigate?.(item.children[0].id);
                      return;
                    }
                    toggleGroup(item.id);
                  }}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${
                    isChildActive
                      ? "bg-white/10 font-semibold text-white"
                      : "text-[#c5d6f2] hover:bg-white/10 hover:text-white"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                  title={`${item.labelEn} – ${item.label}`}
                >
                  <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${isChildActive ? "bg-[#1a56db]" : "bg-white/5 group-hover:bg-white/10"}`}>
                    {icons[item.id]}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{item.label}</span>
                        <span className="mt-0.5 block truncate text-[10px] font-medium text-[#7f9fd4]">
                          {item.code}. {item.labelEn}
                        </span>
                      </span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`flex-none opacity-70 transition ${isOpen ? "rotate-180" : ""}`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </>
                  )}
                </button>

                {isOpen && !collapsed && (
                  <div className="mt-1 mb-2 ml-4 space-y-0.5 pl-3">
                    {item.children.map((child) => {
                      const childActive = activeId === child.id;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => onNavigate?.(child.id)}
                          className={`block w-full rounded-lg px-3 py-2 text-left transition ${
                            childActive
                              ? "bg-[#1a56db] text-white"
                              : "text-[#a8c0e8] hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span className="block text-[12.5px] font-semibold leading-snug">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-full bg-[#1a56db]">
              <Image
                src="https://randomuser.me/api/portraits/men/11.jpg"
                alt="Admin"
                fill
                className="object-cover"
                sizes="36px"
              />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-semibold">Nguyễn Đắc Công</div>
              <div className="truncate text-[11px] text-[#93b4e8]">Quản trị viên</div>
            </div>
          </div>
        ) : (
          <div className="relative mx-auto h-9 w-9 overflow-hidden rounded-full bg-[#1a56db]">
            <Image
              src="https://randomuser.me/api/portraits/men/11.jpg"
              alt="Admin"
              fill
              className="object-cover"
              sizes="36px"
            />
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-[12px] text-[#93b4e8] hover:bg-white/10 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {collapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
          </svg>
          {!collapsed && <span>Thu gọn</span>}
        </button>
      </div>
    </aside>
  );
}
