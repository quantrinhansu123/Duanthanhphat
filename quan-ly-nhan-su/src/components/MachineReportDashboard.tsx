"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useReportFilters } from "@/contexts/ReportFilterContext";
import { useWeldReportData } from "@/hooks/useWeldReportData";
import {
  buildSyntheticDailySeries,
  filterWeldReportRows,
  groupWeldRows,
  machineForRow,
  REPORT_MACHINES,
  summarizeWeldRows,
} from "@/lib/weldReportData";

const MACHINES_RECOMMENDED = [
  {
    id: "k922-1",
    name: "Máy hàn K922-1",
    badge: "Ưu tiên cao",
    badgeBg: "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]",
    image: "/may-han/k920.svg",
    plant: "Nhà máy Cổ Loa",
    welds: "8.520 mối",
    hoursSinceMaint: "412 h",
    progressPct: 48,
    progressColor: "bg-[#f59e0b]",
    budget: "6.500.000đ",
  },
  {
    id: "k922-2",
    name: "Máy hàn K922-2",
    badge: "Theo dõi",
    badgeBg: "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]",
    image: "/may-han/ams60.svg",
    plant: "Hạ Long Xanh",
    welds: "7.840 mối",
    hoursSinceMaint: "355 h",
    progressPct: 35,
    progressColor: "bg-[#f59e0b]",
    budget: "7.800.000đ",
  },
  {
    id: "k920",
    name: "Máy hàn K920",
    badge: "Định kỳ",
    badgeBg: "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
    image: "/may-han/geo.svg",
    plant: "Nhà máy Cổ Loa",
    welds: "2.160 mối",
    hoursSinceMaint: "190 h",
    progressPct: 60,
    progressColor: "bg-[#16a34a]",
    budget: "5.000.000đ",
  },
];

const MACHINE_PERFORMANCE = [
  {
    code: "K922-1",
    plant: "Cổ Loa",
    welds: "8.520",
    today: "62",
    errorRate: "0,18%",
    avail: 96,
    availColor: "bg-[#16a34a]",
  },
  {
    code: "K922-2",
    plant: "Hạ Long Xanh",
    welds: "7.840",
    today: "51",
    errorRate: "0,25%",
    avail: 93,
    availColor: "bg-[#16a34a]",
  },
  {
    code: "K920",
    plant: "Cổ Loa",
    welds: "2.160",
    today: "13",
    errorRate: "0,31%",
    avail: 88,
    availColor: "bg-[#f59e0b]",
  },
];

const CALIBRATION_DOCS = [
  {
    title: "Hiệu chuẩn\nmáy K922-1",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.8">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Nhật ký bảo trì\ntháng 05/2024",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.8">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    title: "Kiểm định áp lực\nđầu kẹp",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    title: "Biên bản thay\nvật tư tiêu hao",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.8">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
];

export default function MachineReportDashboard() {
  const { rows, loading, error } = useWeldReportData();
  const { appliedFilters } = useReportFilters();
  const [activeSlide, setActiveSlide] = useState(0);
  const selectedRows = useMemo(
    () => filterWeldReportRows(rows, appliedFilters),
    [rows, appliedFilters],
  );
  const summary = useMemo(() => summarizeWeldRows(selectedRows), [selectedRows]);
  const today = useMemo(
    () => buildSyntheticDailySeries(summary.total, summary.total).at(-1) ?? 0,
    [summary.total],
  );
  const machineStats = useMemo(() => {
    const grouped = new Map(groupWeldRows(selectedRows, machineForRow).map((group) => [group.name, group]));
    return REPORT_MACHINES.map((code) => {
      const group = grouped.get(code);
      return {
        code,
        total: group?.total ?? 0,
        errors: group?.errors ?? 0,
      };
    });
  }, [selectedRows]);
  const machinesRecommended = MACHINES_RECOMMENDED.map((machine, index) => ({
    ...machine,
    welds: `${(machineStats[index]?.total ?? 0).toLocaleString("vi-VN")} mối`,
  }));
  const machinePerformance = MACHINE_PERFORMANCE.map((machine, index) => {
    const stat = machineStats[index];
    const machineToday = summary.total > 0 ? Math.round(today * ((stat?.total ?? 0) / summary.total)) : 0;
    const errorRate = stat?.total ? ((stat.errors / stat.total) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : "0";
    return {
      ...machine,
      welds: (stat?.total ?? 0).toLocaleString("vi-VN"),
      today: machineToday.toLocaleString("vi-VN"),
      errorRate: `${errorRate}%`,
    };
  });
  const operatingMachines = machineStats.filter((machine) => machine.total > 0).length;

  return (
    <div className="w-full min-w-0 px-3 sm:px-5 lg:px-6 py-3 sm:py-4 flex flex-col gap-4 text-slate-700 text-sm">
      <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-[#0047AB]"}`}>
        {error
          ? `Không tải được Supabase: ${error}`
          : loading
            ? "Đang tải dữ liệu Supabase…"
            : "Sản lượng lấy từ Supabase · Phân bổ máy và thông số ngày là mô phỏng"}
      </div>
      {/* 1. Top 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Số máy đang vận hành */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
              SỐ MÁY ĐANG VẬN HÀNH
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
              {operatingMachines}
            </div>
            <div className="mt-2.5 text-xs text-emerald-700 font-medium">
              ↑ 8,3% <span className="text-slate-400 font-normal">so với tuần trước</span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0047AB] border border-blue-200/80">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8 2.8l-.1.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </div>
        </div>

        {/* Card 2: Tỷ lệ khả dụng bình quân */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-teal-700">
              TỶ LỆ KHẢ DỤNG BÌNH QUÂN
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
              92,3%
            </div>
            <div className="mt-2.5 text-xs text-emerald-700 font-medium">
              ↑ 1,4% <span className="text-slate-400 font-normal">so với kỳ trước</span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 13h4l3-8 4 14 3-6h4v-2h-3l-3 6-4-14-3 8H3v2z" />
            </svg>
          </div>
        </div>

        {/* Card 3: Máy đến hạn bảo trì */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
              MÁY ĐẾN HẠN BẢO TRÌ
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
              3
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-700 shadow-2xs">
                1 ưu tiên cao
              </span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 2. Main 2-column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        {/* Left Column */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Card: Máy được đề xuất bảo trì */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                Máy được đề xuất bảo trì
              </div>
              <button type="button" className="text-xs sm:text-sm font-semibold text-[#0047AB] hover:underline cursor-pointer">
                Xem tất cả →
              </button>
            </div>

            <div className="mt-3.5 flex items-center gap-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 flex-1 min-w-0">
                {machinesRecommended.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-slate-200 overflow-hidden bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div className="relative h-[135px] bg-slate-50 flex items-center justify-center p-3 border-b border-slate-100">
                      <div className="relative h-full w-full">
                        <Image
                          src={m.image}
                          alt={m.name}
                          fill
                          className="object-contain"
                          sizes="(max-width: 768px) 100vw, 300px"
                        />
                      </div>
                      <span
                        className={`absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-2xs ${m.badgeBg}`}
                      >
                        {m.badge}
                      </span>
                    </div>
                    <div className="p-3.5">
                      <div className="text-sm font-bold text-slate-900">
                        {m.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 leading-relaxed">
                        {m.plant} · {m.welds}
                        <br />
                        Giờ chạy từ lần bảo trì: <span className="font-mono text-slate-700 font-medium">{m.hoursSinceMaint}</span>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.progressColor}`}
                            style={{ width: `${m.progressPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 font-mono tabular-nums">
                          {m.progressPct}%
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-600">
                        Dự toán{" "}
                        <span className="font-bold text-slate-900 font-mono">
                          {m.budget}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="mt-3 w-full rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] py-2 text-center text-xs font-semibold text-white transition-all cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        Lên lịch bảo trì
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:flex flex-col gap-2 shrink-0 w-7">
                <button
                  type="button"
                  onClick={() => setActiveSlide((v) => Math.max(0, v - 1))}
                  disabled={activeSlide === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-[#0047AB] hover:text-[#0047AB] hover:bg-blue-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                  aria-label="Previous"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSlide((v) => Math.min(machinesRecommended.length - 1, v + 1))}
                  disabled={activeSlide >= machinesRecommended.length - 1}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-[#0047AB] hover:text-[#0047AB] hover:bg-blue-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                  aria-label="Next"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          {/* Card: Hiệu suất theo máy */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              Hiệu suất theo máy
            </div>
            <div className="table-scroll overflow-x-auto mt-3.5">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-[1.1fr_1.1fr_0.9fr_0.8fr_0.9fr_1.1fr] gap-x-2 border-b border-slate-200 bg-slate-50/80 p-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <div>Máy</div>
                  <div>Nhà máy</div>
                  <div>Mối hàn</div>
                  <div>Hôm nay</div>
                  <div>Tỷ lệ lỗi</div>
                  <div className="text-right">Khả dụng</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {machinePerformance.map((m) => (
                    <div
                      key={m.code}
                      className="grid grid-cols-[1.1fr_1.1fr_0.9fr_0.8fr_0.9fr_1.1fr] gap-x-2 items-center py-2.5 px-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="font-semibold text-[#0047AB] font-mono">
                        {m.code}
                      </div>
                      <div>{m.plant}</div>
                      <div className="font-mono tabular-nums">{m.welds}</div>
                      <div className="font-mono tabular-nums">{m.today}</div>
                      <div className="font-mono tabular-nums">{m.errorRate}</div>
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-[62px] rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.availColor}`}
                            style={{ width: `${m.avail}%` }}
                          />
                        </div>
                        <span className="w-[30px] text-right text-xs font-mono font-semibold tabular-nums">
                          {m.avail}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 text-xs sm:text-sm text-[#0047AB] font-semibold">
              <button type="button" className="hover:underline cursor-pointer">
                Xem toàn bộ máy
              </button>
              <span className="text-slate-400">→</span>
            </div>
          </div>

          {/* Card: Biên bản hiệu chuẩn & kiểm định */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                Biên bản hiệu chuẩn &amp; kiểm định
              </div>
              <button type="button" className="text-xs sm:text-sm font-semibold text-[#0047AB] hover:underline cursor-pointer">
                Xem tất cả →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3.5">
              {CALIBRATION_DOCS.map((doc, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 p-3 text-center bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div className="h-[72px] rounded-lg border border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
                    {doc.icon}
                  </div>
                  <div className="mt-2 text-xs text-slate-700 leading-snug whitespace-pre-line font-medium min-h-[34px]">
                    {doc.title}
                  </div>
                  <div className="mt-2.5 flex gap-1.5">
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:text-[#0047AB] transition-colors cursor-pointer shadow-2xs"
                    >
                      Xem
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:text-[#0047AB] transition-colors cursor-pointer shadow-2xs"
                    >
                      Tải PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (320px) */}
        <div className="flex flex-col gap-4">
          {/* Card: Tình trạng thiết bị */}
          <div className="rounded-xl border-2 border-[#0047AB]/25 bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#0047AB] border border-blue-100 shadow-2xs">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                </svg>
              </span>
              <span>Tình trạng thiết bị</span>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">
                    Tổng giờ vận hành tháng này
                  </div>
                  <div className="mt-0.5 text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900">
                    1.284 giờ
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200 shadow-2xs">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">Số lần dừng máy</div>
                  <div className="mt-0.5 text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900">6 lần</div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">
                    Sắp đến hạn bảo trì
                  </div>
                  <div className="mt-0.5 text-base sm:text-lg font-bold font-mono tabular-nums text-rose-700">3 máy</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] py-2.5 text-center text-xs sm:text-sm font-semibold text-white transition-all duration-150 cursor-pointer shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Tạo lệnh bảo trì
            </button>
          </div>

          {/* Card: Lịch bảo trì sắp tới */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              Lịch bảo trì sắp tới
            </div>
            <div className="mt-3.5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-semibold text-[#0047AB]">
                    Máy K922-1
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Nhà máy Cổ Loa
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-700 font-mono">
                    15/07/2024
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-rose-700 font-mono">
                    Còn 10 ngày
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-semibold text-[#0047AB]">
                    Máy K922-2
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Hạ Long Xanh
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-700 font-mono">
                    20/07/2024
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-rose-700 font-mono">
                    Còn 15 ngày
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-semibold text-[#0047AB]">
                    Hiệu chuẩn máy UT
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Tổ kiểm tra chất lượng
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-700 font-mono">
                    05/08/2024
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-amber-700 font-mono">
                    Còn 31 ngày
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Ngân sách bảo trì định kỳ */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              Ngân sách bảo trì định kỳ
            </div>
            <div className="mt-3 text-xs text-slate-500 font-medium">Hạn mức tháng</div>
            <div className="mt-0.5 text-lg sm:text-xl font-bold text-slate-900 font-mono">
              20.000.000đ{" "}
              <span className="text-xs font-normal text-slate-400 font-sans">/ tháng</span>
            </div>
            <div className="mt-3 text-xs text-slate-600 leading-relaxed">
              Tự động giải ngân theo lịch bảo trì
              <br />
              Ngày thanh toán: 05 hằng tháng
              <br />
              Nguồn chi: Vietcombank **** 1234
            </div>
            <div className="mt-3.5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-300 py-1.5 text-center text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer shadow-2xs"
              >
                Tạm dừng
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-300 py-1.5 text-center text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer shadow-2xs"
              >
                Hủy
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] py-1.5 text-center text-xs font-semibold text-white transition-colors cursor-pointer shadow-xs"
              >
                Điều chỉnh
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
