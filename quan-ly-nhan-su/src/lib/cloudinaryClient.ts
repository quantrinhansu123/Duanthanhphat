export type CloudinaryResourceType = "image" | "video" | "raw";

export type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  resource_type?: CloudinaryResourceType;
  original_filename?: string;
};

function resourceTypeForFile(file: File): CloudinaryResourceType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "raw";
}

async function signedUpload(
  file: File,
  folder: string,
  resourceType: CloudinaryResourceType,
): Promise<{ result?: CloudinaryUploadResult; error?: string }> {
  try {
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
      `https://api.cloudinary.com/v1_1/${signData.cloudName}/${resourceType}/upload`,
      { method: "POST", body: formData },
    );
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      return { error: uploadData.error?.message || "Lỗi tải tệp lên Cloudinary" };
    }

    return {
      result: {
        public_id: uploadData.public_id,
        secure_url: uploadData.secure_url,
        width: uploadData.width,
        height: uploadData.height,
        bytes: uploadData.bytes,
        format: uploadData.format,
        resource_type: uploadData.resource_type || resourceType,
        original_filename: uploadData.original_filename || file.name,
      },
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Lỗi tải tệp" };
  }
}

export async function uploadCloudinaryAsset(
  file: File,
  folder = "thanhphat",
): Promise<{ result?: CloudinaryUploadResult; error?: string }> {
  const resourceType = resourceTypeForFile(file);
  const maxBytes = resourceType === "video" ? 100 * 1024 * 1024 : 25 * 1024 * 1024;
  if (file.size <= 0 || file.size > maxBytes) {
    return {
      error: resourceType === "video"
        ? "Dung lượng video phải lớn hơn 0 và không vượt quá 100 MB."
        : "Dung lượng tệp phải lớn hơn 0 và không vượt quá 25 MB.",
    };
  }
  return signedUpload(file, folder, resourceType);
}

const MAX_IMAGE_SIDE = 1920;

/** Thu nhỏ ảnh (cạnh dài ≤ 1920px, JPEG 0.85) trước khi tải để upload nhanh hơn nhiều. Lỗi/không lợi thì dùng ảnh gốc. */
async function shrinkImage(file: File): Promise<File> {
  // ponytail: bỏ qua gif/svg (mất hoạt ảnh/vector); ảnh nhỏ sẵn thì giữ nguyên.
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || file.size < 300 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function uploadToCloudinary(
  file: File,
  folder = "thanhphat",
): Promise<{ result?: CloudinaryUploadResult; error?: string }> {
  if (!file.type.startsWith("image/")) return { error: "Chỉ hỗ trợ tải file ảnh." };
  if (file.size > 15 * 1024 * 1024) return { error: "Dung lượng ảnh không vượt quá 15 MB." };
  return signedUpload(await shrinkImage(file), folder, "image");
}

export async function deleteCloudinaryAsset(
  publicId: string,
  resourceType: CloudinaryResourceType = "image",
): Promise<boolean> {
  if (!publicId) return true;
  try {
    const encoded = encodeURIComponent(publicId);
    const res = await fetch(`/api/cloudinary/${encoded}?resourceType=${resourceType}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
