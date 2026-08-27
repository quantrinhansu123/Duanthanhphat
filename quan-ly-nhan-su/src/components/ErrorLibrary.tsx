"use client";

import { useMemo, useState } from "react";
import { errorLibrary, type ErrorItem } from "@/data/error-library";

const severityStyle: Record<ErrorItem["severity"], string> = {
  "Nghiêm trọng": "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]",
  "Trung bình": "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]",
  Nhẹ: "bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]",
};

const categoryStyle: Record<ErrorItem["category"], string> = {
  "Máy móc": "bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]",
  "Mối hàn": "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
  "Vận hành": "bg-[#faf5ff] text-[#7c3aed] border border-[#e9d5ff]",
  "An toàn": "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]",
};

export default function ErrorLibrary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tất cả nhóm");
  const [severity, setSeverity] = useState("Tất cả mức độ");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return errorLibrary.filter((e) => {
      const matchQ =
        !q ||
        e.code.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.solution.toLowerCase().includes(q);
      const matchCat = category === "Tất cả nhóm" || e.category === category;
      const matchSev = severity === "Tất cả mức độ" || e.severity === severity;
      return matchQ && matchCat && matchSev;
    });
  }, [query, category, severity]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-[12.5px] sm:text-[13px] text-[#475569]">
        <span>
          <strong className="font-semibold text-[#0f172a]">{errorLibrary.length}</strong> mã lỗi
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="font-semibold text-[#b91c1c]">
            {errorLibrary.filter((e) => e.severity === "Nghiêm trọng").length}
          </strong>{" "}
          nghiêm trọng
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
            placeholder="Tìm mã lỗi, tên, mô tả, cách xử lý..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
        >
          {["Tất cả nhóm", "Máy móc", "Mối hàn", "Vận hành", "An toàn"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
        >
          {["Tất cả mức độ", "Nghiêm trọng", "Trung bình", "Nhẹ"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#64748b]">
                <th className="whitespace-nowrap px-4 py-3">Mã lỗi</th>
                <th className="min-w-[180px] px-3.5 py-3">Tên lỗi</th>
                <th className="whitespace-nowrap px-3.5 py-3">Nhóm</th>
                <th className="whitespace-nowrap px-3.5 py-3">Mức độ</th>
                <th className="min-w-[220px] px-3.5 py-3">Mô tả</th>
                <th className="min-w-[220px] px-3.5 py-3">Cách xử lý</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Số lần</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-[#f8fafc]/90 transition-colors duration-150">
                  <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-[#0047AB]">{e.code}</td>
                  <td className="px-3.5 py-3 font-semibold text-[#0f172a]">{e.name}</td>
                  <td className="whitespace-nowrap px-3.5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${categoryStyle[e.category]}`}>
                      {e.category}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${severityStyle[e.severity]}`}>
                      {e.severity}
                    </span>
                  </td>
                  <td className="max-w-[280px] px-3.5 py-3 leading-relaxed text-[#475569]">{e.description}</td>
                  <td className="max-w-[280px] px-3.5 py-3 leading-relaxed text-[#334155] font-medium">{e.solution}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold font-mono text-[#0f172a]">
                    {e.occurrenceCount}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#64748b]">
                    <div className="text-[14px] font-medium">Không tìm thấy mã lỗi</div>
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
