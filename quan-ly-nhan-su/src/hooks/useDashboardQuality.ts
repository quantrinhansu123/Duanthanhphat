"use client";

import { useEffect, useMemo, useState } from "react";
import { filterWeldReportRows, type WeldReportFilters, type WeldReportRow } from "@/lib/weldReportData";
import { loadDashboardQuality } from "@/lib/weldQualityClient";

/** Mối "Nghiệm thu đạt" / "Chờ mài" cho Dashboard. Một nguồn duy nhất → số thẻ luôn bằng danh sách mở ra. */
export function useDashboardQuality(filters: WeldReportFilters) {
  const [data, setData] = useState<{ accepted: WeldReportRow[]; waiting: WeldReportRow[] } | null>(null);
  const key = JSON.stringify([filters.projects ?? [], filters.dateFrom ?? "", filters.dateTo ?? ""]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener("weld-quality-changed", onChange);
    return () => window.removeEventListener("weld-quality-changed", onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const [projects, dateFrom, dateTo] = JSON.parse(key) as [string[], string, string];
    loadDashboardQuality({ projects, dateFrom, dateTo })
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setData(null); }); // chưa đăng nhập/cấu hình: thẻ hiện "—"
    return () => { cancelled = true; };
  }, [key, tick]);

  return useMemo(() => {
    if (!data) return null;
    const accepted = filterWeldReportRows(data.accepted, filters);
    const waiting = filterWeldReportRows(data.waiting, filters);
    const sum = (rows: WeldReportRow[]) => rows.reduce((n, r) => n + r.so_luong_thuc_hien, 0);
    return { accepted, waiting, acceptedCount: sum(accepted), waitingCount: sum(waiting) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, key, filters.personnel, filters.machines, filters.methods, filters.weldTypes]);
}
