import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, extname, isAbsolute, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { resolveAiQsRoot } from "@/lib/server/aiQsFiles";
import { requireAccess } from "@/lib/server/requireAccess";
import { legacyKnowledgeRestricted } from '@/lib/server/documentKnowledgeWeb';

const TAB = "hoso-ai-qs";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".zip": "application/zip",
};

export async function GET(request: Request) {
  const denied = await requireAccess(TAB, "view");
  if (denied) return denied;
  if(await legacyKnowledgeRestricted()) return NextResponse.json({error:'Chọn tài liệu trong kho hồ sơ được chia sẻ để xem bản gốc.'},{status:403});

  const url = new URL(request.url);
  const path = (url.searchParams.get("path") || "").trim();
  const inline = url.searchParams.get("inline") === "1" || url.searchParams.get("view") === "1";
  if (!path) return NextResponse.json({ error: "Thiếu đường dẫn tệp." }, { status: 400 });

  try {
    const { root } = await resolveAiQsRoot();
    const full = isAbsolute(path) || /^[a-zA-Z]:[\\/]/.test(path) ? resolve(path) : resolve(root, path);
    const rel = relative(root, full);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
      return NextResponse.json({ error: "Tệp ngoài phạm vi hồ sơ AI_QS." }, { status: 403 });
    }
    const info = await stat(full);
    if (!info.isFile()) return NextResponse.json({ error: "Không phải tệp." }, { status: 400 });
    const name = basename(full);
    const type = CONTENT_TYPES[extname(name).toLowerCase()] || "application/octet-stream";
    const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
    const disposition = inline ? "inline" : "attachment";
    return new NextResponse(stream, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không tải được tệp.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
