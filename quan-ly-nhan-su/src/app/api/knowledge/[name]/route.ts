import { NextResponse } from "next/server";
import { extname } from "node:path";
import { stat } from "node:fs/promises";
import {
  deleteKnowledgeFile,
  openKnowledgeFileStream,
  resolveKnowledgePath,
} from "@/lib/server/knowledgeFiles";
import { requireAccess } from "@/lib/server/requireAccess";

const TAB = "file-tri-thuc";

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

type Ctx = { params: Promise<{ name: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const denied = await requireAccess(TAB, "view");
  if (denied) return denied;

  try {
    const { name: raw } = await ctx.params;
    const decoded = decodeURIComponent(raw);
    const { path, name } = resolveKnowledgePath(decoded);
    const info = await stat(path);
    const { stream } = openKnowledgeFileStream(name);
    const type = CONTENT_TYPES[extname(name).toLowerCase()] || "application/octet-stream";
    return new NextResponse(stream, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không mở được tệp.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const denied = await requireAccess(TAB, "delete");
  if (denied) return denied;

  try {
    const { name: raw } = await ctx.params;
    await deleteKnowledgeFile(decodeURIComponent(raw));
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không xóa được tệp.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
