import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/server/requireAccess";
import { readPrivateJson, writePrivateJson } from "@/lib/server/privateJsonStorage";
import { formatSupabaseError } from "@/lib/supabase/env";

const FILE = "rfi-signatures.json";
const KEYS = new Set(["chi-huy-truong", "nha-thau-phu", "gach-trang-tri"]);
const MAX_DATA_URL = 300_000; // ~220KB ảnh; client đã thu nhỏ trước khi gửi

type Store = Record<string, string>;

export async function GET() {
  const denied = await requireAccess(null);
  if (denied) return denied;
  try {
    return NextResponse.json({ signatures: (await readPrivateJson<Store>(FILE)) ?? {} });
  } catch (e) { return NextResponse.json({ error: formatSupabaseError(e) }, { status: 500 }); }
}

/** Body: { key, dataUrl }; dataUrl = null để xóa. */
export async function PUT(request: Request) {
  const denied = await requireAccess("bien-ban-moi-han", "edit");
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => null) as { key?: unknown; dataUrl?: unknown } | null;
    const key = typeof body?.key === "string" ? body.key : "";
    if (!KEYS.has(key)) return NextResponse.json({ error: "Loại chữ ký không hợp lệ." }, { status: 400 });
    const store = (await readPrivateJson<Store>(FILE)) ?? {};
    if (body?.dataUrl === null) delete store[key];
    else {
      const dataUrl = typeof body?.dataUrl === "string" ? body.dataUrl : "";
      if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) return NextResponse.json({ error: "Chỉ nhận ảnh PNG hoặc JPEG." }, { status: 400 });
      if (dataUrl.length > MAX_DATA_URL) return NextResponse.json({ error: "Ảnh quá lớn, hãy chọn ảnh nhỏ hơn." }, { status: 413 });
      store[key] = dataUrl;
    }
    await writePrivateJson(FILE, store);
    return NextResponse.json({ signatures: store });
  } catch (e) { return NextResponse.json({ error: formatSupabaseError(e) }, { status: 500 }); }
}
