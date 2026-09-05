import { NextRequest, NextResponse } from "next/server";

const PROTECTED_SERVICE_PATHS = ["/api/documents", "/api/cloudinary"];

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

export function proxy(request: NextRequest) {
  const expectedUser = process.env.APP_BASIC_AUTH_USER?.trim();
  const expectedPassword = process.env.APP_BASIC_AUTH_PASSWORD;
  const isProtectedService = PROTECTED_SERVICE_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!expectedUser || !expectedPassword) {
    if (isProtectedService) {
      return NextResponse.json(
        { error: "API lưu trữ đang bị khóa vì chưa cấu hình APP_BASIC_AUTH_USER và APP_BASIC_AUTH_PASSWORD." },
        { status: 503 },
      );
    }
    return NextResponse.next();
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
