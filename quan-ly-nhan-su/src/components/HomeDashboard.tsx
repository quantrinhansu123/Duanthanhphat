"use client";

import Image from "next/image";
import type { Icon } from "@phosphor-icons/react";
import { navigation } from "@/data/navigation";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  Users,
  GraduationCap,
  Wrench,
  Buildings,
  Path,
  ChartBar,
  ClockCounterClockwise,
  GearSix,
  Lightning,
  ArrowRight,
  ShieldCheck,
} from "@/components/icons";

const groupIcons: Record<string, Icon> = {
  "nhan-su": Users,
  "dao-tao": GraduationCap,
  "may-moc": Wrench,
  "moi-han": Lightning,
  "du-an": Buildings,
  "ky-thuat": Path,
  "bao-cao": ChartBar,
  "du-lieu-lich-su": ClockCounterClockwise,
  "quan-tri": GearSix,
};

const groupColorClasses: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  "nhan-su": { bg: "bg-blue-50/80", text: "text-[#0047AB]", border: "border-blue-200", badge: "bg-blue-100/70 text-[#0047AB]" },
  "dao-tao": { bg: "bg-indigo-50/80", text: "text-indigo-700", border: "border-indigo-200", badge: "bg-indigo-100/70 text-indigo-700" },
  "may-moc": { bg: "bg-amber-50/80", text: "text-amber-700", border: "border-amber-200", badge: "bg-amber-100/70 text-amber-700" },
  "moi-han": { bg: "bg-orange-50/80", text: "text-orange-700", border: "border-orange-200", badge: "bg-orange-100/70 text-orange-700" },
  "du-an": { bg: "bg-teal-50/80", text: "text-teal-700", border: "border-teal-200", badge: "bg-teal-100/70 text-teal-700" },
  "ky-thuat": { bg: "bg-cyan-50/80", text: "text-cyan-700", border: "border-cyan-200", badge: "bg-cyan-100/70 text-cyan-700" },
  "bao-cao": { bg: "bg-emerald-50/80", text: "text-emerald-700", border: "border-emerald-200", badge: "bg-emerald-100/70 text-emerald-700" },
  "du-lieu-lich-su": { bg: "bg-purple-50/80", text: "text-purple-700", border: "border-purple-200", badge: "bg-purple-100/70 text-purple-700" },
  "quan-tri": { bg: "bg-slate-100/80", text: "text-slate-700", border: "border-slate-200", badge: "bg-slate-200/70 text-slate-700" },
};

type HomeDashboardProps = {
  onNavigate: (tabId: string) => void;
};

export default function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  const { lang } = useLanguage();

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pb-12 pt-2 animate-in fade-in duration-200">
      {/* Hero Header Section */}
      <div className="relative mb-8 sm:mb-10 overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white via-[#f0f5ff]/60 to-white p-6 sm:p-10 shadow-xs">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#0047AB]/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col items-center text-center">
          {/* Central Big Logo (128px ~ 112-144px range) */}
          <div className="relative mb-4 flex h-32 w-32 items-center justify-center rounded-2xl bg-white p-2 shadow-md ring-4 ring-[#0047AB]/10 transition-transform duration-300 hover:scale-105">
            <div className="relative h-full w-full overflow-hidden rounded-xl">
              <Image
                src="/logo.png"
                alt="Logo Công ty CP Công trình Thành Phát"
                fill
                priority
                className="object-contain"
                sizes="128px"
              />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-1 text-xs font-semibold text-[#0047AB] shadow-2xs">
            <ShieldCheck size={16} weight="fill" className="text-[#0047AB]" />
            <span>CÔNG TY CỔ PHẦN CÔNG TRÌNH THÀNH PHÁT</span>
          </div>

          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900">
            HỆ THỐNG QUẢN LÝ <span className="text-[#0047AB]">THÀNH PHÁT</span>
          </h1>

          <p className="mt-2 max-w-2xl text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
            Nền tảng Quản trị Nhân sự, Đào tạo Chứng chỉ, Nhật ký GPS &amp; Báo cáo Vận hành Hàn Ray Đường sắt Toàn diện
          </p>

          {/* Quick Metrics Bar */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs font-semibold text-slate-600">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 shadow-2xs">
              <Users size={16} className="text-[#0047AB]" weight="bold" />
              <span>Quản lý Thợ hàn &amp; Chứng chỉ</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 shadow-2xs">
              <Wrench size={16} className="text-emerald-600" weight="bold" />
              <span>Giám sát Máy hàn Ray FBW/ATW</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 shadow-2xs">
              <Path size={16} className="text-amber-600" weight="bold" />
              <span>Đồng bộ Tọa độ GPS &amp; Lý trình</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Navigation Menu Blocks (4/3/2/1 Columns) */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Danh mục chức năng</h2>
          <p className="text-xs sm:text-sm text-slate-500">Truy cập nhanh các phân hệ vận hành và quản trị của hệ thống</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {navigation.length} phân hệ
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {navigation.map((group) => {
          const IconComp = groupIcons[group.id] ?? Path;
          const colors = groupColorClasses[group.id] ?? {
            bg: "bg-blue-50/80",
            text: "text-[#0047AB]",
            border: "border-blue-200",
            badge: "bg-blue-100 text-[#0047AB]",
          };

          return (
            <div
              key={group.id}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div>
                {/* Header of Block */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors.bg} ${colors.text} ring-1 ${colors.border}`}
                    >
                      <IconComp size={22} weight="duotone" aria-hidden />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 group-hover:text-[#0047AB] transition-colors">
                        {lang === "en" ? group.labelEn : group.label}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">Mã {group.code}</div>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${colors.badge}`}>
                    {group.children.length}
                  </span>
                </div>

                {/* List of sub-features */}
                <div className="mt-3 space-y-1.5">
                  {group.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onNavigate(child.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onNavigate(child.id);
                        }
                      }}
                      tabIndex={0}
                      className="group/item flex w-full items-start justify-between gap-2 rounded-xl p-2.5 text-left transition-colors duration-150 hover:bg-slate-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0047AB]/20"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-semibold text-slate-800 group-hover/item:text-[#0047AB] transition-colors">
                          {child.label}
                        </div>
                        {child.description && (
                          <div className="mt-0.5 line-clamp-1 text-[11px] sm:text-xs text-slate-400 font-normal leading-relaxed">
                            {child.description}
                          </div>
                        )}
                      </div>
                      <ArrowRight
                        size={14}
                        weight="bold"
                        className="mt-1 text-slate-300 transition-transform duration-150 group-hover/item:translate-x-0.5 group-hover/item:text-[#0047AB] shrink-0"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Card Summary */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Nhấp chức năng để mở</span>
                <span className="font-mono text-slate-300">#{group.id}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
