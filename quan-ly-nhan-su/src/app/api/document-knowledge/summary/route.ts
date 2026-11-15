import { NextResponse } from "next/server";
import { KNOWLEDGE_METRICS, isIsoDate } from "@/lib/documentKnowledge";
import { knowledgeResult } from "@/lib/server/documentKnowledgeStore";
import {
  knowledgeProjectSession,
  knowledgeErrorResponse,
} from "@/lib/server/documentKnowledgeWeb";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { client, project } = await knowledgeProjectSession(
      url.searchParams.get("project"),
    );
    const metric = url.searchParams.get("metric") || "accepted_total";
    const contract=url.searchParams.get('contract');
    if(contract!==null&&(!contract.trim()||contract.length>200))throw new Error('DK_INVALID_QUERY');
    const date =
      url.searchParams.get("asOf") ||
      new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
    if (!Object.hasOwn(KNOWLEDGE_METRICS, metric) || !isIsoDate(date))
      throw new Error("DK_INVALID_QUERY");
    return NextResponse.json(
      knowledgeResult(
        await client.rpc("dk_financial_summary", {
          p_project: project,
          p_metric: metric,
          p_as_of: date,
          p_contract:contract,
        }),
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}
