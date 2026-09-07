import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_DRIVE_CONFIGURATION_MESSAGE,
  isGoogleDriveConfigured,
  MAX_DRIVE_DOCUMENT_BYTES,
} from "@/lib/googleDrive/server";

const DRIVE_UPLOAD_HOSTS = new Set(["www.googleapis.com", "upload.googleapis.com"]);
const DRIVE_UPLOAD_PATH = /^\/upload\/drive\/v3\/files(?:\/[A-Za-z0-9_-]{10,200})?$/;

function validatedSessionUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !DRIVE_UPLOAD_HOSTS.has(url.hostname) ||
      !DRIVE_UPLOAD_PATH.test(url.pathname) ||
      url.searchParams.get("uploadType") !== "resumable" ||
      !url.searchParams.get("upload_id")
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Kiểm tra trạng thái ở phía máy chủ để tránh trình duyệt báo lỗi CORS sau khi
 * Google Drive đã nhận đủ nội dung và trả về metadata của file.
 */
export async function POST(req: NextRequest) {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json({ error: GOOGLE_DRIVE_CONFIGURATION_MESSAGE }, { status: 503 });
  }

  try {
    const body = await req.json();
    const uploadUrl = validatedSessionUrl(body.uploadUrl);
    const fileSize = Number(body.fileSize);
    if (
      !uploadUrl ||
      !Number.isSafeInteger(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_DRIVE_DOCUMENT_BYTES
    ) {
      return NextResponse.json({ error: "Phiên tải lên Google Drive không hợp lệ." }, { status: 400 });
    }

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": "0",
        "Content-Range": `bytes */${fileSize}`,
      },
      redirect: "manual",
      cache: "no-store",
    });

    if (response.status === 200 || response.status === 201) {
      const text = await response.text();
      const item = text ? JSON.parse(text) : undefined;
      return NextResponse.json({ complete: true, item });
    }
    if (response.status === 308) {
      return NextResponse.json({
        complete: false,
        receivedRange: response.headers.get("Range") || undefined,
      });
    }

    const detail = (await response.text()).slice(0, 1000);
    return NextResponse.json(
      { error: `Google Drive chưa xác nhận phiên tải lên (HTTP ${response.status}): ${detail}` },
      { status: 502 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không kiểm tra được phiên tải lên Google Drive.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
