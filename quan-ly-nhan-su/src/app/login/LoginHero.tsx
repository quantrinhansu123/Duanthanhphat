"use client";

import { CalendarCheck, ChartLineUp, FileText, SealCheck, ShieldCheck } from "@/components/icons";

const FEATURES = [
  { Icon: FileText, title: "Nhật ký hàn", text: "Mối hàn, thợ hàn, máy hàn và kết quả thí nghiệm theo từng dự án" },
  { Icon: ShieldCheck, title: "Kiểm tra chất lượng", text: "Số đo sau mài, trực quan, NDT và xét dung sai tự động" },
  { Icon: SealCheck, title: "RFI & Nghiệm thu", text: "Phát phiếu yêu cầu, nghiệm thu từng phần, lưu và in hồ sơ" },
  { Icon: CalendarCheck, title: "Báo cáo ngày", text: "Nhật ký thi công tự điền từ dữ liệu hàn, nhân lực và thiết bị" },
  { Icon: ChartLineUp, title: "Dashboard", text: "Tiến độ, nghiệm thu đạt, chờ mài, chờ thí nghiệm, mối hàn lại" },
];

export default function LoginHero() {
  return (
    <section className="relative hidden overflow-hidden px-14 py-12 text-white lg:flex lg:flex-col lg:justify-end lg:gap-8">
      {/* Ảnh nền ngoài — hiện trường hàn ray TCW */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/bg-tcw.jpg)" }}
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#071633]/90 via-[#071633]/45 to-[#071633]/25" />

      <div className="relative">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight drop-shadow-sm xl:text-5xl">
          Quản lý hàn ray<br />
          <span className="text-[#9cc0ff]">chính xác &amp; liên tục</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-blue-50/90 xl:text-lg">
          Từ mối hàn ngoài hiện trường đến hồ sơ nghiệm thu — tất cả trong một nền tảng duy nhất.
        </p>
      </div>
      <ul className="relative space-y-3">
        {FEATURES.map(({ Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3 rounded-xl bg-[#071633]/35 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-[2px]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Icon size={20} weight="duotone" aria-hidden />
            </span>
            <div>
              <div className="font-semibold">{title}</div>
              <div className="text-sm text-blue-100/80">{text}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
