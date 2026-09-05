import { NextResponse } from "next/server";
import {
  isGoogleDriveConfigured,
  listDriveDocuments,
} from "@/lib/googleDrive/server";

export async function GET() {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        items: [],
        message:
          "Google Drive chưa được cấu hình. Vui lòng thêm GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID.",
      },
      { status: 200 },
    );
  }

  try {
    const items = await listDriveDocuments();
    return NextResponse.json({ configured: true, items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định khi truy vấn Google Drive";
    return NextResponse.json({ configured: true, items: [], error: message }, { status: 500 });
  }
}
