import { NextRequest, NextResponse } from "next/server";
import {
  createResumableUploadSession,
  DRIVE_PDF_MIME_TYPE,
  GOOGLE_DRIVE_CONFIGURATION_MESSAGE,
  isGoogleDriveConfigured,
  MAX_DRIVE_DOCUMENT_BYTES,
} from "@/lib/googleDrive/server";

export async function POST(req: NextRequest) {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { error: GOOGLE_DRIVE_CONFIGURATION_MESSAGE },
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

    const uploadParams: {
      name: string;
      mimeType: string;
      description: string;
      fileSize: number;
      appProperties?: Record<string, string>;
    } = {
      name,
      mimeType,
      description,
      fileSize,
    };

    if (body.appProperties && typeof body.appProperties === "object") {
      const allowedKeys = ["entityType", "employeeId", "weldingId", "documentType", "source", "category"];
      const props: Record<string, string> = {};
      for (const key of allowedKeys) {
        if (typeof body.appProperties[key] === "string" && body.appProperties[key].trim()) {
          props[key] = body.appProperties[key].trim();
        }
      }
      if (Object.keys(props).length > 0) {
        uploadParams.appProperties = props;
      }
    }

    const uploadUrl = await createResumableUploadSession(uploadParams);

    return NextResponse.json({ uploadUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi khởi tạo upload Google Drive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
