"use client";

import { useCallback, useEffect, useState } from "react";
import type { MapPoint } from "@/data/mapPoints";
import { fetchMapPointsFromDb } from "@/lib/mapPointsDb";

type GpsOpts = { limit?: number; enabled?: boolean };

/** `limit` số hàng tối đa, hoặc `{ limit, enabled }` — `enabled: false` trì hoãn tải (ưu tiên bảng nhật ký trước). */
export function useWeldLogGpsPoints(opts?: number | GpsOpts) {
  const limit = typeof opts === "number" ? opts : opts?.limit;
  const enabled = typeof opts === "number" ? true : opts?.enabled !== false;
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setLoading(true);
    const result = await fetchMapPointsFromDb({ limit, force: true });
    setPoints(result.points);
    setError(result.error ?? "");
    setLoading(false);
    return result.points;
  }, [limit]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetchMapPointsFromDb({ limit })
      .then((result) => {
        if (!active) return;
        setPoints(result.points);
        setError(result.error ?? "");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [limit, enabled]);

  return { points, loading, error, refetch };
}
