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

/** Trả tài khoản đã xác thực để API không phải gọi getUser lần thứ hai. */
export async function requireAuthenticatedUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return { denied: null, user: null };
  try {
    const { data } = await (await createClient()).auth.getUser();
    if (!data.user) return { denied: NextResponse.json({ error: "Cần đăng nhập để sử dụng chức năng này." }, { status: 401 }), user: null };
    return { denied: null, user: data.user };
  } catch {
    return { denied: NextResponse.json({ error: "Không xác minh được quyền truy cập." }, { status: 401 }), user: null };
  }
}

/** Chặn API theo bảng phân quyền; tabId null chỉ yêu cầu đăng nhập. */
export async function requireAccess(tabId: string | null, action: PermissionAction = "view") {
  const { denied, user } = await requireAuthenticatedUser();
  if (denied || !tabId || !user) return denied;
  try {
    const stored = await readPrivateJson<StoredSystemConfiguration>("system-configuration.json");
    const config = { accounts: stored?.accounts ?? initialAccounts, permissions: stored?.permissions ?? defaultPermissions };
    if (checkPermission(config, user.email, tabId, action)) return null;
    return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Không xác minh được quyền truy cập." }, { status: 401 });
  }
}
