import type { Metadata } from "next";
import LoginForm from "./LoginForm";
import LoginHero from "./LoginHero";
import BrandLockup from "@/components/BrandLockup";

export const metadata: Metadata = { title: "Đăng nhập · Quản lý hàn ray · Công ty cổ phần công trình Thành Phát" };

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
        <div className="mx-auto w-full max-w-sm rounded-2xl bg-white/95 p-5 shadow-xl ring-1 ring-slate-200/80 backdrop-blur-sm sm:max-w-md sm:p-7 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0 lg:backdrop-blur-none">
          <div className="mb-6 flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="TCW" className="h-12 w-12 shrink-0 rounded-full object-contain shadow-md ring-1 ring-slate-200 sm:h-14 sm:w-14" />
            <BrandLockup size="md" className="min-w-0 max-w-[15rem] text-left sm:max-w-[18rem]" />
          </div>
          <h2 className="text-center text-2xl font-bold text-[#1e3a7a] sm:text-[1.65rem]">Đăng nhập</h2>
          <LoginForm />
          <p className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">© 2026 Công ty cổ phần công trình Thành Phát · CONSTRUCTION WORK JOINT STOCK COMPANY</p>
        </div>
      </section>
    </main>
  );
}
