"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, Sidebar } from "@/components/layout/Sidebar";

/** Admin frame: sidebar + top bar + scrolling content — luôn bản full. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);
  const title = NAV_ITEMS.find(item => item.href === pathname)?.label ?? "Quản lý hàn ray";
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  return (
    <div className="app-workspace flex h-dvh overflow-hidden bg-[#f4f6fa]">
      <a href="#main-content" className="skip-link">Đi đến nội dung chính</a>
      {menuOpen && (
        <button
          type="button"
          aria-label="Đóng menu"
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div id="main-navigation" className={menuOpen ? "fixed inset-y-0 left-0 z-40 flex md:static md:z-auto" : "hidden md:flex"}>
        <Sidebar onNavigate={() => setMenuOpen(false)} />
        {menuOpen && <button type="button" aria-label="Đóng menu" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} className="absolute right-2 top-2 rounded-lg bg-white/10 p-2 text-white md:hidden"><X size={18} /></button>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-18 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <button
            ref={menuButton}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            type="button"
            className="rounded-lg p-1.5 text-slate-600 md:hidden"
            aria-label="Mở menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">THÀNH PHÁT / LWR · CWR</p><h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{title}</h1></div>
          <div className="ml-auto flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-[13px] font-bold text-blue-700">
              TP
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-[13px] font-semibold text-slate-900">Thành Phát</div>
              <div className="text-[11.5px] text-slate-500">Không gian làm việc</div>
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
