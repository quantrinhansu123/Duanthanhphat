import type { DriveDocumentItem } from "./googleDrive/types";

export type { DriveDocumentItem };

const MAX_PDF_BYTES = 250 * 1024 * 1024;

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

export async function uploadDocumentToDrive(
  file: File,
  title: string,
  description: string,
  onProgress?: (percent: number) => void,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
      return { success: false, error: "Chỉ hỗ trợ tải tài liệu PDF." };
    }
    if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
      return { success: false, error: "Dung lượng PDF phải lớn hơn 0 và không vượt quá 250 MB." };
    }

    // 1. Khởi tạo phiên upload resumable trên server
    const initRes = await fetch("/api/documents/resumable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: title.trim() || file.name,
        mimeType: file.type || "application/pdf",
        description: description.trim(),
        fileSize: file.size,
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
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: `Tải lên Google Drive thất bại (HTTP ${xhr.status}): ${xhr.responseText}`,
          });
        }
      };

      xhr.onerror = () => {
        resolve({ success: false, error: "Lỗi kết nối mạng trong quá trình tải trực tiếp lên Drive." });
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
): Promise<{ item?: DriveDocumentItem; error?: string }> {
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
      return { error: data.error || "Lỗi cập nhật tài liệu trên Google Drive" };
    }
    return { item: data.item };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi kết nối mạng";
    return { error: message };
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
