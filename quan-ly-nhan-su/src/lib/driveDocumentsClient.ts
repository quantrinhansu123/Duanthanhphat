import type { DriveDocumentItem } from "./googleDrive/types";

export type { DriveDocumentItem };

const MAX_PDF_BYTES = 250 * 1024 * 1024;
const CONFIRMABLE_APP_PROPERTY_KEYS = new Set([
  "entityType",
  "employeeId",
  "weldingId",
  "documentType",
  "source",
  "category",
  "certificateId",
]);

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
        error: data.error || "Không thể tải danh sách tài liệu từ Google Drive",
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

function expectedPdfName(title: string, file: File) {
  const value = (title.trim() || file.name).trim();
  return value.toLowerCase().endsWith(".pdf") ? value : `${value}.pdf`;
}

function matchesExpectedProperties(
  item: DriveDocumentItem,
  expected?: Record<string, string>,
) {
  const entries = Object.entries(expected ?? {}).filter(
    ([key, value]) => CONFIRMABLE_APP_PROPERTY_KEYS.has(key) && value.trim(),
  );
  return entries.every(([key, value]) => item.appProperties?.[key] === value.trim());
}

async function confirmCompletedDriveUpload(params: {
  uploadUrl: string;
  file: File;
  title: string;
  description: string;
  startedAt: number;
  appProperties?: Record<string, string>;
  expectedFileId?: string;
}): Promise<{ success: boolean; item?: DriveDocumentItem; error?: string }> {
  try {
    const statusResponse = await fetch("/api/documents/resumable/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadUrl: params.uploadUrl, fileSize: params.file.size }),
    });
    const statusData = await statusResponse.json().catch(() => ({}));
    if (statusResponse.ok && statusData.complete) {
      const item = toDriveDocumentItem(statusData.item ?? {}, params);
      if (item) return { success: true, item };
    }
  } catch {
    // Nếu phiên đã hoàn tất nhưng phản hồi bị chặn, đối chiếu lại danh sách file bên dưới.
  }

  const targetName = expectedPdfName(params.title, params.file).toLocaleLowerCase("vi");
  for (const delay of [250, 750, 1500]) {
    await new Promise((resolve) => window.setTimeout(resolve, delay));
    const result = await fetchDriveDocuments();
    const item = result.items
      .filter((candidate) => {
        if (params.expectedFileId && candidate.id !== params.expectedFileId) return false;
        if (!params.expectedFileId && candidate.name.toLocaleLowerCase("vi") !== targetName) return false;
        if (Number(candidate.size) !== params.file.size) return false;
        if (!matchesExpectedProperties(candidate, params.appProperties)) return false;
        const timestamp = Date.parse(candidate.modifiedTime || candidate.createdTime);
        return !Number.isFinite(timestamp) || timestamp >= params.startedAt - 10_000;
      })
      .sort((a, b) => Date.parse(b.modifiedTime || b.createdTime) - Date.parse(a.modifiedTime || a.createdTime))[0];
    if (item) return { success: true, item };
  }

  return {
    success: false,
    error: "Không nhận được phản hồi hoàn tất từ Google Drive. Hãy kiểm tra thư mục Drive trước khi tải lại.",
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
      return { success: false, error: "Dung lượng PDF phải lớn hơn 0 và không vượt quá 250 MB." };
    }

    const startedAt = Date.now();

    // 1. Khởi tạo phiên upload resumable trên server
    const initRes = await fetch("/api/documents/resumable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: title.trim() || file.name,
        mimeType: file.type || "application/pdf",
        description: description.trim(),
        fileSize: file.size,
        appProperties,
      }),
    });

    const initData = await initRes.json();
    if (!initRes.ok || !initData.uploadUrl) {
      return { success: false, error: initData.error || "Không thể khởi tạo phiên tải lên Drive" };
    }

    // 2. Upload file trực tiếp từ trình duyệt lên Google Drive qua uploadUrl
    const uploadUrl = initData.uploadUrl;

    return await new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/pdf");

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText || "{}") as Partial<DriveDocumentItem> & { size?: number | string };
            const item = toDriveDocumentItem(response, { file, title, description });
            resolve({ success: true, item });
          } catch {
            resolve({ success: true });
          }
        } else {
          resolve({
            success: false,
            error: `Tải lên Google Drive thất bại (HTTP ${xhr.status}): ${xhr.responseText}`,
          });
        }
      };

      xhr.onerror = () => {
        void confirmCompletedDriveUpload({
          uploadUrl,
          file,
          title,
          description,
          startedAt,
          appProperties,
        }).then(resolve);
      };

      xhr.send(file);
    });
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
      return { success: false, error: data.error || "Lỗi cập nhật tài liệu trên Google Drive" };
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
      return { success: false, error: data.error || "Không thể chuyển tài liệu vào thùng rác" };
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
      return { success: false, error: "Dung lượng PDF phải lớn hơn 0 và không vượt quá 250 MB." };
    }

    const startedAt = Date.now();
    const initRes = await fetch("/api/documents/replace-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId,
        name: title?.trim() || file.name,
        description: description?.trim(),
        fileSize: file.size,
      }),
    });

    const initData = await initRes.json();
    if (!initRes.ok || !initData.uploadUrl) {
      return { success: false, error: initData.error || "Không thể khởi tạo phiên thay thế file Drive" };
    }

    const uploadUrl = initData.uploadUrl;

    return await new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/pdf");

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: `Thay thế file Google Drive thất bại (HTTP ${xhr.status}): ${xhr.responseText}`,
          });
        }
      };

      xhr.onerror = () => {
        void confirmCompletedDriveUpload({
          uploadUrl,
          file,
          title: title || file.name,
          description: description || "",
          startedAt,
          expectedFileId: fileId,
        }).then((result) => resolve({ success: result.success, error: result.error }));
      };

      xhr.send(file);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định khi thay thế tệp";
    return { success: false, error: message };
  }
}
