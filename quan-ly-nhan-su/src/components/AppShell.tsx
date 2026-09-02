"use client";

import GlobalReportFilterBar from "@/components/GlobalReportFilterBar";
import Image from "next/image";
import { useEffect, useState } from "react";
import { List, Bell, CaretRight } from "@/components/icons";
import Sidebar from "@/components/Sidebar";
import BulkImportList from "@/components/BulkImportList";
import CertificateManagement from "@/components/CertificateManagement";
import DeploymentHandoverList from "@/components/DeploymentHandoverList";
import DocumentLibrary from "@/components/DocumentLibrary";
import EmployeeManagement from "@/components/EmployeeManagement";
import ErrorLibrary from "@/components/ErrorLibrary";
import MachineAssignmentList from "@/components/MachineAssignmentList";
import MachineList from "@/components/MachineList";
import MachineReportDashboard from "@/components/MachineReportDashboard";
import MaintenanceCalendar from "@/components/MaintenanceCalendar";
import MapView from "@/components/MapView";
import OverviewDashboard from "@/components/OverviewDashboard";
import PersonnelReportDashboard from "@/components/PersonnelReportDashboard";
import ProjectManagement from "@/components/ProjectManagement";
import QualityReportDashboard from "@/components/QualityReportDashboard";
import ReportTabBar from "@/components/ReportTabBar";
import SystemConfiguration from "@/components/SystemConfiguration";
import TrainingHistoryLookup from "@/components/TrainingHistoryLookup";
import TrainingList from "@/components/TrainingList";
import WelderManagement from "@/components/WelderManagement";
import WeldingJournalList from "@/components/WeldingJournalList";
import WeldingHistoryList from "@/components/WeldingHistoryList";
import WeldJointManagement from "@/components/WeldJointManagement";
import WeldingTrayList from "@/components/WeldingTrayList";
import { findNavMeta, isValidTab, navigation } from "@/data/navigation";
import { isReportTab } from "@/data/reportTabs";
import { ReportFilterProvider } from "@/contexts/ReportFilterContext";

const views: Record<string, React.ReactNode> = {
  "ho-so-nhan-su": <EmployeeManagement />,
  "ho-so-tho-han": <WelderManagement />,
  "lich-su-han": <WeldingHistoryList />,
  "khoa-dao-tao": <TrainingList />,
  "chung-chi": <CertificateManagement />,
  "tra-cuu-dao-tao": <TrainingHistoryLookup />,
  "danh-sach-may": <MachineList />,
  "quan-ly-khay-han": <WeldingTrayList />,
  "lich-bao-tri": <MaintenanceCalendar />,
  "thu-vien-loi": <ErrorLibrary />,
  "phan-cong-may": <MachineAssignmentList />,
  "bc-tong-quan": <OverviewDashboard />,
  "bc-san-luong": <OverviewDashboard />,
  "bc-chat-luong": <QualityReportDashboard />,
  "bc-may-moc": <MachineReportDashboard />,
  "bc-nhan-su": <PersonnelReportDashboard />,
  "quan-ly-du-an": <ProjectManagement />,
  "quan-ly-moi-han": <WeldJointManagement />,
  "nhat-ky-han": <WeldingJournalList />,
  "quan-ly-may-han": <MachineList />,
  "ban-do": <MapView />,
  "tai-lieu": <DocumentLibrary />,
  "trien-khai": <DeploymentHandoverList />,
  "nhap-hang-loat": <BulkImportList />,
  "cau-hinh": <SystemConfiguration />,
};

type AppShellProps = {
  tab?: string;
};

function useClientClock() {
  const [clock, setClock] = useState<{ time: string; date: string } | null>(null);

  useEffect(() => {
    function tick() {
      const now = new Date();
      setClock({
        time: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        date: now.toLocaleDateString("vi-VN", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
      });
    }

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return clock;
}

export default function AppShell({ tab }: AppShellProps) {
  const [activeTab, setActiveTab] = useState(tab && isValidTab(tab) ? tab : "");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (tab && isValidTab(tab)) {
      setActiveTab(tab);
    } else if (tab === "" || tab === undefined) {
      setActiveTab("");
    }
  }, [tab]);

  useEffect(() => {
    function handlePopState() {
      const path = window.location.pathname.replace(/^\//, "");
      if (isValidTab(path)) {
        setActiveTab(path);
      } else {
        setActiveTab("");
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const current = activeTab && isValidTab(activeTab) ? activeTab : "";
  const crumb = current ? findNavMeta(current) : null;
  const reportTab = Boolean(current && isReportTab(current));
  const clock = useClientClock();

  const group = current ? navigation.find((g) => g.children.some((c) => c.id === current)) : null;
  const content = current ? views[current] : null;

  function go(id: string) {
    if (!id) {
      setActiveTab("");
      window.history.pushState(null, "", "/");
      setMobileNavOpen(false);
      return;
    }
    const targetId = id === "bc-san-luong" ? "bc-tong-quan" : id;
    setActiveTab(targetId);
    window.history.pushState(null, "", `/${targetId}`);
    setMobileNavOpen(false);
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
          <div className="relative z-10 flex h-full w-[280px] max-w-[85vw] flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <Sidebar
              activeId={current}
              collapsed={false}
              onNavigate={go}
              onClose={() => setMobileNavOpen(false)}
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

            {crumb ? (
              <>
                <span className="hidden md:inline truncate font-medium text-slate-600">{crumb.parent}</span>
                <CaretRight size={12} weight="bold" aria-hidden className="hidden md:inline shrink-0 text-slate-400" />
                <span className="truncate font-semibold text-slate-900 text-xs sm:text-sm">{crumb.title}</span>
              </>
            ) : (
              <span className="truncate font-semibold text-slate-800 text-xs sm:text-sm">
                Hệ thống Quản lý Vận hành &amp; Nhân sự
              </span>
            )}
          </div>

          <div className="flex flex-none items-center gap-2.5 sm:gap-4 text-xs sm:text-sm">
            <div className="hidden sm:block text-right leading-tight">
              <div className="font-semibold font-mono text-slate-900 tabular-nums text-xs sm:text-sm">{clock?.time ?? "--:--"}</div>
              <div className="capitalize text-[11px] sm:text-xs font-medium text-slate-500">{clock?.date ?? "Đang tải..."}</div>
            </div>
            <button
              className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-[#0047AB] transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0047AB]/20 focus:outline-hidden"
              type="button"
              aria-label="Thông báo"
            >
              <Bell size={18} weight="regular" aria-hidden />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#0047AB] ring-2 ring-white" />
            </button>
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-2.5 sm:pl-4">
              <div className="hidden md:block text-right leading-tight">
                <div className="text-xs sm:text-sm font-semibold text-slate-900">Nguyễn Đắc Công</div>
                <div className="text-[11px] font-medium text-slate-500">Admin</div>
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

        <div className={`min-h-0 flex-1 ${reportTab ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}>
          {reportTab && <GlobalReportFilterBar />}
          {reportTab && <ReportTabBar activeId={current} onNavigate={go} />}

          {!reportTab && crumb && (
            <div className="mx-auto max-w-[1440px] px-4 sm:px-6 pt-4 sm:pt-5">
              <div className="mb-3.5 sm:mb-4">
                <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                  {crumb.parentEn}
                </div>
                <h1 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{crumb.title}</h1>
                {crumb.description ? (
                  <p className="mt-1 max-w-3xl text-xs sm:text-sm leading-relaxed text-slate-500">{crumb.description}</p>
                ) : null}
              </div>
            </div>
          )}

          {content ? (
            reportTab ? (
              <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
            ) : (
              content
            )
          ) : current ? (
            <div className="mx-auto max-w-[1440px] px-4 sm:px-6 pb-8">
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(group?.children ?? []).map((child) => {
                  const active = child.id === current;
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
                        {child.label}
                      </div>
                      <div className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-500">{child.description}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-7 text-center shadow-xs">
                <div className="text-sm font-semibold text-slate-900">Module đang được xây dựng</div>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Các chức năng đã sẵn sàng: Hồ sơ nhân sự, Hồ sơ thợ hàn, Danh sách khóa đào tạo, Quản lý chứng chỉ, Tra cứu lịch sử đào tạo.
                </p>
              </div>
            </div>
          ) : (
            <div className="min-h-full w-full" />
          )}
        </div>
      </div>
    </div>
    </ReportFilterProvider>
  );
}
