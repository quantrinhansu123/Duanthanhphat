import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Mở app bằng điện thoại qua IP mạng LAN (vd http://192.168.x.x:3010): nếu không khai báo, Next dev chặn (403) các file JS nên trang không tải được. */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  experimental: {
    optimizePackageImports: [
      "@phosphor-icons/react",
      "xlsx",
      "leaflet",
      "react-leaflet",
      "@react-google-maps/api",
    ],
  },
  /** Route cũ của app LWR đứng riêng → tab trong quan-ly-nhan-su. */
  async redirects() {
    return [
      { source: "/cong-trinh", destination: "/lwr-cong-trinh", permanent: false },
      { source: "/giai-toa-ung-suat", destination: "/lwr-giai-toa-ung-suat", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "randomuser.me",
        pathname: "/api/portraits/**",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
        pathname: "/api/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ssgwccxdcpejyytmfarc.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
