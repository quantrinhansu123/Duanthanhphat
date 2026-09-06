import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CERT_STATUSES = new Set(["Chưa cập nhật", "Còn hiệu lực", "Sắp hết hạn", "Hết hạn"]);
const COMPLIANCE_STATUSES = new Set(["Chưa đánh giá", "Thiếu minh chứng", "Đáp ứng một phần", "Đạt"]);
const COMPLIANCE_SCOPES = new Set(["Công ty", "Quy trình hàn", "Thợ hàn"]);

function text(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function nullableText(value: unknown, max = 4000) {
  const result = text(value, max);
  return result || null;
}

export async function GET() {
  try {
    const supabase = createAdminClient();
    const [certificates, assessments] = await Promise.all([
      supabase.from("chung_chi_qlcl_cong_ty").select("*").order("updated_at", { ascending: false }),
      supabase.from("danh_gia_tieu_chuan_qlcl").select("*"),
    ]);
    if (certificates.error) throw certificates.error;
    if (assessments.error) throw assessments.error;
    return NextResponse.json({
      certificates: certificates.data ?? [],
      assessments: assessments.data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tải được metadata QLCL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const kind = text(body.kind, 32);
    const item = body.item && typeof body.item === "object"
      ? body.item as Record<string, unknown>
      : {};
    const supabase = createAdminClient();

    if (kind === "certificate") {
      const id = text(item.id, 180);
      const title = text(item.title, 500);
      const status = text(item.status, 40);
      if (!id || !title || !CERT_STATUSES.has(status)) {
        return NextResponse.json({ error: "Dữ liệu chứng chỉ công ty không hợp lệ." }, { status: 400 });
      }
      const payload = {
        id,
        title,
        standard_code: text(item.standardCode, 300),
        organization: text(item.organization, 500),
        certificate_number: text(item.certificateNumber, 300),
        scope: text(item.scope, 4000),
        issued_at: text(item.issuedAt, 40),
        expires_at: text(item.expiresAt, 40),
        status,
        document_name: nullableText(item.documentName, 500),
        document_url: nullableText(item.documentUrl, 2000),
        drive_file_id: nullableText(item.driveFileId, 300),
        notes: nullableText(item.notes, 4000),
        updated_at: new Date().toISOString(),
      };
      const result = await supabase
        .from("chung_chi_qlcl_cong_ty")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();
      if (result.error) throw result.error;
      return NextResponse.json({ item: result.data });
    }

    if (kind === "compliance") {
      const itemId = text(item.id, 180);
      const status = text(item.status, 40);
      const scope = text(item.scope, 40);
      const evidenceDoc = nullableText(item.evidenceDoc, 500);
      const verifier = nullableText(item.verifier, 500);
      const verifiedAt = nullableText(item.verifiedAt, 40);
      if (!itemId || !COMPLIANCE_STATUSES.has(status) || !COMPLIANCE_SCOPES.has(scope)) {
        return NextResponse.json({ error: "Dữ liệu đánh giá tiêu chuẩn không hợp lệ." }, { status: 400 });
      }
      if (status === "Đạt" && (!evidenceDoc || !verifier || !verifiedAt)) {
        return NextResponse.json(
          { error: "Trạng thái Đạt bắt buộc có minh chứng, người xác nhận và ngày xác nhận." },
          { status: 400 },
        );
      }
      const payload = {
        item_id: itemId,
        status,
        scope,
        evidence_doc: evidenceDoc,
        evidence_url: nullableText(item.evidenceUrl, 2000),
        verifier,
        verified_at: verifiedAt,
        notes: nullableText(item.notes, 4000),
        updated_at: new Date().toISOString(),
      };
      const result = await supabase
        .from("danh_gia_tieu_chuan_qlcl")
        .upsert(payload, { onConflict: "item_id" })
        .select("*")
        .single();
      if (result.error) throw result.error;
      return NextResponse.json({ item: result.data });
    }

    return NextResponse.json({ error: "Loại metadata không được hỗ trợ." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được metadata QLCL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const id = url.searchParams.get("id")?.trim();
    if (kind !== "certificate" || !id) {
      return NextResponse.json({ error: "Yêu cầu xóa không hợp lệ." }, { status: 400 });
    }
    const supabase = createAdminClient();
    const result = await supabase.from("chung_chi_qlcl_cong_ty").delete().eq("id", id).select("id");
    if (result.error) throw result.error;
    if ((result.data ?? []).length !== 1) {
      return NextResponse.json({ error: "Không tìm thấy chứng chỉ cần xóa." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không xóa được chứng chỉ công ty.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
