"use client";

import { useEffect, useState } from "react";
import type { AppliedReportFilters } from "@/lib/weldReportData";
import {
  EMPTY_OVERVIEW_AGGREGATE,
  loadOverviewAggregates,
  type OverviewAggregateResult,
} from "@/lib/overviewAggregates";

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
      .then((next) => {
        if (active) setResult(next);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setResult({
          ...EMPTY_OVERVIEW_AGGREGATE,
          error: error instanceof Error ? error.message : "Không tải được tổng hợp báo cáo",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, filters]);

  return { ...result, loading };
}
