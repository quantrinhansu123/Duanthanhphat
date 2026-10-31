"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const WeldAcceptanceWorkflow = dynamic(() => import("@/components/WeldAcceptanceWorkflow"), { ssr: false });
const DailyWorkReport = dynamic(() => import("@/components/DailyWorkReport"), { ssr: false });
const ConstructionDiaryForm = dynamic(() => import("@/components/ConstructionDiary"), { ssr: false });

export default function WeldAcceptanceReport() {
  const [tab, setTab] = useState<"quy-trinh" | "nhat-ky" | "nhat-ky-ngay">("quy-trinh");
  return <>
    <div className="no-print flex flex-wrap gap-2 px-4 sm:px-6 pb-3">
      {([["quy-trinh", "RFI & Nghiệm thu"], ["nhat-ky", "Báo cáo ngày"], ["nhat-ky-ngay", "Nhật ký dự án"]] as const).map(([id, label]) => (
        <button key={id} type="button" onClick={() => setTab(id)}
          className={`min-h-11 rounded-lg px-4 text-xs font-semibold sm:text-sm ${tab === id ? "bg-[#0047AB] text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
          {label}
        </button>
      ))}
    </div>
    {tab === "nhat-ky-ngay" ? <ConstructionDiaryForm /> : tab === "nhat-ky" ? <DailyWorkReport /> : <WeldAcceptanceWorkflow />}
  </>;
}
