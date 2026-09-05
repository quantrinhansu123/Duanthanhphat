"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ChartLineUp,
  Clock,
  GearSix,
  Warning,
  Wrench,
} from "@/components/icons";
import { useReportFilters } from "@/contexts/ReportFilterContext";
import { machines as seedMachines, type Machine } from "@/data/machines";
import { useWeldReportData } from "@/hooks/useWeldReportData";
import { loadMachineCatalog } from "@/lib/machineCatalogDb";
import {
  loadMachineReportSummary,
  type MachineReportSummary,
} from "@/lib/machineRunSchedulesDb";
import {
  filterWeldReportRows,
  groupWeldRows,
  machineForRow,
} from "@/lib/weldReportData";

const MACHINES_RECOMMENDED = [
  {
    id: "kcm007-01",
    code: "KCM007-01",
    name: "Tổ hợp máy hàn KCM007",
    badge: "Ưu tiên cao",
    badgeBg: "bg-rose-50 text-rose-700 border border-rose-200",
    image: "/may-han/kcm007.jpg",
    plant: "Trung tâm Cơ giới TCW",
    welds: "2.450 mối",
    hoursSinceMaint: "412 h",
    progressPct: 48,
    progressColor: "bg-amber-500",
    budget: "6.500.000đ",
  },
  {
    id: "un5-150zc2-01",
    code: "UN5-150ZC2-01",
    name: "Máy hàn UN5-150ZC2-C6",
    badge: "Theo dõi",
    badgeBg: "bg-amber-50 text-amber-700 border border-amber-200",
    image: "/may-han/un5-150zc2-c6-main.jpg",
    plant: "Nhà máy Hà Nội",
    welds: "1.820 mối",
    hoursSinceMaint: "355 h",
    progressPct: 35,
    progressColor: "bg-amber-500",
    budget: "7.800.000đ",
  },
  {
    id: "kcm007-02",
    code: "KCM007-02",
    name: "Tổ hợp KCM007 (Tổ 2)",
    badge: "Định kỳ",
    badgeBg: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    image: "/may-han/kcm007.jpg",
    plant: "Xưởng bảo trì Đà Nẵng",
    welds: "1.210 mối",
    hoursSinceMaint: "190 h",
    progressPct: 60,
    progressColor: "bg-emerald-500",
    budget: "5.000.000đ",
  },
];

type MachineStatus = "Đang làm việc" | "Sẵn sàng" | "Bảo trì" | "Hỏng";
type MachineStatusFilter = "Tất cả máy" | "Cần bảo trì" | MachineStatus;

const MACHINE_STATUS_OPTIONS: MachineStatusFilter[] = [
  "Tất cả máy",
  "Cần bảo trì",
  "Đang làm việc",
  "Sẵn sàng",
  "Bảo trì",
  "Hỏng",
];

const MACHINE_STATUS_STYLES: Record<MachineStatus, string> = {
  "Đang làm việc": "border-blue-200 bg-blue-50 text-[#0047AB]",
  "Sẵn sàng": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Bảo trì": "border-amber-200 bg-amber-50 text-amber-700",
  "Hỏng": "border-rose-200 bg-rose-50 text-rose-700",
};

function normalizeMachineStatus(status: string): MachineStatus {
  if (status === "Đang làm việc" || status === "Bảo trì" || status === "Hỏng") return status;
  if (status === "Hoạt động") return "Đang làm việc";
  return "Sẵn sàng";
}

/** Máy chưa gán dự án (trống / dấu gạch). */
function isUnassignedProject(project?: string | null) {
  const value = project?.trim() ?? "";
  return !value || value === "—" || value === "-";
}

export default function MachineReportDashboard() {
  const { rows, loading, error } = useWeldReportData();
  const { appliedFilters } = useReportFilters();
  const [activeSlide, setActiveSlide] = useState(0);
  const [machineSummary, setMachineSummary] = useState<MachineReportSummary[]>([]);
  const [machineCatalog, setMachineCatalog] = useState<Machine[]>(seedMachines);
  const [machineSummaryError, setMachineSummaryError] = useState("");
  const [machineStatusFilter, setMachineStatusFilter] = useState<MachineStatusFilter>("Tất cả máy");

  useEffect(() => {
    let active = true;
    Promise.all([
      loadMachineReportSummary(),
      loadMachineCatalog(),
    ])
      .then(([summary, catalog]) => {
        if (!active) return;
        setMachineSummary(summary);
        setMachineCatalog(catalog.machines);
        if (catalog.error) setMachineSummaryError(catalog.error);
      })
      .catch((loadError) => {
        if (active) setMachineSummaryError(loadError instanceof Error ? loadError.message : "Không tải được số giờ máy");
      });
    return () => {
      active = false;
    };
  }, []);
  const selectedRows = useMemo(
    () => filterWeldReportRows(rows, appliedFilters),
    [rows, appliedFilters],
  );
  const machineStats = useMemo(() => {
    return groupWeldRows(selectedRows, machineForRow).map((group) => ({
      code: group.name,
      total: group.total,
      errors: group.errors,
    }));
  }, [selectedRows]);
  const machineSummaryByCode = new Map<string, MachineReportSummary>(
    machineSummary.map((item) => [item.machineCode, item]),
  );
  const machineStatsByCode = new Map<string, (typeof machineStats)[number]>(
    machineStats.map((item) => [item.code, item]),
  );
  const machinesRecommended = MACHINES_RECOMMENDED.map((machine) => ({
    ...machine,
    welds: `${(machineStatsByCode.get(machine.code)?.total ?? 0).toLocaleString("vi-VN")} mối`,
    hoursSinceMaint: `${(machineSummaryByCode.get(machine.code)?.operatingHours ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} h`,
  }));
  const machineCatalogByCode = new Map(machineCatalog.map((machine) => [machine.code, machine]));
  const machineCodes = Array.from(new Set([
    ...machineCatalog.map((machine) => machine.code),
    ...machineSummary.map((machine) => machine.machineCode),
  ]));
  const machinePerformance = machineCodes.map((code) => {
    const machine = machineCatalogByCode.get(code);
    const stat = machineStatsByCode.get(code);
    const report = machineSummaryByCode.get(code);
    const errorRate = stat?.total ? ((stat.errors / stat.total) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : "0";
    const status = normalizeMachineStatus(report?.status ?? machine?.status ?? "Sẵn sàng");
    const currentProject = machine?.currentProject ?? "";
    const operatingHours = report?.operatingHours ?? 0;
    return {
      code,
      name: report?.machineName ?? machine?.name ?? code,
      location: report?.location || machine?.location || "Chưa cập nhật",
      currentProject,
      welds: (stat?.total ?? 0).toLocaleString("vi-VN"),
      operatingHours,
      hours: operatingHours.toLocaleString("vi-VN", { maximumFractionDigits: 2 }),
      errorRate: `${errorRate}%`,
      status,
    };
  });
  const filteredMachinePerformance = machinePerformance.filter((machine) => {
    if (machineStatusFilter === "Tất cả máy") return true;
    if (machineStatusFilter === "Cần bảo trì") return machine.status === "Bảo trì" || machine.status === "Hỏng";
    return machine.status === machineStatusFilter;
  });
  const maxOperatingHours = Math.max(...filteredMachinePerformance.map((machine) => machine.operatingHours), 1);
  const operatingMachines = machinePerformance.filter((machine) => machine.status === "Đang làm việc").length;
  const availableMachines = machinePerformance.filter(
    (machine) => isUnassignedProject(machine.currentProject) && machine.status !== "Bảo trì",
  ).length;
  const machinesInMaintenance = machinePerformance.filter((machine) => machine.status === "Bảo trì").length;
  const totalOperatingHours = machineSummary.reduce((total, machine) => total + machine.operatingHours, 0);
  const dataError = error || machineSummaryError;
  const maintenanceDue = machinePerformance.filter((machine) => machine.status === "Bảo trì" || machine.status === "Hỏng").length;
  const highPriorityMaintenance = machinePerformance.filter((machine) => machine.status === "Hỏng").length;

  return (
    <div className="w-full min-w-0 px-3 sm:px-5 lg:px-6 py-3 sm:py-4 flex flex-col gap-4 text-slate-700 text-sm">
      <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${dataError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-[#0047AB]"}`}>
        {dataError
          ? `Không tải đủ dữ liệu Supabase: ${dataError}`
          : loading
            ? "Đang tải dữ liệu Supabase…"
            : "Số mối hàn tự động tính từ nhật ký đã chọn máy · Số giờ tự động tính từ lịch chạy máy"}
      </div>
      {/* 1. Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
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
              <span className="text-slate-400 font-normal">Theo trạng thái danh mục máy</span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0047AB] border border-blue-200/80">
            <GearSix size={24} weight="fill" aria-hidden />
          </div>
        </div>

        {/* Card 2: Số máy khả dụng */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-700">
              SỐ MÁY KHẢ DỤNG
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
              {availableMachines}
            </div>
            <div className="mt-2.5 text-xs text-emerald-700 font-medium">
              <span className="text-slate-400 font-normal">
                Chưa gán dự án và không bảo trì
              </span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 border border-sky-200">
            <ChartLineUp size={24} weight="fill" aria-hidden />
          </div>
        </div>

        {/* Card 3: Số máy đang bảo trì */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
              SỐ MÁY ĐANG BẢO TRÌ
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
              {machinesInMaintenance}
            </div>
            <div className="mt-2.5 text-xs text-slate-400 font-normal">
              Theo trạng thái Bảo trì
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
            <Wrench size={24} weight="fill" aria-hidden />
          </div>
        </div>

        {/* Card 4: Máy đến hạn bảo trì */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-700">
              MÁY ĐẾN HẠN BẢO TRÌ
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
              {maintenanceDue}
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-700 shadow-2xs">
                {highPriorityMaintenance} ưu tiên cao
              </span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
            <Warning size={24} weight="fill" aria-hidden />
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

          {/* Card: Biểu đồ giờ chạy máy */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                  Biểu đồ giờ chạy máy
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Tổng hợp tự động từ các dòng lịch chạy máy
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Bộ lọc bảo trì máy
                <select
                  value={machineStatusFilter}
                  onChange={(event) => setMachineStatusFilter(event.target.value as MachineStatusFilter)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-hidden transition-colors hover:border-slate-400 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                >
                  {MACHINE_STATUS_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 space-y-3">
              {filteredMachinePerformance.map((machine) => (
                <div key={machine.code} className="grid grid-cols-[84px_minmax(0,1fr)_64px] items-center gap-3">
                  <div className="truncate font-mono text-xs font-bold text-[#0047AB]" title={machine.name}>
                    {machine.code}
                  </div>
                  <div className="h-7 overflow-hidden rounded-md bg-slate-100">
                    <div
                      className="h-full min-w-0 rounded-md bg-[#0047AB] transition-all"
                      style={{ width: machine.operatingHours > 0 ? `${Math.max((machine.operatingHours / maxOperatingHours) * 100, 5)}%` : "0%" }}
                      title={`${machine.code}: ${machine.hours} giờ`}
                    />
                  </div>
                  <div className="text-right font-mono text-xs font-bold tabular-nums text-slate-800">
                    {machine.hours} giờ
                  </div>
                </div>
              ))}
              {filteredMachinePerformance.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-xs text-slate-500">
                  Không có máy phù hợp với bộ lọc.
                </div>
              )}
            </div>
          </div>

          {/* Card: Hiệu suất theo máy */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                Hiệu suất theo máy
              </div>
              <span className="text-xs font-medium text-slate-500">{filteredMachinePerformance.length} máy</span>
            </div>
            <div className="table-scroll overflow-x-auto mt-3.5">
              <div className="min-w-[660px]">
                <div className="grid grid-cols-[1.1fr_1.1fr_0.9fr_0.8fr_0.9fr_1.1fr] gap-x-2 border-b border-slate-200 bg-slate-50/80 p-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <div>Máy</div>
                  <div>Vị trí hiện tại</div>
                  <div>Mối hàn</div>
                  <div>Giờ chạy</div>
                  <div>Tỷ lệ lỗi</div>
                  <div className="text-right">Trạng thái</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredMachinePerformance.map((m) => (
                    <div
                      key={m.code}
                      className="grid grid-cols-[1.1fr_1.1fr_0.9fr_0.8fr_0.9fr_1.1fr] gap-x-2 items-center py-2.5 px-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="font-semibold text-[#0047AB] font-mono">
                        {m.code}
                      </div>
                      <div className="truncate" title={m.location}>{m.location}</div>
                      <div className="font-mono tabular-nums">{m.welds}</div>
                      <div className="font-mono tabular-nums">{m.hours}</div>
                      <div className="font-mono tabular-nums">{m.errorRate}</div>
                      <div className="text-right">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${MACHINE_STATUS_STYLES[m.status]}`}>
                          {m.status}
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
        </div>

        {/* Right Column (320px) */}
        <div className="flex flex-col gap-4">
          {/* Card: Tình trạng thiết bị */}
          <div className="rounded-xl border-2 border-[#0047AB]/25 bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#0047AB] border border-blue-100 shadow-2xs">
                <GearSix size={16} weight="fill" aria-hidden />
              </span>
              <span>Tình trạng thiết bị</span>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs">
                  <Clock size={18} weight="fill" aria-hidden />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">
                    Tổng giờ vận hành đã ghi nhận
                  </div>
                  <div className="mt-0.5 text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900">
                    {totalOperatingHours.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} giờ
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200 shadow-2xs">
                  <Warning size={18} weight="fill" aria-hidden />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">Máy sẵn sàng phân công</div>
                  <div className="mt-0.5 text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900">{availableMachines} máy</div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs">
                  <Wrench size={18} weight="fill" aria-hidden />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">
                    Sắp đến hạn bảo trì
                  </div>
                  <div className="mt-0.5 text-base sm:text-lg font-bold font-mono tabular-nums text-rose-700">{maintenanceDue} máy</div>
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
                    Máy KCM007-01
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Ga Hà Nội
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-700 font-mono">
                    15/05/2026
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-rose-700 font-mono">
                    Còn 10 ngày
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-semibold text-[#0047AB]">
                    Máy UN5-150ZC2-01
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Depot ga Hà Nội
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-700 font-mono">
                    20/05/2026
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-amber-700 font-mono">
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
