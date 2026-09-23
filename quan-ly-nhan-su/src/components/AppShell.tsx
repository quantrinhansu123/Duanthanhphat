"use client";

import GlobalReportFilterBar from "@/components/GlobalReportFilterBar";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { List, Bell, CaretRight, ArrowLeft } from "@/components/icons";
import Sidebar from "@/components/Sidebar";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageProvider";
import ReportTabBar from "@/components/ReportTabBar";
import { findNavMeta, isValidTab, navigation } from "@/data/navigation";
import { isReportTab } from "@/data/reportTabs";
import { ReportFilterProvider } from "@/contexts/ReportFilterContext";
import { prefetchTabModule } from "@/lib/tabModules";

function TabLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <div className="text-sm font-medium text-slate-500">Đang tải...</div>
    </div>
  );
}

const HomeDashboard = dynamic(() => import("@/components/HomeDashboard"), { loading: TabLoading, ssr: false });
const WelderManagement = dynamic(() => import("@/components/WelderManagement"), { loading: TabLoading, ssr: false });
const WeldingHistoryList = dynamic(() => import("@/components/WeldingHistoryList"), { loading: TabLoading, ssr: false });
const FailedWeldHistoryList = dynamic(() => import("@/components/FailedWeldHistoryList"), { loading: TabLoading, ssr: false });
const TrainingList = dynamic(() => import("@/components/TrainingList"), { loading: TabLoading, ssr: false });
const CertificateManagement = dynamic(() => import("@/components/CertificateManagement"), { loading: TabLoading, ssr: false });
const CompanyCertificateManagement = dynamic(
  () => import("@/components/CompanyCertificateManagement"), { loading: TabLoading, ssr: false });
const ComplianceStandardsList = dynamic(
  () => import("@/components/ComplianceStandardsList"), { loading: TabLoading, ssr: false });
const TrainingHistoryLookup = dynamic(
  () => import("@/components/TrainingHistoryLookup"), { loading: TabLoading, ssr: false });
const MachineList = dynamic(() => import("@/components/MachineList"), { loading: TabLoading, ssr: false });
const WeldingTrayList = dynamic(() => import("@/components/WeldingTrayList"), { loading: TabLoading, ssr: false });
const MaintenanceCalendar = dynamic(() => import("@/components/MaintenanceCalendar"), { loading: TabLoading, ssr: false });
const ErrorLibrary = dynamic(() => import("@/components/ErrorLibrary"), { loading: TabLoading, ssr: false });
const MachineAssignmentList = dynamic(
  () => import("@/components/MachineAssignmentList"), { loading: TabLoading, ssr: false });
const OverviewDashboard = dynamic(() => import("@/components/OverviewDashboard"), { loading: TabLoading, ssr: false });
const QualityReportDashboard = dynamic(
  () => import("@/components/QualityReportDashboard"), { loading: TabLoading, ssr: false });
const MachineReportDashboard = dynamic(
  () => import("@/components/MachineReportDashboard"), { loading: TabLoading, ssr: false });
const PersonnelReportDashboard = dynamic(
  () => import("@/components/PersonnelReportDashboard"), { loading: TabLoading, ssr: false });
const DailyWorkReport = dynamic(() => import("@/components/DailyWorkReport"), { loading: TabLoading, ssr: false });
const ProjectManagement = dynamic(() => import("@/components/ProjectManagement"), { loading: TabLoading, ssr: false });
const WeldJointManagement = dynamic(() => import("@/components/WeldJointManagement"), { loading: TabLoading, ssr: false });
const WeldingJournalList = dynamic(() => import("@/components/WeldingJournalList"), { loading: TabLoading, ssr: false });
const WeldAcceptanceReport = dynamic(
  () => import("@/components/WeldAcceptanceReport"), { loading: TabLoading, ssr: false });
const YearlyWeldReport = dynamic(() => import("@/components/YearlyWeldReport"), { loading: TabLoading, ssr: false });
const MapView = dynamic(() => import("@/components/MapView"), { loading: TabLoading, ssr: false });
const DocumentLibrary = dynamic(() => import("@/components/DocumentLibrary"), { loading: TabLoading, ssr: false });
const DeploymentHandoverList = dynamic(
  () => import("@/components/DeploymentHandoverList"), { loading: TabLoading, ssr: false });
const BulkImportList = dynamic(() => import("@/components/BulkImportList"), { loading: TabLoading, ssr: false });
const SystemConfiguration = dynamic(
  () => import("@/components/SystemConfiguration"), { loading: TabLoading, ssr: false });

const viewRenderers: Record<string, () => React.ReactNode> = {
  "ho-so-tho-han": () => <WelderManagement />,
  "lich-su-han": () => <WeldingHistoryList />,
  "lich-su-moi-han-loi": () => <FailedWeldHistoryList />,
  "khoa-dao-tao": () => <TrainingList />,
  "chung-chi": () => <CertificateManagement />,
  "chung-chi-cong-ty": () => <CompanyCertificateManagement />,
  "tieu-chuan-tcvn": () => <ComplianceStandardsList />,
  "tra-cuu-dao-tao": () => <TrainingHistoryLookup />,
  "danh-sach-may": () => <MachineList />,
  "quan-ly-khay-han": () => <WeldingTrayList />,
  "lich-bao-tri": () => <MaintenanceCalendar />,
  "thu-vien-loi": () => <ErrorLibrary mode="machine" />,
  "phan-cong-may": () => <MachineAssignmentList />,
  "bc-tong-quan": () => <OverviewDashboard />,
  "bc-san-luong": () => <OverviewDashboard />,
  "bc-chat-luong": () => <QualityReportDashboard />,
  "bc-may-moc": () => <MachineReportDashboard />,
  "bc-nhan-su": () => <PersonnelReportDashboard />,
  "bc-bao-cao-ngay": () => <DailyWorkReport />,
  "quan-ly-du-an": () => <ProjectManagement />,
  "quan-ly-moi-han": () => <WeldJointManagement />,
  "thu-vien-loi-moi-han": () => <ErrorLibrary mode="ndt" />,
  "nhat-ky-han": () => <WeldingJournalList />,
  "bien-ban-moi-han": () => <WeldAcceptanceReport />,
  "bc-moi-han-theo-nam": () => <YearlyWeldReport />,
  "ban-do": () => <MapView />,
  "tai-lieu": () => <DocumentLibrary />,
  "trien-khai": () => <DeploymentHandoverList />,
  "nhap-hang-loat": () => <BulkImportList />,
  "cau-hinh": () => <SystemConfiguration />,
};

type AppShellProps = {
  tab?: string;
};

function tabFromPath(pathname: string) {
  const path = pathname.replace(/^\//, "").split("/")[0] ?? "";
  return isValidTab(path) ? path : "";
}

function useClientClock(lang: "vi" | "en") {
  const [clock, setClock] = useState<{ time: string; date: string } | null>(null);

  useEffect(() => {
    const locale = lang === "en" ? "en-US" : "vi-VN";
    const pad = (n: number) => String(n).padStart(2, "0");
    function tick() {
      const now = new Date();
      const dmy = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      const weekday = now.toLocaleDateString(locale, { weekday: "long" });
      setClock({
        time: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }),
        date: `${weekday}, ${dmy}`,
      });
    }

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [lang]);

  return clock;
}

export default function AppShell({ tab }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(() => {
    if (tab && isValidTab(tab)) return tab;
    if (typeof window !== "undefined") return tabFromPath(window.location.pathname);
    return "";
  });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Đồng bộ tab theo URL Next.js — để nút Back trình duyệt về đúng trang trước.
  useEffect(() => {
    const fromPath = tabFromPath(pathname);
    const fromProp = tab && isValidTab(tab) ? tab : "";
    setActiveTab(fromPath || fromProp);
  }, [pathname, tab]);

  // Prefetch chunk trang hiện tại + tab anh em trong cùng nhóm (idle).
  useEffect(() => {
    const fromPath = tabFromPath(pathname);
    const currentId = fromPath || (tab && isValidTab(tab) ? tab : "");
    if (currentId) prefetchTabModule(currentId);
    else void import("@/components/HomeDashboard").catch(() => undefined);

    const siblings =
      currentId
        ? navigation.find((g) => g.children.some((c) => c.id === currentId))?.children.map((c) => c.id) ?? []
        : navigation.flatMap((g) => g.children.slice(0, 1).map((c) => c.id));

    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => {
          for (const id of siblings) prefetchTabModule(id);
        }, { timeout: 2500 })
      : window.setTimeout(() => {
          for (const id of siblings) prefetchTabModule(id);
        }, 800);

    return () => {
      if (typeof idle === "number" && window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle as number);
    };
  }, [pathname, tab]);

  const current = activeTab && isValidTab(activeTab) ? activeTab : "";
  const crumb = current ? findNavMeta(current) : null;
  const reportTab = Boolean(current && isReportTab(current));
  const { lang } = useLanguage();
  const clock = useClientClock(lang);

  const group = current ? navigation.find((g) => g.children.some((c) => c.id === current)) : null;
  const content = current ? viewRenderers[current]?.() ?? null : null;

  function go(id: string) {
    const targetId = !id ? "" : id === "bc-san-luong" ? "bc-tong-quan" : id;
    const href = targetId ? `/${targetId}` : "/";
    if (targetId) prefetchTabModule(targetId);
    setActiveTab(targetId);
    setMobileNavOpen(false);
    router.push(href);
  }

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    go("");
  }

  return (
    <ReportFilterProvider>
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] text-[#0f172a]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar
          activeId={current}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          onNavigate={go}
        />
      </div>

      {/* Mobile / Tablet Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="fixed inset-0 bg-[#071633]/60 backdrop-blur-xs transition-opacity duration-200"
            aria-label="Đóng menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 h-full shadow-xl">
            <Sidebar
              activeId={current}
              collapsed={false}
              onClose={() => setMobileNavOpen(false)}
              onNavigate={go}
            />
          </div>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-3.5 sm:px-6 py-2.5 sm:py-3 gap-2 z-10">
          <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm text-slate-500">
            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] hover:border-slate-300 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/20 transition-all duration-150 cursor-pointer"
              aria-label="Mở menu điều hướng"
            >
              <List size={20} weight="bold" aria-hidden />
            </button>

            {current ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] hover:border-slate-300 transition-all cursor-pointer"
                aria-label={lang === "en" ? "Go back" : "Quay lại"}
                title={lang === "en" ? "Back to previous page" : "Về trang trước"}
              >
                <ArrowLeft size={16} weight="bold" aria-hidden />
                <span className="hidden sm:inline">{lang === "en" ? "Back" : "Quay lại"}</span>
              </button>
            ) : null}

            {current ? <span className="hidden sm:block h-5 w-px shrink-0 bg-slate-200" aria-hidden /> : null}

            {crumb ? (
              <nav className="flex min-w-0 items-center gap-1.5" aria-label={lang === "en" ? "Breadcrumb" : "Đường dẫn"}>
                <button
                  type="button"
                  onClick={() => go("")}
                  className="hidden md:inline truncate font-medium text-slate-500 hover:text-[#0047AB] cursor-pointer transition-colors"
                  title={lang === "en" ? "Home" : "Trang chủ"}
                >
                  {lang === "en" ? "Home" : "Trang chủ"}
                </button>
                <CaretRight size={12} weight="bold" aria-hidden className="hidden md:inline shrink-0 text-slate-400" />
                <button
                  type="button"
                  onClick={() => go(crumb.parentFirstChildId)}
                  className="hidden md:inline truncate font-medium text-slate-500 hover:text-[#0047AB] cursor-pointer transition-colors"
                  title={lang === "en" ? (crumb.parentEn || crumb.parent) : crumb.parent}
                >
                  {lang === "en" ? (crumb.parentEn || crumb.parent) : crumb.parent}
                </button>
                <CaretRight size={12} weight="bold" aria-hidden className="hidden md:inline shrink-0 text-slate-400" />
                <button
                  type="button"
                  onClick={() => go(crumb.id)}
                  className="truncate font-semibold text-slate-900 text-xs sm:text-sm hover:text-[#0047AB] cursor-pointer transition-colors"
                  aria-current="page"
                  title={lang === "en" ? (crumb.titleEn || crumb.title) : crumb.title}
                >
                  {lang === "en" ? (crumb.titleEn || crumb.title) : crumb.title}
                </button>
              </nav>
            ) : (
              <span className="truncate font-semibold text-slate-800 text-xs sm:text-sm">
                {lang === "en" ? "Rail Welding Management System" : "Hệ thống Quản lý hàn ray"}
              </span>
            )}
          </div>

          <div className="flex flex-none items-center gap-2.5 sm:gap-4 text-xs sm:text-sm">
            <div className="hidden sm:block text-right leading-tight">
              <div className="font-semibold font-mono text-slate-900 tabular-nums text-xs sm:text-sm">{clock?.time ?? "--:--"}</div>
              <div className="capitalize text-[11px] sm:text-xs font-medium text-slate-500">{clock?.date ?? (lang === "en" ? "Loading..." : "Đang tải...")}</div>
            </div>
            <LanguageSwitcher />
            <button
              className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-[#0047AB] transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0047AB]/20 focus:outline-hidden"
              type="button"
              aria-label={lang === "en" ? "Notifications" : "Thông báo"}
            >
              <Bell size={18} weight="regular" aria-hidden />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#0047AB] ring-2 ring-white" />
            </button>
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-2.5 sm:pl-4">
              <div className="hidden md:block text-right leading-tight">
                <div className="text-xs sm:text-sm font-semibold text-slate-900">Nguyễn Đắc Công</div>
                <div className="text-[11px] font-medium text-slate-500">{lang === "en" ? "Admin" : "Admin"}</div>
              </div>
              <div className="relative h-8 w-8 sm:h-9 sm:w-9 overflow-hidden rounded-full bg-[#0047AB] ring-2 ring-slate-200 hover:ring-blue-200 transition-all shadow-xs">
                <Image
                  src="https://randomuser.me/api/portraits/men/11.jpg"
                  alt="Nguyễn Đắc Công"
                  fill
                  className="object-cover"
                  sizes="36px"
                />
              </div>
            </div>
          </div>
        </header>

        <div className={`min-h-0 flex-1 overflow-y-auto ${reportTab ? "flex flex-col" : ""}`}>
          {reportTab && (
            <div className="sticky top-0 z-20 shrink-0">
              <GlobalReportFilterBar />
              <ReportTabBar activeId={current} onNavigate={go} />
            </div>
          )}

          {!reportTab && crumb && (
            <div className="w-full px-4 sm:px-6 pt-4 sm:pt-5">
              <div className="mb-3.5 sm:mb-4">
                <button
                  type="button"
                  onClick={() => go(crumb.parentFirstChildId)}
                  className="text-xs font-bold uppercase tracking-wider text-[#0047AB] hover:underline cursor-pointer"
                >
                  {lang === "en" ? (crumb.parentEn || crumb.parent) : crumb.parent}
                </button>
                <h1 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  {lang === "en" ? (crumb.titleEn || crumb.title) : crumb.title}
                </h1>
                {(crumb.description || crumb.descriptionEn) ? (
                  <p className="mt-1 max-w-3xl text-xs sm:text-sm leading-relaxed text-slate-500">
                    {lang === "en" ? (crumb.descriptionEn || crumb.description) : crumb.description}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {content ? (
            content
          ) : current ? (
            <div className="w-full px-4 sm:px-6 pb-8">
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(group?.children ?? []).map((child) => {
                  const active = child.id === current;
                  const childTitle = lang === "en" ? (child.labelEn || child.label) : child.label;
                  const childDesc =
                    lang === "en"
                      ? child.descriptionEn || child.description || ""
                      : child.description || "";
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => go(child.id)}
                      className={`rounded-xl border p-4 sm:p-5 text-left transition-all duration-150 cursor-pointer ${
                        active
                          ? "border-[#0047AB] bg-blue-50/70 shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                      }`}
                    >
                      <div className={`text-sm font-bold ${active ? "text-[#0047AB]" : "text-slate-900"}`}>
                        {childTitle}
                      </div>
                      <div className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-500">{childDesc}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-7 text-center shadow-xs">
                <div className="text-sm font-semibold text-slate-900">
                  {lang === "en" ? "Module Under Development" : "Module đang được xây dựng"}
                </div>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  {lang === "en"
                    ? "Available functions: Welder Profiles, Training Courses, Certificates, Training Lookup."
                    : "Các chức năng đã sẵn sàng: Hồ sơ thợ hàn, Danh sách khóa đào tạo, Quản lý chứng chỉ, Tra cứu lịch sử đào tạo."}
                </p>
              </div>
            </div>
          ) : (
            <HomeDashboard onNavigate={go} />
          )}
        </div>
      </div>
    </div>
    </ReportFilterProvider>
  );
}
