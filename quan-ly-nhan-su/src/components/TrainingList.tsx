"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WelderMultiSelect from "@/components/WelderMultiSelect";
import DateField from "@/components/DateField";
import { Check, MagnifyingGlass, PencilSimple, Plus, Trash, UploadSimple, X } from "@/components/icons";
import {
  deleteTrainingCourse,
  fetchCertificateGroups,
  fetchTrainingCourseDetail,
  fetchTrainingCourses,
  fetchTrainingPersonnelOptions,
  isTrainingAssetReferenced,
  saveTrainingCourse,
  type CertificateGroupOption,
  type DbTrainingCourse,
  type TrainingPersonnelOption,
} from "@/lib/trainingDb";
import { deleteCloudinaryAsset, uploadToCloudinary } from "@/lib/cloudinaryClient";

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
  certGroups,
  personnel,
  onClose,
  onSubmitSuccess,
}: {
  initial?: DbTrainingCourse;
  certGroups: CertificateGroupOption[];
  personnel: TrainingPersonnelOption[];
  onClose: () => void;
  onSubmitSuccess: () => void;
}) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    trainerId: initial?.trainerId ?? "",
    date: initial ? viToISO(initial.date) : "",
    duration: initial && initial.duration !== "0:00" ? initial.duration : "",
    location: initial && initial.location !== "Chưa cập nhật" ? initial.location : "",
    result: initial?.result ?? "Đạt",
    description: initial?.description ?? "",
    topics: initial?.topics.join("\n") ?? "",
    certGroupId: initial?.certificateGroupId ?? "",
  });

  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnail ?? DEFAULT_THUMBNAIL);
  const [cloudinaryPublicId, setCloudinaryPublicId] = useState(initial?.cloudinaryPublicId ?? "");
  const [uploadingImg, setUploadingImg] = useState(false);

  const [attendeeList, setAttendeeList] = useState<{
    id: string;
    result: "Đạt" | "Không đạt" | "Đang học";
  }[]>(
    initial?.attendees?.map((a) => ({ id: a.id, result: a.result })) ?? [],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(async () => {
    if (saving || uploadingImg) return;
    if (cloudinaryPublicId && cloudinaryPublicId !== initial?.cloudinaryPublicId) {
      await deleteCloudinaryAsset(cloudinaryPublicId);
    }
    onClose();
  }, [cloudinaryPublicId, initial?.cloudinaryPublicId, onClose, saving, uploadingImg]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving && !uploadingImg) void handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose, saving, uploadingImg]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImg(true);
    setError("");

    // Thử tải lên Cloudinary có chữ ký
    const uploadRes = await uploadToCloudinary(file, "thanhphat/trainings");
    setUploadingImg(false);

    if (uploadRes.result) {
      if (cloudinaryPublicId && cloudinaryPublicId !== initial?.cloudinaryPublicId) {
        await deleteCloudinaryAsset(cloudinaryPublicId);
      }
      setThumbnailUrl(uploadRes.result.secure_url);
      setCloudinaryPublicId(uploadRes.result.public_id);
    } else {
      setError(uploadRes.error || "Không tải được ảnh lên Cloudinary. Ảnh cũ được giữ nguyên.");
    }
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.date.trim()) {
      setError("Vui lòng nhập tên khóa và ngày đào tạo.");
      return;
    }

    setSaving(true);
    setError("");

    const topicsArray = form.topics
      .split("\n")
      .flatMap((line) => line.split(","))
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await saveTrainingCourse({
      id: initial?.id,
      title: form.title.trim(),
      date: form.date,
      duration: form.duration.trim(),
      location: form.location.trim(),
      description: form.description.trim(),
      trainerId: form.trainerId || undefined,
      result: form.result,
      thumbnail: thumbnailUrl,
      cloudinaryPublicId,
      certificateGroupId: form.certGroupId || undefined,
      topics: topicsArray,
      attendees: attendeeList.map((a) => ({
        employeeId: a.id,
        result: a.result,
      })),
    });

    setSaving(false);

    if (res.error) {
      if (cloudinaryPublicId && cloudinaryPublicId !== initial?.cloudinaryPublicId) {
        await deleteCloudinaryAsset(cloudinaryPublicId);
        setCloudinaryPublicId(initial?.cloudinaryPublicId ?? "");
        setThumbnailUrl(initial?.thumbnail ?? DEFAULT_THUMBNAIL);
      }
      setError(res.error);
      return;
    }

    if (initial?.cloudinaryPublicId && initial.cloudinaryPublicId !== cloudinaryPublicId) {
      const stillReferenced = await isTrainingAssetReferenced(initial.cloudinaryPublicId);
      if (!stillReferenced) await deleteCloudinaryAsset(initial.cloudinaryPublicId);
    }

    onSubmitSuccess();
    onClose();
  }

  const fieldClass =
    "mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <button type="button" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" aria-label="Đóng" onClick={() => void handleClose()} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">Đào tạo &amp; chứng chỉ</div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">
              {isEdit ? "Chỉnh sửa khóa đào tạo" : "Thêm khóa đào tạo mới"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void handleClose()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs sm:text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* Ảnh đại diện khóa học */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Ảnh đại diện khóa học</label>
            <div className="mt-2 flex items-center gap-4">
              <div className="relative h-24 w-40 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-2xs">
                <Image src={thumbnailUrl} alt="Thumbnail" fill className="object-cover" />
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImg}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <UploadSimple size={14} weight="bold" />
                  {uploadingImg ? "Đang tải ảnh..." : "Thay đổi ảnh"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (cloudinaryPublicId && cloudinaryPublicId !== initial?.cloudinaryPublicId) {
                      await deleteCloudinaryAsset(cloudinaryPublicId);
                    }
                    setThumbnailUrl(DEFAULT_THUMBNAIL);
                    setCloudinaryPublicId("");
                  }}
                  className="text-left text-xs text-slate-500 hover:text-rose-600 cursor-pointer"
                >
                  Dùng ảnh mặc định
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Tên khóa đào tạo *</label>
            <input
              type="text"
              className={fieldClass}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="VD: Kỹ thuật hàn aluminothermic UIC60"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Người đào tạo</label>
              <select
                className={fieldClass}
                value={form.trainerId}
                onChange={(e) => set("trainerId", e.target.value)}
              >
                <option value="">-- Chưa chỉ định --</option>
                {personnel.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Ngày đào tạo *</label>
              <div className="mt-1">
                <DateField value={form.date} onChange={(v) => set("date", v)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Thời lượng</label>
              <input
                type="text"
                className={fieldClass}
                value={form.duration}
                onChange={(e) => set("duration", e.target.value)}
                placeholder="VD: 4:00 (4 giờ)"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Địa điểm</label>
              <input
                type="text"
                className={fieldClass}
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="VD: Phòng đào tạo – Nhà máy Hà Nội"
              />
            </div>
          </div>

          {/* Chọn chứng chỉ cấp sau đào tạo */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
              Chứng chỉ cấp sau đào tạo (Tự động cấp cho học viên Đạt)
            </label>
            <select
              className={fieldClass}
              value={form.certGroupId}
              onChange={(e) => set("certGroupId", e.target.value)}
            >
              <option value="">-- Không cấp hoặc chưa gán nhóm chứng chỉ --</option>
              {certGroups.map((cg) => (
                <option key={cg.id} value={cg.id}>
                  {cg.name} {cg.issuer ? `(${cg.issuer})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Mô tả khóa học</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-xs sm:text-sm text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Mô tả mục tiêu, yêu cầu của khóa đào tạo..."
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Nội dung đào tạo (mỗi dòng một mục)</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-xs sm:text-sm text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              rows={3}
              value={form.topics}
              onChange={(e) => set("topics", e.target.value)}
              placeholder="Quy định ATLĐ&#10;Quy trình hàn&#10;Thực hành hiện trường"
            />
          </div>

          {/* Chọn danh sách học viên */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Danh sách học viên ({attendeeList.length} người)
            </label>
            <div className="mt-1">
              <WelderMultiSelect
                selectedIds={attendeeList.map((a) => a.id)}
                onChange={(ids) => {
                  setAttendeeList((prev) => {
                    const removedPassed = prev.filter((a) => a.result === "Đạt" && !ids.includes(a.id));
                    if (removedPassed.length > 0) {
                      const names = removedPassed
                        .map((a) => personnel.find((p) => p.id === a.id)?.name || a.id)
                        .join(", ");
                      const confirmed = window.confirm(
                        `Cảnh báo: Bạn đang bỏ chọn học viên đang "Đạt" (${names}). Chứng chỉ cấp sau đào tạo của học viên này sẽ tự động bị thu hồi. Bạn có chắc chắn muốn bỏ chọn không?`,
                      );
                      if (!confirmed) return prev;
                    }
                    const existingMap = new Map(prev.map((a) => [a.id, a.result]));
                    return ids.map((id) => ({
                      id,
                      result: existingMap.get(id) || "Đạt",
                    }));
                  });
                }}
                options={personnel.map((person) => ({
                  id: person.id,
                  name: person.name,
                  weldingId: person.code,
                  weldingTeam: person.team,
                }))}
                placeholder="Chọn học viên..."
                searchPlaceholder="Tìm nhân sự theo tên hoặc mã..."
              />
            </div>
            {attendeeList.length > 0 && (
              <div className="mt-2.5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-slate-50/50 p-2">
                {attendeeList.map((att) => {
                  const person = personnel.find((item) => item.id === att.id);
                  return (
                    <div key={att.id} className="flex items-center justify-between py-1.5 px-2 text-xs">
                      <span className="font-semibold text-slate-800">
                        {person?.name || att.id} ({person?.code || "—"})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Kết quả:</span>
                        <select
                          value={att.result}
                          onChange={(e) => {
                            const newRes = e.target.value as "Đạt" | "Không đạt" | "Đang học";
                            if (att.result === "Đạt" && newRes !== "Đạt") {
                              const confirmed = window.confirm(
                                `Xác nhận thay đổi kết quả: Học viên "${person?.name || att.id}" đang có kết quả "Đạt". Nếu đổi sang "${newRes}", chứng chỉ cấp sau khóa học sẽ tự động bị thu hồi. Bạn có chắc chắn muốn đổi không?`,
                              );
                              if (!confirmed) return;
                            }
                            setAttendeeList((prev) =>
                              prev.map((item) => (item.id === att.id ? { ...item, result: newRes } : item)),
                            );
                          }}
                          className="rounded border border-slate-300 bg-white px-2 py-0.5 font-semibold text-slate-700"
                        >
                          <option value="Đạt">Đạt</option>
                          <option value="Không đạt">Không đạt</option>
                          <option value="Đang học">Đang học</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-slate-50/80">
          <button
            type="button"
            onClick={() => void handleClose()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo khóa học"}
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
  onDelete,
}: {
  course: DbTrainingCourse;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <button type="button" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" aria-label="Đóng" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div className="min-w-0 pr-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
              Khóa đào tạo · {course.date}
            </div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold leading-snug text-slate-900">
              {course.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
            >
              <PencilSimple size={14} weight="bold" />
              Chỉnh sửa
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
              title="Xóa khóa học"
            >
              <Trash size={16} weight="bold" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              aria-label="Đóng"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
            <Image src={course.thumbnail} alt={course.title} fill className="object-cover" />
            <div className="absolute bottom-2.5 right-2.5 rounded bg-slate-900/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
              {course.duration}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${resultStyle[course.result] ?? resultStyle["Đạt"]}`}>
              Kết quả: {course.result}
            </span>
            <span className="inline-flex items-center rounded-full bg-blue-50 text-[#0047AB] border border-blue-200 px-2.5 py-0.5 text-xs font-semibold">
              {course.participantsCount} học viên
            </span>
            {course.certificateGroupName && (
              <span className="inline-flex items-center rounded-full bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 text-xs font-semibold">
                Cấp: {course.certificateGroupName}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs sm:text-sm">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Người đào tạo</div>
              <div className="mt-1 font-semibold text-slate-800">{course.trainer}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Địa điểm</div>
              <div className="mt-1 font-semibold text-slate-800">{course.location}</div>
            </div>
          </div>

          {course.description && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Mô tả</div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{course.description}</p>
            </div>
          )}

          {course.topics.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nội dung đào tạo</div>
              <ul className="space-y-1 text-xs sm:text-sm text-slate-700">
                {course.topics.map((tp, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#0047AB]">•</span>
                    <span>{tp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Danh sách học viên thực tế */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              <span>Danh sách học viên ({course.attendees?.length ?? 0} người)</span>
            </div>
            {(!course.attendees || course.attendees.length === 0) ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                Chưa có danh sách học viên cho khóa này.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="px-3 py-2">Họ tên</th>
                      <th className="px-3 py-2">Loại</th>
                      <th className="px-3 py-2">Kết quả</th>
                      <th className="px-3 py-2">Chứng chỉ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {course.attendees.map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2">
                          <Link
                            href="/ho-so-tho-han"
                            className="font-semibold text-slate-900 hover:text-[#0047AB] hover:underline"
                          >
                            {att.name}
                          </Link>
                          <div className="text-[11px] text-slate-400 font-mono">{att.weldingId}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{att.role}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${resultStyle[att.result] ?? ""}`}>
                            {att.result}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {att.certificateName ? (
                            <Link
                              href={`/chung-chi?certificateId=${att.certificateId || ""}`}
                              className="font-semibold text-[#0047AB] hover:underline"
                            >
                              {att.certificateName}
                            </Link>
                          ) : (
                            <span className="text-slate-400">Chưa cấp</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end border-t border-slate-200 px-5 sm:px-6 py-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
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
  const [courses, setCourses] = useState<DbTrainingCourse[]>([]);
  const [certGroups, setCertGroups] = useState<CertificateGroupOption[]>([]);
  const [personnel, setPersonnel] = useState<TrainingPersonnelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [detail, setDetail] = useState<DbTrainingCourse | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState<DbTrainingCourse | null>(null);
  const [toast, setToast] = useState("");

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [cRes, cgRes, personnelRes] = await Promise.all([
        fetchTrainingCourses(),
        fetchCertificateGroups(),
        fetchTrainingPersonnelOptions(),
      ]);
      setCourses(cRes.courses);
      setCertGroups(cgRes);
      setPersonnel(personnelRes);
      setLoadError(cRes.error || "");
    } catch (error) {
      setCourses([]);
      setLoadError(error instanceof Error ? error.message : "Không tải được dữ liệu đào tạo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  async function openDetailModal(c: DbTrainingCourse) {
    const res = await fetchTrainingCourseDetail(c.id);
    if (res.error || !res.course) {
      showToast(res.error || "Không tải được chi tiết khóa đào tạo.");
      return;
    }
    setDetail(res.course);
  }

  async function openEditModal(c: DbTrainingCourse) {
    const res = await fetchTrainingCourseDetail(c.id);
    if (res.error || !res.course) {
      showToast(res.error || "Không tải được dữ liệu khóa đào tạo để chỉnh sửa.");
      return;
    }
    setEditing(res.course);
  }

  async function handleDeleteCourse(course: DbTrainingCourse) {
    if (!confirm(`Xác nhận xóa khóa đào tạo "${course.title}"?`)) return;
    const res = await deleteTrainingCourse(course.id);
    if (res.success) {
      if (course.cloudinaryPublicId) {
        const stillReferenced = await isTrainingAssetReferenced(course.cloudinaryPublicId);
        if (!stillReferenced) await deleteCloudinaryAsset(course.cloudinaryPublicId);
      }
      showToast("Đã xóa khóa đào tạo thành công.");
      setDetail(null);
      void loadData();
    } else {
      showToast(res.error || "Không thể xóa khóa học.");
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 pb-8">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-medium text-white shadow-xl">
          <Check size={16} weight="bold" className="text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Thanh tìm kiếm & Thêm mới */}
      {loadError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Không tải được dữ liệu đào tạo: {loadError}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-xs">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên khóa, người đào tạo, ngày..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300/90 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-400 focus:outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpenAdd(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer"
        >
          <Plus size={16} weight="bold" />
          Thêm khóa đào tạo
        </button>
      </div>

      {/* Grid danh sách khóa học */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Đang tải danh sách khóa đào tạo từ cơ sở dữ liệu...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
          Không tìm thấy khóa đào tạo nào phù hợp.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-md transition-all duration-200"
            >
              <div
                className="relative aspect-video w-full overflow-hidden bg-slate-100 cursor-pointer group"
                onClick={() => openDetailModal(c)}
              >
                <Image
                  src={c.thumbnail}
                  alt={c.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2.5 left-2.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${resultStyle[c.result] ?? resultStyle["Đạt"]}`}>
                    {c.result}
                  </span>
                </div>
                <div className="absolute bottom-2.5 right-2.5 rounded bg-slate-900/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                  {c.duration}
                </div>
              </div>

              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                  {c.date}
                </div>
                <h3
                  onClick={() => openDetailModal(c)}
                  className="mt-1 font-bold text-slate-900 hover:text-[#0047AB] transition-colors cursor-pointer line-clamp-2"
                >
                  {c.title}
                </h3>
                <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed flex-1">
                  {c.description || "Chưa có mô tả chi tiết khóa học."}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>HLV: <strong className="text-slate-700">{c.trainer}</strong></span>
                  <span><strong className="text-slate-900 font-mono">{c.participantsCount}</strong> học viên</span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openDetailModal(c)}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 py-1.5 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                  >
                    Xem chi tiết
                  </button>
                  <button
                    type="button"
                    onClick={() => void openEditModal(c)}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0047AB] transition-colors cursor-pointer"
                    title="Chỉnh sửa"
                  >
                    <PencilSimple size={15} weight="bold" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal chi tiết khóa học */}
      {detail && (
        <TrainingDetailModal
          course={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            const current = detail;
            setDetail(null);
            setEditing(current);
          }}
          onDelete={() => void handleDeleteCourse(detail)}
        />
      )}

      {/* Modal thêm mới */}
      {openAdd && (
        <TrainingFormModal
          certGroups={certGroups}
          personnel={personnel}
          onClose={() => setOpenAdd(false)}
          onSubmitSuccess={() => {
            showToast("Đã tạo khóa đào tạo thành công!");
            void loadData();
          }}
        />
      )}

      {/* Modal chỉnh sửa */}
      {editing && (
        <TrainingFormModal
          initial={editing}
          certGroups={certGroups}
          personnel={personnel}
          onClose={() => setEditing(null)}
          onSubmitSuccess={() => {
            showToast("Đã cập nhật khóa đào tạo!");
            void loadData();
          }}
        />
      )}
    </main>
  );
}
