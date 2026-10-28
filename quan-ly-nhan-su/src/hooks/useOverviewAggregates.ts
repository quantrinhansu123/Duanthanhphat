"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppliedReportFilters } from "@/lib/weldReportData";
import {
  EMPTY_OVERVIEW_AGGREGATE,
  enrichOverviewProjectQuality,
  loadOverviewAggregates,
  type OverviewAggregateResult,
} from "@/lib/overviewAggregates";

function filtersKey(filters: Partial<AppliedReportFilters>) {
  return [
    filters.dateFrom ?? "",
    filters.dateTo ?? "",
    (filters.projects ?? []).join("\0"),
    (filters.personnel ?? []).join("\0"),
    (filters.machines ?? []).join("\0"),
    (filters.methods ?? []).join("\0"),
    (filters.weldTypes ?? []).join("\0"),
  ].join("|");
}

/**
 * Tải các tổng hợp nhẹ cho dashboard tổng quan. `enabled` được dùng để chỉ
 * chạy ở chế độ "Tất cả dữ liệu"; các bộ lọc chi tiết vẫn chuyển sang nhật ký
 * thật để giữ nguyên quy tắc lọc ngày/năm hiện có.
 */
export function useOverviewAggregates(
  filters: Partial<AppliedReportFilters>,
  enabled: boolean,
) {
  const [result, setResult] = useState<OverviewAggregateResult>(EMPTY_OVERVIEW_AGGREGATE);
  const [loading, setLoading] = useState(enabled);
  const key = useMemo(() => filtersKey(filters), [filters]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
    window.addEventListener("weld-quality-changed", refresh);
    return () => window.removeEventListener("weld-quality-changed", refresh);
  }, []);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setResult(EMPTY_OVERVIEW_AGGREGATE);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    loadOverviewAggregates(filters)
      .then(async (next) => {
        if (!active) return;
        setResult(next);
        setLoading(false);
        // Chất lượng theo dự án chạy nền — KPI đã hiện, không làm treo lần mở báo cáo.
        const projectRows = await enrichOverviewProjectQuality(next.projectRows);
        if (!active) return;
        setResult((prev) =>
          prev.source === next.source ? { ...prev, projectRows } : prev,
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setResult({
          ...EMPTY_OVERVIEW_AGGREGATE,
          error: error instanceof Error ? error.message : "Không tải được tổng hợp báo cáo",
        });
        setLoading(false);
      });

    return () => {
      active = false;
    };
    // `key` ổn định theo nội dung lọc — tránh refetch khi object filters đổi reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, revision]);

  return { ...result, loading };
}
