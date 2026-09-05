"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import type { Certificate, CertificateImageKey } from "@/data/certificates";
import WelderMultiSelect from "@/components/WelderMultiSelect";
import DateField from "@/components/DateField";
import { UploadSimple, X } from "@/components/icons";
import type { CertificatePersonnelOption } from "@/lib/certificatesDb";
import { deleteCloudinaryAsset, uploadToCloudinary } from "@/lib/cloudinaryClient";

export type CertificateFormValues = {
  id?: string;
  title: string;
  holderIds: string[];
  issuedAt: string;
  expiresAt: string;
  status: Certificate["status"];
  imageKey: CertificateImageKey;
  imageUrl: string;
  cloudinaryPublicId?: string;
  organization?: string;
  machine?: string;
  certificateNumber?: string;
  notes?: string;
  fileSize?: number;
  sourceUrl?: string;
  license?: string;
};

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const imageKeyOptions: { value: CertificateImageKey; label: string }[] = [
  { value: "welding-1", label: "Thợ hàn hạng 1 (UIC60)" },
  { value: "welding-2", label: "Thợ hàn hạng 2 (P50/P43)" },
  { value: "machine", label: "Vận hành máy hàn" },
  { value: "ndt", label: "NDT – Siêu âm" },
  { value: "safety", label: "An toàn lao động" },
  { value: "iso", label: "ISO 9606" },
  { value: "default", label: "Mẫu chung" },
];

type CertificateFormModalProps = {
  open: boolean;
  initial?: Certificate | null;
  initialHolderIds?: string[];
  personnel: CertificatePersonnelOption[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: CertificateFormValues) => void;
};

function viToISO(value?: string) {
  if (!value || value === "—") return "";
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return value;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export default function CertificateFormModal({
  open,
  initial,
  initialHolderIds,
  personnel,
  saving,
  onClose,
  onSubmit,
}: CertificateFormModalProps) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImg, setUploadingImg] = useState(false);

  const [form, setForm] = useState<CertificateFormValues>({
    title: "",
    holderIds: [],
    issuedAt: "",
    expiresAt: "",
    status: "Còn hiệu lực",
    imageKey: "default",
    imageUrl: "",
    cloudinaryPublicId: "",
    organization: "",
    machine: "",
    certificateNumber: "",
    notes: "",
    sourceUrl: "",
    license: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        id: initial.id.startsWith("personnel:") ? undefined : initial.id,
        title: initial.title,
        holderIds:
          initialHolderIds && initialHolderIds.length > 0
            ? initialHolderIds
            : initial.employeeId
              ? [initial.employeeId]
              : [],
        issuedAt: viToISO(initial.issuedAt),
        expiresAt: viToISO(initial.expiresAt),
        status: initial.status === "Chưa cập nhật" ? "Còn hiệu lực" : initial.status,
        imageKey: initial.imageKey,
        imageUrl: initial.imageUrl || "",
        cloudinaryPublicId: initial.cloudinaryPublicId || "",
        organization: initial.organization || "",
        machine: initial.machine || "",
        certificateNumber: initial.certificateNumber || "",
        notes: initial.notes || "",
        fileSize: initial.fileSize || undefined,
        sourceUrl: initial.sourceUrl || "",
        license: initial.license || "",
      });
    } else {
      setForm({
        title: "",
        holderIds: [],
        issuedAt: "",
        expiresAt: "",
        status: "Còn hiệu lực",
        imageKey: "default",
        imageUrl: "",
        cloudinaryPublicId: "",
        organization: "",
        machine: "",
        certificateNumber: "",
        notes: "",
        sourceUrl: "",
        license: "",
      });
    }
    setError("");
  }, [open, initial, initialHolderIds]);

  const handleClose = useCallback(async () => {
    if (saving || uploadingImg) return;
    const uploadedPublicId = form.cloudinaryPublicId?.trim();
    if (uploadedPublicId && uploadedPublicId !== initial?.cloudinaryPublicId) {
      await deleteCloudinaryAsset(uploadedPublicId);
    }
    onClose();
  }, [form.cloudinaryPublicId, initial?.cloudinaryPublicId, onClose, saving, uploadingImg]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving && !uploadingImg) void handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose, open, saving, uploadingImg]);

  if (!open) return null;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn file ảnh (JPG, PNG, WebP).");
      return;
    }

    setUploadingImg(true);
    setError("");

    // Upload có chữ ký lên Cloudinary
    const res = await uploadToCloudinary(file, "thanhphat/certificates");
    setUploadingImg(false);

    if (res.result) {
      const previousUploadedPublicId = form.cloudinaryPublicId?.trim();
      if (previousUploadedPublicId && previousUploadedPublicId !== initial?.cloudinaryPublicId) {
        await deleteCloudinaryAsset(previousUploadedPublicId);
      }
      setForm((f) => ({
        ...f,
        imageUrl: res.result?.secure_url || "",
        cloudinaryPublicId: res.result?.public_id || "",
        fileSize: res.result?.bytes || file.size,
      }));
    } else {
      setError(res.error || "Không tải được ảnh lên Cloudinary. Ảnh cũ được giữ nguyên.");
    }
  }

  async function removeImage() {
    const uploadedPublicId = form.cloudinaryPublicId?.trim();
    if (uploadedPublicId && uploadedPublicId !== initial?.cloudinaryPublicId) {
      await deleteCloudinaryAsset(uploadedPublicId);
    }
    setForm((current) => ({ ...current, imageUrl: "", cloudinaryPublicId: "", fileSize: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const title = form.title.trim();
    if (!title) {
      setError("Vui lòng nhập tên chứng chỉ.");
      return;
    }
    if (form.holderIds.length === 0) {
      setError("Chọn ít nhất một nhân sự sở hữu chứng chỉ.");
      return;
    }

    if (form.issuedAt && form.expiresAt && form.expiresAt < form.issuedAt) {
      setError("Ngày hết hạn phải từ ngày cấp trở đi.");
      return;
    }

    onSubmit({
      ...form,
      title,
    });
  }

  const isEdit = Boolean(initial && !initial.id.startsWith("personnel:"));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="presentation"
    >
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
        aria-label="Đóng"
        onClick={() => void handleClose()}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
              Hồ sơ năng lực
            </div>
            <h2 id={titleId} className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">
              {isEdit ? "Chỉnh sửa chứng chỉ" : "Thêm chứng chỉ cho nhân sự"}
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs sm:text-sm text-rose-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Tên chứng chỉ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="VD: Chứng chỉ hàn nhôm nhiệt đường ray EN ISO 9606-1"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Người sở hữu ({form.holderIds.length} người) <span className="text-rose-500">*</span>
              </label>
              <div className="mt-1">
                <WelderMultiSelect
                  selectedIds={form.holderIds}
                  onChange={(holderIds) => setForm((f) => ({ ...f, holderIds }))}
                  options={personnel.map((person) => ({
                    id: person.id,
                    name: person.name,
                    weldingId: person.code,
                    weldingTeam: person.team,
                  }))}
                  placeholder="Chọn nhân sự..."
                  searchPlaceholder="Tìm nhân sự theo tên hoặc mã..."
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Có thể thêm hoặc bớt nhân sự sở hữu chứng chỉ bất kỳ lúc nào.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Ngày cấp
                </label>
                <div className="mt-1">
                  <DateField
                    value={form.issuedAt}
                    onChange={(issuedAt) => setForm((f) => ({ ...f, issuedAt }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Ngày hết hạn
                </label>
                <div className="mt-1">
                  <DateField
                    value={form.expiresAt}
                    onChange={(expiresAt) => setForm((f) => ({ ...f, expiresAt }))}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Trạng thái
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as Certificate["status"],
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                >
                  <option value="Còn hiệu lực">Còn hiệu lực</option>
                  <option value="Sắp hết hạn">Sắp hết hạn</option>
                  <option value="Hết hạn">Hết hạn</option>
                  <option value="Thu hồi">Thu hồi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Biểu mẫu hiển thị
                </label>
                <select
                  value={form.imageKey}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      imageKey: e.target.value as CertificateImageKey,
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                >
                  {imageKeyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Đơn vị cấp
                </label>
                <input
                  type="text"
                  value={form.organization || ""}
                  onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                  placeholder="VD: Trung tâm đào tạo đường sắt"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Số chứng chỉ
                </label>
                <input
                  type="text"
                  value={form.certificateNumber || ""}
                  onChange={(e) => setForm((f) => ({ ...f, certificateNumber: e.target.value }))}
                  placeholder="VD: CC-2026-001"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Máy / phạm vi áp dụng
              </label>
              <input
                type="text"
                value={form.machine || ""}
                onChange={(e) => setForm((f) => ({ ...f, machine: e.target.value }))}
                placeholder="VD: KCM-007, UN5-150ZC2-C6"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Ghi chú
              </label>
              <textarea
                rows={2}
                value={form.notes || ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              />
            </div>

            {/* Upload ảnh chứng chỉ lên Cloudinary */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Ảnh chứng chỉ (tải trực tiếp lên Cloudinary)
              </label>
              <div className="mt-2 flex items-center gap-4">
                {form.imageUrl ? (
                  <div className="relative h-20 w-32 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <Image src={form.imageUrl} alt="Chứng chỉ" fill className="object-cover" />
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImg}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <UploadSimple size={14} weight="bold" />
                    {uploadingImg ? "Đang tải ảnh lên Cloudinary..." : form.imageUrl ? "Thay đổi ảnh" : "Tải ảnh chứng chỉ lên"}
                  </button>
                  {form.imageUrl && (
                    <button
                      type="button"
                      onClick={() => void removeImage()}
                      className="text-left text-xs text-rose-600 hover:underline cursor-pointer"
                    >
                      Gỡ ảnh
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Kích thước, Nguồn ảnh và Bản quyền */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700">
                <span>Thông tin & Bản quyền ảnh</span>
                {form.fileSize && (
                  <span className="font-mono text-[#0047AB] normal-case">
                    Dung lượng: {formatFileSize(form.fileSize)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Nguồn / Link ảnh gốc
                  </label>
                  <input
                    type="url"
                    value={form.sourceUrl || ""}
                    onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                    placeholder="VD: https://images.unsplash.com/... hoặc URL nguồn"
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Giấy phép / Bản quyền
                  </label>
                  <input
                    type="text"
                    value={form.license || ""}
                    onChange={(e) => setForm((f) => ({ ...f, license: e.target.value }))}
                    placeholder="VD: CC BY-SA 4.0, Thanh Phát JSC, v.v."
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-slate-50/80">
            <button
              type="button"
              onClick={() => void handleClose()}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || uploadingImg}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] px-5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-[#00388A] cursor-pointer disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Lưu chứng chỉ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
