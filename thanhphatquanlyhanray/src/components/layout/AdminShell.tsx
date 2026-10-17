"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";

/** Admin frame: sidebar + top bar + scrolling content — luôn bản full. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f4f6fa]">
      {menuOpen && (
        <button
          type="button"
          aria-label="Đóng menu"
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className={menuOpen ? "fixed inset-y-0 left-0 z-40 flex md:static md:z-auto" : "hidden md:flex"}>
        <Sidebar onNavigate={() => setMenuOpen(false)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b bg-white px-3 py-2.5 md:px-6">
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-600 md:hidden"
            aria-label="Mở menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-[13px] font-bold text-blue-700">
              A
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-[13px] font-bold text-slate-900">Admin</div>
              <div className="text-[11.5px] text-slate-500">Quản trị hệ thống</div>
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-3 md:p-5">{children}</main>
      </div>
    </div>
  );
}
