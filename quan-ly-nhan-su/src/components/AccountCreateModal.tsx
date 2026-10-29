"use client";

import { useState } from "react";
import { Eye, EyeSlash } from "@/components/icons";
import { permissionRoles, type InitialAccount } from "@/data/systemConfig";

export const roleOptions = (current: string): string[] =>
  (permissionRoles as readonly string[]).includes(current) ? [...permissionRoles] : [...permissionRoles, current];

const inputCls =
  "mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20";
const labelCls = "block text-xs sm:text-[13px] font-semibold text-slate-700";

export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className={labelCls}>
      {label}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
        >
          {show ? <EyeSlash size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
    </label>
  );
}

/** "Phạm Văn Minh" + "1990" → "minh1990" (tên cuối, bỏ dấu). */
function accountHandle(fullName: string, birthDate: string): string {
  const last = fullName.trim().split(/\s+/).pop() ?? "";
  const ascii = last.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ascii + birthDate.slice(0, 4);
}

export const accountEmail = (a: { fullName: string; birthDate?: string }) =>
  `${accountHandle(a.fullName, a.birthDate ?? "")}@thanhphat.vn`;

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
export function generatePassword(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

export function CredentialsModal({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const text = `Tài khoản: ${email}\nMật khẩu: ${password}`;
  const btn = "inline-flex h-10 items-center justify-center rounded-lg px-4 text-xs sm:text-sm font-semibold cursor-pointer";
  const ghost = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${email.split("@")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" />
      <div className="relative z-10 w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl">
        <h3 className="text-base sm:text-lg font-bold text-slate-900">Tài khoản nhân sự vừa tạo</h3>
        <p className="mt-3 text-xs sm:text-sm text-slate-600">Lưu thông tin để bàn giao cho nhân viên. Mật khẩu chỉ hiển thị ở lần cấp này.</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={labelCls}>Tài khoản<input readOnly value={email} className={`${inputCls} font-mono`} /></label>
          <label className={labelCls}>Mật khẩu đã sinh<input readOnly value={password} className={`${inputCls} font-mono`} /></label>
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className={ghost}>Đóng</button>
          <button type="button" onClick={download} className={ghost}>Tải thông tin</button>
          <button type="button" onClick={() => void navigator.clipboard.writeText(text)} className={`${btn} bg-[#0047AB] hover:bg-[#00388A] text-white`}>Sao chép</button>
        </div>
      </div>
    </div>
  );
}

export default function AccountCreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (account: InitialAccount) => void;
}) {
  const [form, setForm] = useState<InitialAccount>({
    id: "",
    fullName: "",
    email: "",
    birthDate: "",
    role: "Bộ phận khác",
    status: "Hoạt động",
    createdAt: new Date().toISOString().slice(0, 10),
    note: "",
  });
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const year = Number(form.birthDate?.slice(0, 4));
    if (!form.fullName.trim() || !(year >= 1900 && year <= new Date().getFullYear())) {
      setError("Nhập họ tên và ngày sinh hợp lệ.");
      return;
    }
    onCreate({ ...form, id: String(Date.now()) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl">
        <h3 className="text-base sm:text-lg font-bold text-slate-900">Thêm tài khoản</h3>
        <div className="mt-4 space-y-3.5">
          <label className={labelCls}>
            Họ tên
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputCls} />
          </label>
          <label className={labelCls}>
            Ngày sinh
            <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              Vai trò
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>
                {roleOptions(form.role).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
              </select>
            </label>
            <label className={labelCls}>
              Trạng thái
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InitialAccount["status"] })} className={inputCls}>
                <option>Hoạt động</option>
                <option>Khóa</option>
              </select>
            </label>
          </div>
          <label className={labelCls}>
            Ghi chú
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className={`${inputCls} h-auto py-2`} />
          </label>
        </div>
        {error && <p role="alert" className="mt-3 text-xs font-semibold text-rose-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs">
            Hủy
          </button>
          <button type="button" onClick={submit} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs cursor-pointer">
            Thêm tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}
