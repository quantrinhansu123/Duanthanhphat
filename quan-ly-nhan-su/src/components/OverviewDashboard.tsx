"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Buildings,
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
import { useWeldDailyRollup } from "@/hooks/useWeldDailyRollup";
import { useOverviewAggregates } from "@/hooks/useOverviewAggregates";
import { useWeldReportData } from "@/hooks/useWeldReportData";
import { loadTheoreticalProgressViewRows } from "@/lib/projectsDb";
import {
  buildDailyJournalSeries,
  buildDonutArcs,
  countReworkWelds,
  filterWeldReportRows,
  getJournalRowDateIso,
  groupJournalDefectStats,
  groupJournalRows,
  machineForRow,
  REPORT_MACHINES,
  REPORT_PERIOD_END,
  REPORT_PERIOD_START,
  resolveChartDateRange,
  summarizeJournalRows,
  summarizeProductionWelds,
} from "@/lib/weldReportData";
import { projectDurationDays } from "@/lib/projectsDb";
import { filterYearTotals } from "@/lib/tongMoiHanNamDb";
import {
  buildWeldDailyRollupSeries,
  filterWeldDailyRollupRows,
  summarizeProductionRollup,
  summarizeWeldDailyRollupRows,
} from "@/lib/weldDailyStats";

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

const CHART_ZOOM_MAX = 8;

function fmt(n: number) {
  return Math.round(n).toLocaleString("vi-VN");
}

function formatPctNumber(n: number) {
  return n.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function pctComma(n: number, total: number) {
  if (!total) return "0%";
  return `${((n / total) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;
}

/** Mối hàn dự kiến trong kỳ, chỉ cộng các dòng tiến độ lý thuyết đã lưu. */
function scheduledWeldsInRange(
  project: { theoreticalProgress?: { ngay: string; so_moi_han: number }[] },
  from: string,
  to: string,
) {
  let sum = 0;
  for (const row of project.theoreticalProgress ?? []) {
    if (row.ngay >= from && row.ngay <= to) sum += row.so_moi_han;
  }
  return sum;
}

function planStartDate(project: { startDate?: string; theoreticalProgress?: { ngay: string }[] }) {
  let start = "";
  for (const row of project.theoreticalProgress ?? []) {
    if (row.ngay && (!start || row.ngay < start)) start = row.ngay;
  }
  return start || project.startDate || "";
}

function projectPlanYear(project: { startDate?: string; theoreticalProgress?: { ngay: string }[] }) {
  const year = Number(planStartDate(project).slice(0, 4));
  return Number.isInteger(year) && year >= 1900 ? year : null;
}

function compareProjectYearDesc(
  a: { year: number | null; name: string },
  b: { year: number | null; name: string },
) {
  if (a.year == null && b.year == null) return a.name.localeCompare(b.name, "vi");
  if (a.year == null) return 1;
  if (b.year == null) return -1;
  return b.year - a.year || a.name.localeCompare(b.name, "vi");
}

function projectHasPlan(project: { plannedWeldCount: number; theoreticalProgress?: { so_moi_han: number }[] }) {
  if (project.plannedWeldCount > 0) return true;
  return (project.theoreticalProgress ?? []).some((row) => row.so_moi_han > 0);
}

function projectStatusClass(status: string) {
  if (status === "Hoàn thành") return "border-blue-200 bg-blue-50 text-[#0047AB]";
  if (status === "Đang triển khai") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Tạm dừng") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
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

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const { appliedFilters } = useReportFilters();
  const isAllDates = !appliedFilters.dateFrom && !appliedFilters.dateTo;
  const isUnfilteredOverview =
    isAllDates &&
    appliedFilters.projects.length === 0 &&
    appliedFilters.personnel.length === 0 &&
    appliedFilters.machines.length === 0 &&
    appliedFilters.methods.length === 0 &&
    appliedFilters.weldTypes.length === 0;
  const filterFrom = appliedFilters.dateFrom || REPORT_PERIOD_START;
  const filterTo = appliedFilters.dateTo || REPORT_PERIOD_END;
  // Với khoảng ngày không bao trọn cả năm, các dòng chỉ có `nam_thuc_hien`
  // chắc chắn bị loại bởi bộ lọc. Khi đó có thể đẩy bộ lọc ngày xuống DB và
  // chỉ tải vài dòng thay vì quét toàn bộ nhật ký 13k dòng.
  const canQueryDetailByDate = Boolean(appliedFilters.dateFrom && appliedFilters.dateTo) &&
    (appliedFilters.dateFrom.slice(5) !== "01-01" || appliedFilters.dateTo.slice(5) !== "12-31");
  const detailQueryFrom = canQueryDetailByDate ? appliedFilters.dateFrom : undefined;
  const detailQueryTo = canQueryDetailByDate ? appliedFilters.dateTo : undefined;
  // Rollup theo ngày và các COUNT tổng hợp đủ cho màn "Tất cả dữ liệu".
  // Không tải hàng vạn dòng nhật ký ở chế độ này — đó là phần làm trang đứng.
  const {
    rows: dailyRollupRows,
    source: dailyRollupSource,
    loading: dailyRollupLoading,
  } = useWeldDailyRollup();
  const {
    summary: overviewAggregateSummary,
    machineRows: overviewAggregateMachines,
    projectRows: overviewAggregateProjects,
    errorReasonRows: overviewAggregateErrorReasons,
    doneBeforePlanYear: overviewDoneBeforePlanYear,
    productionThisPlanYear: overviewProductionThisPlanYear,
    source: overviewAggregateSource,
    loading: overviewAggregateLoading,
  } = useOverviewAggregates(appliedFilters, isUnfilteredOverview);
  const fastRollupReady =
    !dailyRollupLoading &&
    dailyRollupSource !== "unavailable" &&
    // Rollup chưa có chiều nhân sự/máy nên không được dùng khi đang lọc hai chiều này.
    appliedFilters.personnel.length === 0 &&
    appliedFilters.machines.length === 0;
  const fastAggregateReady =
    isUnfilteredOverview &&
    !overviewAggregateLoading &&
    overviewAggregateSource === "supabase";
  const canSkipJournal = fastAggregateReady && fastRollupReady;
  const needsJournalRows = isUnfilteredOverview
    ? !overviewAggregateLoading && !dailyRollupLoading && !canSkipJournal
    : true;
  // Dữ liệu lịch sử chỉ có năm không có `ngay_thuc_hien`, nên các khoảng ngày
  // bao trọn cả năm vẫn tải toàn bộ để không làm mất dòng cũ. Khoảng hẹp
  // (ví dụ 2026-09-10 → 2026-09-10) được lọc ngay tại DB.
  const { rows, loading, error } = useWeldReportData(
    needsJournalRows ? detailQueryFrom : undefined,
    needsJournalRows ? detailQueryTo : undefined,
    { mode: "overview", enabled: needsJournalRows },
  );
  const {
    projects,
    setProjects,
    loading: projectsLoading,
    error: projectsError,
  } = useProjectsData({ includeProgress: false });
  const {
    years: yearTotals,
    byProject: yearByProject,
    byPersonnel: yearByPersonnel,
    loading: yearLoading,
    error: yearError,
  } = useTongMoiHanNam();

  // Hydrate tiến độ lý thuyết sau khi danh sách dự án đã hiện — không chặn KPI đầu trang.
  // Chờ `projects` tải xong trước khi merge: nếu chạy song song, tiến độ có thể về
  // trước danh sách dự án, merge vào mảng rỗng rồi bị ghi đè mất khi danh sách tới.
  useEffect(() => {
    if (projects.length === 0) return;
    let active = true;
    loadTheoreticalProgressViewRows()
      .then((progressRows) => {
        if (!active || progressRows.length === 0) return;
        const byProject = new Map<string, { ngay: string; so_moi_han: number }[]>();
        for (const row of progressRows) {
          const list = byProject.get(row.du_an_id) ?? [];
          list.push({ ngay: row.ngay, so_moi_han: row.so_moi_han });
          byProject.set(row.du_an_id, list);
        }
        setProjects((prev) =>
          prev.map((project) => {
            const progress = byProject.get(project.id);
            if (!progress?.length) return project;
            return { ...project, theoreticalProgress: progress };
          }),
        );
      })
      .catch(() => {
        // Giữ KPI theo plannedWeldCount nếu không hydrate được tiến độ ngày.
      });
    return () => {
      active = false;
    };
  }, [projects.length, setProjects]);

  const [chartViewMode, setChartViewMode] = useState<"daily" | "monthly" | "yearly">("daily");
  const [cumulativeChartViewMode, setCumulativeChartViewMode] = useState<"daily" | "monthly" | "yearly">("daily");
  const [cumulativeChartZoom, setCumulativeChartZoom] = useState(1);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [chartZoom, setChartZoom] = useState(1);
  const plotScrollRef = useRef<HTMLDivElement>(null);
  const [plotViewportWidth, setPlotViewportWidth] = useState(0);

  useEffect(() => {
    const el = plotScrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setPlotViewportWidth(el.clientWidth));
    setPlotViewportWidth(el.clientWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setSelectedDayIndex(null);
  }, [appliedFilters, chartViewMode]);

  useEffect(() => {
    setChartZoom(1);
  }, [chartViewMode, appliedFilters]);

  useEffect(() => {
    setCumulativeChartZoom(1);
  }, [cumulativeChartViewMode, appliedFilters]);

  const selectedRows = useMemo(
    () => filterWeldReportRows(rows, appliedFilters),
    [rows, appliedFilters],
  );
  const summary = useMemo(() => summarizeJournalRows(selectedRows), [selectedRows]);
  const todayIso = localIsoDate();

  const fastRollupRows = useMemo(
    () => filterWeldDailyRollupRows(dailyRollupRows, appliedFilters),
    [appliedFilters, dailyRollupRows],
  );
  const fastSummary = useMemo(
    () => summarizeWeldDailyRollupRows(fastRollupRows),
    [fastRollupRows],
  );
  const fastLatestDataDate = useMemo(() => {
    let maxDate = "";
    for (const row of fastRollupRows) {
      if (row.ngay_thuc_hien <= todayIso && row.ngay_thuc_hien > maxDate) {
        maxDate = row.ngay_thuc_hien;
      }
    }
    return maxDate;
  }, [fastRollupRows, todayIso]);

  // Chỉ dùng ngày thực hiện thật và không nhận ngày tương lai làm "ngày gần nhất".
  const latestDataDate = useMemo(() => {
    let maxDate = "";
    selectedRows.forEach((r, i) => {
      const iso = getJournalRowDateIso(r, i);
      if (iso && iso <= todayIso && iso > maxDate) maxDate = iso;
    });
    return maxDate;
  }, [selectedRows, todayIso]);

  const detailReady = needsJournalRows ? !loading && !error : canSkipJournal;
  const showFastAggregate = canSkipJournal || (!detailReady && fastAggregateReady);
  const showFastDaily = !canSkipJournal && !detailReady && !showFastAggregate && fastRollupReady;
  const showFastCharts = fastRollupReady && (canSkipJournal || showFastAggregate || showFastDaily);

  const chartDateRange = useMemo(() => {
    return resolveChartDateRange(
      isAllDates ? REPORT_PERIOD_START : filterFrom,
      isAllDates ? "" : filterTo,
      31,
      showFastCharts ? fastLatestDataDate : latestDataDate,
    );
  }, [fastLatestDataDate, filterFrom, filterTo, isAllDates, latestDataDate, showFastCharts]);
  const dailySeries = useMemo(
    () =>
      showFastCharts
        ? buildWeldDailyRollupSeries(fastRollupRows, chartDateRange.from, chartDateRange.to)
        : buildDailyJournalSeries(selectedRows, chartDateRange.from, chartDateRange.to),
    [chartDateRange.from, chartDateRange.to, fastRollupRows, selectedRows, showFastCharts],
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
    () =>
      projects.filter((project) => {
        if (appliedFilters.projects.length > 0 && !appliedFilters.projects.includes(project.name)) {
          return false;
        }
        // Khi lọc tất cả (không chọn ngày) thì lấy mọi dự án.
        if (isAllDates) return true;
        if (project.endDate && project.endDate < filterFrom) return false;
        if (project.startDate && project.startDate > filterTo) return false;
        return true;
      }),
    [appliedFilters.projects, filterFrom, filterTo, isAllDates, projects],
  );
  // Đường trend dùng số liệu mới ngay. Bảng và các ô phía dưới nhận bản trì hoãn
  // để không chặn lần vẽ biểu đồ.
  const detailRows = useDeferredValue(selectedRows);
  const detailProjects = useDeferredValue(selectedProjects);
  const detailsPending = detailRows !== selectedRows || detailProjects !== selectedProjects;
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
    if (chartViewMode !== "yearly" && cumulativeChartViewMode !== "yearly") return [];
    // Hạch toán theo đúng bộ lọc: gom từ nhật ký đã lọc (ngày/dự án/nhân sự/máy/PP/loại mối).
    const byYear = new Map<string, { value: number; defects: number }>();
    selectedRows.forEach((row, index) => {
      const iso = getJournalRowDateIso(row, index);
      const year = iso ? iso.slice(0, 4) : String(row.nam_thuc_hien || "");
      if (!year || year.length !== 4) return;
      if (year < filterFrom.slice(0, 4) || year > filterTo.slice(0, 4)) return;
      const current = byYear.get(year) ?? { value: 0, defects: 0 };
      current.value += 1;
      if (row.so_luong_loi > 0) current.defects += 1;
      byYear.set(year, current);
    });

    // Fallback tổng hợp năm khi nhật ký kỳ lọc trống (dữ liệu cũ chỉ có năm).
    if (byYear.size === 0) {
      let baseRows = yearTotals;
      if (appliedFilters.projects.length > 0) {
        const names = new Set(appliedFilters.projects);
        const matched = yearByProject.filter((row) => names.has(row.du_an));
        const map = new Map<number, { nam: number; tong_moi_han: number; tong_loi: number }>();
        for (const row of matched) {
          const current = map.get(row.nam) ?? { nam: row.nam, tong_moi_han: 0, tong_loi: 0 };
          current.tong_moi_han += row.tong_moi_han;
          current.tong_loi += row.tong_loi;
          map.set(row.nam, current);
        }
        baseRows = [...map.values()].map((row) => ({
          nam: row.nam,
          tong_moi_han: row.tong_moi_han,
          tong_loi: row.tong_loi,
          tong_dat: row.tong_moi_han - row.tong_loi,
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
        }));
      } else if (appliedFilters.personnel.length > 0) {
        const names = new Set(appliedFilters.personnel);
        const matched = yearByPersonnel.filter((row) => names.has(row.ten_tho_han));
        const map = new Map<number, { nam: number; tong_moi_han: number; tong_loi: number }>();
        for (const row of matched) {
          const current = map.get(row.nam) ?? { nam: row.nam, tong_moi_han: 0, tong_loi: 0 };
          current.tong_moi_han += row.tong_moi_han;
          current.tong_loi += row.tong_loi;
          map.set(row.nam, current);
        }
        baseRows = [...map.values()].map((row) => ({
          nam: row.nam,
          tong_moi_han: row.tong_moi_han,
          tong_loi: row.tong_loi,
          tong_dat: row.tong_moi_han - row.tong_loi,
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
        }));
      }

      const filtered = filterYearTotals(
        baseRows,
        filterFrom,
        filterTo,
        appliedFilters.methods,
        appliedFilters.weldTypes,
      );
      for (const row of filtered) {
        byYear.set(row.year, { value: row.value, defects: row.defects });
      }
    }

    const targetByYear = new Map<string, number>();
    for (const project of selectedProjects) {
      for (const row of project.theoreticalProgress ?? []) {
        if (row.ngay < filterFrom || row.ngay > filterTo) continue;
        const year = row.ngay.slice(0, 4);
        targetByYear.set(year, (targetByYear.get(year) ?? 0) + row.so_moi_han);
      }
    }

    const years: string[] = [];
    const startYear = Number(filterFrom.slice(0, 4));
    const endYear = Number(filterTo.slice(0, 4));
    if (Number.isFinite(startYear) && Number.isFinite(endYear) && endYear >= startYear) {
      for (let year = startYear; year <= endYear; year += 1) years.push(String(year));
    } else {
      years.push(...[...byYear.keys()].sort());
    }

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
    filterFrom,
    filterTo,
    appliedFilters.methods,
    appliedFilters.personnel,
    appliedFilters.projects,
    appliedFilters.weldTypes,
    chartViewMode,
    cumulativeChartViewMode,
    selectedProjects,
    selectedRows,
    yearByPersonnel,
    yearByProject,
    yearTotals,
  ]);

  const chartPeriod = useMemo(() => {
    if (chartViewMode === "monthly") {
      const months = new Map<string, { value: number; target: number }>();
      const get = (key: string) => {
        if (!months.has(key)) months.set(key, { value: 0, target: 0 });
        return months.get(key)!;
      };
      if (canSkipJournal) {
        for (const row of fastRollupRows) {
          if (!row.ngay_thuc_hien) continue;
          get(row.ngay_thuc_hien.slice(0, 7)).value += Math.max(0, Number(row.so_moi ?? row.so_luong_thuc_hien ?? 0));
        }
      } else {
        for (const row of selectedRows) {
          const date = getJournalRowDateIso(row);
          // Dữ liệu chỉ có năm được giữ trong một mốc riêng, không gán tháng giả.
          const key = date ? date.slice(0, 7) : `${row.nam_thuc_hien}`;
          get(key).value += 1;
        }
      }
      for (const project of selectedProjects) {
        for (const row of project.theoreticalProgress ?? []) {
          if (!isAllDates && (row.ngay < filterFrom || row.ngay > filterTo)) continue;
          get(row.ngay.slice(0, 7)).target += row.so_moi_han;
        }
      }
      const keys = [...months.keys()].sort();
      const label = (key: string) => key.length === 4 ? `${key} (chưa rõ tháng)` : `${key.slice(5)}/${key.slice(0, 4)}`;
      return {
        values: keys.map((key) => months.get(key)!.value),
        targets: keys.map((key) => months.get(key)!.target),
        labels: keys.map(label), fullLabels: keys.map(label), dates: keys,
        unitLabel: "tháng",
      };
    }
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
  }, [canSkipJournal, chartViewMode, dailySeries, dailyTargets, dailyValues, fastRollupRows, yearlySeries, selectedRows, selectedProjects, isAllDates, filterFrom, filterTo]);
  const cumulativeChartPeriod = useMemo(() => {
    if (cumulativeChartViewMode === "daily") {
      return {
        values: dailyValues,
        targets: dailyTargets,
        labels: dailySeries.map((point) => viDateShort(point.date)),
        fullLabels: dailySeries.map((point) => viDate(point.date)),
        dates: dailySeries.map((point) => point.date),
      };
    }
    if (cumulativeChartViewMode === "yearly") {
      return {
        values: yearlySeries.map((point) => point.value),
        targets: yearlySeries.map((point) => point.target),
        labels: yearlySeries.map((point) => point.year),
        fullLabels: yearlySeries.map((point) => `Năm ${point.year}`),
        dates: yearlySeries.map((point) => point.date),
      };
    }

    const asOf = isAllDates || todayIso < filterTo ? todayIso : filterTo;
    const projectByKey = new Map<string, (typeof selectedProjects)[number]>();
    for (const project of selectedProjects) {
      projectByKey.set(project.id, project);
      projectByKey.set(project.name, project);
    }
    const months = new Map<string, { value: number; target: number }>();
    const get = (key: string) => {
      if (!months.has(key)) months.set(key, { value: 0, target: 0 });
      return months.get(key)!;
    };
    if (canSkipJournal) {
      for (const row of fastRollupRows) {
        if (!row.ngay_thuc_hien || row.ngay_thuc_hien > asOf) continue;
        get(row.ngay_thuc_hien.slice(0, 7)).value += Math.max(0, Number(row.so_moi ?? row.so_luong_thuc_hien ?? 0));
      }
    } else {
      selectedRows.forEach((row, index) => {
        const date = getJournalRowDateIso(row, index);
        if (!date || date > asOf) return;
        const project = (row.du_an_id && projectByKey.get(row.du_an_id)) || projectByKey.get(row.du_an);
        if (project) {
          const start = planStartDate(project);
          if (start && (start > asOf || date < start)) return;
        }
        get(date.slice(0, 7)).value += 1;
      });
    }
    selectedProjects.forEach((project) => {
      (project.theoreticalProgress ?? []).forEach((row) => {
        if (!row.ngay || row.ngay.length < 7) return;
        if (isAllDates || (row.ngay >= filterFrom && row.ngay <= filterTo)) {
          get(row.ngay.slice(0, 7)).target += row.so_moi_han;
        }
      });
    });
    const known = [...months.keys()].filter((key) => /^\d{4}-\d{2}$/.test(key)).sort();
    if (known.length > 0) {
      const cursor = new Date(`${known[0]}-01T00:00:00`);
      const end = new Date(`${known[known.length - 1]}-01T00:00:00`);
      while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
        get(key);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    const keys = [...months.keys()].filter((key) => /^\d{4}-\d{2}$/.test(key)).sort();
    const label = (key: string) => `${key.slice(5)}/${key.slice(0, 4)}`;
    return {
      values: keys.map((key) => months.get(key)!.value),
      targets: keys.map((key) => months.get(key)!.target),
      labels: keys.map(label),
      fullLabels: keys.map(label),
      dates: keys.map((key) => `${key}-01`),
    };
  }, [canSkipJournal, cumulativeChartViewMode, dailySeries, dailyTargets, dailyValues, fastRollupRows, filterFrom, filterTo, isAllDates, selectedProjects, selectedRows, todayIso, yearlySeries]);

  const cumulativeChart = useMemo(() => {
    const asOf = isAllDates || todayIso < filterTo ? todayIso : filterTo;
    const asOfKey = cumulativeChartViewMode === "yearly"
      ? asOf.slice(0, 4)
      : cumulativeChartViewMode === "monthly"
        ? asOf.slice(0, 7)
        : asOf;
    let actual = 0;
    let target = 0;
    let lastActualIndex = -1;
    const actualValues = cumulativeChartPeriod.values.map((value, index) => {
      const date = cumulativeChartPeriod.dates[index] ?? "";
      const key = cumulativeChartViewMode === "yearly"
        ? date.slice(0, 4)
        : cumulativeChartViewMode === "monthly"
          ? date.slice(0, 7)
          : date;
      if (key && key <= asOfKey) {
        actual += value;
        lastActualIndex = index;
      }
      return actual;
    });
    const targetValues = cumulativeChartPeriod.targets.map((value) => (target += value));
    const max = Math.max(10, Math.ceil(Math.max(...actualValues, ...targetValues, 1) / 10) * 10);
    return { actualValues, targetValues, max, totalActual: actual, totalTarget: target, lastActualIndex };
  }, [cumulativeChartPeriod, cumulativeChartViewMode, filterTo, isAllDates, todayIso]);

  const PLAN_YEAR = Number(todayIso.slice(0, 4));
  const planYearStart = `${PLAN_YEAR}-01-01`;
  const planYearEnd = `${PLAN_YEAR}-12-31`;
  // Thẻ tiến độ chỉ xét phần giao giữa bộ lọc đang chọn và năm hiện tại.
  const asOfDate = isAllDates || todayIso < filterTo ? todayIso : filterTo;
  const progressFrom = filterFrom > planYearStart ? filterFrom : planYearStart;
  const progressTo = asOfDate < planYearEnd ? asOfDate : planYearEnd;
  const hasProgressRange = progressFrom <= progressTo;
  const plannedTarget = useMemo(
    () => {
      if (!hasProgressRange) return 0;
      return selectedProjects.reduce((sum, project) => sum + scheduledWeldsInRange(project, planYearStart, planYearEnd), 0);
    },
    [hasProgressRange, planYearEnd, planYearStart, selectedProjects],
  );
  // Kế hoạch của năm hiện tại đến ngày chốt (hoặc đến cuối bộ lọc nếu kỳ đã kết thúc).
  const plannedToDate = useMemo(
    () => hasProgressRange
      ? selectedProjects.reduce((sum, project) => sum + scheduledWeldsInRange(project, progressFrom, progressTo), 0)
      : 0,
    [hasProgressRange, progressFrom, progressTo, selectedProjects],
  );
  const yesterdayDate = new Date(`${todayIso}T00:00:00`);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayIso = localIsoDate(yesterdayDate);
  // Đếm theo bản ghi nhật ký (1 dòng = 1 mối), đồng bộ với KPI tổng / bộ lọc.
  const todayTotal = showFastCharts
    ? fastRollupRows.reduce((sum, row) => (row.ngay_thuc_hien === todayIso ? sum + (row.so_moi ?? row.so_luong_thuc_hien ?? 0) : sum), 0)
    : selectedRows.reduce(
        (sum, row, index) => (getJournalRowDateIso(row, index) === todayIso ? sum + 1 : sum),
        0,
      );
  const yesterdayTotal = showFastCharts
    ? fastRollupRows.reduce((sum, row) => (row.ngay_thuc_hien === yesterdayIso ? sum + (row.so_moi ?? row.so_luong_thuc_hien ?? 0) : sum), 0)
    : selectedRows.reduce(
        (sum, row, index) => (getJournalRowDateIso(row, index) === yesterdayIso ? sum + 1 : sum),
        0,
      );
  const latestDailyPoint = [...dailySeries].reverse().find((point) => point.value > 0);
  const errorReasonRows = useMemo(
    () => showFastAggregate ? overviewAggregateErrorReasons : groupJournalDefectStats(detailRows),
    [detailRows, overviewAggregateErrorReasons, showFastAggregate],
  );

  const visibleSummary = showFastAggregate
    ? overviewAggregateSummary
    : showFastDaily
      ? fastSummary
      : summary;
  const total = visibleSummary.total;
  const passed = visibleSummary.passed;
  const failed = visibleSummary.errors;
  const rework = showFastAggregate
    ? overviewAggregateSummary.rework
    : showFastDaily
      ? fastSummary.rework
      : countReworkWelds(selectedRows);
  const productionWelds = useMemo(() => {
    if (showFastAggregate) {
      return {
        total: overviewAggregateSummary.productionTotal,
        passed: overviewAggregateSummary.productionPassed,
        failed: overviewAggregateSummary.productionFailed,
        tested: overviewAggregateSummary.productionPassed + overviewAggregateSummary.productionFailed,
      };
    }
    if (showFastDaily) return summarizeProductionRollup(fastRollupRows);
    return summarizeProductionWelds(selectedRows);
  }, [fastRollupRows, overviewAggregateSummary, selectedRows, showFastAggregate, showFastDaily]);

  // Sản lượng sản xuất thực tế trong năm hiện tại và khoảng ngày đang xét.
  const progressActual = useMemo(() => {
    if (showFastAggregate && isAllDates) return overviewProductionThisPlanYear;
    const projectByKey = new Map<string, (typeof selectedProjects)[number]>();
    for (const project of selectedProjects) {
      projectByKey.set(project.id, project);
      projectByKey.set(project.name, project);
    }
    let count = 0;
    selectedRows.forEach((row, index) => {
      if (row.loai_moi_han !== "Sản xuất") return;
      const project = (row.du_an_id && projectByKey.get(row.du_an_id)) || projectByKey.get(row.du_an);
      if (selectedProjects.length > 0 && !project) return;
      if (project) {
        const start = planStartDate(project);
        if (start && start > progressTo) return;
      }
      const iso = getJournalRowDateIso(row, index);
      if (iso) {
        if (!hasProgressRange || iso < progressFrom || iso > progressTo) return;
        if (project?.startDate && iso < project.startDate) return;
        if (project?.endDate && iso > project.endDate) return;
      } else if (!isAllDates) {
        const rowYearStart = `${row.nam_thuc_hien}-01-01`;
        const rowYearEnd = `${row.nam_thuc_hien}-12-31`;
        if (Number(row.nam_thuc_hien) !== PLAN_YEAR || progressFrom > rowYearStart || progressTo < rowYearEnd) return;
      } else if (Number(row.nam_thuc_hien) !== PLAN_YEAR) {
        return;
      } else if (!hasProgressRange || progressFrom > planYearStart || progressTo < planYearEnd) {
        // Dữ liệu chỉ có năm không thể lọc an toàn đến một ngày cụ thể.
        return;
      }
      count += 1;
    });
    return count;
  }, [hasProgressRange, isAllDates, overviewProductionThisPlanYear, planYearEnd, planYearStart, progressFrom, progressTo, selectedProjects, selectedRows, showFastAggregate]);

  const doneBeforePlanYear = useMemo(
    () => showFastAggregate
      ? overviewDoneBeforePlanYear
      : selectedRows.reduce(
          (sum, row) => (Number(row.nam_thuc_hien) < PLAN_YEAR ? sum + 1 : sum),
          0,
        ),
    [PLAN_YEAR, overviewDoneBeforePlanYear, selectedRows, showFastAggregate],
  );
  const productionDoneThisYear = useMemo(
    () => showFastAggregate
      ? overviewProductionThisPlanYear
      : selectedRows.reduce(
          (sum, row) => Number(row.nam_thuc_hien) === PLAN_YEAR && row.loai_moi_han === "Sản xuất" ? sum + 1 : sum,
          0,
        ),
    [PLAN_YEAR, overviewProductionThisPlanYear, selectedRows, showFastAggregate],
  );
  // Mẫu số đồng hồ tiến độ sản xuất = KH năm (lịch mối hàn trong năm hiện tại).
  const target = plannedTarget;
  const plannedDaySet = useMemo(() => {
    const days = new Set<string>();
    for (const project of selectedProjects) {
      for (const row of project.theoreticalProgress ?? []) {
        if (row.ngay >= filterFrom && row.ngay <= filterTo) {
          days.add(row.ngay);
        }
      }
      if ((project.theoreticalProgress ?? []).length === 0 && project.plannedWeldCount > 0) {
        const overlapStart = project.startDate > filterFrom ? project.startDate : filterFrom;
        const overlapEnd = project.endDate < filterTo ? project.endDate : filterTo;
        const count = projectDurationDays(overlapStart, overlapEnd);
        if (count > 0) {
          const start = new Date(`${overlapStart}T00:00:00`);
          for (let i = 0; i < count; i += 1) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.add(localIsoDate(d));
          }
        }
      }
    }
    return days;
  }, [filterFrom, filterTo, selectedProjects]);
  const plannedDays = plannedDaySet.size;
  const quota = plannedDays > 0 ? plannedTarget / plannedDays : dailySeries.length > 0 ? total / dailySeries.length : 0;
  const fixedDailyQuota = useMemo(() => {
    let welds = 0;
    let days = 0;
    if (!hasProgressRange) return 0;
    for (const project of selectedProjects) {
      const plannedRows = (project.theoreticalProgress ?? []).filter(
        (row) => row.so_moi_han > 0 && row.ngay >= planYearStart && row.ngay <= planYearEnd,
      );
      if (plannedRows.length === 0) continue;
      welds += plannedRows.reduce((sum, row) => sum + row.so_moi_han, 0);
      days += plannedRows.length;
    }
    return days > 0 ? Math.ceil(welds / days) : 0;
  }, [hasProgressRange, planYearEnd, planYearStart, selectedProjects]);
  const evaluableProjects = useMemo(
    () => selectedProjects.filter((project) => {
      if (!projectHasPlan(project)) return false;
      const start = planStartDate(project);
      return Boolean(start) && start <= asOfDate;
    }),
    [asOfDate, selectedProjects],
  );

  const progressPctNum = target > 0 ? (progressActual / target) * 100 : 0;
  const progressPct = formatPctNumber(progressPctNum);
  const statusPlannedToDate = evaluableProjects.reduce(
    (sum, project) => sum + (hasProgressRange ? scheduledWeldsInRange(project, progressFrom, progressTo) : 0),
    0,
  );
  const actualToDate = progressActual;
  const progressStatus =
    selectedProjects.length === 0 || evaluableProjects.length === 0
      ? null
      : statusPlannedToDate <= 0
        ? { label: "CHƯA ĐẾN KỲ KẾ HOẠCH", tone: "slate" as const }
        : actualToDate > statusPlannedToDate
          ? { label: "VƯỢT TIẾN ĐỘ", tone: "emerald" as const }
          : actualToDate === statusPlannedToDate
            ? { label: "ĐÚNG TIẾN ĐỘ", tone: "emerald" as const }
            : { label: "CHẬM TIẾN ĐỘ", tone: "amber" as const };

  const chart = useMemo(() => {
    // Tháng và năm dùng toàn bộ kỳ lọc; Ngày giữ cửa sổ xem gần nhất.
    const useYearlyBars = chartViewMode !== "daily";
    const slice = useYearlyBars ? chartPeriod.values : dailyValues;
    const targetSlice = useYearlyBars ? chartPeriod.targets : dailyTargets;
    const count = slice.length;
    const chartRangeLabel = useYearlyBars
      ? `${chartPeriod.fullLabels[0] ?? ""} – ${chartPeriod.fullLabels.at(-1) ?? ""} · sản lượng/${chartPeriod.unitLabel}`
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

    const cumValues: number[] = [];
    let cumRunning = 0;
    for (const value of slice) {
      cumRunning += value;
      cumValues.push(cumRunning);
    }
    const totalCum = cumValues[cumValues.length - 1] || 0;

    const targetPts = targetSlice.map((value, idx) => {
      const cx = count === 1 ? 250 : padX + idx * step;
      const cy = Math.max(6, plotH - (value / maxVal) * plotH);
      return { cx, cy, val: value };
    });
    const targetLinePath = targetPts.length > 0
      ? `M ${targetPts[0].cx} ${targetPts[0].cy} ${targetPts.slice(1).map((point) => `L ${point.cx} ${point.cy}`).join(" ")}`
      : "";
    const targetCumValues: number[] = [];
    let targetCumRunning = 0;
    for (const value of targetSlice) {
      targetCumRunning += value;
      targetCumValues.push(targetCumRunning);
    }
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
  }, [chartDateRange, chartPeriod, chartViewMode, dailySeries, dailyTargets, dailyValues]);

  const selectedDay =
    selectedDayIndex !== null && chart.dayPoints[selectedDayIndex]
      ? chart.dayPoints[selectedDayIndex]
      : null;

  function toggleDaySelection(idx: number) {
    setSelectedDayIndex((prev) => (prev === idx ? null : idx));
  }

  const chartDayCount = chart.dayPoints.length;
  const hasMonthlyAxis = chartViewMode === "monthly";
  // Nhãn MM/YYYY cần đủ chỗ ở mức zoom nhỏ nhất; các mốc vẫn cuộn cùng cột.
  const chartSlotWidth = hasMonthlyAxis ? 88 : chartViewMode === "yearly" ? 72 : 44;
  const basePlotWidth = Math.max(chartDayCount * chartSlotWidth, 1);
  const minChartZoom = plotViewportWidth > 0 ? Math.min(1, plotViewportWidth / basePlotWidth) : 1;
  const plotWidthPx = Math.max(plotViewportWidth, Math.round(basePlotWidth * chartZoom));
  const labelStep = Math.max(1, Math.ceil(chartSlotWidth * chartDayCount / Math.max(plotWidthPx, 1)));

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
          Math.max(minChartZoom, +(current * (event.deltaY < 0 ? 1.2 : 1 / 1.2)).toFixed(3)),
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
  }, [minChartZoom]);

  // Đường xu hướng nối đỉnh các cột
  const stackBars = chart.dailyStackBars;
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
        Math.max(minChartZoom, +(current * (dir === 1 ? 1.25 : 1 / 1.25)).toFixed(3)),
      ),
    );
  }

  const projectRows = useMemo(() => {
    const productionById = new Map<string, number>();
    const productionByName = new Map<string, number>();
    const qualityById = new Map<string, { passed: number; errors: number }>();
    const qualityByName = new Map<string, { passed: number; errors: number }>();
    if (showFastAggregate) {
      for (const row of yearByProject) {
        const amount = Number(row.san_xuat ?? 0);
        if (row.du_an_id) productionById.set(row.du_an_id, (productionById.get(row.du_an_id) ?? 0) + amount);
        const name = row.du_an?.trim();
        if (name) productionByName.set(name, (productionByName.get(name) ?? 0) + amount);
      }
      for (const project of overviewAggregateProjects) {
        const quality = { passed: project.passed, errors: project.errors };
        qualityById.set(project.id, quality);
        qualityByName.set(project.name, quality);
      }
    }
    const weldByName = showFastAggregate
      ? new Map<string, { total: number; passed: number; errors: number; rows: { nam_thuc_hien?: number | null }[] }>()
      : new Map(
          groupJournalRows(
            detailRows.filter((row) => row.loai_moi_han === "Sản xuất"),
            (row) => row.du_an.trim() || "Chưa gắn dự án",
          ).map((row) => [
            row.name,
            row,
          ]),
        );

    const fromDuAn = detailProjects.map((project, index) => {
      const weld = weldByName.get(project.name);
      return {
        id: project.id,
        name: project.name,
        maDuAn: project.maDuAn || "",
        location: project.location || "",
        status: project.status,
        planned: Math.max(0, Math.round(project.plannedWeldCount || 0)),
        count: showFastAggregate
          ? (productionById.get(project.id) ?? productionByName.get(project.name) ?? 0)
          : (weld?.total ?? 0),
        passed: showFastAggregate
          ? (qualityById.get(project.id)?.passed ?? qualityByName.get(project.name)?.passed ?? 0)
          : (weld?.passed ?? 0),
        errors: showFastAggregate
          ? (qualityById.get(project.id)?.errors ?? qualityByName.get(project.name)?.errors ?? 0)
          : (weld?.errors ?? 0),
        color: PROJECT_COLORS[index % PROJECT_COLORS.length],
        fromTable: true,
        year: projectPlanYear(project),
      };
    });

    const known = new Set(fromDuAn.map((row) => row.name));
    const orphans = [...weldByName.entries()]
      .filter(([name]) => name && !known.has(name))
      .map(([name, weld], index) => ({
        id: `journal-${name}`,
        name,
        maDuAn: "",
        location: "",
        status: "Từ nhật ký hàn",
        planned: 0,
        count: weld.total,
        passed: weld.passed,
        errors: weld.errors,
        color: PROJECT_COLORS[(fromDuAn.length + index) % PROJECT_COLORS.length],
        fromTable: false,
        year: weld.rows.reduce<number | null>((min, row) => {
          const year = Number(row.nam_thuc_hien);
          if (!Number.isInteger(year) || year < 1900) return min;
          return min === null || year < min ? year : min;
        }, null),
      }));

    return [...fromDuAn, ...orphans].sort(compareProjectYearDesc);
  }, [detailProjects, detailRows, overviewAggregateProjects, showFastAggregate, yearByProject]);

  const projectCount = selectedProjects.length;
  const plannedWeldsAll = useMemo(
    () =>
      selectedProjects.reduce((sum, project) => sum + Math.max(0, Math.round(project.plannedWeldCount || 0)), 0),
    [selectedProjects],
  );

  // Card DỰ ÁN:
  // - Đã thực hiện = số mối nhật ký của các năm trước năm hiện tại
  // - KH năm = mối hàn dự kiến của mọi dự án trong năm hiện tại
  // - KH dự kiến = Đã thực hiện + Đã thực hiện năm (Sản xuất), cùng mẫu số tiến độ sản xuất
  const projectChartRows = useMemo(
    () => projectRows.filter((row) => row.count > 0),
    [projectRows],
  );
  const projectChartTotal = useMemo(
    () => projectChartRows.reduce((sum, row) => sum + row.count, 0),
    [projectChartRows],
  );
  const projectDonutArcs = useMemo(
    () => buildDonutArcs(projectChartRows.map((row) => row.count)),
    [projectChartRows],
  );

  const statusDonutArcs = useMemo(
    () => buildDonutArcs([passed, rework, failed]),
    [passed, rework, failed],
  );

  const machineRows = useMemo(() => {
    if (showFastAggregate && overviewAggregateMachines.length > 0) {
      return overviewAggregateMachines
        .slice()
        .sort((a, b) => {
          const ai = REPORT_MACHINES.indexOf(a.code as (typeof REPORT_MACHINES)[number]);
          const bi = REPORT_MACHINES.indexOf(b.code as (typeof REPORT_MACHINES)[number]);
          return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
        })
        .map((machine) => {
          const passRate = machine.total > 0 ? Math.round(((machine.total - machine.errors) / machine.total) * 100) : 0;
          return {
            code: machine.code,
            total: fmt(machine.total),
            // Bảng tổng hợp máy không có chiều ngày; giữ dấu "—" để không
            // nhầm là hôm nay không có mối hàn.
            today: "—",
            errorRate: pctComma(machine.errors, machine.total),
            availLabel: `${passRate}%`,
            availPct: passRate,
            availColor: passRate >= 90 ? "#15803d" : "#d97706",
          };
        });
    }
    const todayRows = detailRows.filter(
      (row, index) => getJournalRowDateIso(row, index) === todayIso,
    );
    const todayByMachine = new Map(
      groupJournalRows(todayRows, machineForRow).map((machine) => [machine.name, machine.total]),
    );

    return groupJournalRows(detailRows, machineForRow)
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
  }, [detailRows, overviewAggregateMachines, showFastAggregate, todayIso]);

  const statusRows = [
    { name: "Đạt", color: "#15803d", value: fmt(passed), pct: pctComma(passed, total) },
    { name: "Hàn lại", color: "#d97706", value: fmt(rework), pct: pctComma(rework, total) },
    { name: "Không đạt", color: "#dc2626", value: fmt(failed), pct: pctComma(failed, total) },
  ];

  return (
    <div className="w-full min-w-0 px-3 sm:px-5 lg:px-6 py-3 sm:py-4 flex flex-col gap-4 text-slate-700 text-sm">
      <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${error || yearError || projectsError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-[#0047AB]"}`}>
        {error
          ? `Không tải được Supabase: ${error}`
          : projectsError
            ? `Dự án: ${projectsError}`
            : yearError
              ? `Tổng hợp năm: ${yearError} · chạy supabase/tong_moi_han_nam.sql`
              : loading || yearLoading || projectsLoading
                ? canSkipJournal
                  ? `Đang hoàn thiện số liệu dự án · ${fmt(total)} mối`
                  : showFastAggregate
                  ? `Đang hiển thị tổng hợp nhanh · ${fmt(total)} mối · chi tiết máy/lỗi đang tải nền…`
                  : showFastDaily
                  ? `Đang hiển thị nhanh theo ngày · ${fmt(total)} mối có ngày thực hiện · đang tải chi tiết…`
                  : "Đang tải dữ liệu Supabase…"
                : canSkipJournal
                  ? `Nhật ký hàn · ${fmt(total)} mối · ${fmt(projectCount)} dự án · ${fmt(passed)} đạt · ${fmt(failed)} không đạt`
                  : `Nhật ký hàn · ${selectedRows.length} bản ghi · ${fmt(projectCount)} dự án (bảng Dự án) · ${fmt(passed)} đạt · ${fmt(failed)} không đạt`}
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card: Dự án */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold tracking-wider text-violet-700 uppercase">
              DỰ ÁN
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
                {fmt(projectCount)}
              </div>
              <div className="text-xs font-medium text-slate-400">dự án</div>
            </div>
            {isAllDates ? (
              <div className="mt-2.5 space-y-1 text-xs">
                <div className="text-slate-500">
                  Đã thực hiện:{" "}
                  <span className="font-mono font-semibold text-slate-700">{fmt(doneBeforePlanYear)}</span> mối
                </div>
                <div className="text-slate-500">
                  Đã thực hiện {PLAN_YEAR} (Sản xuất):{" "}
                  <span className="font-mono font-semibold text-slate-700">{fmt(productionDoneThisYear)}</span> mối
                </div>
                <div className="text-violet-700 font-medium">
                  KH dự kiến {PLAN_YEAR}:{" "}
                  <span className="font-mono font-semibold">{fmt(doneBeforePlanYear + productionDoneThisYear)}</span> mối
                </div>
                <div className="text-slate-500">
                  KH năm {PLAN_YEAR}:{" "}
                  <span className="font-mono font-semibold text-slate-700">{fmt(plannedTarget)}</span> mối
                </div>
              </div>
            ) : (
              <div className="mt-2.5 text-xs text-violet-700 font-medium">
                KH trong kỳ lọc:{" "}
                <span className="font-mono font-semibold">{fmt(plannedWeldsAll)}</span> mối
              </div>
            )}
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 border border-violet-200">
            <Buildings size={24} weight="fill" aria-hidden />
          </div>
        </div>

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
            <div className="mt-2.5 text-xs text-slate-500">
              {showFastAggregate
                ? "Tổng các loại mối hàn · chi tiết đang tải nền"
                : showFastDaily
                  ? "Tổng các loại mối hàn · chi tiết đang tải"
                  : "Tổng các loại mối hàn"}
            </div>
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
                {fmt(productionWelds.passed)}
              </div>
              <div className="text-xs font-medium text-slate-400">mối</div>
            </div>
            <div className="mt-2.5 text-xs text-slate-500">
              <span className="text-xl font-bold text-emerald-700 font-mono tabular-nums">{productionWelds.tested > 0 ? pctComma(productionWelds.passed, productionWelds.tested) : "—"}</span> số mối sx đã thí nghiệm
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
                {fmt(productionWelds.failed)}
              </div>
              <div className="text-xs font-medium text-slate-400">mối</div>
            </div>
            <div className="mt-2.5 text-xs text-slate-500">
              <span className="text-xl font-bold text-rose-700 font-mono tabular-nums">{productionWelds.total > 0 ? pctComma(productionWelds.failed, productionWelds.total) : "—"}</span> lỗi / tổng mối hàn sx
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={24} weight="fill" aria-hidden />
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold text-amber-700">MỐI HÀN LẠI</div>
          <div className="mt-2 text-3xl font-bold font-mono">{fmt(rework)} <span className="text-xs text-slate-400">mối</span></div>
          <div className="mt-2 text-xs text-slate-500">Có mối hàn liên kết</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold tracking-wider text-amber-700">CHỜ THÍ NGHIỆM</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums">{fmt(visibleSummary.pending)}</span>
            <span className="text-xs text-slate-400">mối</span>
          </div>
          <div className="mt-2.5 text-xs text-slate-500">Không tính vào tỷ lệ đạt / lỗi</div>
        </div>
      </div>

      {/* Tổng quan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* Box 1: TIẾN ĐỘ SẢN XUẤT */}
        <div className="order-1 rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs flex flex-col min-w-0">
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
                {fmt(progressActual)} / {fmt(target)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {`KH năm ${PLAN_YEAR} · ${fmt(selectedProjects.length)} dự án: ${fmt(target)} mối`}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-3.5">
              <div>
                <div className="text-xs text-slate-500">Còn lại</div>
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                    {fmt(Math.max(0, target - progressActual))}
                  </span>
                  <span className="text-xs text-slate-400">mối</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Kế hoạch trung bình/ngày</div>
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                    {fmt(fixedDailyQuota)}
                  </span>
                  <span className="text-xs text-slate-400">mối/ngày</span>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-500">Trạng thái</div>
                {progressStatus ? (
                  <>
                    <div
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide shadow-2xs ${
                        progressStatus.tone === "emerald"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : progressStatus.tone === "amber"
                            ? "bg-amber-50 border-amber-200 text-amber-800"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          progressStatus.tone === "emerald"
                            ? "bg-emerald-500"
                            : progressStatus.tone === "amber"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                        }`}
                      />
                      {progressStatus.label}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      Chú thích: {isAllDates
                        ? `Năm ${PLAN_YEAR} đến ${viDate(asOfDate)}`
                        : `${viDate(progressFrom)}–${viDate(progressTo)}`} · thực hiện {fmt(actualToDate)} / kế hoạch {fmt(statusPlannedToDate)} mối hàn.
                    </p>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-slate-500">
                    {selectedProjects.length === 0 ? "Không có dự án để đánh giá" : "Chưa đến ngày bắt đầu kế hoạch"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Box 2: SẢN LƯỢNG HÀN THEO NGÀY / LŨY KẾ */}
        <div className="order-3 rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2 text-sm sm:text-base font-bold tracking-tight text-slate-900">
              <span>
                {chartViewMode === "daily"
                  ? "SẢN LƯỢNG HÀN THEO NGÀY"
                  : chartViewMode === "yearly"
                    ? "SẢN LƯỢNG HÀN THEO NĂM"
                    : "SẢN LƯỢNG HÀN THEO THÁNG"}
              </span>
              {showFastDaily && chartViewMode === "daily" ? (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold tracking-normal text-[#0047AB]">
                  Đang tải nhanh
                </span>
              ) : null}
            </div>

            {/* Ngày | Tháng | Năm */}
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
              <button type="button" onClick={() => setChartViewMode("monthly")} className={`h-7 px-2.5 text-xs font-semibold rounded-lg ${chartViewMode === "monthly" ? "bg-white text-[#0047AB] shadow-xs" : "text-slate-600"}`}>Tháng</button>
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
                    {chartViewMode === "daily" ? "Số liệu ngày" : chartViewMode === "yearly" ? "Số liệu năm" : "Số liệu tháng"}
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
                <>
                    <div className="rounded-md bg-white/90 border border-slate-200/80 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-500">
                        {chartViewMode === "yearly" ? "Sản lượng năm" : chartViewMode === "monthly" ? "Sản lượng tháng" : "Sản lượng ngày"}
                      </p>
                      <p className="font-mono text-sm font-bold text-[#0047AB] tabular-nums">{fmt(selectedDay.daily)}</p>
                    </div>
                    <div className="rounded-md bg-white/90 border border-slate-200/80 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-500">
                        {chartViewMode === "yearly" ? "Mục tiêu năm" : chartViewMode === "monthly" ? "Mục tiêu tháng" : "Mục tiêu ngày"}
                      </p>
                      <p className="font-mono text-sm font-bold text-slate-700 tabular-nums">{fmt(selectedDay.dailyTarget)}</p>
                    </div>
                </>
              </div>
            </div>
          ) : null}

          {/* Chart Plot */}
          <div className="mt-2 flex">
            {/* Trục Y cố định — không cuộn theo biểu đồ */}
            <div className="relative h-[260px] w-10 shrink-0 select-none font-mono text-[11px] font-normal text-slate-900">
              {(() => {
                const axisMax = chart.maxVal;
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
              {chartDayCount === 0 || (chartViewMode === "daily" && dailySeries.length > 0 && dailySeries.every((p) => p.value === 0 && (!dailyTargets || dailyTargets.every((t) => t === 0)))) ? (
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
                  const bars = chart.dailyStackBars;
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
              <div className="relative h-12 pt-2 pb-0.5">
                {chart.dayPoints.filter((dp) => {
                  if (labelStep === 1) return true;
                  const center = ((dp.idx + 0.5) / chartDayCount) * plotWidthPx;
                  return dp.idx % labelStep === Math.floor(labelStep / 2)
                    && center >= chartSlotWidth / 2
                    && center <= plotWidthPx - chartSlotWidth / 2;
                }).map((dp) => (
                  <button
                    key={dp.idx}
                    type="button"
                    onClick={() => toggleDaySelection(dp.idx)}
                    style={{
                      left: `${(dp.idx / Math.max(chartDayCount, 1)) * 100}%`,
                      width: `${100 / Math.max(chartDayCount, 1)}%`,
                    }}
                    title={dp.dateFull}
                    aria-label={dp.dateFull}
                    className={`absolute rounded py-1 text-center text-[11px] leading-4 font-mono transition-colors cursor-pointer ${hasMonthlyAxis ? "min-h-10 whitespace-normal" : "whitespace-nowrap"} ${
                      selectedDayIndex === dp.idx
                        ? "bg-[#0047AB] text-white font-semibold"
                        : "text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <span className="relative left-1/2 block -translate-x-1/2" style={{ width: `${Math.min(chartSlotWidth, plotWidthPx)}px` }}>
                      {dp.dateShort}
                    </span>
                  </button>
                ))}
              </div>
                </>
              )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-sm font-medium text-slate-900">
                <button
                  type="button"
                  onClick={() => setChartZoom(minChartZoom)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50 cursor-pointer"
                >
                  Xem toàn bộ
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => stepZoom(-1)}
                    disabled={chartZoom <= minChartZoom}
                    className="h-7 w-7 rounded-md border border-slate-300 text-base leading-none text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Thu nhỏ"
                  >
                    −
                  </button>
                  <span className="w-10 text-center font-mono tabular-nums font-semibold text-slate-900">
                    {chartZoom.toFixed(chartZoom < 0.1 ? 2 : 1)}×
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

        {/* Box 3: MỐI HÀN THEO DỰ ÁN */}
        <div className="order-2 rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              MỐI HÀN THEO DỰ ÁN
            </div>
            <div className="text-[11px] font-semibold text-slate-500">
              <span className="font-mono text-[#0047AB]">{fmt(projectRows.length)}</span> dự án
            </div>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Xếp theo năm bắt đầu · thực tế chỉ tính mối sản xuất · dự kiến là tổng mối hàn dự kiến của dự án
          </p>

          <div className="mt-3.5 flex justify-center">
            <div className="relative h-[126px] w-[126px]">
              <svg viewBox="0 0 140 140" className="block h-[126px] w-[126px]">
                <circle cx="70" cy="70" r="52" fill="none" stroke="#f1f5f9" strokeWidth="20" />
                {projectDonutArcs.map((arc, index) => (
                  <circle
                    key={projectChartRows[index]?.id ?? index}
                    cx="70"
                    cy="70"
                    r="52"
                    fill="none"
                    stroke={projectChartRows[index]?.color ?? "#cbd5e1"}
                    strokeWidth="20"
                    strokeDasharray={arc.dasharray}
                    transform={arc.transform}
                  />
                ))}
              </svg>
              <div className="absolute left-0 right-0 top-[46px] text-center font-mono text-lg sm:text-xl font-bold leading-none tabular-nums text-slate-900">
                {fmt(projectChartTotal)}
              </div>
              <div className="absolute left-0 right-0 top-[66px] text-center text-xs font-medium text-slate-500">
                Tổng
              </div>
            </div>
          </div>

          <div className="mt-4 flex max-h-[220px] flex-col gap-2.5 overflow-y-auto">
            {projectRows.length > 0 ? (
              projectRows.map((row, index) => {
                const progressPct = row.planned > 0 ? Math.min(100, (row.count / row.planned) * 100) : 0;
                const yearLabel = row.year ? String(row.year) : "Chưa có năm";
                const showYear = index === 0 || projectRows[index - 1]?.year !== row.year;
                return (
                  <div key={row.id} className="text-xs sm:text-sm">
                    {showYear ? (
                      <div className="mb-1 font-mono text-[11px] font-semibold text-[#0047AB]">{yearLabel}</div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: row.color }}
                      />
                      <span
                        className="min-w-0 flex-1 truncate font-medium leading-snug text-slate-700"
                        title={row.name}
                      >
                        {row.name}
                      </span>
                      <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-slate-700">
                        {fmt(row.count)}/{fmt(row.planned)}
                      </span>
                    </div>
                    <div className="mt-1.5 ml-4 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${progressPct}%`, background: row.color }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-4 text-center text-xs text-slate-500">Chưa có dữ liệu dự án</div>
            )}
          </div>
        </div>

        {/* Box 4: LŨY KẾ SẢN LƯỢNG HÀN */}
        <div className="order-4 rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              LŨY KẾ SẢN LƯỢNG HÀN
            </div>
            <div className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100/90 p-0.5 shadow-2xs">
              {([
                ["daily", "Ngày", CalendarBlank],
                ["monthly", "Tháng", CalendarBlank],
                ["yearly", "Năm", CalendarCheck],
              ] as const).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCumulativeChartViewMode(mode)}
                  className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all cursor-pointer ${
                    cumulativeChartViewMode === mode ? "bg-white text-[#0047AB] shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon size={13} weight="bold" aria-hidden />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-2 text-sm font-semibold text-[#0047AB]">
            Lũy kế toàn kỳ: {fmt(cumulativeChart.totalActual)} mối · Kế hoạch: {fmt(cumulativeChart.totalTarget)} mối
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-7 gap-y-1.5 text-xs text-slate-600">
            <span className="flex items-center gap-2"><span className="h-3 w-3.5 rounded-xs bg-[#3b82f6]" />Thực tế</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3.5 rounded-xs bg-[#fcd34d]" />Dự kiến</span>
          </div>

          {cumulativeChart.actualValues.length === 0 ? (
            <div className="mt-4 flex h-[260px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm font-semibold text-slate-700">
              Chưa có dữ liệu sản lượng trong khoảng thời gian này
            </div>
          ) : (
            <>
              <div className="mt-3 flex">
                <div className="relative h-[260px] w-10 shrink-0 select-none font-mono text-[11px] text-slate-900">
                  {[[0, cumulativeChart.max], [52, Math.round(cumulativeChart.max * .8)], [104, Math.round(cumulativeChart.max * .6)], [156, Math.round(cumulativeChart.max * .4)], [208, Math.round(cumulativeChart.max * .2)], [253, 0]].map(([top, value]) => (
                    <span key={top} className="absolute left-0 tabular-nums" style={{ top }}>{fmt(value)}</span>
                  ))}
                </div>
                <div className="min-w-0 flex-1 overflow-x-auto">
                  <div className="relative" style={{ width: `${500 * cumulativeChartZoom}px`, minWidth: "100%" }}>
                    <svg viewBox="0 0 500 260" preserveAspectRatio="none" className="h-[260px] w-full overflow-visible">
                      {[0.5, 52, 104, 156, 208, 259.5].map((y) => <line key={y} x1="0" y1={y} x2="500" y2={y} stroke={y === 259.5 ? "#cbd5e1" : "#f1f5f9"} strokeWidth="1" />)}
                      {cumulativeChart.actualValues.map((actual, index) => {
                        const showActual = index <= cumulativeChart.lastActualIndex;
                        const actualValue = showActual ? actual : 0;
                        const target = cumulativeChart.targetValues[index] ?? 0;
                        const band = 500 / cumulativeChart.actualValues.length;
                        const blueH = showActual && actualValue > 0 ? Math.max(2, actualValue / cumulativeChart.max * 260) : 0;
                        const yellowH = target > actualValue ? Math.max(2, (target - actualValue) / cumulativeChart.max * 260) : 0;
                        return <g key={index}>
                          {yellowH > 0 && <rect x={band * index + band * .27} y={260 - blueH - yellowH} width={band * .46} height={yellowH} fill="#fcd34d" />}
                          {blueH > 0 && <rect x={band * index + band * .27} y={260 - blueH} width={band * .46} height={blueH} fill="#3b82f6" />}
                        </g>;
                      })}
                      <path
                        d={cumulativeChart.targetValues.map((value, index) => `${index ? "L" : "M"} ${(500 / cumulativeChart.targetValues.length) * (index + .5)} ${Math.max(6, 260 - value / cumulativeChart.max * 260)}`).join(" ")}
                        fill="none"
                        stroke="#e08e0b"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      {cumulativeChart.lastActualIndex >= 0 ? (
                        <path
                          d={cumulativeChart.actualValues.slice(0, cumulativeChart.lastActualIndex + 1).map((value, index) => `${index ? "L" : "M"} ${(500 / cumulativeChart.actualValues.length) * (index + .5)} ${Math.max(6, 260 - value / cumulativeChart.max * 260)}`).join(" ")}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="2.25"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null}
                    </svg>
                    <div className="relative h-12 pt-2">
                      {cumulativeChartPeriod.labels.map((label, index) => ({ label, index })).filter(({ index }) => cumulativeChartPeriod.labels.length <= 8 || index % Math.ceil(cumulativeChartPeriod.labels.length / 8) === 0).map(({ label, index }) => (
                        <span key={`${label}-${index}`} className="absolute text-center font-mono text-[11px] text-slate-900" style={{ left: `${index / cumulativeChartPeriod.labels.length * 100}%`, width: `${100 / cumulativeChartPeriod.labels.length}%` }}>{label}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-sm font-medium text-slate-900">
            <button
              type="button"
              onClick={() => setCumulativeChartZoom(1)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50 cursor-pointer"
            >
              Xem toàn bộ
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCumulativeChartZoom((zoom) => Math.max(1, +(zoom / 1.25).toFixed(1)))}
                disabled={cumulativeChartZoom <= 1}
                className="h-7 w-7 rounded-md border border-slate-300 text-base leading-none text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Thu nhỏ biểu đồ lũy kế"
              >
                −
              </button>
              <span className="w-10 text-center font-mono tabular-nums font-semibold text-slate-900">
                {cumulativeChartZoom.toFixed(1)}×
              </span>
              <button
                type="button"
                onClick={() => setCumulativeChartZoom((zoom) => Math.min(CHART_ZOOM_MAX, +(zoom * 1.25).toFixed(1)))}
                disabled={cumulativeChartZoom >= CHART_ZOOM_MAX}
                className="h-7 w-7 rounded-md border border-slate-300 text-base leading-none text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Phóng to biểu đồ lũy kế"
              >
                +
              </button>
              {cumulativeChartZoom !== 1 && (
                <button
                  type="button"
                  onClick={() => setCumulativeChartZoom(1)}
                  className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50 cursor-pointer"
                >
                  Đặt lại
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chi tiết mối hàn theo dự án */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              MỐI HÀN THEO DỰ ÁN — CHI TIẾT
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Nguồn bảng Dự án · KH và sản lượng đều theo kỳ / bộ lọc đang chọn
              {detailsPending ? " · đang tính các ô chi tiết…" : ""}
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-600">
            <span className="font-mono text-[#0047AB]">{fmt(projectCount)}</span> dự án ·{" "}
            <span className="font-mono text-[#0047AB]">{fmt(projectRows.reduce((s, r) => s + r.count, 0))}</span> mối
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="w-12 px-3.5 py-2.5">#</th>
                  <th className="min-w-[280px] px-3.5 py-2.5">Tên dự án</th>
                  <th className="min-w-[110px] px-3.5 py-2.5">Mã</th>
                  <th className="min-w-[120px] px-3.5 py-2.5">Trạng thái</th>
                  <th className="px-3.5 py-2.5 text-right">{isAllDates ? "KH dự kiến" : "KH kỳ lọc"}</th>
                  <th className="px-3.5 py-2.5 text-right">Thực hiện SX</th>
                  <th className="px-3.5 py-2.5 text-right">Đạt</th>
                  <th className="px-3.5 py-2.5 text-right">Lỗi</th>
                  <th className="min-w-[120px] px-3.5 py-2.5">Tỷ lệ đạt / đã test</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectRows.map((row, index) => {
                  const tested = row.passed + row.errors;
                  const rate = tested > 0 ? (row.passed / tested) * 100 : 0;
                  return (
                    <tr key={row.id} className="align-top hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-3 font-mono text-slate-400">{index + 1}</td>
                      <td className="px-3.5 py-3">
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: row.color }}
                          />
                          <div>
                            <div className="font-semibold text-slate-900 leading-snug break-words whitespace-normal">
                              {row.name}
                            </div>
                            {row.location && row.location !== "here" ? (
                              <div className="mt-0.5 text-[11px] text-slate-500">{row.location}</div>
                            ) : null}
                            {!row.fromTable ? (
                              <div className="mt-0.5 text-[11px] text-amber-700">Chỉ có trong nhật ký hàn</div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 font-mono text-slate-600">
                        {row.maDuAn || "—"}
                      </td>
                      <td className="px-3.5 py-3">
                        <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${projectStatusClass(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono tabular-nums text-slate-700">
                        {fmt(row.planned)}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-bold tabular-nums text-[#0047AB]">
                        {fmt(row.count)}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono tabular-nums text-emerald-700">
                        {fmt(row.passed)}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono tabular-nums text-rose-700">
                        {fmt(row.errors)}
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="w-16 text-right font-mono text-sm tabular-nums text-slate-600">
                            {tested > 0 ? `${rate.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%` : "—"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {projectRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                      Chưa có dự án trong bảng Dự án / kỳ lọc hiện tại.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3-column Grid: Máy, Lỗi hàn, Trạng thái */}
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
          <p className="mt-0.5 text-xs text-slate-500">Theo mã khuyết tật NDT</p>
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
                Không có khuyết tật trong nhật ký hàn đã lọc.
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
