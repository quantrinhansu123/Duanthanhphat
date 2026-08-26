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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-[#0f172a]/45" aria-label="Đóng" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-[#e8eef8] px-5 py-4">
          <h2 id={titleId} className="text-[17px] font-bold text-[#0f172a]">
            Thêm chứng chỉ mới
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <label className="block text-[12px] font-semibold text-[#475569]">
            Tên chứng chỉ
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 block h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
              placeholder="VD: Chứng chỉ thợ hàn ray hạng 1"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#475569]">
            Người sở hữu
            <input
              value={form.holder}
              onChange={(e) => setForm((f) => ({ ...f, holder: e.target.value }))}
              className="mt-1 block h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-semibold text-[#475569]">
              Ngày cấp
              <input
                type="date"
                value={form.issuedAt}
                onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))}
                className="mt-1 block h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
              />
            </label>
            <label className="block text-[12px] font-semibold text-[#475569]">
              Ngày hết hạn
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="mt-1 block h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
              />
            </label>
          </div>
          <label className="block text-[12px] font-semibold text-[#475569]">
            Trạng thái
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Certificate["status"] }))}
              className="mt-1 block h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none focus:border-[#0047AB]"
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
              className="mt-1 block h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none focus:border-[#0047AB]"
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
              className="mt-1 block w-full text-[13px] text-[#64748b] file:mr-3 file:rounded-lg file:border-0 file:bg-[#eef4ff] file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-[#0047AB]"
            />
          </label>
          {error && <p className="text-[12px] text-[#dc2626]">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-[#eef1f5] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-[#d9e2f1] px-4 text-[13px] font-medium text-[#64748b] hover:bg-[#f8fafc]"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="h-10 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
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
