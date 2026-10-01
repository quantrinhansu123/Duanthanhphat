import { NextRequest, NextResponse } from "next/server";
import {
  isDocumentStorageConfigured,
  MAX_DOCUMENT_BYTES,
  uploadStoredDocument,
} from "@/lib/documentStorage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isDocumentStorageConfigured()) {
    return NextResponse.json({ error: "Chưa cấu hình Supabase để lưu tài liệu." }, { status: 503 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const name = String(form.get("name") || "");
    const description = String(form.get("description") || "");
    const rawProps = String(form.get("appProperties") || "");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu file PDF." }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "Dung lượng PDF phải lớn hơn 0 và không vượt quá 50 MB." }, { status: 413 });
    }
    if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Chỉ hỗ trợ tài liệu PDF." }, { status: 400 });
    }
    let appProperties: Record<string, string> | undefined;
    if (rawProps) {
      const parsed = JSON.parse(rawProps) as Record<string, unknown>;
      appProperties = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string" && value.trim()) appProperties[key] = value.trim();
      }
    }
    const item = await uploadStoredDocument({
      bytes: Buffer.from(await file.arrayBuffer()),
      name: name.trim() || file.name,
      description,
      appProperties,
    });
    return NextResponse.json({ item });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không tải được tài liệu lên bucket.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
