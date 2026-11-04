import { uploadCloudinaryAsset } from "@/lib/cloudinaryClient";
export type SignatureKey = "chi-huy-truong" | "nha-thau-phu" | "gach-trang-tri";
export type SignatureStore = Partial<Record<SignatureKey, string>>;

export async function loadRfiSignatures(): Promise<SignatureStore> {
  const res = await fetch("/api/rfi-signatures", { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${body.error ?? "Không tải được chữ ký"} (HTTP ${res.status})`);
  return (body as { signatures?: SignatureStore }).signatures ?? {};
}

export async function saveRfiSignature(key: SignatureKey, dataUrl: string | null): Promise<SignatureStore> {
  const res = await fetch("/api/rfi-signatures", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, dataUrl }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Không lưu được chữ ký.");
  return body.signatures ?? {};
}

/** Tải ảnh chữ ký lên Cloudinary (1 lần), trả về đường dẫn để lưu dùng lại. */
export async function uploadSignatureImage(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Chọn ảnh PNG hoặc JPG.");
  const { result, error } = await uploadCloudinaryAsset(file, "thanhphat/signatures");
  if (!result?.secure_url) throw new Error(error ?? "Không tải được ảnh lên Cloudinary.");
  return result.secure_url;
}
