"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const PROJECTS = [
  "ĐSCT Bắc – Nam",
  "Dự án ga Đà Nẵng",
  "Dự án đường sắt Bắc Nam",
  "Khu vực depot Hà Nội",
  "Tuyến metro số 1",
];

const PERSONNEL = [
  "Trần Thị Mai Anh",
  "Nguyễn Văn Minh",
  "Trần Văn C",
  "Phạm Văn B",
  "Lê Thị Kim Anh",
  "Phạm Văn Minh",
  "Trần Quốc Bảo",
];

const PLANTS = ["Nhà máy Hà Nội", "Nhà máy Đà Nẵng", "Nhà máy TP.HCM"];

const PROJECT_W: Record<string, number> = {
  "ĐSCT Bắc – Nam": 0.38,
  "Dự án ga Đà Nẵng": 0.22,
  "Dự án đường sắt Bắc Nam": 0.18,
  "Khu vực depot Hà Nội": 0.12,
  "Tuyến metro số 1": 0.1,
};

const PLANT_W: Record<string, number> = {
  "Nhà máy Hà Nội": 0.42,
  "Nhà máy Đà Nẵng": 0.33,
  "Nhà máy TP.HCM": 0.25,
};

const PERSON_W: Record<string, number> = {
  "Trần Thị Mai Anh": 0.14,
  "Nguyễn Văn Minh": 0.12,
  "Trần Văn C": 0.1,
  "Phạm Văn B": 0.11,
  "Lê Thị Kim Anh": 0.09,
  "Phạm Văn Minh": 0.13,
  "Trần Quốc Bảo": 0.08,
};

const BASE = {
  total: 18520,
  today: 126,
  month: 3240,
  passed: 18310,
  failed: 42,
  pending: 168,
  target: 22500,
  quota: 118,
};

const CHART_BASE = [
  128, 148, 138, 158, 176, 150, 142, 156, 168, 152, 132, 146, 190, 168, 158,
  150, 120, 112, 126, 146, 164, 152, 140, 158, 176, 166, 152, 142, 176, 164,
];
const CHART_PERIOD_START = "2024-05-01";
const CHART_PERIOD_END = "2024-05-30";

const PLANT_ROWS = [
  { name: "Cổ Loa – Xưởng A", share: 0.347, color: "#0047AB", plants: ["Nhà máy Hà Nội"] },
  { name: "Cổ Loa – Xưởng B", share: 0.239, color: "#38bdf8", plants: ["Nhà máy Hà Nội"] },
  { name: "Hạ Long Xanh – Xưởng C", share: 0.269, color: "#10b981", plants: ["Nhà máy Đà Nẵng"] },
  { name: "Hạ Long Xanh – Xưởng D", share: 0.109, color: "#8b5cf6", plants: ["Nhà máy Đà Nẵng"] },
  { name: "Khác", share: 0.037, color: "#f59e0b", plants: ["Nhà máy TP.HCM"] },
];

const PERSONNEL_ROWS = [
  { name: "Trần Thị Mai Anh", initials: "MA", bg: "#eff6ff", fg: "#0047AB", meta: "K922-1 · Cổ Loa", welds: 62, timeAgo: "2 phút trước", plants: ["Nhà máy Hà Nội"], projects: ["ĐSCT Bắc – Nam"] },
  { name: "Nguyễn Văn Minh", initials: "VM", bg: "#f0fdf4", fg: "#15803d", meta: "K922-2 · Hạ Long Xanh", welds: 51, timeAgo: "3 phút trước", plants: ["Nhà máy Đà Nẵng"], projects: ["Dự án ga Đà Nẵng"] },
  { name: "Trần Văn C", initials: "VC", bg: "#fef2f2", fg: "#b91c1c", meta: "K922-2 · Hạ Long Xanh", welds: 28, timeAgo: "5 phút trước", plants: ["Nhà máy Đà Nẵng"], projects: ["Dự án ga Đà Nẵng"] },
  { name: "Phạm Văn B", initials: "VB", bg: "#f5f3ff", fg: "#6d28d9", meta: "K922-1 · Cổ Loa", welds: 44, timeAgo: "6 phút trước", plants: ["Nhà máy Hà Nội"], projects: ["ĐSCT Bắc – Nam"] },
  { name: "Lê Thị Kim Anh", initials: "KA", bg: "#fffbeb", fg: "#b45309", meta: "K920 · Cổ Loa · Kiểm tra UT", welds: 13, timeAgo: "8 phút trước", plants: ["Nhà máy Hà Nội"], projects: ["Khu vực depot Hà Nội"] },
];

const MACHINE_ROWS = [
  { code: "K922-1", totalShare: 0.46, todayShare: 0.49, errorRate: "0,18%", avail: 96, plants: ["Nhà máy Hà Nội"] },
  { code: "K922-2", totalShare: 0.42, todayShare: 0.4, errorRate: "0,25%", avail: 93, plants: ["Nhà máy Đà Nẵng"] },
  { code: "K920", totalShare: 0.12, todayShare: 0.11, errorRate: "0,31%", avail: 88, plants: ["Nhà máy TP.HCM"] },
];

const RECENT_WELDS = [
  {
    id: "FBW-18520",
    dateTime: "31/05/2024 14:32",
    plant: "Cổ Loa",
    machine: "K922-1",
    railType: "60E1",
    heatNo: "HEAT-240501-12",
    operator: "Nguyen Van A",
    result: "ĐẠT",
    resultType: "pass",
    ut: true,
    visual: true,
  },
  {
    id: "FBW-18519",
    dateTime: "31/05/2024 14:18",
    plant: "Cổ Loa",
    machine: "K922-1",
    railType: "60E1",
    heatNo: "HEAT-240501-12",
    operator: "Pham Van B",
    result: "ĐẠT",
    resultType: "pass",
    ut: true,
    visual: true,
  },
  {
    id: "FBW-18518",
    dateTime: "31/05/2024 14:05",
    plant: "Hạ Long Xanh",
    machine: "K922-2",
    railType: "60E1",
    heatNo: "HEAT-240501-08",
    operator: "Tran Van C",
    result: "KHÔNG ĐẠT",
    resultType: "fail",
    ut: false,
    visual: true,
  },
  {
    id: "FBW-18517",
    dateTime: "31/05/2024 13:47",
    plant: "Cổ Loa",
    machine: "K920",
    railType: "50N",
    heatNo: "HEAT-240501-05",
    operator: "Le Van D",
    result: "ĐẠT",
    resultType: "pass",
    ut: true,
    visual: true,
  },
];

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

function viDateShortFromIndex(dayOffset: number) {
  const d = new Date(CHART_PERIOD_START + "T00:00:00");
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function clampChartDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const start = new Date(CHART_PERIOD_START + "T00:00:00");
  const end = new Date(CHART_PERIOD_END + "T00:00:00");
  if (d < start) return CHART_PERIOD_START;
  if (d > end) return CHART_PERIOD_END;
  return iso;
}

function chartDayIndex(iso: string) {
  const start = new Date(CHART_PERIOD_START + "T00:00:00");
  const d = new Date(iso + "T00:00:00");
  return Math.round((d.getTime() - start.getTime()) / 86400000);
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

function sumWeight(map: Record<string, number>, keys: string[]) {
  return keys.reduce((acc, k) => acc + (map[k] ?? 0), 0);
}

export default function OverviewDashboard() {
  const [dateFrom, setDateFrom] = useState(CHART_PERIOD_START);
  const [dateTo, setDateTo] = useState(CHART_PERIOD_END);
  const [projects, setProjects] = useState<string[]>([]);
  const [personnel, setPersonnel] = useState<string[]>([]);
  const [plants, setPlants] = useState<string[]>([]);

  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: CHART_PERIOD_START,
    dateTo: CHART_PERIOD_END,
    projects: [] as string[],
    personnel: [] as string[],
    plants: [] as string[],
  });

  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const [personnelFilterOpen, setPersonnelFilterOpen] = useState(false);
  const [plantFilterOpen, setPlantFilterOpen] = useState(false);

  const filterBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setProjectFilterOpen(false);
        setPersonnelFilterOpen(false);
        setPlantFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleList(type: "projects" | "personnel" | "plants", item: string) {
    if (type === "projects") {
      setProjects((prev) =>
        prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
      );
    } else if (type === "personnel") {
      setPersonnel((prev) =>
        prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
      );
    } else {
      setPlants((prev) =>
        prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
      );
    }
  }

  function handleApplyFilters() {
    setAppliedFilters({
      dateFrom,
      dateTo,
      projects,
      personnel,
      plants,
    });
    setProjectFilterOpen(false);
    setPersonnelFilterOpen(false);
    setPlantFilterOpen(false);
  }

  function handleClearFilters() {
    setDateFrom(CHART_PERIOD_START);
    setDateTo(CHART_PERIOD_END);
    setProjects([]);
    setPersonnel([]);
    setPlants([]);
    setAppliedFilters({
      dateFrom: CHART_PERIOD_START,
      dateTo: CHART_PERIOD_END,
      projects: [],
      personnel: [],
      plants: [],
    });
    setProjectFilterOpen(false);
    setPersonnelFilterOpen(false);
    setPlantFilterOpen(false);
  }

  const factor = useMemo(() => {
    let f = 1;
    if (appliedFilters.projects.length) {
      f *= sumWeight(PROJECT_W, appliedFilters.projects);
    }
    if (appliedFilters.plants.length) {
      f *= sumWeight(PLANT_W, appliedFilters.plants);
    }
    if (appliedFilters.personnel.length) {
      f *= sumWeight(PERSON_W, appliedFilters.personnel);
    }
    if (appliedFilters.dateFrom && appliedFilters.dateTo) {
      const d1 = new Date(appliedFilters.dateFrom + "T00:00:00");
      const d2 = new Date(appliedFilters.dateTo + "T00:00:00");
      const days = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
      f *= Math.min(1.2, Math.max(0.08, days / 30));
    }
    return Math.max(0.05, Math.min(2.5, f));
  }, [appliedFilters]);

  const total = Math.max(1, Math.round(BASE.total * factor));
  const today = Math.max(0, Math.round(BASE.today * factor));
  const month = Math.max(1, Math.round(BASE.month * factor));
  const passed = Math.max(1, Math.round(BASE.passed * factor));
  const failed = Math.max(0, Math.round(BASE.failed * factor));
  const pending = Math.max(0, Math.round(BASE.pending * factor));

  const progressPct = ((total / BASE.target) * 100)
    .toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .replace(".", ",");
  const progressPctNum = (total / BASE.target) * 100;

  const chart = useMemo(() => {
    const fromClamped = clampChartDate(appliedFilters.dateFrom || CHART_PERIOD_START);
    const toClamped = clampChartDate(appliedFilters.dateTo || CHART_PERIOD_END);
    const iStart = Math.min(chartDayIndex(fromClamped), chartDayIndex(toClamped));
    const iEnd = Math.max(chartDayIndex(fromClamped), chartDayIndex(toClamped));
    const slice = CHART_BASE.slice(iStart, iEnd + 1);
    const count = slice.length;

    let chartRangeLabel = `${viDate(CHART_PERIOD_START)} – ${viDate(CHART_PERIOD_END)}`;
    if (appliedFilters.dateFrom && appliedFilters.dateTo) {
      chartRangeLabel = `${viDate(appliedFilters.dateFrom)} – ${viDate(appliedFilters.dateTo)}`;
    }

    if (count === 0) {
      return {
        chartRangeLabel,
        bars: [],
        dots: [],
        linePath: "",
        areaPath: "",
        chartLabels: [],
      };
    }

    const maxVal = 250;
    const plotH = 190;
    const padX = 14;
    const plotW = 500 - padX * 2;
    const step = count > 1 ? plotW / (count - 1) : 0;

    const bars = slice.map((val, idx) => {
      const scaledVal = Math.round(val * factor);
      const h = Math.min(plotH - 8, Math.max(4, (scaledVal / maxVal) * plotH));
      const cx = count === 1 ? 250 : padX + idx * step;
      const x = cx - 2.5;
      const y = plotH - h;
      return { x, y, h, val: scaledVal };
    });

    const pts = slice.map((val, idx) => {
      const scaledVal = Math.round(val * factor);
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

    const maPts = slice.map((_, idx) => {
      const windowStart = Math.max(0, idx - 6);
      const win = slice.slice(windowStart, idx + 1);
      const avg = win.reduce((a, b) => a + b, 0) / win.length;
      const scaledAvg = avg * factor;
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

    const fullLabels: string[] = [];
    for (let k = 0; k < count; k++) {
      fullLabels.push(viDateShortFromIndex(iStart + k));
    }
    const chartLabels = sampleChartLabels(fullLabels, 8);

    return {
      chartRangeLabel,
      bars,
      dots: pts,
      linePath,
      areaPath,
      chartLabels,
    };
  }, [appliedFilters, factor]);

  const plantRows = useMemo(() => {
    let rows = PLANT_ROWS;
    if (appliedFilters.plants.length) {
      rows = rows.filter((r) => r.plants.some((p) => appliedFilters.plants.includes(p)));
    }
    return rows.map((r) => ({
      name: r.name,
      color: r.color,
      value: fmt(Math.round(total * r.share)),
      pct: pctComma(Math.round(total * r.share), total),
    }));
  }, [appliedFilters.plants, total]);

  const machineRows = useMemo(() => {
    let list = MACHINE_ROWS;
    if (appliedFilters.plants.length) {
      list = list.filter((m) => m.plants.some((p) => appliedFilters.plants.includes(p)));
    }
    return list.map((m) => ({
      code: m.code,
      total: fmt(Math.round(total * m.totalShare)),
      today: fmt(Math.round(today * m.todayShare)),
      errorRate: m.errorRate,
      availLabel: `${m.avail}%`,
      availPct: m.avail,
      availColor: m.avail >= 90 ? "#15803d" : "#d97706",
    }));
  }, [appliedFilters.plants, total, today]);

  const personnelRows = useMemo(() => {
    let list = PERSONNEL_ROWS;
    if (appliedFilters.plants.length) {
      list = list.filter((p) => p.plants.some((pl) => appliedFilters.plants.includes(pl)));
    }
    if (appliedFilters.projects.length) {
      list = list.filter((p) => p.projects.some((pr) => appliedFilters.projects.includes(pr)));
    }
    return list.map((p) => ({
      name: p.name,
      initials: p.initials,
      bg: p.bg,
      fg: p.fg,
      meta: p.meta,
      welds: Math.max(1, Math.round(p.welds * factor)),
      timeAgo: p.timeAgo,
    }));
  }, [appliedFilters.plants, appliedFilters.projects, factor]);

  const statusRows = [
    { name: "Đạt", color: "#15803d", value: fmt(passed), pct: pctComma(passed, total) },
    { name: "Chờ kiểm tra", color: "#d97706", value: fmt(pending), pct: pctComma(pending, total) },
    { name: "Không đạt", color: "#dc2626", value: fmt(failed), pct: pctComma(failed, total) },
  ];

  const hasFilter =
    appliedFilters.dateFrom !== CHART_PERIOD_START ||
    appliedFilters.dateTo !== CHART_PERIOD_END ||
    appliedFilters.projects.length > 0 ||
    appliedFilters.personnel.length > 0 ||
    appliedFilters.plants.length > 0;

  const filterCount =
    (appliedFilters.projects.length ? 1 : 0) +
    (appliedFilters.personnel.length ? 1 : 0) +
    (appliedFilters.plants.length ? 1 : 0) +
    (appliedFilters.dateFrom !== CHART_PERIOD_START || appliedFilters.dateTo !== CHART_PERIOD_END ? 1 : 0);

  function filterPickLabel(count: number, defaultText: string) {
    if (count === 0) return defaultText;
    return `Đã chọn (${count})`;
  }

  return (
    <div className="mx-auto w-full max-w-[1568px] px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-4 text-slate-700 text-sm">
      {/* 1. Filter Bar */}
      <div
        ref={filterBarRef}
        className="rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
          {/* Label icon */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900 shrink-0 sm:pb-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
            </svg>
            <span>Bộ lọc:</span>
            {filterCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-[#0047AB] px-2 py-0.5 text-[11px] font-bold text-white font-mono shadow-xs">
                {filterCount}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-end gap-2.5 sm:gap-3 flex-1">
            {/* Date from */}
            <div className="min-w-0 sm:w-[140px]">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Từ ngày
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  const val = e.target.value;
                  setDateFrom(val);
                  if (dateTo && val > dateTo) setDateTo(val);
                }}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs sm:text-sm text-slate-900 shadow-2xs focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 focus:outline-hidden hover:border-slate-400 transition-all font-mono"
              />
            </div>

            {/* Date to */}
            <div className="min-w-0 sm:w-[140px]">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Đến ngày
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  const val = e.target.value;
                  setDateTo(val);
                  if (dateFrom && val < dateFrom) setDateFrom(val);
                }}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs sm:text-sm text-slate-900 shadow-2xs focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 focus:outline-hidden hover:border-slate-400 transition-all font-mono"
              />
            </div>

            {/* Projects dropdown */}
            <div className="relative min-w-0 sm:w-[152px]">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Theo dự án
              </span>
              <button
                type="button"
                onClick={() => {
                  setProjectFilterOpen((v) => !v);
                  setPersonnelFilterOpen(false);
                  setPlantFilterOpen(false);
                }}
                className="flex h-10 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:border-slate-400 hover:text-slate-900 hover:bg-slate-50 cursor-pointer focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 focus:outline-hidden transition-all"
              >
                <span className="truncate">
                  {filterPickLabel(projects.length, "Tất cả")}
                </span>
                <span className="text-xs text-slate-500">
                  {projectFilterOpen ? "▾" : "▸"}
                </span>
              </button>
              {projectFilterOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 z-50 flex max-h-60 min-w-[220px] flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in-50 duration-150">
                  {PROJECTS.map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={projects.includes(opt)}
                        onChange={() => toggleList("projects", opt)}
                        className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Personnel dropdown */}
            <div className="relative min-w-0 sm:w-[152px]">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Theo nhân sự
              </span>
              <button
                type="button"
                onClick={() => {
                  setPersonnelFilterOpen((v) => !v);
                  setProjectFilterOpen(false);
                  setPlantFilterOpen(false);
                }}
                className="flex h-10 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:border-slate-400 hover:text-slate-900 hover:bg-slate-50 cursor-pointer focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 focus:outline-hidden transition-all"
              >
                <span className="truncate">
                  {filterPickLabel(personnel.length, "Tất cả")}
                </span>
                <span className="text-xs text-slate-500">
                  {personnelFilterOpen ? "▾" : "▸"}
                </span>
              </button>
              {personnelFilterOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 z-50 flex max-h-60 min-w-[220px] flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in-50 duration-150">
                  {PERSONNEL.map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={personnel.includes(opt)}
                        onChange={() => toggleList("personnel", opt)}
                        className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Plants dropdown */}
            <div className="relative col-span-2 sm:col-span-1 min-w-0 sm:w-[152px]">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Theo nhà máy
              </span>
              <button
                type="button"
                onClick={() => {
                  setPlantFilterOpen((v) => !v);
                  setProjectFilterOpen(false);
                  setPersonnelFilterOpen(false);
                }}
                className="flex h-10 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:border-slate-400 hover:text-slate-900 hover:bg-slate-50 cursor-pointer focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 focus:outline-hidden transition-all"
              >
                <span className="truncate">
                  {filterPickLabel(plants.length, "Tất cả")}
                </span>
                <span className="text-xs text-slate-500">
                  {plantFilterOpen ? "▾" : "▸"}
                </span>
              </button>
              {plantFilterOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 z-50 flex max-h-60 min-w-[220px] flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in-50 duration-150">
                  {PLANTS.map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={plants.includes(opt)}
                        onChange={() => toggleList("plants", opt)}
                        className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="col-span-2 sm:col-span-1 flex items-center gap-2 pt-1 sm:pt-0">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="inline-flex items-center justify-center gap-1.5 h-10 flex-1 sm:flex-none rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all cursor-pointer whitespace-nowrap focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
                </svg>
                Áp dụng
              </button>

              {hasFilter && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center justify-center gap-1.5 h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
                >
                  Xóa lọc
                </button>
              )}
            </div>
          </div>
        </div>
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
            <div className="mt-2.5 text-xs text-slate-500">Toàn thời gian</div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0047AB] border border-blue-200/80">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 13h4l3-8 4 14 3-6h4v-2h-3l-3 6-4-14-3 8H3v2z" />
            </svg>
          </div>
        </div>

        {/* Card 2: Mối hàn hôm nay */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold tracking-wider text-emerald-700 uppercase">
              MỐI HÀN HÔM NAY
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
                {today}
              </div>
              <div className="text-xs font-medium text-slate-400">mối</div>
            </div>
            <div className="mt-2.5 text-xs text-emerald-700 font-medium">
              {factor >= 1 ? `↑ ${(8.6 * factor).toFixed(1).replace(".", ",")}%` : `↓ ${(8.6 / factor).toFixed(1).replace(".", ",")}%`}{" "}
              <span className="text-slate-400 font-normal">so với hôm qua</span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9.5 14.5l-2.5-2.5 1.4-1.4 1.1 1.1 4.6-4.6 1.4 1.4z" />
            </svg>
          </div>
        </div>

        {/* Card 3: Tháng này */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold tracking-wider text-indigo-700 uppercase">
              THÁNG NÀY
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
                {fmt(month)}
              </div>
              <div className="text-xs font-medium text-slate-400">mối</div>
            </div>
            <div className="mt-2.5 text-xs text-indigo-700 font-medium">
              {factor >= 1 ? `↑ ${(12.4 * factor).toFixed(1).replace(".", ",")}%` : `↓ ${(12.4 / factor).toFixed(1).replace(".", ",")}%`}{" "}
              <span className="text-slate-400 font-normal">so với tháng trước</span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 9h4v11H4zm6-5h4v16h-4zm6 8h4v8h-4z" />
            </svg>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.48 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. Middle Charts Row (Production Progress + Daily Chart + Welds by Plant) */}
      <div className="grid grid-cols-1 lg:grid-cols-[395px_minmax(0,1fr)_290px] gap-4 items-start">
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
                {fmt(total)} / {fmt(BASE.target)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Mục tiêu: 22.500 mối
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-2.5 pt-1">
              <div>
                <div className="text-xs text-slate-500">Còn lại</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                    {fmt(Math.max(0, BASE.target - total))}
                  </span>
                  <span className="text-xs text-slate-400">mối</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Định mức yêu cầu/ngày</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                    {BASE.quota}
                  </span>
                  <span className="text-xs text-slate-400">mối/ngày</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Thực hiện/ngày</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-bold font-mono text-emerald-700">
                    {today}
                  </span>
                  <span className="text-xs text-slate-400">mối/ngày</span>
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

        {/* Box 2: SẢN LƯỢNG HÀN THEO NGÀY */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              SẢN LƯỢNG HÀN THEO NGÀY
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 shadow-2xs">
              <span className="font-medium font-mono">{chart.chartRangeLabel}</span>
              <span className="text-slate-400">▾</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <svg width="22" height="8">
                <line x1="0" y1="4" x2="22" y2="4" stroke="#0047AB" strokeWidth="2" />
                <circle cx="11" cy="4" r="3" fill="#0047AB" />
              </svg>
              <span>Thực tế</span>
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
              <span>Mục tiêu</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-xs bg-blue-200" />
              <span>Bình quân 7 ngày</span>
            </div>
          </div>

          <div className="mt-2 flex">
            {/* Y-axis labels */}
            <div className="relative h-[190px] w-[30px] shrink-0 text-right text-[11px] text-slate-400 pr-1.5 font-mono">
              <div className="absolute right-1.5 -top-1.5">250</div>
              <div className="absolute right-1.5 top-[31px]">200</div>
              <div className="absolute right-1.5 top-[69px]">150</div>
              <div className="absolute right-1.5 top-[107px]">100</div>
              <div className="absolute right-1.5 top-[145px]">50</div>
              <div className="absolute right-1.5 top-[183px]">0</div>
            </div>

            {/* SVG Plot */}
            <div className="min-w-0 flex-1">
              <svg
                viewBox="0 0 500 190"
                preserveAspectRatio="none"
                className="h-[190px] w-full block"
              >
                <line x1="0" y1="0.5" x2="500" y2="0.5" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="38" x2="500" y2="38" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="76" x2="500" y2="76" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="114" x2="500" y2="114" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="152" x2="500" y2="152" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="189.5" x2="500" y2="189.5" stroke="#cbd5e1" strokeWidth="1" />
                {chart.areaPath && (
                  <path d={chart.areaPath} fill="#eff6ff" opacity="0.9" />
                )}
                {chart.bars.map((b, i) => (
                  <rect
                    key={i}
                    x={b.x}
                    y={b.y}
                    width="5"
                    height={b.h}
                    fill="#3b82f6"
                    rx="1"
                    className="hover:fill-[#0047AB] transition-colors"
                  />
                ))}
                <line
                  x1="0"
                  y1="60.8"
                  x2="500"
                  y2="60.8"
                  stroke="#94a3b8"
                  strokeWidth="1.3"
                  strokeDasharray="7 5"
                />
                {chart.linePath && (
                  <path d={chart.linePath} fill="none" stroke="#0047AB" strokeWidth="2" />
                )}
                {chart.dots.map((p, i) => (
                  <circle key={i} cx={p.cx} cy={p.cy} r="2.8" fill="#0047AB" />
                ))}
              </svg>
              <div className="flex justify-between px-1 pt-2 text-[11px] font-mono text-slate-400">
                {chart.chartLabels.map((lbl, i) => (
                  <span key={i}>{lbl.text}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Box 3: MỐI HÀN THEO NHÀ MÁY */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
            MỐI HÀN THEO NHÀ MÁY
          </div>
          <div className="mt-3.5 flex justify-center">
            <div className="relative h-[126px] w-[126px]">
              <svg viewBox="0 0 140 140" className="h-[126px] w-[126px] block">
                <circle cx="70" cy="70" r="52" fill="none" stroke="#f1f5f9" strokeWidth="20" />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#0047AB"
                  strokeWidth="20"
                  strokeDasharray="113.4 213.3"
                  transform="rotate(-90 70 70)"
                />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="20"
                  strokeDasharray="78.1 248.6"
                  transform="rotate(34.9 70 70)"
                />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="20"
                  strokeDasharray="87.9 238.8"
                  transform="rotate(120.9 70 70)"
                />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="20"
                  strokeDasharray="35.6 291.1"
                  transform="rotate(217.8 70 70)"
                />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="20"
                  strokeDasharray="12.1 314.6"
                  transform="rotate(257.0 70 70)"
                />
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
            {plantRows.map((row) => (
              <div key={row.name} className="flex items-center gap-2 text-xs sm:text-sm">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
                <span className="flex-1 min-w-0 truncate text-slate-700">
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

      {/* 4. 4-column Grid: Máy, Lỗi hàn, Nhân sự đang trực, Trạng thái */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
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
            <div className="text-right">Khả dụng</div>
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
            {[
              { label: "Lỗi bề mặt", count: 16, pct: 74 },
              { label: "Lỗi siêu âm", count: 12, pct: 56 },
              { label: "Lệch tâm", count: 7, pct: 38 },
              { label: "Bavia quá mức", count: 4, pct: 25 },
              { label: "Khác", count: 3, pct: 19 },
            ].map((err) => (
              <div key={err.label} className="flex items-center gap-2 text-xs sm:text-sm">
                <div className="w-[90px] shrink-0 truncate text-slate-700 font-medium">
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
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 text-xs sm:text-sm text-[#0047AB] font-semibold">
            <button type="button" className="hover:underline cursor-pointer">
              Xem tất cả lỗi
            </button>
            <span className="text-slate-400">→</span>
          </div>
        </div>

        {/* Card 3: Nhân sự đang trực */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              NHÂN SỰ ĐANG TRỰC
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
          </div>
          <div className="mt-2.5 flex flex-col divide-y divide-slate-100">
            {personnelRows.map((p) => (
              <div key={p.name} className="flex items-center gap-2.5 py-1.5">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-slate-200 shadow-2xs font-mono"
                  style={{ background: p.bg, color: p.fg }}
                >
                  {p.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs sm:text-sm font-semibold text-slate-900">
                    {p.name}
                  </div>
                  <div className="truncate text-[11px] sm:text-xs text-slate-500">
                    {p.meta}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 tabular-nums">
                    {p.welds}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-400">{p.timeAgo}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2.5 text-xs sm:text-sm text-[#0047AB] font-semibold">
            <button type="button" className="hover:underline cursor-pointer">
              Xem báo cáo nhân sự
            </button>
            <span className="text-slate-400">→</span>
          </div>
        </div>

        {/* Card 4: Mối hàn theo trạng thái */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs min-w-0">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
            MỐI HÀN THEO TRẠNG THÁI
          </div>
          <div className="mt-2.5 flex justify-center">
            <div className="relative h-[108px] w-[108px]">
              <svg viewBox="0 0 140 140" className="h-[108px] w-[108px] block">
                <circle cx="70" cy="70" r="52" fill="none" stroke="#15803d" strokeWidth="20" />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="20"
                  strokeDasharray="2.9 323.8"
                  transform="rotate(-90 70 70)"
                />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="20"
                  strokeDasharray="0.7 326"
                  transform="rotate(-87 70 70)"
                />
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
                <span className="flex-1 min-w-0 truncate text-slate-700">
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

      {/* 5. Bottom Row (Recent Welds Table 2-col span + Quick Actions 1-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-4 items-start">
        {/* Table: MỐI HÀN GẦN ĐÂY */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
            MỐI HÀN GẦN ĐÂY
          </div>
          <div className="table-scroll overflow-x-auto mt-3.5">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1fr_1.3fr_0.95fr_0.8fr_0.75fr_1.2fr_1.1fr_0.85fr_1.05fr_0.6fr] gap-x-2 border-b border-slate-200 bg-slate-50/80 p-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-600">
                <div>Weld ID</div>
                <div>Date / Time</div>
                <div>Nhà máy</div>
                <div>Machine</div>
                <div>Rail Type</div>
                <div>Rail Heat No.</div>
                <div>Operator</div>
                <div>Result</div>
                <div>Inspection</div>
                <div>Actions</div>
              </div>
              <div className="divide-y divide-slate-100">
                {RECENT_WELDS.map((w) => (
                  <div
                    key={w.id}
                    className="grid grid-cols-[1fr_1.3fr_0.95fr_0.8fr_0.75fr_1.2fr_1.1fr_0.85fr_1.05fr_0.6fr] gap-x-2 items-center py-2.5 px-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="font-semibold text-[#0047AB] font-mono">
                      {w.id}
                    </div>
                    <div className="font-mono text-xs text-slate-500">{w.dateTime}</div>
                    <div>{w.plant}</div>
                    <div className="font-mono text-xs">{w.machine}</div>
                    <div className="font-mono text-xs">{w.railType}</div>
                    <div className="font-mono text-xs text-slate-600">{w.heatNo}</div>
                    <div>{w.operator}</div>
                    <div>
                      {w.resultType === "pass" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          ĐẠT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-bold text-rose-700 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          KHÔNG ĐẠT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <span className="text-slate-500 text-xs">UT</span>
                      {w.ut ? (
                        <span className="text-emerald-700 font-bold text-sm">✓</span>
                      ) : (
                        <span className="text-rose-600 font-bold text-sm">✗</span>
                      )}
                      <span className="text-slate-500 text-xs">Ngoại quan</span>
                      {w.visual ? (
                        <span className="text-emerald-700 font-bold text-sm">✓</span>
                      ) : (
                        <span className="text-rose-600 font-bold text-sm">✗</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[#0047AB]">
                      <button
                        type="button"
                        className="hover:text-[#00388A] transition-colors cursor-pointer p-1 rounded-md hover:bg-blue-50"
                        title="Xem chi tiết"
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-1 rounded-md hover:bg-slate-100"
                        title="In tem"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3.5 text-xs sm:text-sm text-[#0047AB] font-semibold">
            <button type="button" className="hover:underline cursor-pointer">
              Xem tất cả mối hàn
            </button>
            <span className="text-slate-400">→</span>
          </div>
        </div>

        {/* Actions: TÁC VỤ NHANH */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
            TÁC VỤ NHANH
          </div>
          <div className="mt-3.5 flex flex-col gap-2">
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
    </div>
  );
}
