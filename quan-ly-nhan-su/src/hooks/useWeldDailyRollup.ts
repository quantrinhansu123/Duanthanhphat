"use client";

import { useEffect, useState } from "react";
import {
  loadWeldDailyRollupRows,
  type WeldDailyRollupResult,
} from "@/lib/weldDailyStats";

const EMPTY_RESULT: WeldDailyRollupResult = {
  rows: [],
  source: "unavailable",
};

/** Tải bảng rollup rất nhỏ song song với nhật ký chi tiết. */
export function useWeldDailyRollup() {
  const [result, setResult] = useState<WeldDailyRollupResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadWeldDailyRollupRows()
      .then((next) => {
        if (active) setResult(next);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setResult({
          rows: [],
          source: "unavailable",
          error: error instanceof Error ? error.message : "Không tải được tổng hợp theo ngày",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { ...result, loading };
}
