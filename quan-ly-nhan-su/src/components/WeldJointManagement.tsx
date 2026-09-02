"use client";

import { useMemo, useState } from "react";
import { weldJoints, type WeldPurpose } from "@/data/weld-joints";
import { MagnifyingGlass } from "@/components/icons";

const weldTypeStyle: Record<WeldPurpose, string> = {
  "Thử nghiệm": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  "Đào tạo": "bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs",
  "Sản xuất": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
};

export default function WeldJointManagement() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return weldJoints;
    return weldJoints.filter(
      (row) =>
        row.method.toLowerCase().includes(q) ||
        row.weldType.toLowerCase().includes(q) ||
        row.certificate.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{weldJoints.length}</strong> mối hàn
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Hiển thị <strong className="font-semibold text-[#0047AB] font-mono tabular-nums">{filtered.length}</strong> kết quả
        </span>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm phương pháp, loại mối, chứng chỉ..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="w-16 whitespace-nowrap px-4 py-3 text-center">STT</th>
                <th className="min-w-[140px] px-3.5 py-3">Phương pháp hàn</th>
                <th className="min-w-[140px] px-3.5 py-3">Loại mối hàn</th>
                <th className="min-w-[240px] px-3.5 py-3">Chứng chỉ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy mối hàn phù hợp</div>
                  </td>
                </tr>
              ) : (
                filtered.map((row, index) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/80 transition-colors duration-150"
                  >
                    <td className="px-4 py-3 text-center font-mono font-medium text-slate-500 text-xs sm:text-sm">{index + 1}</td>
                    <td className="px-3.5 py-3">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#0047AB] border border-blue-200 shadow-2xs">
                        {row.method}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${weldTypeStyle[row.weldType]}`}>
                        {row.weldType}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700 shadow-2xs">
                        {row.certificate}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
