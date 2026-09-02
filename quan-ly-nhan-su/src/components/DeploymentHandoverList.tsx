"use client";

import { useMemo, useState } from "react";
import { deploymentItems, type DeploymentItem } from "@/data/deploymentItems";
import { CaretRight, MagnifyingGlass } from "@/components/icons";

const statusStyle: Record<DeploymentItem["status"], string> = {
  "Đã bàn giao": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Chưa bàn giao": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

export default function DeploymentHandoverList() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deploymentItems.filter((row) => {
      const matchQ =
        !q ||
        row.category.toLowerCase().includes(q) ||
        row.content.toLowerCase().includes(q);
      const matchStatus = status === "Tất cả trạng thái" || row.status === status;
      return matchQ && matchStatus;
    });
  }, [query, status]);

  const handedOver = deploymentItems.filter((r) => r.status === "Đã bàn giao").length;

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{deploymentItems.length}</strong> hạng mục
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{handedOver}</strong> đã bàn giao ·{" "}
          <span className="font-medium text-amber-700 font-mono tabular-nums">{deploymentItems.length - handedOver}</span> chưa bàn giao
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm hạng mục, nội dung..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          {["Tất cả trạng thái", "Đã bàn giao", "Chưa bàn giao"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="w-[240px] px-4 py-3">Hạng mục</th>
                <th className="px-3.5 py-3">Nội dung</th>
                <th className="w-[160px] px-3.5 py-3">Link video</th>
                <th className="w-[150px] px-3.5 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-4 py-3.5 font-semibold text-slate-900">{row.category}</td>
                  <td className="px-3.5 py-3.5 text-slate-700 leading-relaxed">{row.content}</td>
                  <td className="px-3.5 py-3.5 whitespace-nowrap">
                    {row.videoUrl ? (
                      <a
                        href={row.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-[#0047AB] hover:underline"
                      >
                        <CaretRight size={14} weight="fill" aria-hidden />
                        Xem video
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy hạng mục phù hợp</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
