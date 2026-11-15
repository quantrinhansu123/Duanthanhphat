import { NextResponse } from "next/server";
import { isUuid } from "@/lib/documentKnowledge";
import { knowledgeResult } from "@/lib/server/documentKnowledgeStore";
import {
  knowledgeSession,
  knowledgeErrorResponse,
} from "@/lib/server/documentKnowledgeWeb";

export async function GET(request: Request) {
  try {
    const { client } = await knowledgeSession();
    const url = new URL(request.url),
      id = url.searchParams.get("id"),
      page = Number(url.searchParams.get("page")),
      offset = Number(url.searchParams.get("offset") || 0);
    if (
      !isUuid(id) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    )
      throw new Error("DK_INVALID_QUERY");
    const document = knowledgeResult(
      await client
        .from("dk_documents")
        .select("id,name,revision")
        .eq("id", id)
        .neq("state", "removed")
        .maybeSingle(),
    );
    if (!document) throw new Error("DK_FORBIDDEN");
    const result = knowledgeResult(
      await client
        .from("dk_pages")
        .select("text,method,ocr_meta")
        .eq("document_id", id)
        .eq("revision", document.revision)
        .eq("page", page)
        .maybeSingle(),
    );
    if (!result) throw new Error("DK_EVIDENCE_NOT_FOUND");
    return NextResponse.json({
      ...document,
      page,
      text: result.text.slice(offset, offset + 10000),
      method: result.method,
      ocr: result.ocr_meta,
      nextOffset: offset + 10000 < result.text.length ? offset + 10000 : null,
    });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}
