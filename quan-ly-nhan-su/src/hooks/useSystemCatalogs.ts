"use client";

import { useEffect, useMemo, useState } from "react";
import { sharedCatalogs, type CatalogGroup, type CatalogItem } from "@/data/systemConfig";
import { loadSystemConfiguration } from "@/lib/systemConfigurationClient";

export function useSystemCatalogs() {
  const [catalogs, setCatalogs] = useState<CatalogItem[]>(sharedCatalogs);

  useEffect(() => {
    let active = true;
    const load = () => {
      loadSystemConfiguration()
        .then((result) => {
          if (active) setCatalogs(result.catalogs);
        })
        .catch(() => {
          if (active) setCatalogs(sharedCatalogs);
        });
    };
    load();
    window.addEventListener("system-configuration-updated", load);
    return () => {
      active = false;
      window.removeEventListener("system-configuration-updated", load);
    };
  }, []);

  return catalogs;
}

export function useCatalogOptions(group: CatalogGroup, value: "code" | "name" = "code") {
  const catalogs = useSystemCatalogs();
  return useMemo(
    () => catalogs.filter((item) => item.group === group && item.active).map((item) => item[value]),
    [catalogs, group, value],
  );
}
