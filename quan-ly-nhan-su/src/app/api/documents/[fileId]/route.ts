import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_DRIVE_CONFIGURATION_MESSAGE,
  getDriveDocumentBuffer,
  isValidDriveFileId,
  isGoogleDriveConfigured,
  trashDriveDocument,
  updateDriveDocument,
} from "@/lib/googleDrive/server";

type RouteParams = {
  params: Promise<{ fileId: string }>;
};

/** Xem / tải PDF qua proxy server (iframe + nút Tải về). ?download=1 để tải về. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { error: GOOGLE_DRIVE_CONFIGURATION_MESSAGE },
      { status: 503 },
    );
  }

  try {
    const { fileId } = await params;
    if (!isValidDriveFileId(fileId)) {
      return NextResponse.json({ error: "Mã tài liệu không hợp lệ." }, { status: 400 });
    }

    const wantDownload = req.nextUrl.searchParams.get("download") === "1";
    const { name, mimeType, buffer } = await getDriveDocumentBuffer(fileId);
    const safeName = name.replace(/[^\w.\- ()]+/g, "_");

    const headers = new Headers({
      "Content-Type": mimeType || "application/pdf",
      "Cache-Control": "private, max-age=60",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `${wantDownload ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    });

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không đọc được tài liệu từ Google Drive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { error: GOOGLE_DRIVE_CONFIGURATION_MESSAGE },
      { status: 503 },
    );
  }

  try {
    const { fileId } = await params;
    if (!isValidDriveFileId(fileId)) {
      return NextResponse.json({ error: "Mã tài liệu không hợp lệ." }, { status: 400 });
    }
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name : undefined;
    const description = typeof body.description === "string" ? body.description : undefined;
    if (name === undefined && description === undefined) {
      return NextResponse.json({ error: "Không có nội dung cần cập nhật." }, { status: 400 });
    }
    const updated = await updateDriveDocument(fileId, {
      name,
      description,
    });
    return NextResponse.json({ item: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi cập nhật tài liệu";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { error: GOOGLE_DRIVE_CONFIGURATION_MESSAGE },
      { status: 503 },
    );
  }

  try {
    const { fileId } = await params;
    if (!isValidDriveFileId(fileId)) {
      return NextResponse.json({ error: "Mã tài liệu không hợp lệ." }, { status: 400 });
    }
    await trashDriveDocument(fileId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi chuyển tài liệu vào thùng rác";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
