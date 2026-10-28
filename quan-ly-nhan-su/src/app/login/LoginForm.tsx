"use client";

import { useState } from "react";
import { Envelope, Eye, EyeSlash, LockKey, SignIn, CircleNotch, WarningCircle } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

const field =
  "h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-hidden transition-colors placeholder:text-slate-400 focus:border-[#1e3a7a] focus:ring-4 focus:ring-[#1e3a7a]/15";
const icon = "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const { error: failure } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (failure) { setError("Email hoặc mật khẩu không đúng."); return; }
      // Chỉ quay về đường dẫn nội bộ để tránh chuyển hướng sang website khác.
      const next = new URLSearchParams(window.location.search).get("next") ?? "";
      window.location.assign(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch {
      setError("Không kết nối được hệ thống đăng nhập.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="login-email" className="text-sm font-medium text-slate-800">Email đăng nhập</label>
        <div className="relative mt-2">
          <Envelope size={20} className={icon} aria-hidden />
          <input id="login-email" type="email" required autoComplete="username" placeholder="Nhập email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </div>
      </div>
      <div>
        <label htmlFor="login-password" className="text-sm font-medium text-slate-800">Mật khẩu</label>
        <div className="relative mt-2">
          <LockKey size={20} className={icon} aria-hidden />
          <input id="login-password" type={show ? "text" : "password"} required autoComplete="current-password" placeholder="Nhập mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} pr-12`} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={show}
            className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#1e3a7a] focus-visible:outline-2 focus-visible:outline-[#1e3a7a] cursor-pointer">
            {show ? <EyeSlash size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <WarningCircle size={18} weight="fill" aria-hidden /> {error}
        </p>
      )}
      <button type="submit" disabled={busy || !email || !password}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1e3a7a] text-sm font-bold text-white shadow-md shadow-[#1e3a7a]/25 transition-colors hover:bg-[#162d62] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e3a7a] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
        {busy ? <CircleNotch size={20} className="animate-spin" aria-hidden /> : <SignIn size={20} weight="bold" aria-hidden />}
        {busy ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
