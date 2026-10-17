"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { detailForCell } from "@lwr/lib/track-data";
import type { RailCell } from "@lwr/types/track";
import { PanelTabs } from "./PanelTabs";
import { ChartSkeleton } from "./ChartSkeleton";

/** Chart is browser-only: loaded dynamically to avoid SSR/hydration issues. */
const ForceChart = dynamic(() => import("./ForceChart").then((m) => m.ForceChart), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

const TABS = ["Thông tin", "Tính toán", "Thi công", "Hồ sơ"];

interface DetailPanelProps {
  cell: RailCell;
  onPrev?: () => void;
  onNext?: () => void;
}

/** Detail panel for one selected rail segment: inputs, results, force chart. */
export function DetailPanel({ cell, onPrev, onNext }: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState("Tính toán");
  const detail = detailForCell(cell);
  const hot = cell.temp > 40;
  const sign = detail.deltaT >= 0 ? "+" : "";
  const mode = detail.deltaT >= 0 ? "kéo" : "nén";

  const inputRows: [string, string, string, string][] = [
    ["Chiều dài ray", "500 m", "Diện tích tiết diện (A)", "7.611 × 10⁻³ m²"],
    ["Nhiệt độ trung hòa (Tn)", "35 °C", "Mô đun đàn hồi (E)", "2.11 × 10⁸ kN/m²"],
    ["Nhiệt độ thi công (Tmax)", `${cell.temp} °C`, "Hệ số giãn nở nhiệt (α)", "1.15 × 10⁻⁵ / °C"],
    ["Chênh nhiệt độ (ΔT)", `${sign}${detail.deltaT} °C`, "Sức cản dọc đơn vị (r)", "24 kN/m/ray"],
  ];

  const resultRows: [string, string][] = [
    ["Lực nén/kéo lớn nhất |P|max", `+${detail.force} kN (${mode})`],
    ["Chiều dài vùng thở Lb (mỗi đầu)", "4.62 m"],
    ["Chiều dài vùng trung tâm Lc", "490.76 m"],
    ["Chuyển vị đầu ray |u₀|", "0.26 mm"],
    ["Độ giãn dài cần kích ΔL", "26.6 mm"],
  ];

  return (
    <aside className="flex flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-4 pt-3">
        <h3 className="text-[16px] font-bold text-slate-900">{cell.id}</h3>
        <span className="text-[12px] text-slate-500">({detail.title})</span>
        {hot && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
            <TriangleAlert className="h-3.5 w-3.5" /> Nhiệt độ cao
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 px-4 pt-1.5">
        <p className="text-[12.5px] text-slate-500">
          Lý trình <span className="font-semibold text-slate-800">Km {cell.from} – {cell.to} (500 m)</span>
        </p>
        <div className="ml-auto flex gap-1">
          <button onClick={onPrev} className="rounded-md border border-slate-200 p-1 text-slate-500 hover:text-slate-800" aria-label="Đoạn trước">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={onNext} className="rounded-md border border-slate-200 p-1 text-slate-500 hover:text-slate-800" aria-label="Đoạn tiếp">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <PanelTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div className="space-y-3 px-4 py-3">
        <p className="rounded-md bg-blue-50 p-2 text-xs text-blue-800">
          Số liệu và biểu đồ bên dưới là mô phỏng tổng quan. <Link href="/giai-toa-ung-suat" className="font-semibold underline">Mở bảng tính theo Excel R2</Link> để nhập thông số và tính giải toả.
        </p>
        <section>
          <h4 className="text-[13px] font-bold text-slate-900">Thông số đầu vào</h4>
          <dl className="mt-1.5 space-y-1.5">
            {inputRows.map(([k1, v1, k2, v2]) => (
              <div key={k1} className="grid grid-cols-[1fr_auto_1fr_auto] items-baseline gap-x-2 text-[11.5px]">
                <dt className="text-slate-500">{k1}</dt>
                <dd className={`font-semibold ${k1.includes("Chênh") ? "text-red-600" : "text-slate-800"}`}>{v1}</dd>
                <dt className="text-slate-500">{k2}</dt>
                <dd className="text-right font-semibold text-slate-800">{v2}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-lg bg-slate-50 p-2.5">
          <h4 className="text-[13px] font-bold text-blue-700">Kết quả tính toán</h4>
          <dl className="mt-1.5 space-y-1.5 text-[12px]">
            {resultRows.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-2">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-semibold text-red-600">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h4 className="text-[12.5px] font-bold text-slate-900">
            Biểu đồ nội lực và chuyển vị dọc (ΔT = {sign}{detail.deltaT}°C, {mode})
          </h4>
          <div className="mt-1 flex items-center justify-end gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-slate-600">
              <span className="inline-block h-[2px] w-5 bg-[#d92d20]" /> Nội lực dọc P (kN)
            </span>
            <span className="flex items-center gap-1 text-slate-600">
              <span className="inline-block h-[2px] w-5 bg-[#1d4ed8]" /> Chuyển vị u (mm)
            </span>
          </div>
          <div className="relative">
            <ForceChart />
            <span className="absolute left-[16%] top-[52px] rounded bg-white/80 px-1 text-[10px] font-bold text-blue-700">+0.26 mm</span>
            <span className="absolute right-[14%] top-[52px] rounded bg-white/80 px-1 text-[10px] font-bold text-blue-700">+0.26 mm</span>
            <span className="absolute left-1/2 top-[30px] -translate-x-1/2 rounded bg-white/80 px-1 text-[10px] font-bold text-red-600">+{detail.force} kN</span>
          </div>
        </section>
      </div>
    </aside>
  );
}
