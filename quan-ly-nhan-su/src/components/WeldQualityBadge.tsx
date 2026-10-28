import type { WeldQualityStatus } from "@/lib/weldQuality";

export default function WeldQualityBadge({ status }: { status?: WeldQualityStatus }) {
  const color = status === "Nghiệm thu đạt" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
    status === "Không đạt" ? "border-rose-200 bg-rose-50 text-rose-800" :
      status === "Chờ mài" || status === "Chờ thí nghiệm" || status === "Chờ nghiệm thu" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${color}`}>{status ?? "Chưa tải chất lượng"}</span>;
}
