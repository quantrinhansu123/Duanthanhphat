"use client";

import { useMemo, useState } from "react";
import {
  trainingHistory,
  type TrainingHistoryRecord,
} from "@/data/trainingHistory";

const resultStyle: Record<TrainingHistoryRecord["result"], string> = {
  Đạt: "bg-[#0047AB] text-white",
  "Không đạt": "bg-[#94a3b8] text-white",
  "Đang học": "bg-[#f59e0b] text-white",
};

const statusStyle: Record<TrainingHistoryRecord["status"], string> = {
  "Hoàn thành": "bg-[#0047AB] text-white",
  "Đang học": "bg-[#f59e0b] text-white",
  "Không hoàn thành": "bg-[#ef4444] text-white",
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
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
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
            placeholder="Tìm theo mã, họ tên, khóa đào tạo, người đào tạo..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>
        <select
          value={personType}
          onChange={(e) => setPersonType(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {["Tất cả đối tượng", "Nhân sự", "Thợ hàn"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          className="h-10 max-w-[320px] rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {courseOptions.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {["Tất cả kết quả", "Đạt", "Không đạt", "Đang học"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {["Tất cả trạng thái", "Hoàn thành", "Đang học", "Không hoàn thành"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="text-[13px] text-[#64748b]">
          <strong className="text-[#0f172a]">{filtered.length}</strong> bản ghi
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e8eef8] bg-[#f7f9fc] text-[12px] font-semibold uppercase tracking-[0.03em] text-[#64748b]">
                <th className="px-4 py-3">Mã</th>
                <th className="px-3 py-3">Họ tên</th>
                <th className="px-3 py-3">Đối tượng</th>
                <th className="px-3 py-3">Phòng ban</th>
                <th className="px-3 py-3">Khóa đào tạo</th>
                <th className="px-3 py-3">Người đào tạo</th>
                <th className="px-3 py-3">Ngày</th>
                <th className="px-3 py-3">Thời lượng</th>
                <th className="px-3 py-3">Kết quả</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3">Chứng chỉ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3 font-medium text-[#0f172a]">{row.personCode}</td>
                  <td className="px-3 py-3 font-semibold text-[#0f172a]">{row.personName}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        row.personType === "Thợ hàn"
                          ? "bg-[#0047AB] text-white"
                          : "bg-[#e8eef8] text-[#475569]"
                      }`}
                    >
                      {row.personType}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{row.department}</td>
                  <td className="max-w-[240px] px-3 py-3 text-[#334155]">
                    <div className="line-clamp-2">{row.courseTitle}</div>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{row.trainer}</td>
                  <td className="px-3 py-3 text-[#334155]">{row.date}</td>
                  <td className="px-3 py-3 text-[#334155]">{row.duration}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${resultStyle[row.result]}`}
                    >
                      {row.result}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="max-w-[220px] px-3 py-3">
                    {row.certificate === "Chưa cấp" ? (
                      <span className="text-[12px] text-[#94a3b8]">Chưa cấp</span>
                    ) : (
                      <span className="text-[12px] font-medium text-[#0047AB]">{row.certificate}</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-[#64748b]">
                    Không tìm thấy lịch sử đào tạo.
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
