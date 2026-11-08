"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DotsThreeVertical } from "@/components/icons";

export type RowAction = { label: string; danger?: boolean; disabled?: boolean; onSelect: () => void };

/** Nút "⋯" mở menu thao tác của một dòng (menu nổi, không bị khung bảng cắt). */
export default function RowActionsMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); window.removeEventListener("keydown", onKey); };
  }, [pos]);
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={Boolean(pos)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        onClick={() => {
          if (pos) { setPos(null); return; }
          const rect = button.current?.getBoundingClientRect();
          if (rect) {
            // Ước lượng chiều cao menu; thiếu chỗ phía dưới thì mở lên phía trên để không bị cắt.
            const menuHeight = actions.length * 36 + 10;
            const below = rect.bottom + 4;
            const top = below + menuHeight > window.innerHeight - 8 ? Math.max(8, rect.top - menuHeight - 4) : below;
            setPos({ top, right: Math.max(8, window.innerWidth - rect.right) });
          }
        }}
      >
        <DotsThreeVertical size={18} weight="bold" aria-hidden />
      </button>
      {pos && createPortal(
        <>
          <div className="fixed inset-0 z-[120]" onClick={() => setPos(null)} aria-hidden />
          <div role="menu" className="fixed z-[121] min-w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-xl" style={{ top: pos.top, right: pos.right }}>
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                disabled={action.disabled}
                className={`block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 ${action.danger ? "text-red-700 hover:bg-red-50" : "text-slate-800"}`}
                onClick={() => { setPos(null); action.onSelect(); }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
