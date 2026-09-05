import { Readable } from "node:stream";
import { google } from "googleapis";
import type { DriveDocumentItem } from "./types";

export const MAX_DRIVE_DOCUMENT_BYTES = 250 * 1024 * 1024;
export const DRIVE_PDF_MIME_TYPE = "application/pdf";

export function isValidDriveFileId(value: string): boolean {
  return /^[A-Za-z0-9_-]{10,200}$/.test(value);
}

export function isGoogleDriveConfigured(): boolean {
  const email = process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim();
  const key = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.trim();
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  return Boolean(email && key && folder);
}

function getDriveCredentials() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim();
  let privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.trim();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  const sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID?.trim();

  if (!clientEmail || !privateKey || !folderId) {
    return null;
  }

  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  return { clientEmail, privateKey, folderId, sharedDriveId };
}

export function getDriveClient() {
  const creds = getDriveCredentials();
  if (!creds) return null;

  const auth = new google.auth.JWT({
    email: creds.clientEmail,
    key: creds.privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return {
    drive: google.drive({ version: "v3", auth }),
    folderId: creds.folderId,
    sharedDriveId: creds.sharedDriveId,
    auth,
  };
}

export function normalizePdfName(value: string): string {
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  if (!cleaned) throw new Error("Tên tài liệu không hợp lệ");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

function normalizeDescription(value?: string): string {
  return (value || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, 2000);
}

async function assertManagedDriveFile(fileId: string) {
  const ctx = getDriveClient();
  if (!ctx) throw new Error("Chưa cấu hình Google Drive env");
  const res = await ctx.drive.files.get({
    fileId,
    fields: "id, parents, trashed, mimeType",
    supportsAllDrives: true,
  });
  const belongsToFolder = res.data.parents?.includes(ctx.folderId);
  if (!belongsToFolder || res.data.trashed) {
    throw new Error("Tài liệu không thuộc thư mục Google Drive được cấu hình");
  }
  if (res.data.mimeType !== DRIVE_PDF_MIME_TYPE) {
    throw new Error("Chỉ hỗ trợ tài liệu PDF");
  }
  return ctx;
}

export async function listDriveDocuments(): Promise<DriveDocumentItem[]> {
  const ctx = getDriveClient();
  if (!ctx) {
    throw new Error(
      "Chưa cấu hình biến môi trường GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID.",
    );
  }

  const files = [];
  let pageToken: string | undefined;
  do {
    const res = await ctx.drive.files.list({
      q: `'${ctx.folderId}' in parents and trashed = false and mimeType = '${DRIVE_PDF_MIME_TYPE}'`,
      fields:
        "nextPageToken, files(id, name, description, size, mimeType, createdTime, modifiedTime, webViewLink, webContentLink, thumbnailLink, appProperties, md5Checksum)",
      orderBy: "createdTime desc",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: ctx.sharedDriveId ? "drive" : "user",
      driveId: ctx.sharedDriveId || undefined,
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return files.map((f) => ({
    id: f.id || "",
    name: f.name || "",
    description: f.description || "",
    size: Number(f.size || 0),
    mimeType: f.mimeType || "application/pdf",
    createdTime: f.createdTime || new Date().toISOString(),
    modifiedTime: f.modifiedTime || undefined,
    webViewLink: f.webViewLink || undefined,
    webContentLink: f.webContentLink || undefined,
    thumbnailLink: f.thumbnailLink || undefined,
    appProperties: (f.appProperties as Record<string, string>) || undefined,
    md5Checksum: f.md5Checksum || undefined,
  }));
}

export async function createResumableUploadSession(params: {
  name: string;
  mimeType: string;
  description?: string;
  fileSize: number;
  appProperties?: Record<string, string>;
}): Promise<string> {
  const ctx = getDriveClient();
  if (!ctx) {
    throw new Error("Chưa cấu hình Google Drive env");
  }
  if (params.mimeType !== DRIVE_PDF_MIME_TYPE) throw new Error("Chỉ hỗ trợ tải tài liệu PDF");
  if (!Number.isSafeInteger(params.fileSize) || params.fileSize <= 0 || params.fileSize > MAX_DRIVE_DOCUMENT_BYTES) {
    throw new Error("Dung lượng PDF phải lớn hơn 0 và không vượt quá 250 MB");
  }

  const { token } = await ctx.auth.getAccessToken();
  if (!token) {
    throw new Error("Không thể lấy Google OAuth access token từ Service Account");
  }

  const body: Record<string, unknown> = {
    name: normalizePdfName(params.name),
    description: normalizeDescription(params.description),
    parents: [ctx.folderId],
  };
  if (params.appProperties) {
    body.appProperties = params.appProperties;
  }

  const url =
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": DRIVE_PDF_MIME_TYPE,
      "X-Upload-Content-Length": String(params.fileSize),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${errText}`);
  }

  const location = response.headers.get("Location");
  if (!location) {
    throw new Error("Google Drive không trả về Location URL cho resumable upload session");
  }

  return location;
}

export async function createResumableUpdateSession(
  fileId: string,
  params: {
    name?: string;
    description?: string;
    fileSize: number;
    appProperties?: Record<string, string>;
  },
): Promise<string> {
  const ctx = await assertManagedDriveFile(fileId);
  if (!Number.isSafeInteger(params.fileSize) || params.fileSize <= 0 || params.fileSize > MAX_DRIVE_DOCUMENT_BYTES) {
    throw new Error("Dung lượng PDF phải lớn hơn 0 và không vượt quá 250 MB");
  }

  const { token } = await ctx.auth.getAccessToken();
  if (!token) {
    throw new Error("Không thể lấy Google OAuth access token từ Service Account");
  }

  const body: Record<string, unknown> = {};
  if (params.name !== undefined) body.name = normalizePdfName(params.name);
  if (params.description !== undefined) body.description = normalizeDescription(params.description);
  if (params.appProperties) body.appProperties = params.appProperties;

  const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=resumable&supportsAllDrives=true`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": DRIVE_PDF_MIME_TYPE,
      "X-Upload-Content-Length": String(params.fileSize),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${errText}`);
  }

  const location = response.headers.get("Location");
  if (!location) {
    throw new Error("Google Drive không trả về Location URL cho resumable update session");
  }

  return location;
}

export async function updateDriveDocument(
  fileId: string,
  params: { name?: string; description?: string; appProperties?: Record<string, string> },
): Promise<DriveDocumentItem> {
  const ctx = await assertManagedDriveFile(fileId);

  const res = await ctx.drive.files.update({
    fileId,
    requestBody: {
      name: params.name === undefined ? undefined : normalizePdfName(params.name),
      description: params.description === undefined ? undefined : normalizeDescription(params.description),
      appProperties: params.appProperties,
    },
    fields:
      "id, name, description, size, mimeType, createdTime, modifiedTime, webViewLink, webContentLink, thumbnailLink, appProperties, md5Checksum",
    supportsAllDrives: true,
  });

  const f = res.data;
  return {
    id: f.id || fileId,
    name: f.name || "",
    description: f.description || "",
    size: Number(f.size || 0),
    mimeType: f.mimeType || "application/pdf",
    createdTime: f.createdTime || new Date().toISOString(),
    modifiedTime: f.modifiedTime || undefined,
    webViewLink: f.webViewLink || undefined,
    webContentLink: f.webContentLink || undefined,
    thumbnailLink: f.thumbnailLink || undefined,
    appProperties: (f.appProperties as Record<string, string>) || undefined,
    md5Checksum: f.md5Checksum || undefined,
  };
}

export async function trashDriveDocument(fileId: string): Promise<boolean> {
  const ctx = await assertManagedDriveFile(fileId);

  await ctx.drive.files.update({
    fileId,
    requestBody: {
      trashed: true,
    },
    supportsAllDrives: true,
  });
  return true;
}

export async function uploadBufferToDrive(params: {
  name: string;
  description?: string;
  buffer: Buffer;
  appProperties?: Record<string, string>;
}): Promise<{ fileId: string; md5Checksum?: string; name: string; size: number }> {
  const ctx = getDriveClient();
  if (!ctx) throw new Error("Google Drive chưa được cấu hình");

  const stream = Readable.from(params.buffer);
  const res = await ctx.drive.files.create({
    requestBody: {
      name: normalizePdfName(params.name),
      description: normalizeDescription(params.description),
      parents: [ctx.folderId],
      appProperties: params.appProperties,
    },
    media: {
      mimeType: DRIVE_PDF_MIME_TYPE,
      body: stream,
    },
    fields: "id, name, size, md5Checksum, appProperties",
    supportsAllDrives: true,
  });

  return {
    fileId: res.data.id || "",
    md5Checksum: res.data.md5Checksum || undefined,
    name: res.data.name || params.name,
    size: Number(res.data.size) || params.buffer.length,
  };
}
