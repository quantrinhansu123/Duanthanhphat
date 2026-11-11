"use client";

import { useState } from "react";

/** Ô nhập kèm danh sách gợi ý ngay dưới ô (thay <datalist> gốc của trình duyệt hay mở lệch vị trí). Gõ để lọc, bấm để chọn. */
export default function ComboInput({ value, onChange, options, className }: {
  value: string;
  onChange: (value: string, option?: { value: string; hint?: string }) => void;
  options: { value: string; hint?: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const shown = options.filter((o) => !q || o.value.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)).slice(0, 50);
  return (
    <span className="relative block">
      <input className={className} value={value} autoComplete="off"
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onChange={(e) => { setOpen(true); onChange(e.target.value, options.find((o) => o.value === e.target.value)); }} />
      {open && shown.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm font-normal shadow-lg">
          {shown.map((o) => (
            // onMouseDown + preventDefault: chọn trước khi ô nhập mất focus.
            <li key={o.value + (o.hint ?? "")} onMouseDown={(e) => { e.preventDefault(); onChange(o.value, o); setOpen(false); }}
              className="cursor-pointer px-3 py-1.5 hover:bg-slate-100">
              <span className="font-semibold text-slate-900">{o.value}</span>
              {o.hint && <span className="ml-2 text-xs text-slate-500">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
