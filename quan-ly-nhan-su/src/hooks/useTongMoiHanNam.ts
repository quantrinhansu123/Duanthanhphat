"use client";

import { useEffect, useState } from "react";
import {
  loadTongMoiHanNam,
  type TongMoiHanNamBundle,
} from "@/lib/tongMoiHanNamDb";

export function useTongMoiHanNam() {
  const [bundle, setBundle] = useState<TongMoiHanNamBundle>({
    years: [],
    byProject: [],
    byPersonnel: [],
    byMethod: [],
    byWeldType: [],
    source: "empty",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadTongMoiHanNam()
      .then((data) => {
        if (!active) return;
        setBundle(data);
        setError(data.error ?? "");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Không tải được tổng hợp năm");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { ...bundle, loading, error };
}
