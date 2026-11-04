export type SignatureKey = "chi-huy-truong" | "nha-thau-phu" | "gach-trang-tri";
export type SignatureStore = Partial<Record<SignatureKey, string>>;

export async function loadRfiSignatures(): Promise<SignatureStore> {
  try {
    const res = await fetch("/api/rfi-signatures", { cache: "no-store" });
    if (!res.ok) return {};
    return ((await res.json()) as { signatures?: SignatureStore }).signatures ?? {};
  } catch { return {}; }
}

export async function saveRfiSignature(key: SignatureKey, dataUrl: string | null): Promise<SignatureStore> {
  const res = await fetch("/api/rfi-signatures", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, dataUrl }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Không lưu được chữ ký.");
  return body.signatures ?? {};
}

/** Thu nhỏ ảnh (tối đa 480×200) và nén JPEG để lưu gọn. */
export function fileToSignatureDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { reject(new Error("Chọn ảnh PNG hoặc JPG.")); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 480 / img.width, 200 / img.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("Trình duyệt không xử lý được ảnh.")); return; }
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); // JPEG không có nền trong suốt
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Không đọc được ảnh.")); };
    img.src = url;
  });
}
