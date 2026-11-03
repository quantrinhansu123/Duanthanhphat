import type { MetadataRoute } from "next";

/** Khi lưu trang vào màn hình chính / cài ứng dụng: dùng logo và tên công ty thay cho chữ cái mặc định. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hệ thống Quản lý hàn ray · Công ty cổ phần công trình Thành Phát",
    short_name: "Thành Phát",
    description: "Hệ thống Quản lý hàn ray — Rail Welding Management System",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1e3a7a",
    icons: [
      { src: "/logo.png", sizes: "256x256", type: "image/png", purpose: "any" },
    ],
  };
}
