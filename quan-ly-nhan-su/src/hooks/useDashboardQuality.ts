"use client";

import { useEffect, useMemo, useState } from "react";
import { filterWeldReportRows, type WeldReportFilters, type WeldReportRow } from "@/lib/weldReportData";
import { loadDashboardQuality, type DashboardQualityData } from "@/lib/weldQualityClient";

/** Mối "Đạt" / "Chờ mài" cho Dashboard. Một nguồn duy nhất → số thẻ luôn bằng danh sách mở ra. */
export function useDashboardQuality(filters: WeldReportFilters) {
  const [data, setData] = useState<DashboardQualityData | null>(null);
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
    const acceptance = filterWeldReportRows(data.acceptance ?? [], filters);
    const signing = filterWeldReportRows(data.signing ?? [], filters);
    const ground = filterWeldReportRows(data.ground ?? [], filters);
    const ultrasound = filterWeldReportRows(data.ultrasound ?? [], filters);
    const paid = filterWeldReportRows(data.paid ?? [], filters);
    const sum = (rows: WeldReportRow[]) => rows.reduce((n, r) => n + r.so_luong_thuc_hien, 0);
    return { accepted, waiting, acceptance, signing, ground, ultrasound, paid, acceptedCount: sum(accepted), waitingCount: sum(waiting), acceptanceCount: sum(acceptance), signingCount: sum(signing),
      groundCount: sum(ground), ultrasoundCount: sum(ultrasound), paidCount: sum(paid) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, key, filters.personnel, filters.machines, filters.methods, filters.weldTypes]);
}
