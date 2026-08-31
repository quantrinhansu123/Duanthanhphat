"use client";

import { useEffect, useState } from "react";
import { loadWeldReportRows, type WeldReportRow } from "@/lib/weldReportData";

export function useWeldReportData() {
  const [rows, setRows] = useState<WeldReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadWeldReportRows()
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu Supabase");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { rows, loading, error };
}
