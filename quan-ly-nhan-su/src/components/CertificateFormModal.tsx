"use client";

import { useEffect, useId, useState } from "react";
import type { Certificate, CertificateImageKey } from "@/data/certificates";

export type CertificateFormValues = {
  title: string;
  holder: string;
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
  onClose: () => void;
  onSubmit: (values: CertificateFormValues) => void;
};

export default function CertificateFormModal({ open, onClose, onSubmit }: CertificateFormModalProps) {
  const titleId = useId();
  const [form, setForm] = useState<CertificateFormValues>({
    title: "",
    holder: "",
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
      holder: "",
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
    if (!form.holder.trim()) {
      setError("Nhập người sở hữu.");
      return;
    }
    if (!form.issuedAt || !form.expiresAt) {
      setError("Nhập ngày cấp và ngày hết hạn.");
      return;
    }
    onSubmit(form);
    onClose();
  }

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
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-[#d9e2f1] bg-white shadow-[0_24px_60px_rgba(7,22,51,0.24)] animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e8eef8] px-5 sm:px-6 py-4 bg-white">
          <h2 id={titleId} className="text-[17px] sm:text-[18px] font-bold text-[#0f172a]">
            Thêm chứng chỉ mới
          </h2>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-3.5">
          {error && (
            <div className="rounded-lg bg-[#fef2f2] border border-[#fecaca] px-3.5 py-2.5 text-[12.5px] font-medium text-[#b91c1c]">{error}</div>
          )}

          <label className="block text-[12px] font-semibold text-[#475569]">
            Tên chứng chỉ *
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 block h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
              placeholder="VD: Chứng chỉ thợ hàn ray hạng 1"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#475569]">
            Người sở hữu *
            <input
              value={form.holder}
              onChange={(e) => setForm((f) => ({ ...f, holder: e.target.value }))}
              className="mt-1 block h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
              placeholder="VD: Nguyễn Văn A"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-[12px] font-semibold text-[#475569]">
              Ngày cấp *
              <input
                type="date"
                value={form.issuedAt}
                onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))}
                className="mt-1 block h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
              />
            </label>
            <label className="block text-[12px] font-semibold text-[#475569]">
              Ngày hết hạn *
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="mt-1 block h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
              />
            </label>
          </div>
          <label className="block text-[12px] font-semibold text-[#475569]">
            Trạng thái
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Certificate["status"] }))}
              className="mt-1 block h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
            >
              <option>Còn hiệu lực</option>
              <option>Sắp hết hạn</option>
              <option>Hết hạn</option>
            </select>
          </label>
          <label className="block text-[12px] font-semibold text-[#475569]">
            Mẫu ảnh chứng chỉ
            <select
              value={form.imageKey}
              onChange={(e) =>
                setForm((f) => ({ ...f, imageKey: e.target.value as CertificateImageKey, imageUrl: "" }))
              }
              className="mt-1 block h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
            >
              {imageKeyOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-semibold text-[#475569]">
            Hoặc tải ảnh chứng chỉ
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="mt-1 block w-full text-[12.5px] text-[#64748b] file:mr-3 file:rounded-lg file:border-0 file:bg-[#eff6ff] file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-[#0047AB] file:cursor-pointer hover:file:bg-[#dbeafe] file:transition-colors"
            />
          </label>
          <div className="flex shrink-0 justify-end gap-2.5 border-t border-[#eef1f5] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0f172a] hover:border-[#cbd5e1] active:bg-[#f1f5f9] transition-all duration-150 cursor-pointer shadow-2xs"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white shadow-xs hover:bg-[#00388a] active:bg-[#002d6e] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/25 transition-all duration-150 cursor-pointer"
            >
              Lưu chứng chỉ
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
