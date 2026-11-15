import { NextResponse } from "next/server";
import { extname } from "node:path";
import { stat } from "node:fs/promises";
import { openKnowledgeAccessStream,resolveKnowledgeAccessPath } from "@/lib/server/knowledgeFiles";
import { requireAccess } from "@/lib/server/requireAccess";
import { legacyKnowledgePathDenied } from '@/lib/server/documentKnowledgeWeb';

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json",
  ".zip": "application/zip",
};

/** Tải tệp trong thư mục Tri thức (kể cả thư mục con) — dùng từ chat / File tri thức. */
export async function GET(request: Request) {
  // Chat cũng cần tải → chỉ yêu cầu đăng nhập.
  const denied = await requireAccess(null);
  if (denied) return denied;

  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "";
  if (!path.trim()) {
    return NextResponse.json({ error: "Thiếu đường dẫn tệp." }, { status: 400 });
  }

  try {
    const blocked=await legacyKnowledgePathDenied(resolveKnowledgeAccessPath(path).path);
    if(blocked)return blocked;
    const { stream, name, path: full } = openKnowledgeAccessStream(path);
    const info = await stat(full);
    const type = CONTENT_TYPES[extname(name).toLowerCase()] || "application/octet-stream";
    return new NextResponse(stream, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không tải được tệp.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
