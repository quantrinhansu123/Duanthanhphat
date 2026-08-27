"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { trainingHistory } from "@/data/trainingHistory";
import { trainingCourses, type TrainingCourse } from "@/data/trainings";

const resultStyle: Record<string, string> = {
  Đạt: "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Không đạt": "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  "Đang học": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

function TrainingDetailModal({
  course,
  onClose,
}: {
  course: TrainingCourse;
  onClose: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

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
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-detail-title"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div className="min-w-0 pr-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">Khóa đào tạo · {course.date}</div>
            <h2 id="training-detail-title" className="mt-0.5 text-base sm:text-lg font-bold leading-snug text-slate-900">
              {course.title}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
                aria-label="Tùy chọn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100 text-left">
                  <div className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors">Danh sách học viên</div>
                  <div className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors">Xuất báo cáo</div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
              aria-label="Đóng"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
            <Image src={course.thumbnail} alt={course.title} fill className="object-cover" sizes="680px" />
            <span className="absolute bottom-2.5 right-2.5 rounded bg-slate-900/85 px-2 py-1 text-xs font-bold font-mono text-white tracking-wide">
              {course.duration}
            </span>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-2xs">
              Kết quả: {course.result}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700 shadow-2xs">
              {course.participants} học viên
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
              <div className="text-xs font-bold uppercase text-slate-500">Người đào tạo</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{course.trainer}</div>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
              <div className="text-xs font-bold uppercase text-slate-500">Địa điểm</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{course.location}</div>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Mô tả</div>
            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-700">{course.description}</p>
          </div>

          <div className="mt-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Nội dung đào tạo</div>
            <ul className="mt-2 space-y-2">
              {course.topics.map((topic) => (
                <li key={topic} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-[#0047AB]" />
                  {topic}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Danh sách học viên
              </div>
              <span className="text-xs text-slate-500">
                {trainees.length > 0 ? `${trainees.length} người` : "Chưa có dữ liệu"}
              </span>
            </div>

            {trainees.length > 0 ? (
              <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[520px] border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                      <th className="px-3.5 py-2.5">Họ tên</th>
                      <th className="px-3.5 py-2.5">Loại</th>
                      <th className="px-3.5 py-2.5">Kết quả</th>
                      <th className="px-3.5 py-2.5">Chứng chỉ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trainees.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                        <td className="px-3.5 py-2.5">
                          <div className="font-semibold text-slate-900">{t.personName}</div>
                          <div className="text-xs font-mono text-slate-500">{t.personCode}</div>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-700">{t.personType}</td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${resultStyle[t.result] ?? "bg-slate-100 border border-slate-200 text-slate-600 shadow-2xs"}`}
                          >
                            {t.result}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-xs sm:text-sm text-slate-700">{t.certificate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-xs sm:text-sm text-slate-500">
                Chưa có danh sách học viên cho khóa này.
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
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
  const [activeId, setActiveId] = useState<string | null>(null);
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

  function openDetail(course: TrainingCourse) {
    setActiveId(course.id);
    setDetail(course);
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
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
            placeholder="Tìm khóa đào tạo, người đào tạo..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <span className="text-xs sm:text-sm text-slate-500">
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{filtered.length}</strong> khóa học
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <ul className="divide-y divide-slate-100">
          {filtered.map((course: TrainingCourse) => {
            const selected = activeId === course.id;
            return (
              <li key={course.id}>
                <button
                  type="button"
                  onClick={() => openDetail(course)}
                  className={`group relative flex w-full cursor-pointer items-start gap-3.5 px-4 py-3.5 text-left transition-colors duration-150 ${
                    selected ? "bg-blue-50/70" : "hover:bg-slate-50/80"
                  }`}
                >
                  {selected && (
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[#0047AB]">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  )}

                  <div className="relative h-[72px] w-[128px] flex-none overflow-hidden rounded-lg bg-slate-100 border border-slate-200 shadow-2xs">
                    <Image
                      src={course.thumbnail}
                      alt={course.title}
                      fill
                      className="object-cover"
                      sizes="128px"
                    />
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-bold font-mono text-white tracking-wide">
                      {course.duration}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="line-clamp-2 text-xs sm:text-sm font-semibold leading-snug text-slate-900">
                      {course.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      <strong className="text-slate-700 font-semibold">{course.trainer}</strong> · {course.date} · {course.participants} học viên
                    </div>
                    <div className="mt-2">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-2xs">
                        {course.result}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-xs sm:text-sm text-slate-500">Không tìm thấy khóa đào tạo.</li>
          )}
        </ul>
      </div>

      {detail && <TrainingDetailModal course={detail} onClose={() => { setDetail(null); setActiveId(null); }} />}
    </main>
  );
}
