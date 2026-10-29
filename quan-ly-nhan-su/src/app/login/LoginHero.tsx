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
    <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#1b3570] via-[#1e3a7a] to-[#142a5c] px-14 py-12 text-white lg:flex lg:flex-col lg:justify-center lg:gap-10">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/5" />
      <div className="relative">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
          Quản lý hàn ray<br /><span className="text-[#9cc0ff]">chính xác &amp; liên tục</span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-blue-100/85 xl:text-lg">Từ mối hàn ngoài hiện trường đến hồ sơ nghiệm thu — tất cả trong một nền tảng duy nhất.</p>
      </div>
      <ul className="relative space-y-4">
        {FEATURES.map(({ Icon, title, text }) => (
          <li key={title} className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Icon size={22} weight="duotone" aria-hidden />
            </span>
            <div>
              <div className="font-semibold">{title}</div>
              <div className="text-sm text-blue-100/75">{text}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
