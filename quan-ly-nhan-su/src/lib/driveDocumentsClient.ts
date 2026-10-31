import type { DriveDocumentItem } from "./googleDrive/types";

export type { DriveDocumentItem };

const MAX_PDF_BYTES = 50 * 1024 * 1024;

export async function fetchDriveDocuments(): Promise<{
  configured: boolean;
  items: DriveDocumentItem[];
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch("/api/documents", { method: "GET" });
    const data = await res.json();
    if (!res.ok) {
      return {
        configured: data.configured ?? false,
        items: [],
        error: data.error || "Không thể tải danh sách tài liệu",
      };
    }
    return {
      configured: data.configured ?? true,
      items: data.items || [],
      message: data.message,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi kết nối mạng";
    return { configured: false, items: [], error: message };
  }
}

async function postPdf(
  file: File,
  fields: Record<string, string>,
  onProgress?: (percent: number) => void,
) {
  const prepared = await fetch("/api/documents/upload-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "prepare", name: fields.name, description: fields.description,
      size: file.size, mimeType: "application/pdf", replaceId: fields.fileId,
      appProperties: JSON.parse(fields.appProperties || "{}"),
    }),
  });
  const session = await prepared.json();
  if (!prepared.ok) return { ok: false, status: prepared.status, data: session };
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", session.uploadUrl);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 95));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Không tải được tệp lên kho tài liệu. Vui lòng thử lại hoặc liên hệ quản trị viên."));
    };
    xhr.onerror = () => reject(new Error("Không kết nối được kho tài liệu. Vui lòng kiểm tra kết nối mạng."));
    xhr.send(file);
  });
  const completed = await fetch("/api/documents/upload-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete", ticket: session.ticket }),
  });
  const data = await completed.json();
  if (completed.ok) onProgress?.(100);
  return { ok: completed.ok, status: completed.status, data };
}

function toDriveDocumentItem(
  response: Partial<DriveDocumentItem> & { size?: number | string },
  fallback: { file: File; title: string; description: string },
): DriveDocumentItem | undefined {
  if (!response.id) return undefined;
  return {
    id: response.id,
    name: response.name || fallback.title || fallback.file.name,
    description: response.description || fallback.description,
    size: Number(response.size || fallback.file.size),
    mimeType: response.mimeType || "application/pdf",
    createdTime: response.createdTime || new Date().toISOString(),
    modifiedTime: response.modifiedTime,
    webViewLink: response.webViewLink,
    webContentLink: response.webContentLink,
    thumbnailLink: response.thumbnailLink,
    appProperties: response.appProperties,
    md5Checksum: response.md5Checksum,
  };
}

export async function uploadDocumentToDrive(
  file: File,
  title: string,
  description: string,
  onProgress?: (percent: number) => void,
  appProperties?: Record<string, string>,
): Promise<{ success: boolean; item?: DriveDocumentItem; error?: string }> {
  try {
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
      return { success: false, error: "Chỉ hỗ trợ tải tài liệu PDF." };
    }
    if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
      return { success: false, error: "Dung lượng PDF phải lớn hơn 0 và không vượt quá 50 MB." };
    }

    const result = await postPdf(
      file,
      {
        name: title.trim() || file.name,
        description: description.trim(),
        appProperties: JSON.stringify(appProperties ?? {}),
      },
      onProgress,
    );
    if (!result.ok) {
      return { success: false, error: String(result.data.error || "Không tải được tài liệu lên kho.") };
    }
    const item = toDriveDocumentItem(
      (result.data.item ?? {}) as Partial<DriveDocumentItem> & { size?: number | string },
      { file, title, description },
    );
    return { success: true, item };
  } catch (err: unknown) {
    const message = err instanceof Error && !(err instanceof TypeError) ? err.message : "Không tải được tài liệu. Vui lòng kiểm tra kết nối mạng.";
    return { success: false, error: message };
  }
}

export async function updateDriveDocumentMeta(
  fileId: string,
  title: string,
  description: string,
  folder?: string,
): Promise<{ success: boolean; item?: DriveDocumentItem; error?: string }> {
  try {
    const res = await fetch(`/api/documents/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: title.trim(),
        description: description.trim(),
        ...(folder !== undefined ? { folder } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Lỗi cập nhật tài liệu" };
    }
    return { success: true, item: data.item };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi kết nối mạng";
    return { success: false, error: message };
  }
}

export async function deleteDriveDocument(
  fileId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/documents/${fileId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Không thể xóa tài liệu" };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi kết nối mạng";
    return { success: false, error: message };
  }
}

export async function replaceDocumentContentInDrive(
  fileId: string,
  file: File,
  title?: string,
  description?: string,
  onProgress?: (percent: number) => void,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
      return { success: false, error: "Chỉ hỗ trợ tải tài liệu PDF." };
    }
    if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
      return { success: false, error: "Dung lượng PDF phải lớn hơn 0 và không vượt quá 50 MB." };
    }

    const result = await postPdf(
      file,
      {
        fileId,
        name: title?.trim() || file.name,
        description: description?.trim() || "",
      },
      onProgress,
    );
    if (!result.ok) {
      return { success: false, error: String(result.data.error || "Không thay được tệp.") };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định khi thay thế tệp";
    return { success: false, error: message };
  }
}

async function folderRequest(init?: RequestInit, query = ""): Promise<{ folders: string[]; error?: string; created?: string }> {
  try {
    const res = await fetch(`/api/document-folders${query}`, { cache: "no-store", ...init });
    const data = (await res.json().catch(() => ({}))) as { folders?: string[]; error?: string; created?: string };
    return res.ok ? { folders: data.folders ?? [], created: data.created } : { folders: [], error: data.error || `HTTP ${res.status}` };
  } catch (err: unknown) {
    return { folders: [], error: err instanceof Error ? err.message : "Lỗi kết nối mạng" };
  }
}

export const fetchDocumentFolders = () => folderRequest();

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** parent = đường dẫn thư mục cha ("" = cấp gốc). Kết quả `created` là đường dẫn đầy đủ. */
export const createDocumentFolder = (name: string, parent = "") =>
  folderRequest(jsonInit("POST", { name, parent }));

export const renameDocumentFolder = (path: string, name: string) =>
  folderRequest(jsonInit("PATCH", { path, name }));

export const deleteDocumentFolder = (path: string) =>
  folderRequest({ method: "DELETE" }, `?path=${encodeURIComponent(path)}`);
