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
    <div className="rounded-2xl border border-[#d9e2f1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[11px] font-bold uppercase tracking-[0.06em] ${labelColor}`}>{label}</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold leading-none text-[#0f172a]">{value}</span>
            {unit ? <span className="text-[12px] text-[#94a3b8]">{unit}</span> : null}
          </div>
          {note ? <div className={`mt-1.5 text-[11px] ${noteColor}`}>{note}</div> : null}
        </div>
        <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
      </div>
    </div>
  );
}

function DonutChart({ rate }: { rate: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const passLen = (rate / 100) * c;
  return (
    <svg viewBox="0 0 140 140" className="h-[150px] w-[150px]">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#eef2f7" strokeWidth="20" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke="#22a94f"
        strokeWidth="20"
        strokeDasharray={`${passLen} ${c}`}
        transform="rotate(-90 70 70)"
        strokeLinecap="round"
      />
      <text x="70" y="68" textAnchor="middle" className="fill-[#0f172a] text-[20px] font-bold">
        {rate.toLocaleString("vi-VN")}%
      </text>
      <text x="70" y="86" textAnchor="middle" className="fill-[#94a3b8] text-[9px] font-semibold tracking-wider">
        ĐẠT CHUẨN
      </text>
    </svg>
  );
}

const severityStyle = {
  Cao: "bg-[#fef2f2] text-[#dc2626]",
  "Trung bình": "bg-[#fffbeb] text-[#d97706]",
  Thấp: "bg-[#f0fdf4] text-[#16a34a]",
};

const statusStyle = {
  "Chờ xử lý": "bg-[#fef3c7] text-[#b45309]",
  "Đang sửa": "bg-[#dbeafe] text-[#1d4ed8]",
  "Đã đóng": "bg-[#dcfce7] text-[#15803d]",
};

export default function QualityReportDashboard() {
  const [period, setPeriod] = useState("Tháng này");
  const [plant, setPlant] = useState("Tất cả nhà máy");

  const maxDefect = useMemo(() => Math.max(...defectCategories.map((d) => d.count)), []);
  const maxTrend = useMemo(() => Math.max(...weeklyTrend.map((w) => w.rate)), []);
  const minTrend = useMemo(() => Math.min(...weeklyTrend.map((w) => w.rate)), []);
  const totalDefects = defectCategories.reduce((s, d) => s + d.count, 0);

  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {["Hôm nay", "Tuần này", "Tháng này", "Quý này", "Năm nay"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          value={plant}
          onChange={(e) => setPlant(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {["Tất cả nhà máy", "Nhà máy Hà Nội", "Nhà máy Đà Nẵng", "Nhà máy TP.HCM"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <span className="text-[12px] text-[#94a3b8]">Cập nhật realtime · {period}</span>
      </div>

      {/* Row 1 — KPI chính */}
      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Mối hàn đạt chuẩn"
          value={fmt(qualityKpis.passed)}
          unit="mối"
          note="↑ 1,2% so tháng trước"
          noteColor="text-[#16a34a]"
          iconBg="bg-[#ecfdf5] text-[#14b8a6]"
          labelColor="text-[#0d9488]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
          noteColor="text-[#dc2626]"
          iconBg="bg-[#fef2f2] text-[#ef4444]"
          labelColor="text-[#dc2626]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
          iconBg="bg-[#eef4ff] text-[#0047AB]"
          labelColor="text-[#0047AB]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
          iconBg="bg-[#fffbeb] text-[#f59e0b]"
          labelColor="text-[#b45309]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          }
        />
      </div>

      {/* Row 2 — KPI bổ sung */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Tổng kiểm tra"
          value={fmt(qualityKpis.totalInspected)}
          unit="mối"
          note="NDT + ngoại quan"
          iconBg="bg-[#f1f5f9] text-[#475569]"
          labelColor="text-[#475569]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
          iconBg="bg-[#ecfeff] text-[#0891b2]"
          labelColor="text-[#0891b2]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
          iconBg="bg-[#fdf4ff] text-[#a855f7]"
          labelColor="text-[#9333ea]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
          noteColor="text-[#16a34a]"
          iconBg="bg-[#fff7ed] text-[#ea580c]"
          labelColor="text-[#ea580c]"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          }
        />
      </div>

      {/* Charts row */}
      <div className="mb-4 grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="rounded-2xl border border-[#d9e2f1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="text-[14px] font-bold text-[#0f172a]">Cơ cấu kết quả kiểm định</div>
          <div className="mt-1 text-[12px] text-[#64748b]">Đạt chuẩn, không đạt và phải xử lý lại</div>
          <div className="mt-4 flex justify-center">
            <DonutChart rate={qualityKpis.passRate} />
          </div>
          <div className="mt-2 divide-y divide-[#f1f5f9]">
            {inspectionBreakdown.map((item) => (
              <div key={item.label} className="flex items-center gap-2 py-2.5 text-[13px]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                <span className="flex-1 text-[#475569]">{item.label}</span>
                <span className="font-semibold text-[#0f172a]">{fmt(item.count)} mối</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#d9e2f1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[14px] font-bold text-[#0f172a]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444">
                  <path d="M12 2L1 21h22L12 2zm0 6v6m0 4h.01" stroke="#ef4444" strokeWidth="0" />
                </svg>
                Phân loại lỗi
              </div>
              <div className="mt-1 text-[12px] text-[#64748b]">Khuyết tật phát hiện qua NDT/UT và ngoại quan</div>
            </div>
            <span className="rounded-full bg-[#fef2f2] px-2.5 py-1 text-[11px] font-bold text-[#dc2626]">
              {totalDefects} lỗi
            </span>
          </div>
          <div className="mt-5 flex flex-col gap-3.5">
            {defectCategories.map((d) => {
              const pct = ((d.count / totalDefects) * 100).toFixed(1);
              const w = (d.count / maxDefect) * 100;
              return (
                <div key={d.name} className="flex items-center gap-3 text-[13px]">
                  <div className="w-[130px] flex-none text-[#475569]">{d.name}</div>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#f1f5f9]">
                      <div className="h-full rounded-full" style={{ width: `${w}%`, background: d.color }} />
                    </div>
                    <span className="w-[72px] flex-none text-right text-[12px] text-[#64748b]">
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
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#d9e2f1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="text-[14px] font-bold text-[#0f172a]">Xu hướng tỷ lệ đạt (8 tuần)</div>
          <div className="mt-1 text-[12px] text-[#64748b]">Theo dõi biến động chất lượng theo tuần</div>
          <div className="mt-5 flex h-[160px] items-end gap-2">
            {weeklyTrend.map((w) => {
              const h = ((w.rate - minTrend + 0.5) / (maxTrend - minTrend + 1)) * 100;
              return (
                <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-[#0047AB]">{w.rate}%</span>
                  <div className="w-full overflow-hidden rounded-t-md bg-[#eef4ff]" style={{ height: `${Math.max(h, 20)}%` }}>
                    <div className="h-full w-full bg-[#0047AB] opacity-80" />
                  </div>
                  <span className="text-[11px] text-[#94a3b8]">{w.week}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[#d9e2f1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="text-[14px] font-bold text-[#0f172a]">Chất lượng theo nhà máy</div>
          <div className="mt-1 text-[12px] text-[#64748b]">Tỷ lệ đạt và số mối không đạt</div>
          <div className="mt-4 flex flex-col gap-4">
            {plantQuality.map((p) => (
              <div key={p.plant}>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[#0f172a]">{p.plant}</span>
                  <span className="text-[#0047AB] font-semibold">{p.passRate}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#f1f5f9]">
                  <div className="h-full rounded-full bg-[#0047AB]" style={{ width: `${p.passRate}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">
                  {fmt(p.total)} mối · {p.failed} không đạt
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rail type + welder ranking */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="rounded-2xl border border-[#d9e2f1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="text-[14px] font-bold text-[#0f172a]">Theo loại ray</div>
          <div className="mt-4 flex flex-col gap-3">
            {railTypeQuality.map((r) => (
              <div key={r.type} className="rounded-xl border border-[#f1f5f9] bg-[#f8fafc] px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#0f172a]">{r.type}</span>
                  <span className="text-[13px] font-bold text-[#0047AB]">{r.passRate}%</span>
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">{fmt(r.total)} mối kiểm tra</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#d9e2f1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="text-[14px] font-bold text-[#0f172a]">Top thợ hàn theo chất lượng</div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#e8eef8] text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                  <th className="pb-2 pr-3">Thợ hàn</th>
                  <th className="pb-2 pr-3">Welding ID</th>
                  <th className="pb-2 pr-3">Tổng mối</th>
                  <th className="pb-2 pr-3">Không đạt</th>
                  <th className="pb-2">Tỷ lệ đạt</th>
                </tr>
              </thead>
              <tbody>
                {welderQuality.map((w, i) => (
                  <tr key={w.weldingId} className="border-b border-[#f1f5f9]">
                    <td className="py-2.5 pr-3">
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#eef4ff] text-[10px] font-bold text-[#0047AB]">
                        {i + 1}
                      </span>
                      <span className="font-medium text-[#0f172a]">{w.name}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[12px] text-[#64748b]">{w.weldingId}</td>
                    <td className="py-2.5 pr-3 text-[#334155]">{fmt(w.total)}</td>
                    <td className="py-2.5 pr-3 text-[#dc2626]">{w.failed}</td>
                    <td className="py-2.5 font-semibold text-[#0047AB]">{w.passRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent defects table */}
      <div className="rounded-2xl border border-[#d9e2f1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-[#0f172a]">Lỗi gần đây</div>
            <div className="mt-1 text-[12px] text-[#64748b]">Danh sách khuyết tật cần theo dõi</div>
          </div>
          <button type="button" className="text-[13px] font-semibold text-[#0047AB] hover:underline">
            Xem tất cả lỗi →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e8eef8] bg-[#f7f9fc] text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                <th className="px-3 py-2.5">Ngày</th>
                <th className="px-3 py-2.5">Mối hàn</th>
                <th className="px-3 py-2.5">Loại lỗi</th>
                <th className="px-3 py-2.5">Thợ hàn</th>
                <th className="px-3 py-2.5">Nhà máy</th>
                <th className="px-3 py-2.5">Mức độ</th>
                <th className="px-3 py-2.5">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {recentDefects.map((d) => (
                <tr key={d.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-3 py-2.5 text-[#334155]">{d.date}</td>
                  <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-[#0047AB]">{d.weldJoint}</td>
                  <td className="px-3 py-2.5 text-[#334155]">{d.defectType}</td>
                  <td className="px-3 py-2.5 font-medium text-[#0f172a]">{d.welder}</td>
                  <td className="px-3 py-2.5 text-[#64748b]">{d.plant}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityStyle[d.severity]}`}>
                      {d.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle[d.status]}`}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
