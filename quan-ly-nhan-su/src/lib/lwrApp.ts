/** URL app `thanhphatquanlyhanray` (LWR / CWR). Mặc định cổng 3000 khi chạy local. */
export function lwrAppBaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_LWR_APP_URL ?? "http://localhost:3000").trim();
  return raw.replace(/\/+$/, "");
}

export type LwrModulePath = "/" | "/giai-toa-ung-suat" | "/cong-trinh";

/** URL module LWR — bản full (có sidebar + layout gốc), không cắt embed. */
export function lwrModuleUrl(path: LwrModulePath) {
  const base = lwrAppBaseUrl();
  return path === "/" ? `${base}/` : `${base}${path}`;
}

/** @deprecated dùng lwrModuleUrl */
export function lwrEmbedUrl(path: LwrModulePath) {
  return lwrModuleUrl(path);
}
