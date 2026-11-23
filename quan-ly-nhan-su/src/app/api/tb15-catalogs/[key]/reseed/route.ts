import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/server/requireAccess";
import { catalogByKey, TB15_CATALOG_KEYS, type Tb15CatalogKey } from "@/lib/tb15Catalogs";
import { replaceCatalogSeed } from "@/lib/server/tb15CatalogStore";
import { formatSupabaseError } from "@/lib/supabase/env";

type Ctx = { params: Promise<{ key: string }> };

/** POST: thay toàn bộ catalog bằng seed đầy đủ (QCVN / Excel). */
export async function POST(_request: Request, ctx: Ctx) {
  const { key: raw } = await ctx.params;
  if (!(TB15_CATALOG_KEYS as readonly string[]).includes(raw)) {
    return NextResponse.json({ error: "Bảng không hợp lệ." }, { status: 404 });
  }
  const key = raw as Tb15CatalogKey;
  const meta = catalogByKey(key);
  if (!meta) return NextResponse.json({ error: "Bảng không hợp lệ." }, { status: 404 });
  const denied = await requireAccess(meta.tabId, "edit");
  if (denied) return denied;

  try {
    const result = await replaceCatalogSeed(key);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : formatSupabaseError(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
