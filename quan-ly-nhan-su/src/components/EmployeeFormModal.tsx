"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import type { Employee } from "@/data/employees";

export type EmployeeFormValues = {
  code: string;
  name: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  department: string;
  position: string;
  role: string;
  status: "Hoạt động" | "Khóa";
  photo: string;
};

type EmployeeFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: EmployeeFormValues) => void;
  departments: string[];
  positions: string[];
  roles: string[];
  initial?: Partial<EmployeeFormValues>;
  title?: string;
};

const empty: EmployeeFormValues = {
  code: "",
  name: "",
  email: "",
  username: "",
  password: "",
  confirmPassword: "",
  department: "",
  position: "",
  role: "Nhân viên",
  status: "Hoạt động",
  photo: "",
};

export default function EmployeeFormModal({
  open,
  onClose,
  onSubmit,
  departments,
  positions,
  roles,
  initial,
  title = "Thêm nhân sự mới",
}: EmployeeFormModalProps) {
  const titleId = useId();
  const deptListId = useId();
  const posListId = useId();
  const roleListId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<EmployeeFormValues>(empty);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = { ...empty, ...initial };
    setForm(next);
    setPreview(next.photo || "");
    setError("");
    setShowPassword(false);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function update<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFile(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn file ảnh.");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    update("photo", url);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.email.trim() || !form.username.trim()) {
      setError("Vui lòng nhập đủ Mã NV, họ tên, email và tên đăng nhập.");
      return;
    }
    if (!form.password.trim()) {
      setError("Vui lòng nhập mật khẩu.");
      return;
    }
    if (form.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (!form.department.trim() || !form.position.trim() || !form.role.trim()) {
      setError("Vui lòng nhập phòng ban, chức vụ và vai trò.");
      return;
    }
    onSubmit({
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
      email: form.email.trim(),
      username: form.username.trim(),
      password: form.password,
      confirmPassword: form.confirmPassword,
      department: form.department.trim(),
      position: form.position.trim(),
      role: form.role.trim(),
      photo:
        form.photo ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name.trim())}&background=0047AB&color=fff&size=128`,
    });
  }

  function suggestionOptions(items: string[]) {
    return Array.from(
      new Set(
        items
          .map((x) => x.trim())
          .filter((x) => x && !x.toLowerCase().startsWith("tất cả")),
      ),
    ).sort((a, b) => a.localeCompare(b, "vi"));
  }

  const deptOptions = suggestionOptions(departments);
  const posOptions = suggestionOptions(positions);
  const roleOptions = suggestionOptions(
    roles.length ? roles : ["Nhân viên", "Quản trị"],
  );

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
        className="relative z-10 w-full max-w-[640px] max-h-[90dvh] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div>
            <h2 id={titleId} className="text-base sm:text-lg font-bold text-slate-900">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Nhập thông tin tài khoản và hồ sơ nhân sự</p>
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          <div className="mb-5 flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full bg-blue-50 ring-2 ring-slate-200 shadow-2xs">
              {preview ? (
                <Image src={preview} alt="Ảnh nhân sự" fill className="object-cover" sizes="64px" unoptimized={preview.startsWith("blob:")} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">Ảnh</div>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-semibold text-[#0047AB] hover:bg-blue-50 hover:border-blue-300 active:bg-blue-100 transition-all duration-150 cursor-pointer shadow-2xs"
              >
                Chọn ảnh
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <p className="mt-1 text-xs text-slate-400">JPG, PNG · khuyến nghị ảnh vuông</p>
            </div>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Mã NV *
              <input
                value={form.code}
                onChange={(e) => update("code", e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
                placeholder="NV007"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Tên đăng nhập *
              <input
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
                placeholder="username"
                autoComplete="username"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Mật khẩu *
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 pr-16 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-[#0047AB] hover:bg-blue-50 transition-colors duration-150 cursor-pointer"
                >
                  {showPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Xác nhận mật khẩu *
              <input
                type={showPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
                placeholder="Nhập lại mật khẩu"
                autoComplete="new-password"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700 sm:col-span-2">
              Họ và tên *
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
                placeholder="Nguyễn Văn A"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700 sm:col-span-2">
              Email *
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
                placeholder="email@thanhphat.vn"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Phòng ban *
              <input
                list={deptListId}
                value={form.department}
                onChange={(e) => update("department", e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
                placeholder="Gõ mới hoặc chọn gợi ý"
              />
              <datalist id={deptListId}>
                {deptOptions.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Chức vụ *
              <input
                list={posListId}
                value={form.position}
                onChange={(e) => update("position", e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
                placeholder="Gõ mới hoặc chọn gợi ý"
              />
              <datalist id={posListId}>
                {posOptions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Vai trò *
              <input
                list={roleListId}
                value={form.role}
                onChange={(e) => update("role", e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
                placeholder="Gõ mới hoặc chọn gợi ý"
              />
              <datalist id={roleListId}>
                {roleOptions.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Trạng thái
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value as Employee["status"])}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
              >
                <option value="Hoạt động">Hoạt động</option>
                <option value="Khóa">Khóa</option>
              </select>
            </label>
          </div>

          {error && <p className="mt-4 rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-rose-700 shadow-2xs">{error}</p>}

          <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
            >
              Lưu nhân sự
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
