"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "@/components/icons";
import { useAccess } from "@/lib/useAccess";
import {
  loadNotifications,
  markNotificationsRead,
  type AppNotification,
} from "@/lib/notificationsDb";

let audioContext: AudioContext | null = null;

/** Hai tiếng "ding-dong" ngắn; trình duyệt chỉ cho phát sau khi người dùng đã bấm/chạm vào trang. */
function playChime() {
  try {
    // Rung điện thoại (Android); iPhone/máy tính không hỗ trợ thì bỏ qua.
    navigator.vibrate?.([250, 120, 250, 120, 400]);
  } catch {
    // bỏ qua
  }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioContext ??= new Ctx();
    const ctx = audioContext;
    void ctx.resume();
    [[880, 0], [660, 0.22]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch {
    // Không phát được âm thanh → chỉ hiện đèn nhấp nháy.
  }
}

const POLL_MS = 20000;

export default function NotificationBell({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const { ready, userName } = useAccess();
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const refresh = () => {
      void loadNotifications(userName).then((rows) => {
        if (!active) return;
        // Chuông kêu khi có thông báo chưa đọc mới xuất hiện sau lần tải đầu tiên.
        const known = knownIds.current;
        if (known && rows.some((row) => !row.read && !known.has(row.id))) playChime();
        knownIds.current = new Set(rows.map((row) => row.id));
        setItems(rows);
      });
    };
    refresh();
    const timer = window.setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [open, ready, userName]);

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
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center">
            <span aria-hidden className="absolute inset-0 rounded-full bg-rose-500 opacity-75 motion-safe:animate-ping" />
            <span className="relative flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-white motion-safe:animate-pulse">
              {unread > 9 ? "9+" : unread}
            </span>
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Thông báo
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
