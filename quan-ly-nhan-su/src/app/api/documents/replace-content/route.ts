import { NextRequest, NextResponse } from "next/server";
import {
  createResumableUpdateSession,
  isValidDriveFileId,
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
    const fileId = typeof body.fileId === "string" ? body.fileId.trim() : "";
    const name = typeof body.name === "string" ? body.name : undefined;
    const description = typeof body.description === "string" ? body.description : undefined;
    const fileSize = Number(body.fileSize);

    if (!isValidDriveFileId(fileId)) {
      return NextResponse.json({ error: "Mã tài liệu không hợp lệ." }, { status: 400 });
    }

    if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
      return NextResponse.json(
        { error: "Chỉ chấp nhận file PDF hợp lệ có dung lượng lớn hơn 0." },
        { status: 400 },
      );
    }
    if (fileSize > MAX_DRIVE_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "Dung lượng PDF không được vượt quá 250 MB." }, { status: 413 });
    }

    const appProperties: Record<string, string> = {
      last_replaced_at: new Date().toISOString(),
      updated_via: "web_ui_replace",
    };

    const uploadUrl = await createResumableUpdateSession(fileId, {
      name,
      description,
      fileSize,
      appProperties,
    });

    return NextResponse.json({ uploadUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi khởi tạo thay đổi nội dung file Drive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
