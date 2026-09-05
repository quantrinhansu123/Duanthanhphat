export type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
};

export async function uploadToCloudinary(
  file: File,
  folder = "thanhphat",
): Promise<{ result?: CloudinaryUploadResult; error?: string }> {
  try {
    if (!file.type.startsWith("image/")) {
      return { error: "Chỉ hỗ trợ tải file ảnh." };
    }
    if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
      return { error: "Dung lượng ảnh phải lớn hơn 0 và không vượt quá 15 MB." };
    }

    const signRes = await fetch("/api/cloudinary/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder }),
    });

    const signData = await signRes.json();
    if (!signRes.ok || !signData.signature) {
      return { error: signData.error || "Không thể lấy chữ ký tải lên Cloudinary" };
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signData.apiKey);
    formData.append("timestamp", String(signData.timestamp));
    formData.append("signature", signData.signature);
    formData.append("folder", signData.folder);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      },
    );

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      return { error: uploadData.error?.message || "Lỗi tải ảnh lên Cloudinary" };
    }

    return {
      result: {
        public_id: uploadData.public_id,
        secure_url: uploadData.secure_url,
        width: uploadData.width,
        height: uploadData.height,
        bytes: uploadData.bytes,
        format: uploadData.format,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi upload ảnh";
    return { error: msg };
  }
}

export async function deleteCloudinaryAsset(publicId: string): Promise<boolean> {
  if (!publicId) return true;
  try {
    const encoded = encodeURIComponent(publicId);
    const res = await fetch(`/api/cloudinary/${encoded}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
