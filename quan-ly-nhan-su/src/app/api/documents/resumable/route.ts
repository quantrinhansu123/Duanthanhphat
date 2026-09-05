import { NextRequest, NextResponse } from "next/server";
import {
  createResumableUploadSession,
  DRIVE_PDF_MIME_TYPE,
  isGoogleDriveConfigured,
  MAX_DRIVE_DOCUMENT_BYTES,
} from "@/lib/googleDrive/server";

export async function POST(req: NextRequest) {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { error: "Google Drive chưa được cấu hình các biến môi trường cần thiết." },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
    const description = typeof body.description === "string" ? body.description : "";
    const fileSize = Number(body.fileSize);

    if (!name.trim() || mimeType !== DRIVE_PDF_MIME_TYPE || !Number.isSafeInteger(fileSize) || fileSize <= 0) {
      return NextResponse.json(
        { error: "Chỉ chấp nhận file PDF hợp lệ có dung lượng lớn hơn 0." },
        { status: 400 },
      );
    }
    if (fileSize > MAX_DRIVE_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "Dung lượng PDF không được vượt quá 250 MB." }, { status: 413 });
    }

    const uploadUrl = await createResumableUploadSession({
      name,
      mimeType,
      description,
      fileSize,
    });

    return NextResponse.json({ uploadUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi khởi tạo upload Google Drive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
