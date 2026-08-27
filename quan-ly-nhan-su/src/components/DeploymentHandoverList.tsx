"use client";

import { useMemo, useState } from "react";
import { deploymentItems, type DeploymentItem } from "@/data/deploymentItems";

const statusStyle: Record<DeploymentItem["status"], string> = {
  "Đã bàn giao": "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
  "Chưa bàn giao": "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]",
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
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-[12.5px] sm:text-[13px] text-[#475569]">
        <span>
          <strong className="font-semibold text-[#0f172a]">{deploymentItems.length}</strong> hạng mục
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="font-semibold text-[#15803d]">{handedOver}</strong> đã bàn giao ·{" "}
          <span className="font-medium text-[#b45309]">{deploymentItems.length - handedOver}</span> chưa bàn giao
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm hạng mục, nội dung..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
        >
          {["Tất cả trạng thái", "Đã bàn giao", "Chưa bàn giao"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#64748b]">
                <th className="w-[240px] px-4 py-3">Hạng mục</th>
                <th className="px-3.5 py-3">Nội dung</th>
                <th className="w-[160px] px-3.5 py-3">Link video</th>
                <th className="w-[150px] px-3.5 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-[#f8fafc]/90 transition-colors duration-150">
                  <td className="px-4 py-3.5 font-semibold text-[#0f172a]">{row.category}</td>
                  <td className="px-3.5 py-3.5 text-[#334155] leading-relaxed">{row.content}</td>
                  <td className="px-3.5 py-3.5 whitespace-nowrap">
                    {row.videoUrl ? (
                      <a
                        href={row.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-[#0047AB] hover:underline"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Xem video
                      </a>
                    ) : (
                      <span className="text-[#94a3b8]">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-[#64748b]">
                    <div className="text-[14px] font-medium">Không tìm thấy hạng mục phù hợp</div>
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
