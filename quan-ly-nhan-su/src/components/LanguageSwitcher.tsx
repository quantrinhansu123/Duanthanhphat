"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown, Check } from "@/components/icons";
import { useLanguage, type Lang } from "@/i18n/LanguageProvider";

const OPTIONS: { value: Lang; label: string; short: string; flag: string }[] = [
  { value: "vi", label: "Tiếng Việt", short: "VN", flag: "🇻🇳" },
  { value: "en", label: "English (US)", short: "EN", flag: "🇺🇸" },
];

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
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

  const active = OPTIONS.find((o) => o.value === lang) ?? OPTIONS[0];

  return (
    <div ref={boxRef} className="relative" data-no-i18n="true">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors duration-150 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/20"
        aria-label="Chọn ngôn ngữ"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="tabular-nums">{active.short}</span>
        <CaretDown
          size={12}
          weight="bold"
          aria-hidden
          className={`text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {OPTIONS.map((o) => {
            const selected = o.value === lang;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setOpen(false);
                    if (o.value !== lang) setLang(o.value);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs sm:text-sm transition-colors ${
                    selected
                      ? "font-semibold text-[#0047AB] bg-blue-50/60"
                      : "font-medium text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-base leading-none">{o.flag}</span>
                  <span className="flex-1">{o.label}</span>
                  {selected && <Check size={14} weight="bold" aria-hidden className="text-[#0047AB]" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
