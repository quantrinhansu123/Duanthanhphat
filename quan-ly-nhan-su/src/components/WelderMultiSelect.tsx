"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { welders } from "@/data/welders";
import { CaretDown, MagnifyingGlass, X } from "@/components/icons";

export type WelderSelectOption = {
  id: string;
  name: string;
  weldingId: string;
  weldingTeam: string;
};

type WelderMultiSelectProps = {
  selectedIds: string[];
  onChange: (next: string[]) => void;
  options?: WelderSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
};

export default function WelderMultiSelect({
  selectedIds,
  onChange,
  options: suppliedOptions,
  placeholder = "Chọn thợ hàn...",
  searchPlaceholder = "Tìm thợ hàn...",
  disabled = false,
}: WelderMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [open]);

  const q = search.trim().toLowerCase();
  const sourceOptions = suppliedOptions ?? welders;
  const options = useMemo(
    () =>
      sourceOptions.filter(
        (w) =>
          !q ||
          w.name.toLowerCase().includes(q) ||
          w.weldingId.toLowerCase().includes(q) ||
          w.weldingTeam.toLowerCase().includes(q),
      ),
    [q, sourceOptions],
  );

  const selectedSet = new Set(selectedIds);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div ref={boxRef} className="relative mt-1.5">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-xs sm:text-sm font-medium outline-hidden transition-all duration-150 cursor-pointer ${
          open ? "border-[#0047AB] ring-2 ring-[#0047AB]/20" : "border-slate-300 hover:border-slate-400"
        } ${selectedIds.length > 0 ? "text-slate-900" : "text-slate-400"} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70`}
      >
        <span className="truncate">
          {selectedIds.length > 0 ? `Đã chọn ${selectedIds.length} người` : placeholder}
        </span>
        <CaretDown
          size={13}
          weight="bold"
          aria-hidden
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${open ? "rotate-180 text-[#0047AB]" : ""}`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 flex max-h-72 flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in-50 duration-150">
          <div className="relative mb-1.5">
            <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2 text-xs text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
            />
          </div>
          <div className="flex flex-col gap-0.5 overflow-y-auto">
            {options.map((w) => {
              const checked = selectedSet.has(w.id);
              return (
                <label
                  key={w.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors duration-150 ${
                    checked ? "bg-blue-50/70 font-semibold text-[#0047AB]" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(w.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 accent-[#0047AB] cursor-pointer"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {w.name}
                    <span className="ml-1.5 font-mono text-[11px] font-normal text-slate-400">
                      {w.weldingId} · {w.weldingTeam}
                    </span>
                  </span>
                </label>
              );
            })}
            {options.length === 0 && (
              <div className="px-2.5 py-3 text-center text-xs text-slate-400">Không tìm thấy thợ hàn</div>
            )}
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sourceOptions
            .filter((w) => selectedSet.has(w.id))
            .map((w) => (
              <span
                key={w.id}
                className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-[#0047AB]"
              >
                {w.name}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => toggle(w.id)}
                    className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-blue-100"
                    aria-label={`Bỏ ${w.name}`}
                  >
                    <X size={10} weight="bold" aria-hidden />
                  </button>
                )}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
