"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useTongMoiHanNam } from "@/hooks/useTongMoiHanNam";
import { useWeldReportData } from "@/hooks/useWeldReportData";
import {
  buildDailyJournalSeries,
  buildDonutArcs,
  countReworkWelds,
  filterWeldReportRows,
  getJournalRowDateIso,
  groupJournalErrorReasons,
  groupJournalRows,
  machineForRow,
  REPORT_MACHINES,
  REPORT_PERIOD_END,
  REPORT_PERIOD_START,
  resolveChartDateRange,
  summarizeJournalRows,
} from "@/lib/weldReportData";
import { filterYearTotals } from "@/lib/tongMoiHanNamDb";

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

const CHART_ZOOM_MIN = 1;
const CHART_ZOOM_MAX = 8;

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
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
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
  const {
    years: yearTotals,
    byProject: yearByProject,
    byPersonnel: yearByPersonnel,
    loading: yearLoading,
    error: yearError,
  } = useTongMoiHanNam();

  const [chartViewMode, setChartViewMode] = useState<"daily" | "yearly" | "cumulative">("daily");
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [chartZoom, setChartZoom] = useState(1);
  const plotScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedDayIndex(null);
  }, [appliedFilters, chartViewMode]);

  // Cuộn chuột trên biểu đồ để phóng to / thu nhỏ các cột
  useEffect(() => {
    const el = plotScrollRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      const prevWidth = el.scrollWidth;
      const anchorRatio =
        prevWidth > 0 ? (el.scrollLeft + event.offsetX) / prevWidth : 0.5;
      setChartZoom((current) => {
        const next = Math.min(
          CHART_ZOOM_MAX,
          Math.max(CHART_ZOOM_MIN, +(current * (event.deltaY < 0 ? 1.2 : 1 / 1.2)).toFixed(3)),
        );
        if (next !== current) {
          requestAnimationFrame(() => {
            const node = plotScrollRef.current;
            if (node) {
              node.scrollLeft = anchorRatio * node.scrollWidth - event.offsetX;
            }
          });
        }
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    setChartZoom(1);
  }, [chartViewMode, appliedFilters]);

  const selectedRows = useMemo(
    () => filterWeldReportRows(rows, appliedFilters),
    [rows, appliedFilters],
  );
  const summary = useMemo(() => summarizeJournalRows(selectedRows), [selectedRows]);

  // Tìm ngày có dữ liệu mới nhất trong danh sách đã lọc
  const latestDataDate = useMemo(() => {
    let maxDate = "";
    selectedRows.forEach((r, i) => {
      const iso = getJournalRowDateIso(r, i);
      if (iso && iso > maxDate) maxDate = iso;
    });
    return maxDate;
  }, [selectedRows]);

  const chartDateRange = useMemo(() => {
    const usesDefaultPeriod =
      appliedFilters.dateFrom === REPORT_PERIOD_START && appliedFilters.dateTo === REPORT_PERIOD_END;
    return resolveChartDateRange(
      appliedFilters.dateFrom,
      usesDefaultPeriod ? "" : appliedFilters.dateTo,
      31,
      latestDataDate,
    );
  }, [appliedFilters.dateFrom, appliedFilters.dateTo, latestDataDate]);
  const dailySeries = useMemo(
    () => buildDailyJournalSeries(selectedRows, chartDateRange.from, chartDateRange.to),
    [selectedRows, chartDateRange.from, chartDateRange.to],
  );
  const dailyValues = useMemo(() => dailySeries.map((point) => point.value), [dailySeries]);

  // Tự động cuộn sang phải để hiển thị dữ liệu mới nhất ngay sau render
  useEffect(() => {
    const el = plotScrollRef.current;
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollLeft = el.scrollWidth;
    }, 60);
    return () => clearTimeout(t);
  }, [dailySeries, chartViewMode, chartZoom, chartDateRange]);
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

  const yearlySeries = useMemo(() => {
    const emptyYear = (nam: number) => ({
      nam,
      tong_moi_han: 0,
      tong_loi: 0,
      tong_dat: 0,
      fbw: 0,
      atw: 0,
      loi_fbw: 0,
      loi_atw: 0,
      san_xuat: 0,
      thu_nghiem: 0,
      dao_tao: 0,
      loi_san_xuat: 0,
      loi_thu_nghiem: 0,
      loi_dao_tao: 0,
    });

    let baseRows = yearTotals;
    if (appliedFilters.projects.length > 0) {
      const names = new Set(appliedFilters.projects);
      const matched = yearByProject.filter((row) => names.has(row.du_an));
      const map = new Map<number, ReturnType<typeof emptyYear>>();
      for (const row of matched) {
        const current = map.get(row.nam) ?? emptyYear(row.nam);
        current.tong_moi_han += row.tong_moi_han;
        current.tong_loi += row.tong_loi;
        current.tong_dat += row.tong_dat;
        current.fbw += row.fbw;
        current.atw += row.atw;
        current.loi_fbw += row.loi_fbw;
        current.loi_atw += row.loi_atw;
        current.san_xuat += row.san_xuat;
        current.thu_nghiem += row.thu_nghiem;
        current.dao_tao += row.dao_tao;
        map.set(row.nam, current);
      }
      baseRows = [...map.values()].sort((a, b) => a.nam - b.nam);
    } else if (appliedFilters.personnel.length > 0) {
      const names = new Set(appliedFilters.personnel);
      const matched = yearByPersonnel.filter((row) => names.has(row.ten_tho_han));
      const map = new Map<number, ReturnType<typeof emptyYear>>();
      for (const row of matched) {
        const current = map.get(row.nam) ?? emptyYear(row.nam);
        current.tong_moi_han += row.tong_moi_han;
        current.tong_loi += row.tong_loi;
        current.tong_dat += row.tong_dat;
        current.fbw += row.fbw;
        current.atw += row.atw;
        current.loi_fbw += row.loi_fbw;
        current.loi_atw += row.loi_atw;
        current.san_xuat += row.san_xuat;
        current.thu_nghiem += row.thu_nghiem;
        current.dao_tao += row.dao_tao;
        map.set(row.nam, current);
      }
      baseRows = [...map.values()].sort((a, b) => a.nam - b.nam);
    }

    const filtered = filterYearTotals(
      baseRows,
      appliedFilters.dateFrom,
      appliedFilters.dateTo,
      appliedFilters.methods,
      appliedFilters.weldTypes,
    );

    const targetByYear = new Map<string, number>();
    for (const project of selectedProjects) {
      for (const row of project.theoreticalProgress ?? []) {
        if (row.ngay < appliedFilters.dateFrom || row.ngay > appliedFilters.dateTo) continue;
        const year = row.ngay.slice(0, 4);
        targetByYear.set(year, (targetByYear.get(year) ?? 0) + row.so_moi_han);
      }
    }

    const years = filtered.map((row) => row.year);
    if (years.length === 0) {
      const startYear = Number(appliedFilters.dateFrom.slice(0, 4));
      const endYear = Number(appliedFilters.dateTo.slice(0, 4));
      if (Number.isFinite(startYear) && Number.isFinite(endYear) && endYear >= startYear) {
        for (let year = startYear; year <= endYear; year += 1) years.push(String(year));
      }
    } else {
      const startYear = Number(years[0]);
      const endYear = Number(years[years.length - 1]);
      const filled: string[] = [];
      for (let year = startYear; year <= endYear; year += 1) filled.push(String(year));
      years.splice(0, years.length, ...filled);
    }

    const byYear = new Map(filtered.map((row) => [row.year, row]));
    return years.map((year) => {
      const row = byYear.get(year);
      return {
        year,
        date: `${year}-01-01`,
        value: row?.value ?? 0,
        target: targetByYear.get(year) ?? 0,
        defects: row?.defects ?? 0,
      };
    });
  }, [
    appliedFilters.dateFrom,
    appliedFilters.dateTo,
    appliedFilters.methods,
    appliedFilters.personnel,
    appliedFilters.projects,
    appliedFilters.weldTypes,
    selectedProjects,
    yearByPersonnel,
    yearByProject,
    yearTotals,
  ]);

  const chartPeriod = useMemo(() => {
    if (chartViewMode === "yearly") {
      return {
        values: yearlySeries.map((point) => point.value),
        targets: yearlySeries.map((point) => point.target),
        labels: yearlySeries.map((point) => point.year),
        fullLabels: yearlySeries.map((point) => `Năm ${point.year}`),
        dates: yearlySeries.map((point) => point.date),
        unitLabel: "năm",
      };
    }
    return {
      values: dailyValues,
      targets: dailyTargets,
      labels: dailySeries.map((point) => viDateShort(point.date)),
      fullLabels: dailySeries.map((point) => viDate(point.date)),
      dates: dailySeries.map((point) => point.date),
      unitLabel: "ngày",
    };
  }, [chartViewMode, dailySeries, dailyTargets, dailyValues, yearlySeries]);
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
  const rework = countReworkWelds(selectedRows);
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
    // Lũy kế luôn theo ngày; tab Ngày/Năm dùng chartPeriod.
    const useYearlyBars = chartViewMode === "yearly";
    const slice = useYearlyBars ? chartPeriod.values : dailyValues;
    const targetSlice = useYearlyBars ? chartPeriod.targets : dailyTargets;
    const count = slice.length;
    const chartRangeLabel = useYearlyBars
      ? `${appliedFilters.dateFrom.slice(0, 4)} – ${appliedFilters.dateTo.slice(0, 4)} · sản lượng/năm`
      : `${viDate(chartDateRange.from)} – ${viDate(chartDateRange.to)} · sản lượng/ngày`;

    if (count === 0) {
      return {
        chartRangeLabel,
        bars: [],
        dots: [],
        linePath: "",
        areaPath: "",
        chartLabels: [],
        dailyStackBars: [],
        cumStackBars: [],
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

    const maxVal = Math.max(10, Math.ceil(Math.max(...slice, ...targetSlice, 1) / 10) * 10);
    const plotH = 260;
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

    // Cột chồng: 1 cột/ngày, cao = dự kiến. Dưới (xanh) = thực tế, trên (vàng) = phần còn thiếu.
    // Mỗi ngày chiếm 1 ô rộng bằng nhau (band); cột nằm giữa ô, bề rộng ~46% band để có khe hở.
    const band = 500 / Math.max(1, count);
    const stackBarW = Math.min(26, band * 0.46);
    const makeStackBars = (actualArr: number[], targetArr: number[], axisMax: number) =>
      actualArr.map((aRaw, idx) => {
        const a = Math.max(0, aRaw);
        const t = Math.max(0, targetArr[idx] ?? 0);
        const cx = band * (idx + 0.5);
        const px = (v: number) => Math.min(plotH - 4, (v / axisMax) * plotH);
        const blueH = a > 0 ? Math.max(2, px(a)) : 0;
        const yellowH = t > a ? Math.max(2, Math.min(px(t) - blueH, plotH - 4 - blueH)) : 0;
        return {
          x: cx - stackBarW / 2,
          w: stackBarW,
          bandX: band * idx,
          bandW: band,
          blueY: plotH - blueH,
          blueH,
          yellowY: plotH - blueH - yellowH,
          yellowH,
          actual: a,
          target: t,
        };
      });

    const dailyStackBars = makeStackBars(slice, targetSlice, maxVal);
    const cumStackBars = makeStackBars(cumValues, targetCumValues, maxCumVal);

    const fullLabels = useYearlyBars ? chartPeriod.labels : dailySeries.map((point) => viDateShort(point.date));
    const chartLabels = sampleChartLabels(fullLabels, useYearlyBars ? fullLabels.length : 8);

    const dayPoints: ChartDayPoint[] = slice.map((val, idx) => ({
      idx,
      dayOffset: idx,
      dateShort: useYearlyBars ? (chartPeriod.labels[idx] ?? "") : viDateShort(dailySeries[idx]?.date ?? chartDateRange.from),
      dateFull: useYearlyBars
        ? (chartPeriod.fullLabels[idx] ?? "")
        : viDate(dailySeries[idx]?.date ?? chartDateRange.from),
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
      dailyStackBars,
      cumStackBars,
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
  }, [appliedFilters.dateFrom, appliedFilters.dateTo, chartDateRange, chartPeriod, chartViewMode, dailySeries, dailyTargets, dailyValues]);

  const selectedDay =
    selectedDayIndex !== null && chart.dayPoints[selectedDayIndex]
      ? chart.dayPoints[selectedDayIndex]
      : null;

  function toggleDaySelection(idx: number) {
    setSelectedDayIndex((prev) => (prev === idx ? null : idx));
  }

  const chartDayCount = chart.dayPoints.length;
  // Bề rộng vùng vẽ: mặc định ~44px/ngày (hoặc ~72px/năm), nhân theo mức zoom.
  const plotWidthPx = Math.round(
    Math.max(chartDayCount * (chartViewMode === "yearly" ? 72 : 44) * chartZoom, 1),
  );

  // Đường xu hướng nối đỉnh các cột
  const stackBars = chartViewMode === "cumulative" ? chart.cumStackBars : chart.dailyStackBars;
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  // ...theo mức dự kiến (đỉnh cả cột)
  const trendTops = stackBars
    .filter((b) => b.target > 0 || b.actual > 0)
    .map((b) => ({ x: b.x + b.w / 2, y: b.yellowH > 0 ? b.yellowY : b.blueY }));
  const trendPath = toPath(trendTops);
  // ...theo thực tế (đỉnh phần xanh)
  const actualTops = stackBars
    .filter((b) => b.actual > 0)
    .map((b) => ({ x: b.x + b.w / 2, y: b.blueY }));
  const actualTrendPath = toPath(actualTops);
  function stepZoom(dir: 1 | -1) {
    setChartZoom((current) =>
      Math.min(
        CHART_ZOOM_MAX,
        Math.max(CHART_ZOOM_MIN, +(current * (dir === 1 ? 1.25 : 1 / 1.25)).toFixed(3)),
      ),
    );
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
    () => buildDonutArcs([passed, rework, failed]),
    [passed, rework, failed],
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
    { name: "Hàn lại", color: "#d97706", value: fmt(rework), pct: pctComma(rework, total) },
    { name: "Không đạt", color: "#dc2626", value: fmt(failed), pct: pctComma(failed, total) },
  ];

  return (
    <div className="w-full min-w-0 px-3 sm:px-5 lg:px-6 py-3 sm:py-4 flex flex-col gap-4 text-slate-700 text-sm">
      <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${error || yearError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-[#0047AB]"}`}>
        {error
          ? `Không tải được Supabase: ${error}`
          : yearError
            ? `Tổng hợp năm: ${yearError} · chạy supabase/tong_moi_han_nam.sql`
            : loading || yearLoading
              ? "Đang tải dữ liệu Supabase…"
              : `Nhật ký hàn · ${selectedRows.length} bản ghi · ${fmt(passed)} đạt · ${fmt(failed)} không đạt · ${fmt(yearTotals.length)} năm tổng hợp`}
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
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,330px)_minmax(0,1.9fr)_minmax(280px,0.72fr)] gap-4 items-start xl:items-stretch">
        {/* Box 1: TIẾN ĐỘ SẢN XUẤT */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
            TIẾN ĐỘ SẢN XUẤT
          </div>
          <div className="mt-3.5 flex flex-col gap-4">
            <div className="w-full text-center">
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

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-3.5">
              <div>
                <div className="text-xs text-slate-500">Còn lại</div>
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                    {fmt(Math.max(0, target - total))}
                  </span>
                  <span className="text-xs text-slate-400">mối</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Kế hoạch trung bình/ngày</div>
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                    {quota.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
                  </span>
                  <span className="text-xs text-slate-400">mối/ngày</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Kế hoạch trong kỳ</div>
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-base sm:text-lg font-bold font-mono text-emerald-700">
                    {fmt(plannedTarget)}
                  </span>
                  <span className="text-xs text-slate-400">mối</span>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-500">Trạng thái</div>
                <div className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold tracking-wide text-emerald-700 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  ĐÚNG TIẾN ĐỘ
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Box 2: SẢN LƯỢNG HÀN THEO NGÀY / LŨY KẾ */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
          <div className="flex flex-row items-center justify-between gap-2.5">
            <div className="min-w-0 text-sm sm:text-base font-bold tracking-tight text-slate-900">
              {chartViewMode === "daily"
                ? "SẢN LƯỢNG HÀN THEO NGÀY"
                : chartViewMode === "yearly"
                  ? "SẢN LƯỢNG HÀN THEO NĂM"
                  : "SẢN LƯỢNG HÀN THEO LŨY KẾ"}
            </div>

            {/* Ngày | Năm | Lũy kế */}
            <div className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100/90 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setChartViewMode("daily")}
                className={`flex h-7 items-center gap-1.5 px-2.5 sm:px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
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
                onClick={() => setChartViewMode("yearly")}
                className={`flex h-7 items-center gap-1.5 px-2.5 sm:px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  chartViewMode === "yearly"
                    ? "bg-white text-[#0047AB] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarCheck size={13} weight="bold" aria-hidden />
                <span>Năm</span>
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode("cumulative")}
                className={`flex h-7 items-center gap-1.5 px-2.5 sm:px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
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
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-7 gap-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3.5 rounded-xs bg-[#3b82f6]" />
              <span>Thực tế</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3.5 rounded-xs bg-[#fcd34d]" />
              <span>Dự kiến</span>
            </div>
          </div>

          {selectedDay ? (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/90 px-3 py-2.5 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {chartViewMode === "daily"
                      ? "Số liệu ngày"
                      : chartViewMode === "yearly"
                        ? "Số liệu năm"
                        : "Số liệu lũy kế"}
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
                {chartViewMode === "cumulative" ? (
                  <>
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
                      <p className="text-[10px] text-slate-500">
                        {chartViewMode === "yearly" ? "Sản lượng năm" : "Sản lượng ngày"}
                      </p>
                      <p className="font-mono text-sm font-bold text-[#0047AB] tabular-nums">{fmt(selectedDay.daily)}</p>
                    </div>
                    <div className="rounded-md bg-white/90 border border-slate-200/80 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-500">
                        {chartViewMode === "yearly" ? "Mục tiêu năm" : "Mục tiêu ngày"}
                      </p>
                      <p className="font-mono text-sm font-bold text-slate-700 tabular-nums">{fmt(selectedDay.dailyTarget)}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {/* Chart Plot */}
          <div className="mt-2 flex">
            {/* Trục Y cố định — không cuộn theo biểu đồ */}
            <div className="relative h-[260px] w-10 shrink-0 select-none font-mono text-[11px] font-normal text-slate-900">
              {(() => {
                const axisMax = chartViewMode === "cumulative" ? chart.maxCumVal : chart.maxVal;
                const rows: [number, string][] = [
                  [-7, fmt(axisMax)],
                  [45, fmt(Math.round(axisMax * 0.8))],
                  [97, fmt(Math.round(axisMax * 0.6))],
                  [149, fmt(Math.round(axisMax * 0.4))],
                  [201, fmt(Math.round(axisMax * 0.2))],
                  [253, "0"],
                ];
                return rows.map(([top, label]) => (
                  <span
                    key={top}
                    className="absolute left-0 tabular-nums"
                    style={{ top }}
                  >
                    {label}
                  </span>
                ));
              })()}
            </div>

            {/* SVG Plot */}
            <div className="min-w-0 flex-1">
              <div
                ref={plotScrollRef}
                className="overflow-x-auto overflow-y-hidden"
                style={{ overscrollBehavior: "contain" }}
              >
                <div className="relative" style={{ width: `${plotWidthPx}px`, minWidth: "100%" }}>
              {chartDayCount === 0 || (chartViewMode !== "yearly" && dailySeries.length > 0 && dailySeries.every((p) => p.value === 0 && (!dailyTargets || dailyTargets.every((t) => t === 0)))) ? (
                <div className="flex h-[260px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                  <div className="text-sm font-semibold text-slate-700">Chưa có dữ liệu sản lượng trong khoảng thời gian này</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Khoảng hiển thị: {chart.chartRangeLabel}. Vui lòng chọn khoảng ngày khác hoặc điều chỉnh bộ lọc.
                  </div>
                </div>
              ) : (
                <>
              <svg
                viewBox="0 0 500 260"
                preserveAspectRatio="none"
                className="h-[260px] w-full block overflow-visible"
              >
                {/* Horizontal Grid */}
                <line x1="0" y1="0.5" x2="500" y2="0.5" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="52" x2="500" y2="52" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="104" x2="500" y2="104" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="156" x2="500" y2="156" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="208" x2="500" y2="208" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="259.5" x2="500" y2="259.5" stroke="#cbd5e1" strokeWidth="1" />

                {(() => {
                  const bars =
                    chartViewMode === "cumulative" ? chart.cumStackBars : chart.dailyStackBars;
                  return (
                    <>
                  {bars.map((b, i) => {
                    const active = selectedDayIndex === i;
                    return (
                      <g
                        key={i}
                        className="cursor-pointer"
                        onClick={() => toggleDaySelection(i)}
                      >
                        {/* nền bắt click phủ toàn ô chiều cao */}
                        <rect x={b.bandX} y="0" width={b.bandW} height="260" fill="transparent" />
                        {active && (
                          <rect
                            x={b.bandX}
                            y="0"
                            width={b.bandW}
                            height="260"
                            fill="#0047AB"
                            opacity="0.06"
                          />
                        )}
                        {b.yellowH > 0 && (
                          <rect
                            x={b.x}
                            y={b.yellowY}
                            width={b.w}
                            height={b.yellowH}
                            fill={active ? "#f59e0b" : "#fcd34d"}
                            className="transition-colors"
                          />
                        )}
                        {b.blueH > 0 && (
                          <rect
                            x={b.x}
                            y={b.blueY}
                            width={b.w}
                            height={b.blueH}
                            fill={active ? "#0047AB" : "#3b82f6"}
                            className="transition-colors"
                          />
                        )}
                      </g>
                    );
                  })}
                  {trendPath && (
                    <>
                      <path
                        d={trendPath}
                        fill="none"
                        stroke="#fde9c8"
                        strokeWidth={5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        className="pointer-events-none"
                      />
                      <path
                        d={trendPath}
                        fill="none"
                        stroke="#e08e0b"
                        strokeWidth={2.25}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        className="pointer-events-none"
                      />
                    </>
                  )}
                  {actualTrendPath && (
                    <>
                      <path
                        d={actualTrendPath}
                        fill="none"
                        stroke="#dbeafe"
                        strokeWidth={5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        className="pointer-events-none"
                      />
                      <path
                        d={actualTrendPath}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth={2.25}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        className="pointer-events-none"
                      />
                    </>
                  )}
                    </>
                  );
                })()}
              </svg>
              {trendTops.map((p, i) => (
                <span
                  key={`trend-dot-${i}`}
                  className="pointer-events-none absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-[#e08e0b] bg-white"
                  style={{ left: `${(p.x / 500) * 100}%`, top: `${p.y}px` }}
                />
              ))}
              {actualTops.map((p, i) => (
                <span
                  key={`actual-dot-${i}`}
                  className="pointer-events-none absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-[#2563eb] bg-white"
                  style={{ left: `${(p.x / 500) * 100}%`, top: `${p.y}px` }}
                />
              ))}
              <div className="flex pt-2 pb-0.5">
                {chart.dayPoints.map((dp) => (
                  <button
                    key={dp.idx}
                    type="button"
                    onClick={() => toggleDaySelection(dp.idx)}
                    className={`min-w-0 flex-1 basis-0 rounded py-0.5 text-center text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer ${
                      selectedDayIndex === dp.idx
                        ? "bg-[#0047AB] text-white font-semibold"
                        : "text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {dp.dateShort}
                  </button>
                ))}
              </div>
                </>
              )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-end gap-2 text-sm font-medium text-slate-900">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => stepZoom(-1)}
                    disabled={chartZoom <= CHART_ZOOM_MIN}
                    className="h-7 w-7 rounded-md border border-slate-300 text-base leading-none text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Thu nhỏ"
                  >
                    −
                  </button>
                  <span className="w-10 text-center font-mono tabular-nums font-semibold text-slate-900">
                    {chartZoom.toFixed(1)}×
                  </span>
                  <button
                    type="button"
                    onClick={() => stepZoom(1)}
                    disabled={chartZoom >= CHART_ZOOM_MAX}
                    className="h-7 w-7 rounded-md border border-slate-300 text-base leading-none text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Phóng to"
                  >
                    +
                  </button>
                  {chartZoom !== 1 && (
                    <button
                      type="button"
                      onClick={() => setChartZoom(1)}
                      className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50 cursor-pointer"
                    >
                      Đặt lại
                    </button>
                  )}
                </div>
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
