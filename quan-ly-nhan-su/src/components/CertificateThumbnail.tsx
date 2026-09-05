"use client";

import type { Certificate } from "@/data/certificates";

type CertificateThumbnailProps = {
  cert: Certificate;
  className?: string;
};

function ThumbFrame({
  children,
  bg,
  border,
}: {
  children: React.ReactNode;
  bg: string;
  border: string;
}) {
  return (
    <svg viewBox="0 0 140 88" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="140" height="88" fill={bg} />
      <rect x="4" y="4" width="132" height="80" rx="3" fill="#fff" stroke={border} strokeWidth="1.5" />
      {children}
    </svg>
  );
}

export default function CertificateThumbnail({ cert, className = "" }: CertificateThumbnailProps) {
  if (cert.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={cert.imageUrl} alt={cert.title} className={`h-full w-full object-cover ${className}`} />
    );
  }

  const key = cert.imageKey;

  if (key === "welding-1") {
    return (
      <div className={`h-full w-full ${className}`}>
        <ThumbFrame bg="#eef4ff" border="#c9a227">
          <circle cx="70" cy="22" r="10" fill="none" stroke="#c9a227" strokeWidth="1.2" />
          <text x="70" y="40" textAnchor="middle" fontSize="7" fill="#0f172a" fontWeight="700">
            CHỨNG CHỈ
          </text>
          <text x="70" y="50" textAnchor="middle" fontSize="5" fill="#0047AB">
            THỢ HÀN HẠNG 1
          </text>
          <text x="70" y="62" textAnchor="middle" fontSize="5.5" fill="#334155">
            UIC60
          </text>
          <rect x="48" y="68" width="44" height="8" rx="2" fill="#0047AB" opacity="0.15" />
        </ThumbFrame>
      </div>
    );
  }

  if (key === "machine") {
    return (
      <div className={`h-full w-full ${className}`}>
        <ThumbFrame bg="#0a254f" border="#c9a227">
          <text x="70" y="38" textAnchor="middle" fontSize="6.5" fill="#fff" fontWeight="700">
            MÁY HÀN K920
          </text>
          <text x="70" y="50" textAnchor="middle" fontSize="5" fill="#93b4e8">
            Vận hành máy
          </text>
          <circle cx="70" cy="68" r="10" fill="none" stroke="#c9a227" strokeWidth="1.2" />
          <text x="70" y="70" textAnchor="middle" fontSize="5" fill="#c9a227" fontWeight="700">
            OK
          </text>
        </ThumbFrame>
      </div>
    );
  }

  if (key === "ndt") {
    return (
      <div className={`h-full w-full ${className}`}>
        <ThumbFrame bg="#faf8f2" border="#1e3a5f">
          <text x="70" y="36" textAnchor="middle" fontSize="6.5" fill="#1e3a5f" fontWeight="700">
            NDT · UT
          </text>
          <text x="70" y="48" textAnchor="middle" fontSize="5" fill="#b8860b">
            Kiểm tra siêu âm
          </text>
          <rect x="55" y="58" width="30" height="14" rx="2" fill="#1e3a5f" />
          <text x="70" y="68" textAnchor="middle" fontSize="5.5" fill="#fff" fontWeight="700">
            NDT
          </text>
        </ThumbFrame>
      </div>
    );
  }

  if (key === "safety") {
    return (
      <div className={`h-full w-full ${className}`}>
        <ThumbFrame bg="#fff7ed" border="#ea580c">
          <polygon points="70,18 78,34 95,34 82,44 87,60 70,51 53,60 58,44 45,34 62,34" fill="#ea580c" />
          <text x="70" y="72" textAnchor="middle" fontSize="5.5" fill="#9a3412" fontWeight="700">
            AN TOÀN LĐ
          </text>
        </ThumbFrame>
      </div>
    );
  }

  if (key === "welding-2") {
    return (
      <div className={`h-full w-full ${className}`}>
        <ThumbFrame bg="#f0fdf4" border="#15803d">
          <text x="70" y="38" textAnchor="middle" fontSize="6.5" fill="#14532d" fontWeight="700">
            CHỨNG CHỈ
          </text>
          <text x="70" y="50" textAnchor="middle" fontSize="5" fill="#15803d">
            THỢ HÀN HẠNG 2
          </text>
          <text x="70" y="62" textAnchor="middle" fontSize="5.5" fill="#166534">
            P50 / P43
          </text>
        </ThumbFrame>
      </div>
    );
  }

  if (key === "iso") {
    return (
      <div className={`h-full w-full ${className}`}>
        <ThumbFrame bg="#f8fafc" border="#0f172a">
          <text x="70" y="36" textAnchor="middle" fontSize="5" fill="#64748b" letterSpacing="1">
            ISO 9606
          </text>
          <text x="70" y="50" textAnchor="middle" fontSize="6" fill="#0f172a" fontWeight="700">
            Welding
          </text>
          <rect x="50" y="58" width="40" height="12" rx="2" fill="#eef4ff" stroke="#0047AB" strokeWidth="0.8" />
          <text x="70" y="67" textAnchor="middle" fontSize="5" fill="#0047AB" fontWeight="700">
            ISO
          </text>
        </ThumbFrame>
      </div>
    );
  }

  return (
    <div className={`h-full w-full ${className}`}>
      <ThumbFrame bg="#eef2f8" border="#0047AB">
        <text x="70" y="40" textAnchor="middle" fontSize="6" fill="#0047AB" fontWeight="700">
          CHỨNG CHỈ
        </text>
        <text x="70" y="54" textAnchor="middle" fontSize="5" fill="#64748b">
          Thành Phát
        </text>
      </ThumbFrame>
    </div>
  );
}
