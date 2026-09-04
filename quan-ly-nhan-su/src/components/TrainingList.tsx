"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { trainingHistory } from "@/data/trainingHistory";
import { trainingCourses, type TrainingCourse } from "@/data/trainings";
import { welders } from "@/data/welders";
import WelderMultiSelect from "@/components/WelderMultiSelect";
import DateField from "@/components/DateField";
import { CaretRight, Check, MagnifyingGlass, PencilSimple, X } from "@/components/icons";

const resultStyle: Record<string, string> = {
  Đạt: "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Không đạt": "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  "Đang học": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

const DEFAULT_THUMBNAIL =
  "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=480&h=270&q=80";

function viToISO(value: string) {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function TrainingFormModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: TrainingCourse;
  onClose: () => void;
  onSubmit: (course: TrainingCourse) => void;
}) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    trainer: initial?.trainer ?? "",
    date: initial ? viToISO(initial.date) : "",
    duration: initial && initial.duration !== "0:00" ? initial.duration : "",
    location: initial && initial.location !== "Chưa cập nhật" ? initial.location : "",
    result: initial?.result ?? "Đạt",
    description: initial?.description ?? "",
    topics: initial?.topics.join("\n") ?? "",
  });
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    initial?.attendees?.map((a) => a.id) ?? [],
  );
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!form.title.trim() || !form.trainer.trim() || !form.date.trim()) {
      setError("Vui lòng nhập tên khóa, người đào tạo và ngày đào tạo.");
      return;
    }
    const attendees = welders
      .filter((w) => attendeeIds.includes(w.id))
      .map((w) => ({ id: w.id, name: w.name, weldingId: w.weldingId, weldingTeam: w.weldingTeam }));
    onSubmit({
      id: initial?.id ?? `local-${Date.now()}`,
      title: form.title.trim(),
      trainer: form.trainer.trim(),
      date: form.date ? new Date(form.date + "T00:00:00").toLocaleDateString("vi-VN") : "",
      duration: form.duration.trim() || "0:00",
      participants: attendees.length,
      result: form.result,
      thumbnail: initial?.thumbnail ?? DEFAULT_THUMBNAIL,
      location: form.location.trim() || "Chưa cập nhật",
      description: form.description.trim(),
      topics: form.topics
        .split("\n")
        .flatMap((line) => line.split(","))
        .map((t) => t.trim())
        .filter(Boolean),
      attendees,
    });
  }

  const fieldClass =
    "mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <button type="button" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" aria-label="Đóng" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">Đào tạo &amp; chứng chỉ</div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">
              {isEdit ? "Chỉnh sửa khóa đào tạo" : "Thêm khóa đào tạo"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {error && (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">
              Tên khóa đào tạo *
              <input value={form.title} onChange={(e) => set("title", e.target.value)} className={fieldClass} />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Người đào tạo *
              <input value={form.trainer} onChange={(e) => set("trainer", e.target.value)} className={fieldClass} />
            </label>
            <div className="block text-xs font-semibold text-slate-700">
              Ngày đào tạo *
              <DateField value={form.date} onChange={(v) => set("date", v)} className="mt-1.5" />
            </div>
            <label className="block text-xs font-semibold text-slate-700">
              Thời lượng
              <input value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="4:00" className={fieldClass} />
            </label>
            <div className="block text-xs font-semibold text-slate-700 sm:col-span-2">
              Học viên
              <WelderMultiSelect
                selectedIds={attendeeIds}
                onChange={setAttendeeIds}
                placeholder="Chọn học viên..."
                searchPlaceholder="Tìm thợ hàn..."
              />
            </div>
            <label className="block text-xs font-semibold text-slate-700">
              Kết quả
              <select value={form.result} onChange={(e) => set("result", e.target.value)} className={`${fieldClass} cursor-pointer`}>
                {["Đạt", "Không đạt", "Đang học"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Địa điểm
              <input value={form.location} onChange={(e) => set("location", e.target.value)} className={fieldClass} />
            </label>
            <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">
              Mô tả
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
                className={`${fieldClass} h-auto py-2`}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">
              Nội dung đào tạo (mỗi dòng hoặc cách nhau bằng dấu phẩy)
              <textarea
                value={form.topics}
                onChange={(e) => set("topics", e.target.value)}
                rows={3}
                className={`${fieldClass} h-auto py-2`}
              />
            </label>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all duration-150 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all duration-150 cursor-pointer"
          >
            {isEdit ? "Lưu thay đổi" : "Lưu khóa đào tạo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrainingDetailModal({
  course,
  onClose,
  onEdit,
}: {
  course: TrainingCourse;
  onClose: () => void;
  onEdit: () => void;
}) {
  const trainees = useMemo(
    () => trainingHistory.filter((r) => r.courseTitle === course.title),
    [course.title],
  );
  const attendees = course.attendees ?? [];

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
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] hover:border-slate-400 transition-colors duration-150 cursor-pointer"
            >
              <PencilSimple size={14} weight="bold" aria-hidden />
              Chỉnh sửa
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
              aria-label="Đóng"
            >
              <X size={18} weight="bold" aria-hidden />
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
                {attendees.length > 0
                  ? `${attendees.length} người`
                  : trainees.length > 0
                    ? `${trainees.length} người`
                    : "Chưa có dữ liệu"}
              </span>
            </div>

            {attendees.length > 0 ? (
              <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[440px] border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                      <th className="px-3.5 py-2.5">Họ tên</th>
                      <th className="px-3.5 py-2.5">Welding ID</th>
                      <th className="px-3.5 py-2.5">Tổ hàn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendees.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                        <td className="px-3.5 py-2.5 font-semibold text-slate-900">{a.name}</td>
                        <td className="px-3.5 py-2.5 font-mono text-[#0047AB]">{a.weldingId}</td>
                        <td className="px-3.5 py-2.5 text-slate-700">{a.weldingTeam}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : trainees.length > 0 ? (
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
  const [courses, setCourses] = useState<TrainingCourse[]>(trainingCourses);
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState<TrainingCourse | null>(null);
  const [toast, setToast] = useState("");

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.trainer.toLowerCase().includes(q) ||
        c.date.includes(q),
    );
  }, [query, courses]);

  function openDetail(course: TrainingCourse) {
    setActiveId(course.id);
    setDetail(course);
  }

  function handleAdd(course: TrainingCourse) {
    setCourses((prev) => [course, ...prev]);
    setOpenAdd(false);
    showToast(`Đã thêm khóa "${course.title}"`);
  }

  function handleUpdate(course: TrainingCourse) {
    setCourses((prev) => prev.map((c) => (c.id === course.id ? course : c)));
    setEditing(null);
    setDetail((prev) => (prev && prev.id === course.id ? course : prev));
    showToast(`Đã cập nhật khóa "${course.title}"`);
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
        <button
          type="button"
          onClick={() => setOpenAdd(true)}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer whitespace-nowrap"
        >
          <span className="text-base leading-none">+</span> Thêm khóa đào tạo
        </button>
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
                      <CaretRight size={10} weight="fill" aria-hidden />
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
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-slate-900/85 px-1.5 py-0.5 text-[11px] font-bold font-mono text-white tracking-wide">
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

      {detail && (
        <TrainingDetailModal
          course={detail}
          onClose={() => { setDetail(null); setActiveId(null); }}
          onEdit={() => setEditing(detail)}
        />
      )}

      {openAdd && <TrainingFormModal onClose={() => setOpenAdd(false)} onSubmit={handleAdd} />}

      {editing && (
        <TrainingFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={handleUpdate}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs sm:text-sm font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Check size={16} weight="bold" aria-hidden className="text-emerald-500" />
          {toast}
        </div>
      )}
    </main>
  );
}
