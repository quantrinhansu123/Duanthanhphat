import { NextResponse } from "next/server";
import {
  DOCUMENT_SETUP_MESSAGE,
  isDocumentStorageConfigured,
  listStoredDocuments,
} from "@/lib/documentStorage";

export async function GET() {
  if (!isDocumentStorageConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        items: [],
        message: "Chưa cấu hình Supabase. Thêm NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 200 },
    );
  }

  try {
    const items = await listStoredDocuments();
    return NextResponse.json({ configured: true, items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : DOCUMENT_SETUP_MESSAGE;
    return NextResponse.json({ configured: true, items: [], error: message }, { status: 500 });
  }
}
