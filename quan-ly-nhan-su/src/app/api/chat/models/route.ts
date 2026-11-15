import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/server/requireAccess";
import { getChatModels } from "@/lib/server/chatModels";

export async function GET() {
  const denied = await requireAccess(null);
  if (denied) return denied;
  return NextResponse.json(await getChatModels());
}
