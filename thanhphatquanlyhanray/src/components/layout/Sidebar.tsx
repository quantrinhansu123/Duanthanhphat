"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Calculator, LayoutDashboard, Search, Shapes, TrainTrack, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/giai-toa-ung-suat", label: "Giải toả ứng suất R2", icon: Calculator },
  { href: "/", label: "Tổng quan (Track Map)", icon: LayoutDashboard },
  { href: "/cong-trinh", label: "Ký hiệu công trình", icon: Shapes },
];

interface SidebarProps {
  onNavigate?: () => void;
}

/** Admin sidebar: same look as the demohrm shell (blue rail, search box, nav list). */
export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const items = NAV_ITEMS.filter(
    (n) => !query.trim() || n.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col overflow-y-auto bg-[#0b4c8f] text-slate-100">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div className="grid h-[38px] w-[38px] place-items-center rounded-lg bg-white text-[#0b4c8f]">
          <TrainTrack className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-[16px] font-bold leading-tight">Thanh Phát</h1>
          <p className="text-[11.5px] text-[#8ec3f8]">Quản lý hàn ray</p>
        </div>
      </div>

      <div className="relative mx-3 mt-3">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8ec3f8]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm kiếm chức năng..."
          className="w-full rounded-lg border border-white/10 bg-white/10 py-1.5 pl-8 pr-2 text-[13px] placeholder:text-[#8ec3f8] focus:border-white/30 focus:outline-none"
        />
      </div>

      <nav className="mt-2 flex flex-col gap-0.5 px-2">
        {items.map((n) => {
          const Icon = n.icon;
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium transition-colors",
                active ? "bg-white/15 text-white" : "text-[#e2edfb] hover:bg-white/10",
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
