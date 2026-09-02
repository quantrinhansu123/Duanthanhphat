"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Funnel,
  CaretDown,
  SlidersHorizontal,
  CheckCircle,
  XCircle,
  SealCheck,
  ArrowsClockwise,
  ListChecks,
  Eye,
  Warning,
} from "@/components/icons";
import {
  defectCategories,
  inspectionBreakdown,
  plantQuality,
  qualityKpis,
  railTypeQuality,
  recentDefects,
  weeklyTrend,
  welderQuality,
} from "@/data/qualityReport";

const PROJECTS = [
  "ĐSCT Bắc – Nam",
  "Dự án ga Đà Nẵng",
  "Dự án đường sắt Bắc Nam",
  "Khu vực depot Hà Nội",
  "Tuyến metro số 1",
];

const PERSONNEL = [
  "Lê Thị Kim Anh",
  "Phạm Văn Minh",
  "Nguyễn Văn Hùng",
  "Trần Quốc Bảo",
  "Trần Thị Mai Anh",
  "Nguyễn Văn Minh",
];

const MACHINES = ["K922-1", "K922-2", "K920"];

const WELD_METHODS = [
  { value: "FBW", label: "FBW (Hàn tiếp xúc)" },
  { value: "ATW", label: "ATW (Hàn nhiệt nhôm)" },
];

const WELD_TYPES = ["Sản xuất", "Thử nghiệm", "Đào tạo"];

const PROJECT_W: Record<string, number> = {
  "ĐSCT Bắc – Nam": 0.38,
  "Dự án ga Đà Nẵng": 0.22,
  "Dự án đường sắt Bắc Nam": 0.18,
  "Khu vực depot Hà Nội": 0.12,
  "Tuyến metro số 1": 0.1,
};

const MACHINE_W: Record<string, number> = {
  "K922-1": 0.46,
  "K922-2": 0.42,
  "K920": 0.12,
};

const METHOD_W: Record<string, number> = {
  FBW: 0.72,
  ATW: 0.28,
};

const WELD_TYPE_W: Record<string, number> = {
  "Sản xuất": 0.85,
  "Thử nghiệm": 0.1,
  "Đào tạo": 0.05,
};

const PERSON_W: Record<string, number> = {
  "Lê Thị Kim Anh": 0.22,
  "Phạm Văn Minh": 0.28,
  "Nguyễn Văn Hùng": 0.26,
  "Trần Quốc Bảo": 0.24,
  "Trần Thị Mai Anh": 0.15,
  "Nguyễn Văn Minh": 0.15,
};

const CHART_PERIOD_START = "2024-05-01";
const CHART_PERIOD_END = "2024-05-30";

function sumWeight(map: Record<string, number>, keys: string[]) {
  return keys.reduce((acc, k) => acc + (map[k] ?? 0), 0);
}

function filterPickLabel(count: number, defaultText: string) {
  if (count === 0) return defaultText;
  return `Đã chọn (${count})`;
}

function fmt(n: number) {
  return n.toLocaleString("vi-VN");
}

function KpiCard({
  label,
  value,
  unit,
  note,
  noteColor = "text-slate-500",
  iconBg,
  labelColor,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  noteColor?: string;
  iconBg: string;
  labelColor: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all duration-150">
      <div className="min-w-0 flex-1">
        <div className={`text-xs font-bold uppercase tracking-wider ${labelColor}`}>{label}</div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-bold leading-none text-slate-900 font-mono tabular-nums">{value}</span>
          {unit ? <span className="text-xs font-medium text-slate-400">{unit}</span> : null}
        </div>
        {note ? <div className={`mt-2.5 text-xs font-medium ${noteColor}`}>{note}</div> : null}
      </div>
      <div className={`flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
    </div>
  );
}

function DonutChart({ rate }: { rate: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const passLen = (rate / 100) * c;
  return (
    <svg viewBox="0 0 140 140" className="h-[140px] w-[140px]">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="20" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke="#0047AB"
        strokeWidth="20"
        strokeDasharray={`${passLen} ${c}`}
        transform="rotate(-90 70 70)"
        strokeLinecap="round"
      />
      <text x="70" y="68" textAnchor="middle" className="fill-slate-900 text-xl font-bold font-mono">
        {rate.toLocaleString("vi-VN")}%
      </text>
      <text x="70" y="86" textAnchor="middle" className="fill-slate-500 text-[11px] font-bold tracking-wider">
        ĐẠT CHUẨN
      </text>
    </svg>
  );
}

const severityStyle = {
  Cao: "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  "Trung bình": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  Thấp: "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
};

const statusStyle = {
  "Chờ xử lý": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  "Đang sửa": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Đã đóng": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
};

export default function QualityReportDashboard() {
  const [dateFrom, setDateFrom] = useState(CHART_PERIOD_START);
  const [dateTo, setDateTo] = useState(CHART_PERIOD_END);
  const [projects, setProjects] = useState<string[]>([]);
  const [personnel, setPersonnel] = useState<string[]>([]);
  const [machines, setMachines] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [weldTypes, setWeldTypes] = useState<string[]>([]);

  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: CHART_PERIOD_START,
    dateTo: CHART_PERIOD_END,
    projects: [] as string[],
    personnel: [] as string[],
    machines: [] as string[],
    methods: [] as string[],
    weldTypes: [] as string[],
  });

  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const [personnelFilterOpen, setPersonnelFilterOpen] = useState(false);
  const [machineFilterOpen, setMachineFilterOpen] = useState(false);
  const [methodFilterOpen, setMethodFilterOpen] = useState(false);
  const [weldTypeFilterOpen, setWeldTypeFilterOpen] = useState(false);

  const projectRef = useRef<HTMLDivElement>(null);
  const personnelRef = useRef<HTMLDivElement>(null);
  const machineRef = useRef<HTMLDivElement>(null);
  const methodRef = useRef<HTMLDivElement>(null);
  const weldTypeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (projectRef.current && !projectRef.current.contains(target)) {
        setProjectFilterOpen(false);
      }
      if (personnelRef.current && !personnelRef.current.contains(target)) {
        setPersonnelFilterOpen(false);
      }
      if (machineRef.current && !machineRef.current.contains(target)) {
        setMachineFilterOpen(false);
      }
      if (methodRef.current && !methodRef.current.contains(target)) {
        setMethodFilterOpen(false);
      }
      if (weldTypeRef.current && !weldTypeRef.current.contains(target)) {
        setWeldTypeFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleList(
    type: "projects" | "personnel" | "machines" | "methods" | "weldTypes",
    item: string
  ) {
    if (type === "projects") {
      setProjects((prev) =>
        prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
      );
    } else if (type === "personnel") {
      setPersonnel((prev) =>
        prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
      );
    } else if (type === "machines") {
      setMachines((prev) =>
        prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
      );
    } else if (type === "methods") {
      setMethods((prev) =>
        prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
      );
    } else {
      setWeldTypes((prev) =>
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
      machines,
      methods,
      weldTypes,
    });
    setProjectFilterOpen(false);
    setPersonnelFilterOpen(false);
    setMachineFilterOpen(false);
    setMethodFilterOpen(false);
    setWeldTypeFilterOpen(false);
  }

  function handleClearFilters() {
    setDateFrom(CHART_PERIOD_START);
    setDateTo(CHART_PERIOD_END);
    setProjects([]);
    setPersonnel([]);
    setMachines([]);
    setMethods([]);
    setWeldTypes([]);
    setAppliedFilters({
      dateFrom: CHART_PERIOD_START,
      dateTo: CHART_PERIOD_END,
      projects: [],
      personnel: [],
      machines: [],
      methods: [],
      weldTypes: [],
    });
    setProjectFilterOpen(false);
    setPersonnelFilterOpen(false);
    setMachineFilterOpen(false);
    setMethodFilterOpen(false);
    setWeldTypeFilterOpen(false);
  }

  const factor = useMemo(() => {
    let f = 1;
    if (appliedFilters.projects.length) {
      f *= sumWeight(PROJECT_W, appliedFilters.projects);
    }
    if (appliedFilters.machines.length) {
      f *= sumWeight(MACHINE_W, appliedFilters.machines);
    }
    if (appliedFilters.personnel.length) {
      f *= sumWeight(PERSON_W, appliedFilters.personnel);
    }
    if (appliedFilters.methods.length) {
      f *= sumWeight(METHOD_W, appliedFilters.methods);
    }
    if (appliedFilters.weldTypes.length) {
      f *= sumWeight(WELD_TYPE_W, appliedFilters.weldTypes);
    }
    if (appliedFilters.dateFrom && appliedFilters.dateTo) {
      const d1 = new Date(appliedFilters.dateFrom + "T00:00:00");
      const d2 = new Date(appliedFilters.dateTo + "T00:00:00");
      const days = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
      f *= Math.min(1.2, Math.max(0.08, days / 30));
    }
    return Math.max(0.05, Math.min(2.5, f));
  }, [appliedFilters]);

  const hasFilter =
    appliedFilters.dateFrom !== CHART_PERIOD_START ||
    appliedFilters.dateTo !== CHART_PERIOD_END ||
    appliedFilters.projects.length > 0 ||
    appliedFilters.personnel.length > 0 ||
    appliedFilters.machines.length > 0 ||
    appliedFilters.methods.length > 0 ||
    appliedFilters.weldTypes.length > 0;

  const filterCount =
    (appliedFilters.projects.length ? 1 : 0) +
    (appliedFilters.personnel.length ? 1 : 0) +
    (appliedFilters.machines.length ? 1 : 0) +
    (appliedFilters.methods.length ? 1 : 0) +
    (appliedFilters.weldTypes.length ? 1 : 0) +
    (appliedFilters.dateFrom !== CHART_PERIOD_START || appliedFilters.dateTo !== CHART_PERIOD_END ? 1 : 0);

  const passed = Math.max(1, Math.round(qualityKpis.passed * factor));
  const failed = Math.max(0, Math.round(qualityKpis.failed * factor));
  const rework = Math.max(0, Math.round(qualityKpis.rework * factor));
  const totalInspected = passed + failed;
  const passRate = totalInspected > 0 ? Number(((passed / totalInspected) * 100).toFixed(1)) : 98.5;
  const ndtPassed = Math.max(1, Math.round(qualityKpis.ndtPassed * factor));
  const visualFailed = Math.max(0, Math.round(qualityKpis.visualFailed * factor));
  const criticalDefects = Math.max(0, Math.round(qualityKpis.criticalDefects * factor));
  const openCases = Math.max(0, Math.round(qualityKpis.openCases * factor));

  const currentInspectionBreakdown = useMemo(() => [
    { label: "Đạt chuẩn", count: passed, color: "#22a94f" },
    { label: "Không đạt", count: failed, color: "#ef4444" },
    { label: "Sửa / hàn lại", count: rework, color: "#f0b323" },
  ], [passed, failed, rework]);

  const currentDefectCategories = useMemo(() => {
    return defectCategories.map((d) => ({
      ...d,
      count: Math.max(1, Math.round(d.count * factor)),
    }));
  }, [factor]);

  const totalDefects = useMemo(() => {
    return currentDefectCategories.reduce((s, d) => s + d.count, 0);
  }, [currentDefectCategories]);

  const maxDefect = useMemo(() => {
    return Math.max(...currentDefectCategories.map((d) => d.count), 1);
  }, [currentDefectCategories]);

  const maxTrend = useMemo(() => Math.max(...weeklyTrend.map((w) => w.rate)), []);
  const minTrend = useMemo(() => Math.min(...weeklyTrend.map((w) => w.rate)), []);

  const currentPlantQuality = useMemo(() => {
    return plantQuality.map((p) => ({
      ...p,
      total: Math.max(1, Math.round(p.total * factor)),
      failed: Math.max(0, Math.round(p.failed * factor)),
    }));
  }, [factor]);

  const currentRailTypeQuality = useMemo(() => {
    return railTypeQuality.map((r) => ({
      ...r,
      total: Math.max(1, Math.round(r.total * factor)),
    }));
  }, [factor]);

  const currentWelderQuality = useMemo(() => {
    let list = welderQuality;
    if (appliedFilters.personnel.length) {
      list = list.filter((w) => appliedFilters.personnel.includes(w.name));
    }
    return list.map((w) => ({
      ...w,
      total: Math.max(1, Math.round(w.total * factor)),
      failed: Math.max(0, Math.round(w.failed * factor)),
    }));
  }, [appliedFilters.personnel, factor]);

  const currentRecentDefects = useMemo(() => {
    let list = recentDefects;
    if (appliedFilters.personnel.length) {
      list = list.filter((d) => appliedFilters.personnel.includes(d.welder));
    }
    return list;
  }, [appliedFilters.personnel]);

  return (
    <div className="mx-auto w-full max-w-[1568px] px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-4 text-slate-700 text-sm">
      {/* 1. Filter Bar */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-xs flex flex-col gap-3">
        {/* Row 1: Label + Date Range + Project + Personnel + Machine (stretched full width) */}
        <div className="flex flex-col lg:flex-row lg:items-end gap-2.5 sm:gap-3">
          {/* Label icon */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900 shrink-0 lg:pb-2.5">
            <Funnel size={16} weight="fill" aria-hidden />
            <span>Bộ lọc:</span>
            {filterCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-[#0047AB] px-2 py-0.5 text-[11px] font-bold text-white font-mono shadow-xs">
                {filterCount}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-end gap-2.5 sm:gap-3 flex-1 min-w-0">
            {/* Date from */}
            <div className="min-w-0 flex-1">
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
            <div className="min-w-0 flex-1">
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
            <div ref={projectRef} className="relative min-w-0 flex-1 lg:flex-[1.25]">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Theo dự án
              </span>
              <button
                type="button"
                onClick={() => {
                  setProjectFilterOpen((v) => !v);
                  setPersonnelFilterOpen(false);
                  setMachineFilterOpen(false);
                  setMethodFilterOpen(false);
                  setWeldTypeFilterOpen(false);
                }}
                className="flex h-10 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:border-slate-400 hover:text-slate-900 hover:bg-slate-50 cursor-pointer focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 focus:outline-hidden transition-all"
              >
                <span className="truncate">
                  {filterPickLabel(projects.length, "Tất cả")}
                </span>
                <CaretDown size={14} weight="bold" aria-hidden className={`text-slate-400 shrink-0 transition-transform duration-200 ${projectFilterOpen ? "rotate-180 text-[#0047AB]" : ""}`} />
              </button>
              {projectFilterOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex max-h-60 w-full min-w-full flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in-50 duration-150">
                  <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors border-b border-slate-100 pb-2 mb-0.5">
                    <input
                      type="checkbox"
                      checked={projects.length === 0 || projects.length === PROJECTS.length}
                      onChange={() => setProjects([])}
                      className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
                    />
                    <span className="truncate">Tất cả</span>
                  </label>
                  {PROJECTS.map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={projects.includes(opt)}
                        onChange={() => toggleList("projects", opt)}
                        className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
                      />
                      <span className="truncate">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Personnel dropdown */}
            <div ref={personnelRef} className="relative min-w-0 flex-1 lg:flex-[1.25]">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Theo nhân sự
              </span>
              <button
                type="button"
                onClick={() => {
                  setPersonnelFilterOpen((v) => !v);
                  setProjectFilterOpen(false);
                  setMachineFilterOpen(false);
                  setMethodFilterOpen(false);
                  setWeldTypeFilterOpen(false);
                }}
                className="flex h-10 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:border-slate-400 hover:text-slate-900 hover:bg-slate-50 cursor-pointer focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 focus:outline-hidden transition-all"
              >
                <span className="truncate">
                  {filterPickLabel(personnel.length, "Tất cả")}
                </span>
                <CaretDown size={14} weight="bold" aria-hidden className={`text-slate-400 shrink-0 transition-transform duration-200 ${personnelFilterOpen ? "rotate-180 text-[#0047AB]" : ""}`} />
              </button>
              {personnelFilterOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex max-h-60 w-full min-w-full flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in-50 duration-150">
                  <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors border-b border-slate-100 pb-2 mb-0.5">
                    <input
                      type="checkbox"
                      checked={personnel.length === 0 || personnel.length === PERSONNEL.length}
                      onChange={() => setPersonnel([])}
                      className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
                    />
                    <span className="truncate">Tất cả</span>
                  </label>
                  {PERSONNEL.map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={personnel.includes(opt)}
                        onChange={() => toggleList("personnel", opt)}
                        className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
                      />
                      <span className="truncate">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Machines dropdown */}
            <div ref={machineRef} className="relative col-span-2 sm:col-span-1 min-w-0 flex-1">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Theo máy
              </span>
              <button
                type="button"
                onClick={() => {
                  setMachineFilterOpen((v) => !v);
                  setProjectFilterOpen(false);
                  setPersonnelFilterOpen(false);
                  setMethodFilterOpen(false);
                  setWeldTypeFilterOpen(false);
                }}
                className="flex h-10 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:border-slate-400 hover:text-slate-900 hover:bg-slate-50 cursor-pointer focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 focus:outline-hidden transition-all"
              >
                <span className="truncate">
                  {filterPickLabel(machines.length, "Tất cả")}
                </span>
                <CaretDown size={14} weight="bold" aria-hidden className={`text-slate-400 shrink-0 transition-transform duration-200 ${machineFilterOpen ? "rotate-180 text-[#0047AB]" : ""}`} />
              </button>
              {machineFilterOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex max-h-60 w-full min-w-full flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in-50 duration-150">
                  <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors border-b border-slate-100 pb-2 mb-0.5">
                    <input
                      type="checkbox"
                      checked={machines.length === 0 || machines.length === MACHINES.length}
                      onChange={() => setMachines([])}
                      className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
                    />
                    <span className="truncate">Tất cả</span>
                  </label>
                  {MACHINES.map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={machines.includes(opt)}
                        onChange={() => toggleList("machines", opt)}
                        className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
                      />
                      <span className="truncate">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Method + Weld Type + Apply / Clear Action Buttons */}
        <div className="flex flex-wrap items-end gap-2.5 sm:gap-3 pt-2.5 border-t border-slate-100">
          {/* Methods dropdown */}
          <div ref={methodRef} className="relative min-w-0 w-[calc(50%-5px)] sm:w-[220px]">
            <span className="mb-1 block text-xs font-semibold text-slate-600">
              Phương pháp hàn
            </span>
            <button
              type="button"
              onClick={() => {
                setMethodFilterOpen((v) => !v);
                setProjectFilterOpen(false);
                setPersonnelFilterOpen(false);
                setMachineFilterOpen(false);
                setWeldTypeFilterOpen(false);
              }}
              className="flex h-10 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:border-slate-400 hover:text-slate-900 hover:bg-slate-50 cursor-pointer focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 focus:outline-hidden transition-all"
            >
              <span className="truncate">
                {filterPickLabel(methods.length, "Tất cả")}
              </span>
              <CaretDown size={14} weight="bold" aria-hidden className={`text-slate-400 shrink-0 transition-transform duration-200 ${methodFilterOpen ? "rotate-180 text-[#0047AB]" : ""}`} />
            </button>
            {methodFilterOpen && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex max-h-60 w-full min-w-full flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in-50 duration-150">
                <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors border-b border-slate-100 pb-2 mb-0.5">
                  <input
                    type="checkbox"
                    checked={methods.length === 0 || methods.length === WELD_METHODS.length}
                    onChange={() => setMethods([])}
                    className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
                  />
                  <span className="truncate">Tất cả</span>
                </label>
                {WELD_METHODS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={methods.includes(opt.value)}
                      onChange={() => toggleList("methods", opt.value)}
                      className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
                    />
                    <span className="truncate font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Weld Types dropdown */}
          <div ref={weldTypeRef} className="relative min-w-0 w-[calc(50%-5px)] sm:w-[200px]">
            <span className="mb-1 block text-xs font-semibold text-slate-600">
              Loại mối hàn
            </span>
            <button
              type="button"
              onClick={() => {
                setWeldTypeFilterOpen((v) => !v);
                setProjectFilterOpen(false);
                setPersonnelFilterOpen(false);
                setMachineFilterOpen(false);
                setMethodFilterOpen(false);
              }}
              className="flex h-10 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:border-slate-400 hover:text-slate-900 hover:bg-slate-50 cursor-pointer focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 focus:outline-hidden transition-all"
            >
              <span className="truncate">
                {filterPickLabel(weldTypes.length, "Tất cả")}
              </span>
              <CaretDown size={14} weight="bold" aria-hidden className={`text-slate-400 shrink-0 transition-transform duration-200 ${weldTypeFilterOpen ? "rotate-180 text-[#0047AB]" : ""}`} />
            </button>
            {weldTypeFilterOpen && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex max-h-60 w-full min-w-full flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in-50 duration-150">
                <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors border-b border-slate-100 pb-2 mb-0.5">
                  <input
                    type="checkbox"
                    checked={weldTypes.length === 0 || weldTypes.length === WELD_TYPES.length}
                    onChange={() => setWeldTypes([])}
                    className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
                  />
                  <span className="truncate">Tất cả</span>
                </label>
                {WELD_TYPES.map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={weldTypes.includes(opt)}
                      onChange={() => toggleList("weldTypes", opt)}
                      className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
                    />
                    <span className="truncate">{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1 sm:pt-0 sm:ml-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="inline-flex items-center justify-center gap-1.5 h-10 flex-1 sm:flex-none rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-5 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all cursor-pointer whitespace-nowrap focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <SlidersHorizontal size={13} weight="fill" aria-hidden />
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

      {/* Row 1 — KPI chính */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Mối hàn đạt chuẩn"
          value={fmt(passed)}
          unit="mối"
          note="↑ 1,2% so tháng trước"
          noteColor="text-emerald-700"
          iconBg="bg-emerald-50 text-emerald-700 border border-emerald-200"
          labelColor="text-emerald-700"
          icon={
            <CheckCircle size={22} aria-hidden />
          }
        />
        <KpiCard
          label="Mối hàn không đạt"
          value={fmt(failed)}
          unit="mối"
          note={`${criticalDefects} lỗi nghiêm trọng`}
          noteColor="text-rose-700"
          iconBg="bg-rose-50 text-rose-700 border border-rose-200"
          labelColor="text-rose-700"
          icon={
            <XCircle size={22} aria-hidden />
          }
        />
        <KpiCard
          label="Tỷ lệ đạt chuẩn"
          value={passRate.toLocaleString("vi-VN")}
          unit="%"
          note={`First-pass ${qualityKpis.firstPassRate}%`}
          iconBg="bg-blue-50 text-[#0047AB] border border-blue-200/80"
          labelColor="text-[#0047AB]"
          icon={
            <SealCheck size={22} aria-hidden />
          }
        />
        <KpiCard
          label="Sửa / hàn lại"
          value={fmt(rework)}
          unit="mối"
          note={`TB ${qualityKpis.avgFixHours}h xử lý`}
          noteColor="text-amber-700"
          iconBg="bg-amber-50 text-amber-700 border border-amber-200"
          labelColor="text-amber-700"
          icon={
            <ArrowsClockwise size={22} aria-hidden />
          }
        />
      </div>

      {/* Row 2 — KPI bổ sung */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Tổng kiểm tra"
          value={fmt(totalInspected)}
          unit="mối"
          note="NDT + ngoại quan"
          iconBg="bg-slate-50 text-slate-700 border border-slate-200"
          labelColor="text-slate-700"
          icon={
            <ListChecks size={22} aria-hidden />
          }
        />
        <KpiCard
          label="NDT/UT đạt"
          value={fmt(ndtPassed)}
          unit="mối"
          note="Siêu âm & kiểm tra vết nứt"
          iconBg="bg-cyan-50 text-cyan-700 border border-cyan-200"
          labelColor="text-cyan-700"
          icon={
            <Eye size={22} aria-hidden />
          }
        />
        <KpiCard
          label="Ngoại quan không đạt"
          value={fmt(visualFailed)}
          unit="mối"
          note="Phát hiện bằng mắt thường"
          noteColor="text-purple-700"
          iconBg="bg-purple-50 text-purple-700 border border-purple-200"
          labelColor="text-purple-700"
          icon={
            <Eye size={22} aria-hidden />
          }
        />
        <KpiCard
          label="Ca đang mở"
          value={fmt(openCases)}
          unit="ca"
          note={`${qualityKpis.closedThisMonth} đã đóng tháng này`}
          noteColor="text-emerald-700"
          iconBg="bg-orange-50 text-orange-700 border border-orange-200"
          labelColor="text-orange-700"
          icon={
            <Warning size={22} aria-hidden />
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">Cơ cấu kết quả kiểm định</div>
          <div className="mt-0.5 text-xs text-slate-500">Đạt chuẩn, không đạt và phải xử lý lại</div>
          <div className="my-4 flex justify-center">
            <DonutChart rate={passRate} />
          </div>
          <div className="mt-2 divide-y divide-slate-100">
            {currentInspectionBreakdown.map((item) => (
              <div key={item.label} className="flex items-center gap-2 py-2.5 text-xs sm:text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                <span className="flex-1 min-w-0 truncate text-slate-700">{item.label}</span>
                <span className="font-semibold font-mono text-slate-900 shrink-0 tabular-nums">{fmt(item.count)} mối</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm sm:text-base font-bold tracking-tight text-slate-900">
                <Warning size={16} weight="fill" aria-hidden className="shrink-0 text-rose-600" />
                <span>Phân loại lỗi</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">Khuyết tật phát hiện qua NDT/UT và ngoại quan</div>
            </div>
            <span className="shrink-0 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-bold font-mono text-rose-700 tabular-nums shadow-2xs">
              {totalDefects} lỗi
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {currentDefectCategories.map((d) => {
              const pct = ((d.count / totalDefects) * 100).toFixed(1);
              const w = (d.count / maxDefect) * 100;
              return (
                <div key={d.name} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div className="w-[100px] sm:w-[130px] flex-none truncate text-slate-700 font-medium" title={d.name}>{d.name}</div>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${w}%`, background: d.color }} />
                    </div>
                    <span className="w-[68px] sm:w-[76px] flex-none text-right text-xs font-mono font-medium text-slate-500 tabular-nums">
                      {d.count} ({pct.replace(".", ",")}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Trend + plant */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">Xu hướng tỷ lệ đạt (8 tuần)</div>
          <div className="mt-0.5 text-xs text-slate-500">Theo dõi biến động chất lượng theo tuần</div>
          <div className="mt-4 flex h-[150px] sm:h-[160px] items-end gap-1 sm:gap-2">
            {weeklyTrend.map((w) => {
              const h = ((w.rate - minTrend + 0.5) / (maxTrend - minTrend + 1)) * 100;
              return (
                <div key={w.week} className="flex flex-1 min-w-0 flex-col items-center gap-1.5">
                  <span className="text-[11px] font-bold font-mono text-[#0047AB] whitespace-nowrap tabular-nums">{w.rate}%</span>
                  <div className="w-full max-w-[28px] sm:max-w-none overflow-hidden rounded-t-md bg-blue-50 group" style={{ height: `${Math.max(h, 20)}%` }}>
                    <div className="h-full w-full bg-[#0047AB] group-hover:bg-[#00388A] transition-colors" />
                  </div>
                  <span className="text-xs font-medium font-mono text-slate-500 truncate">{w.week}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">Chất lượng theo nhà máy</div>
          <div className="mt-0.5 text-xs text-slate-500">Tỷ lệ đạt và số mối không đạt</div>
          <div className="mt-4 flex flex-col gap-3.5">
            {currentPlantQuality.map((p) => (
              <div key={p.plant}>
                <div className="mb-1 flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-slate-900 truncate">{p.plant}</span>
                  <span className="text-[#0047AB] font-bold font-mono shrink-0 ml-2 tabular-nums">{p.passRate}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#0047AB]" style={{ width: `${p.passRate}%` }} />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  <span className="font-mono tabular-nums">{fmt(p.total)}</span> mối · <span className="text-rose-700 font-medium font-mono tabular-nums">{p.failed} không đạt</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rail type + welder ranking */}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">Theo loại ray</div>
          <div className="mt-3.5 flex flex-col gap-2.5">
            {currentRailTypeQuality.map((r) => (
              <div key={r.type} className="rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 hover:border-slate-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-semibold font-mono text-slate-900">{r.type}</span>
                  <span className="text-sm font-bold font-mono text-[#0047AB] tabular-nums">{r.passRate}%</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500"><span className="font-mono tabular-nums">{fmt(r.total)}</span> mối kiểm tra</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs overflow-hidden">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">Top thợ hàn theo chất lượng</div>
          <div className="table-scroll mt-3.5 overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3 whitespace-nowrap">Thợ hàn</th>
                  <th className="pb-2 pr-3 whitespace-nowrap">Welding ID</th>
                  <th className="pb-2 pr-3 whitespace-nowrap">Tổng mối</th>
                  <th className="pb-2 pr-3 whitespace-nowrap">Không đạt</th>
                  <th className="pb-2 whitespace-nowrap">Tỷ lệ đạt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentWelderQuality.map((w, i) => (
                  <tr key={w.weldingId} className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-bold font-mono text-[#0047AB] border border-blue-200">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-slate-900">{w.name}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500 whitespace-nowrap">{w.weldingId}</td>
                    <td className="py-2.5 pr-3 text-slate-700 font-mono tabular-nums whitespace-nowrap">{fmt(w.total)}</td>
                    <td className="py-2.5 pr-3 font-semibold font-mono text-rose-700 tabular-nums whitespace-nowrap">{w.failed}</td>
                    <td className="py-2.5 font-bold font-mono text-[#0047AB] tabular-nums whitespace-nowrap">{w.passRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent defects table */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs overflow-hidden">
        <div className="mb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
          <div>
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">Lỗi gần đây</div>
            <div className="mt-0.5 text-xs text-slate-500">Danh sách khuyết tật cần theo dõi</div>
          </div>
          <button type="button" className="self-start sm:self-auto text-xs sm:text-sm font-semibold text-[#0047AB] hover:underline cursor-pointer">
            Xem tất cả lỗi →
          </button>
        </div>
        <div className="table-scroll overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[760px] sm:min-w-[900px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-3.5 py-2.5 whitespace-nowrap">Ngày</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Mối hàn</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Loại lỗi</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Thợ hàn</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Nhà máy</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Mức độ</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentRecentDefects.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-3.5 py-2.5 text-slate-500 font-mono whitespace-nowrap">{d.date}</td>
                  <td className="px-3.5 py-2.5 font-mono text-xs font-bold text-[#0047AB] whitespace-nowrap">{d.weldJoint}</td>
                  <td className="px-3.5 py-2.5 text-slate-700 font-medium whitespace-nowrap">{d.defectType}</td>
                  <td className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{d.welder}</td>
                  <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">{d.plant}</td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${severityStyle[d.severity]}`}>
                      {d.severity}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${statusStyle[d.status]}`}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
