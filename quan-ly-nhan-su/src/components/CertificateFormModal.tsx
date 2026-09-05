"use client";

import { useEffect, useId, useState } from "react";
import type { Certificate, CertificateImageKey } from "@/data/certificates";
import WelderMultiSelect from "@/components/WelderMultiSelect";
import DateField from "@/components/DateField";
import { X } from "@/components/icons";
import type { CertificatePersonnelOption } from "@/lib/certificatesDb";

export type CertificateFormValues = {
  title: string;
  holderIds: string[];
  issuedAt: string;
  expiresAt: string;
  status: Certificate["status"];
  imageKey: CertificateImageKey;
  imageUrl: string;
};

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
  personnel: CertificatePersonnelOption[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: CertificateFormValues) => void;
};

export default function CertificateFormModal({
  open,
  personnel,
  saving,
  onClose,
  onSubmit,
}: CertificateFormModalProps) {
  const titleId = useId();
  const [form, setForm] = useState<CertificateFormValues>({
    title: "",
    holderIds: [],
    issuedAt: "",
    expiresAt: "",
    status: "Còn hiệu lực",
    imageKey: "default",
    imageUrl: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      title: "",
      holderIds: [],
      issuedAt: "",
      expiresAt: "",
      status: "Còn hiệu lực",
      imageKey: "default",
      imageUrl: "",
    });
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn file ảnh (JPG, PNG, SVG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, imageUrl: String(reader.result) }));
      setError("");
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Nhập tên chứng chỉ.");
      return;
    }
    if (form.holderIds.length === 0) {
      setError("Chọn ít nhất một người sở hữu.");
      return;
    }
    if (!form.issuedAt || !form.expiresAt) {
      setError("Nhập ngày cấp và ngày hết hạn.");
      return;
    }
    onSubmit(form);
  }

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
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <h2 id={titleId} className="text-base sm:text-lg font-bold text-slate-900">
            Thêm chứng chỉ mới
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-3.5">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-rose-700 shadow-2xs">{error}</div>
          )}

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Tên chứng chỉ *
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1.5 block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
              placeholder="VD: Chứng chỉ thợ hàn ray hạng 1"
            />
          </label>
          <div className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Người sở hữu *
            <WelderMultiSelect
              selectedIds={form.holderIds}
              onChange={(holderIds) => setForm((current) => ({ ...current, holderIds }))}
              options={personnel.map((person) => ({
                id: person.id,
                name: person.name,
                weldingId: person.code,
                weldingTeam: person.team,
              }))}
              placeholder="Chọn người sở hữu..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Ngày cấp *
              <DateField
                value={form.issuedAt}
                onChange={(v) => setForm((f) => ({ ...f, issuedAt: v }))}
                className="mt-1.5"
              />
            </div>
            <div className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Ngày hết hạn *
              <DateField
                value={form.expiresAt}
                onChange={(v) => setForm((f) => ({ ...f, expiresAt: v }))}
                className="mt-1.5"
              />
            </div>
          </div>
          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Trạng thái
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Certificate["status"] }))}
              className="mt-1.5 block h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
            >
              <option>Còn hiệu lực</option>
              <option>Sắp hết hạn</option>
              <option>Hết hạn</option>
            </select>
          </label>
          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Mẫu ảnh chứng chỉ
            <select
              value={form.imageKey}
              onChange={(e) =>
                setForm((f) => ({ ...f, imageKey: e.target.value as CertificateImageKey, imageUrl: "" }))
              }
              className="mt-1.5 block h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
            >
              {imageKeyOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Hoặc tải ảnh chứng chỉ
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="mt-1.5 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#0047AB] file:cursor-pointer hover:file:bg-blue-100 file:transition-colors shadow-2xs"
            />
          </label>
          <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || personnel.length === 0}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
            >
              {saving ? "Đang lưu…" : "Lưu chứng chỉ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatViDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("vi-VN");
}

export { formatViDate };
