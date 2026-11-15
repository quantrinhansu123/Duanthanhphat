const fields = ["soHD", "ngayKy", "diaDiemKy", "aTen", "aDiaChi", "aDaiDien", "aChucVu", "bTen", "bDaiDien", "bChucVu", "duAn", "hangMuc", "giaTri", "tuNgay", "denNgay", "thanhToan"];

export const ANTI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["message", "contract_form"] },
    text: { type: "string", minLength: 1 },
    data: { type: "object", properties: Object.fromEntries(fields.map((key) => [key, { type: "string" }])), required: fields, additionalProperties: false },
  },
  required: ["action", "text"],
  additionalProperties: false,
};

export function parseAntiResponse(text: string): { text: string; action?: "contract_form"; data?: Record<string, string> } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const value = JSON.parse(start >= 0 && end >= start ? text.slice(start, end + 1) : text);
  if (!value || typeof value.text !== "string" || !value.text.trim() || !["message", "contract_form"].includes(value.action)) throw new Error("Anti CLI trả về sai cấu trúc phản hồi.");
  if (value.action === "message") return { text: value.text };
  if (value.data === undefined) return { text: value.text, action: "contract_form" };
  if (!value.data || fields.some((key) => typeof value.data[key] !== "string")) throw new Error("Anti CLI trả về dữ liệu hợp đồng không hợp lệ.");
  return { text: value.text, action: "contract_form", data: Object.fromEntries(fields.map((key) => [key, value.data[key]])) };
}
