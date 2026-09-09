"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, MagnifyingGlass, X } from "@/components/icons";

export type MachineSelectOption = {
  code: string;
  name?: string;
};

type MachineSelectProps = {
  value: string;
  onChange: (next: string) => void;
  options: MachineSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
};

export default function MachineSelect({
  value,
  onChange,
  options,
  placeholder = "Chọn máy áp dụng...",
  searchPlaceholder = "Tìm máy theo mã hoặc tên...",
  disabled = false,
  loading = false,
}: MachineSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropUp, setDropUp] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function updatePlacement() {
      const el = boxRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const menuH = 272;
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
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onClick);
        document.removeEventListener("keydown", onKey);
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const q = search.trim().toLocaleLowerCase("vi");
  const filtered = useMemo(
    () =>
      options.filter(
        (m) =>
          !q ||
          m.code.toLocaleLowerCase("vi").includes(q) ||
          (m.name ?? "").toLocaleLowerCase("vi").includes(q),
      ),
    [options, q],
  );

  const selected = options.find((m) => m.code === value);
  const displayLabel = selected
    ? selected.name
      ? `${selected.code} — ${selected.name}`
      : selected.code
    : value || "";

  function pick(code: string) {
    onChange(code === value ? "" : code);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative mt-1">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white pl-3 pr-2 text-xs sm:text-sm outline-hidden transition-all duration-150 cursor-pointer ${
          open ? "border-[#0047AB] ring-2 ring-[#0047AB]/20" : "border-slate-300 hover:border-slate-400"
        } ${value ? "text-slate-900 font-medium" : "text-slate-400"} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70`}
      >
        <span className="truncate">{displayLabel || placeholder}</span>
        <CaretDown
          size={13}
          weight="bold"
          aria-hidden
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${open ? "rotate-180 text-[#0047AB]" : ""} ${value && !disabled ? "mr-7" : ""}`}
        />
      </button>

      {value && !disabled && (
        <button
          type="button"
          aria-label="Xóa máy đã chọn"
          onClick={() => onChange("")}
          className="absolute right-7 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={11} weight="bold" aria-hidden />
        </button>
      )}

      {open && !disabled && (
        <div
          className={`absolute left-0 right-0 z-50 flex max-h-64 flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in-50 duration-150 ${
            dropUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
          }`}
        >
          <div className="relative mb-1.5">
            <MagnifyingGlass
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={14}
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2 text-xs text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
            />
          </div>
          <div className="flex flex-col gap-0.5 overflow-y-auto">
            {loading ? (
              <div className="px-2.5 py-3 text-center text-xs text-slate-400">Đang tải danh sách máy…</div>
            ) : filtered.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-xs text-slate-400">Không tìm thấy máy phù hợp</div>
            ) : (
              filtered.map((m) => {
                const active = m.code === value;
                return (
                  <button
                    key={m.code}
                    type="button"
                    onClick={() => pick(m.code)}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs sm:text-sm transition-colors duration-150 ${
                      active ? "bg-blue-50/70 font-semibold text-[#0047AB]" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono">{m.code}</span>
                      {m.name && (
                        <span className="ml-1.5 text-[11px] font-normal text-slate-400">{m.name}</span>
                      )}
                    </span>
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
