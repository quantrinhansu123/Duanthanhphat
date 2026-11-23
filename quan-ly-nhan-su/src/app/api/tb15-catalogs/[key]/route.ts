import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/server/requireAccess";
import { catalogByKey, TB15_CATALOG_KEYS, type Tb15CatalogKey } from "@/lib/tb15Catalogs";
import { deleteCatalog, listCatalog, saveCatalog } from "@/lib/server/tb15CatalogStore";
import { formatSupabaseError } from "@/lib/supabase/env";

function parseKey(raw: string): Tb15CatalogKey | null {
  return (TB15_CATALOG_KEYS as readonly string[]).includes(raw) ? (raw as Tb15CatalogKey) : null;
}

type Ctx = { params: Promise<{ key: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { key: raw } = await ctx.params;
  const key = parseKey(raw);
  const meta = key ? catalogByKey(key) : null;
  if (!key || !meta) return NextResponse.json({ error: "Bảng không hợp lệ." }, { status: 404 });
  const denied = await requireAccess(meta.tabId, "view");
  if (denied) return denied;
  try {
    const { rows, backend } = await listCatalog(key);
    return NextResponse.json({ key, rows, backend });
  } catch (e) {
    return NextResponse.json({ error: formatSupabaseError(e) }, { status: 500 });
  }
}

async function upsert(request: Request, ctx: Ctx, editing: boolean) {
  const { key: raw } = await ctx.params;
  const key = parseKey(raw);
  const meta = key ? catalogByKey(key) : null;
  if (!key || !meta) return NextResponse.json({ error: "Bảng không hợp lệ." }, { status: 404 });
  const denied = await requireAccess(meta.tabId, "edit");
  if (denied) return denied;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 });
    }
    const { row, backend } = await saveCatalog(key, body as Record<string, unknown>, editing);
    return NextResponse.json({ row, backend });
  } catch (e) {
    const message = e instanceof Error ? e.message : formatSupabaseError(e);
    const status = e instanceof SyntaxError ? 400 : /không còn tồn tại/i.test(message) ? 404 : /Thiếu|không hợp lệ|phải/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const POST = (request: Request, ctx: Ctx) => upsert(request, ctx, false);
export const PUT = (request: Request, ctx: Ctx) => upsert(request, ctx, true);

export async function DELETE(request: Request, ctx: Ctx) {
  const { key: raw } = await ctx.params;
  const key = parseKey(raw);
  const meta = key ? catalogByKey(key) : null;
  if (!key || !meta) return NextResponse.json({ error: "Bảng không hợp lệ." }, { status: 404 });
  const denied = await requireAccess(meta.tabId, "delete");
  if (denied) return denied;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Thiếu id." }, { status: 400 });
    const { backend } = await deleteCatalog(key, id);
    return NextResponse.json({ ok: true, backend });
  } catch (e) {
    const message = e instanceof Error ? e.message : formatSupabaseError(e);
    return NextResponse.json({ error: message }, { status: /không còn tồn tại/i.test(message) ? 404 : 500 });
  }
}
