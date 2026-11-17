import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAccess } from "@/lib/server/requireAccess";
import { formatSupabaseError } from "@/lib/supabase/env";

/**
 * Trả về mọi mã hệ thống cùng tiền tố (vd DANB-FBW-) bằng service role —
 * mọi tài khoản nhận cùng số TT tiếp theo, không phụ thuộc bộ lọc nhật ký trên UI.
 */
export async function POST(request: Request) {
  try {
    const denied = await requireAccess("nhat-ky-han", "view");
    if (denied) return denied;
    const body = (await request.json()) as { prefix?: unknown };
    const prefix = typeof body.prefix === "string" ? body.prefix.trim() : "";
    if (!prefix || prefix.length > 40 || /[%_,]/.test(prefix)) {
      return NextResponse.json({ error: "Tiền tố mã không hợp lệ." }, { status: 400 });
    }
    const db = createAdminClient();
    const codes: string[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await db
        .from("lich_su_moi_han")
        .select("ma_lich_su")
        .ilike("ma_lich_su", `${prefix}%`)
        .order("ma_lich_su", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = (data ?? [])
        .map((row) => String((row as { ma_lich_su?: string }).ma_lich_su ?? "").trim())
        .filter(Boolean);
      codes.push(...page);
      if (page.length < pageSize) break;
    }
    return NextResponse.json({ codes }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = formatSupabaseError(error);
    const status = /đăng nhập|Không có quyền|Unauthorized|403|401/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
