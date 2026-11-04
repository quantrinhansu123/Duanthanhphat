/**
 * Logo chữ của công ty, ba dòng:
 *   CÔNG TY CỔ PHẦN CÔNG TRÌNH
 *   THÀNH PHÁT
 *   CONSTRUCTION WORK JOINT STOCK COMPANY
 * Dùng thay cho mọi chỗ ghi tên thương hiệu rời ("Thành Phát") để đồng nhất một dạng.
 */
const SIZES = {
  sm: { kicker: "text-[9px] sm:text-[9.5px] tracking-[0.05em]", name: "text-[18px] sm:text-[19px] tracking-[0.06em]", sub: "text-[6.5px] sm:text-[7px] tracking-[0.03em]", gap: "gap-[2.5px]" },
  md: { kicker: "text-[9px] sm:text-[10px] tracking-[0.04em]", name: "text-[20px] sm:text-[22px] tracking-[0.08em]", sub: "text-[6.5px] sm:text-[7.5px] tracking-[0.02em]", gap: "gap-[2px]" },
  lg: { kicker: "text-[11px] sm:text-[13px] tracking-[0.04em]", name: "text-[24px] sm:text-[28px] tracking-[0.08em]", sub: "text-[8px] sm:text-[9px] tracking-[0.02em]", gap: "gap-[3px]" },
} as const;

const TONES = {
  /** Nền sáng: xanh đậm như logo. */
  dark: { kicker: "text-[#173f77]", name: "text-[#173f77]", sub: "text-[#173f77]" },
  /** Nền tối (thanh bên). */
  light: { kicker: "text-blue-100", name: "text-white", sub: "text-blue-200" },
} as const;

export default function BrandLockup({
  size = "md",
  tone = "dark",
  className = "",
}: {
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const s = SIZES[size];
  const t = TONES[tone];
  return (
    <div className={`flex min-w-0 flex-col ${s.gap} leading-none ${className}`} lang="vi">
      <span className={`truncate font-bold whitespace-nowrap ${s.kicker} ${t.kicker}`}>CÔNG TY CỔ PHẦN CÔNG TRÌNH</span>
      <span className={`font-black whitespace-nowrap ${s.name} ${t.name}`}>THÀNH PHÁT</span>
      <span className={`font-bold leading-tight ${s.sub} ${t.sub}`}>CONSTRUCTION WORK JOINT STOCK COMPANY</span>
    </div>
  );
}
