/**
 * Logo chữ của công ty, ba dòng:
 *   CÔNG TY CỔ PHẦN CÔNG TRÌNH
 *   THÀNH PHÁT
 *   CONSTRUCTION WORK JOINT STOCK COMPANY
 * Dùng thay cho mọi chỗ ghi tên thương hiệu rời ("Thành Phát") để đồng nhất một dạng.
 */
const SIZES = {
  sm: { kicker: "text-[7px] tracking-[0.04em]", name: "text-[17px] tracking-[0.1em]", sub: "text-[5.6px] tracking-[0.02em]", gap: "gap-[2px]" },
  md: { kicker: "text-[10px] tracking-[0.05em]", name: "text-[26px] tracking-[0.1em]", sub: "text-[8px] tracking-[0.03em]", gap: "gap-[3px]" },
  lg: { kicker: "text-[13px] sm:text-[15px] tracking-[0.05em]", name: "text-[30px] sm:text-[40px] tracking-[0.1em]", sub: "text-[9.5px] sm:text-[11px] tracking-[0.03em]", gap: "gap-1" },
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
    <div className={`flex flex-col ${s.gap} whitespace-nowrap leading-none ${className}`} lang="vi">
      <span className={`font-bold ${s.kicker} ${t.kicker}`}>CÔNG TY CỔ PHẦN CÔNG TRÌNH</span>
      <span className={`font-black ${s.name} ${t.name}`}>THÀNH PHÁT</span>
      <span className={`font-bold ${s.sub} ${t.sub}`}>CONSTRUCTION WORK JOINT STOCK COMPANY</span>
    </div>
  );
}
