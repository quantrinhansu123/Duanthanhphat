import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/server/requireAccess";
import { createTrial, deleteTrial, listTrials, readTrial } from "@/lib/server/tb15TrialStore";
import { formatSupabaseError } from "@/lib/supabase/env";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const denied = await requireAccess("lwr-cong-thuc-tb10015", "view");
  if (denied) return denied;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const trial = await readTrial(id);
      if (!trial) return NextResponse.json({ error: "Bản lưu không còn." }, { status: 404, headers });
      return NextResponse.json({ trial }, { headers });
    }
    return NextResponse.json({ trials: await listTrials() }, { headers });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500, headers });
  }
}

export async function POST(request: Request) {
  const denied = await requireAccess("lwr-cong-thuc-tb10015", "edit");
  if (denied) return denied;
  try {
    const body = await request.json();
    const trial = await createTrial(body);
    return NextResponse.json({ trial }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : formatSupabaseError(error);
    const status = error instanceof SyntaxError ? 400 : /Thiếu|Nhập|không hợp lệ|Không xác định|vượt miền|chưa/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status, headers });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAccess("lwr-cong-thuc-tb10015", "delete");
  if (denied) return denied;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Thiếu bản lưu." }, { status: 400, headers });
    await deleteTrial(id);
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : formatSupabaseError(error);
    return NextResponse.json({ error: message }, { status: /không còn/i.test(message) ? 404 : 500, headers });
  }
}
