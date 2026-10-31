import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/server/requireAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSupabaseError } from "@/lib/supabase/env";

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id"), groupId = url.searchParams.get("groupId"), title = url.searchParams.get("title")?.trim();
  const denied = await requireAccess("chung-chi", "delete");
  if (denied) {
    if (!id) return denied;
    const personnelDenied = await requireAccess("ho-so-tho-han", "delete");
    if (personnelDenied) return personnelDenied;
  }
  if (request.headers.get("origin") && request.headers.get("origin") !== url.origin) {
    return NextResponse.json({ error: "Không chấp nhận yêu cầu từ website khác." }, { status: 403 });
  }
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  if ((!id && !groupId && !title) || (id && !uuid.test(id)) || (groupId && !uuid.test(groupId)) || (title && title.length > 300)) {
    return NextResponse.json({ error: "Mã hoặc tên chứng chỉ không hợp lệ." }, { status: 400 });
  }
  try {
    const { error } = await createAdminClient().rpc("xoa_chung_chi_an_toan", { p_nhom_id: groupId, p_ten_chung_chi: title || null, p_chung_chi_id: id });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}
