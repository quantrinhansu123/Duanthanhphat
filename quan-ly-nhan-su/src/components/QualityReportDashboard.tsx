"use client";

import { useMemo, useState } from "react";
import {
  defectCategories,
  inspectionBreakdown,
  plantQuality,
  qualityKpis,
  railTypeQuality,
  recentDefects,
  weeklyTrend,
  welderQuality,
} from "@/data/qualityReport";

function fmt(n: number) {
  return n.toLocaleString("vi-VN");
}

function KpiCard({
  label,
  value,
  unit,
  note,
  noteColor = "text-[#64748b]",
  iconBg,
  labelColor,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  noteColor?: string;
  iconBg: string;
  labelColor: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow duration-150">
      <div className="min-w-0 flex-1">
        <div className={`text-[11.5px] font-bold uppercase tracking-[0.06em] ${labelColor}`}>{label}</div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[26px] sm:text-[28px] font-bold leading-none text-[#0f172a] font-mono tabular-nums">{value}</span>
          {unit ? <span className="text-[12px] font-medium text-[#94a3b8]">{unit}</span> : null}
        </div>
        {note ? <div className={`mt-2.5 text-[12px] font-medium ${noteColor}`}>{note}</div> : null}
      </div>
      <div className={`flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
    </div>
  );
}

function DonutChart({ rate }: { rate: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const passLen = (rate / 100) * c;
  return (
    <svg viewBox="0 0 140 140" className="h-[140px] w-[140px]">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="20" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke="#15803d"
        strokeWidth="20"
        strokeDasharray={`${passLen} ${c}`}
        transform="rotate(-90 70 70)"
        strokeLinecap="round"
      />
      <text x="70" y="68" textAnchor="middle" className="fill-[#0f172a] text-[20px] font-bold font-mono">
        {rate.toLocaleString("vi-VN")}%
      </text>
      <text x="70" y="86" textAnchor="middle" className="fill-[#64748b] text-[9.5px] font-bold tracking-wider">
        ĐẠT CHUẨN
      </text>
    </svg>
  );
}

const severityStyle = {
  Cao: "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]",
  "Trung bình": "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]",
  Thấp: "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
};

const statusStyle = {
  "Chờ xử lý": "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]",
  "Đang sửa": "bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]",
  "Đã đóng": "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
};

export default function QualityReportDashboard() {
  const [period, setPeriod] = useState("Tháng này");
  const [plant, setPlant] = useState("Tất cả nhà máy");

  const maxDefect = useMemo(() => Math.max(...defectCategories.map((d) => d.count)), []);
  const maxTrend = useMemo(() => Math.max(...weeklyTrend.map((w) => w.rate)), []);
  const minTrend = useMemo(() => Math.min(...weeklyTrend.map((w) => w.rate)), []);
  const totalDefects = defectCategories.reduce((s, d) => s + d.count, 0);

  return (
    <div className="mx-auto w-full max-w-[1568px] px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-4 text-[#1f2937] text-[14px]">
      {/* Filter Bar */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-3 sm:p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#0f172a] shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
              </svg>
              <span>Bộ lọc:</span>
            </div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-9 w-full sm:w-auto rounded-lg border border-[#cbd5e1] bg-white px-3 text-[12.5px] text-[#334155] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#93b4e8] transition-colors duration-150 cursor-pointer"
            >
              {["Hôm nay", "Tuần này", "Tháng này", "Quý này", "Năm nay"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              value={plant}
              onChange={(e) => setPlant(e.target.value)}
              className="h-9 w-full sm:w-auto rounded-lg border border-[#cbd5e1] bg-white px-3 text-[12.5px] text-[#334155] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#93b4e8] transition-colors duration-150 cursor-pointer"
            >
              {["Tất cả nhà máy", "Nhà máy Hà Nội", "Nhà máy Đà Nẵng", "Nhà máy TP.HCM"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <span className="text-[12px] text-[#64748b]">Cập nhật realtime · {period}</span>
        </div>
      </div>

      {/* Row 1 — KPI chính */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Mối hàn đạt chuẩn"
          value={fmt(qualityKpis.passed)}
          unit="mối"
          note="↑ 1,2% so tháng trước"
          noteColor="text-[#15803d]"
          iconBg="bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]"
          labelColor="text-[#15803d]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12l3 3 5-6" />
            </svg>
          }
        />
        <KpiCard
          label="Mối hàn không đạt"
          value={fmt(qualityKpis.failed)}
          unit="mối"
          note={`${qualityKpis.criticalDefects} lỗi nghiêm trọng`}
          noteColor="text-[#b91c1c]"
          iconBg="bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]"
          labelColor="text-[#b91c1c]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          }
        />
        <KpiCard
          label="Tỷ lệ đạt chuẩn"
          value={qualityKpis.passRate.toLocaleString("vi-VN")}
          unit="%"
          note={`First-pass ${qualityKpis.firstPassRate}%`}
          iconBg="bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]"
          labelColor="text-[#0047AB]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 5L9 15l-4-4" />
              <path d="M14 5h5v5" />
            </svg>
          }
        />
        <KpiCard
          label="Sửa / hàn lại"
          value={fmt(qualityKpis.rework)}
          unit="mối"
          note={`TB ${qualityKpis.avgFixHours}h xử lý`}
          noteColor="text-[#b45309]"
          iconBg="bg-[#fffbeb] text-[#b45309] border border-[#fde68a]"
          labelColor="text-[#b45309]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          }
        />
      </div>

      {/* Row 2 — KPI bổ sung */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Tổng kiểm tra"
          value={fmt(qualityKpis.totalInspected)}
          unit="mối"
          note="NDT + ngoại quan"
          iconBg="bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]"
          labelColor="text-[#475569]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
        />
        <KpiCard
          label="NDT/UT đạt"
          value={fmt(qualityKpis.ndtPassed)}
          unit="mối"
          note="Siêu âm & kiểm tra vết nứt"
          iconBg="bg-[#ecfeff] text-[#0891b2] border border-[#a5f3fc]"
          labelColor="text-[#0891b2]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12c2-4 6-7 10-7s8 3 10 7c-2 4-6 7-10 7S4 16 2 12z" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          }
        />
        <KpiCard
          label="Ngoại quan không đạt"
          value={fmt(qualityKpis.visualFailed)}
          unit="mối"
          note="Phát hiện bằng mắt thường"
          noteColor="text-[#6d28d9]"
          iconBg="bg-[#faf5ff] text-[#7e22ce] border border-[#ddd6fe]"
          labelColor="text-[#7e22ce]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
        />
        <KpiCard
          label="Ca đang mở"
          value={fmt(qualityKpis.openCases)}
          unit="ca"
          note={`${qualityKpis.closedThisMonth} đã đóng tháng này`}
          noteColor="text-[#15803d]"
          iconBg="bg-[#fff7ed] text-[#ea580c] border border-[#ffedd5]"
          labelColor="text-[#ea580c]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs">
          <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">Cơ cấu kết quả kiểm định</div>
          <div className="mt-0.5 text-[12px] text-[#64748b]">Đạt chuẩn, không đạt và phải xử lý lại</div>
          <div className="my-4 flex justify-center">
            <DonutChart rate={qualityKpis.passRate} />
          </div>
          <div className="mt-2 divide-y divide-[#f8fafc]">
            {inspectionBreakdown.map((item) => (
              <div key={item.label} className="flex items-center gap-2 py-2.5 text-[12.5px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                <span className="flex-1 min-w-0 truncate text-[#334155]">{item.label}</span>
                <span className="font-semibold font-mono text-[#0f172a] shrink-0 tabular-nums">{fmt(item.count)} mối</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[14.5px] font-bold tracking-tight text-[#0f172a]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#dc2626" className="shrink-0">
                  <path d="M12 2L1 21h22L12 2zm0 6v6m0 4h.01" stroke="#dc2626" strokeWidth="0" />
                </svg>
                <span>Phân loại lỗi</span>
              </div>
              <div className="mt-0.5 text-[12px] text-[#64748b]">Khuyết tật phát hiện qua NDT/UT và ngoại quan</div>
            </div>
            <span className="shrink-0 rounded-full bg-[#fef2f2] border border-[#fecaca] px-2.5 py-0.5 text-[11px] font-bold font-mono text-[#b91c1c] tabular-nums">
              {totalDefects} lỗi
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {defectCategories.map((d) => {
              const pct = ((d.count / totalDefects) * 100).toFixed(1);
              const w = (d.count / maxDefect) * 100;
              return (
                <div key={d.name} className="flex items-center gap-2 sm:gap-3 text-[12.5px]">
                  <div className="w-[100px] sm:w-[130px] flex-none truncate text-[#334155] font-medium" title={d.name}>{d.name}</div>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#f1f5f9]">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${w}%`, background: d.color }} />
                    </div>
                    <span className="w-[68px] sm:w-[76px] flex-none text-right text-[11.5px] font-mono font-medium text-[#64748b] tabular-nums">
                      {d.count} ({pct.replace(".", ",")}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Trend + plant */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs">
          <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">Xu hướng tỷ lệ đạt (8 tuần)</div>
          <div className="mt-0.5 text-[12px] text-[#64748b]">Theo dõi biến động chất lượng theo tuần</div>
          <div className="mt-4 flex h-[150px] sm:h-[160px] items-end gap-1 sm:gap-2">
            {weeklyTrend.map((w) => {
              const h = ((w.rate - minTrend + 0.5) / (maxTrend - minTrend + 1)) * 100;
              return (
                <div key={w.week} className="flex flex-1 min-w-0 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold font-mono text-[#0047AB] whitespace-nowrap tabular-nums">{w.rate}%</span>
                  <div className="w-full max-w-[28px] sm:max-w-none overflow-hidden rounded-t-md bg-[#eff6ff] group" style={{ height: `${Math.max(h, 20)}%` }}>
                    <div className="h-full w-full bg-[#0047AB] group-hover:bg-[#00388a] transition-colors" />
                  </div>
                  <span className="text-[10.5px] sm:text-[11px] font-medium font-mono text-[#64748b] truncate">{w.week}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs">
          <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">Chất lượng theo nhà máy</div>
          <div className="mt-0.5 text-[12px] text-[#64748b]">Tỷ lệ đạt và số mối không đạt</div>
          <div className="mt-4 flex flex-col gap-3.5">
            {plantQuality.map((p) => (
              <div key={p.plant}>
                <div className="mb-1 flex items-center justify-between text-[12.5px]">
                  <span className="font-semibold text-[#0f172a] truncate">{p.plant}</span>
                  <span className="text-[#0047AB] font-bold font-mono shrink-0 ml-2 tabular-nums">{p.passRate}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f1f5f9]">
                  <div className="h-full rounded-full bg-[#0047AB]" style={{ width: `${p.passRate}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-[#64748b]">
                  <span className="font-mono tabular-nums">{fmt(p.total)}</span> mối · <span className="text-[#b91c1c] font-medium font-mono tabular-nums">{p.failed} không đạt</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rail type + welder ranking */}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs">
          <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">Theo loại ray</div>
          <div className="mt-3.5 flex flex-col gap-2.5">
            {railTypeQuality.map((r) => (
              <div key={r.type} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-2.5 hover:border-[#cbd5e1] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-semibold font-mono text-[#0f172a]">{r.type}</span>
                  <span className="text-[13px] font-bold font-mono text-[#0047AB] tabular-nums">{r.passRate}%</span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-[#64748b]"><span className="font-mono tabular-nums">{fmt(r.total)}</span> mối kiểm tra</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs overflow-hidden">
          <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">Top thợ hàn theo chất lượng</div>
          <div className="table-scroll mt-3.5 overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
                  <th className="pb-2 pr-3 whitespace-nowrap">Thợ hàn</th>
                  <th className="pb-2 pr-3 whitespace-nowrap">Welding ID</th>
                  <th className="pb-2 pr-3 whitespace-nowrap">Tổng mối</th>
                  <th className="pb-2 pr-3 whitespace-nowrap">Không đạt</th>
                  <th className="pb-2 whitespace-nowrap">Tỷ lệ đạt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8fafc]">
                {welderQuality.map((w, i) => (
                  <tr key={w.weldingId} className="hover:bg-[#f8fafc] transition-colors duration-150">
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#eff6ff] text-[10px] font-bold font-mono text-[#0047AB] border border-[#bfdbfe]">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-[#0f172a]">{w.name}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[12px] text-[#64748b] whitespace-nowrap">{w.weldingId}</td>
                    <td className="py-2.5 pr-3 text-[#334155] font-mono tabular-nums whitespace-nowrap">{fmt(w.total)}</td>
                    <td className="py-2.5 pr-3 font-semibold font-mono text-[#b91c1c] tabular-nums whitespace-nowrap">{w.failed}</td>
                    <td className="py-2.5 font-bold font-mono text-[#0047AB] tabular-nums whitespace-nowrap">{w.passRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent defects table */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs overflow-hidden">
        <div className="mb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
          <div>
            <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">Lỗi gần đây</div>
            <div className="mt-0.5 text-[12px] text-[#64748b]">Danh sách khuyết tật cần theo dõi</div>
          </div>
          <button type="button" className="self-start sm:self-auto text-[12.5px] font-bold text-[#0047AB] hover:underline cursor-pointer">
            Xem tất cả lỗi →
          </button>
        </div>
        <div className="table-scroll overflow-x-auto rounded-lg border border-[#e2e8f0]">
          <table className="w-full min-w-[760px] sm:min-w-[900px] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
                <th className="px-3.5 py-2.5 whitespace-nowrap">Ngày</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Mối hàn</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Loại lỗi</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Thợ hàn</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Nhà máy</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Mức độ</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {recentDefects.map((d) => (
                <tr key={d.id} className="hover:bg-[#f8fafc] transition-colors duration-150">
                  <td className="px-3.5 py-2.5 text-[#64748b] font-mono whitespace-nowrap">{d.date}</td>
                  <td className="px-3.5 py-2.5 font-mono text-[12px] font-bold text-[#0047AB] whitespace-nowrap">{d.weldJoint}</td>
                  <td className="px-3.5 py-2.5 text-[#334155] font-medium whitespace-nowrap">{d.defectType}</td>
                  <td className="px-3.5 py-2.5 font-semibold text-[#0f172a] whitespace-nowrap">{d.welder}</td>
                  <td className="px-3.5 py-2.5 text-[#64748b] whitespace-nowrap">{d.plant}</td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-bold tracking-wide ${severityStyle[d.severity]}`}>
                      {d.severity}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-bold tracking-wide ${statusStyle[d.status]}`}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
