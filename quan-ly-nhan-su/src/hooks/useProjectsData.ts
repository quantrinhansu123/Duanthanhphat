"use client";

import { useCallback, useEffect, useState } from "react";
import type { Project } from "@/data/projects";
import { invalidateProjectsCache, loadProjects } from "@/lib/projectsDb";

export function useProjectsData() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"supabase" | "seed">("seed");

  const reload = useCallback(async () => {
    setLoading(true);
    invalidateProjectsCache();
    try {
      const result = await loadProjects();
      setProjects(result.projects);
      setSource(result.source);
      setError(result.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách dự án");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { projects, setProjects, loading, error, source, reload };
}
