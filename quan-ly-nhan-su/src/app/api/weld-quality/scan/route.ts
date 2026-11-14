import { NextResponse } from "next/server";
import { authenticateWeldQuality, QualityApiError } from "@/lib/server/weldQualityAuth";
import { qualityUuid } from "@/lib/server/weldQualityJournal";
import { saveBbntScan } from "@/lib/server/weldAcceptanceServer";
import { addAppSheetFile, appSheetFileUrl, isAppSheetConfigured } from "@/lib/server/appsheet";
import { isDocumentStorageConfigured, uploadStoredDocument } from "@/lib/documentStorage";
import { formatSupabaseError } from "@/lib/supabase/env";

export const runtime = "nodejs";

// Vercel giới hạn thân yêu cầu ~4,5 MB cho hàm máy chủ.
const MAX_SCAN_BYTES = 4 * 1024 * 1024;

/**
 * Lưu bản scan PDF của biên bản đã ký:
 * - đẩy vào bảng «Lưu trữ» của app AppSheet (nơi lưu trữ chính);
 * - giữ thêm một bản trong kho Tài liệu để nút «Xem biên bản đã lưu» mở được ngay.
 * Liên kết gắn vào phiếu. AppSheet lỗi thì vẫn lưu bản kho Tài liệu và báo cảnh báo.
 */
export async function POST(request: Request) {
  try {
    const actor = await authenticateWeldQuality(request, true);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new QualityApiError("Thiếu file PDF.");
    if (file.size <= 0) throw new QualityApiError("File PDF rỗng.");
    if (file.size > MAX_SCAN_BYTES) throw new QualityApiError("File PDF quá lớn (tối đa 4 MB). Nén hoặc scan lại độ phân giải thấp hơn.", 413);
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") throw new QualityApiError("Chỉ hỗ trợ file PDF.");
    const id = qualityUuid(form.get("id"));
    const kind = form.get("kind") === "tach" ? "tach" : "rfi";
    const soPhieu = String(form.get("so_phieu") ?? "").trim().slice(0, 80) || "phieu";
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new QualityApiError("File không phải PDF hợp lệ.");
    if (!isDocumentStorageConfigured()) throw new QualityApiError("Chưa cấu hình Supabase để lưu bản xem biên bản.", 503);

    const originalName = String(form.get("ten_goc") ?? file.name).replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]/g, " ").trim().slice(0, 80);
    const name = originalName ? `BBNT đã ký ${soPhieu} - ${originalName}.pdf` : `BBNT đã ký ${soPhieu}.pdf`;
    let appSheetPath = "";
    let warning = "";
    if (isAppSheetConfigured()) {
      try { appSheetPath = (await addAppSheetFile({ id: `${id}-${Date.now()}`, name, bytes })).path; }
      catch (error) { warning = error instanceof Error ? error.message : "Không đẩy được sang AppSheet."; }
    }
    // Bản xem trực tiếp trong hệ thống (kho Tài liệu).
    const stored = await uploadStoredDocument({ bytes, name, description: `Biên bản nghiệm thu đã ký của phiếu ${soPhieu}`, appProperties: { loai: "bbnt-da-ky", phieu_id: id, so_phieu: soPhieu } });
    await saveBbntScan({
      id, kind,
      scan: { doc_id: stored.id, url: stored.webViewLink || `/api/documents/${stored.id}`, ten: name, appsheet_path: appSheetPath, appsheet_url: appSheetFileUrl(appSheetPath) },
    }, actor);
    return NextResponse.json({ id, appsheet: Boolean(appSheetPath), warning: warning || undefined });
  } catch (error) {
    const message = formatSupabaseError(error);
    const status = error instanceof QualityApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
