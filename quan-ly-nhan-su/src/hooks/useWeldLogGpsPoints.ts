"use client";

import { useEffect, useState } from "react";
import type { MapPoint } from "@/data/mapPoints";
import { fetchMapPointsFromDb } from "@/lib/mapPointsDb";

export function useWeldLogGpsPoints(limit?: number) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
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
  }, [limit]);

  return { points, loading, error };
}
