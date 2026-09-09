"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, Check, MagnifyingGlass } from "@/components/icons";

export type SelectMenuOption = {
  value: string;
  label: string;
  hint?: string;
};

type SelectMenuProps = {
  value: string;
  onChange: (next: string) => void;
  options: SelectMenuOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Cho phép gõ ngay trên ô để lọc danh sách (combobox + tìm kiếm). */
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  buttonClassName?: string;
  emptyLabel?: string;
};

/**
 * Dropdown chọn 1 giá trị, thay cho <select> gốc:
 * - Menu bám đúng bề rộng ô, KHÔNG tràn ra ngoài modal trên desktop.
 * - Nhãn dài tự xuống dòng, danh sách cuộn trong khung — hợp cả mobile lẫn desktop.
 * - `searchable`: ô trở thành input gõ để lọc trực tiếp.
 */
export default function SelectMenu({
  value,
  onChange,
  options,
  placeholder = "Chọn...",
  disabled = false,
  searchable = false,
  searchPlaceholder,
  className = "",
  buttonClassName = "",
  emptyLabel = "Không có lựa chọn phù hợp",
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function updatePlacement() {
      const el = boxRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const menuH = 272; // xấp xỉ max-h-64 + padding
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < menuH && rect.top > spaceBelow);
    }
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    setTyping(false);
    setQuery("");
  }

  const q = query.trim().toLocaleLowerCase("vi");
  const filtered = useMemo(
    () =>
      !q
        ? options
        : options.filter(
            (o) =>
              o.label.toLocaleLowerCase("vi").includes(q) ||
              (o.hint ?? "").toLocaleLowerCase("vi").includes(q),
          ),
    [options, q],
  );

  function pick(next: string) {
    onChange(next);
    close();
  }

  const baseButton = `flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-xs sm:text-sm outline-hidden transition-all duration-150 ${
    open ? "border-[#0047AB] ring-2 ring-[#0047AB]/20" : "border-slate-300 hover:border-slate-400"
  } disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 ${buttonClassName}`;

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      {searchable ? (
        <div className={`${baseButton} ${selected && !typing ? "text-slate-900" : ""}`}>
          <MagnifyingGlass aria-hidden size={14} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={typing ? query : selected?.label ?? ""}
            placeholder={selected ? undefined : searchPlaceholder ?? placeholder}
            onFocus={() => {
              setOpen(true);
              setTyping(true);
              setQuery("");
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setTyping(true);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) {
                e.preventDefault();
                pick(filtered[0].value);
                inputRef.current?.blur();
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-slate-900 outline-hidden placeholder:text-slate-400"
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label={open ? "Đóng danh sách" : "Mở danh sách"}
            onClick={() => {
              if (open) {
                close();
              } else {
                setOpen(true);
                inputRef.current?.focus();
              }
            }}
            className="shrink-0 text-slate-400"
          >
            <CaretDown
              size={13}
              weight="bold"
              aria-hidden
              className={`transition-transform duration-150 ${open ? "rotate-180 text-[#0047AB]" : ""}`}
            />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => (open ? close() : setOpen(true))}
          className={`${baseButton} cursor-pointer ${selected ? "text-slate-900" : "text-slate-400"}`}
        >
          <span className="min-w-0 flex-1 truncate">{selected?.label ?? placeholder}</span>
          <CaretDown
            size={13}
            weight="bold"
            aria-hidden
            className={`shrink-0 text-slate-400 transition-transform duration-150 ${open ? "rotate-180 text-[#0047AB]" : ""}`}
          />
        </button>
      )}

      {open && !disabled && (
        <div
          className={`absolute left-0 right-0 z-50 flex max-h-64 flex-col rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg animate-in fade-in-50 duration-150 ${
            dropUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
          }`}
        >
          <div className="flex flex-col gap-0.5 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-xs text-slate-400">{emptyLabel}</div>
            ) : (
              filtered.map((o) => {
                const active = o.value === value;
                return (
                  <button
                    key={o.value || "__empty__"}
                    type="button"
                    onClick={() => pick(o.value)}
                    className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs sm:text-sm transition-colors duration-150 ${
                      active ? "bg-blue-50/70 font-semibold text-[#0047AB]" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block whitespace-normal break-words leading-snug">{o.label}</span>
                      {o.hint && (
                        <span className="mt-0.5 block text-[11px] font-normal text-slate-400">{o.hint}</span>
                      )}
                    </span>
                    {active && <Check size={14} weight="bold" aria-hidden className="mt-0.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
