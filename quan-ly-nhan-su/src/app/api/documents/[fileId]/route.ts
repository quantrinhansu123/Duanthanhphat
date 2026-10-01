import { NextRequest, NextResponse } from "next/server";
import { isValidDriveFileId } from "@/lib/googleDrive/server";
import {
  deleteStoredDocument,
  getStoredDocumentBuffer,
  isDocumentStorageConfigured,
  updateStoredDocument,
} from "@/lib/documentStorage";

type RouteParams = {
  params: Promise<{ fileId: string }>;
};

function notConfigured() {
  return NextResponse.json(
    { error: "Chưa cấu hình Supabase để lưu tài liệu." },
    { status: 503 },
  );
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  if (!isDocumentStorageConfigured()) return notConfigured();

  try {
    const { fileId } = await params;
    if (!isValidDriveFileId(fileId)) {
      return NextResponse.json({ error: "Mã tài liệu không hợp lệ." }, { status: 400 });
    }
    const wantDownload = req.nextUrl.searchParams.get("download") === "1";
    const { name, mimeType, buffer } = await getStoredDocumentBuffer(fileId);
    const safeName = name.replace(/[^\w.\- ()]+/g, "_");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType || "application/pdf",
        "Cache-Control": "private, max-age=60",
        "Content-Length": String(buffer.byteLength),
        "Content-Disposition": `${wantDownload ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không xem được tài liệu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!isDocumentStorageConfigured()) return notConfigured();

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
    const item = await updateStoredDocument(fileId, { name, description });
    return NextResponse.json({ item });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không cập nhật được tài liệu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  if (!isDocumentStorageConfigured()) return notConfigured();

  try {
    const { fileId } = await params;
    if (!isValidDriveFileId(fileId)) {
      return NextResponse.json({ error: "Mã tài liệu không hợp lệ." }, { status: 400 });
    }
    await deleteStoredDocument(fileId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không xóa được tài liệu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
