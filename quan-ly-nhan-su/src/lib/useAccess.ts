"use client";

import { useEffect, useState } from "react";
import { checkPermission, type PermissionAction, type StoredSystemConfiguration } from "@/data/systemConfig";
import { createClient } from "@/lib/supabase/client";
import { loadSystemConfiguration } from "@/lib/systemConfigurationClient";

type Loaded = { email?: string; config: Pick<StoredSystemConfiguration, "accounts" | "permissions"> };

const CACHE_KEY = "tp-access-v1";

/** Chỉ giữ tài khoản + quyền của chính người đăng nhập để lưu cache. */
function slim(email: string | undefined, config: StoredSystemConfiguration): Loaded {
  const account = email ? config.accounts.find((a) => a.email.toLowerCase() === email.toLowerCase()) : undefined;
  return {
    email,
    config: {
      accounts: account ? [account] : [],
      permissions: account && config.permissions ? { [account.role]: config.permissions[account.role] } : undefined,
    },
  };
}

function readCache(): Loaded | null {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null") as Loaded | null;
  } catch {
    return null;
  }
}

/**
 * Quyền của người đang đăng nhập theo bảng Phân quyền ở /cau-hinh (khớp tài khoản bằng email).
 * Chưa biết quyền (đang tải, chưa có cache) → `ready` = false và `can` trả false, để không lộ chức năng rồi mới ẩn.
 * Máy chủ kiểm tra lại cùng quy tắc (lib/server/requireAccess.ts); đây chỉ để ẩn/khóa giao diện.
 */
export function useAccess() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let active = true;
    const cached = readCache();
    if (cached) setLoaded(cached);

    const refresh = async () => {
      let next: Loaded;
      try {
        const [{ data }, config] = await Promise.all([createClient().auth.getUser(), loadSystemConfiguration()]);
        next = slim(data.user?.email ?? undefined, config);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          // sessionStorage bị chặn → bỏ qua cache
        }
      } catch {
        // Không tải được cấu hình → không hạn chế giao diện (máy chủ và database vẫn chặn).
        next = { config: { accounts: [] } };
      }
      if (active) setLoaded(next);
    };
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("system-configuration-updated", onUpdate);
    return () => {
      active = false;
      window.removeEventListener("system-configuration-updated", onUpdate);
    };
  }, []);

  const can = (tabId: string, action: PermissionAction) =>
    loaded !== null && checkPermission(loaded.config, loaded.email, tabId, action);

  return { ready: loaded !== null, can };
}
