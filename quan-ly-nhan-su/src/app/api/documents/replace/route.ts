import { NextRequest, NextResponse } from "next/server";
import { isValidDriveFileId } from "@/lib/googleDrive/server";
import {
  isDocumentStorageConfigured,
  MAX_DOCUMENT_BYTES,
  replaceStoredDocumentContent,
} from "@/lib/documentStorage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isDocumentStorageConfigured()) {
    return NextResponse.json({ error: "Chưa cấu hình Supabase để lưu tài liệu." }, { status: 503 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const fileId = String(form.get("fileId") || "").trim();
    const name = String(form.get("name") || "");
    const description = form.get("description");
    if (!isValidDriveFileId(fileId)) {
      return NextResponse.json({ error: "Mã tài liệu không hợp lệ." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "Dung lượng PDF phải lớn hơn 0 và không vượt quá 50 MB." }, { status: 413 });
    }
    await replaceStoredDocumentContent(fileId, Buffer.from(await file.arrayBuffer()), {
      name: name || undefined,
      description: typeof description === "string" ? description : undefined,
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không thay được file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
