"use client";

import { useCallback, useEffect, useState } from "react";
import { formatSupabaseError } from "@/lib/supabase/env";
import {
  loadWeldReportRows,
  type LoadWeldReportOptions,
  type WeldReportRow,
} from "@/lib/weldReportData";

export function useWeldReportData(
  dateFrom?: string,
  dateTo?: string,
  options?: LoadWeldReportOptions,
) {
  const mode = options?.mode ?? "full";
  const [rows, setRows] = useState<WeldReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadWeldReportRows(dateFrom, dateTo, { mode })
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(formatSupabaseError(loadError));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dateFrom, dateTo, mode, reloadKey]);

  return { rows, loading, error, refetch };
}
