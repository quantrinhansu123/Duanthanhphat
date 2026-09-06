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
  ShieldCheck,
  IdentificationCard,
  MagnifyingGlass,
  CalendarCheck,
  Bug,
  ListChecks,
  Certificate,
  SealCheck,
  ClipboardText,
  FileText,
  ChartLineUp,
  MapTrifold,
  Files,
  Gauge,
  ChartPieSlice,
  ChartLine,
  UploadSimple,
  Flag,
  Cube,
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

const childIcons: Record<string, Icon> = {
  "ho-so-tho-han": IdentificationCard,
  "lich-su-han": ClockCounterClockwise,
  "khoa-dao-tao": GraduationCap,
  "tra-cuu-dao-tao": MagnifyingGlass,
  "danh-sach-may": Cube,
  "lich-bao-tri": CalendarCheck,
  "thu-vien-loi": Bug,
  "phan-cong-may": ListChecks,
  "quan-ly-moi-han": Lightning,
  "thu-vien-loi-moi-han": Bug,
  "quan-ly-du-an": Buildings,
  "chung-chi": Certificate,
  "chung-chi-cong-ty": SealCheck,
  "tieu-chuan-tcvn": ClipboardText,
  "nhat-ky-han": FileText,
  "bc-moi-han-theo-nam": ChartLineUp,
  "ban-do": MapTrifold,
  "tai-lieu": Files,
  "bc-tong-quan": Gauge,
  "bc-chat-luong": ChartPieSlice,
  "bc-may-moc": ChartLine,
  "bc-nhan-su": Users,
  "nhap-hang-loat": UploadSimple,
  "cau-hinh": GearSix,
  "trien-khai": Flag,
};

/** Icon nền đặc + chữ trắng — tông chuyên nghiệp theo phân hệ */
const groupThemes: Record<
  string,
  { iconBg: string; iconShadow: string; badge: string; ring: string; soft: string }
> = {
  "nhan-su": {
    iconBg: "bg-[#0047AB]",
    iconShadow: "shadow-[0_8px_16px_-6px_rgba(0,71,171,0.55)]",
    badge: "bg-[#0047AB]/10 text-[#0047AB]",
    ring: "hover:border-[#0047AB]/35 hover:ring-[#0047AB]/15",
    soft: "group-hover/card:bg-blue-50",
  },
  "dao-tao": {
    iconBg: "bg-indigo-600",
    iconShadow: "shadow-[0_8px_16px_-6px_rgba(79,70,229,0.5)]",
    badge: "bg-indigo-50 text-indigo-700",
    ring: "hover:border-indigo-300 hover:ring-indigo-100",
    soft: "group-hover/card:bg-indigo-50",
  },
  "may-moc": {
    iconBg: "bg-amber-500",
    iconShadow: "shadow-[0_8px_16px_-6px_rgba(245,158,11,0.5)]",
    badge: "bg-amber-50 text-amber-700",
    ring: "hover:border-amber-300 hover:ring-amber-100",
    soft: "group-hover/card:bg-amber-50",
  },
  "moi-han": {
    iconBg: "bg-orange-600",
    iconShadow: "shadow-[0_8px_16px_-6px_rgba(234,88,12,0.5)]",
    badge: "bg-orange-50 text-orange-700",
    ring: "hover:border-orange-300 hover:ring-orange-100",
    soft: "group-hover/card:bg-orange-50",
  },
  "du-an": {
    iconBg: "bg-teal-600",
    iconShadow: "shadow-[0_8px_16px_-6px_rgba(13,148,136,0.5)]",
    badge: "bg-teal-50 text-teal-700",
    ring: "hover:border-teal-300 hover:ring-teal-100",
    soft: "group-hover/card:bg-teal-50",
  },
  "ky-thuat": {
    iconBg: "bg-cyan-600",
    iconShadow: "shadow-[0_8px_16px_-6px_rgba(8,145,178,0.5)]",
    badge: "bg-cyan-50 text-cyan-700",
    ring: "hover:border-cyan-300 hover:ring-cyan-100",
    soft: "group-hover/card:bg-cyan-50",
  },
  "bao-cao": {
    iconBg: "bg-emerald-600",
    iconShadow: "shadow-[0_8px_16px_-6px_rgba(5,150,105,0.5)]",
    badge: "bg-emerald-50 text-emerald-700",
    ring: "hover:border-emerald-300 hover:ring-emerald-100",
    soft: "group-hover/card:bg-emerald-50",
  },
  "du-lieu-lich-su": {
    iconBg: "bg-violet-600",
    iconShadow: "shadow-[0_8px_16px_-6px_rgba(124,58,237,0.5)]",
    badge: "bg-violet-50 text-violet-700",
    ring: "hover:border-violet-300 hover:ring-violet-100",
    soft: "group-hover/card:bg-violet-50",
  },
  "quan-tri": {
    iconBg: "bg-slate-700",
    iconShadow: "shadow-[0_8px_16px_-6px_rgba(51,65,85,0.5)]",
    badge: "bg-slate-100 text-slate-700",
    ring: "hover:border-slate-400 hover:ring-slate-100",
    soft: "group-hover/card:bg-slate-50",
  },
};

const defaultTheme = groupThemes["nhan-su"];

type HomeDashboardProps = {
  onNavigate: (tabId: string) => void;
};

export default function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  const { lang } = useLanguage();
  const totalChildren = navigation.reduce((sum, g) => sum + g.children.length, 0);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pb-12 pt-2 animate-in fade-in duration-200">
      <div className="relative mb-8 sm:mb-10 overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white via-[#f0f5ff]/60 to-white p-6 sm:p-10 shadow-xs">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#0047AB]/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col items-center text-center">
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
            <span>
              {lang === "en"
                ? "THANH PHAT ENGINEERING JOINT STOCK COMPANY"
                : "CÔNG TY CỔ PHẦN CÔNG TRÌNH THÀNH PHÁT"}
            </span>
          </div>

          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900">
            {lang === "en" ? (
              <>
                <span className="text-[#0047AB]">Rail Welding</span> Management System
              </>
            ) : (
              <>
                Hệ thống Quản lý <span className="text-[#0047AB]">hàn ray</span>
              </>
            )}
          </h1>

          <p className="mt-2 max-w-2xl text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
            {lang === "en"
              ? "Comprehensive Platform for Welder Personnel, Certification Training, GPS Logs & Railway Welding Operations"
              : "Nền tảng Quản trị Nhân sự, Đào tạo Chứng chỉ, Nhật ký GPS & Báo cáo Vận hành Hàn Ray Đường sắt Toàn diện"}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs font-semibold text-slate-600">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 shadow-2xs">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#0047AB] text-white shadow-sm">
                <Users size={12} weight="bold" />
              </span>
              <span>{lang === "en" ? "Welder Management & Certificates" : "Quản lý Thợ hàn & Chứng chỉ"}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 shadow-2xs">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-600 text-white shadow-sm">
                <Wrench size={12} weight="bold" />
              </span>
              <span>{lang === "en" ? "FBW/ATW Rail Welding Monitoring" : "Giám sát Máy hàn Ray FBW/ATW"}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 shadow-2xs">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500 text-white shadow-sm">
                <Path size={12} weight="bold" />
              </span>
              <span>{lang === "en" ? "GPS Coordinates & Chainage Sync" : "Đồng bộ Tọa độ GPS & Lý trình"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            {lang === "en" ? "Quick access" : "Truy cập nhanh"}
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            {lang === "en"
              ? "Open any function from the icon cards below"
              : "Chọn thẻ icon bên dưới để mở từng hạng mục chức năng"}
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-2xs">
          {totalChildren} {lang === "en" ? "functions" : "hạng mục"}
        </span>
      </div>

      <div className="flex flex-col gap-8 sm:gap-10">
        {navigation.map((group) => {
          const GroupIcon = groupIcons[group.id] ?? Path;
          const theme = groupThemes[group.id] ?? defaultTheme;

          return (
            <section key={group.id} aria-labelledby={`home-group-${group.id}`}>
              <div className="mb-3.5 flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${theme.iconBg} ${theme.iconShadow}`}
                >
                  <GroupIcon size={18} weight="bold" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    id={`home-group-${group.id}`}
                    className="truncate text-sm sm:text-base font-bold tracking-tight text-slate-900"
                  >
                    {lang === "en" ? group.labelEn : group.label}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-400">
                    {lang === "en" ? `Code ${group.code}` : `Mã ${group.code}`}
                    {" · "}
                    {group.children.length} {lang === "en" ? "items" : "hạng mục"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                {group.children.map((child) => {
                  const ChildIcon = childIcons[child.id] ?? GroupIcon;
                  const title = lang === "en" ? child.labelEn : child.label;
                  const desc =
                    lang === "en"
                      ? child.descriptionEn || child.description
                      : child.description;

                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onNavigate(child.id)}
                      title={desc || title}
                      className={`group/card flex flex-col items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-3 py-5 sm:px-4 sm:py-6 text-center shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(15,23,42,0.18)] hover:ring-4 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/30 ${theme.ring}`}
                    >
                      <span
                        className={`flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl text-white transition-transform duration-200 group-hover/card:scale-105 ${theme.iconBg} ${theme.iconShadow} ${theme.soft}`}
                      >
                        <ChildIcon size={28} weight="bold" aria-hidden />
                      </span>
                      <span className="flex w-full flex-col items-center gap-1">
                        <span className="line-clamp-2 text-xs sm:text-sm font-bold leading-snug text-slate-900">
                          {title}
                        </span>
                        {desc && (
                          <span className="line-clamp-2 text-[10px] sm:text-[11px] leading-relaxed text-slate-400 font-medium">
                            {desc}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
