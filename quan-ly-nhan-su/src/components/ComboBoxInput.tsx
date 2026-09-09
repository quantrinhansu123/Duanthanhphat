"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown } from "@/components/icons";

type ComboBoxInputProps = {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  emptyLabel?: string;
  /** true = chỉ được chọn trong danh sách, không tạo giá trị mới. */
  strict?: boolean;
  /** Hiển thị lựa chọn bằng font mono (mặc định true). */
  mono?: boolean;
};

/**
 * Combobox có ô tìm kiếm ngay trên input + menu sổ xuống.
 * - Mặc định: cho GÕ giá trị mới (giữ nguyên chữ người dùng nhập).
 * - `strict`: chỉ chọn trong danh sách — gõ để lọc, rời ô sẽ khôi phục giá trị hợp lệ.
 */
export default function ComboBoxInput({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className = "",
  inputClassName = "",
  emptyLabel,
  strict = false,
  mono = true,
}: ComboBoxInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function updatePlacement() {
      const el = boxRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const menuH = 240; // xấp xỉ max-h-56 + padding
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setDropUp(spaceBelow < menuH && spaceAbove > spaceBelow);
    }
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open]);

  const uniqueOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of options) {
      const opt = raw.trim();
      if (!opt || seen.has(opt.toLocaleLowerCase("vi"))) continue;
      seen.add(opt.toLocaleLowerCase("vi"));
      out.push(opt);
    }
    return out;
  }, [options]);

  // Chữ đang hiển thị trong ô: khi đang gõ dùng draft, còn lại dùng value hiện tại.
  const shownText = strict ? (editing ? draft : value) : value;
  const q = (strict && editing ? draft : value).trim().toLocaleLowerCase("vi");

  const filtered = useMemo(() => {
    if (!q) return uniqueOptions;
    const starts = uniqueOptions.filter((o) => o.toLocaleLowerCase("vi").startsWith(q));
    const contains = uniqueOptions.filter(
      (o) => !o.toLocaleLowerCase("vi").startsWith(q) && o.toLocaleLowerCase("vi").includes(q),
    );
    return [...starts, ...contains];
  }, [q, uniqueOptions]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) finishEditing();
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft]);

  useEffect(() => {
    if (!open) setActiveIndex(-1);
  }, [open]);

  function commit(next: string) {
    onChange(next);
    setOpen(false);
    setActiveIndex(-1);
    setEditing(false);
    setDirty(false);
  }

  function finishEditing() {
    setOpen(false);
    setActiveIndex(-1);
    if (strict) {
      if (dirty) {
        const match = uniqueOptions.find(
          (o) => o.toLocaleLowerCase("vi") === draft.trim().toLocaleLowerCase("vi"),
        );
        if (match) onChange(match);
        else if (draft.trim() === "") onChange("");
        // gõ dở không khớp -> bỏ, giữ nguyên value cũ
      }
      setEditing(false);
      setDirty(false);
    }
  }

  function startEditing() {
    if (strict) {
      setDraft("");
      setEditing(true);
      setDirty(false);
    }
    setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick =
        activeIndex >= 0 && activeIndex < filtered.length
          ? filtered[activeIndex]
          : strict
            ? filtered[0]
            : undefined;
      if (open && pick) {
        commit(pick);
        inputRef.current?.blur();
        return;
      }
      if (!strict) {
        const typed = (editing ? draft : value).trim();
        if (typed) {
          commit(typed);
          inputRef.current?.blur();
          return;
        }
      }
      finishEditing();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      if (strict) {
        setEditing(false);
        setDirty(false);
      }
      setOpen(false);
    }
  }

  const typedValue = (strict && editing ? draft : value).trim();
  const canCreateTyped =
    !strict &&
    typedValue.length > 0 &&
    !uniqueOptions.some((opt) => opt.toLocaleLowerCase("vi") === typedValue.toLocaleLowerCase("vi"));

  const resolvedEmpty =
    emptyLabel ??
    (strict
      ? "Không tìm thấy lựa chọn phù hợp"
      : "Không có gợi ý phù hợp — nhấn Enter để dùng giá trị vừa nhập");

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={shownText}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          if (strict) {
            setDraft(e.target.value);
            setEditing(true);
            setDirty(true);
          } else {
            onChange(e.target.value);
          }
          setOpen(true);
        }}
        onFocus={startEditing}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className={`w-full pr-9 ${inputClassName}`}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={open ? "Đóng danh sách" : "Mở danh sách"}
        onClick={() => {
          if (disabled) return;
          if (open) {
            finishEditing();
          } else {
            startEditing();
            inputRef.current?.focus();
          }
        }}
        className="absolute right-0 top-0 flex h-full w-9 items-center justify-center text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed"
      >
        <CaretDown
          size={13}
          weight="bold"
          aria-hidden
          className={`transition-transform duration-150 ${open ? "rotate-180 text-[#0047AB]" : ""}`}
        />
      </button>

      {open && !disabled && (
        <ul
          role="listbox"
          className={`absolute left-0 right-0 z-50 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg animate-in fade-in-50 duration-150 ${
            dropUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
          }`}
        >
          {filtered.length === 0 ? (
            canCreateTyped ? (
              <li role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => {
                    commit(typedValue);
                    inputRef.current?.blur();
                  }}
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg bg-blue-50 px-2.5 py-2 text-left transition-colors hover:bg-blue-100"
                >
                  <span className="text-xs font-semibold text-[#0047AB]">+ Thêm mới từ form</span>
                  <span className={`text-xs sm:text-sm font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>
                    {typedValue}
                  </span>
                  <span className="text-[11px] leading-snug text-slate-500">
                    Nhấn Enter để dùng giá trị vừa nhập
                  </span>
                </button>
              </li>
            ) : (
              <li className="px-2.5 py-2 text-[11px] leading-snug text-slate-400">{resolvedEmpty}</li>
            )
          ) : (
            <>
              {filtered.map((opt, i) => {
                const active = i === activeIndex;
                const selected = opt.toLocaleLowerCase("vi") === value.trim().toLocaleLowerCase("vi");
                return (
                  <li key={opt} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => {
                        commit(opt);
                        inputRef.current?.blur();
                      }}
                      className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs sm:text-sm transition-colors duration-150 ${
                        active
                          ? "bg-blue-50 text-[#0047AB]"
                          : selected
                            ? "font-semibold text-[#0047AB]"
                            : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className={`min-w-0 flex-1 ${mono ? "truncate font-mono" : "whitespace-normal break-words leading-snug"}`}>
                        {opt}
                      </span>
                    </button>
                  </li>
                );
              })}
              {canCreateTyped && (
                <li role="option" aria-selected={false} className="mt-1 border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      commit(typedValue);
                      inputRef.current?.blur();
                    }}
                    className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left hover:bg-blue-50"
                  >
                    <span className="text-[11px] font-semibold text-[#0047AB]">+ Thêm mới từ form</span>
                    <span className={`text-xs sm:text-sm font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>
                      {typedValue}
                    </span>
                  </button>
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
