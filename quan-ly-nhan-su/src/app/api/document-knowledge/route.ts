import { NextResponse } from "next/server";
import { isUuid } from "@/lib/documentKnowledge";
import {
  knowledgeAdmin,
  knowledgeResult,
  requireKnowledgeProject,
  scanKnowledgeDirectory,
  stageKnowledgeUpload,
} from "@/lib/server/documentKnowledgeStore";
import {
  canScanKnowledge,
  knowledgeEnabled,
  knowledgeErrorResponse,
  knowledgeSession,
  rejectCrossOrigin,
} from "@/lib/server/documentKnowledgeWeb";

export const runtime = "nodejs";
export const maxDuration = 300;
const positive = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
export async function GET(request: Request) {
  if (!knowledgeEnabled())
    return NextResponse.json({ enabled: false, projects: [] });
  try {
    const { client, user } = await knowledgeSession();
    const url = new URL(request.url);
    const document = url.searchParams.get("document");
    const offset = Number(url.searchParams.get("offset") || 0);
    if (!positive(offset)) throw new Error("DK_INVALID_QUERY");
    if (document) {
      if (!isUuid(document)) throw new Error("DK_INVALID_QUERY");
      return NextResponse.json(
        knowledgeResult(
          await client.rpc("dk_document_detail", {
            p_document: document,
            p_offset: offset,
          }),
        ),
      );
    }
    const project = url.searchParams.get("project");
    if (project) {
      await requireKnowledgeProject(client, project);
      const result = await client
        .from("dk_documents")
        .select(
          "id,name,source_key,revision,state,review_state,page_count,error_code,updated_at",
          { count: "exact" },
        )
        .eq("project_id", project)
        .neq("state", "removed")
        .order("updated_at", { ascending: false })
        .order("id")
        .range(offset, offset + 49);
      return NextResponse.json({
        documents: knowledgeResult(result),
        total: result.count ?? 0,
      });
    }
    const [projectResult, memberResult] = await Promise.all([
      client
        .from("dk_projects")
        .select("id,name,owner_id")
        .order("name")
        .range(offset, offset + 99),
      client
        .from("dk_members")
        .select("project_id,role")
        .eq("user_id", user.id),
    ]);
    const members = knowledgeResult(memberResult) || [];
    const projects = (knowledgeResult(projectResult) || []).map((p) => ({
      ...p,
      role: members.find((m) => m.project_id === p.id)?.role || "viewer",
    }));
    return NextResponse.json({
      enabled: true,
      currentUserId: user.id,
      canScan: canScanKnowledge(user),
      projects,
    });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    rejectCrossOrigin(request);
    const { client } = await knowledgeSession(true);
    if (Number(request.headers.get("content-length") || 0) > 55 * 1024 * 1024)
      throw new Error("DK_FILE_SIZE_LIMIT");
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const project = await requireKnowledgeProject(
        client,
        form.get("projectId"),
        true,
      );
      const file = form.get("file");
      if (
        !(file instanceof File) ||
        file.size <= 0 ||
        file.size > 50 * 1024 * 1024
      )
        throw new Error("DK_FILE_SIZE_LIMIT");
      return NextResponse.json(
        await stageKnowledgeUpload(
          project,
          file.name,
          Buffer.from(await file.arrayBuffer()),
          String(form.get("sourceKey") || file.name),
        ),
        { status: 202 },
      );
    }
    const body = await request.json();
    if (body?.action === "create_project") {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.length > 200
      )
        throw new Error("DK_INVALID_QUERY");
      return NextResponse.json(
        {
          id: knowledgeResult(
            await client.rpc("dk_create_project", { p_name: body.name.trim() }),
          ),
        },
        { status: 201 },
      );
    }
    const project = await requireKnowledgeProject(
      client,
      body?.projectId,
      true,
    );
    if (body.action === "scan") {
      const { user } = await knowledgeSession(true);
      if (!canScanKnowledge(user)) throw new Error("DK_FORBIDDEN");
      if (typeof body.folder !== "string") throw new Error("DK_INVALID_QUERY");
      return NextResponse.json(
        await scanKnowledgeDirectory(project, body.folder),
      );
    }
    if (body.action === "grant_member") {
      if (!["viewer", "editor"].includes(body.role))
        throw new Error("DK_INVALID_QUERY");
      const { user } = await knowledgeSession(true);
      const owner = knowledgeResult(
        await client
          .from("dk_projects")
          .select("owner_id")
          .eq("id", project)
          .single(),
      );
      if (!owner || owner.owner_id !== user.id) throw new Error("DK_FORBIDDEN");
      let target = body.userId;
      if (
        typeof body.email === "string" &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) &&
        body.email.length <= 254
      ) {
        const admin = knowledgeAdmin();
        target = undefined;
        for (let page = 1; page <= 100; page++) {
          const result = await admin.auth.admin.listUsers({
            page,
            perPage: 1000,
          });
          if (result.error) throw new Error("DK_DATABASE_ERROR");
          target = result.data.users.find(
            (u) => u.email?.toLowerCase() === body.email.trim().toLowerCase(),
          )?.id;
          if (target || result.data.users.length < 1000) break;
        }
      }
      if (!isUuid(target)) throw new Error("DK_USER_NOT_FOUND");
      knowledgeResult(
        await client.rpc("dk_grant_member", {
          p_project: project,
          p_user: target,
          p_role: body.role,
        }),
      );
    } else if (body.action === "review_fact") {
      if (
        !isUuid(body.factId) ||
        !positive(body.version) ||
        !["approved", "rejected"].includes(body.decision) ||
        typeof body.note !== "string"
      )
        throw new Error("DK_INVALID_QUERY");
      if (
        !knowledgeResult(
          await client
            .from("dk_facts")
            .select("id")
            .eq("id", body.factId)
            .eq("project_id", project)
            .maybeSingle(),
        )
      )
        throw new Error("DK_FORBIDDEN");
      knowledgeResult(
        await client.rpc("dk_review_fact", {
          p_id: body.factId,
          p_version: body.version,
          p_decision: body.decision,
          p_fields: body.fields || {},
          p_note: body.note,
        }),
      );
    } else if (body.action === "add_fact") {
      if (
        !isUuid(body.documentId) ||
        !positive(body.revision) ||
        !positive(body.page) ||
        typeof body.quote !== "string"
      )
        throw new Error("DK_INVALID_QUERY");
      if (
        !knowledgeResult(
          await client
            .from("dk_documents")
            .select("id")
            .eq("id", body.documentId)
            .eq("project_id", project)
            .maybeSingle(),
        )
      )
        throw new Error("DK_FORBIDDEN");
      knowledgeResult(
        await client.rpc("dk_add_fact", {
          p_document: body.documentId,
          p_revision: body.revision,
          p_page: body.page,
          p_quote: body.quote,
          p_kind: body.kind,
        }),
      );
    } else if (["verify", "retry", "remove"].includes(body.action)) {
      if (
        !isUuid(body.documentId) ||
        !positive(body.revision) ||
        typeof body.note !== "string"
      )
        throw new Error("DK_INVALID_QUERY");
      if (
        !knowledgeResult(
          await client
            .from("dk_documents")
            .select("id")
            .eq("id", body.documentId)
            .eq("project_id", project)
            .maybeSingle(),
        )
      )
        throw new Error("DK_FORBIDDEN");
      knowledgeResult(
        await client.rpc("dk_document_action", {
          p_id: body.documentId,
          p_revision: body.revision,
          p_action: body.action,
          p_note: body.note,
        }),
      );
    } else throw new Error("DK_INVALID_ACTION");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return knowledgeErrorResponse(error);
  }
}
