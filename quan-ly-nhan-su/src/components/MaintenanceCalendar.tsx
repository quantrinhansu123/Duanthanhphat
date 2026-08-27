"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import MaintenanceFormModal, {
  assigneeOptions,
  type MaintenanceFormValues,
} from "@/components/MaintenanceFormModal";
import { maintenanceEvents as seedEvents, type MaintenanceEvent } from "@/data/maintenance";

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const typeColor: Record<MaintenanceEvent["type"], string> = {
  "Bảo dưỡng": "bg-[#0047AB]",
  "Sửa chữa": "bg-rose-600",
  "Kiểm định": "bg-emerald-600",
  "Thay phụ tùng": "bg-amber-600",
};

const statusStyle: Record<MaintenanceEvent["status"], string> = {
  "Đã xong": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Đang làm": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Chờ xác nhận": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toKey(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function AssigneeAvatars({ assignees, size = 28 }: { assignees: MaintenanceEvent["assignees"]; size?: number }) {
  const visible = assignees.slice(0, 3);
  const extra = assignees.length - visible.length;

  return (
    <div className="flex items-center">
      {visible.map((a, i) => (
        <div
          key={a.name}
          className="relative overflow-hidden rounded-full ring-2 ring-white shadow-2xs"
          style={{
            width: size,
            height: size,
            marginLeft: i === 0 ? 0 : -(size * 0.28),
            zIndex: visible.length - i,
          }}
          title={a.name}
        >
          <Image src={a.photo} alt={a.name} fill className="object-cover" sizes={`${size}px`} />
        </div>
      ))}
      {extra > 0 && (
        <span
          className="relative z-0 flex items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 ring-2 ring-white shadow-2xs"
          style={{ width: size, height: size, marginLeft: -(size * 0.28) }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

export default function MaintenanceCalendar() {
  const today = new Date(2026, 7, 27); // Aug 27, 2026
  const [events, setEvents] = useState<MaintenanceEvent[]>(seedEvents);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(toKey(today.getFullYear(), today.getMonth(), today.getDate()));
  const [openAdd, setOpenAdd] = useState(false);
  const [toast, setToast] = useState("");

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const monthLabel = cursor.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

  const cells = useMemo(() => {
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const list: { key: string; day: number; inMonth: boolean; events: MaintenanceEvent[] }[] = [];

    for (let i = 0; i < firstDow; i++) {
      const d = prevDays - firstDow + 1 + i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      const key = toKey(y, m, d);
      list.push({ key, day: d, inMonth: false, events: [] });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = toKey(year, month, d);
      list.push({
        key,
        day: d,
        inMonth: true,
        events: events
          .filter((e) => e.date === key)
          .sort((a, b) => a.time.localeCompare(b.time)),
      });
    }

    let nextDay = 1;
    while (list.length < 42) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      const key = toKey(y, m, nextDay);
      list.push({ key, day: nextDay, inMonth: false, events: [] });
      nextDay += 1;
    }

    return list;
  }, [year, month, events]);

  const dayEvents = useMemo(
    () => events.filter((e) => e.date === selected).sort((a, b) => a.time.localeCompare(b.time)),
    [selected, events],
  );
  const monthEvents = events.filter((e) => e.date.startsWith(`${year}-${pad(month + 1)}`));

  function prevMonth() {
    setCursor(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCursor(new Date(year, month + 1, 1));
  }

  function endTime(time: string, durationMin: number) {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + durationMin;
    return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  function handleAdd(values: MaintenanceFormValues) {
    const assignees = assigneeOptions.filter((a) => values.assigneeNames.includes(a.name));

    const next: MaintenanceEvent = {
      id: `local-${Date.now()}`,
      date: values.date,
      time: values.time,
      durationMin: values.durationMin,
      title: values.title.trim(),
      machine: values.machine,
      type: values.type,
      status: values.status,
      assignees,
    };

    setEvents((prev) => [...prev, next]);
    setSelected(values.date);
    const [y, m] = values.date.split("-").map(Number);
    setCursor(new Date(y, m - 1, 1));
    showToast("Đã thêm lịch bảo trì");
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 transition-all duration-150 cursor-pointer shadow-2xs"
            aria-label="Tháng trước"
          >
            ‹
          </button>
          <div className="min-w-[140px] sm:min-w-[160px] text-center text-sm sm:text-base font-bold capitalize text-slate-900">
            {monthLabel}
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 transition-all duration-150 cursor-pointer shadow-2xs"
            aria-label="Tháng sau"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
            setSelected(toKey(today.getFullYear(), today.getMonth(), today.getDate()));
          }}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
        >
          Hôm nay
        </button>
        <div className="hidden md:flex flex-wrap gap-3 text-xs text-slate-500 font-medium">
          {(Object.keys(typeColor) as MaintenanceEvent["type"][]).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${typeColor[t]}`} />
              {t}
            </span>
          ))}
        </div>
        <span className="ml-auto text-xs sm:text-sm text-slate-500">
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{monthEvents.length}</strong> lịch trong tháng
        </span>
        <button
          type="button"
          onClick={() => setOpenAdd(true)}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Thêm mới
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
            {weekdays.map((d) => (
              <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const isToday =
                cell.key === toKey(today.getFullYear(), today.getMonth(), today.getDate());
              const isSelected = cell.key === selected;
              return (
                <button
                  key={cell.key + String(cell.inMonth)}
                  type="button"
                  onClick={() => setSelected(cell.key)}
                  className={`min-h-[85px] sm:min-h-[96px] border-b border-r border-slate-100 p-1.5 text-left transition-colors duration-150 cursor-pointer hover:bg-slate-50/80 ${
                    isSelected ? "bg-blue-50/80 ring-1 ring-inset ring-[#0047AB]/30" : ""
                  } ${!cell.inMonth ? "bg-slate-50/50" : ""}`}
                >
                  <div
                    className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold font-mono ${
                      isToday
                        ? "bg-[#0047AB] text-white shadow-xs"
                        : cell.inMonth
                          ? "text-slate-900"
                          : "text-slate-300"
                    }`}
                  >
                    {cell.day}
                  </div>
                  <div className="space-y-0.5">
                    {cell.events.slice(0, 2).map((e) => (
                      <div
                        key={e.id}
                        className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium font-mono text-white shadow-2xs ${typeColor[e.type]}`}
                        title={`${e.time} · ${e.title} · ${e.assignees.map((a) => a.name).join(", ")}`}
                      >
                        {e.time} {e.machine}
                      </div>
                    ))}
                    {cell.events.length > 2 && (
                      <div className="px-1 text-[10px] font-semibold text-[#0047AB]">
                        +{cell.events.length - 2} nữa
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold capitalize text-slate-900">
            {new Date(selected + "T00:00:00").toLocaleDateString("vi-VN", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            <strong className="font-semibold text-slate-900 font-mono tabular-nums">{dayEvents.length}</strong> công việc · sắp xếp theo giờ
          </div>

          <div className="mt-4">
            {dayEvents.map((e, index) => (
              <div key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                {index < dayEvents.length - 1 && (
                  <span className="absolute bottom-0 left-[15px] top-8 w-px bg-slate-200" />
                )}
                <div className="relative z-[1] flex w-[52px] flex-none flex-col items-center pt-0.5">
                  <div className="text-xs sm:text-sm font-bold font-mono tabular-nums text-[#0047AB]">{e.time}</div>
                  <div className="mt-0.5 text-[10px] font-mono tabular-nums text-slate-400">
                    {endTime(e.time, e.durationMin)}
                  </div>
                </div>
                <div className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${typeColor[e.type]}`} />
                <div className="min-w-0 flex-1 rounded-xl border border-slate-200/80 p-3.5 bg-white shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-bold text-slate-900">{e.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        <span className="font-mono font-medium text-slate-700">{e.machine}</span> · {e.type} · <span className="font-mono tabular-nums">{e.durationMin}</span> phút
                      </div>
                    </div>
                    <span
                      className={`flex-none inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[e.status]}`}
                    >
                      {e.status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-500">Người được giao</div>
                      <div className="mt-0.5 truncate text-xs font-medium text-slate-700">
                        {e.assignees.map((a) => a.name).join(", ")}
                      </div>
                    </div>
                    <AssigneeAvatars assignees={e.assignees} size={30} />
                  </div>
                </div>
              </div>
            ))}
            {dayEvents.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-10 text-center text-xs sm:text-sm text-slate-500">
                Không có lịch bảo trì trong ngày này.
              </div>
            )}
          </div>
        </div>
      </div>

      <MaintenanceFormModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSubmit={handleAdd}
        defaultDate={selected}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 px-4 py-3 text-xs sm:text-sm font-medium text-white shadow-xl border border-white/10 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toast}
        </div>
      )}
    </main>
  );
}
