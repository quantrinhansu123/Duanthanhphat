"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizePhone, type InitialAccount } from "@/data/systemConfig";
import { loadSystemConfiguration } from "@/lib/systemConfigurationClient";

/**
 * Đổi tài khoản người lập / người ký (email đăng nhập dạng 0912345678@thanhphat.vn) thành HỌ TÊN theo bảng Tài khoản.
 * Không tìm thấy thì giữ nguyên giá trị gốc.
 */
export function useActorNames() {
  const [accounts, setAccounts] = useState<InitialAccount[]>([]);
  useEffect(() => {
    let active = true;
    const load = () => { void loadSystemConfiguration().then((c) => { if (active) setAccounts(c.accounts ?? []); }).catch(() => undefined); };
    load();
    window.addEventListener("system-configuration-updated", load);
    return () => { active = false; window.removeEventListener("system-configuration-updated", load); };
  }, []);
  const byKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of accounts) {
      if (!account.fullName) continue;
      if (account.email) map.set(account.email.trim().toLowerCase(), account.fullName);
      const phone = normalizePhone(account.phone);
      if (phone) map.set(phone, account.fullName);
    }
    return map;
  }, [accounts]);
  return (value: string | null | undefined) => {
    const raw = (value ?? "").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    return byKey.get(lower) ?? byKey.get(normalizePhone(lower.split("@")[0])) ?? raw;
  };
}
