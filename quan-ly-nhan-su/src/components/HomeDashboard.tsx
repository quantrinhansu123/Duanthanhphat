"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { findNavMeta, navigation } from "@/data/navigation";
import { useLanguage } from "@/i18n/LanguageProvider";
import { CaretDown, GasPump, Path, MagnifyingGlass } from "@/components/icons";
import { groupIcons, childIcons } from "@/data/navigationIcons";

// Dashboard tổng quan nằm ngay dưới trang chủ — chỉ tải khi trang chủ mở (không chặn menu phía trên).
const OverviewDashboard = dynamic(() => import("@/components/OverviewDashboard"), {
  ssr: false,
  loading: () => <div role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Đang tải dashboard…</div>,
});

/** Mục nhập liệu hiện trường — ưu tiên trên mobile */
const QUICK_DATA_ENTRY_IDS = [
  "kiem-tra-may-truoc-ca",
  "phan-cong-may",
  "nhat-ky-han",
  "lwr-track-map",
  "bien-ban-moi-han",
  "lwr-giai-toa-ung-suat",
] as const;

const quickEntryShortLabel: Record<(typeof QUICK_DATA_ENTRY_IDS)[number], { vi: string; en: string }> = {
  "nhat-ky-han": { vi: "Nhật ký hàn", en: "Weld log" },
  "lwr-track-map": { vi: "Track Map", en: "Track Map" },
  "kiem-tra-may-truoc-ca": { vi: "Check List", en: "Checklist" },
  "bien-ban-moi-han": { vi: "Biên bản hàn", en: "Acceptance" },
  "phan-cong-may": { vi: "Nhiên liệu", en: "Fuel" },
  "lwr-giai-toa-ung-suat": { vi: "Giải toả ứng suất", en: "Stress release" },
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
  "du-an": {
    iconBg: "bg-teal-600",
    iconShadow: "shadow-[0_8px_16px_-6px_rgba(13,148,136,0.5)]",
    badge: "bg-teal-50 text-teal-700",
    ring: "hover:border-teal-300 hover:ring-teal-100",
    soft: "group-hover/card:bg-teal-50",
  },
  "lwr-han-ray": {
    iconBg: "bg-sky-600",
    iconShadow: "shadow-[0_8px_16px_-6px_rgba(2,132,199,0.5)]",
    badge: "bg-sky-50 text-sky-700",
    ring: "hover:border-sky-300 hover:ring-sky-100",
    soft: "group-hover/card:bg-sky-50",
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
  onNavigate: (tabId: string, search?: string) => void;
  canView?: (tabId: string) => boolean;
};

export default function HomeDashboard({ onNavigate, canView }: HomeDashboardProps) {
  const { lang } = useLanguage();
  const [query, setQuery] = useState("");
  /** Nhóm đang mở; mặc định thu gọn hết cho gọn mobile */
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const allowed = (id: string) => (canView ? canView(id) : true);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
  const taskGroups = [
    { id: "du-an", code: "02", label: "Nhóm 2 · Quản lý & tra cứu", labelEn: "Group 2 · Management & lookup",
      children: navigation.filter((g) => !["bao-cao", "quan-tri"].includes(g.id)).flatMap((g) => g.children) },
    { id: "bao-cao", code: "03", label: "Nhóm 3 · Báo cáo & quản trị", labelEn: "Group 3 · Reports & administration",
      children: navigation.filter((g) => ["bao-cao", "quan-tri"].includes(g.id)).flatMap((g) => g.children) },
  ];
  const groups = taskGroups
    .map(group => ({
      ...group,
      children: group.children.filter(
        child =>
          allowed(child.id) && (child.id === "phan-cong-may" || !(QUICK_DATA_ENTRY_IDS as readonly string[]).includes(child.id)) &&
          normalize(`${group.label} ${group.labelEn} ${child.label} ${child.labelEn} ${child.description ?? ""} ${child.descriptionEn ?? ""}`).includes(normalize(query.trim())),
      ),
    }))
    .filter(group => group.children.length);
  const totalChildren = navigation.reduce((sum, g) => sum + g.children.filter(child => allowed(child.id)).length, 0);
  const quickEntries = QUICK_DATA_ENTRY_IDS.filter(id => {
    const item = navigation.flatMap((g) => g.children).find((c) => c.id === id);
    return allowed(id) && normalize(`${quickEntryShortLabel[id].vi} ${quickEntryShortLabel[id].en} ${item?.label} ${item?.labelEn}`).includes(normalize(query.trim()));
  });
  const searching = query.trim().length > 0;

  function toggleGroup(id: string) {
    setOpenGroups(prev => (prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]));
  }

  return (
    <div className="mx-auto max-w-[1600px] w-full px-4 sm:px-6 lg:px-8 pb-12 pt-3 sm:pt-6 animate-in fade-in duration-200">
      {/* Mobile: menu nhập liệu hiện ngay đầu trang */}
      {quickEntries.length > 0 && <section
        className="mb-4 sm:mb-6 rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs"
        aria-labelledby="quick-data-entry-heading"
      >
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <h2 id="quick-data-entry-heading" className="text-sm sm:text-base font-bold text-slate-900">
              {lang === "en" ? "Group 1 · Field operations" : "Nhóm 1 · Sử dụng hiện trường"}
            </h2>
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500">
              {lang === "en"
                ? "Frequently used on site"
                : "Các chức năng dùng thường xuyên tại hiện trường"}
            </p>
          </div>
        </div>
        <ul
          className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3"
          aria-label={lang === "en" ? "Quick data entry menu" : "Menu nhập liệu nhanh"}
        >
          {quickEntries.map(id => {
            const item = navigation.flatMap(group => group.children).find(child => child.id === id);
            if (!item) return null;
            const meta = findNavMeta(id);
            const theme = (meta?.parentId && groupThemes[meta.parentId]) || defaultTheme;
            const Icon = id === "phan-cong-may" ? GasPump : childIcons[id] ?? Path;
            const short = quickEntryShortLabel[id];
            const label = lang === "en" ? short.en : short.vi;
            const fullTitle = id === "phan-cong-may" ? label : lang === "en" ? item.labelEn : item.label;

            return (
              <li key={id}><button
                type="button"
                title={fullTitle}
                aria-label={label}
                onClick={() => onNavigate(id, id === "phan-cong-may" ? "?fuel=1" : undefined)}
                className="group flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center transition-colors hover:bg-slate-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/30 active:bg-slate-100 cursor-pointer"
              >
                <span
                  className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl text-white transition-transform duration-150 group-active:scale-95 ${theme.iconBg} ${theme.iconShadow}`}
                >
                  <Icon size={22} weight="bold" aria-hidden />
                </span>
                <span className="line-clamp-2 max-w-[4.75rem] text-[10px] sm:text-[11px] font-semibold leading-tight text-slate-700">
                  {label}
                </span>
              </button></li>
            );
          })}
        </ul>
      </section>}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            {lang === "en" ? "Quick access" : "Truy cập nhanh"}
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            {lang === "en"
              ? "Open any function from the icon cards below"
              : "Tìm và mở nhanh nghiệp vụ cần thực hiện."}
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-2xs">
          <span role="status">{query.trim() ? groups.reduce((sum, group) => sum + group.children.length, 0) : totalChildren} {lang === "en" ? "functions" : "hạng mục"}</span>
        </span>
      </div>

      <div className="relative mb-6 max-w-lg">
        <MagnifyingGlass size={18} aria-hidden className="absolute left-3 top-3 text-slate-400" />
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={lang === "en" ? "Search functions" : "Tìm chức năng"} placeholder={lang === "en" ? "Search functions…" : "Tìm chức năng, hồ sơ, báo cáo…"} className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm" />
      </div>
      {groups.length === 0 && quickEntries.length === 0 && <div role="status" className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="text-sm text-slate-600">{lang === "en" ? "No matching functions. Try another keyword." : "Không tìm thấy chức năng phù hợp. Hãy thử từ khóa khác."}</p><button type="button" onClick={() => setQuery("")} className="mt-3 rounded-lg bg-[#0047ab] px-4 py-2 text-sm text-white">{lang === "en" ? "Clear search" : "Xóa tìm kiếm"}</button></div>}
      <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        {groups.map((group) => {
          const GroupIcon = groupIcons[group.id] ?? Path;
          const theme = groupThemes[group.id] ?? defaultTheme;
          const expanded = searching || openGroups.includes(group.id);
          const panelId = `home-group-panel-${group.id}`;

          return (
            <section className="rounded-xl border border-slate-200 bg-white shadow-xs" key={group.id} aria-labelledby={`home-group-${group.id}`}>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="flex w-full items-center gap-3 p-3.5 sm:p-4 text-left cursor-pointer rounded-xl hover:bg-slate-50/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/30 transition-colors"
              >
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
                <CaretDown
                  size={16}
                  weight="bold"
                  aria-hidden
                  className={`shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}
                />
              </button>

              {expanded && (
                <div id={panelId} className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-3.5 sm:px-4 pb-3.5 sm:pb-4">
                  {group.children.map((child) => {
                    const ChildIcon = childIcons[child.id] ?? GroupIcon;
                    const title = lang === "en" ? child.labelEn : child.label;
                    const desc =
                      lang === "en"
                        ? child.descriptionEn || child.description
                        : child.description;

                    return (
                      <div
                        key={child.id}
                        title={desc || title}
                        className={`group/card flex flex-col items-start gap-2 rounded-xl border border-slate-100 bg-white p-3 text-left transition-colors duration-150 hover:bg-slate-50 ${theme.ring}`}
                      >
                        <button
                          type="button"
                          onClick={() => onNavigate(child.id)}
                          className="flex w-full items-start gap-3 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/30 rounded-xl"
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition-transform duration-200 group-hover/card:scale-105 ${theme.iconBg}`}
                          >
                            <ChildIcon size={19} weight="bold" aria-hidden />
                          </span>
                          <span className="flex w-full flex-col items-start gap-1">
                            <span className="line-clamp-2 text-xs sm:text-sm font-bold leading-snug text-slate-900">
                              {title}
                            </span>
                            {desc && (
                              <span className="line-clamp-2 text-xs leading-relaxed text-slate-500 font-medium">
                                {desc}
                              </span>
                            )}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {allowed("bc-tong-quan") && (
        <section className="mt-8" aria-labelledby="home-overview-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="home-overview-title" className="text-lg font-bold text-slate-900 sm:text-xl">
                {lang === "en" ? "Overview dashboard" : "Dashboard tổng quan"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                {lang === "en" ? "Production progress, quality and equipment at a glance" : "Tiến độ sản xuất, chất lượng và máy móc trong một màn hình."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("bc-tong-quan")}
              className="shrink-0 cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[#0047AB] shadow-2xs hover:bg-slate-50"
            >
              {lang === "en" ? "Open full page" : "Mở toàn trang"}
            </button>
          </div>
          <div className="-mx-4 sm:-mx-6 lg:-mx-8">
            <OverviewDashboard />
          </div>
        </section>
      )}
    </div>
  );
}
