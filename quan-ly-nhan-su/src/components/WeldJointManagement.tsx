"use client";

import { useMemo, useState } from "react";
import { weldJoints, type WeldPurpose } from "@/data/weld-joints";

const weldTypeStyle: Record<WeldPurpose, string> = {
  "Thử nghiệm": "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]",
  "Đào tạo": "bg-[#faf5ff] text-[#7c3aed] border border-[#e9d5ff]",
  "Sản xuất": "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
};

export default function WeldJointManagement() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return weldJoints;
    return weldJoints.filter(
      (row) =>
        row.trayName.toLowerCase().includes(q) ||
        row.jointName.toLowerCase().includes(q) ||
        row.method.toLowerCase().includes(q) ||
        row.weldType.toLowerCase().includes(q) ||
        row.certificate.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-[12.5px] sm:text-[13px] text-[#475569]">
        <span>
          <strong className="font-semibold text-[#0f172a]">{weldJoints.length}</strong> mối hàn
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          Hiển thị <strong className="font-semibold text-[#0047AB]">{filtered.length}</strong> kết quả
        </span>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
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
            placeholder="Tìm tên khay, mối hàn, phương pháp, loại mối, chứng chỉ..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#64748b]">
                <th className="w-16 whitespace-nowrap px-4 py-3 text-center">STT</th>
                <th className="min-w-[200px] px-3.5 py-3">Tên khay</th>
                <th className="min-w-[220px] px-3.5 py-3">Tên mối hàn</th>
                <th className="min-w-[140px] px-3.5 py-3">Phương pháp hàn</th>
                <th className="min-w-[140px] px-3.5 py-3">Loại mối hàn</th>
                <th className="min-w-[240px] px-3.5 py-3">Chứng chỉ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#64748b]">
                    <div className="text-[14px] font-medium">Không tìm thấy mối hàn phù hợp</div>
                  </td>
                </tr>
              ) : (
                filtered.map((row, index) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[#f8fafc]/90 transition-colors duration-150"
                  >
                    <td className="px-4 py-3 text-center font-mono font-medium text-[#64748b]">{index + 1}</td>
                    <td className="px-3.5 py-3 font-semibold text-[#0f172a]">{row.trayName}</td>
                    <td className="px-3.5 py-3 text-[#334155]">{row.jointName}</td>
                    <td className="px-3.5 py-3">
                      <span className="inline-flex items-center rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-[11px] font-semibold text-[#0047AB] border border-[#bfdbfe]">
                        {row.method}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${weldTypeStyle[row.weldType]}`}>
                        {row.weldType}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="inline-flex items-center rounded-full bg-[#f1f5f9] border border-[#e2e8f0] px-2.5 py-0.5 text-[11px] font-medium text-[#334155]">
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
