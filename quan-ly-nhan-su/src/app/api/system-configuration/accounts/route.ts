import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAccess } from "@/lib/server/requireAccess";

/** Tạo tài khoản đăng nhập Supabase — mật khẩu không bao giờ được lưu vào file cấu hình. */
export async function POST(request: Request) {
  const denied = await requireAccess("cau-hinh", "edit");
  if (denied) return denied;
  try {
    const { email, password } = (await request.json()) as { email?: string; password?: string };
    if (!email?.trim() || !password || password.length < 6) {
      return NextResponse.json({ error: "Cần email và mật khẩu tối thiểu 6 ký tự." }, { status: 400 });
    }
    const { data, error } = await createAdminClient().auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ id: data.user.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lỗi tạo tài khoản" }, { status: 500 });
  }
}

/** Đổi mật khẩu; tài khoản chưa có trong Supabase (dữ liệu mẫu) thì được tạo mới với mật khẩu này. */
export async function PUT(request: Request) {
  const denied = await requireAccess("cau-hinh", "edit");
  if (denied) return denied;
  try {
    const { email, password } = (await request.json()) as { email?: string; password?: string };
    if (!email?.trim() || !password || password.length < 6) {
      return NextResponse.json({ error: "Cần email và mật khẩu tối thiểu 6 ký tự." }, { status: 400 });
    }
    const admin = createAdminClient();
    const target = email.trim().toLowerCase();
    // ponytail: quét 1000 người dùng đầu, phân trang nếu số tài khoản vượt mức này
    const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });
    const user = list.users.find((u) => u.email?.toLowerCase() === target);
    const { error } = user
      ? await admin.auth.admin.updateUserById(user.id, { password })
      : await admin.auth.admin.createUser({ email: target, password, email_confirm: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lỗi đổi mật khẩu" }, { status: 500 });
  }
}
