"use client";

import { useId } from "react";
import type { Certificate, CertificateImageKey } from "@/data/certificates";

type CertificateThumbnailProps = {
  cert: Certificate;
  className?: string;
};

type CertificateTheme = {
  accent: string;
  soft: string;
  label: string;
};

const BORDER_ASSET = "/chung-chi/certificate-border-gold.png";

const themes: Record<CertificateImageKey, CertificateTheme> = {
  "welding-1": {
    accent: "#0047ab",
    soft: "#dbeafe",
    label: "NĂNG LỰC HÀN RAY · HẠNG 1",
  },
  "welding-2": {
    accent: "#0f766e",
    soft: "#ccfbf1",
    label: "NĂNG LỰC HÀN RAY · HẠNG 2",
  },
  machine: {
    accent: "#173f77",
    soft: "#dbeafe",
    label: "VẬN HÀNH THIẾT BỊ HÀN RAY",
  },
  ndt: {
    accent: "#6d28d9",
    soft: "#ede9fe",
    label: "KIỂM TRA KHÔNG PHÁ HỦY · NDT",
  },
  safety: {
    accent: "#c2410c",
    soft: "#ffedd5",
    label: "AN TOÀN, VỆ SINH LAO ĐỘNG",
  },
  iso: {
    accent: "#0369a1",
    soft: "#e0f2fe",
    label: "TIÊU CHUẨN NĂNG LỰC · ISO",
  },
  default: {
    accent: "#0047ab",
    soft: "#dbeafe",
    label: "CHỨNG NHẬN NĂNG LỰC CHUYÊN MÔN",
  },
};

function wrapText(value: string, maxCharacters: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharacters || !current) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  if (current && lines.length < maxLines) lines.push(current);

  const consumed = lines.join(" ").length;
  if (consumed < value.trim().length && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?]?$/, "")}…`;
  }

  return lines;
}

function displayValue(value?: string, fallback = "Chưa cập nhật") {
  const normalized = value?.trim();
  return normalized && normalized !== "—" ? normalized : fallback;
}

function UploadedCertificate({ cert, className }: CertificateThumbnailProps) {
  return (
    <div className={`group relative h-full w-full overflow-hidden bg-slate-100 ${className || ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cert.imageUrl}
        alt={`Chứng chỉ ${cert.title} của ${cert.holder}`}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        loading="lazy"
      />
      <div className="absolute left-[3%] top-[4%] flex max-w-[66%] items-center gap-[clamp(3px,0.7vw,7px)] rounded-md border border-amber-300/70 bg-white/95 px-[clamp(4px,1vw,9px)] py-[clamp(2px,0.5vw,5px)] shadow-sm backdrop-blur-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-[clamp(14px,3.3vw,30px)] w-[clamp(14px,3.3vw,30px)] object-contain" />
        <span className="truncate text-[clamp(7px,1.25vw,12px)] font-extrabold uppercase tracking-wide text-[#173f77]">
          Công ty CP Thành Phát
        </span>
      </div>
      <div className="absolute inset-x-[3%] bottom-[4%] rounded-md border border-white/20 bg-slate-950/80 px-[clamp(5px,1.2vw,11px)] py-[clamp(3px,0.7vw,7px)] text-white shadow-md backdrop-blur-sm">
        <div className="truncate text-[clamp(8px,1.45vw,14px)] font-bold uppercase tracking-wide">
          {displayValue(cert.holder)}
        </div>
        <div className="mt-px truncate text-[clamp(6px,1vw,10px)] text-slate-200">
          {cert.employeeCode ? `${cert.employeeCode} · ` : ""}{cert.title}
        </div>
      </div>
    </div>
  );
}

function GeneratedCertificate({ cert, className }: CertificateThumbnailProps) {
  const instanceId = useId().replace(/:/g, "");
  const paperGradientId = `certificate-paper-${instanceId}`;
  const sealGradientId = `certificate-seal-${instanceId}`;
  const watermarkId = `certificate-watermark-${instanceId}`;
  const theme = themes[cert.imageKey] || themes.default;
  const title = cert.title.replace(/^chứng\s*chỉ\s*/i, "").trim() || cert.title;
  const titleLines = wrapText(title, 49, 2);
  const holder = displayValue(cert.holder).toLocaleUpperCase("vi-VN");
  const holderFontSize = holder.length > 34 ? 21 : holder.length > 25 ? 24 : 28;
  const certificateNumber = displayValue(cert.certificateNumber || cert.employeeCode, "—");

  return (
    <div className={`h-full w-full overflow-hidden bg-[#f8f4e8] ${className || ""}`}>
      <svg
        viewBox="0 0 800 500"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={`Chứng chỉ ${cert.title} của ${cert.holder}`}
      >
        <defs>
          <linearGradient id={paperGradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fffef9" />
            <stop offset="0.55" stopColor="#fdfaf0" />
            <stop offset="1" stopColor="#f4ead3" />
          </linearGradient>
          <radialGradient id={sealGradientId} cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#f8e7a2" />
            <stop offset="0.45" stopColor="#d4af37" />
            <stop offset="1" stopColor="#8f6806" />
          </radialGradient>
          <pattern id={watermarkId} width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 16h32M16 0v32" stroke={theme.accent} strokeWidth="0.55" opacity="0.12" />
          </pattern>
        </defs>

        <rect width="800" height="500" fill="#102d55" />
        <rect x="19" y="19" width="762" height="462" rx="5" fill={`url(#${paperGradientId})`} />
        <rect x="61" y="61" width="678" height="378" fill={`url(#${watermarkId})`} opacity="0.2" />
        <path d="M61 61h678v44c-142 32-289 35-443 8C207 97 129 89 61 99Z" fill={theme.soft} opacity="0.62" />
        <path d="M61 401c126-25 245-21 357 2 115 24 222 26 321 1v35H61Z" fill={theme.accent} opacity="0.08" />

        {/* Public-domain A4 landscape border: Openclipart artwork 302666. */}
        <image href={BORDER_ASSET} x="0" y="0" width="800" height="500" preserveAspectRatio="none" />

        <image href="/logo.png" x="75" y="56" width="61" height="61" preserveAspectRatio="xMidYMid meet" />
        <text x="149" y="77" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="800" fill="#173f77">
          CÔNG TY CỔ PHẦN THÀNH PHÁT
        </text>
        <text x="149" y="98" fontFamily="Arial, sans-serif" fontSize="9.5" fontWeight="600" fill="#64748b" letterSpacing="1.7">
          THANH PHAT JOINT STOCK COMPANY
        </text>

        <rect x="541" y="65" width="187" height="34" rx="17" fill={theme.soft} stroke={theme.accent} strokeWidth="1" />
        <text x="634.5" y="86" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="9.5" fontWeight="800" fill={theme.accent} letterSpacing="0.65">
          {theme.label}
        </text>

        <line x1="75" y1="122" x2="725" y2="122" stroke="#c6a23c" strokeWidth="1.5" />
        <text x="400" y="162" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="31" fontWeight="700" fill="#132f55" letterSpacing="2.5">
          CHỨNG NHẬN
        </text>
        <text x="400" y="184" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" fill={theme.accent} letterSpacing="3.2">
          CERTIFICATE OF QUALIFICATION
        </text>

        <text x="400" y="216" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" fill="#64748b" letterSpacing="1.5">
          TRÂN TRỌNG CHỨNG NHẬN
        </text>
        <text x="400" y="253" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize={holderFontSize} fontWeight="700" fill="#0f172a">
          {holder}
        </text>
        <path d="M225 263c109 9 241 9 350 0" fill="none" stroke="#d4af37" strokeWidth="1.4" />

        <text x="400" y="291" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" fill="#64748b">
          Đã hoàn thành yêu cầu chuyên môn và được cấp
        </text>
        {titleLines.map((line, index) => (
          <text
            key={`${line}-${index}`}
            x="400"
            y={319 + index * 22}
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontSize="15"
            fontWeight="750"
            fill={theme.accent}
          >
            {line}
          </text>
        ))}

        <g transform="translate(117 351)">
          <text x="76" y="0" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="700" fill="#64748b" letterSpacing="1">
            ĐẠI DIỆN ĐƠN VỊ
          </text>
          <path d="M12 31c35-12 83-12 128 0" fill="none" stroke="#94a3b8" strokeWidth="1" />
          <text x="76" y="48" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="9.5" fontWeight="700" fill="#334155">
            CÔNG TY CP THÀNH PHÁT
          </text>
        </g>

        <g transform="translate(603 333)">
          <circle cx="50" cy="50" r="44" fill={`url(#${sealGradientId})`} />
          <circle cx="50" cy="50" r="35" fill="#fff9df" stroke="#fff3bf" strokeWidth="2" />
          <circle cx="50" cy="50" r="28" fill="none" stroke={theme.accent} strokeWidth="1.5" strokeDasharray="2.5 2.5" />
          <image href="/logo.png" x="28" y="20" width="44" height="44" preserveAspectRatio="xMidYMid meet" />
          <text x="50" y="77" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="7.5" fontWeight="800" fill={theme.accent}>
            THÀNH PHÁT
          </text>
        </g>

        <line x1="76" y1="420" x2="724" y2="420" stroke="#d8c58a" strokeWidth="0.9" />
        <text x="90" y="443" fontFamily="Arial, sans-serif" fontSize="8.5" fontWeight="700" fill="#94a3b8" letterSpacing="0.8">
          SỐ CHỨNG CHỈ
        </text>
        <text x="90" y="460" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="700" fill="#334155">
          {certificateNumber}
        </text>
        <text x="342" y="443" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="8.5" fontWeight="700" fill="#94a3b8" letterSpacing="0.8">
          NGÀY CẤP
        </text>
        <text x="342" y="460" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="700" fill="#334155">
          {displayValue(cert.issuedAt, "—")}
        </text>
        <text x="508" y="443" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="8.5" fontWeight="700" fill="#94a3b8" letterSpacing="0.8">
          HIỆU LỰC ĐẾN
        </text>
        <text x="508" y="460" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="700" fill="#334155">
          {displayValue(cert.expiresAt, "—")}
        </text>
        <text x="707" y="453" textAnchor="end" fontFamily="Arial, sans-serif" fontSize="8.5" fontWeight="700" fill="#94a3b8">
          {cert.employeeCode || "THÀNH PHÁT · TCW"}
        </text>
      </svg>
    </div>
  );
}

export default function CertificateThumbnail(props: CertificateThumbnailProps) {
  return props.cert.imageUrl ? <UploadedCertificate {...props} /> : <GeneratedCertificate {...props} />;
}
