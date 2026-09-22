import { NextResponse } from "next/server";
import {
  GOOGLE_DRIVE_CONFIGURATION_MESSAGE,
  formatGoogleDriveError,
  isGoogleDriveConfigured,
  listDriveDocuments,
} from "@/lib/googleDrive/server";

export async function GET() {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        items: [],
        message: GOOGLE_DRIVE_CONFIGURATION_MESSAGE,
      },
      { status: 200 },
    );
  }

  try {
    const items = await listDriveDocuments();
    return NextResponse.json({ configured: true, items });
  } catch (error: unknown) {
    return NextResponse.json(
      { configured: true, items: [], error: formatGoogleDriveError(error) },
      { status: 500 },
    );
  }
}
