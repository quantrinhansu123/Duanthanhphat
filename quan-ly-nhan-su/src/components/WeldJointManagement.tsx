"use client";

import { useMemo, useState } from "react";
import { weldJoints, type WeldPurpose } from "@/data/weld-joints";

const weldTypeStyle: Record<WeldPurpose, string> = {
  "Thử nghiệm": "bg-[#fff4dd] text-[#b26a00]",
  "Đào tạo": "bg-[#f3e8ff] text-[#7c3aed]",
  "Sản xuất": "bg-[#e7f7ed] text-[#15803d]",
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
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#475569]">
        <span>
          <strong className="text-[#0f172a]">{weldJoints.length}</strong> mối hàn
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          Hiển thị <strong className="text-[#0f172a]">{filtered.length}</strong> kết quả
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
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eef1f5] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
              <th className="w-16 whitespace-nowrap px-4 py-3 text-center">STT</th>
              <th className="min-w-[220px] px-4 py-3">Tên khay</th>
              <th className="min-w-[240px] px-4 py-3">Tên mối hàn</th>
              <th className="min-w-[140px] bg-[#fef9c3] px-4 py-3 text-[#713f12]">Phương pháp hàn</th>
              <th className="min-w-[140px] bg-[#fef9c3] px-4 py-3 text-[#713f12]">Loại mối hàn</th>
              <th className="min-w-[260px] px-4 py-3">Chứng chỉ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-[#64748b]">
                  Không tìm thấy mối hàn phù hợp.
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-b border-[#f1f5f9] transition hover:bg-[#f8fafc] last:border-b-0"
                >
                  <td className="px-4 py-3 text-center font-medium text-[#64748b]">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-[#0f172a]">{row.trayName}</td>
                  <td className="px-4 py-3 text-[#334155]">{row.jointName}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded bg-[#e8eef8] px-2.5 py-1 text-[12px] font-semibold text-[#0047AB]">
                      {row.method}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded px-2.5 py-1 text-[12px] font-semibold ${weldTypeStyle[row.weldType]}`}>
                      {row.weldType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-[#eef4ff] px-2.5 py-1 text-[12px] font-medium text-[#0047AB]">
                      {row.certificate}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
