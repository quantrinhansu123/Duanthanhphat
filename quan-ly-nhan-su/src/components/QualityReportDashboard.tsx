"use client";

import { useMemo } from "react";
import { Warning } from "@/components/icons";
import { weeklyTrend } from "@/data/qualityReport";
import { useReportFilters } from "@/contexts/ReportFilterContext";
import { useWeldReportData } from "@/hooks/useWeldReportData";
import {
  countReworkWelds,
  filterWeldReportRows,
  formatJournalDateIso,
  getJournalRowDateIso,
  groupJournalErrorReasons,
  groupJournalRows,
  summarizeJournalRows,
} from "@/lib/weldReportData";
const DEFECT_META = [
  { name: "Lỗi bề mặt", color: "#ef4444", severity: "Cao" as const },
  { name: "Nứt bề mặt", color: "#dc2626", severity: "Cao" as const },
  { name: "Rỗ khí", color: "#f59e0b", severity: "Trung bình" as const },
  { name: "Cháy cạnh", color: "#3b82f6", severity: "Trung bình" as const },
  { name: "Biến dạng nhiệt", color: "#6366f1", severity: "Thấp" as const },
  { name: "Khác", color: "#a855f7", severity: "Thấp" as const },
];

function fmt(n: number) {
  return n.toLocaleString("vi-VN");
}

function QualityKpiGrid({
  totalInspected,
  passed,
  failed,
  rework,
  passRate,
  criticalDefects,
}: {
  totalInspected: number;
  passed: number;
  failed: number;
  rework: number;
  passRate: number;
  criticalDefects: number;
}) {
  const cells = [
    {
      label: "Tổng kiểm tra",
      value: fmt(totalInspected),
      unit: "mối",
      note: "Theo nhật ký hàn",
      labelColor: "text-slate-700",
      noteColor: "text-slate-500",
      accent: "bg-slate-50",
      iconBg: "bg-white text-slate-600 border border-slate-200",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
    {
      label: "Đạt chuẩn",
      value: fmt(passed),
      unit: "mối",
      note: `${passRate.toLocaleString("vi-VN")}% tỷ lệ đạt`,
      labelColor: "text-emerald-700",
      noteColor: "text-[#0047AB]",
      accent: "bg-emerald-50/40",
      iconBg: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      ),
    },
    {
      label: "Không đạt",
      value: fmt(failed),
      unit: "mối",
      note: `${criticalDefects} lỗi nghiêm trọng`,
      labelColor: "text-rose-700",
      noteColor: "text-rose-600",
      accent: "bg-rose-50/40",
      iconBg: "bg-rose-50 text-rose-700 border border-rose-200",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      ),
    },
    {
      label: "Sửa / hàn lại",
      value: fmt(rework),
      unit: "mối",
      note: "Nhật ký hàn · có mối liên kết",
      labelColor: "text-amber-700",
      noteColor: "text-amber-700",
      accent: "bg-amber-50/40",
      iconBg: "bg-amber-50 text-amber-700 border border-amber-200",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      ),
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {cells.map((cell) => (
          <div key={cell.label} className={`flex items-start gap-2.5 p-3.5 sm:p-4 ${cell.accent}`}>
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cell.iconBg}`}>
              {cell.icon}
            </div>
            <div className="flex min-w-0 flex-1 items-end justify-between gap-2">
              <div className="min-w-0">
                <div className={`text-[11px] font-bold uppercase tracking-wider leading-tight ${cell.labelColor}`}>
                  {cell.label}
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-bold leading-none text-slate-900 font-mono tabular-nums">
                    {cell.value}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">{cell.unit}</span>
                </div>
              </div>
              <div className={`shrink-0 self-end pb-0.5 text-right text-[11px] font-medium leading-snug ${cell.noteColor}`}>
                {cell.note}
              </div>
            </div>
          </div>
        ))}
      </div>
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
        stroke="#0047AB"
        strokeWidth="20"
        strokeDasharray={`${passLen} ${c}`}
        transform="rotate(-90 70 70)"
        strokeLinecap="round"
      />
      <text x="70" y="68" textAnchor="middle" className="fill-slate-900 text-xl font-bold font-mono">
        {rate.toLocaleString("vi-VN")}%
      </text>
      <text x="70" y="86" textAnchor="middle" className="fill-slate-500 text-[11px] font-bold tracking-wider">
        ĐẠT CHUẨN
      </text>
    </svg>
  );
}

const severityStyle = {
  Cao: "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  "Trung bình": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  Thấp: "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
};

const statusStyle = {
  "Chờ xử lý": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  "Đang sửa": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Đã đóng": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
};

export default function QualityReportDashboard() {
  const { rows, loading, error } = useWeldReportData();
  const { appliedFilters } = useReportFilters();

  const selectedRows = useMemo(
    () => filterWeldReportRows(rows, appliedFilters),
    [rows, appliedFilters],
  );
  const summary = useMemo(() => summarizeJournalRows(selectedRows), [selectedRows]);

  const passed = summary.passed;
  const failed = summary.errors;
  const rework = useMemo(() => countReworkWelds(selectedRows), [selectedRows]);
  const totalInspected = summary.total;
  const passRate = totalInspected > 0 ? Number(((passed / totalInspected) * 100).toFixed(2)) : 0;
  const errorRows = useMemo(
    () => selectedRows.filter((row) => row.so_luong_loi > 0),
    [selectedRows],
  );
  const criticalDefects = errorRows.length;

  const currentInspectionBreakdown = useMemo(() => [
    { label: "Đạt chuẩn", count: passed, color: "#22a94f" },
    { label: "Không đạt", count: failed, color: "#ef4444" },
    { label: "Sửa / hàn lại", count: rework, color: "#f0b323" },
  ], [passed, failed, rework]);

  const currentDefectCategories = useMemo(() => {
    const reasons = groupJournalErrorReasons(errorRows, DEFECT_META.length);
    if (reasons.length === 0) {
      return DEFECT_META.map((defect) => ({ ...defect, count: 0 }));
    }
    return reasons.map((reason, index) => ({
      name: reason.label,
      count: reason.count,
      color: DEFECT_META[index % DEFECT_META.length].color,
      severity: DEFECT_META[index % DEFECT_META.length].severity,
    }));
  }, [errorRows]);

  const totalDefects = useMemo(() => {
    return currentDefectCategories.reduce((s, d) => s + d.count, 0);
  }, [currentDefectCategories]);

  const maxDefect = useMemo(() => {
    return Math.max(...currentDefectCategories.map((d) => d.count), 1);
  }, [currentDefectCategories]);

  const maxTrend = useMemo(() => Math.max(...weeklyTrend.map((w) => w.rate)), []);
  const minTrend = useMemo(() => Math.min(...weeklyTrend.map((w) => w.rate)), []);

  const currentPlantQuality = useMemo(() => {
    return groupJournalRows(selectedRows, (row) => row.du_an)
      .sort((a, b) => b.total - a.total)
      .map((project) => ({
        plant: project.name,
        total: project.total,
        failed: project.errors,
        passRate: project.total > 0 ? Number(((project.passed / project.total) * 100).toFixed(2)) : 0,
      }));
  }, [selectedRows]);

  const currentRailTypeQuality = useMemo(() => {
    return groupJournalRows(selectedRows, (row) => row.loai_ray)
      .sort((a, b) => b.total - a.total)
      .map((rail) => ({
        type: rail.name,
        total: rail.total,
        passRate: rail.total > 0 ? Number(((rail.passed / rail.total) * 100).toFixed(2)) : 0,
      }));
  }, [selectedRows]);

  const currentWelderQuality = useMemo(() => {
    return groupJournalRows(selectedRows, (row) => row.ten_tho_han)
      .sort((a, b) => b.total - a.total)
      .map((welder) => {
        const source = welder.rows[0];
        return {
          name: welder.name,
          weldingId: source.ma_nhan_su,
          total: welder.total,
          failed: welder.errors,
          passRate: welder.total > 0 ? Number(((welder.passed / welder.total) * 100).toFixed(2)) : 0,
        };
      });
  }, [selectedRows]);

  const currentRecentDefects = useMemo(() => {
    const defects = [];
    let sequence = 0;
    for (const [index, row] of errorRows.entries()) {
      const meta = DEFECT_META[sequence % DEFECT_META.length];
      const isoDate = getJournalRowDateIso(row, index);
      defects.push({
        id: row.id,
        date: formatJournalDateIso(isoDate),
        weldJoint: row.ma_lich_su,
        defectType: row.nguyen_nhan_loi?.trim() || meta.name,
        welder: row.ten_tho_han,
        plant: row.du_an,
        severity: meta.severity,
        status:
          row.moi_han_lien_ket?.trim()
            ? ("Đã đóng" as const)
            : sequence % 3 === 0
              ? ("Đang sửa" as const)
              : ("Chờ xử lý" as const),
      });
      sequence += 1;
    }
    return defects;
  }, [errorRows]);

  return (
    <div className="w-full min-w-0 px-3 sm:px-5 lg:px-6 py-3 sm:py-4 flex flex-col gap-4 text-slate-700 text-sm">
      <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-[#0047AB]"}`}>
        {error
          ? `Không tải được Supabase: ${error}`
          : loading
            ? "Đang tải dữ liệu Supabase…"
            : `Nhật ký hàn · ${rows.length} bản ghi · Sửa/hàn lại = có Mối hàn liên kết`}
      </div>
      <QualityKpiGrid
        totalInspected={totalInspected}
        passed={passed}
        failed={failed}
        rework={rework}
        passRate={passRate}
        criticalDefects={criticalDefects}
      />

      {/* Charts row */}
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">Cơ cấu kết quả kiểm định</div>
          <div className="mt-0.5 text-xs text-slate-500">Đạt chuẩn, không đạt và phải xử lý lại</div>
          <div className="my-4 flex justify-center">
            <DonutChart rate={passRate} />
          </div>
          <div className="mt-2 divide-y divide-slate-100">
            {currentInspectionBreakdown.map((item) => (
              <div key={item.label} className="flex items-center gap-2 py-2.5 text-xs sm:text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                <span className="flex-1 min-w-0 truncate text-slate-700">{item.label}</span>
                <span className="font-semibold font-mono text-slate-900 shrink-0 tabular-nums">{fmt(item.count)} mối</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm sm:text-base font-bold tracking-tight text-slate-900">
                <Warning size={16} weight="fill" aria-hidden className="shrink-0 text-rose-600" />
                <span>Phân loại lỗi</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">Khuyết tật phát hiện qua NDT/UT và ngoại quan</div>
            </div>
            <span className="shrink-0 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-bold font-mono text-rose-700 tabular-nums shadow-2xs">
              {totalDefects} lỗi
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {currentDefectCategories.map((d) => {
              const pct = totalDefects > 0 ? ((d.count / totalDefects) * 100).toFixed(1) : "0.0";
              const w = (d.count / maxDefect) * 100;
              return (
                <div key={d.name} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div className="w-[100px] sm:w-[130px] flex-none truncate text-slate-700 font-medium" title={d.name}>{d.name}</div>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${w}%`, background: d.color }} />
                    </div>
                    <span className="w-[68px] sm:w-[76px] flex-none text-right text-xs font-mono font-medium text-slate-500 tabular-nums">
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
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">Xu hướng tỷ lệ đạt (8 tuần)</div>
          <div className="mt-0.5 text-xs text-slate-500">Theo dõi biến động chất lượng theo tuần</div>
          <div className="mt-4 flex h-[150px] sm:h-[160px] items-end gap-1 sm:gap-2">
            {weeklyTrend.map((w) => {
              const h = ((w.rate - minTrend + 0.5) / (maxTrend - minTrend + 1)) * 100;
              return (
                <div key={w.week} className="flex flex-1 min-w-0 flex-col items-center gap-1.5">
                  <span className="text-[11px] font-bold font-mono text-[#0047AB] whitespace-nowrap tabular-nums">{w.rate}%</span>
                  <div className="w-full max-w-[28px] sm:max-w-none overflow-hidden rounded-t-md bg-blue-50 group" style={{ height: `${Math.max(h, 20)}%` }}>
                    <div className="h-full w-full bg-[#0047AB] group-hover:bg-[#00388A] transition-colors" />
                  </div>
                  <span className="text-xs font-medium font-mono text-slate-500 truncate">{w.week}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">Chất lượng theo nhà máy</div>
          <div className="mt-0.5 text-xs text-slate-500">Tỷ lệ đạt và số mối không đạt</div>
          <div className="mt-4 flex flex-col gap-3.5">
            {currentPlantQuality.map((p) => (
              <div key={p.plant}>
                <div className="mb-1 flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-slate-900 truncate">{p.plant}</span>
                  <span className="text-[#0047AB] font-bold font-mono shrink-0 ml-2 tabular-nums">{p.passRate}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#0047AB]" style={{ width: `${p.passRate}%` }} />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  <span className="font-mono tabular-nums">{fmt(p.total)}</span> mối · <span className="text-rose-700 font-medium font-mono tabular-nums">{p.failed} không đạt</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rail type + welder ranking */}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">Theo loại ray</div>
          <div className="mt-3.5 flex flex-col gap-2.5">
            {currentRailTypeQuality.map((r) => (
              <div key={r.type} className="rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 hover:border-slate-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-semibold font-mono text-slate-900">{r.type}</span>
                  <span className="text-sm font-bold font-mono text-[#0047AB] tabular-nums">{r.passRate}%</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500"><span className="font-mono tabular-nums">{fmt(r.total)}</span> mối kiểm tra</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs overflow-hidden">
          <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">Top thợ hàn theo chất lượng</div>
          <div className="table-scroll mt-3.5 overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3 whitespace-nowrap">Thợ hàn</th>
                  <th className="pb-2 pr-3 whitespace-nowrap">Welding ID</th>
                  <th className="pb-2 pr-3 whitespace-nowrap">Tổng mối</th>
                  <th className="pb-2 pr-3 whitespace-nowrap">Không đạt</th>
                  <th className="pb-2 whitespace-nowrap">Tỷ lệ đạt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentWelderQuality.map((w, i) => (
                  <tr key={w.weldingId} className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-bold font-mono text-[#0047AB] border border-blue-200">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-slate-900">{w.name}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500 whitespace-nowrap">{w.weldingId}</td>
                    <td className="py-2.5 pr-3 text-slate-700 font-mono tabular-nums whitespace-nowrap">{fmt(w.total)}</td>
                    <td className="py-2.5 pr-3 font-semibold font-mono text-rose-700 tabular-nums whitespace-nowrap">{w.failed}</td>
                    <td className="py-2.5 font-bold font-mono text-[#0047AB] tabular-nums whitespace-nowrap">{w.passRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent defects table */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs overflow-hidden">
        <div className="mb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
          <div>
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">Lỗi gần đây</div>
            <div className="mt-0.5 text-xs text-slate-500">Danh sách khuyết tật cần theo dõi</div>
          </div>
          <button type="button" className="self-start sm:self-auto text-xs sm:text-sm font-semibold text-[#0047AB] hover:underline cursor-pointer">
            Xem tất cả lỗi →
          </button>
        </div>
        <div className="table-scroll overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[760px] sm:min-w-[900px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-3.5 py-2.5 whitespace-nowrap">Ngày</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Mối hàn</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Loại lỗi</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Thợ hàn</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Nhà máy</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Mức độ</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentRecentDefects.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-3.5 py-2.5 text-slate-500 font-mono whitespace-nowrap">{d.date}</td>
                  <td className="px-3.5 py-2.5 font-mono text-xs font-bold text-[#0047AB] whitespace-nowrap">{d.weldJoint}</td>
                  <td className="px-3.5 py-2.5 text-slate-700 font-medium whitespace-nowrap">{d.defectType}</td>
                  <td className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{d.welder}</td>
                  <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">{d.plant}</td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${severityStyle[d.severity]}`}>
                      {d.severity}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${statusStyle[d.status]}`}>
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
