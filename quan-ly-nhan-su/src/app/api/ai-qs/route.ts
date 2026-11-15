import { NextResponse } from "next/server";
import { listAiQsTree } from "@/lib/server/aiQsFiles";
import { requireAccess } from "@/lib/server/requireAccess";

const TAB = "hoso-ai-qs";

export async function GET() {
  const denied = await requireAccess(TAB, "view");
  if (denied) return denied;
  try {
    const data = await listAiQsTree();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không đọc được thư mục hồ sơ AI_QS.";
    return NextResponse.json({ tree: [], error: message }, { status: 500 });
  }
}
