"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Hiện khi API nghiệm thu trả 401. Đăng nhập Supabase Auth; quyền ghi do bảng nguoi_dung_nghiem_thu quyết định ở server. */
export default function QualityLoginDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("weld-quality-login-required", show);
    return () => window.removeEventListener("weld-quality-login-required", show);
  }, []);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    const { error: failure } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (failure) { setError("Email hoặc mật khẩu không đúng."); return; }
    setPassword(""); setOpen(false);
    window.dispatchEvent(new Event("weld-quality-changed")); // làm mới Dashboard/danh sách sau khi đăng nhập
  }

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Đăng nhập">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-bold text-slate-900">Đăng nhập để ghi nhận chất lượng</h2>
        <input type="email" required autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        <input type="password" required autoComplete="current-password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-300 px-4 text-sm font-semibold cursor-pointer">Để sau</button>
          <button type="submit" disabled={busy} className="h-9 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer">Đăng nhập</button>
        </div>
      </form>
    </div>
  );
}
