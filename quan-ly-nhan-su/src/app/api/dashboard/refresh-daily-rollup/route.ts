import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/server/requireAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSupabaseError } from "@/lib/supabase/env";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return NextResponse.json({ error: "Không chấp nhận yêu cầu từ website khác." }, { status: 403 });
  }

  const denied = await requireAccess("bc-tong-quan", "view");
  if (denied) return denied;

  try {
    const { data, error } = await createAdminClient().rpc(
      "rebuild_thong_ke_moi_han_theo_ngay_today_yesterday",
    );
    if (error) {
      const message = formatSupabaseError(error);
      if (
        error.code === "42883" ||
        /could not find the function|schema cache/i.test(message)
      ) {
        return NextResponse.json(
          { error: "Chưa cài SQL làm mới biểu đồ. Hãy áp dụng migration_20261125_refresh_daily_dashboard_rollup.sql trên Supabase." },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}
