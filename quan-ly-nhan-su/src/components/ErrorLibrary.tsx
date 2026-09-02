"use client";

import { useMemo, useState } from "react";
import { errorLibrary, type ErrorItem } from "@/data/error-library";
import { MagnifyingGlass } from "@/components/icons";

const severityStyle: Record<ErrorItem["severity"], string> = {
  "Nghiêm trọng": "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  "Trung bình": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  Nhẹ: "bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs",
};

const categoryStyle: Record<ErrorItem["category"], string> = {
  "Máy móc": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Mối hàn": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Vận hành": "bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs",
  "An toàn": "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
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
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{errorLibrary.length}</strong> mã lỗi
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-rose-700 font-mono tabular-nums">
            {errorLibrary.filter((e) => e.severity === "Nghiêm trọng").length}
          </strong>{" "}
          nghiêm trọng
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mã lỗi, tên, mô tả, cách xử lý..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          {["Tất cả nhóm", "Máy móc", "Mối hàn", "Vận hành", "An toàn"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          {["Tất cả mức độ", "Nghiêm trọng", "Trung bình", "Nhẹ"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="whitespace-nowrap px-4 py-3">Mã lỗi</th>
                <th className="min-w-[180px] px-3.5 py-3">Tên lỗi</th>
                <th className="whitespace-nowrap px-3.5 py-3">Nhóm</th>
                <th className="whitespace-nowrap px-3.5 py-3">Mức độ</th>
                <th className="min-w-[220px] px-3.5 py-3">Mô tả</th>
                <th className="min-w-[220px] px-3.5 py-3">Cách xử lý</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Số lần</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-[#0047AB] text-xs sm:text-sm">{e.code}</td>
                  <td className="px-3.5 py-3 font-semibold text-slate-900">{e.name}</td>
                  <td className="whitespace-nowrap px-3.5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${categoryStyle[e.category]}`}>
                      {e.category}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${severityStyle[e.severity]}`}>
                      {e.severity}
                    </span>
                  </td>
                  <td className="max-w-[280px] px-3.5 py-3 leading-relaxed text-slate-600 text-xs sm:text-sm">{e.description}</td>
                  <td className="max-w-[280px] px-3.5 py-3 leading-relaxed text-slate-800 font-medium text-xs sm:text-sm">{e.solution}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold font-mono text-slate-900 tabular-nums">
                    {e.occurrenceCount}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy mã lỗi</div>
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
