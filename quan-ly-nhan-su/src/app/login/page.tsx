import type { Metadata } from "next";
import LoginForm from "./LoginForm";
import LoginHero from "./LoginHero";

export const metadata: Metadata = { title: "Đăng nhập · Quản lý hàn ray Thành Phát" };

export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh text-slate-900 lg:grid-cols-[1.1fr_1fr]">
      {/* Mobile / nhỏ: ảnh nền ngoài full trang phía sau form */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center lg:hidden"
        style={{ backgroundImage: "url(/bg-tcw.jpg)" }}
      />
      <div aria-hidden className="absolute inset-0 bg-[#071633]/55 lg:hidden" />

      <LoginHero />
      <section className="relative z-10 flex flex-col justify-center px-6 py-12 sm:px-16 lg:bg-white">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-white/95 p-6 shadow-xl ring-1 ring-slate-200/80 backdrop-blur-sm sm:p-8 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0 lg:backdrop-blur-none">
          <div className="mb-8 flex items-center justify-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="TCW" className="h-24 w-24 shrink-0 rounded-full object-contain shadow-md ring-1 ring-slate-200 sm:h-28 sm:w-28" />
            <div className="text-left">
              <div className="text-3xl font-extrabold leading-none text-[#1e3a7a]">Thành Phát</div>
              <div className="pl-[2px] text-lg font-medium leading-tight text-slate-600">Quản lý hàn ray</div>
            </div>
          </div>
          <h2 className="text-center text-3xl font-bold text-[#1e3a7a]">Đăng nhập</h2>
          <p className="mt-2 text-center text-base text-slate-600">Chào mừng bạn quay trở lại hệ thống Quản lý hàn ray</p>
          <LoginForm />
          <p className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">© 2026 Thành Phát</p>
        </div>
      </section>
    </main>
  );
}
