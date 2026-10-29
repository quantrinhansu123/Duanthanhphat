import { normalizeWeldQualityStatus } from "@/lib/weldQuality";

export default function WeldQualityBadge({ status }: { status?: string | null }) {
  const normalized = normalizeWeldQualityStatus(status) ?? status ?? "Chưa tải";
  const color =
    normalized === "Đạt" || normalized === "Nghiệm thu đạt"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : normalized === "Không đạt"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : normalized === "Chờ mài" ||
            normalized === "Chờ siêu âm và nghiệm thu" ||
            normalized === "Chờ thí nghiệm" ||
            normalized === "Chờ ký biên bản" ||
            normalized === "Chờ nghiệm thu" ||
            normalized === "Sửa chữa/khắc phục"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${color}`}>
      {normalized}
    </span>
  );
}
