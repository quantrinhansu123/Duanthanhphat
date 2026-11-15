import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAccess, requireAuthenticatedUser } from "./requireAccess";
import { isUuid } from "../documentKnowledge";
import { requireKnowledgeProject } from "./documentKnowledgeStore";

export const knowledgeEnabled = () =>
  process.env.DOCUMENT_KNOWLEDGE_ENABLED === "true";
export function isLegacyChatAdmin(user: { id: string; email?: string }) {
  const allowed = (process.env.CHAT_LEGACY_ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return (
    allowed.includes(user.id.toLowerCase()) ||
    Boolean(user.email && allowed.includes(user.email.toLowerCase()))
  );
}
export async function legacyKnowledgeRestricted() {
  if (!knowledgeEnabled()) return false;
  const { denied, user } = await requireAuthenticatedUser();
  return Boolean(
    denied || !user || !isUuid(user.id) || !isLegacyChatAdmin(user),
  );
}
// Old file URLs must not bypass project membership for the imported AI_QS source tree.
export async function legacyKnowledgePathDenied(path: string) {
  if (!knowledgeEnabled()) return null;
  const { resolveAiQsRoot } = await import("./aiQsFiles");
  const { realpath } = await import("node:fs/promises");
  const { relative, isAbsolute, sep } = await import("node:path");
  const { root } = await resolveAiQsRoot();
  let source: string;
  try {
    source = await realpath(root);
  } catch {
    return null;
  }
  const rel = relative(source, await realpath(path));
  if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel))
    return null;
  return (await legacyKnowledgeRestricted())
    ? knowledgeErrorResponse(new Error("DK_FORBIDDEN"))
    : null;
}
export async function knowledgeSession(write = false) {
  if (!knowledgeEnabled()) throw new Error("DK_DISABLED");
  const { denied, user } = await requireAuthenticatedUser();
  if (denied || !user || !isUuid(user.id)) throw new Error("DK_UNAUTHORIZED");
  if (await requireAccess("hoso-ai-qs", write ? "edit" : "view"))
    throw new Error("DK_FORBIDDEN");
  return { user, client: await createClient() };
}
export async function knowledgeProjectSession(project: unknown, write = false) {
  const session = await knowledgeSession(write);
  return {
    ...session,
    project: await requireKnowledgeProject(session.client, project, write),
  };
}
export function rejectCrossOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new Error("DK_FORBIDDEN");
}
export function canScanKnowledge(user: { id: string; email?: string }) {
  const allowed = (process.env.KNOWLEDGE_LOCAL_SCAN_USERS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    allowed.includes(user.id.toLowerCase()) ||
    Boolean(user.email && allowed.includes(user.email.toLowerCase()))
  );
}
export function knowledgeErrorResponse(error: unknown) {
  const code =
    error instanceof Error && /^DK_[A-Z_0-9]+$/.test(error.message)
      ? error.message
      : "DK_REQUEST_FAILED";
  const messages: Record<string, string> = {
    DK_DISABLED: "Kho hồ sơ chưa được bật trên máy chủ.",
    DK_UNAUTHORIZED: "Cần đăng nhập để dùng kho hồ sơ.",
    DK_FORBIDDEN: "Bạn không có quyền truy cập hồ sơ này.",
    DK_DATABASE_NOT_CONFIGURED: "Kho hồ sơ chưa được cấu hình.",
    DK_DATABASE_ERROR:
      "Kho hồ sơ chưa sẵn sàng. Vui lòng liên hệ quản trị viên.",
    DK_INVALID_PROJECT: "Chọn một kho hồ sơ hợp lệ.",
    DK_DUPLICATE_EVENT:
      "Dữ kiện trùng với một khoản đã duyệt. Kiểm tra mã giao dịch, hợp đồng hoặc đợt nghiệm thu.",
    DK_STALE_DOCUMENT: "Tài liệu đã đổi phiên bản. Tải lại trước khi tiếp tục.",
    DK_REVIEW_CONFLICT:
      "Người khác đã cập nhật dữ kiện này. Tải lại để kiểm tra.",
    DK_REVIEW_INCOMPLETE:
      "Còn dữ kiện chưa kiểm tra hoặc tài liệu chưa xử lý xong.",
    DK_REVIEW_NOTE_REQUIRED: "Cần ghi căn cứ hoặc lý do xác nhận.",
    DK_EVIDENCE_NOT_FOUND: "Đoạn dẫn không có trên trang đã chọn.",
    DK_INVALID_FACT:
      "Kiểm tra số hợp đồng, mã nghiệp vụ, tiền, ngày và số đợt.",
    DK_INVALID_AMOUNT: "Số tiền phải là số nguyên đồng, tối đa 24 chữ số.",
    DK_FILE_SIZE_LIMIT: "Tệp phải có dữ liệu và không quá 50 MB.",
    DK_SOURCE_ROOT_NOT_CONFIGURED: "Máy chủ chưa thiết lập thư mục nhập hồ sơ.",
    DK_SOURCE_CHANGED:
      "Tệp gốc đã thay đổi. Quét lại thư mục để cập nhật phiên bản.",
    DK_GEMINI_NOT_CONFIGURED: "Chưa cấu hình dịch vụ xử lý và tìm kiếm hồ sơ.",
    DK_CODEX_UNAVAILABLE:
      "Không kết nối được Codex. Kiểm tra đăng nhập trên máy chủ.",
    DK_CODEX_BINARY_REQUIRED:
      "Máy chủ chưa thiết lập chương trình Codex để tra cứu hồ sơ.",
    DK_USER_NOT_FOUND: "Không tìm thấy tài khoản đã đăng ký với thông tin này.",
    DK_INVALID_ACTION: "Thao tác không hợp lệ.",
    DK_INVALID_QUERY: "Nội dung tra cứu không hợp lệ.",
    DK_REQUEST_FAILED: "Không xử lý được yêu cầu. Tải lại và thử lại.",
  };
  const status =
    code === "DK_UNAUTHORIZED"
      ? 401
      : code === "DK_FORBIDDEN"
        ? 403
        : [
              "DK_STALE_DOCUMENT",
              "DK_REVIEW_CONFLICT",
              "DK_DUPLICATE_EVENT",
            ].includes(code)
          ? 409
          : [
                "DK_DISABLED",
                "DK_DATABASE_ERROR",
                "DK_DATABASE_NOT_CONFIGURED",
                "DK_GEMINI_NOT_CONFIGURED",
                "DK_CODEX_UNAVAILABLE",
                "DK_CODEX_BINARY_REQUIRED",
              ].includes(code)
            ? 503
            : code === "DK_CODEX_TIMEOUT"
              ? 504
              : 400;
  return NextResponse.json(
    {
      error:
        messages[code] ||
        "Không xử lý được hồ sơ. Kiểm tra trạng thái và thử lại.",
      code,
    },
    { status },
  );
}
