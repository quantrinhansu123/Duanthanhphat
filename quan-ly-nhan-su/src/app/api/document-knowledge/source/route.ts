import { isUuid } from "@/lib/documentKnowledge";
import {
  knowledgeResult,
  requireKnowledgeProject,
  readKnowledgeSource,
} from "@/lib/server/documentKnowledgeStore";
import {
  knowledgeErrorResponse,
  knowledgeSession,
} from "@/lib/server/documentKnowledgeWeb";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { client } = await knowledgeSession();
    const url = new URL(request.url),
      id = url.searchParams.get("id");
    if (!isUuid(id)) throw new Error("DK_INVALID_QUERY");
    const document = knowledgeResult(
      await client
        .from("dk_documents")
        .select("*")
        .eq("id", id)
        .neq("state", "removed")
        .maybeSingle(),
    );
    if (!document) throw new Error("DK_FORBIDDEN");
    await requireKnowledgeProject(client, document.project_id);
    if (
      url.searchParams.has("revision") &&
      String(document.revision) !== url.searchParams.get("revision")
    )
      throw new Error("DK_STALE_DOCUMENT");
    const bytes = await readKnowledgeSource(document);
    const inline = /\.pdf$/i.test(document.name);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": inline ? "application/pdf" : "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(document.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}
