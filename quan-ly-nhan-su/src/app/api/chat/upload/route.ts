import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireAccess, requireAuthenticatedUser } from "@/lib/server/requireAccess";
import { randomUUID } from 'node:crypto';
import { isUuid } from '@/lib/documentKnowledge';

const UPLOAD_ROOT = join(process.cwd(), ".codex-chat", "uploads");
const MAX_BYTES = 25 * 1024 * 1024;

/** Nhận tệp đính kèm trong chatbot, lưu cục bộ để CLI đọc. */
export async function POST(request: Request) {
  const denied = await requireAccess(null);
  if (denied) return denied;
  const { user } = await requireAuthenticatedUser();
  if (!user || !isUuid(user.id)) return NextResponse.json({ error: 'Cần đăng nhập để tải tệp.' }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const provider = form?.get("provider") || process.env.CHAT_PROVIDER;
  if (provider !== "codex" && provider !== "anti") return NextResponse.json({ error: "Đính kèm tệp chỉ dùng được với Codex hoặc Anti CLI." }, { status: 400 });
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Không nhận được tệp." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Tệp quá lớn (tối đa 25 MB)." }, { status: 413 });

  const sid = String(form?.get("sessionId") ?? "").replace(/[^\w-]/g, "").slice(0, 64) || "no-session";
  const safe = file.name.replace(/[^\w.\-() ]+/g, "_").slice(-120) || "tep";
  const dir = join(UPLOAD_ROOT, user.id, sid);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${randomUUID()}-${safe}`);
  await writeFile(path, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ name: file.name, path, image: /^image\/(png|jpe?g|gif|webp)$/.test(file.type) });
}
