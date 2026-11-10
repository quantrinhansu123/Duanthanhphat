import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/server/requireAccess";

type ChatMessage = { role: "user" | "model"; text: string };

const SYSTEM_PROMPT =
  "Bạn là trợ lý AI của Công ty Cổ phần Công trình Thành Phát (TCW), hỗ trợ người dùng Hệ thống Quản lý hàn ray. Trả lời ngắn gọn, chính xác, bằng ngôn ngữ người dùng đang dùng (mặc định tiếng Việt).";

/** Chatbot: chuyển hội thoại tới Gemini (Google AI Studio). Khóa API chỉ nằm ở server. */
export async function POST(request: Request) {
  const denied = await requireAccess(null);
  if (denied) return denied;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY trên máy chủ." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { messages?: ChatMessage[] } | null;
  const messages = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "model") && typeof m.text === "string" && m.text.trim())
    .slice(-20) // ponytail: chỉ gửi 20 lượt gần nhất, tóm tắt hội thoại nếu cần nhớ dài hơn
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, 4000) }] }));
  // Gemini yêu cầu hội thoại bắt đầu và kết thúc bằng lượt "user".
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Thiếu nội dung câu hỏi." }, { status: 400 });
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: messages,
        tools: [{ functionDeclarations: [{ name: "open_contract_form", description: "Mở form nhập thông tin để tạo hợp đồng thi công khi người dùng muốn tạo/soạn/lập hợp đồng." }] }],
        generationConfig: { thinkingConfig: { thinkingLevel: "low" } }, // ponytail: chat hỏi đáp không cần suy luận sâu; tăng lên "high" nếu cần
      }),
      signal: AbortSignal.timeout(20_000),
    },
  ).catch(() => null);

  if (!response) return NextResponse.json({ error: "Gemini không phản hồi (quá tải hoặc mất kết nối). Thử lại sau." }, { status: 502 });
  const data = (await response.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string; functionCall?: { name?: string } }[] } }[];
    error?: { message?: string };
  } | null;
  if (!response.ok) {
    return NextResponse.json({ error: data?.error?.message ?? `Gemini lỗi ${response.status}` }, { status: 502 });
  }
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  if (parts.some((p) => p.functionCall?.name === "open_contract_form")) {
    return NextResponse.json({ text: "Mời bạn điền thông tin hợp đồng bên dưới.", action: "contract_form" });
  }
  const text = parts.map((p) => p.text ?? "").join("").trim();
  if (!text) return NextResponse.json({ error: "Gemini không trả về nội dung." }, { status: 502 });
  return NextResponse.json({ text });
}
