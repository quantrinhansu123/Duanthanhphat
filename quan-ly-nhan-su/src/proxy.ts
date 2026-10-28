import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function unauthorized(request: NextRequest) {
  const headers = { "WWW-Authenticate": 'Basic realm="Thanh Phat", charset="UTF-8"' };
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Cần đăng nhập để sử dụng chức năng này." }, { status: 401, headers });
  }
  return new NextResponse("Cần đăng nhập.", { status: 401, headers });
}

/** Khóa giao diện: chưa đăng nhập Supabase thì chuyển về /login. API và file tĩnh tự kiểm soát riêng. */
async function requireLogin(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || pathname.startsWith("/api/") || pathname === "/login" || /\.[a-z0-9]+$/i.test(pathname)) {
    return NextResponse.next();
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user) return response;
  } catch {
    // Không xác minh được phiên → coi như chưa đăng nhập.
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export async function proxy(request: NextRequest) {
  const expectedUser = process.env.APP_BASIC_AUTH_USER?.trim();
  const expectedPassword = process.env.APP_BASIC_AUTH_PASSWORD;

  // Basic Auth là tùy chọn: chưa cấu hình thì cho qua (kể cả API Drive/Cloudinary).
  // Khi đã cấu hình thì bắt buộc đăng nhập cho toàn app, gồm API lưu trữ.
  if (!expectedUser || !expectedPassword) {
    return requireLogin(request);
  }

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Basic ")) return unauthorized(request);

  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return unauthorized(request);
    const user = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    if (!constantTimeEqual(user, expectedUser) || !constantTimeEqual(password, expectedPassword)) {
      return unauthorized(request);
    }
  } catch {
    return unauthorized(request);
  }

  return requireLogin(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
