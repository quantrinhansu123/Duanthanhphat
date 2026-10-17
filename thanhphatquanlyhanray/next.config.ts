import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const appRoot = path.dirname(fileURLToPath(import.meta.url));
/** App chính quan-ly-nhan-su được phép nhúng iframe (dev + prod). */
const parentOrigins = (
  process.env.NEXT_PUBLIC_PARENT_FRAME_ORIGINS ??
  "http://localhost:3010 http://127.0.0.1:3010"
)
  .split(/[\s,]+/)
  .map((v) => v.trim())
  .filter(Boolean)
  .join(" ");

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  `frame-ancestors 'self' ${parentOrigins}`,
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  // Tránh Turbopack lấy nhầm package-lock ở thư mục cha monorepo → CSS/UI lệch.
  turbopack: {
    root: appRoot,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
