import { NextResponse } from "next/server";
import { authenticateWeldQuality, QualityApiError } from "@/lib/server/weldQualityAuth";
import { qualityUuid } from "@/lib/server/weldQualityJournal";
import { saveBbntScan } from "@/lib/server/weldAcceptanceServer";
import { GOOGLE_DRIVE_CONFIGURATION_MESSAGE, isGoogleDriveConfigured, uploadBufferToDrive } from "@/lib/googleDrive/server";
import { formatSupabaseError } from "@/lib/supabase/env";

export const runtime = "nodejs";

// Vercel giới hạn thân yêu cầu ~4,5 MB cho hàm máy chủ.
const MAX_SCAN_BYTES = 4 * 1024 * 1024;

/** Tải bản scan PDF của biên bản đã ký thẳng vào thư mục Google Drive của hệ thống, rồi gắn liên kết vào phiếu. */
export async function POST(request: Request) {
  try {
    const actor = await authenticateWeldQuality(request);
    if (!isGoogleDriveConfigured()) throw new QualityApiError(GOOGLE_DRIVE_CONFIGURATION_MESSAGE, 503);
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
    const uploaded = await uploadBufferToDrive({
      name: `BBNT đã ký ${soPhieu}.pdf`,
      description: `Biên bản nghiệm thu đã ký của phiếu ${soPhieu}`,
      buffer: bytes,
      appProperties: { entityType: "bbnt-da-ky", source: soPhieu.slice(0, 100) },
    });
    if (!uploaded.fileId) throw new QualityApiError("Google Drive không trả về mã file.", 502);
    await saveBbntScan({ id, kind, scan: { doc_id: uploaded.fileId, url: `https://drive.google.com/file/d/${uploaded.fileId}/view`, ten: uploaded.name } }, actor);
    return NextResponse.json({ id, fileId: uploaded.fileId });
  } catch (error) {
    const message = formatSupabaseError(error);
    const status = error instanceof QualityApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
