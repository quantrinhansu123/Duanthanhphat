import { NextResponse } from "next/server";

/** Gửi tin Zalo OA tới Chỉ huy trưởng. Bỏ qua nếu chưa cấu hình token. */
export async function POST(request: Request) {
  const token = process.env.ZALO_OA_ACCESS_TOKEN?.trim();
  const recipients = (process.env.ZALO_COMMANDER_USER_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!token || recipients.length === 0) {
    return NextResponse.json({ sent: false, reason: "chua-cau-hinh-zalo" });
  }

  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) return NextResponse.json({ sent: false, reason: "thieu-noi-dung" }, { status: 400 });

  const results = await Promise.all(
    recipients.map(async (userId) => {
      const response = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: token,
        },
        body: JSON.stringify({
          recipient: { user_id: userId },
          message: { text },
        }),
      });
      return response.ok;
    }),
  );

  return NextResponse.json({ sent: results.some(Boolean) });
}
