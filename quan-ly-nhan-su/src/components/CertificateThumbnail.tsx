"use client";

import type { Certificate } from "@/data/certificates";

type CertificateThumbnailProps = {
  cert: Certificate;
  className?: string;
  showLogo?: boolean;
};

/**
 * Lựa chọn ảnh chứng chỉ sắc nét, chân thực theo loại chứng chỉ và mã máy.
 */
export function resolveCertificateImageUrl(cert?: {
  title?: string;
  imageKey?: string;
  imageUrl?: string;
}): string {
  if (cert?.imageUrl && cert.imageUrl.trim()) {
    return cert.imageUrl.trim();
  }
  const title = (cert?.title || "").toLowerCase();
  const key = cert?.imageKey || "";

  // 1. Máy hàn (K922, K920, UN5, vận hành máy)
  if (
    key === "machine" ||
    title.includes("k922") ||
    title.includes("k920") ||
    title.includes("un5") ||
    title.includes("van hanh") ||
    title.includes("vận hành")
  ) {
    return "/chung-chi/cert-machine-op.jpg";
  }

  // 2. Hàn nhôm nhiệt (Railtech, Thermit, Aluminothermic)
  if (
    title.includes("thermit") ||
    title.includes("railtech") ||
    title.includes("aluminothermic") ||
    title.includes("nhom nhiet") ||
    title.includes("nhôm nhiệt")
  ) {
    return "/chung-chi/cert-thermit-rail.jpg";
  }

  // 3. NDT kiểm tra siêu âm mối hàn
  if (
    key === "ndt" ||
    title.includes("ndt") ||
    title.includes("sieu am") ||
    title.includes("siêu âm")
  ) {
    return "/chung-chi/cert-ndt-testing.jpg";
  }

  // 4. An toàn lao động
  if (
    key === "safety" ||
    title.includes("an toan") ||
    title.includes("an toàn") ||
    title.includes("nhom 3") ||
    title.includes("nhóm 3")
  ) {
    return "/chung-chi/cert-safety-work.jpg";
  }

  // 5. ISO 9606
  if (key === "iso" || title.includes("iso")) {
    return "/chung-chi/cert-iso-qual.jpg";
  }

  // 6. Thợ hàn ray, hàn Flash-Butt, UIC60, P50, P43
  if (
    key === "welding-1" ||
    key === "welding-2" ||
    title.includes("tho han") ||
    title.includes("thợ hàn") ||
    title.includes("uic") ||
    title.includes("p50") ||
    title.includes("p43") ||
    title.includes("flash")
  ) {
    return "/chung-chi/cert-welding-rail.jpg";
  }

  return "/chung-chi/cert-welding-rail.jpg";
}

export default function CertificateThumbnail({
  cert,
  className = "",
  showLogo = true,
}: CertificateThumbnailProps) {
  const imgSrc = resolveCertificateImageUrl(cert);

  return (
    <div className={`relative h-full w-full overflow-hidden select-none bg-slate-100 group ${className}`}>
      {/* Ảnh chứng chỉ sắc nét chuẩn quốc tế */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc}
        alt={cert.title}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-103"
        loading="lazy"
      />

      {/* Logo và thương hiệu Thành Phát chính thức trên chứng chỉ */}
      {showLogo && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-md bg-white/95 backdrop-blur-md px-2 py-0.5 shadow-xs border border-amber-300/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Thành Phát" className="h-4 w-4 object-contain" />
          <span className="text-[10px] font-extrabold text-[#0047AB] tracking-wide uppercase font-sans">
            Thành Phát
          </span>
        </div>
      )}

      {/* Nhãn số hiệu chứng chỉ hoặc tên người sở hữu ở góc dưới */}
      <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-md bg-slate-950/80 backdrop-blur-xs px-2 py-0.5 text-[10px] font-mono text-white/95 shadow-xs">
        <span className="text-amber-400 font-bold">★</span>
        <span className="truncate max-w-[130px]">
          {cert.certificateNumber || cert.holder || "CHỨNG NHẬN"}
        </span>
      </div>
    </div>
  );
}
