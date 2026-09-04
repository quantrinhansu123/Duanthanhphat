"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarBlank, CaretLeft, CaretRight } from "@/components/icons";
import { useLanguage } from "@/i18n/LanguageProvider";

type DateFieldProps = {
  /** Giá trị dạng ISO "yyyy-mm-dd" (rỗng nếu chưa chọn). */
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
};

const WEEKDAYS_VI = ["H", "B", "T", "N", "S", "B", "C"];
const WEEKDAYS_EN = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS_VI = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISO(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatVi(value: string) {
  const d = parseISO(value);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "";
}

export default function DateField({ value, onChange, placeholder = "dd/mm/yyyy", className = "" }: DateFieldProps) {
  const { lang } = useLanguage();
  const WEEKDAYS = lang === "en" ? WEEKDAYS_EN : WEEKDAYS_VI;
  const MONTHS = lang === "en" ? MONTHS_EN : MONTHS_VI;
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseISO(value) ?? new Date());
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parsed = parseISO(value);
    if (parsed) setViewDate(parsed);
  }, [value]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    // Thứ Hai đầu tuần: JS getDay() 0=CN → dịch về 0=Thứ Hai
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: (number | null)[] = [];
    for (let i = 0; i < lead; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [year, month]);

  const todayISO = toISO(new Date());

  function pick(day: number) {
    onChange(toISO(new Date(year, month, day)));
    setOpen(false);
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-xs sm:text-sm outline-hidden transition-all duration-150 cursor-pointer ${
          open ? "border-[#0047AB] ring-2 ring-[#0047AB]/20" : "border-slate-300 hover:border-slate-400"
        } ${value ? "text-slate-900" : "text-slate-400"}`}
      >
        <span>{value ? formatVi(value) : placeholder}</span>
        <CalendarBlank size={15} weight="regular" aria-hidden className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-[248px] rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg animate-in fade-in-50 duration-150">
          <div className="mb-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
              aria-label="Tháng trước"
            >
              <CaretLeft size={13} weight="bold" aria-hidden />
            </button>
            <div className="text-xs font-bold text-slate-800">
              {MONTHS[month]} {year}
            </div>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
              aria-label="Tháng sau"
            >
              <CaretRight size={13} weight="bold" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="py-1 text-[10px] font-bold uppercase text-slate-400">
                {w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const iso = toISO(new Date(year, month, day));
              const selected = iso === value;
              const isToday = iso === todayISO;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(day)}
                  className={`h-7 rounded-md text-xs font-medium transition-colors duration-100 cursor-pointer ${
                    selected
                      ? "bg-[#0047AB] text-white"
                      : isToday
                        ? "bg-blue-50 text-[#0047AB]"
                        : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 flex items-center justify-between border-t border-slate-100 pt-1.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="rounded px-1.5 py-0.5 text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Xóa
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todayISO);
                setOpen(false);
              }}
              className="rounded px-1.5 py-0.5 text-[#0047AB] hover:underline cursor-pointer"
            >
              Hôm nay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
