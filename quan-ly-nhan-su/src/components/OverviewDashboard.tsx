"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarBlank,
  CalendarCheck,
  ChartBar,
  ChartLineUp,
  CheckCircle,
  XCircle,
} from "@/components/icons";
import { useReportFilters } from "@/contexts/ReportFilterContext";
import { useProjectsData } from "@/hooks/useProjectsData";
import { useWeldReportData } from "@/hooks/useWeldReportData";
import {
  buildDailyJournalSeries,
  buildDonutArcs,
  filterWeldReportRows,
  getJournalRowDateIso,
  groupJournalErrorReasons,
  groupJournalRows,
  machineForRow,
  REPORT_MACHINES,
  resolveChartDateRange,
  summarizeJournalRows,
} from "@/lib/weldReportData";

type ChartDayPoint = {
  idx: number;
  dayOffset: number;
  dateShort: string;
  dateFull: string;
  daily: number;
  dailyTarget: number;
  cumActual: number;
  cumTarget: number;
  cx: number;
  cy: number;
  cumCy: number;
};

const PROJECT_COLORS = ["#0047AB", "#0284c7", "#10b981", "#8b5cf6", "#f59e0b"];

function fmt(n: number) {
  return Math.round(n).toLocaleString("vi-VN");
}

function pctComma(n: number, total: number) {
  if (!total) return "0%";
  return (
    ((n / total) * 100)
      .toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      .replace(".", ",") + "%"
  );
}

function gaugeDash(pctVal: number) {
  const clamped = Math.min(100, Math.max(0, pctVal));
  const arcLen = Math.PI * 84;
  const filled = (clamped / 100) * arcLen;
  return `${filled.toFixed(2)} ${arcLen.toFixed(2)}`;
}

function viDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("vi-VN");
}

function viDateShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function sampleChartLabels(labels: string[], maxCount: number) {
  if (labels.length <= maxCount) return labels.map((text) => ({ text }));
  const picked: { text: string }[] = [];
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.round((i * (labels.length - 1)) / (maxCount - 1));
    picked.push({ text: labels[idx] });
  }
  return picked;
}

export default function OverviewDashboard() {
  const { rows, loading, error } = useWeldReportData();
  const { projects } = useProjectsData();
  const { appliedFilters } = useReportFilters();

  const [chartViewMode, setChartViewMode] = useState<"daily" | "cumulative">("daily");
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedDayIndex(null);
  }, [appliedFilters, chartViewMode]);

  const selectedRows = useMemo(
    () => filterWeldReportRows(rows, appliedFilters),
    [rows, appliedFilters],
  );
  const summary = useMemo(() => summarizeJournalRows(selectedRows), [selectedRows]);
  const chartDateRange = useMemo(
    () => resolveChartDateRange(appliedFilters.dateFrom, appliedFilters.dateTo),
    [appliedFilters.dateFrom, appliedFilters.dateTo],
  );
  const dailySeries = useMemo(
    () => buildDailyJournalSeries(selectedRows, chartDateRange.from, chartDateRange.to),
    [selectedRows, chartDateRange.from, chartDateRange.to],
  );
  const dailyValues = useMemo(() => dailySeries.map((point) => point.value), [dailySeries]);
  const selectedProjects = useMemo(
    () => projects.filter((project) =>
      appliedFilters.projects.length === 0 || appliedFilters.projects.includes(project.name),
    ),
    [appliedFilters.projects, projects],
  );
  const dailyTargets = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const project of selectedProjects) {
      for (const row of project.theoreticalProgress ?? []) {
        if (row.ngay < chartDateRange.from || row.ngay > chartDateRange.to) continue;
        byDate.set(row.ngay, (byDate.get(row.ngay) ?? 0) + row.so_moi_han);
      }
    }
    return dailySeries.map((point) => byDate.get(point.date) ?? 0);
  }, [chartDateRange.from, chartDateRange.to, dailySeries, selectedProjects]);
  const plannedTarget = useMemo(
    () => selectedProjects.reduce(
      (sum, project) => sum + (project.theoreticalProgress ?? []).reduce(
        (projectSum, row) => row.ngay >= appliedFilters.dateFrom && row.ngay <= appliedFilters.dateTo
          ? projectSum + row.so_moi_han
          : projectSum,
        0,
      ),
      0,
    ),
    [appliedFilters.dateFrom, appliedFilters.dateTo, selectedProjects],
  );
  const todayIso = new Date().toLocaleDateString("en-CA");
  const yesterdayDate = new Date(`${todayIso}T00:00:00`);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayIso = yesterdayDate.toLocaleDateString("en-CA");
  const todayTotal = selectedRows.reduce(
    (sum, row, index) => getJournalRowDateIso(row, index) === todayIso ? sum + row.so_luong_thuc_hien : sum,
    0,
  );
  const yesterdayTotal = selectedRows.reduce(
    (sum, row, index) => getJournalRowDateIso(row, index) === yesterdayIso ? sum + row.so_luong_thuc_hien : sum,
    0,
  );
  const latestDailyPoint = [...dailySeries].reverse().find((point) => point.value > 0);
  const errorReasonRows = useMemo(() => groupJournalErrorReasons(selectedRows), [selectedRows]);

  const total = summary.total;
  const passed = summary.passed;
  const failed = summary.errors;
  const pending = 0;
  const target = plannedTarget > 0 ? plannedTarget : total;
  const plannedDays = selectedProjects.reduce(
    (sum, project) => sum + (project.theoreticalProgress ?? []).filter(
      (row) => row.ngay >= appliedFilters.dateFrom && row.ngay <= appliedFilters.dateTo,
    ).length,
    0,
  );
  const quota = plannedDays > 0 ? plannedTarget / plannedDays : dailySeries.length > 0 ? total / dailySeries.length : 0;

  const progressPct = (target > 0 ? (total / target) * 100 : 0)
    .toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .replace(".", ",");
  const progressPctNum = target > 0 ? (total / target) * 100 : 0;

  const chart = useMemo(() => {
    const slice = dailyValues;
    const count = slice.length;
    const chartRangeLabel = `${viDate(chartDateRange.from)} – ${viDate(chartDateRange.to)} · sản lượng/ngày`;

    if (count === 0) {
      return {
        chartRangeLabel,
        bars: [],
        dots: [],
        linePath: "",
        areaPath: "",
        chartLabels: [],
        cumBars: [],
        cumPts: [],
        cumLinePath: "",
        cumAreaPath: "",
        totalCum: 0,
        targetCumPts: [],
        targetCumLinePath: "",
        totalTargetCum: 0,
        targetLinePath: "",
        maxCumVal: 3000,
        dayPoints: [] as ChartDayPoint[],
        maxVal: 100,
      };
    }

    const targetSlice = dailyTargets;
    const maxVal = Math.max(10, Math.ceil(Math.max(...slice, ...targetSlice, 1) / 10) * 10);
    const plotH = 190;
    const padX = 14;
    const plotW = 500 - padX * 2;
    const step = count > 1 ? plotW / (count - 1) : 0;

    const bars = slice.map((val, idx) => {
      const scaledVal = val;
      const h = Math.min(plotH - 8, Math.max(4, (scaledVal / maxVal) * plotH));
      const cx = count === 1 ? 250 : padX + idx * step;
      const x = cx - 2.5;
      const y = plotH - h;
      return { x, y, h, val: scaledVal };
    });

    const pts = slice.map((val, idx) => {
      const scaledVal = val;
      const cx = count === 1 ? 250 : padX + idx * step;
      const cy = Math.max(6, plotH - (scaledVal / maxVal) * plotH);
      return { cx, cy, val: scaledVal };
    });

    let linePath = "";
    if (pts.length === 1) {
      linePath = `M ${pts[0].cx} ${pts[0].cy}`;
    } else if (pts.length > 1) {
      linePath = `M ${pts[0].cx} ${pts[0].cy} ` + pts.slice(1).map((p) => `L ${p.cx} ${p.cy}`).join(" ");
    }

    const cumValues = slice.map((_, index) =>
      slice.slice(0, index + 1).reduce((sum, value) => sum + value, 0),
    );
    const totalCum = cumValues[cumValues.length - 1] || 0;

    const targetPts = targetSlice.map((value, idx) => {
      const cx = count === 1 ? 250 : padX + idx * step;
      const cy = Math.max(6, plotH - (value / maxVal) * plotH);
      return { cx, cy, val: value };
    });
    const targetLinePath = targetPts.length > 0
      ? `M ${targetPts[0].cx} ${targetPts[0].cy} ${targetPts.slice(1).map((point) => `L ${point.cx} ${point.cy}`).join(" ")}`
      : "";
    const targetCumValues = targetSlice.map((_, index) =>
      targetSlice.slice(0, index + 1).reduce((sum, value) => sum + value, 0),
    );
    const totalTargetCum = targetCumValues[targetCumValues.length - 1] || 0;

    const maxCumVal = Math.max(500, Math.ceil(Math.max(totalCum, totalTargetCum, ...cumValues, ...targetCumValues) / 500) * 500);

    const cumBars = cumValues.map((val, idx) => {
      const h = Math.min(plotH - 8, Math.max(4, (val / maxCumVal) * plotH));
      const cx = count === 1 ? 250 : padX + idx * step;
      const x = cx - 2.5;
      const y = plotH - h;
      return { x, y, h, val };
    });

    const cumPts = cumValues.map((cumVal, idx) => {
      const cx = count === 1 ? 250 : padX + idx * step;
      const cy = Math.max(6, plotH - (cumVal / maxCumVal) * plotH);
      return { cx, cy, val: cumVal };
    });

    let cumLinePath = "";
    if (cumPts.length === 1) {
      cumLinePath = `M ${cumPts[0].cx} ${cumPts[0].cy}`;
    } else if (cumPts.length > 1) {
      cumLinePath = `M ${cumPts[0].cx} ${cumPts[0].cy} ` + cumPts.slice(1).map((p) => `L ${p.cx} ${p.cy}`).join(" ");
    }

    const targetCumPts = targetCumValues.map((tVal, idx) => {
      const cx = count === 1 ? 250 : padX + idx * step;
      const cy = Math.max(6, plotH - (tVal / maxCumVal) * plotH);
      return { cx, cy, val: tVal };
    });

    let targetCumLinePath = "";
    if (targetCumPts.length === 1) {
      targetCumLinePath = `M ${targetCumPts[0].cx} ${targetCumPts[0].cy}`;
    } else if (targetCumPts.length > 1) {
      targetCumLinePath = `M ${targetCumPts[0].cx} ${targetCumPts[0].cy} ` + targetCumPts.slice(1).map((p) => `L ${p.cx} ${p.cy}`).join(" ");
    }

    const cumMaPts = cumValues.map((_, idx) => {
      const windowStart = Math.max(0, idx - 6);
      const win = cumValues.slice(windowStart, idx + 1);
      const avg = win.reduce((a, b) => a + b, 0) / win.length;
      const cx = count === 1 ? 250 : padX + idx * step;
      const cy = Math.max(6, plotH - (avg / maxCumVal) * plotH);
      return { cx, cy };
    });

    let cumAreaPath = "";
    if (cumMaPts.length > 1) {
      const top = cumMaPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.cx} ${p.cy}`).join(" ");
      const bottom = `L ${cumMaPts[cumMaPts.length - 1].cx} ${plotH} L ${cumMaPts[0].cx} ${plotH} Z`;
      cumAreaPath = `${top} ${bottom}`;
    }

    const maPts = slice.map((_, idx) => {
      const windowStart = Math.max(0, idx - 6);
      const win = slice.slice(windowStart, idx + 1);
      const avg = win.reduce((a, b) => a + b, 0) / win.length;
      const scaledAvg = avg;
      const cx = count === 1 ? 250 : padX + idx * step;
      const cy = Math.max(6, plotH - (scaledAvg / maxVal) * plotH);
      return { cx, cy };
    });

    let areaPath = "";
    if (maPts.length > 1) {
      const top = maPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.cx} ${p.cy}`).join(" ");
      const bottom = `L ${maPts[maPts.length - 1].cx} ${plotH} L ${maPts[0].cx} ${plotH} Z`;
      areaPath = `${top} ${bottom}`;
    }

    const fullLabels = dailySeries.map((point) => viDateShort(point.date));
    const chartLabels = sampleChartLabels(fullLabels, 8);

    const dayPoints: ChartDayPoint[] = slice.map((val, idx) => ({
      idx,
      dayOffset: idx,
      dateShort: viDateShort(dailySeries[idx]?.date ?? chartDateRange.from),
      dateFull: viDate(dailySeries[idx]?.date ?? chartDateRange.from),
      daily: val,
      dailyTarget: targetSlice[idx] ?? 0,
      cumActual: cumValues[idx],
      cumTarget: targetCumValues[idx],
      cx: pts[idx].cx,
      cy: pts[idx].cy,
      cumCy: cumPts[idx].cy,
    }));

    return {
      chartRangeLabel,
      bars,
      dots: pts,
      linePath,
      areaPath,
      chartLabels,
      cumBars,
      cumPts,
      cumLinePath,
      cumAreaPath,
      totalCum,
      targetCumPts,
      targetCumLinePath,
      totalTargetCum,
      targetLinePath,
      maxCumVal,
      dayPoints,
      maxVal,
    };
  }, [chartDateRange, dailySeries, dailyTargets, dailyValues]);

  const selectedDay =
    selectedDayIndex !== null && chart.dayPoints[selectedDayIndex]
      ? chart.dayPoints[selectedDayIndex]
      : null;

  function toggleDaySelection(idx: number) {
    setSelectedDayIndex((prev) => (prev === idx ? null : idx));
  }

  const projectRows = useMemo(() => {
    return groupJournalRows(selectedRows, (row) => row.du_an)
      .sort((a, b) => b.total - a.total)
      .map((row, index) => ({
        name: row.name,
        count: row.total,
        share: total > 0 ? row.total / total : 0,
        color: PROJECT_COLORS[index % PROJECT_COLORS.length],
      }));
  }, [selectedRows, total]);

  const projectDonutArcs = useMemo(
    () => buildDonutArcs(projectRows.map((row) => row.count)),
    [projectRows],
  );

  const statusDonutArcs = useMemo(
    () => buildDonutArcs([passed, pending, failed]),
    [passed, pending, failed],
  );

  const machineRows = useMemo(() => {
    const todayRows = selectedRows.filter(
      (row, index) => getJournalRowDateIso(row, index) === todayIso,
    );
    const todayByMachine = new Map(
      groupJournalRows(todayRows, machineForRow).map((machine) => [machine.name, machine.total]),
    );

    return groupJournalRows(selectedRows, machineForRow)
      .sort((a, b) => REPORT_MACHINES.indexOf(a.name as (typeof REPORT_MACHINES)[number]) - REPORT_MACHINES.indexOf(b.name as (typeof REPORT_MACHINES)[number]))
      .map((machine) => {
        const passRate = machine.total > 0 ? Math.round((machine.passed / machine.total) * 100) : 0;
        return {
          code: machine.name,
          total: fmt(machine.total),
          today: fmt(todayByMachine.get(machine.name) ?? 0),
          errorRate: pctComma(machine.errors, machine.total),
          availLabel: `${passRate}%`,
          availPct: passRate,
          availColor: passRate >= 90 ? "#15803d" : "#d97706",
        };
      });
  }, [selectedRows, todayIso]);

  const statusRows = [
    { name: "Đạt", color: "#15803d", value: fmt(passed), pct: pctComma(passed, total) },
    { name: "Chờ kiểm tra", color: "#d97706", value: fmt(pending), pct: pctComma(pending, total) },
    { name: "Không đạt", color: "#dc2626", value: fmt(failed), pct: pctComma(failed, total) },
  ];

  return (
    <div className="w-full min-w-0 px-3 sm:px-5 lg:px-6 py-3 sm:py-4 flex flex-col gap-4 text-slate-700 text-sm">
      <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-[#0047AB]"}`}>
        {error
          ? `Không tải được Supabase: ${error}`
          : loading
            ? "Đang tải dữ liệu Supabase…"
            : `Nhật ký hàn · ${selectedRows.length} bản ghi · ${fmt(passed)} đạt · ${fmt(failed)} không đạt · biểu đồ ${dailySeries.length} ngày`}
      </div>

      {/* 2. Top 5 KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Tổng mối hàn */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold tracking-wider text-[#0047AB] uppercase">
              TỔNG MỐI HÀN
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
                {fmt(total)}
              </div>
              <div className="text-xs font-medium text-slate-400">mối</div>
            </div>
            <div className="mt-2.5 text-xs text-slate-500">Trong khoảng ngày đang lọc</div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0047AB] border border-blue-200/80">
            <ChartLineUp size={24} weight="fill" aria-hidden />
          </div>
        </div>

        {/* Card 2: Hôm nay */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold tracking-wider text-emerald-700 uppercase">
              HÔM NAY
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
                {fmt(todayTotal)}
              </div>
              <div className="text-xs font-medium text-slate-400">mối</div>
            </div>
            <div className="mt-2.5 text-xs text-emerald-700 font-medium">
              Hôm qua: <span className="font-mono font-semibold">{fmt(yesterdayTotal)}</span> mối
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CalendarCheck size={24} weight="fill" aria-hidden />
          </div>
        </div>

        {/* Card 3: Ngày gần nhất trong kỳ lọc */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold tracking-wider text-indigo-700 uppercase">
              NGÀY GẦN NHẤT
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
                {fmt(latestDailyPoint?.value ?? 0)}
              </div>
              <div className="text-xs font-medium text-slate-400">mối</div>
            </div>
            <div className="mt-2.5 text-xs text-indigo-700 font-medium">
              {latestDailyPoint ? (
                <>
                  <span className="font-semibold font-mono">{viDate(latestDailyPoint.date)}</span>
                  <span className="text-slate-400 font-normal"> · TB {quota.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}/ngày</span>
                </>
              ) : (
                <span className="text-slate-400 font-normal">Chưa có dữ liệu</span>
              )}
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 border border-sky-200">
            <ChartBar size={24} weight="fill" aria-hidden />
          </div>
        </div>

        {/* Card 4: Đạt */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold tracking-wider text-emerald-700 uppercase">
              ĐẠT
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
                {fmt(passed)}
              </div>
              <div className="text-xs font-medium text-slate-400">mối</div>
            </div>
            <div className="mt-2.5 text-xs text-slate-500">
              <span className="font-semibold text-emerald-700 font-mono tabular-nums">{pctComma(passed, total)}</span> tổng số
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle size={24} weight="fill" aria-hidden />
          </div>
        </div>

        {/* Card 5: Không đạt */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold tracking-wider text-rose-700 uppercase">
              KHÔNG ĐẠT
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
                {failed}
              </div>
              <div className="text-xs font-medium text-slate-400">mối</div>
            </div>
            <div className="mt-2.5 text-xs text-slate-500">
              <span className="font-semibold text-rose-700 font-mono tabular-nums">{pctComma(failed, total)}</span> tổng số
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={24} weight="fill" aria-hidden />
          </div>
        </div>
      </div>

      {/* 3. Middle Charts Row (Production Progress + Daily Chart + Welds by Plant) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)_minmax(320px,1fr)] gap-4 items-start">
        {/* Box 1: TIẾN ĐỘ SẢN XUẤT */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
            TIẾN ĐỘ SẢN XUẤT
          </div>
          <div className="mt-3.5 flex flex-col sm:flex-row gap-3.5">
            <div className="w-full sm:w-[214px] shrink-0 text-center">
              <div className="relative mx-auto h-[126px] w-[214px]">
                <svg viewBox="0 0 200 118" className="h-[126px] w-[214px] block">
                  <path
                    d="M 16 104 A 84 84 0 0 1 184 104"
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="24"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 16 104 A 84 84 0 0 1 184 104"
                    fill="none"
                    stroke="#0047AB"
                    strokeWidth="24"
                    strokeLinecap="round"
                    strokeDasharray={gaugeDash(progressPctNum)}
                  />
                </svg>
                <div className="absolute top-[54px] left-0 right-0 text-2xl sm:text-3xl font-bold font-mono tracking-tight text-slate-900 leading-none">
                  {progressPct}%
                </div>
                <div className="absolute top-[86px] left-0 right-0 text-xs text-slate-500 font-medium">
                  Tiến độ mục tiêu
                </div>
              </div>
              <div className="mt-2 text-lg sm:text-xl font-bold font-mono text-slate-900 tracking-tight">
                {fmt(total)} / {fmt(target)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Mục tiêu: {fmt(target)} mối
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-2.5 pt-1">
              <div>
                <div className="text-xs text-slate-500">Còn lại</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                    {fmt(Math.max(0, target - total))}
                  </span>
                  <span className="text-xs text-slate-400">mối</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Kế hoạch trung bình/ngày</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                    {quota.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
                  </span>
                  <span className="text-xs text-slate-400">mối/ngày</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Kế hoạch trong kỳ</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-bold font-mono text-emerald-700">
                    {fmt(plannedTarget)}
                  </span>
                  <span className="text-xs text-slate-400">mối</span>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-500">Trạng thái</div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold tracking-wide text-emerald-700 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  ĐÚNG TIẾN ĐỘ
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Box 2: SẢN LƯỢNG HÀN THEO NGÀY / LŨY KẾ */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              {chartViewMode === "daily" ? "SẢN LƯỢNG HÀN THEO NGÀY" : "SẢN LƯỢNG HÀN THEO LŨY KẾ"}
            </div>
            
            {/* 1 nút chia làm 2: Ngày | Lũy kế */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100/90 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setChartViewMode("daily")}
                className={`flex h-7 items-center gap-1.5 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  chartViewMode === "daily"
                    ? "bg-white text-[#0047AB] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarBlank size={13} weight="bold" aria-hidden />
                <span>Ngày</span>
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode("cumulative")}
                className={`flex h-7 items-center gap-1.5 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  chartViewMode === "cumulative"
                    ? "bg-white text-[#0047AB] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ChartLineUp size={13} weight="bold" aria-hidden />
                <span>Lũy kế</span>
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <svg width="22" height="8">
                <line x1="0" y1="4" x2="22" y2="4" stroke="#0047AB" strokeWidth="2" />
                <circle cx="11" cy="4" r="3" fill="#0047AB" />
              </svg>
              <span>{chartViewMode === "daily" ? "Thực tế" : "Lũy kế thực tế"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="22" height="8">
                <line
                  x1="0"
                  y1="4"
                  x2="22"
                  y2="4"
                  stroke="#94a3b8"
                  strokeWidth="1.6"
                  strokeDasharray="5 4"
                />
              </svg>
              <span>{chartViewMode === "daily" ? "Mục tiêu" : "Lũy kế mục tiêu"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-xs bg-blue-200" />
              <span>Bình quân 7 ngày</span>
            </div>
          </div>

          {selectedDay ? (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/90 px-3 py-2.5 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {chartViewMode === "daily" ? "Số liệu ngày" : "Số liệu lũy kế"}
                  </p>
                  <p className="text-sm font-bold text-[#0047AB]">{selectedDay.dateFull}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDayIndex(null)}
                  className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white hover:text-slate-700 cursor-pointer"
                  aria-label="Đóng"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {chartViewMode === "daily" ? (
                  <>
                    <div className="rounded-md bg-white/90 border border-slate-200/80 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-500">Sản lượng ngày</p>
                      <p className="font-mono text-sm font-bold text-[#0047AB] tabular-nums">{fmt(selectedDay.daily)}</p>
                    </div>
                    <div className="rounded-md bg-white/90 border border-slate-200/80 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-500">Mục tiêu ngày</p>
                      <p className="font-mono text-sm font-bold text-slate-700 tabular-nums">{fmt(selectedDay.dailyTarget)}</p>
                    </div>
                    <div className="rounded-md bg-white/90 border border-slate-200/80 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-500">Lũy kế thực tế</p>
                      <p className="font-mono text-sm font-bold text-[#0047AB] tabular-nums">{fmt(selectedDay.cumActual)}</p>
                    </div>
                    <div className="rounded-md bg-white/90 border border-slate-200/80 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-500">Lũy kế mục tiêu</p>
                      <p className="font-mono text-sm font-bold text-slate-700 tabular-nums">{fmt(selectedDay.cumTarget)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-md bg-white/90 border border-slate-200/80 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-500">Lũy kế thực tế</p>
                      <p className="font-mono text-sm font-bold text-[#0047AB] tabular-nums">{fmt(selectedDay.cumActual)}</p>
                    </div>
                    <div className="rounded-md bg-white/90 border border-slate-200/80 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-500">Lũy kế mục tiêu</p>
                      <p className="font-mono text-sm font-bold text-slate-700 tabular-nums">{fmt(selectedDay.cumTarget)}</p>
                    </div>
                    <div className="rounded-md bg-white/90 border border-slate-200/80 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-500">Sản lượng ngày</p>
                      <p className="font-mono text-sm font-bold text-[#0047AB] tabular-nums">{fmt(selectedDay.daily)}</p>
                    </div>
                    <div className="rounded-md bg-white/90 border border-slate-200/80 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-500">Mục tiêu ngày</p>
                      <p className="font-mono text-sm font-bold text-slate-700 tabular-nums">{fmt(selectedDay.dailyTarget)}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[10px] text-slate-400 text-center">
              Click vào từng ngày trên biểu đồ để xem số liệu chi tiết
            </p>
          )}

          {/* Chart Plot */}
          <div className="mt-2 flex">
            {/* Left Y-axis labels */}
            <div className="relative h-[190px] w-[46px] shrink-0 text-right text-[11px] font-mono text-slate-400 select-none pr-2">
              {(() => {
                const axisMax = chartViewMode === "daily" ? chart.maxVal : chart.maxCumVal;
                return (
                  <>
                    <div className="absolute right-2 -top-1.5">{fmt(axisMax)}</div>
                    <div className="absolute right-2 top-[31px]">{fmt(Math.round(axisMax * 0.8))}</div>
                    <div className="absolute right-2 top-[69px]">{fmt(Math.round(axisMax * 0.6))}</div>
                    <div className="absolute right-2 top-[107px]">{fmt(Math.round(axisMax * 0.4))}</div>
                    <div className="absolute right-2 top-[145px]">{fmt(Math.round(axisMax * 0.2))}</div>
                    <div className="absolute right-2 top-[183px]">0</div>
                  </>
                );
              })()}
            </div>

            {/* SVG Plot */}
            <div className="min-w-0 flex-1">
              <svg
                viewBox="0 0 500 190"
                preserveAspectRatio="none"
                className="h-[190px] w-full block overflow-visible"
              >
                {/* Horizontal Grid */}
                <line x1="0" y1="0.5" x2="500" y2="0.5" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="38" x2="500" y2="38" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="76" x2="500" y2="76" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="114" x2="500" y2="114" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="152" x2="500" y2="152" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="189.5" x2="500" y2="189.5" stroke="#cbd5e1" strokeWidth="1" />

                {(() => {
                  const isCum = chartViewMode === "cumulative";
                  const areaPath = isCum ? chart.cumAreaPath : chart.areaPath;
                  const bars = isCum ? chart.cumBars : chart.bars;
                  const linePath = isCum ? chart.cumLinePath : chart.linePath;
                  const dots = isCum ? chart.cumPts : chart.dots;
                  return (
                    <>
                      {areaPath && (
                        <path d={areaPath} fill="#eff6ff" opacity="0.9" />
                      )}
                      {bars.map((b, i) => (
                        <rect
                          key={i}
                          x={b.x}
                          y={b.y}
                          width="5"
                          height={b.h}
                          fill={selectedDayIndex === i ? "#0047AB" : "#3b82f6"}
                          rx="1"
                          className="transition-colors cursor-pointer"
                          onClick={() => toggleDaySelection(i)}
                        />
                      ))}
                      {isCum ? (
                        chart.targetCumLinePath && (
                          <path
                            d={chart.targetCumLinePath}
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="1.3"
                            strokeDasharray="7 5"
                          />
                        )
                      ) : (
                        <path
                          d={chart.targetLinePath}
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="1.3"
                          strokeDasharray="7 5"
                        />
                      )}
                      {linePath && (
                        <path d={linePath} fill="none" stroke="#0047AB" strokeWidth="2" />
                      )}
                      {dots.map((p, i) => (
                        <circle
                          key={i}
                          cx={p.cx}
                          cy={p.cy}
                          r={selectedDayIndex === i ? 4.5 : 2.8}
                          fill="#0047AB"
                          stroke={selectedDayIndex === i ? "#ffffff" : "none"}
                          strokeWidth={selectedDayIndex === i ? 1.5 : 0}
                          className="cursor-pointer"
                          onClick={() => toggleDaySelection(i)}
                        />
                      ))}
                    </>
                  );
                })()}

                {chart.dayPoints.map((dp) => (
                  <circle
                    key={`hit-${dp.idx}`}
                    cx={dp.cx}
                    cy={chartViewMode === "daily" ? dp.cy : chart.cumPts[dp.idx]?.cy ?? dp.cumCy}
                    r="12"
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={() => toggleDaySelection(dp.idx)}
                  />
                ))}
              </svg>
              <div className="flex gap-0.5 overflow-x-auto pt-2 pb-0.5 px-0.5">
                {chart.dayPoints.map((dp) => (
                  <button
                    key={dp.idx}
                    type="button"
                    onClick={() => toggleDaySelection(dp.idx)}
                    className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-mono transition-colors cursor-pointer ${
                      selectedDayIndex === dp.idx
                        ? "bg-[#0047AB] text-white font-semibold"
                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    }`}
                  >
                    {dp.dateShort}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Box 3: DỰ ÁN */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
            DỰ ÁN
          </div>
          <div className="mt-3.5 flex justify-center">
            <div className="relative h-[126px] w-[126px]">
              <svg viewBox="0 0 140 140" className="h-[126px] w-[126px] block">
                <circle cx="70" cy="70" r="52" fill="none" stroke="#f1f5f9" strokeWidth="20" />
                {projectDonutArcs.map((arc, index) => (
                  <circle
                    key={projectRows[index]?.name ?? index}
                    cx="70"
                    cy="70"
                    r="52"
                    fill="none"
                    stroke={projectRows[index]?.color ?? "#cbd5e1"}
                    strokeWidth="20"
                    strokeDasharray={arc.dasharray}
                    transform={arc.transform}
                  />
                ))}
              </svg>
              <div className="absolute top-[46px] left-0 right-0 text-center text-lg sm:text-xl font-bold font-mono text-slate-900 leading-none tabular-nums">
                {fmt(total)}
              </div>
              <div className="absolute top-[66px] left-0 right-0 text-center text-xs text-slate-500 font-medium">
                Tổng
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {projectRows.length > 0 ? (
              projectRows.map((row) => (
                <div key={row.name} className="flex items-center gap-2 text-xs sm:text-sm">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: row.color }}
                  />
                  <span className="flex-1 min-w-0 line-clamp-2 break-words text-slate-700 font-medium leading-snug" title={row.name}>
                    {row.name}
                  </span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">{fmt(row.count)}</span>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-xs text-slate-500">Chưa có dữ liệu dự án</div>
            )}
          </div>
        </div>
      </div>

      {/* 4. 3-column Grid: Máy, Lỗi hàn, Trạng thái */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {/* Card 1: Mối hàn theo máy */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs min-w-0">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
            MỐI HÀN THEO MÁY
          </div>
          <div className="mt-3 grid grid-cols-[1fr_0.7fr_0.55fr_0.85fr_0.9fr] gap-x-1 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <div>Máy</div>
            <div>Mối hàn</div>
            <div>Hôm nay</div>
            <div>Tỷ lệ lỗi</div>
            <div className="text-right">Tỷ lệ đạt</div>
          </div>
          <div className="divide-y divide-slate-100">
            {machineRows.map((m) => (
              <div
                key={m.code}
                className="grid grid-cols-[1fr_0.7fr_0.55fr_0.85fr_0.9fr] gap-x-1 items-center py-2.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-50/60 transition-colors"
              >
                <div className="font-semibold truncate font-mono text-slate-900">{m.code}</div>
                <div className="font-mono tabular-nums">{m.total}</div>
                <div className="font-mono tabular-nums">{m.today}</div>
                <div className="font-mono tabular-nums">{m.errorRate}</div>
                <div className="flex items-center justify-end gap-1.5">
                  <div className="h-1.5 w-12 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${m.availPct}%`,
                        background: m.availColor,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs font-mono tabular-nums font-semibold">
                    {m.availLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 text-xs sm:text-sm text-[#0047AB] font-semibold">
            <button type="button" className="hover:underline cursor-pointer">
              Xem tất cả máy
            </button>
            <span className="text-slate-400">→</span>
          </div>
        </div>

        {/* Card 2: Lỗi hàn phổ biến */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs min-w-0">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
            LỖI HÀN PHỔ BIẾN
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {errorReasonRows.length > 0 ? (
              errorReasonRows.map((err) => (
                <div key={err.label} className="flex items-center gap-2 text-xs sm:text-sm">
                  <div className="min-w-[100px] max-w-[180px] shrink-0 line-clamp-2 break-words text-slate-700 font-medium leading-snug" title={err.label}>
                    {err.label}
                  </div>
                  <div className="flex flex-1 min-w-0 items-center gap-1.5">
                    <div className="h-2 flex-1 min-w-0 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-500"
                        style={{ width: `${err.pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-500 shrink-0 tabular-nums font-semibold">
                      {err.count}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-sm text-slate-500">
                Không có lỗi trong nhật ký hàn đã lọc.
              </div>
            )}
          </div>
          <div className="flex items-center justify-between pt-3 text-xs sm:text-sm text-[#0047AB] font-semibold">
            <button type="button" className="hover:underline cursor-pointer">
              Xem tất cả lỗi
            </button>
            <span className="text-slate-400">→</span>
          </div>
        </div>

        {/* Card 3: Mối hàn theo trạng thái */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs min-w-0">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
            MỐI HÀN THEO TRẠNG THÁI
          </div>
          <div className="mt-2.5 flex justify-center">
            <div className="relative h-[108px] w-[108px]">
              <svg viewBox="0 0 140 140" className="h-[108px] w-[108px] block">
                <circle cx="70" cy="70" r="52" fill="none" stroke="#f1f5f9" strokeWidth="20" />
                {statusDonutArcs[0] ? (
                  <circle
                    cx="70"
                    cy="70"
                    r="52"
                    fill="none"
                    stroke="#15803d"
                    strokeWidth="20"
                    strokeDasharray={statusDonutArcs[0].dasharray}
                    transform={statusDonutArcs[0].transform}
                  />
                ) : null}
                {statusDonutArcs[1] ? (
                  <circle
                    cx="70"
                    cy="70"
                    r="52"
                    fill="none"
                    stroke="#d97706"
                    strokeWidth="20"
                    strokeDasharray={statusDonutArcs[1].dasharray}
                    transform={statusDonutArcs[1].transform}
                  />
                ) : null}
                {statusDonutArcs[2] ? (
                  <circle
                    cx="70"
                    cy="70"
                    r="52"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="20"
                    strokeDasharray={statusDonutArcs[2].dasharray}
                    transform={statusDonutArcs[2].transform}
                  />
                ) : null}
              </svg>
              <div className="absolute top-[38px] left-0 right-0 text-center text-base sm:text-lg font-bold font-mono text-slate-900 leading-none tabular-nums">
                {fmt(total)}
              </div>
              <div className="absolute top-[56px] left-0 right-0 text-center text-xs text-slate-500 font-medium">
                Tổng
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {statusRows.map((row) => (
              <div key={row.name} className="flex items-center gap-1.5 text-xs sm:text-sm">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
                <span className="flex-1 min-w-0 line-clamp-2 break-words text-slate-700">
                  {row.name}
                </span>
                <span className="font-semibold font-mono text-slate-900 tabular-nums">
                  {row.value}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  ({row.pct})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Tác vụ nhanh */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
        <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
          TÁC VỤ NHANH
        </div>
        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {[
            {
              label: "Thêm mối hàn mới",
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2.2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              ),
            },
            {
              label: "Phiếu kiểm tra",
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" />
                  <path d="M9 12h6M9 16h4" />
                </svg>
              ),
            },
            {
              label: "Nhập sản lượng",
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <line x1="8" y1="6" x2="16" y2="6" />
                  <line x1="8" y1="10" x2="8.01" y2="10" />
                  <line x1="12" y1="10" x2="12.01" y2="10" />
                  <line x1="16" y1="10" x2="16.01" y2="10" />
                  <line x1="8" y1="14" x2="8.01" y2="14" />
                  <line x1="12" y1="14" x2="12.01" y2="14" />
                  <line x1="16" y1="14" x2="16.01" y2="14" />
                </svg>
              ),
            },
            {
              label: "Tình trạng máy",
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <rect x="9" y="9" width="6" height="6" />
                  <line x1="9" y1="1" x2="9" y2="4" />
                  <line x1="15" y1="1" x2="15" y2="4" />
                  <line x1="9" y1="20" x2="9" y2="23" />
                  <line x1="15" y1="20" x2="15" y2="23" />
                  <line x1="20" y1="9" x2="23" y2="9" />
                  <line x1="20" y1="14" x2="23" y2="14" />
                  <line x1="1" y1="9" x2="4" y2="9" />
                  <line x1="1" y1="14" x2="4" y2="14" />
                </svg>
              ),
            },
            {
              label: "Tạo báo cáo",
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              ),
            },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              className="flex items-center gap-2.5 rounded-lg border border-slate-200/90 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-[#0047AB] shadow-xs transition-all cursor-pointer text-left"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
