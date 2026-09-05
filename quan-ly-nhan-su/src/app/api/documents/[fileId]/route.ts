import { NextRequest, NextResponse } from "next/server";
import {
  isValidDriveFileId,
  isGoogleDriveConfigured,
  trashDriveDocument,
  updateDriveDocument,
} from "@/lib/googleDrive/server";

type RouteParams = {
  params: Promise<{ fileId: string }>;
};

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { error: "Google Drive chưa được cấu hình." },
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
      { error: "Google Drive chưa được cấu hình." },
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
