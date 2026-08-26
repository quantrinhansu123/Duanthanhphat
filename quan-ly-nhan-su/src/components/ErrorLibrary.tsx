"use client";

import { useMemo, useState } from "react";
import { errorLibrary, type ErrorItem } from "@/data/error-library";

const severityStyle: Record<ErrorItem["severity"], string> = {
  "Nghiêm trọng": "bg-[#fef2f2] text-[#dc2626]",
  "Trung bình": "bg-[#fef3c7] text-[#b45309]",
  Nhẹ: "bg-[#e8eef8] text-[#475569]",
};

const categoryStyle: Record<ErrorItem["category"], string> = {
  "Máy móc": "bg-[#eef4ff] text-[#0047AB]",
  "Mối hàn": "bg-[#e7f7ed] text-[#15803d]",
  "Vận hành": "bg-[#f3e8ff] text-[#7c3aed]",
  "An toàn": "bg-[#fef2f2] text-[#dc2626]",
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
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#475569]">
        <span>
          <strong className="text-[#0f172a]">{errorLibrary.length}</strong> mã lỗi
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#0f172a]">
            {errorLibrary.filter((e) => e.severity === "Nghiêm trọng").length}
          </strong>{" "}
          nghiêm trọng
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
            placeholder="Tìm mã lỗi, tên, mô tả, cách xử lý..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {["Tất cả nhóm", "Máy móc", "Mối hàn", "Vận hành", "An toàn"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {["Tất cả mức độ", "Nghiêm trọng", "Trung bình", "Nhẹ"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eef1f5] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
              <th className="whitespace-nowrap px-4 py-3">Mã lỗi</th>
              <th className="min-w-[180px] px-4 py-3">Tên lỗi</th>
              <th className="whitespace-nowrap px-4 py-3">Nhóm</th>
              <th className="whitespace-nowrap px-4 py-3">Mức độ</th>
              <th className="min-w-[220px] px-4 py-3">Mô tả</th>
              <th className="min-w-[220px] px-4 py-3">Cách xử lý</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Số lần</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-[#f2f4f7] text-[#334155] hover:bg-[#f8fafc]">
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#0047AB]">{e.code}</td>
                <td className="px-4 py-3 font-semibold text-[#0f172a]">{e.name}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${categoryStyle[e.category]}`}>
                    {e.category}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${severityStyle[e.severity]}`}>
                    {e.severity}
                  </span>
                </td>
                <td className="max-w-[280px] px-4 py-3 leading-relaxed text-[#64748b]">{e.description}</td>
                <td className="max-w-[280px] px-4 py-3 leading-relaxed text-[#64748b]">{e.solution}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#0f172a]">
                  {e.occurrenceCount}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#64748b]">
                  Không tìm thấy mã lỗi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
