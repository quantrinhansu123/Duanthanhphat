import "server-only";

const TABLE = () => process.env.APPSHEET_TABLE?.trim() || "Lưu trữ";

/** Tên app AppSheet dùng trong đường dẫn xem file (vd Thànhphát-325045268). */
const APP_NAME = () => process.env.APPSHEET_APP_NAME?.trim() || "Thànhphát-325045268";

/**
 * Đường dẫn xem file đã lưu trong AppSheet. AppSheet bắt ký URL: chỉ mở được khi app tắt
 * «Require image and document URL signing» (Security → Options) hoặc khi dùng link có chữ ký do chính AppSheet cấp.
 */
export function appSheetFileUrl(path: string) {
  if (!path) return "";
  return `https://www.appsheet.com/template/gettablefileurl?appName=${encodeURIComponent(APP_NAME())}&tableName=${encodeURIComponent(TABLE())}&fileName=${encodeURIComponent(path)}`;
}

export function isAppSheetConfigured() {
  return Boolean(process.env.APPSHEET_APP_ID?.trim() && process.env.APPSHEET_API_KEY?.trim());
}

/**
 * Đẩy một file PDF vào bảng lưu trữ của app AppSheet (cột id = khoá, «Tên file», file).
 * Ô File nhận chuỗi data URI base64 — AppSheet tự lưu thành file trong thư mục dữ liệu của app và trả lại đường dẫn.
 */
export async function addAppSheetFile(input: { id: string; name: string; bytes: Buffer }): Promise<{ path: string }> {
  const app = process.env.APPSHEET_APP_ID?.trim();
  const key = process.env.APPSHEET_API_KEY?.trim();
  if (!app || !key) throw new Error("Chưa cấu hình AppSheet (APPSHEET_APP_ID, APPSHEET_API_KEY).");
  const response = await fetch(`https://api.appsheet.com/api/v2/apps/${app}/tables/${encodeURIComponent(TABLE())}/Action`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ApplicationAccessKey: key },
    body: JSON.stringify({
      Action: "Add",
      Properties: { Locale: "vi-VN" },
      Rows: [{ id: input.id, "Tên file": input.name, file: `data:application/pdf;base64,${input.bytes.toString("base64")}` }],
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`AppSheet từ chối (HTTP ${response.status}): ${text.slice(0, 300)}`);
  let path = "";
  try {
    const data = JSON.parse(text) as { Rows?: { file?: string }[] };
    path = data.Rows?.[0]?.file ?? "";
  } catch { /* phản hồi không phải JSON: coi như đã thêm */ }
  return { path };
}
