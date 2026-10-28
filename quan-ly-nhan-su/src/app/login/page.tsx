import type { Metadata } from "next";
import LoginForm from "./LoginForm";
import LoginHero from "./LoginHero";

export const metadata: Metadata = { title: "Đăng nhập · Quản lý hàn ray Thành Phát" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-white text-slate-900 lg:grid-cols-[1.1fr_1fr]">
      <LoginHero />
      <section className="flex flex-col justify-center px-6 py-12 sm:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Logo chỉ hiện trên mobile (cột trái bị ẩn) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="TCW" className="mb-6 h-14 w-14 rounded-full lg:hidden" />
          <h2 className="text-2xl font-bold text-[#1e3a7a]">Đăng nhập</h2>
          <p className="mt-1 text-sm text-slate-600">Chào mừng bạn quay trở lại hệ thống Quản lý hàn ray</p>
          <LoginForm />
          <p className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">© 2026 Thành Phát</p>
        </div>
      </section>
    </main>
  );
}
