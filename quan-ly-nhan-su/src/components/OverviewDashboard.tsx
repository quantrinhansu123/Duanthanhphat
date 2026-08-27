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
  { name: "Cổ Loa – Xưởng A", share: 0.347, color: "#1a63e0", plants: ["Nhà máy Hà Nội"] },
  { name: "Cổ Loa – Xưởng B", share: 0.239, color: "#4f9df7", plants: ["Nhà máy Hà Nội"] },
  { name: "Hạ Long Xanh – Xưởng C", share: 0.269, color: "#14b8a6", plants: ["Nhà máy Đà Nẵng"] },
  { name: "Hạ Long Xanh – Xưởng D", share: 0.109, color: "#a855f7", plants: ["Nhà máy Đà Nẵng"] },
  { name: "Khác", share: 0.037, color: "#f0b323", plants: ["Nhà máy TP.HCM"] },
];

const PERSONNEL_ROWS = [
  { name: "Trần Thị Mai Anh", initials: "MA", bg: "#e8f1fe", fg: "#1257b8", meta: "K922-1 · Cổ Loa", welds: 62, timeAgo: "2 phút trước", plants: ["Nhà máy Hà Nội"], projects: ["ĐSCT Bắc – Nam"] },
  { name: "Nguyễn Văn Minh", initials: "VM", bg: "#e7f7ed", fg: "#15803d", meta: "K922-2 · Hạ Long Xanh", welds: 51, timeAgo: "3 phút trước", plants: ["Nhà máy Đà Nẵng"], projects: ["Dự án ga Đà Nẵng"] },
  { name: "Trần Văn C", initials: "VC", bg: "#fdeaea", fg: "#c62828", meta: "K922-2 · Hạ Long Xanh", welds: 28, timeAgo: "5 phút trước", plants: ["Nhà máy Đà Nẵng"], projects: ["Dự án ga Đà Nẵng"] },
  { name: "Phạm Văn B", initials: "VB", bg: "#f3e8ff", fg: "#7e22ce", meta: "K922-1 · Cổ Loa", welds: 44, timeAgo: "6 phút trước", plants: ["Nhà máy Hà Nội"], projects: ["ĐSCT Bắc – Nam"] },
  { name: "Lê Thị Kim Anh", initials: "KA", bg: "#fff4dd", fg: "#b26a00", meta: "K920 · Cổ Loa · Kiểm tra UT", welds: 13, timeAgo: "8 phút trước", plants: ["Nhà máy Hà Nội"], projects: ["Khu vực depot Hà Nội"] },
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
  if (!keys.length) return 1;
  return keys.reduce((s, k) => s + (map[k] || 0.15), 0);
}

function matchPlant(rowPlants: string[], selected: string[]) {
  return !selected.length || rowPlants.some((p) => selected.includes(p));
}

function matchProject(rowProjects: string[], selected: string[]) {
  return !selected.length || rowProjects.some((p) => selected.includes(p));
}

function filterPickLabel(count: number, allText: string) {
  return count ? `${count} đã chọn` : allText;
}

export default function OverviewDashboard() {
  const [dateFrom, setDateFrom] = useState("2024-05-01");
  const [dateTo, setDateTo] = useState("2024-05-31");
  const [projects, setProjects] = useState<string[]>([]);
  const [personnel, setPersonnel] = useState<string[]>([]);
  const [plants, setPlants] = useState<string[]>([]);

  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const [personnelFilterOpen, setPersonnelFilterOpen] = useState(false);
  const [plantFilterOpen, setPlantFilterOpen] = useState(false);

  const [applied, setApplied] = useState({
    dateFrom: "2024-05-01",
    dateTo: "2024-05-31",
    projects: [] as string[],
    personnel: [] as string[],
    plants: [] as string[],
  });

  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setProjectFilterOpen(false);
        setPersonnelFilterOpen(false);
        setPlantFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleList(
    key: "projects" | "personnel" | "plants",
    value: string
  ) {
    if (key === "projects") {
      setProjects((prev) =>
        prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
      );
    } else if (key === "personnel") {
      setPersonnel((prev) =>
        prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
      );
    } else if (key === "plants") {
      setPlants((prev) =>
        prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
      );
    }
  }

  const factor = useMemo(() => {
    const d1 = new Date(applied.dateFrom + "T00:00:00");
    const d2 = new Date(applied.dateTo + "T00:00:00");
    const days = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
    const dateFactor = Math.min(1.2, Math.max(0.25, days / 31));
    const projectFactor = sumWeight(PROJECT_W, applied.projects);
    const plantFactor = sumWeight(PLANT_W, applied.plants);
    const personFactor = sumWeight(PERSON_W, applied.personnel);
    return dateFactor * projectFactor * plantFactor * personFactor;
  }, [applied]);

  const total = Math.round(BASE.total * factor);
  const today = Math.max(1, Math.round(BASE.today * Math.min(1.15, factor * 1.05)));
  const month = Math.round(BASE.month * factor);
  const failed = Math.max(1, Math.round(BASE.failed * factor));
  const passed = Math.max(0, total - failed - Math.round(BASE.pending * factor));
  const pending = Math.max(0, total - passed - failed);
  const progressPctNum = Math.min(99.9, (total / BASE.target) * 100);
  const progressPct = progressPctNum.toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const chart = useMemo(() => {
    let from = clampChartDate(applied.dateFrom);
    let to = clampChartDate(applied.dateTo);
    if (new Date(to) < new Date(from)) {
      const tmp = from;
      from = to;
      to = tmp;
    }
    let startIdx = chartDayIndex(from);
    let endIdx = chartDayIndex(to);
    if (startIdx > endIdx) {
      startIdx = 0;
      endIdx = CHART_BASE.length - 1;
    }
    const indices: number[] = [];
    for (let i = startIdx; i <= endIdx; i++) indices.push(i);
    const raw = indices.map((i) => CHART_BASE[i] ?? 140);
    const data = raw.map((v) => Math.max(40, Math.round(v * factor)));
    const allLabels = indices.map((i) => viDateShortFromIndex(i));
    const W = 500,
      H = 190,
      max = 250;
    const step = data.length > 1 ? W / data.length : W;
    const px = (i: number) => step * i + step / 2;
    const py = (v: number) => H - (v / max) * H;
    const bars = data.map((v, i) => ({
      x: +(px(i) - 2.5).toFixed(1),
      y: +py(v).toFixed(1),
      h: +(H - py(v)).toFixed(1),
    }));
    const dots = data.map((v, i) => ({
      cx: +px(i).toFixed(1),
      cy: +py(v).toFixed(1),
    }));
    const linePath = data.length
      ? "M" + dots.map((p) => p.cx + "," + p.cy).join("L")
      : "";
    const avg = data.map((v, i) => {
      const s = data.slice(Math.max(0, i - 6), i + 1);
      return s.reduce((a, b) => a + b, 0) / s.length;
    });
    const top = avg
      .map((v, i) => px(i).toFixed(1) + "," + py(v * 1.13).toFixed(1))
      .join("L");
    const areaPath = data.length
      ? "M" +
        top +
        "L" +
        px(data.length - 1).toFixed(1) +
        "," +
        H +
        "L" +
        px(0).toFixed(1) +
        "," +
        H +
        "Z"
      : "";
    const dayCount = indices.length;
    const chartRangeLabel = `${dayCount} ngày · ${viDate(applied.dateFrom)} – ${viDate(
      applied.dateTo
    )}`;
    return {
      bars,
      dots,
      linePath,
      areaPath,
      chartLabels: sampleChartLabels(allLabels, 7),
      chartRangeLabel,
      dayCount,
    };
  }, [factor, applied.dateFrom, applied.dateTo]);

  const filterCount =
    applied.projects.length + applied.personnel.length + applied.plants.length;
  const hasFilter =
    filterCount > 0 ||
    applied.dateFrom !== "2024-05-01" ||
    applied.dateTo !== "2024-05-31";

  const plantRows = useMemo(() => {
    let list = PLANT_ROWS.filter((r) => matchPlant(r.plants, applied.plants)).map(
      (r) => {
        const val = Math.round(BASE.total * r.share * factor);
        return {
          name: r.name,
          color: r.color,
          value: fmt(val),
          pct: pctComma(val, total),
        };
      }
    );
    if (!list.length) {
      list = PLANT_ROWS.map((r) => {
        const val = Math.round(BASE.total * r.share * factor);
        return {
          name: r.name,
          color: r.color,
          value: fmt(val),
          pct: pctComma(val, total),
        };
      });
    }
    return list;
  }, [applied.plants, factor, total]);

  const personnelRows = useMemo(() => {
    let list = PERSONNEL_ROWS.filter((p) => {
      const okPlant = matchPlant(p.plants, applied.plants);
      const okProject = matchProject(p.projects, applied.projects);
      const okPerson =
        !applied.personnel.length || applied.personnel.includes(p.name);
      return okPlant && okProject && okPerson;
    }).map((p) => ({
      ...p,
      welds: Math.max(1, Math.round(p.welds * factor)),
    }));
    if (!list.length) {
      list = PERSONNEL_ROWS.map((p) => ({
        ...p,
        welds: Math.max(1, Math.round(p.welds * factor)),
      }));
    }
    return list;
  }, [applied.plants, applied.projects, applied.personnel, factor]);

  const machineRows = useMemo(() => {
    let list = MACHINE_ROWS.filter((m) =>
      matchPlant(m.plants, applied.plants)
    ).map((m) => ({
      code: m.code,
      total: fmt(BASE.total * m.totalShare * factor),
      today: String(Math.max(1, Math.round(BASE.today * m.todayShare * factor))),
      errorRate: m.errorRate,
      availPct: m.avail,
      availColor: m.avail >= 94 ? "#22a94f" : "#f0b323",
      availLabel: m.avail + "%",
    }));
    if (!list.length) {
      list = MACHINE_ROWS.map((m) => ({
        code: m.code,
        total: fmt(BASE.total * m.totalShare * factor),
        today: String(Math.max(1, Math.round(BASE.today * m.todayShare * factor))),
        errorRate: m.errorRate,
        availPct: m.avail,
        availColor: m.avail >= 94 ? "#22a94f" : "#f0b323",
        availLabel: m.avail + "%",
      }));
    }
    return list;
  }, [applied.plants, factor]);

  const statusRows = [
    { name: "Đạt", color: "#22a94f", value: fmt(passed), pct: pctComma(passed, total) },
    { name: "Chờ kiểm tra", color: "#f0b323", value: fmt(pending), pct: pctComma(pending, total) },
    { name: "Không đạt", color: "#ef4444", value: fmt(failed), pct: pctComma(failed, total) },
  ];

  function handleApplyFilters() {
    setApplied({
      dateFrom,
      dateTo,
      projects: [...projects],
      personnel: [...personnel],
      plants: [...plants],
    });
    setProjectFilterOpen(false);
    setPersonnelFilterOpen(false);
    setPlantFilterOpen(false);
  }

  function handleClearFilters() {
    setDateFrom("2024-05-01");
    setDateTo("2024-05-31");
    setProjects([]);
    setPersonnel([]);
    setPlants([]);
    setApplied({
      dateFrom: "2024-05-01",
      dateTo: "2024-05-31",
      projects: [],
      personnel: [],
      plants: [],
    });
    setProjectFilterOpen(false);
    setPersonnelFilterOpen(false);
    setPlantFilterOpen(false);
  }

  return (
    <div className="mx-auto w-full max-w-[1568px] px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-4 text-[#1f2937] text-[14px]">
      {/* 1. Filter Panel */}
      <div
        ref={filterRef}
        className="relative z-30 rounded-xl border border-[#e4e8ee] bg-white shadow-2xs"
      >
        <div className="flex flex-wrap items-end gap-2 p-2.5 sm:p-3">
          {/* Brand */}
          <div className="flex items-center gap-1.5 pb-1 whitespace-nowrap">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="#1a73e8"
              className="shrink-0"
            >
              <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
            </svg>
            <span className="text-[13px] font-bold text-[#243447]">Bộ lọc</span>
            {filterCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-[#1a73e8] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {filterCount}
              </span>
            )}
          </div>

          {/* Date from */}
          <div className="shrink-0">
            <span className="mb-1 block text-[10px] font-semibold text-[#64748b]">
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
              className="h-9 w-[132px] rounded-lg border border-[#d9e2f1] bg-white px-2 text-[12px] text-[#0f172a] shadow-2xs focus:border-[#1a73e8] focus:outline-hidden"
            />
          </div>

          {/* Date to */}
          <div className="shrink-0">
            <span className="mb-1 block text-[10px] font-semibold text-[#64748b]">
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
              className="h-9 w-[132px] rounded-lg border border-[#d9e2f1] bg-white px-2 text-[12px] text-[#0f172a] shadow-2xs focus:border-[#1a73e8] focus:outline-hidden"
            />
          </div>

          {/* Projects dropdown */}
          <div className="relative shrink-0 w-[148px] min-w-[132px]">
            <span className="mb-1 block text-[10px] font-semibold text-[#64748b]">
              Theo dự án
            </span>
            <button
              type="button"
              onClick={() => {
                setProjectFilterOpen((v) => !v);
                setPersonnelFilterOpen(false);
                setPlantFilterOpen(false);
              }}
              className="flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-[#d9e2f1] bg-white px-2.5 text-[12px] text-[#334155] shadow-2xs hover:border-[#93b4e8] hover:bg-[#f8fafc] cursor-pointer"
            >
              <span className="truncate">
                {filterPickLabel(projects.length, "Tất cả")}
              </span>
              <span className="text-[11px] text-[#64748b]">
                {projectFilterOpen ? "▾" : "▸"}
              </span>
            </button>
            {projectFilterOpen && (
              <div className="absolute top-[calc(100%+4px)] left-0 z-50 flex max-h-60 min-w-[220px] flex-col gap-1 overflow-y-auto rounded-lg border border-[#d9e2f1] bg-white p-2 shadow-2xl">
                {PROJECTS.map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-2 px-1 py-1 text-[12px] text-[#334155] hover:bg-[#f1f5f9] rounded cursor-pointer whitespace-nowrap"
                  >
                    <input
                      type="checkbox"
                      checked={projects.includes(opt)}
                      onChange={() => toggleList("projects", opt)}
                      className="h-3.5 w-3.5 rounded accent-[#1a73e8] cursor-pointer"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Personnel dropdown */}
          <div className="relative shrink-0 w-[148px] min-w-[132px]">
            <span className="mb-1 block text-[10px] font-semibold text-[#64748b]">
              Theo nhân sự
            </span>
            <button
              type="button"
              onClick={() => {
                setPersonnelFilterOpen((v) => !v);
                setProjectFilterOpen(false);
                setPlantFilterOpen(false);
              }}
              className="flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-[#d9e2f1] bg-white px-2.5 text-[12px] text-[#334155] shadow-2xs hover:border-[#93b4e8] hover:bg-[#f8fafc] cursor-pointer"
            >
              <span className="truncate">
                {filterPickLabel(personnel.length, "Tất cả")}
              </span>
              <span className="text-[11px] text-[#64748b]">
                {personnelFilterOpen ? "▾" : "▸"}
              </span>
            </button>
            {personnelFilterOpen && (
              <div className="absolute top-[calc(100%+4px)] left-0 z-50 flex max-h-60 min-w-[220px] flex-col gap-1 overflow-y-auto rounded-lg border border-[#d9e2f1] bg-white p-2 shadow-2xl">
                {PERSONNEL.map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-2 px-1 py-1 text-[12px] text-[#334155] hover:bg-[#f1f5f9] rounded cursor-pointer whitespace-nowrap"
                  >
                    <input
                      type="checkbox"
                      checked={personnel.includes(opt)}
                      onChange={() => toggleList("personnel", opt)}
                      className="h-3.5 w-3.5 rounded accent-[#1a73e8] cursor-pointer"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Plants dropdown */}
          <div className="relative shrink-0 w-[148px] min-w-[132px]">
            <span className="mb-1 block text-[10px] font-semibold text-[#64748b]">
              Theo nhà máy
            </span>
            <button
              type="button"
              onClick={() => {
                setPlantFilterOpen((v) => !v);
                setProjectFilterOpen(false);
                setPersonnelFilterOpen(false);
              }}
              className="flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-[#d9e2f1] bg-white px-2.5 text-[12px] text-[#334155] shadow-2xs hover:border-[#93b4e8] hover:bg-[#f8fafc] cursor-pointer"
            >
              <span className="truncate">
                {filterPickLabel(plants.length, "Tất cả")}
              </span>
              <span className="text-[11px] text-[#64748b]">
                {plantFilterOpen ? "▾" : "▸"}
              </span>
            </button>
            {plantFilterOpen && (
              <div className="absolute top-[calc(100%+4px)] left-0 z-50 flex max-h-60 min-w-[220px] flex-col gap-1 overflow-y-auto rounded-lg border border-[#d9e2f1] bg-white p-2 shadow-2xl">
                {PLANTS.map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-2 px-1 py-1 text-[12px] text-[#334155] hover:bg-[#f1f5f9] rounded cursor-pointer whitespace-nowrap"
                  >
                    <input
                      type="checkbox"
                      checked={plants.includes(opt)}
                      onChange={() => toggleList("plants", opt)}
                      className="h-3.5 w-3.5 rounded accent-[#1a73e8] cursor-pointer"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Apply button */}
          <button
            type="button"
            onClick={handleApplyFilters}
            className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-[#1a73e8] px-3.5 text-[12px] font-semibold text-white shadow-xs hover:bg-[#1565d8] transition-colors cursor-pointer whitespace-nowrap"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
            </svg>
            Áp dụng
          </button>

          {/* Clear button */}
          {hasFilter && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-[#d9e2f1] bg-white px-3.5 text-[12px] font-semibold text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a] transition-colors cursor-pointer whitespace-nowrap"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* 2. Top 5 KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Tổng mối hàn */}
        <div className="flex items-center gap-3 rounded-xl border border-[#e8ebf0] bg-white p-3.5 sm:p-4 shadow-xs">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold tracking-[0.06em] text-[#3b62b5]">
              TỔNG MỐI HÀN
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <div className="text-[26px] sm:text-[29px] font-bold tracking-tight text-[#16233a] font-mono leading-none">
                {fmt(total)}
              </div>
              <div className="text-[12.5px] text-[#8b95a5]">mối</div>
            </div>
            <div className="mt-3 text-[12.5px] text-[#8b95a5]">Toàn thời gian</div>
          </div>
          <div className="flex h-[52px] w-[52px] sm:h-[58px] sm:w-[58px] shrink-0 items-center justify-center rounded-full bg-[#2f80ed] text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 13h4l3-8 4 14 3-6h4v-2h-3l-3 6-4-14-3 8H3v2z" />
            </svg>
          </div>
        </div>

        {/* Card 2: Mối hàn hôm nay */}
        <div className="flex items-center gap-3 rounded-xl border border-[#e8ebf0] bg-white p-3.5 sm:p-4 shadow-xs">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold tracking-[0.06em] text-[#1a9e4b]">
              MỐI HÀN HÔM NAY
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <div className="text-[26px] sm:text-[29px] font-bold tracking-tight text-[#16233a] font-mono leading-none">
                {today}
              </div>
              <div className="text-[12.5px] text-[#8b95a5]">mối</div>
            </div>
            <div className="mt-3 text-[12.5px] text-[#1a9e4b]">
              {factor >= 1 ? `↑ ${(8.6 * factor).toFixed(1).replace(".", ",")}%` : `↓ ${(8.6 / factor).toFixed(1).replace(".", ",")}%`}{" "}
              <span className="text-[#8b95a5]">so với hôm qua</span>
            </div>
          </div>
          <div className="flex h-[52px] w-[52px] sm:h-[58px] sm:w-[58px] shrink-0 items-center justify-center rounded-full bg-[#22a94f] text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9.5 14.5l-2.5-2.5 1.4-1.4 1.1 1.1 4.6-4.6 1.4 1.4z" />
            </svg>
          </div>
        </div>

        {/* Card 3: Tháng này */}
        <div className="flex items-center gap-3 rounded-xl border border-[#e8ebf0] bg-white p-3.5 sm:p-4 shadow-xs">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold tracking-[0.06em] text-[#b4249c]">
              THÁNG NÀY
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <div className="text-[26px] sm:text-[29px] font-bold tracking-tight text-[#16233a] font-mono leading-none">
                {fmt(month)}
              </div>
              <div className="text-[12.5px] text-[#8b95a5]">mối</div>
            </div>
            <div className="mt-3 text-[12.5px] text-[#b4249c]">
              {factor >= 1 ? `↑ ${(12.4 * factor).toFixed(1).replace(".", ",")}%` : `↓ ${(12.4 / factor).toFixed(1).replace(".", ",")}%`}{" "}
              <span className="text-[#8b95a5]">so với tháng trước</span>
            </div>
          </div>
          <div className="flex h-[52px] w-[52px] sm:h-[58px] sm:w-[58px] shrink-0 items-center justify-center rounded-full bg-[#a855f7] text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 9h4v11H4zm6-5h4v16h-4zm6 8h4v8h-4z" />
            </svg>
          </div>
        </div>

        {/* Card 4: Đạt */}
        <div className="flex items-center gap-3 rounded-xl border border-[#e8ebf0] bg-white p-3.5 sm:p-4 shadow-xs">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold tracking-[0.06em] text-[#0d9488]">
              ĐẠT
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <div className="text-[26px] sm:text-[29px] font-bold tracking-tight text-[#16233a] font-mono leading-none">
                {fmt(passed)}
              </div>
              <div className="text-[12.5px] text-[#8b95a5]">mối</div>
            </div>
            <div className="mt-3 text-[12.5px] text-[#8b95a5]">
              {pctComma(passed, total)} tổng số
            </div>
          </div>
          <div className="flex h-[52px] w-[52px] sm:h-[58px] sm:w-[58px] shrink-0 items-center justify-center rounded-full bg-[#14b8a6] text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
        </div>

        {/* Card 5: Không đạt */}
        <div className="flex items-center gap-3 rounded-xl border border-[#e8ebf0] bg-white p-3.5 sm:p-4 shadow-xs">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold tracking-[0.06em] text-[#dc2626]">
              KHÔNG ĐẠT
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <div className="text-[26px] sm:text-[29px] font-bold tracking-tight text-[#16233a] font-mono leading-none">
                {failed}
              </div>
              <div className="text-[12.5px] text-[#8b95a5]">mối</div>
            </div>
            <div className="mt-3 text-[12.5px] text-[#8b95a5]">
              {pctComma(failed, total)} tổng số
            </div>
          </div>
          <div className="flex h-[52px] w-[52px] sm:h-[58px] sm:w-[58px] shrink-0 items-center justify-center rounded-full bg-[#ef4444] text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. Middle Charts Row (Production Progress + Daily Chart + Welds by Plant) */}
      <div className="grid grid-cols-1 lg:grid-cols-[395px_minmax(0,1fr)_290px] gap-4 items-start">
        {/* Box 1: TIẾN ĐỘ SẢN XUẤT */}
        <div className="rounded-xl border border-[#e8ebf0] bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-[14.5px] font-bold tracking-[0.02em] text-[#243447]">
            TIẾN ĐỘ SẢN XUẤT
          </div>
          <div className="mt-3.5 flex flex-col sm:flex-row gap-3.5">
            <div className="w-full sm:w-[214px] shrink-0 text-center">
              <div className="relative mx-auto h-[126px] w-[214px]">
                <svg viewBox="0 0 200 118" className="h-[126px] w-[214px] block">
                  <path
                    d="M 16 104 A 84 84 0 0 1 184 104"
                    fill="none"
                    stroke="#e6e9ee"
                    strokeWidth="25"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 16 104 A 84 84 0 0 1 184 104"
                    fill="none"
                    stroke="#1a63e0"
                    strokeWidth="25"
                    strokeLinecap="round"
                    strokeDasharray={gaugeDash(progressPctNum)}
                  />
                </svg>
                <div className="absolute top-[44px] left-0 right-0 text-[32px] sm:text-[35px] font-bold font-mono tracking-tight text-[#16233a] leading-none">
                  {progressPct}%
                </div>
                <div className="absolute top-[78px] left-0 right-0 text-[11.5px] text-[#8b95a5]">
                  Tiến độ mục tiêu
                </div>
              </div>
              <div className="mt-2 text-[19px] sm:text-[21px] font-bold font-mono text-[#16233a] tracking-tight">
                {fmt(total)} / {fmt(BASE.target)}
              </div>
              <div className="mt-1 text-[12.5px] text-[#8b95a5]">
                Mục tiêu: 22.500 mối
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-2.5 pt-1">
              <div>
                <div className="text-[12px] text-[#8b95a5]">Còn lại</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[17px] sm:text-[18px] font-bold font-mono text-[#16233a]">
                    {fmt(Math.max(0, BASE.target - total))}
                  </span>
                  <span className="text-[11.5px] text-[#8b95a5]">mối</span>
                </div>
              </div>
              <div>
                <div className="text-[12px] text-[#8b95a5]">Định mức yêu cầu/ngày</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[17px] sm:text-[18px] font-bold font-mono text-[#16233a]">
                    {BASE.quota}
                  </span>
                  <span className="text-[11.5px] text-[#8b95a5]">mối/ngày</span>
                </div>
              </div>
              <div>
                <div className="text-[12px] text-[#8b95a5]">Thực hiện/ngày</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[17px] sm:text-[18px] font-bold font-mono text-[#1a9e4b]">
                    {today}
                  </span>
                  <span className="text-[11.5px] text-[#8b95a5]">mối/ngày</span>
                </div>
              </div>
              <div>
                <div className="mb-1 text-[12px] text-[#8b95a5]">Trạng thái</div>
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#e7f7ed] px-2.5 py-1 text-[11.5px] font-bold tracking-wide text-[#15803d]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#22a94f]" />
                  ĐÚNG TIẾN ĐỘ
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Box 2: SẢN LƯỢNG HÀN THEO NGÀY */}
        <div className="rounded-xl border border-[#e8ebf0] bg-white p-4 sm:p-5 shadow-xs min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-[14.5px] font-bold tracking-[0.02em] text-[#243447]">
              SẢN LƯỢNG HÀN THEO NGÀY
            </div>
            <div className="flex items-center gap-4 rounded-lg border border-[#e4e8ee] px-2.5 py-1 text-[12.5px] text-[#3d4a5c]">
              <span>{chart.chartRangeLabel}</span>
              <span className="text-[#8b95a5]">▾</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[12px] text-[#4b5563]">
            <div className="flex items-center gap-1.5">
              <svg width="22" height="8">
                <line x1="0" y1="4" x2="22" y2="4" stroke="#1e5fc0" strokeWidth="1.6" />
                <circle cx="11" cy="4" r="3.2" fill="#1e5fc0" />
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
                  stroke="#8896a8"
                  strokeWidth="1.6"
                  strokeDasharray="5 4"
                />
              </svg>
              <span>Mục tiêu</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-xs bg-[#d3e4fb]" />
              <span>Bình quân 7 ngày</span>
            </div>
          </div>

          <div className="mt-2 flex">
            {/* Y-axis labels */}
            <div className="relative h-[190px] w-[30px] shrink-0 text-right text-[11.5px] text-[#8b95a5] pr-1.5 font-mono">
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
                <line x1="0" y1="0.5" x2="500" y2="0.5" stroke="#eef1f5" strokeWidth="1" />
                <line x1="0" y1="38" x2="500" y2="38" stroke="#eef1f5" strokeWidth="1" />
                <line x1="0" y1="76" x2="500" y2="76" stroke="#eef1f5" strokeWidth="1" />
                <line x1="0" y1="114" x2="500" y2="114" stroke="#eef1f5" strokeWidth="1" />
                <line x1="0" y1="152" x2="500" y2="152" stroke="#eef1f5" strokeWidth="1" />
                <line x1="0" y1="189.5" x2="500" y2="189.5" stroke="#cfd6df" strokeWidth="1" />
                {chart.areaPath && (
                  <path d={chart.areaPath} fill="#d9e7fb" opacity="0.95" />
                )}
                {chart.bars.map((b, i) => (
                  <rect
                    key={i}
                    x={b.x}
                    y={b.y}
                    width="5"
                    height={b.h}
                    fill="#5b95ef"
                    rx="1"
                  />
                ))}
                <line
                  x1="0"
                  y1="60.8"
                  x2="500"
                  y2="60.8"
                  stroke="#8896a8"
                  strokeWidth="1.3"
                  strokeDasharray="7 5"
                />
                {chart.linePath && (
                  <path d={chart.linePath} fill="none" stroke="#1e5fc0" strokeWidth="1.6" />
                )}
                {chart.dots.map((p, i) => (
                  <circle key={i} cx={p.cx} cy={p.cy} r="2.7" fill="#1e5fc0" />
                ))}
              </svg>
              <div className="flex justify-between px-1 pt-2 text-[11.5px] font-mono text-[#8b95a5]">
                {chart.chartLabels.map((lbl, i) => (
                  <span key={i}>{lbl.text}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Box 3: MỐI HÀN THEO NHÀ MÁY */}
        <div className="rounded-xl border border-[#e8ebf0] bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-[14.5px] font-bold tracking-[0.02em] text-[#243447]">
            MỐI HÀN THEO NHÀ MÁY
          </div>
          <div className="mt-3.5 flex justify-center">
            <div className="relative h-[126px] w-[126px]">
              <svg viewBox="0 0 140 140" className="h-[126px] w-[126px] block">
                <circle cx="70" cy="70" r="52" fill="none" stroke="#eef1f5" strokeWidth="21" />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#1a63e0"
                  strokeWidth="21"
                  strokeDasharray="113.4 213.3"
                  transform="rotate(-90 70 70)"
                />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#4f9df7"
                  strokeWidth="21"
                  strokeDasharray="78.1 248.6"
                  transform="rotate(34.9 70 70)"
                />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#14b8a6"
                  strokeWidth="21"
                  strokeDasharray="87.9 238.8"
                  transform="rotate(120.9 70 70)"
                />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="21"
                  strokeDasharray="35.6 291.1"
                  transform="rotate(217.8 70 70)"
                />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#f0b323"
                  strokeWidth="21"
                  strokeDasharray="12.1 314.6"
                  transform="rotate(257.0 70 70)"
                />
              </svg>
              <div className="absolute top-[46px] left-0 right-0 text-center text-[18px] font-bold font-mono text-[#16233a] leading-none">
                {fmt(total)}
              </div>
              <div className="absolute top-[66px] left-0 right-0 text-center text-[11px] text-[#8b95a5]">
                Tổng
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {plantRows.map((row) => (
              <div key={row.name} className="flex items-center gap-2 text-[12.5px]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
                <span className="flex-1 min-w-0 truncate text-[#3d4a5c]">
                  {row.name}
                </span>
                <span className="font-semibold font-mono text-[#16233a]">
                  {row.value}
                </span>
                <span className="text-[11.5px] font-mono text-[#8b95a5]">
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
        <div className="rounded-xl border border-[#e8ebf0] bg-white p-4 shadow-xs min-w-0">
          <div className="text-[14.5px] font-bold tracking-[0.02em] text-[#243447]">
            MỐI HÀN THEO MÁY
          </div>
          <div className="mt-3 grid grid-cols-[1fr_0.7fr_0.55fr_0.85fr_0.9fr] gap-x-1 border-b border-[#eef1f5] pb-2 text-[11px] text-[#8b95a5]">
            <div>Máy</div>
            <div>Mối hàn</div>
            <div>Hôm nay</div>
            <div>Tỷ lệ lỗi</div>
            <div className="text-right">Khả dụng</div>
          </div>
          <div className="divide-y divide-[#f2f4f7]">
            {machineRows.map((m) => (
              <div
                key={m.code}
                className="grid grid-cols-[1fr_0.7fr_0.55fr_0.85fr_0.9fr] gap-x-1 items-center py-2 text-[12px] text-[#243447]"
              >
                <div className="font-semibold truncate font-mono">{m.code}</div>
                <div className="font-mono">{m.total}</div>
                <div className="font-mono">{m.today}</div>
                <div className="font-mono">{m.errorRate}</div>
                <div className="flex items-center justify-end gap-1.5">
                  <div className="h-1.5 w-12 rounded-full bg-[#eef1f5] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${m.availPct}%`,
                        background: m.availColor,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-[11px] font-mono">
                    {m.availLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3.5 text-[13px] text-[#1a73e8] font-medium">
            <button type="button" className="hover:underline cursor-pointer">
              Xem tất cả máy
            </button>
            <span className="text-[#5d6b7d]">→</span>
          </div>
        </div>

        {/* Card 2: Lỗi hàn phổ biến */}
        <div className="rounded-xl border border-[#e8ebf0] bg-white p-3.5 shadow-xs min-w-0">
          <div className="text-[14px] font-bold tracking-[0.02em] text-[#243447]">
            LỖI HÀN PHỔ BIẾN
          </div>
          <div className="mt-2.5 flex flex-col gap-2">
            {[
              { label: "Lỗi bề mặt", count: 16, pct: 74 },
              { label: "Lỗi siêu âm", count: 12, pct: 56 },
              { label: "Lệch tâm", count: 7, pct: 38 },
              { label: "Bavia quá mức", count: 4, pct: 25 },
              { label: "Khác", count: 3, pct: 19 },
            ].map((err) => (
              <div key={err.label} className="flex items-center gap-2 text-[12px]">
                <div className="w-[88px] shrink-0 truncate text-[#3d4a5c]">
                  {err.label}
                </div>
                <div className="flex flex-1 min-w-0 items-center gap-1.5">
                  <div className="h-2.5 flex-1 min-w-0 rounded-xs bg-[#eef1f5] overflow-hidden">
                    <div
                      className="h-full rounded-xs bg-[#ef4444]"
                      style={{ width: `${err.pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-[#4b5563] shrink-0">
                    {err.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2.5 text-[12px] text-[#1a73e8] font-medium">
            <button type="button" className="hover:underline cursor-pointer">
              Xem tất cả lỗi
            </button>
            <span className="text-[#5d6b7d]">→</span>
          </div>
        </div>

        {/* Card 3: Nhân sự đang trực */}
        <div className="rounded-xl border border-[#e8ebf0] bg-white p-3.5 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[14px] font-bold tracking-[0.02em] text-[#243447]">
              NHÂN SỰ ĐANG TRỰC
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1a9e4b] shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22a94f] animate-pulse" />
              Live
            </div>
          </div>
          <div className="mt-2.5 flex flex-col divide-y divide-[#f2f4f7]">
            {personnelRows.map((p) => (
              <div key={p.name} className="flex items-center gap-2 py-1.5">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: p.bg, color: p.fg }}
                >
                  {p.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold text-[#16233a]">
                    {p.name}
                  </div>
                  <div className="truncate text-[10px] text-[#8b95a5]">
                    {p.meta}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-bold font-mono text-[#16233a]">
                    {p.welds}
                  </div>
                  <div className="text-[10px] text-[#8b95a5]">{p.timeAgo}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 text-[12px] text-[#1a73e8] font-medium">
            <button type="button" className="hover:underline cursor-pointer">
              Xem báo cáo nhân sự
            </button>
            <span className="text-[#5d6b7d]">→</span>
          </div>
        </div>

        {/* Card 4: Mối hàn theo trạng thái */}
        <div className="rounded-xl border border-[#e8ebf0] bg-white p-3.5 shadow-xs min-w-0">
          <div className="text-[14px] font-bold tracking-[0.02em] text-[#243447]">
            MỐI HÀN THEO TRẠNG THÁI
          </div>
          <div className="mt-2.5 flex justify-center">
            <div className="relative h-[108px] w-[108px]">
              <svg viewBox="0 0 140 140" className="h-[108px] w-[108px] block">
                <circle cx="70" cy="70" r="52" fill="none" stroke="#22a94f" strokeWidth="21" />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#f0b323"
                  strokeWidth="21"
                  strokeDasharray="2.9 323.8"
                  transform="rotate(-90 70 70)"
                />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="21"
                  strokeDasharray="0.7 326"
                  transform="rotate(-87 70 70)"
                />
              </svg>
              <div className="absolute top-[38px] left-0 right-0 text-center text-[16px] font-bold font-mono text-[#16233a] leading-none">
                {fmt(total)}
              </div>
              <div className="absolute top-[56px] left-0 right-0 text-center text-[10px] text-[#8b95a5]">
                Tổng
              </div>
            </div>
          </div>
          <div className="mt-2.5 flex flex-col gap-2">
            {statusRows.map((row) => (
              <div key={row.name} className="flex items-center gap-1.5 text-[11.5px]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
                <span className="flex-1 min-w-0 truncate text-[#3d4a5c]">
                  {row.name}
                </span>
                <span className="font-semibold font-mono text-[#16233a]">
                  {row.value}
                </span>
                <span className="text-[11px] font-mono text-[#8b95a5]">
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
        <div className="rounded-xl border border-[#e8ebf0] bg-white p-4 sm:p-5 shadow-xs min-w-0">
          <div className="text-[14.5px] font-bold tracking-[0.02em] text-[#243447]">
            MỐI HÀN GẦN ĐÂY
          </div>
          <div className="table-scroll overflow-x-auto mt-3.5">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1fr_1.3fr_0.95fr_0.8fr_0.75fr_1.2fr_1.1fr_0.85fr_1.05fr_0.6fr] gap-x-2 border-b border-[#eef1f5] pb-2 text-[12px] text-[#8b95a5]">
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
              <div className="divide-y divide-[#f2f4f7]">
                {RECENT_WELDS.map((w) => (
                  <div
                    key={w.id}
                    className="grid grid-cols-[1fr_1.3fr_0.95fr_0.8fr_0.75fr_1.2fr_1.1fr_0.85fr_1.05fr_0.6fr] gap-x-2 items-center py-2.5 text-[13px] text-[#3d4a5c]"
                  >
                    <div className="font-semibold text-[#243447] font-mono">
                      {w.id}
                    </div>
                    <div className="font-mono text-[12px]">{w.dateTime}</div>
                    <div>{w.plant}</div>
                    <div className="font-mono text-[12px]">{w.machine}</div>
                    <div className="font-mono text-[12px]">{w.railType}</div>
                    <div className="font-mono text-[12px]">{w.heatNo}</div>
                    <div>{w.operator}</div>
                    <div>
                      {w.resultType === "pass" ? (
                        <span className="rounded bg-[#e7f7ed] px-2 py-1 text-[10.5px] font-bold tracking-wide text-[#15803d]">
                          ĐẠT
                        </span>
                      ) : (
                        <span className="rounded bg-[#fdeaea] px-2 py-1 text-[10.5px] font-bold tracking-wide text-[#c62828]">
                          KHÔNG ĐẠT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px]">
                      <span>UT</span>
                      {w.ut ? (
                        <span className="text-[#22a94f] font-bold text-[13px]">✓</span>
                      ) : (
                        <span className="text-[#ef4444] font-bold text-[13px]">✗</span>
                      )}
                      <span>Ngoại quan</span>
                      {w.visual ? (
                        <span className="text-[#22a94f] font-bold text-[13px]">✓</span>
                      ) : (
                        <span className="text-[#ef4444] font-bold text-[13px]">✗</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[#2f80ed]">
                      <button
                        type="button"
                        className="hover:opacity-75 cursor-pointer"
                        title="Xem chi tiết"
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="text-[#8b95a5] hover:text-[#0f172a] cursor-pointer"
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
          <div className="flex items-center justify-end gap-2 pt-3.5 text-[13px] text-[#1a73e8] font-medium">
            <button type="button" className="hover:underline cursor-pointer">
              Xem tất cả mối hàn
            </button>
            <span className="text-[#5d6b7d]">→</span>
          </div>
        </div>

        {/* Actions: TÁC VỤ NHANH */}
        <div className="rounded-xl border border-[#e8ebf0] bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-[14.5px] font-bold tracking-[0.02em] text-[#243447]">
            TÁC VỤ NHANH
          </div>
          <div className="mt-3.5 flex flex-col gap-2">
            {[
              {
                label: "Thêm mối hàn mới",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5d6b7d" strokeWidth="2.2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                ),
              },
              {
                label: "Phiếu kiểm tra",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5d6b7d" strokeWidth="2">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" />
                    <path d="M9 12h6M9 16h4" />
                  </svg>
                ),
              },
              {
                label: "Nhập sản lượng",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5d6b7d" strokeWidth="2">
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5d6b7d" strokeWidth="2">
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5d6b7d" strokeWidth="2">
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
                className="flex items-center gap-2.5 rounded-lg border border-[#e4e8ee] px-3 py-2 text-[13px] text-[#243447] hover:bg-[#f5f9ff] hover:border-[#c9dcf8] transition-colors cursor-pointer text-left"
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
