"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  REPORT_PERIOD_END,
  REPORT_PERIOD_START,
  type AppliedReportFilters,
} from "@/lib/weldReportData";

type ListKey = "projects" | "personnel" | "machines" | "methods" | "weldTypes";

export type ReportPeriodMode = "day" | "year";

type DraftFilters = {
  periodMode: ReportPeriodMode;
  dateFrom: string;
  dateTo: string;
  projects: string[];
  personnel: string[];
  machines: string[];
  methods: string[];
  weldTypes: string[];
};

type ReportFilterContextValue = {
  appliedFilters: AppliedReportFilters;
  periodMode: ReportPeriodMode;
  appliedPeriodMode: ReportPeriodMode;
  hasFilter: boolean;
  filterCount: number;
  isDirty: boolean;
  dateFrom: string;
  dateTo: string;
  projects: string[];
  personnel: string[];
  machines: string[];
  methods: string[];
  weldTypes: string[];
  setPeriodMode: (mode: ReportPeriodMode) => void;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  setYearFrom: (year: string) => void;
  setYearTo: (year: string) => void;
  toggleList: (type: ListKey, item: string) => void;
  setProjects: (value: string[]) => void;
  setPersonnel: (value: string[]) => void;
  setMachines: (value: string[]) => void;
  setMethods: (value: string[]) => void;
  setWeldTypes: (value: string[]) => void;
  applyFilters: () => void;
  clearFilters: () => void;
};

const EMPTY_DRAFT: DraftFilters = {
  periodMode: "day",
  dateFrom: "",
  dateTo: "",
  projects: [],
  personnel: [],
  machines: [],
  methods: [],
  weldTypes: [],
};

function yearStart(year: string | number) {
  return `${year}-01-01`;
}

function yearEnd(year: string | number) {
  return `${year}-12-31`;
}

function toYearValue(iso: string, fallback: string) {
  if (!iso) return fallback;
  return iso.slice(0, 4);
}

function normalizeForMode(draft: DraftFilters): DraftFilters {
  if (draft.periodMode !== "year") return draft;

  const fromYear = draft.dateFrom
    ? draft.dateFrom.slice(0, 4)
    : REPORT_PERIOD_START.slice(0, 4);
  const toYear = draft.dateTo
    ? draft.dateTo.slice(0, 4)
    : REPORT_PERIOD_END.slice(0, 4);
  const start = Math.min(Number(fromYear), Number(toYear));
  const end = Math.max(Number(fromYear), Number(toYear));

  return {
    ...draft,
    dateFrom: draft.dateFrom || draft.dateTo ? yearStart(start) : "",
    dateTo: draft.dateFrom || draft.dateTo ? yearEnd(end) : "",
  };
}

function toApplied(draft: DraftFilters): AppliedReportFilters {
  const normalized = normalizeForMode(draft);
  return {
    dateFrom: normalized.dateFrom || REPORT_PERIOD_START,
    dateTo: normalized.dateTo || REPORT_PERIOD_END,
    projects: normalized.projects,
    personnel: normalized.personnel,
    machines: normalized.machines,
    methods: normalized.methods,
    weldTypes: normalized.weldTypes,
  };
}

function sameFilters(a: AppliedReportFilters, b: AppliedReportFilters) {
  return (
    a.dateFrom === b.dateFrom &&
    a.dateTo === b.dateTo &&
    a.projects.join("\0") === b.projects.join("\0") &&
    a.personnel.join("\0") === b.personnel.join("\0") &&
    a.machines.join("\0") === b.machines.join("\0") &&
    a.methods.join("\0") === b.methods.join("\0") &&
    a.weldTypes.join("\0") === b.weldTypes.join("\0")
  );
}

const ReportFilterContext = createContext<ReportFilterContextValue | null>(null);

export function ReportFilterProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<DraftFilters>(EMPTY_DRAFT);
  const [appliedFilters, setAppliedFilters] = useState<AppliedReportFilters>(() => toApplied(EMPTY_DRAFT));
  const [appliedPeriodMode, setAppliedPeriodMode] = useState<ReportPeriodMode>("day");

  const setPeriodMode = useCallback((mode: ReportPeriodMode) => {
    setDraft((prev) => normalizeForMode({ ...prev, periodMode: mode }));
  }, []);

  const setDateFrom = useCallback((value: string) => {
    setDraft((prev) => ({ ...prev, dateFrom: value }));
  }, []);

  const setDateTo = useCallback((value: string) => {
    setDraft((prev) => ({ ...prev, dateTo: value }));
  }, []);

  const setYearFrom = useCallback((year: string) => {
    setDraft((prev) => {
      const nextFrom = yearStart(year);
      const currentToYear = toYearValue(prev.dateTo, year);
      const nextTo =
        Number(currentToYear) < Number(year) ? yearEnd(year) : prev.dateTo ? yearEnd(currentToYear) : yearEnd(year);
      return {
        ...prev,
        periodMode: "year",
        dateFrom: nextFrom,
        dateTo: nextTo,
      };
    });
  }, []);

  const setYearTo = useCallback((year: string) => {
    setDraft((prev) => {
      const nextTo = yearEnd(year);
      const currentFromYear = toYearValue(prev.dateFrom, year);
      const nextFrom =
        Number(currentFromYear) > Number(year) ? yearStart(year) : prev.dateFrom ? yearStart(currentFromYear) : yearStart(year);
      return {
        ...prev,
        periodMode: "year",
        dateFrom: nextFrom,
        dateTo: nextTo,
      };
    });
  }, []);

  const setProjects = useCallback((value: string[]) => {
    setDraft((prev) => ({ ...prev, projects: value }));
  }, []);

  const setPersonnel = useCallback((value: string[]) => {
    setDraft((prev) => ({ ...prev, personnel: value }));
  }, []);

  const setMachines = useCallback((value: string[]) => {
    setDraft((prev) => ({ ...prev, machines: value }));
  }, []);

  const setMethods = useCallback((value: string[]) => {
    setDraft((prev) => ({ ...prev, methods: value }));
  }, []);

  const setWeldTypes = useCallback((value: string[]) => {
    setDraft((prev) => ({ ...prev, weldTypes: value }));
  }, []);

  const toggleList = useCallback((type: ListKey, item: string) => {
    setDraft((prev) => {
      const list = prev[type];
      const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
      return { ...prev, [type]: next };
    });
  }, []);

  const applyFilters = useCallback(() => {
    const normalized = normalizeForMode(draft);
    setDraft(normalized);
    setAppliedFilters(toApplied(normalized));
    setAppliedPeriodMode(normalized.periodMode);
  }, [draft]);

  const clearFilters = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setAppliedFilters(toApplied(EMPTY_DRAFT));
    setAppliedPeriodMode("day");
  }, []);

  const draftAsApplied = useMemo(() => toApplied(draft), [draft]);
  const isDirty =
    !sameFilters(draftAsApplied, appliedFilters) || draft.periodMode !== appliedPeriodMode;

  const hasFilter =
    appliedFilters.dateFrom !== REPORT_PERIOD_START ||
    appliedFilters.dateTo !== REPORT_PERIOD_END ||
    appliedFilters.projects.length > 0 ||
    appliedFilters.personnel.length > 0 ||
    appliedFilters.machines.length > 0 ||
    appliedFilters.methods.length > 0 ||
    appliedFilters.weldTypes.length > 0 ||
    appliedPeriodMode === "year";

  const filterCount =
    (appliedFilters.projects.length ? 1 : 0) +
    (appliedFilters.personnel.length ? 1 : 0) +
    (appliedFilters.machines.length ? 1 : 0) +
    (appliedFilters.methods.length ? 1 : 0) +
    (appliedFilters.weldTypes.length ? 1 : 0) +
    (appliedFilters.dateFrom !== REPORT_PERIOD_START || appliedFilters.dateTo !== REPORT_PERIOD_END ? 1 : 0) +
    (appliedPeriodMode === "year" ? 1 : 0);

  const value = useMemo(
    () => ({
      appliedFilters,
      periodMode: draft.periodMode,
      appliedPeriodMode,
      hasFilter,
      filterCount,
      isDirty,
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
      projects: draft.projects,
      personnel: draft.personnel,
      machines: draft.machines,
      methods: draft.methods,
      weldTypes: draft.weldTypes,
      setPeriodMode,
      setDateFrom,
      setDateTo,
      setYearFrom,
      setYearTo,
      toggleList,
      setProjects,
      setPersonnel,
      setMachines,
      setMethods,
      setWeldTypes,
      applyFilters,
      clearFilters,
    }),
    [
      appliedFilters,
      appliedPeriodMode,
      hasFilter,
      filterCount,
      isDirty,
      draft,
      setPeriodMode,
      setDateFrom,
      setDateTo,
      setYearFrom,
      setYearTo,
      toggleList,
      setProjects,
      setPersonnel,
      setMachines,
      setMethods,
      setWeldTypes,
      applyFilters,
      clearFilters,
    ],
  );

  return (
    <ReportFilterContext.Provider value={value}>{children}</ReportFilterContext.Provider>
  );
}

export function useReportFilters() {
  const context = useContext(ReportFilterContext);
  if (!context) {
    throw new Error("useReportFilters must be used within ReportFilterProvider");
  }
  return context;
}

export function reportYearOptions() {
  const start = Number(REPORT_PERIOD_START.slice(0, 4));
  const end = Number(REPORT_PERIOD_END.slice(0, 4));
  const years: string[] = [];
  for (let year = end; year >= start; year -= 1) years.push(String(year));
  return years;
}
