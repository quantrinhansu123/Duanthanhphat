import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export class QualityApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function requireWeldQualityAuth(request: Request, allowForm = false): string {
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
  guardWrite(request, allowForm);
  return user;
}

function guardWrite(request: Request, allowForm = false) {
  if (request.method === "GET") return;
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new QualityApiError("Không chấp nhận yêu cầu từ website khác.", 403);
  }
  const type = request.headers.get("content-type") ?? "";
  // Tải file (multipart) chỉ cho đường dẫn tải scan; vẫn chặn yêu cầu từ website khác ở trên.
  if (!type.startsWith("application/json") && !(allowForm && type.startsWith("multipart/form-data"))) throw new QualityApiError("Yêu cầu phải là JSON.", 415);
}

// Kết quả xác thực theo token được nhớ 60 giây: trang Biên bản mối hàn gọi API hàng chục lần,
// mỗi lần xác thực lại tốn 2–3 vòng truy vấn Supabase. Thu hồi quyền có hiệu lực chậm nhất sau 60 giây.
const AUTH_CACHE_MS = 60_000;
const authCache = new Map<string, { email: string; until: number }>();

/** Đăng nhập Supabase Auth (token trong header riêng) + danh sách email được phép; không có token thì dùng Basic Auth nếu đã cấu hình. */
export async function authenticateWeldQuality(request: Request, allowForm = false): Promise<string> {
  let token = request.headers.get("x-supabase-token");
  if (!token) {
    // Dùng luôn phiên đăng nhập của ứng dụng (cookie), không bắt đăng nhập lần nữa.
    try {
      const { data } = await (await createServerClient()).auth.getSession();
      token = data.session?.access_token ?? null;
    } catch { /* không có phiên cookie */ }
  }
  if (!token) {
    if (process.env.APP_BASIC_AUTH_USER?.trim() && process.env.APP_BASIC_AUTH_PASSWORD) return requireWeldQualityAuth(request, allowForm);
    throw new QualityApiError("Phiên đăng nhập hết hạn; hãy tải lại trang và đăng nhập lại.", 401);
  }
  guardWrite(request, allowForm);
  const cached = authCache.get(token);
  if (cached && cached.until > Date.now()) return cached.email;
  const db = createAdminClient();
  const { data, error } = await db.auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) throw new QualityApiError("Phiên đăng nhập hết hạn; hãy đăng nhập lại.", 401);
  const allowed = await db.from("nguoi_dung_nghiem_thu").select("email").eq("email", email).maybeSingle();
  if (allowed.error) throw allowed.error;
  if (!allowed.data && !(await hasJournalEditRole(db, email))) throw new QualityApiError("Tài khoản này chưa được phép ghi nhận chất lượng.", 403);
  if (authCache.size > 200) authCache.clear();
  authCache.set(token, { email, until: Date.now() + AUTH_CACHE_MS });
  return email;
}

/** Role được tick "Sửa" ở Nhật ký hàn (Cấu hình → Phân quyền) cũng được ghi nhận chất lượng. */
async function hasJournalEditRole(db: ReturnType<typeof createAdminClient>, email: string) {
  const acc = await db.from("tai_khoan_phan_quyen").select("role,status").ilike("email", email).maybeSingle();
  if (acc.error) throw acc.error;
  if (!acc.data || acc.data.status === "Khóa") return false;
  const perm = await db.from("phan_quyen").select("role").eq("role", acc.data.role).eq("tab_id", "nhat-ky-han").eq("can_edit", true).maybeSingle();
  if (perm.error) throw perm.error;
  return !!perm.data;
}
