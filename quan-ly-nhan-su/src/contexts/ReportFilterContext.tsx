"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  REPORT_PERIOD_END,
  REPORT_PERIOD_START,
  type AppliedReportFilters,
} from "@/lib/weldReportData";

type ReportFilterContextValue = {
  appliedFilters: AppliedReportFilters;
  hasFilter: boolean;
  filterCount: number;
  dateFrom: string;
  dateTo: string;
  projects: string[];
  personnel: string[];
  machines: string[];
  methods: string[];
  weldTypes: string[];
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  toggleList: (
    type: "projects" | "personnel" | "machines" | "methods" | "weldTypes",
    item: string,
  ) => void;
  setProjects: (value: string[]) => void;
  setPersonnel: (value: string[]) => void;
  setMachines: (value: string[]) => void;
  setMethods: (value: string[]) => void;
  setWeldTypes: (value: string[]) => void;
  applyFilters: () => void;
  clearFilters: () => void;
};

const defaultApplied: AppliedReportFilters = {
  dateFrom: REPORT_PERIOD_START,
  dateTo: REPORT_PERIOD_END,
  projects: [],
  personnel: [],
  machines: [],
  methods: [],
  weldTypes: [],
};

const ReportFilterContext = createContext<ReportFilterContextValue | null>(null);

export function ReportFilterProvider({ children }: { children: ReactNode }) {
  const [dateFrom, setDateFrom] = useState(REPORT_PERIOD_START);
  const [dateTo, setDateTo] = useState(REPORT_PERIOD_END);
  const [projects, setProjects] = useState<string[]>([]);
  const [personnel, setPersonnel] = useState<string[]>([]);
  const [machines, setMachines] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [weldTypes, setWeldTypes] = useState<string[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<AppliedReportFilters>(defaultApplied);

  function toggleList(
    type: "projects" | "personnel" | "machines" | "methods" | "weldTypes",
    item: string,
  ) {
    if (type === "projects") {
      setProjects((prev) =>
        prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
      );
    } else if (type === "personnel") {
      setPersonnel((prev) =>
        prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
      );
    } else if (type === "machines") {
      setMachines((prev) =>
        prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
      );
    } else if (type === "methods") {
      setMethods((prev) =>
        prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
      );
    } else {
      setWeldTypes((prev) =>
        prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
      );
    }
  }

  function applyFilters() {
    setAppliedFilters({
      dateFrom,
      dateTo,
      projects,
      personnel,
      machines,
      methods,
      weldTypes,
    });
  }

  function clearFilters() {
    setDateFrom(REPORT_PERIOD_START);
    setDateTo(REPORT_PERIOD_END);
    setProjects([]);
    setPersonnel([]);
    setMachines([]);
    setMethods([]);
    setWeldTypes([]);
    setAppliedFilters(defaultApplied);
  }

  const hasFilter =
    appliedFilters.dateFrom !== REPORT_PERIOD_START ||
    appliedFilters.dateTo !== REPORT_PERIOD_END ||
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
    (appliedFilters.dateFrom !== REPORT_PERIOD_START || appliedFilters.dateTo !== REPORT_PERIOD_END ? 1 : 0);

  const value = useMemo(
    () => ({
      appliedFilters,
      hasFilter,
      filterCount,
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
      setPersonnel,
      setMachines,
      setMethods,
      setWeldTypes,
      applyFilters,
      clearFilters,
    }),
    [
      appliedFilters,
      hasFilter,
      filterCount,
      dateFrom,
      dateTo,
      projects,
      personnel,
      machines,
      methods,
      weldTypes,
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
