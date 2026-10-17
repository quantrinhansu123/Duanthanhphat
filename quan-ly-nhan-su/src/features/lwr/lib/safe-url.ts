import { STRUCTURE_BUCKET, supabase } from "@lwr/lib/supabase";
import { STRUCTURE_PRESETS } from "@lwr/lib/structure-presets";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Allow our storage images and local raster uploads; block arbitrary external URLs. */
export function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (STRUCTURE_PRESETS.some((preset) => preset.image_url === url)) return url;
  if (url.startsWith("blob:")) return url;
  if (!supabase && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(url)) return url;
  try {
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const u = new URL(url);
    const ok =
      u.protocol === "https:" &&
      u.origin === base.origin &&
      u.pathname.startsWith(`/storage/v1/object/public/${STRUCTURE_BUCKET}/`);
    return ok ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Returns an error message, or null when the file is an acceptable raster image. */
export function validateImage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Chỉ chấp nhận ảnh PNG, JPG, WEBP hoặc GIF.";
  if (file.size > MAX_IMAGE_BYTES) return "Ảnh quá lớn (tối đa 5MB).";
  return null;
}
