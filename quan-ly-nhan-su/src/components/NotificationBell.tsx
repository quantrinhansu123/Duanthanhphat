"use client";

import { useEffect, useState } from "react";
import { Bell } from "@/components/icons";
import {
  loadNotifications,
  markNotificationsRead,
  type AppNotification,
} from "@/lib/notificationsDb";

export default function NotificationBell({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    let active = true;
    void loadNotifications().then((rows) => {
      if (active) setItems(rows);
    });
    return () => {
      active = false;
    };
  }, [open]);

  const unread = items.filter((item) => !item.read).length;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const unreadIds = items.filter((item) => !item.read).map((item) => item.id);
      if (unreadIds.length) {
        await markNotificationsRead(unreadIds);
        setItems((current) => current.map((item) => ({ ...item, read: true })));
      }
    }
  }

  return (
    <div className="relative">
      <button
        className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-[#0047AB] transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0047AB]/20 focus:outline-hidden"
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => void toggle()}
      >
        <Bell size={18} weight="regular" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Thông báo Chỉ huy trưởng và Quản trị viên
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-slate-500">Chưa có thông báo.</div>
            )}
            {items.map((item) => (
              <div key={item.id} className="border-b border-slate-100 px-3 py-2.5 last:border-0">
                <div className="text-sm font-bold text-rose-700">{item.title}</div>
                <div className="mt-0.5 text-xs text-slate-700">{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
