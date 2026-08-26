"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import BulkImportList from "@/components/BulkImportList";
import CertificateManagement from "@/components/CertificateManagement";
import DeploymentHandoverList from "@/components/DeploymentHandoverList";
import EmployeeManagement from "@/components/EmployeeManagement";
import ErrorLibrary from "@/components/ErrorLibrary";
import HtmlReportView, { isHtmlReportTab } from "@/components/HtmlReportView";
import MachineAssignmentList from "@/components/MachineAssignmentList";
import MachineList from "@/components/MachineList";
import MaintenanceCalendar from "@/components/MaintenanceCalendar";
import ProjectManagement from "@/components/ProjectManagement";
import QualityReportDashboard from "@/components/QualityReportDashboard";
import ReportTabBar from "@/components/ReportTabBar";
import SystemConfiguration from "@/components/SystemConfiguration";
import TrainingHistoryLookup from "@/components/TrainingHistoryLookup";
import TrainingList from "@/components/TrainingList";
import WelderManagement from "@/components/WelderManagement";
import WeldingHistoryList from "@/components/WeldingHistoryList";
import WeldJointManagement from "@/components/WeldJointManagement";
import WeldingTrayList from "@/components/WeldingTrayList";
import { DEFAULT_TAB, findNavMeta, isValidTab, navigation } from "@/data/navigation";
import { isReportTab } from "@/data/reportTabs";

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
  "bc-chat-luong": <QualityReportDashboard />,
  "quan-ly-du-an": <ProjectManagement />,
  "quan-ly-moi-han": <WeldJointManagement />,
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
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const current = tab && isValidTab(tab) ? tab : DEFAULT_TAB;
  const crumb = findNavMeta(current);
  const htmlReport = isHtmlReportTab(current);
  const reportTab = isReportTab(current);
  const clock = useClientClock();

  const group = navigation.find((g) => g.children.some((c) => c.id === current));
  const content = htmlReport ? <HtmlReportView tabId={current} /> : views[current];

  function go(id: string) {
    router.push(`/${id}`);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#eef2f8] text-[#1f2937]">
      <div className="shrink-0">
        <Sidebar
          activeId={current}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          onNavigate={go}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-[#e8eef8] bg-white px-6 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[13px] text-[#64748b]">
            <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md bg-[#0047AB] text-[11px] font-bold text-white">
              {crumb.code}
            </span>
            <span className="text-[#94a3b8]">›</span>
            <span className="truncate">{crumb.parent}</span>
            <span className="text-[#94a3b8]">›</span>
            <span className="truncate font-semibold text-[#0f172a]">{crumb.title}</span>
          </div>

          <div className="flex flex-none items-center gap-4 text-[13px]">
            <div className="text-right leading-tight">
              <div className="font-semibold text-[#0f172a]">{clock?.time ?? "--:--"}</div>
              <div className="capitalize text-[#64748b]">{clock?.date ?? "Đang tải..."}</div>
            </div>
            <button
              className="relative rounded-full p-2 text-[#64748b] hover:bg-[#eef3fb]"
              type="button"
              aria-label="Thông báo"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#0047AB]" />
            </button>
            <div className="flex items-center gap-2 border-l border-[#e2e8f0] pl-4">
              <div className="text-right leading-tight">
                <div className="text-[13px] font-semibold text-[#0f172a]">Nguyễn Đắc Công</div>
                <div className="text-[11px] text-[#64748b]">Admin</div>
              </div>
              <div className="relative h-9 w-9 overflow-hidden rounded-full bg-[#0047AB]">
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

        <div className={`min-h-0 flex-1 ${htmlReport || reportTab ? "flex flex-col overflow-hidden" : "overflow-auto"}`}>
          {reportTab && <ReportTabBar activeId={current} onNavigate={go} />}

          {!htmlReport && !reportTab && (
            <div className="mx-auto max-w-[1400px] px-6 pt-5">
              <div className="mb-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0047AB]">
                  {crumb.code}. {crumb.parentEn}
                </div>
                <h1 className="mt-1 text-[22px] font-bold text-[#0f172a]">{crumb.title}</h1>
                {crumb.description ? (
                  <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[#64748b]">{crumb.description}</p>
                ) : null}
              </div>
            </div>
          )}

          {content ? (
            htmlReport ? (
              content
            ) : reportTab ? (
              <div className="min-h-0 flex-1 overflow-auto">{content}</div>
            ) : (
              content
            )
          ) : (
            <div className="mx-auto max-w-[1400px] px-6 pb-8">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(group?.children ?? []).map((child) => {
                  const active = child.id === current;
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => go(child.id)}
                      className={`rounded-2xl border p-5 text-left transition ${
                        active
                          ? "border-[#0047AB] bg-[#eef4ff] shadow-[0_8px_24px_rgba(0,71,171,0.12)]"
                          : "border-[#d9e2f1] bg-white hover:border-[#93b4e8]"
                      }`}
                    >
                      <div className={`text-[14px] font-bold ${active ? "text-[#0047AB]" : "text-[#0f172a]"}`}>
                        {child.label}
                      </div>
                      <div className="mt-2 text-[13px] leading-relaxed text-[#64748b]">{child.description}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-dashed border-[#bcd0f0] bg-white px-6 py-8 text-center">
                <div className="text-[14px] font-semibold text-[#0f172a]">Module đang được xây dựng</div>
                <p className="mt-1 text-[13px] text-[#64748b]">
                  Các chức năng đã sẵn sàng: Hồ sơ nhân sự, Hồ sơ thợ hàn, Danh sách khóa đào tạo, Quản lý chứng chỉ, Tra cứu lịch sử đào tạo.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
