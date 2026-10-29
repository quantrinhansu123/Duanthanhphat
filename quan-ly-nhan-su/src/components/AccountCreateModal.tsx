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

export default function AccountCreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (account: InitialAccount) => void;
}) {
  const [form, setForm] = useState<InitialAccount>({
    id: "",
    username: "",
    fullName: "",
    email: "",
    role: "Bộ phận khác",
    status: "Hoạt động",
    createdAt: new Date().toISOString().slice(0, 10),
    note: "",
  });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.username.trim() || !form.fullName.trim() || !form.email.trim()) {
      setError("Nhập tên đăng nhập, họ tên và email.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu tối thiểu 6 ký tự.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/system-configuration/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password }),
      });
      const payload = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
      onCreate({ ...form, id: payload.id ?? String(Date.now()) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được tài khoản");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl">
        <h3 className="text-base sm:text-lg font-bold text-slate-900">Thêm tài khoản</h3>
        <div className="mt-4 space-y-3.5">
          <label className={labelCls}>
            Tên đăng nhập
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={`${inputCls} font-mono`} />
          </label>
          <label className={labelCls}>
            Họ tên
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputCls} />
          </label>
          <label className={labelCls}>
            Email (dùng để đăng nhập)
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
          </label>
          <PasswordField label="Mật khẩu" value={password} onChange={setPassword} />
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
          <button type="button" disabled={busy} onClick={() => void submit()} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] disabled:opacity-60 px-4 text-xs sm:text-sm font-semibold text-white shadow-xs cursor-pointer">
            {busy ? "Đang tạo…" : "Thêm tài khoản"}
          </button>
        </div>
      </div>
    </div>
  );
}
