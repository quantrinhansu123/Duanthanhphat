"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { trainingHistory } from "@/data/trainingHistory";
import { trainingCourses, type TrainingCourse } from "@/data/trainings";

const resultStyle: Record<string, string> = {
  Đạt: "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
  "Không đạt": "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]",
  "Đang học": "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]",
};

function TrainingDetailModal({ course, onClose }: { course: TrainingCourse; onClose: () => void }) {
  const trainees = useMemo(
    () => trainingHistory.filter((r) => r.courseTitle === course.title),
    [course.title],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <button
        type="button"
        className="fixed inset-0 bg-[#071633]/60 backdrop-blur-xs transition-opacity duration-200"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-detail-title"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-[#d9e2f1] bg-white shadow-[0_24px_60px_rgba(7,22,51,0.24)] animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#e8eef8] px-5 sm:px-6 py-4 bg-white">
          <div className="min-w-0 pr-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#0047AB]">Khóa đào tạo · {course.date}</div>
            <h2 id="training-detail-title" className="mt-0.5 text-[17px] sm:text-[18px] font-bold leading-snug text-[#0f172a]">
              {course.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors duration-150 cursor-pointer"
            aria-label="Đóng"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-xl bg-[#e2e8f0] border border-[#d9e2f1] shadow-2xs">
            <Image src={course.thumbnail} alt={course.title} fill className="object-cover" sizes="680px" />
            <span className="absolute bottom-2.5 right-2.5 rounded bg-[#071633]/85 px-2 py-1 text-[11px] font-bold font-mono text-white tracking-wide">
              {course.duration}
            </span>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-0.5 text-[11px] font-semibold text-[#15803d]">
              Kết quả: {course.result}
            </span>
            <span className="inline-flex items-center rounded-full bg-[#f1f5f9] border border-[#e2e8f0] px-2.5 py-0.5 text-[11px] font-semibold text-[#475569]">
              {course.participants} học viên
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#e8eef8] bg-[#f8fafc] px-4 py-3">
              <div className="text-[11px] font-bold uppercase text-[#64748b]">Người đào tạo</div>
              <div className="mt-1 text-[13.5px] font-semibold text-[#0f172a]">{course.trainer}</div>
            </div>
            <div className="rounded-xl border border-[#e8eef8] bg-[#f8fafc] px-4 py-3">
              <div className="text-[11px] font-bold uppercase text-[#64748b]">Địa điểm</div>
              <div className="mt-1 text-[13.5px] font-semibold text-[#0f172a]">{course.location}</div>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-[11.5px] font-bold uppercase tracking-wider text-[#64748b]">Mô tả</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#334155]">{course.description}</p>
          </div>

          <div className="mt-5">
            <div className="text-[11.5px] font-bold uppercase tracking-wider text-[#64748b]">Nội dung đào tạo</div>
            <ul className="mt-2 space-y-2">
              {course.topics.map((topic) => (
                <li key={topic} className="flex items-start gap-2.5 text-[13px] text-[#334155]">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-[#0047AB]" />
                  {topic}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-[11.5px] font-bold uppercase tracking-wider text-[#64748b]">
                Danh sách học viên
              </div>
              <span className="text-[12px] text-[#64748b]">
                {trainees.length > 0 ? `${trainees.length} người` : "Chưa có dữ liệu"}
              </span>
            </div>

            {trainees.length > 0 ? (
              <div className="table-scroll overflow-x-auto rounded-xl border border-[#d9e2f1]">
                <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#e8eef8] bg-[#f8fafc] text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                      <th className="px-3.5 py-2.5">Họ tên</th>
                      <th className="px-3.5 py-2.5">Loại</th>
                      <th className="px-3.5 py-2.5">Kết quả</th>
                      <th className="px-3.5 py-2.5">Chứng chỉ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {trainees.map((t) => (
                      <tr key={t.id} className="hover:bg-[#f8fafc]/90 transition-colors duration-150">
                        <td className="px-3.5 py-2.5">
                          <div className="font-semibold text-[#0f172a]">{t.personName}</div>
                          <div className="text-[11.5px] font-mono text-[#64748b]">{t.personCode}</div>
                        </td>
                        <td className="px-3.5 py-2.5 text-[#334155]">{t.personType}</td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${resultStyle[t.result] ?? "bg-[#f1f5f9] border border-[#e2e8f0] text-[#64748b]"}`}
                          >
                            {t.result}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-[12.5px] text-[#334155]">{t.certificate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#d9e2f1] px-4 py-8 text-center text-[13px] text-[#64748b]">
                Chưa có danh sách học viên cho khóa này.
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-[#e8eef8] px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0f172a] hover:border-[#cbd5e1] active:bg-[#f1f5f9] transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrainingList() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(trainingCourses[0]?.id ?? "");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<TrainingCourse | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trainingCourses;
    return trainingCourses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.trainer.toLowerCase().includes(q) ||
        c.date.includes(q),
    );
  }, [query]);

  const active = filtered.find((c) => c.id === activeId) ?? filtered[0];

  function openDetail(course: TrainingCourse) {
    setActiveId(course.id);
    setMenuOpen(null);
    setDetail(course);
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
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
            placeholder="Tìm khóa đào tạo, người đào tạo..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
          />
        </div>
        <span className="text-[12.5px] text-[#64748b]">
          <strong className="font-semibold text-[#0f172a]">{filtered.length}</strong> khóa học
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-xs">
        <ul className="divide-y divide-[#f1f5f9]">
          {filtered.map((course: TrainingCourse) => {
            const selected = active?.id === course.id;
            return (
              <li key={course.id}>
                <button
                  type="button"
                  onClick={() => openDetail(course)}
                  className={`group relative flex w-full cursor-pointer items-start gap-3.5 px-4 py-3.5 text-left transition-colors duration-150 ${
                    selected ? "bg-[#eff6ff]/70" : "hover:bg-[#f8fafc]"
                  }`}
                >
                  {selected && (
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[#0047AB]">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  )}

                  <div className="relative ml-2.5 h-[72px] w-[128px] flex-none overflow-hidden rounded-lg bg-[#e2e8f0] border border-[#d9e2f1] shadow-2xs">
                    <Image
                      src={course.thumbnail}
                      alt={course.title}
                      fill
                      className="object-cover"
                      sizes="128px"
                    />
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-[#071633]/85 px-1.5 py-0.5 text-[9.5px] font-bold font-mono text-white tracking-wide">
                      {course.duration}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="line-clamp-2 text-[13.5px] sm:text-[14px] font-semibold leading-snug text-[#0f172a]">
                      {course.title}
                    </div>
                    <div className="mt-1 text-[12px] text-[#64748b]">
                      <strong className="text-[#334155] font-semibold">{course.trainer}</strong> · {course.date} · {course.participants} học viên
                    </div>
                    <div className="mt-2">
                      <span className="inline-flex items-center rounded-full bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#15803d]">
                        {course.result}
                      </span>
                    </div>
                  </div>

                  <div
                    className="relative flex-none"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setMenuOpen(menuOpen === course.id ? null : course.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setMenuOpen(menuOpen === course.id ? null : course.id);
                        }
                      }}
                      className={`rounded-lg p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors duration-150 cursor-pointer ${
                        selected || menuOpen === course.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      aria-label="Tùy chọn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </span>
                    {menuOpen === course.id && (
                      <div className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-[#e2e8f0] bg-white py-1.5 shadow-[0_10px_25px_rgba(7,22,51,0.12)] animate-in fade-in-50 zoom-in-95 duration-100">
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-[12.5px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => openDetail(course)}
                        >
                          Xem chi tiết
                        </button>
                        <div className="px-3.5 py-2 text-[12.5px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0047AB] cursor-pointer transition-colors">Danh sách học viên</div>
                        <div className="px-3.5 py-2 text-[12.5px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0047AB] cursor-pointer transition-colors">Xuất báo cáo</div>
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-[13px] text-[#64748b]">Không tìm thấy khóa đào tạo.</li>
          )}
        </ul>
      </div>

      {detail && <TrainingDetailModal course={detail} onClose={() => setDetail(null)} />}
    </main>
  );
}
