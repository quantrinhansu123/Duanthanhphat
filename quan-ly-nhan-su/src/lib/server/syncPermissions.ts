import "server-only";

import type { StoredSystemConfiguration } from "@/data/systemConfig";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Đẩy tài khoản + quyền sang bảng database để RLS (hàm app_can) dùng.
 * Cần chạy supabase/migration_20261029_phan_quyen.sql trước; chưa chạy thì bỏ qua, trả về cảnh báo.
 * ponytail: xóa rồi chèn lại, không atomic — đủ cho vài chục tài khoản, chuyển sang RPC nếu cần.
 */
export async function syncPermissionsToDb(config: StoredSystemConfiguration): Promise<string | null> {
  try {
    const db = createAdminClient();
    const accounts = config.accounts
      .filter((a) => a.email.trim())
      .map((a) => ({ email: a.email.trim().toLowerCase(), role: a.role, status: a.status }));
    const rules = Object.entries(config.permissions ?? {}).flatMap(([role, tabs]) =>
      Object.entries(tabs).map(([tab_id, p]) => ({
        role,
        tab_id,
        can_view: p.view,
        can_edit: p.edit,
        can_delete: p.delete,
      })),
    );
    const accountsCleared = await db.from("tai_khoan_phan_quyen").delete().neq("email", "");
    if (accountsCleared.error) throw accountsCleared.error;
    if (accounts.length) {
      const inserted = await db.from("tai_khoan_phan_quyen").insert(accounts);
      if (inserted.error) throw inserted.error;
    }
    const rulesCleared = await db.from("phan_quyen").delete().neq("role", "");
    if (rulesCleared.error) throw rulesCleared.error;
    if (rules.length) {
      const inserted = await db.from("phan_quyen").insert(rules);
      if (inserted.error) throw inserted.error;
    }
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Đồng bộ phân quyền sang database lỗi:", message);
    return "Chưa đồng bộ được quyền sang database — chạy supabase/migration_20261029_phan_quyen.sql trên Supabase.";
  }
}
