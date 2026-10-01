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

function postPdf(
  url: string,
  file: File,
  fields: Record<string, string>,
  onProgress?: (percent: number) => void,
) {
  return new Promise<{ ok: boolean; status: number; data: Record<string, unknown> }>((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
    }
    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText || "{}") as Record<string, unknown>;
      } catch {
        data = {};
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.onerror = () => reject(new Error("Không kết nối được máy chủ khi tải file."));
    xhr.send(body);
  });
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
      "/api/documents/upload",
      file,
      {
        name: title.trim() || file.name,
        description: description.trim(),
        appProperties: JSON.stringify(appProperties ?? {}),
      },
      onProgress,
    );
    if (!result.ok) {
      return { success: false, error: String(result.data.error || "Không tải được tài liệu lên bucket.") };
    }
    const item = toDriveDocumentItem(
      (result.data.item ?? {}) as Partial<DriveDocumentItem> & { size?: number | string },
      { file, title, description },
    );
    return { success: true, item };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định khi upload";
    return { success: false, error: message };
  }
}

export async function updateDriveDocumentMeta(
  fileId: string,
  title: string,
  description: string,
): Promise<{ success: boolean; item?: DriveDocumentItem; error?: string }> {
  try {
    const res = await fetch(`/api/documents/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: title.trim(),
        description: description.trim(),
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
      "/api/documents/replace",
      file,
      {
        fileId,
        name: title?.trim() || file.name,
        description: description?.trim() || "",
      },
      onProgress,
    );
    if (!result.ok) {
      return { success: false, error: String(result.data.error || "Không thay được file.") };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định khi thay thế tệp";
    return { success: false, error: message };
  }
}
