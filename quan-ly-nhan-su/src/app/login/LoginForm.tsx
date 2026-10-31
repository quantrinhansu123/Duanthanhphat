"use client";

import { useEffect, useState } from "react";
import { Envelope, Eye, EyeSlash, LockKey, SignIn, CircleNotch, WarningCircle } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

const field =
  "h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-hidden transition-colors placeholder:text-slate-400 focus:border-[#1e3a7a] focus:ring-4 focus:ring-[#1e3a7a]/15";
const REMEMBER_KEY = "tp-remember-email";
const icon = "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400";

/** Xóa phiên Supabase hỏng (refresh_token 400) trước khi đăng nhập lại. */
function clearStaleAuthSession() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sb-") && key.includes("auth")) localStorage.removeItem(key);
    }
  } catch { /* localStorage bị chặn */ }
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("sb-") && key.includes("auth")) sessionStorage.removeItem(key);
    }
  } catch { /* sessionStorage bị chặn */ }
  try {
    const cookies = document.cookie.split(";");
    for (const part of cookies) {
      const name = part.split("=")[0]?.trim();
      if (name && name.startsWith("sb-")) {
        document.cookie = `${name}=; Max-Age=0; path=/`;
      }
    }
  } catch { /* cookie bị chặn */ }
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(false);

  // Điền sẵn email đã ghi nhớ; mật khẩu do trình duyệt tự điền (không lưu mật khẩu trong app).
  useEffect(() => {
    clearStaleAuthSession();
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) { setEmail(saved); setRemember(true); }
    } catch { /* localStorage bị chặn */ }
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
        setError("Chưa cấu hình Supabase trên máy này. Kiểm tra .env.local rồi khởi động lại npm run dev.");
        return;
      }
      // Phiên cũ / refresh_token hết hạn gây POST .../token?grant_type=refresh_token 400.
      clearStaleAuthSession();
      const supabase = createClient();
      try { await supabase.auth.signOut({ scope: "local" }); } catch { /* bỏ phiên local nếu còn */ }
      const { error: failure } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (failure) {
        const detail = failure.message?.trim();
        setError(
          /invalid login|invalid credentials|email|password/i.test(detail || "")
            ? "Email hoặc mật khẩu không đúng."
            : `Không đăng nhập được: ${detail || failure.name || "lỗi không rõ"}`,
        );
        return;
      }
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch { /* không ghi nhớ được thì vẫn đăng nhập bình thường */ }
      // Chỉ quay về đường dẫn nội bộ để tránh chuyển hướng sang website khác.
      const next = new URLSearchParams(window.location.search).get("next") ?? "";
      window.location.assign(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "";
      setError(
        detail.includes("NEXT_PUBLIC_SUPABASE")
          ? "Chưa cấu hình Supabase trên máy này. Kiểm tra .env.local rồi khởi động lại npm run dev."
          : detail
            ? `Không kết nối được hệ thống đăng nhập: ${detail}`
            : "Không kết nối được hệ thống đăng nhập. Kiểm tra mạng hoặc khởi động lại server.",
      );
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
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 cursor-pointer rounded accent-[#1e3a7a]" />
        Ghi nhớ mật khẩu
      </label>
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
