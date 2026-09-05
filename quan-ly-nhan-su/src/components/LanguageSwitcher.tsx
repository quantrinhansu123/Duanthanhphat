"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretDown, Check } from "@/components/icons";
import { useLanguage, type Lang } from "@/i18n/LanguageProvider";

const OPTIONS: { value: Lang; label: string; short: string; flag: string }[] = [
  { value: "vi", label: "Tiếng Việt", short: "VN", flag: "🇻🇳" },
  { value: "en", label: "English (US)", short: "EN", flag: "🇺🇸" },
];

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 96;

    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const viewportWidth = vv ? vv.width : (typeof window !== "undefined" ? window.innerWidth : 360);
    const viewportHeight = vv ? vv.height : (typeof window !== "undefined" ? window.innerHeight : 640);
    const offsetX = vv ? vv.offsetLeft : 0;
    const offsetY = vv ? vv.offsetTop : 0;

    // Tính toán chiều ngang: ưu tiên canh theo mép phải của nút, kẹp trong giới hạn viewport
    let left = rect.right - menuWidth + offsetX;
    if (left + menuWidth > offsetX + viewportWidth - 8) {
      left = offsetX + viewportWidth - menuWidth - 8;
    }
    if (left < offsetX + 8) {
      left = offsetX + 8;
    }

    // Tính toán chiều dọc: nếu tràn đáy màn hình thì tự động lật lên trên nút
    let top = rect.bottom + 6 + offsetY;
    if (top + menuHeight > offsetY + viewportHeight - 8 && rect.top - menuHeight - 6 >= 8) {
      top = rect.top - menuHeight - 6 + offsetY;
    }

    setCoords({ top, left });
  };

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>("button[role='option']");
        if (!items || items.length === 0) return;
        const activeEl = document.activeElement;
        const index = Array.from(items).findIndex((el) => el === activeEl);
        if (e.key === "ArrowDown") {
          const next = index < items.length - 1 ? items[index + 1] : items[0];
          next.focus();
        } else {
          const prev = index > 0 ? items[index - 1] : items[items.length - 1];
          prev.focus();
        }
      }
    }

    function onScrollOrResize() {
      updatePosition();
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onScrollOrResize);
      window.visualViewport.addEventListener("scroll", onScrollOrResize);
    }

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", onScrollOrResize);
        window.visualViewport.removeEventListener("scroll", onScrollOrResize);
      }
    };
  }, [open]);

  const active = OPTIONS.find((o) => o.value === lang) ?? OPTIONS[0];

  return (
    <div className="relative inline-block" data-no-i18n="true">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) updatePosition();
            return next;
          });
        }}
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

      {open &&
        mounted &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            aria-label="Danh sách ngôn ngữ"
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: "176px",
              zIndex: 9999,
            }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl animate-in fade-in-50 zoom-in-95 duration-100 focus:outline-hidden"
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
                    className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs sm:text-sm transition-colors cursor-pointer ${
                      selected
                        ? "font-semibold text-[#0047AB] bg-blue-50/60"
                        : "font-medium text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-base leading-none">{o.flag}</span>
                    <span className="flex-1">{o.label}</span>
                    {selected && (
                      <Check size={14} weight="bold" aria-hidden className="text-[#0047AB]" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}
