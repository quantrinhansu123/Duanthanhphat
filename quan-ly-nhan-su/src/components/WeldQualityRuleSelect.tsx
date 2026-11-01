"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CaretDown, Check, MagnifyingGlass, SlidersHorizontal } from "@/components/icons";
import type { SavedWeldQualityRule } from "@/lib/weldQuality";

/** Menu nằm trong dialog để không bị lớp top-layer của dialog che portal. */
export default function WeldQualityRuleSelect({ value, rules, group, disabled, onChange, onConfigure }: {
  value: string | null; rules: SavedWeldQualityRule[]; group: string; disabled: boolean;
  onChange: (id: string) => void; onConfigure: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();
  const labelId = useId();
  const selected = rules.find((r) => r.id === value);
  const options = rules.filter((r) => (r.dang_ap_dung || r.id === value) && `${r.ten} ${r.phien_ban}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function choose(id: string) {
    onChange(id); setOpen(false); setQuery(""); trigger.current?.focus();
  }
  return <div ref={box} className="relative">
    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
      <span id={labelId} className="text-sm font-semibold text-slate-900">Tiêu chí áp dụng</span>
      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{group}</span>
    </div>
    <button ref={trigger} type="button" disabled={disabled} aria-labelledby={labelId} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
      onClick={() => { setOpen((v) => !v); setQuery(""); setActive(0); }}
      onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); setActive(0); } }}
      className={`flex min-h-14 w-full items-center gap-3 rounded-xl border bg-white px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-50 ${open ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-300 hover:border-blue-400"}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><SlidersHorizontal size={20} aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-semibold text-slate-900">{selected?.ten ?? "Chọn tiêu chí nghiệm thu"}</span>
        <span className="mt-0.5 block text-xs font-normal text-slate-500">{selected ? `Phiên bản ${selected.phien_ban} · ${selected.dang_ap_dung ? "Đang áp dụng" : "Phiên bản đã lưu trên mối"}` : "Tiêu chí theo dự án và nhóm mối hàn"}</span>
      </span>
      <CaretDown size={18} aria-hidden className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && !disabled && <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); trigger.current?.focus(); }
        if (e.key === "Tab") setOpen(false);
      }}>
      <div className="relative border-b border-slate-100 p-2.5">
        <MagnifyingGlass size={16} aria-hidden className="pointer-events-none absolute left-5 top-6 text-slate-400" />
        <input ref={search} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          role="combobox" aria-label="Tìm tiêu chí nghiệm thu" aria-autocomplete="list" aria-expanded="true" aria-controls={listId}
          aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); if (options[active]) choose(options[active].id); }
          }}
          placeholder="Tìm tên tiêu chí…" className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
      </div>
      <ul id={listId} role="listbox" aria-labelledby={labelId} className="max-h-52 overflow-y-auto p-1.5">
        {options.map((r, i) => <li key={r.id} id={`${listId}-${i}`} role="option" aria-selected={r.id === value}>
          <button type="button" tabIndex={-1} onClick={() => choose(r.id)} onPointerMove={() => setActive(i)}
            className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left ${i === active ? "bg-blue-50" : "hover:bg-slate-50"}`}>
            <span><span className="block text-sm font-semibold text-slate-900">{r.ten}</span><span className="mt-1 block text-xs font-normal text-slate-500">Phiên bản {r.phien_ban} · {r.dang_ap_dung ? "Đang áp dụng" : "Lưu theo bản cũ"}{r.ndt_truoc_rfi ? " · NDT trước RFI" : ""}</span></span>
            {r.id === value && <Check size={18} aria-hidden className="shrink-0 text-blue-700" />}
          </button>
        </li>)}
        {!options.length && <li className="px-3 py-4 text-sm text-slate-500">{rules.some((r) => r.dang_ap_dung) ? "Không có tiêu chí khớp từ khóa." : `Chưa thiết lập tiêu chí cho ${group}.`}</li>}
      </ul>
      <button type="button" onClick={() => { setOpen(false); onConfigure(); }} className="min-h-11 w-full border-t border-slate-100 px-4 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50">Thiết lập tiêu chí cho nhóm này</button>
    </div>}
  </div>;
}
