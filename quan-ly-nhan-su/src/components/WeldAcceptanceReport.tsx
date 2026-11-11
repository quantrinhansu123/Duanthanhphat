"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const WeldAcceptanceWorkflow = dynamic(() => import("@/components/WeldAcceptanceWorkflow"), { ssr: false });
const ConstructionDiaryForm = dynamic(() => import("@/components/ConstructionDiary"), { ssr: false });

export default function WeldAcceptanceReport() {
  const [tab, setTab] = useState<"quy-trinh" | "nhat-ky-ngay">("quy-trinh");
  return <>
    <div className="no-print grid grid-cols-2 gap-2 px-4 sm:px-6 pb-3">
      {([["quy-trinh", "RFI & Nghiệm thu"], ["nhat-ky-ngay", "Nhật ký dự án"]] as const).map(([id, label]) => (
        <button key={id} type="button" onClick={() => setTab(id)}
          className={`min-h-11 w-full rounded-lg px-1.5 py-2 text-center text-[11px] font-semibold leading-tight sm:px-3 sm:text-sm ${tab === id ? "bg-[#0047AB] text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
          {label}
        </button>
      ))}
    </div>
    {tab === "nhat-ky-ngay" ? <ConstructionDiaryForm /> : <WeldAcceptanceWorkflow />}
  </>;
}
