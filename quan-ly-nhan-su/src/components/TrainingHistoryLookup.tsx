"use client";

import { useMemo, useState } from "react";
import {
  trainingHistory,
  type TrainingHistoryRecord,
} from "@/data/trainingHistory";

const resultStyle: Record<TrainingHistoryRecord["result"], string> = {
  Đạt: "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Không đạt": "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  "Đang học": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

const statusStyle: Record<TrainingHistoryRecord["status"], string> = {
  "Hoàn thành": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Đang học": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  "Không hoàn thành": "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
};

export default function TrainingHistoryLookup() {
  const [query, setQuery] = useState("");
  const [personType, setPersonType] = useState("Tất cả đối tượng");
  const [course, setCourse] = useState("Tất cả khóa đào tạo");
  const [result, setResult] = useState("Tất cả kết quả");
  const [status, setStatus] = useState("Tất cả trạng thái");

  const courseOptions = useMemo(
    () => ["Tất cả khóa đào tạo", ...Array.from(new Set(trainingHistory.map((r) => r.courseTitle)))],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trainingHistory.filter((row) => {
      const matchQ =
        !q ||
        row.personCode.toLowerCase().includes(q) ||
        row.personName.toLowerCase().includes(q) ||
        row.courseTitle.toLowerCase().includes(q) ||
        row.trainer.toLowerCase().includes(q) ||
        row.department.toLowerCase().includes(q) ||
        row.certificate.toLowerCase().includes(q);
      const matchType = personType === "Tất cả đối tượng" || row.personType === personType;
      const matchCourse = course === "Tất cả khóa đào tạo" || row.courseTitle === course;
      const matchResult = result === "Tất cả kết quả" || row.result === result;
      const matchStatus = status === "Tất cả trạng thái" || row.status === status;
      return matchQ && matchType && matchCourse && matchResult && matchStatus;
    });
  }, [query, personType, course, result, status]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
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
            placeholder="Tìm theo mã, họ tên, khóa đào tạo, người đào tạo..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select
            value={personType}
            onChange={(e) => setPersonType(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {["Tất cả đối tượng", "Nhân sự", "Thợ hàn"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="h-10 max-w-[220px] truncate rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {courseOptions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {["Tất cả kết quả", "Đạt", "Không đạt", "Đang học"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {["Tất cả trạng thái", "Hoàn thành", "Đang học", "Không hoàn thành"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <span className="text-xs sm:text-sm text-slate-500 whitespace-nowrap self-center">
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{filtered.length}</strong> bản ghi
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Mã</th>
                <th className="px-3.5 py-3">Họ tên</th>
                <th className="px-3.5 py-3">Đối tượng</th>
                <th className="px-3.5 py-3">Phòng ban</th>
                <th className="px-3.5 py-3">Khóa đào tạo</th>
                <th className="px-3.5 py-3">Người đào tạo</th>
                <th className="px-3.5 py-3">Ngày</th>
                <th className="px-3.5 py-3">Thời lượng</th>
                <th className="px-3.5 py-3">Kết quả</th>
                <th className="px-3.5 py-3">Trạng thái</th>
                <th className="px-3.5 py-3">Chứng chỉ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-4 py-3 font-mono font-semibold text-[#0047AB] text-xs sm:text-sm">{row.personCode}</td>
                  <td className="px-3.5 py-3 font-semibold text-slate-900">{row.personName}</td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        row.personType === "Thợ hàn"
                          ? "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs"
                          : "bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs"
                      }`}
                    >
                      {row.personType}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{row.department}</td>
                  <td className="max-w-[240px] px-3.5 py-3 text-slate-700">
                    <div className="line-clamp-2 font-medium">{row.courseTitle}</div>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{row.trainer}</td>
                  <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap font-mono text-xs sm:text-sm">{row.date}</td>
                  <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap font-mono text-xs sm:text-sm">{row.duration}</td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${resultStyle[row.result]}`}
                    >
                      {row.result}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="max-w-[220px] px-3.5 py-3">
                    {row.certificate === "Chưa cấp" ? (
                      <span className="text-xs text-slate-400">Chưa cấp</span>
                    ) : (
                      <span className="text-xs sm:text-sm font-semibold text-[#0047AB]">{row.certificate}</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy lịch sử đào tạo</div>
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
