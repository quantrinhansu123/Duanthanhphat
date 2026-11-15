import { NextResponse } from "next/server";
import {
  KNOWLEDGE_MAX_BYTES,
  knowledgeRootDir,
  listKnowledgeFiles,
  saveKnowledgeFile,
} from "@/lib/server/knowledgeFiles";
import { requireAccess } from "@/lib/server/requireAccess";

const TAB = "file-tri-thuc";

export async function GET() {
  const denied = await requireAccess(TAB, "view");
  if (denied) return denied;
  try {
    const items = await listKnowledgeFiles();
    return NextResponse.json({ items, root: knowledgeRootDir() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không đọc được thư mục Tri thức.";
    return NextResponse.json({ items: [], error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireAccess(TAB, "edit");
  if (denied) return denied;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Vui lòng chọn tệp để tải lên." }, { status: 400 });
  }
  if (file.size > KNOWLEDGE_MAX_BYTES) {
    return NextResponse.json({ error: "Tệp quá lớn (tối đa 50 MB)." }, { status: 413 });
  }

  try {
    const item = await saveKnowledgeFile(file);
    return NextResponse.json({ item });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Tải lên thất bại.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
