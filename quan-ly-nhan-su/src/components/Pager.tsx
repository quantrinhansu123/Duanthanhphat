"use client";

import { useEffect, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

/** Phân trang phía client: `const { rows, pagerProps } = usePaged(filtered)` rồi `<Pager {...pagerProps} />` dưới bảng. */
export function usePaged<T>(items: T[], initialSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);
  // Danh sách đổi (lọc/tìm kiếm) → về trang 1. Dùng độ dài làm tín hiệu; đủ cho lọc, thêm/xóa dòng.
  useEffect(() => setPage(1), [items.length, pageSize]);
  return {
    rows: items.slice((current - 1) * pageSize, current * pageSize),
    pagerProps: { page: current, pageSize, total: items.length, setPage, setPageSize },
  };
}

type PagerProps = { page: number; pageSize: number; total: number; setPage: (p: number) => void; setPageSize: (n: number) => void };

export default function Pager({ page, pageSize, total, setPage, setPageSize }: PagerProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= 10) return null; // ít dòng thì không cần
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) for (let i = 1; i <= totalPages; i++) pages.push(i);
  else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  const btn = "inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs text-xs sm:text-sm">
      <div className="flex items-center gap-2 text-slate-600">
        <span>
          Hiển thị <strong className="font-mono tabular-nums text-slate-900">{(page - 1) * pageSize + 1} – {Math.min(page * pageSize, total)}</strong> trong tổng số{" "}
          <strong className="font-mono tabular-nums text-slate-900">{total}</strong>
        </span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 cursor-pointer"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} dòng/trang</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className={btn}>
          <CaretLeft size={14} weight="bold" /> Trước
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`d${i}`} className="px-1 text-slate-400">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-mono font-bold cursor-pointer ${p === page ? "bg-[#0047AB] text-white shadow-xs" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={btn}>
          Sau <CaretRight size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}
