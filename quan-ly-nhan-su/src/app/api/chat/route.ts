import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/server/requireAccess";
import { CHAT_DATA_DECLARATIONS, CHAT_DATA_TOOL_NAMES, runChatDataTool } from "@/lib/server/chatDataTools";

type ChatMessage = { role: "user" | "model"; text: string };
type Part = { text?: string; functionCall?: { name?: string; args?: Record<string, unknown> }; functionResponse?: unknown; thoughtSignature?: string; thought?: boolean };
type Content = { role: "user" | "model"; parts: Part[] };

const BASE_PROMPT =
  "Bạn là trợ lý AI của Công ty Cổ phần Công trình Thành Phát (TCW), hỗ trợ người dùng Hệ thống Quản lý hàn ray. Trả lời ngắn gọn, chính xác, bằng ngôn ngữ người dùng đang dùng (mặc định tiếng Việt).";

const DATA_PROMPT =
  " Bạn có công cụ tra cứu dữ liệu thật của hệ thống (số mối hàn theo ngày, chi tiết từng dòng Nhật ký hàn, Nhật ký thi công, tình trạng chất lượng). Khi người dùng hỏi số liệu cụ thể, hãy GỌI công cụ để lấy số liệu rồi trả lời, không nói là không truy cập được dữ liệu và không đoán số. Ngày người dùng nói không kèm năm thì lấy năm hiện tại. Nếu công cụ báo lỗi hoặc không có dữ liệu thì nói đúng như vậy.";

const MAX_TOOL_ROUNDS = 4;

/** Chatbot: chuyển hội thoại tới Gemini (Google AI Studio). Khóa API chỉ nằm ở server. Có công cụ tra cứu dữ liệu (chỉ đọc) cho người có quyền xem báo cáo. */
export async function POST(request: Request) {
  const denied = await requireAccess(null);
  if (denied) return denied;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY trên máy chủ." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { messages?: ChatMessage[] } | null;
  const messages: Content[] = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "model") && typeof m.text === "string" && m.text.trim())
    .slice(-20) // ponytail: chỉ gửi 20 lượt gần nhất, tóm tắt hội thoại nếu cần nhớ dài hơn
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, 4000) }] }));
  // Gemini yêu cầu hội thoại bắt đầu và kết thúc bằng lượt "user".
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Thiếu nội dung câu hỏi." }, { status: 400 });
  }

  // Tra cứu dữ liệu chỉ cho người có quyền xem Báo cáo tổng quan (cùng dữ liệu họ xem được ở báo cáo).
  const canQueryData = !(await requireAccess("bc-tong-quan", "view"));
  const todayVn = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  const systemPrompt = BASE_PROMPT + (canQueryData ? `${DATA_PROMPT} Hôm nay là ${todayVn} (giờ Việt Nam).` : "");
  const functionDeclarations = [
    { name: "open_contract_form", description: "Mở form nhập thông tin để tạo hợp đồng thi công khi người dùng muốn tạo/soạn/lập hợp đồng." },
    ...(canQueryData ? CHAT_DATA_DECLARATIONS : []),
  ];

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const contents: Content[] = [...messages];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools: [{ functionDeclarations }],
        generationConfig: { thinkingConfig: { thinkingLevel: "low" } }, // ponytail: chat hỏi đáp không cần suy luận sâu; tăng lên "high" nếu cần
      }),
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);

    if (!response) return NextResponse.json({ error: "Gemini không phản hồi (quá tải hoặc mất kết nối). Thử lại sau." }, { status: 502 });
    const data = (await response.json().catch(() => null)) as {
      candidates?: { content?: { parts?: Part[] } }[];
      error?: { message?: string };
    } | null;
    if (!response.ok) {
      return NextResponse.json({ error: data?.error?.message ?? `Gemini lỗi ${response.status}` }, { status: 502 });
    }
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    if (parts.some((p) => p.functionCall?.name === "open_contract_form")) {
      return NextResponse.json({ text: "Mời bạn điền thông tin hợp đồng bên dưới.", action: "contract_form" });
    }

    const calls = parts.filter((p) => p.functionCall?.name && CHAT_DATA_TOOL_NAMES.has(p.functionCall.name));
    if (calls.length && canQueryData && round < MAX_TOOL_ROUNDS) {
      // Giữ nguyên các phần mô hình trả về (kể cả chữ ký suy luận), rồi gửi kết quả công cụ.
      contents.push({ role: "model", parts });
      const results = await Promise.all(calls.map(async (p) => ({
        functionResponse: { name: p.functionCall!.name!, response: { ket_qua: await runChatDataTool(p.functionCall!.name!, p.functionCall!.args ?? {}) } },
      })));
      contents.push({ role: "user", parts: results });
      continue;
    }

    const text = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
    if (!text) return NextResponse.json({ error: "Gemini không trả về nội dung." }, { status: 502 });
    return NextResponse.json({ text });
  }
  return NextResponse.json({ error: "Không tra cứu xong dữ liệu. Thử hỏi lại ngắn gọn hơn." }, { status: 502 });
}
