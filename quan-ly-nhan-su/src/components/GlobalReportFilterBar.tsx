"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReportFilters } from "@/contexts/ReportFilterContext";
import { loadMachineOptions } from "@/lib/machineRunSchedulesDb";
import { loadPersonnelPickerRows } from "@/lib/personnelCertificatesDb";
import { loadJournalProjectOptions } from "@/lib/weldReportData";
import { REPORT_MACHINES } from "@/lib/weldReportData";
import DateField from "@/components/DateField";

const WELD_METHODS = [
  { value: "FBW", label: "FBW (Hàn tiếp xúc)" },
  { value: "ATW", label: "ATW (Hàn nhiệt nhôm)" },
];

const WELD_TYPES = ["Sản xuất", "Thử nghiệm", "Đào tạo"];

function filterPickLabel(count: number, defaultText: string) {
  if (count === 0) return defaultText;
  return `Đã chọn (${count})`;
}

export default function GlobalReportFilterBar() {
  const reportFilters = useReportFilters();
  const [PROJECTS, setProjectsList] = useState<string[]>([]);
  const [PERSONNEL, setPersonnelList] = useState<string[]>([]);
  const [dbMachines, setDbMachines] = useState<string[]>([]);
  const MACHINES = useMemo(() => {
    const merged = Array.from(new Set([...dbMachines, ...REPORT_MACHINES]));
    return merged.filter(Boolean).sort((a, b) => a.localeCompare(b, "vi"));
  }, [dbMachines]);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadJournalProjectOptions().catch(() => []),
      loadPersonnelPickerRows().catch(() => []),
      loadMachineOptions().catch(() => []),
    ]).then(([projects, personnel, machines]) => {
      if (!active) return;
      setProjectsList(
        projects
          .map((item) => item.label.trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "vi")),
      );
      setPersonnelList(
        Array.from(
          new Set(personnel.map((row) => row.ho_ten.trim()).filter(Boolean)),
        ).sort((a, b) => a.localeCompare(b, "vi")),
      );
      setDbMachines(machines.map((m) => m.code).filter(Boolean));
    });
    return () => {
      active = false;
    };
  }, []);

  const {
    filterCount,
    hasFilter,
    appliedFilters,
    dateFrom,
    dateTo,
    projects,
    personnel,
    machines,
    methods,
    weldTypes,
    setDateFrom,
    setDateTo,
    toggleList,
    setProjects,
    setMachines,
    setPersonnel,
    setMethods,
    setWeldTypes,
    applyFilters,
    cancelFilters,
    clearFilters,
  } = reportFilters;

  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const [personnelFilterOpen, setPersonnelFilterOpen] = useState(false);
  const [machineFilterOpen, setMachineFilterOpen] = useState(false);
  const [methodFilterOpen, setMethodFilterOpen] = useState(false);
  const [weldTypeFilterOpen, setWeldTypeFilterOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeSummary = useMemo(() => {
    const parts: string[] = [];
    if (appliedFilters.dateFrom || appliedFilters.dateTo) {
      parts.push(
        `${appliedFilters.dateFrom || "…"} → ${appliedFilters.dateTo || "…"}`,
      );
    }
    if (appliedFilters.projects.length) parts.push(`${appliedFilters.projects.length} dự án`);
    if (appliedFilters.personnel.length) parts.push(`${appliedFilters.personnel.length} nhân sự`);
    if (appliedFilters.machines.length) parts.push(`${appliedFilters.machines.length} máy`);
    if (appliedFilters.methods.length) parts.push(`${appliedFilters.methods.length} phương pháp`);
    if (appliedFilters.weldTypes.length) parts.push(`${appliedFilters.weldTypes.length} loại mối`);
    return parts.length ? parts.join(" · ") : "Tất cả dữ liệu";
  }, [appliedFilters]);

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

  return (
    <div className="shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur-md z-20">
      <div className="w-full min-w-0 px-3 sm:px-5 lg:px-6 py-2">
        <div className={`${filtersOpen ? "overflow-visible" : "overflow-hidden"} rounded-xl border border-slate-200/80 bg-white shadow-xs`}>
          <div className="flex w-full items-center justify-between gap-3 px-3 sm:px-4 py-3 text-left">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left"
              aria-expanded={filtersOpen}
            >
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`shrink-0 text-slate-500 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[#0047AB]">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
              </svg>
              <span className="text-xs sm:text-sm font-bold text-slate-900">Bộ lọc báo cáo</span>
              <span className="hidden sm:inline text-xs text-slate-500">Áp dụng cho tất cả tab</span>
              {filterCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-[#0047AB] px-2 py-0.5 text-[11px] font-bold text-white font-mono shadow-xs">
                  {filterCount}
                </span>
              )}
              {!filtersOpen && (
                <span className="min-w-0 truncate text-xs text-slate-500">{activeSummary}</span>
              )}
            </span>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              {hasFilter ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFilters();
                  }}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Xóa bộ lọc
                </button>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  Đang xem tất cả
                </span>
              )}
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className="text-xs sm:text-sm font-semibold text-[#0047AB] hover:text-[#003580] cursor-pointer"
                aria-expanded={filtersOpen}
              >
                {filtersOpen ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
              </button>
            </div>
          </div>

          {filtersOpen && (
            <form
              className="border-t border-slate-200 p-3 sm:p-4 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                applyFilters();
              }}
            >
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-2">
              <div className="min-w-0">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Từ ngày</span>
                <DateField
                  value={dateFrom}
                  onChange={(val) => {
                    setDateFrom(val);
                    if (dateTo && val > dateTo) setDateTo(val);
                  }}
                  placeholder="dd/mm/yyyy"
                  className="w-full min-w-0"
                />
              </div>

              <div className="min-w-0">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Đến ngày</span>
                <DateField
                  value={dateTo}
                  onChange={(val) => {
                    setDateTo(val);
                    if (dateFrom && val < dateFrom) setDateFrom(val);
                  }}
                  placeholder="dd/mm/yyyy"
                  className="w-full min-w-0"
                />
              </div>

              <div ref={projectRef} className="relative col-span-2 min-w-0">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Theo dự án</span>
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
                  <span className="truncate">{filterPickLabel(projects.length, "Tất cả")}</span>
                  <svg className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${projectFilterOpen ? "rotate-180 text-[#0047AB]" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {projectFilterOpen && (
                  <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex max-h-60 w-full min-w-full touch-pan-y flex-col gap-1 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer border-b border-slate-100 pb-2 mb-0.5">
                      <input type="checkbox" checked={projects.length === 0 || projects.length === PROJECTS.length} onChange={() => setProjects([])} className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0" />
                      <span className="truncate">Tất cả</span>
                    </label>
                    {PROJECTS.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={projects.includes(opt)} onChange={() => toggleList("projects", opt)} className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0" />
                        <span className="truncate">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div ref={personnelRef} className="relative min-w-0">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Theo nhân sự</span>
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
                  <span className="truncate">{filterPickLabel(personnel.length, "Tất cả")}</span>
                  <svg className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${personnelFilterOpen ? "rotate-180 text-[#0047AB]" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {personnelFilterOpen && (
                  <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex max-h-60 w-full min-w-full touch-pan-y flex-col gap-1 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer border-b border-slate-100 pb-2 mb-0.5">
                      <input type="checkbox" checked={personnel.length === 0 || personnel.length === PERSONNEL.length} onChange={() => setPersonnel([])} className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0" />
                      <span className="truncate">Tất cả</span>
                    </label>
                    {PERSONNEL.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={personnel.includes(opt)} onChange={() => toggleList("personnel", opt)} className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0" />
                        <span className="truncate">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div ref={machineRef} className="relative min-w-0">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Theo máy</span>
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
                  <span className="truncate">{filterPickLabel(machines.length, "Tất cả")}</span>
                  <svg className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${machineFilterOpen ? "rotate-180 text-[#0047AB]" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {machineFilterOpen && (
                  <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex max-h-60 w-full min-w-full touch-pan-y flex-col gap-1 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer border-b border-slate-100 pb-2 mb-0.5">
                      <input type="checkbox" checked={machines.length === 0 || machines.length === MACHINES.length} onChange={() => setMachines([])} className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0" />
                      <span className="truncate">Tất cả</span>
                    </label>
                    {MACHINES.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={machines.includes(opt)} onChange={() => toggleList("machines", opt)} className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0" />
                        <span className="truncate">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

          <div className="grid grid-cols-2 items-end gap-2.5 border-t border-slate-100 pt-3 sm:gap-3 lg:grid-cols-2">
            <div ref={methodRef} className="relative min-w-0">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Phương pháp hàn</span>
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
                <span className="truncate">{filterPickLabel(methods.length, "Tất cả")}</span>
                <svg className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${methodFilterOpen ? "rotate-180 text-[#0047AB]" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {methodFilterOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex max-h-60 w-full min-w-full touch-pan-y flex-col gap-1 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer border-b border-slate-100 pb-2 mb-0.5">
                    <input type="checkbox" checked={methods.length === 0 || methods.length === WELD_METHODS.length} onChange={() => setMethods([])} className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0" />
                    <span className="truncate">Tất cả</span>
                  </label>
                  {WELD_METHODS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={methods.includes(opt.value)} onChange={() => toggleList("methods", opt.value)} className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0" />
                      <span className="truncate font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div ref={weldTypeRef} className="relative min-w-0">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Loại mối hàn</span>
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
                <span className="truncate">{filterPickLabel(weldTypes.length, "Tất cả")}</span>
                <svg className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${weldTypeFilterOpen ? "rotate-180 text-[#0047AB]" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {weldTypeFilterOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex max-h-60 w-full min-w-full touch-pan-y flex-col gap-1 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer border-b border-slate-100 pb-2 mb-0.5">
                    <input type="checkbox" checked={weldTypes.length === 0 || weldTypes.length === WELD_TYPES.length} onChange={() => setWeldTypes([])} className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0" />
                    <span className="truncate">Tất cả</span>
                  </label>
                  {WELD_TYPES.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={weldTypes.includes(opt)} onChange={() => toggleList("weldTypes", opt)} className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0" />
                      <span className="truncate">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={applyFilters}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer sm:w-auto"
              >
                Lọc tất cả
              </button>
              <button
                type="button"
                onClick={cancelFilters}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#0047AB] px-4 text-xs sm:text-sm font-semibold text-white hover:bg-[#00388A] cursor-pointer shadow-xs sm:w-auto"
              >
                Hủy
              </button>
            </div>
          </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
