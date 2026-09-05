import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  isGoogleDriveConfigured,
  listDriveDocuments,
  uploadBufferToDrive,
} from "@/lib/googleDrive/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type MigrationItemResult = {
  supabaseId: string;
  name: string;
  driveFileId?: string;
  localMd5?: string;
  driveMd5?: string;
  checksumMatched: boolean;
  status: "migrated" | "already_exists" | "failed";
  message?: string;
};

export async function POST() {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { error: "Google Drive chưa được cấu hình các biến môi trường cần thiết." },
      { status: 503 },
    );
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Không thể khởi tạo Supabase Admin Client";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    // 1. Lấy danh sách tài liệu từ bảng tai_lieu trong Supabase
    const { data: rows, error: fetchErr } = await supabase
      .from("tai_lieu")
      .select("id, ten, mo_ta, file_path, file_url, file_size, created_at")
      .order("created_at", { ascending: true });

    if (fetchErr) {
      return NextResponse.json(
        { error: `Lỗi truy vấn bảng tai_lieu: ${fetchErr.message}` },
        { status: 500 },
      );
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        success: true,
        summary: { total: 0, migrated: 0, alreadyExists: 0, failed: 0 },
        items: [],
        message: "Không tìm thấy tài liệu nào trong Supabase để di chuyển.",
      });
    }

    // 2. Lấy danh sách các tài liệu hiện có trên Google Drive để tránh duplicate
    const existingDriveDocs = await listDriveDocuments();
    const existingBySupabaseId = new Map<string, (typeof existingDriveDocs)[0]>();
    for (const doc of existingDriveDocs) {
      if (doc.appProperties?.supabase_id) {
        existingBySupabaseId.set(doc.appProperties.supabase_id, doc);
      }
    }

    const results: MigrationItemResult[] = [];
    let migratedCount = 0;
    let alreadyExistsCount = 0;
    let failedCount = 0;

    for (const row of rows) {
      // Đã có trên Drive?
      const existing = existingBySupabaseId.get(row.id);
      if (existing) {
        alreadyExistsCount++;
        results.push({
          supabaseId: row.id,
          name: row.ten,
          driveFileId: existing.id,
          localMd5: existing.appProperties?.md5,
          driveMd5: existing.md5Checksum,
          checksumMatched: Boolean(
            existing.md5Checksum &&
              existing.appProperties?.md5 &&
              existing.md5Checksum.toLowerCase() === existing.appProperties.md5.toLowerCase(),
          ),
          status: "already_exists",
          message: "Tài liệu đã được di chuyển sang Google Drive trước đó.",
        });
        continue;
      }

      try {
        // Tải nội dung file từ Supabase Storage bucket 'tai-lieu' hoặc qua file_url
        let fileBuffer: Buffer | null = null;
        const { data: downloadData, error: downloadErr } = await supabase.storage
          .from("tai-lieu")
          .download(row.file_path);

        if (!downloadErr && downloadData) {
          fileBuffer = Buffer.from(await downloadData.arrayBuffer());
        } else if (row.file_url) {
          const resp = await fetch(row.file_url);
          if (resp.ok) {
            fileBuffer = Buffer.from(await resp.arrayBuffer());
          }
        }

        if (!fileBuffer || fileBuffer.length === 0) {
          failedCount++;
          results.push({
            supabaseId: row.id,
            name: row.ten,
            checksumMatched: false,
            status: "failed",
            message: `Không thể tải file từ Supabase storage: ${downloadErr?.message || "File rỗng"}`,
          });
          continue;
        }

        // Tính MD5 Checksum của file nguồn
        const localMd5 = crypto.createHash("md5").update(fileBuffer).digest("hex");

        // Upload trực tiếp sang Google Drive kèm appProperties
        const driveName = row.ten.toLowerCase().endsWith(".pdf") ? row.ten : `${row.ten}.pdf`;
        const driveResult = await uploadBufferToDrive({
          name: driveName,
          description: row.mo_ta || undefined,
          buffer: fileBuffer,
          appProperties: {
            supabase_id: row.id,
            supabase_file_path: row.file_path,
            md5: localMd5,
            source: "supabase_migration",
            checksum_verified: "true",
          },
        });

        const driveMd5 = driveResult.md5Checksum;
        const checksumMatched = Boolean(
          driveMd5 && driveMd5.toLowerCase() === localMd5.toLowerCase(),
        );

        migratedCount++;
        results.push({
          supabaseId: row.id,
          name: row.ten,
          driveFileId: driveResult.fileId,
          localMd5,
          driveMd5,
          checksumMatched,
          status: "migrated",
          message: checksumMatched
            ? "Đã di chuyển thành công và đối chiếu trùng khớp Checksum MD5."
            : "Đã di chuyển, nhưng MD5 checksum của Drive không khớp hoặc chưa trả về.",
        });
      } catch (itemErr: unknown) {
        failedCount++;
        const msg = itemErr instanceof Error ? itemErr.message : "Lỗi không xác định khi di chuyển file";
        results.push({
          supabaseId: row.id,
          name: row.ten,
          checksumMatched: false,
          status: "failed",
          message: msg,
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: rows.length,
        migrated: migratedCount,
        alreadyExists: alreadyExistsCount,
        failed: failedCount,
      },
      items: results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi di chuyển tài liệu từ Supabase sang Drive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
