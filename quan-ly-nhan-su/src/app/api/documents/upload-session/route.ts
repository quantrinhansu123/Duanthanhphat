import { NextResponse } from "next/server";
import { completeDocumentUpload, DocumentUploadError, isDocumentStorageConfigured, prepareDocumentUpload } from "@/lib/documentStorage";
import { requireAccess } from "@/lib/server/requireAccess";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await requireAccess("tai-lieu", "edit");
  if (denied) return denied;
  if (!isDocumentStorageConfigured()) {
    return NextResponse.json({ error: "Kho tài liệu chưa được thiết lập. Vui lòng liên hệ quản trị viên." }, { status: 503 });
  }
  try {
    const body = await request.json();
    if (body.action === "complete" && typeof body.ticket === "string") {
      const item = await completeDocumentUpload(body.ticket);
      return NextResponse.json({ item });
    }
    if (body.action !== "prepare" || body.mimeType !== "application/pdf" || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Vui lòng chọn tệp PDF hợp lệ." }, { status: 400 });
    }
    if (body.replaceId !== undefined && (typeof body.replaceId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.replaceId))) {
      return NextResponse.json({ error: "Mã tài liệu không hợp lệ." }, { status: 400 });
    }
    const appProperties: Record<string, string> = {};
    if (body.appProperties && typeof body.appProperties === "object") {
      for (const [key, value] of Object.entries(body.appProperties)) {
        if (typeof value === "string" && value.trim()) appProperties[key] = value.trim();
      }
    }
    const session = await prepareDocumentUpload({
      name: body.name.trim(),
      description: typeof body.description === "string" ? body.description : "",
      size: body.size,
      replaceId: body.replaceId,
      appProperties,
    });
    return NextResponse.json(session);
  } catch (error) {
    console.error("Không thể lưu tài liệu:", error);
    return NextResponse.json({
      error: error instanceof DocumentUploadError ? error.message : "Không thể lưu tài liệu. Vui lòng thử lại hoặc liên hệ quản trị viên.",
    }, { status: error instanceof DocumentUploadError ? 400 : 500 });
  }
}
