"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { EMPTY, getResource, isFresh, loadResource, mutateResource, subscribe, type Resource } from "@/lib/resourceCache";

/**
 * Tải dữ liệu có cache: có sẵn thì hiện ngay, quá `staleMs` thì làm mới ngầm.
 * `mutate` sửa cache tại chỗ để mọi nơi dùng chung key thấy ngay (không tải lại).
 */
export function useResource<T>(key: string, fetcher: () => Promise<T>, staleMs = 60_000) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const res = useSyncExternalStore(
    useCallback((fn) => subscribe(key, fn), [key]),
    () => getResource<T>(key),
    () => EMPTY as Resource<T>,
  );
  useEffect(() => {
    if (!isFresh(key, staleMs)) void loadResource(key, () => fetcherRef.current());
  }, [key, staleMs]);
  const reload = useCallback(() => loadResource(key, () => fetcherRef.current()), [key]);
  const mutate = useCallback((updater: (current: T) => T) => mutateResource(key, updater), [key]);
  return { ...res, reload, mutate };
}
