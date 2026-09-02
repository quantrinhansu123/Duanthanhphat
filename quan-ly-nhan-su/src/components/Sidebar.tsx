"use client";

import Image from "next/image";
import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { navigation } from "@/data/navigation";
import {
  Users,
  GraduationCap,
  Wrench,
  Buildings,
  Path,
  ChartBar,
  ClockCounterClockwise,
  GearSix,
  X,
  CaretDown,
  CaretLeft,
  CaretRight,
} from "@/components/icons";

const icons: Record<string, Icon> = {
  "nhan-su": Users,
  "dao-tao": GraduationCap,
  "may-moc": Wrench,
  "du-an": Buildings,
  "ky-thuat": Path,
  "bao-cao": ChartBar,
  "du-lieu-lich-su": ClockCounterClockwise,
  "quan-tri": GearSix,
};

type SidebarProps = {
  activeId?: string;
  onNavigate?: (id: string) => void;
  collapsed?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
};

export default function Sidebar({
  activeId,
  onNavigate,
  collapsed = false,
  onToggle,
  onClose,
}: SidebarProps) {
  const activeGroup = navigation.find((g) => g.children.some((c) => c.id === activeId));

  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    return activeGroup ? [activeGroup.id] : [];
  });

  useEffect(() => {
    if (activeGroup) {
      setOpenGroups([activeGroup.id]);
    } else {
      setOpenGroups([]);
    }
  }, [activeGroup]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => (prev.includes(id) ? [] : [id]));
  }

  function handleNavigate(id: string) {
    onNavigate?.(id);
    onClose?.();
  }

  return (
    <aside
      className={`relative flex h-screen flex-col overflow-hidden text-white transition-[width] duration-200 select-none ${
        collapsed ? "w-[78px]" : "w-[280px]"
      }`}
      style={{ background: "linear-gradient(180deg, #071633 0%, #0a254f 60%, #0a2f64 100%)" }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-white/[0.08]">
        <Link
          href="/"
          onClick={(e) => {
            setOpenGroups([]);
            if (onNavigate) {
              e.preventDefault();
              onNavigate("");
            }
            onClose?.();
          }}
          className="flex items-center gap-3 min-w-0 cursor-pointer focus:outline-hidden"
          title="Về trang chủ Thành Phát"
        >
          <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full">
            <Image src="/logo.png" alt="Thành Phát" fill className="object-cover" sizes="40px" />
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-bold tracking-wider text-white">THÀNH PHÁT</div>
              <div className="mt-0.5 truncate text-[11px] font-medium text-blue-200/80">Rail &amp; Steel Operations</div>
            </div>
          )}
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex lg:hidden h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors duration-150 cursor-pointer"
            aria-label="Đóng menu"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        )}
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-3">
        <div className={`mb-2.5 px-2 text-[11px] font-bold uppercase tracking-wider text-blue-300/70 ${collapsed ? "text-center" : ""}`}>
          {collapsed ? "•••" : "Chức năng hệ thống"}
        </div>

        <div className="flex flex-col gap-1 pb-2">
          {navigation.map((item) => {
            const isOpen = openGroups.includes(item.id);
            const isChildActive = item.children.some((c) => c.id === activeId);
            const GroupIcon = icons[item.id];

            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (collapsed) {
                      handleNavigate(item.children[0].id);
                      return;
                    }
                    toggleGroup(item.id);
                  }}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150 cursor-pointer ${
                    isChildActive
                      ? "bg-white/[0.12] font-semibold text-white shadow-xs"
                      : "text-slate-300 font-medium hover:bg-white/[0.08] hover:text-white"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                  title={`${item.labelEn} – ${item.label}`}
                >
                  <span
                    className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg transition-colors duration-150 ${
                      isChildActive
                        ? "bg-[#0047AB] text-white shadow-xs ring-1 ring-white/30"
                        : "bg-white/5 text-blue-200/80 group-hover:bg-white/10 group-hover:text-white"
                    }`}
                  >
                    {GroupIcon ? <GroupIcon size={18} weight={isChildActive ? "fill" : "regular"} aria-hidden /> : null}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{item.label}</span>
                        <span className="mt-0.5 block truncate text-[11px] font-medium text-blue-200/60">
                          {item.labelEn}
                        </span>
                      </span>
                      <CaretDown
                        size={14}
                        weight="bold"
                        aria-hidden
                        className={`flex-none opacity-70 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      />
                    </>
                  )}
                </button>

                {isOpen && !collapsed && (
                  <div className="mt-1 mb-2 ml-4 space-y-0.5 pl-3 border-l border-white/10">
                    {item.children.map((child) => {
                      const childActive = activeId === child.id;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => handleNavigate(child.id)}
                          className={`block w-full rounded-lg px-3 py-2 text-left transition-all duration-150 cursor-pointer ${
                            childActive
                              ? "bg-[#0047AB] text-white font-semibold shadow-xs"
                              : "text-slate-300 font-medium hover:bg-white/[0.08] hover:text-white"
                          }`}
                        >
                          <span className="block text-xs sm:text-[13px] leading-snug">{child.label}</span>
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

      <div className="p-3 border-t border-white/[0.08]">
        {!collapsed ? (
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.08] border border-white/5 px-3 py-2.5">
            <div className="relative h-9 w-9 flex-none overflow-hidden rounded-full bg-[#0047AB] ring-2 ring-white/20">
              <Image
                src="https://randomuser.me/api/portraits/men/11.jpg"
                alt="Admin"
                fill
                className="object-cover"
                sizes="36px"
              />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs sm:text-sm font-semibold text-white">Nguyễn Đắc Công</div>
              <div className="truncate text-[11px] font-medium text-blue-200/80">Quản trị viên</div>
            </div>
          </div>
        ) : (
          <div className="relative mx-auto h-9 w-9 overflow-hidden rounded-full bg-[#0047AB] ring-2 ring-white/20">
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
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-blue-200/80 hover:bg-white/[0.08] hover:text-white transition-colors duration-150 cursor-pointer"
        >
          {collapsed ? <CaretRight size={16} weight="bold" aria-hidden /> : <CaretLeft size={16} weight="bold" aria-hidden />}
          {!collapsed && <span>Thu gọn</span>}
        </button>
      </div>
    </aside>
  );
}
