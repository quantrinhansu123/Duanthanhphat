"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarBlank, CaretLeft, CaretRight } from "@/components/icons";
import { useLanguage } from "@/i18n/LanguageProvider";
import { usePopover } from "@/components/usePopover";

type DateFieldProps = {
  /** Giá trị ISO: "yyyy-mm-dd", hoặc "yyyy-mm-ddThh:mm" khi withTime. Rỗng nếu chưa chọn. */
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  /** Cho phép chọn cả giờ ngay trong menu lịch. */
  withTime?: boolean;
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

function formatVi(dateISO: string) {
  const d = parseISO(dateISO);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "";
}

function formatDisplay(value: string, withTime: boolean) {
  const d = formatVi(value.slice(0, 10));
  if (!d) return "";
  const time = value.slice(11, 16);
  return withTime && time ? `${d} ${time}` : d;
}

/** Trả về giá trị emit hoàn chỉnh (kèm giờ nếu withTime) hoặc null. */
function manualParse(text: string, withTime: boolean, fallbackTime: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  const iso = toISO(date);
  if (!withTime) return iso;
  const hh = m[4] != null ? Number(m[4]) : Number(fallbackTime.slice(0, 2)) || 8;
  const mm = m[5] != null ? Number(m[5]) : Number(fallbackTime.slice(3, 5)) || 0;
  if (hh > 23 || mm > 59) return null;
  return `${iso}T${pad(hh)}:${pad(mm)}`;
}

export default function DateField({ value, onChange, placeholder, className = "", withTime = false }: DateFieldProps) {
  const { lang } = useLanguage();
  const WEEKDAYS = lang === "en" ? WEEKDAYS_EN : WEEKDAYS_VI;
  const MONTHS = lang === "en" ? MONTHS_EN : MONTHS_VI;
  const ph = placeholder ?? (withTime ? "dd/mm/yyyy HH:mm" : "dd/mm/yyyy");
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseISO(value.slice(0, 10)) ?? new Date());
  const [inputValue, setInputValue] = useState(() => formatDisplay(value, withTime));
  const boxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { style: menuStyle } = usePopover(boxRef, open, 264);

  const datePart = value.slice(0, 10);
  const timePart = withTime ? value.slice(11, 16) : "";

  useEffect(() => {
    const parsed = parseISO(value.slice(0, 10));
    if (parsed) setViewDate(parsed);
    setInputValue(formatDisplay(value, withTime));
  }, [value, withTime]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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

  function emit(dateISO: string, time?: string) {
    if (!dateISO) return onChange("");
    onChange(withTime ? `${dateISO}T${time || timePart || "08:00"}` : dateISO);
  }

  function pick(day: number) {
    emit(toISO(new Date(year, month, day)));
    if (!withTime) setOpen(false);
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div
        className={`flex h-11 w-full items-center rounded-lg border bg-white text-xs sm:h-10 sm:text-sm outline-hidden transition-all duration-150 ${
          open ? "border-[#0047AB] ring-2 ring-[#0047AB]/20" : "border-slate-300 hover:border-slate-400"
        }`}
      >
        <input
          value={inputValue}
          onChange={(event) => {
            const nextText = event.target.value;
            setInputValue(nextText);
            if (!nextText.trim()) return onChange("");
            const next = manualParse(nextText, withTime, timePart);
            if (next) onChange(next);
          }}
          onBlur={() => {
            if (!inputValue.trim()) return;
            const next = manualParse(inputValue, withTime, timePart);
            setInputValue(next ? formatDisplay(next, withTime) : formatDisplay(value, withTime));
          }}
          placeholder={ph}
          inputMode="numeric"
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-slate-900 outline-hidden placeholder:text-slate-400"
          aria-label={ph}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-full w-10 shrink-0 items-center justify-center text-slate-400 hover:text-[#0047AB]"
          aria-label="Mở lịch"
        >
          <CalendarBlank size={15} weight="regular" aria-hidden />
        </button>
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="z-[70] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg"
        >
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
              const selected = iso === datePart;
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

          {withTime && (
            <div className="mt-1.5 flex items-center gap-2 border-t border-slate-100 pt-1.5">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Giờ</span>
              <input
                type="time"
                value={timePart || "08:00"}
                onChange={(e) => emit(datePart || todayISO, e.target.value)}
                className="h-8 flex-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-mono text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              />
            </div>
          )}

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
                if (!withTime) emit(todayISO);
                setOpen(false);
              }}
              className="rounded px-1.5 py-0.5 text-[#0047AB] hover:underline cursor-pointer"
            >
              {withTime ? "Xong" : "Hôm nay"}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
