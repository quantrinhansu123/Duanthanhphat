import "server-only";

import { NextResponse } from "next/server";
import {
  checkPermission,
  defaultPermissions,
  initialAccounts,
  type PermissionAction,
  type StoredSystemConfiguration,
} from "@/data/systemConfig";
import { readPrivateJson } from "@/lib/server/privateJsonStorage";
import { createClient } from "@/lib/supabase/server";

/**
 * Chặn API theo bảng Phân quyền. Trả về NextResponse lỗi (401/403) nếu bị từ chối, null nếu được phép.
 * `tabId` null = chỉ cần đã đăng nhập.
 */
export async function requireAccess(tabId: string | null, action: PermissionAction = "view") {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  try {
    const { data } = await (await createClient()).auth.getUser();
    if (!data.user) return NextResponse.json({ error: "Cần đăng nhập để sử dụng chức năng này." }, { status: 401 });
    if (!tabId) return null;
    const stored = await readPrivateJson<StoredSystemConfiguration>("system-configuration.json");
    const config = { accounts: stored?.accounts ?? initialAccounts, permissions: stored?.permissions ?? defaultPermissions };
    if (checkPermission(config, data.user.email, tabId, action)) return null;
    return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Không xác minh được quyền truy cập." }, { status: 401 });
  }
}
