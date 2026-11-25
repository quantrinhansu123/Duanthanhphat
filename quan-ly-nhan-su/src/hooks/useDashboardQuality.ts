"use client";

import { useEffect, useMemo, useState } from "react";
import { filterWeldReportRows, type WeldReportFilters, type WeldReportRow } from "@/lib/weldReportData";
import { loadDashboardQuality, type DashboardQualityData } from "@/lib/weldQualityClient";

const PQ_PROJECT_ID = "2370b59d-acd5-40a9-9f3f-94445a648a1a";
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

/** Dự án hiện tại (PQ — Phú Quốc), theo id hoặc tên/mã dự án. */
export function isCurrentProject(id?: string | null, name?: string | null, code?: string | null) {
  if (id === PQ_PROJECT_ID) return true;
  return /phu quoc/.test(plain(name ?? "")) || /^pq\b/i.test((code ?? "").trim());
}
const isCurrentProjectRow = (row: WeldReportRow) => isCurrentProject(row.du_an_id, row.du_an, row.ma_du_an);

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
    const isProduction = (row: WeldReportRow) => row.loai_moi_han === "Sản xuất";
    // Các ô trạng thái chất lượng chỉ tính dự án hiện tại (PQ); dự án cũ chỉ góp vào Đã ký / Đã thanh toán ở phía dashboard.
    const current = (rows: WeldReportRow[]) => filterWeldReportRows(rows, filters).filter(isCurrentProjectRow);
    // Đã ký / thanh toán gắn với Đạt: chỉ mối sản xuất (khớp mẫu số «tổng sản xuất»).
    const accepted = current(data.accepted).filter(isProduction);
    const waiting = current(data.waiting);
    const acceptance = current(data.acceptance ?? []);
    const signing = current(data.signing ?? []);
    const ground = current(data.ground ?? []);
    const ultrasound = current(data.ultrasound ?? []);
    const paid = current(data.paid ?? []).filter(isProduction);
    const partialPaid = current(data.partialPaid ?? []).filter(isProduction);
    const unpaid = current(data.unpaid ?? []).filter(isProduction);
    const sum = (rows: WeldReportRow[]) => rows.reduce((n, r) => n + r.so_luong_thuc_hien, 0);
    return { accepted, waiting, acceptance, signing, ground, ultrasound, paid, partialPaid, unpaid, acceptedCount: sum(accepted), waitingCount: sum(waiting), acceptanceCount: sum(acceptance), signingCount: sum(signing),
      groundCount: sum(ground), ultrasoundCount: sum(ultrasound), paidCount: sum(paid), partialPaidCount: sum(partialPaid), unpaidCount: sum(unpaid) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, key, filters.personnel, filters.machines, filters.methods, filters.weldTypes]);
}
