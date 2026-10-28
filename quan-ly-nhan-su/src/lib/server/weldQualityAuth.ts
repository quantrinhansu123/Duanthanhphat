import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export class QualityApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function requireWeldQualityAuth(request: Request): string {
  const user = process.env.APP_BASIC_AUTH_USER?.trim();
  const password = process.env.APP_BASIC_AUTH_PASSWORD;
  if (!user || !password) throw new QualityApiError("Chức năng kiểm tra chất lượng chưa được cấu hình đăng nhập. Vui lòng liên hệ quản trị để kích hoạt.", 503);
  const auth = request.headers.get("authorization") ?? "";
  const hash = (value: string) => createHash("sha256").update(value).digest();
  let credentials = "";
  if (auth.startsWith("Basic ")) credentials = Buffer.from(auth.slice(6), "base64").toString("utf8");
  if (!timingSafeEqual(hash(credentials), hash(`${user}:${password}`))) {
    throw new QualityApiError("Cần đăng nhập để kiểm tra chất lượng.", 401);
  }
  guardWrite(request);
  return user;
}

function guardWrite(request: Request) {
  if (request.method === "GET") return;
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new QualityApiError("Không chấp nhận yêu cầu từ website khác.", 403);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new QualityApiError("Yêu cầu phải là JSON.", 415);
}

/** Đăng nhập Supabase Auth (token trong header riêng) + danh sách email được phép; không có token thì dùng Basic Auth nếu đã cấu hình. */
export async function authenticateWeldQuality(request: Request): Promise<string> {
  const token = request.headers.get("x-supabase-token");
  if (!token) {
    if (process.env.APP_BASIC_AUTH_USER?.trim() && process.env.APP_BASIC_AUTH_PASSWORD) return requireWeldQualityAuth(request);
    throw new QualityApiError("Cần đăng nhập để kiểm tra chất lượng.", 401);
  }
  guardWrite(request);
  const db = createAdminClient();
  const { data, error } = await db.auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) throw new QualityApiError("Phiên đăng nhập hết hạn; hãy đăng nhập lại.", 401);
  const allowed = await db.from("nguoi_dung_nghiem_thu").select("email").eq("email", email).maybeSingle();
  if (allowed.error) throw allowed.error;
  if (!allowed.data) throw new QualityApiError("Tài khoản này chưa được phép ghi nhận chất lượng.", 403);
  return email;
}
