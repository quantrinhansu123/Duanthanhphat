import { NextResponse } from "next/server";
import { initialAccounts, normalizePhone, type StoredSystemConfiguration } from "@/data/systemConfig";
import { readPrivateJson } from "@/lib/server/privateJsonStorage";
import { createClient } from "@/lib/supabase/server";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Đăng nhập bằng số điện thoại + mật khẩu.
 * SĐT lấy từ danh sách tài khoản ở /cau-hinh; máy chủ tra ra email tương ứng rồi đăng nhập Supabase,
 * nên không lộ email cho người đăng nhập và không cần bật Phone Auth.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Không chấp nhận yêu cầu từ website khác." }, { status: 403 });
  }
  const fail = async () => {
    await wait(400); // làm chậm việc dò thử số điện thoại / mật khẩu
    return NextResponse.json({ error: "Số điện thoại hoặc mật khẩu không đúng." }, { status: 401 });
  };
  try {
    const body = (await request.json()) as { phone?: unknown; password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    const raw = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!raw || !password) return fail();

    const stored = await readPrivateJson<StoredSystemConfiguration>("system-configuration.json");
    const accounts = stored?.accounts ?? initialAccounts;
    const digits = normalizePhone(raw);
    let matches = digits ? accounts.filter((a) => normalizePhone(a.phone) === digits) : [];
    // Chưa tài khoản nào có SĐT (mới chuyển sang đăng nhập bằng SĐT): cho dùng email một lần
    // để Quản trị vào /cau-hinh nhập SĐT cho mọi người. Có SĐT rồi thì lối này tự đóng.
    if (!matches.length && raw.includes("@") && !accounts.some((a) => normalizePhone(a.phone))) {
      matches = accounts.filter((a) => a.email.toLowerCase() === raw.toLowerCase());
    }
    if (matches.length !== 1) return fail(); // không có hoặc trùng SĐT
    const account = matches[0];
    if (account.status === "Khóa" || !account.email) return fail();

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: account.email, password });
    if (error) return fail();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Không đăng nhập được, thử lại sau." }, { status: 500 });
  }
}
