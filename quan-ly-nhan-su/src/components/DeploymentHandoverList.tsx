"use client";

import { useMemo, useState } from "react";
import { deploymentItems, type DeploymentItem } from "@/data/deploymentItems";

const statusStyle: Record<DeploymentItem["status"], string> = {
  "Đã bàn giao": "bg-[#e7f7ed] text-[#15803d]",
  "Chưa bàn giao": "bg-[#fff4dd] text-[#b26a00]",
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
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#475569]">
        <span>
          <strong className="text-[#0f172a]">{deploymentItems.length}</strong> hạng mục
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#0f172a]">{handedOver}</strong> đã bàn giao ·{" "}
          {deploymentItems.length - handedOver} chưa bàn giao
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
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
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {["Tất cả trạng thái", "Đã bàn giao", "Chưa bàn giao"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e8eef8] bg-[#f7f9fc] text-[12px] font-semibold uppercase tracking-[0.03em] text-[#64748b]">
                <th className="w-[240px] px-4 py-3">Hạng mục</th>
                <th className="px-3 py-3">Nội dung</th>
                <th className="w-[160px] px-3 py-3">Link video</th>
                <th className="w-[150px] px-3 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3.5 font-semibold text-[#0f172a]">{row.category}</td>
                  <td className="px-3 py-3.5 text-[#334155]">{row.content}</td>
                  <td className="px-3 py-3.5">
                    {row.videoUrl ? (
                      <a
                        href={row.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[#0047AB] hover:underline"
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
                  <td className="px-3 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[#64748b]">
                    Không tìm thấy hạng mục phù hợp.
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
