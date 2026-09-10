"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretDown, Check, MagnifyingGlass } from "@/components/icons";
import { usePopover } from "@/components/usePopover";

export type MultiSelectOption = { value: string; label: string; hint?: string };

type Props = {
  values: string[];
  onChange: (next: string[]) => void;
  options: MultiSelectOption[];
  /** Nhãn hiển thị khi chưa chọn gì (nghĩa là "tất cả"). */
  allLabel?: string;
  searchPlaceholder?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
};

/** Chọn nhiều giá trị + gõ để lọc. Menu render qua portal nên không bị modal cắt. */
export default function MultiSelectMenu({
  values,
  onChange,
  options,
  allLabel = "Tất cả",
  searchPlaceholder = "Gõ để tìm…",
  className = "",
  buttonClassName = "",
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { style: menuStyle } = usePopover(boxRef, open && !disabled);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
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
  }, [open]);

  function close() {
    setOpen(false);
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

  const selectedSet = new Set(values);
  const selectedOptions = options.filter((o) => selectedSet.has(o.value));

  function toggle(value: string) {
    onChange(selectedSet.has(value) ? values.filter((v) => v !== value) : [...values, value]);
  }

  const fieldBorder = open
    ? "border-[#0047AB] ring-2 ring-[#0047AB]/20"
    : "border-slate-300 hover:border-slate-400";

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-xs sm:text-sm outline-hidden transition-all duration-150 ${fieldBorder} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 ${values.length > 0 ? "text-slate-900" : "text-slate-400"} ${buttonClassName}`}
      >
        <span className="min-w-0 flex-1 truncate">
          {values.length === 0
            ? allLabel
            : values.length === 1
              ? selectedOptions[0]?.label ?? `${values.length} mục`
              : `Đã chọn ${values.length} mục`}
        </span>
        <CaretDown
          size={13}
          weight="bold"
          aria-hidden
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${open ? "rotate-180 text-[#0047AB]" : ""}`}
        />
      </button>

      {open && !disabled && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="z-[70] flex flex-col rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          <div className="relative mb-1.5">
            <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2 text-xs text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
            />
          </div>
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 self-start px-2.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
            >
              Bỏ chọn hết ({values.length})
            </button>
          )}
          <div className="flex flex-col gap-0.5 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-xs text-slate-400">Không tìm thấy</div>
            ) : (
              filtered.map((o) => {
                const checked = selectedSet.has(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                    className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs sm:text-sm transition-colors duration-150 ${
                      checked ? "bg-blue-50/70 font-semibold text-[#0047AB]" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300">
                      {checked && <Check size={12} weight="bold" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block whitespace-normal break-words leading-snug">{o.label}</span>
                      {o.hint && <span className="mt-0.5 block text-[11px] font-normal text-slate-400">{o.hint}</span>}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
