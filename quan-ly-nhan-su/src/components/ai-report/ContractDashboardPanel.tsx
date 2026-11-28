"use client";

import { useMemo, useState } from "react";
import {
  ChartBar,
  CheckCircle,
  DownloadSimple,
  FileText,
  WarningCircle,
} from "@/components/icons";
import CapBadge from "@/components/ai-report/CapBadge";
import {
  computeContractStats,
  exportExtractionsToCsv,
  formatVndCompact,
  SYNTHETIC_ALERTS,
  SYNTHETIC_PORTFOLIO,
  type ContractRegistryRow,
  type ExtractedWordContract,
} from "@/lib/aiReportDemo";

type GroupDim = "duAn" | "doiTac" | "trangThai";

const DIM_OPTIONS: { id: GroupDim; label: string }[] = [
  { id: "duAn", label: "Dự án" },
  { id: "doiTac", label: "Đối tác" },
  { id: "trangThai", label: "Trạng thái thực hiện" },
];

const TYPE_CHIP_CLS: Record<ContractRegistryRow["loai"], string> = {
  "Mua bán": "bg-blue-100 text-blue-800",
  "Thi công xây lắp": "bg-indigo-100 text-indigo-800",
  "Dịch vụ": "bg-teal-100 text-teal-800",
  "Thầu phụ": "bg-violet-100 text-violet-800",
  "Bảo trì": "bg-amber-100 text-amber-900",
};

const MILESTONE_STAGES = [
  { label: "Mốc thi công", pct: 76, note: "4/5 gói đạt mốc" },
  { label: "Tạm ứng", pct: 100, note: "Đã giải ngân 30%" },
  { label: "Hoàn thành", pct: 68, note: "Đang nghiệm thu đợt 2" },
  { label: "Quyết toán", pct: 42, note: "2/5 hợp đồng chốt" },
] as const;

export default function ContractDashboardPanel({
  docs,
  onAudit,
}: {
  docs: ExtractedWordContract[];
  onAudit: (action: string) => void;
}) {
  const [dataMode, setDataMode] = useState<"sample" | "real">("sample");
  const [groupDim, setGroupDim] = useState<GroupDim>("duAn");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [csvNotice, setCsvNotice] = useState("");

  const realStats = useMemo(() => computeContractStats(docs), [docs]);

  const sampleTotals = useMemo(() => {
    const totalValue = SYNTHETIC_PORTFOLIO.reduce((s, r) => s + r.giaTriVnd, 0);
    const totalPaid = SYNTHETIC_PORTFOLIO.reduce((s, r) => s + r.daThanhToanVnd, 0);
    const avgProgress = Math.round(
      SYNTHETIC_PORTFOLIO.reduce((s, r) => s + r.khoiLuongPct, 0) / SYNTHETIC_PORTFOLIO.length
    );
    const guaranteeUsed = SYNTHETIC_PORTFOLIO.reduce((s, r) => s + r.baoLanhDungVnd, 0);
    const guaranteeLimit = SYNTHETIC_PORTFOLIO.reduce((s, r) => s + r.baoLanhTranVnd, 0);
    const paidPct = totalValue > 0 ? Math.round((totalPaid / totalValue) * 100) : 0;
    return { totalValue, totalPaid, avgProgress, guaranteeUsed, guaranteeLimit, paidPct };
  }, []);

  const chartGroups = useMemo(() => {
    if (dataMode === "sample") {
      const map = new Map<string, { label: string; value: number; paid: number; count: number }>();
      for (const row of SYNTHETIC_PORTFOLIO) {
        const key = row[groupDim];
        const prev = map.get(key) ?? { label: key, value: 0, paid: 0, count: 0 };
        map.set(key, {
          label: key,
          value: prev.value + row.giaTriVnd,
          paid: prev.paid + row.daThanhToanVnd,
          count: prev.count + 1,
        });
      }
      const list = Array.from(map.values()).sort((a, b) => b.value - a.value);
      const maxVal = Math.max(1, ...list.map((g) => g.value));
      return list.map((g) => ({
        ...g,
        widthPct: Math.max(8, Math.round((g.value / maxVal) * 100)),
        overlayPct: g.value > 0 ? Math.min(100, Math.round((g.paid / g.value) * 100)) : 0,
        overlayLabel: `Đã thanh toán ${g.value > 0 ? Math.round((g.paid / g.value) * 100) : 0}%`,
      }));
    }

    const map = new Map<string, { label: string; value: number; approvedFields: number; totalFields: number; count: number }>();
    for (const d of docs) {
      const key =
        groupDim === "duAn"
          ? d.docType
          : groupDim === "doiTac"
            ? (d.fields.find((f) => f.key === "ben_b")?.value?.trim() || "Chưa xác định đối tác").replace(/^\(.*$/, "Chưa xác định đối tác")
            : d.reviewState === "approved"
              ? "Đã duyệt"
              : d.reviewState === "review"
                ? "Cần rà soát"
                : "Chờ kiểm tra";
      const prev = map.get(key) ?? { label: key, value: 0, approvedFields: 0, totalFields: 0, count: 0 };
      map.set(key, {
        label: key,
        value: prev.value + d.valueVnd,
        approvedFields: prev.approvedFields + d.fields.filter((f) => f.status === "approved").length,
        totalFields: prev.totalFields + d.fields.length,
        count: prev.count + 1,
      });
    }
    const list = Array.from(map.values()).sort((a, b) => b.value - a.value || b.count - a.count);
    const maxVal = Math.max(1, ...list.map((g) => g.value || g.count));
    return list.map((g) => {
      const approvedPct = g.totalFields > 0 ? Math.round((g.approvedFields / g.totalFields) * 100) : 0;
      return {
        label: g.label,
        value: g.value,
        count: g.count,
        widthPct: Math.max(10, Math.round(((g.value || g.count) / maxVal) * 100)),
        overlayPct: approvedPct,
        overlayLabel: `Đã duyệt ${approvedPct}% trường`,
      };
    });
  }, [dataMode, docs, groupDim]);

  const filteredPortfolio = useMemo(
    () => (typeFilter === "all" ? SYNTHETIC_PORTFOLIO : SYNTHETIC_PORTFOLIO.filter((r) => r.loai === typeFilter)),
    [typeFilter]
  );

  function handleExportCsv() {
    const csv = exportExtractionsToCsv(docs);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thong-ke-hop-dong_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setCsvNotice("Đã xuất bảng thống kê dữ liệu đã đọc ra tệp .csv (mở trực tiếp bằng Excel).");
    onAudit(`Xuất CSV thống kê (${docs.length} hồ sơ)`);
  }

  const expiringAlerts = SYNTHETIC_ALERTS.filter((a) => a.category === "expiring");
  const addendumAlerts = SYNTHETIC_ALERTS.filter((a) => a.category === "addendum");
  const debtAlerts = SYNTHETIC_ALERTS.filter((a) => a.category === "debt");

  return (
    <section
      id="bao-cao-ai-stats"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5"
      aria-label="Dashboard và Thống kê hợp đồng"
    >
      {/* Header + Mode toggle */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0047AB]/10 px-2.5 py-0.5 text-xs font-bold text-[#0047AB]">
              <ChartBar size={14} weight="bold" aria-hidden />
              Module 1 · 2 · 3 · 12 · 14 · Dashboard &amp; Thống kê Hợp đồng
            </span>
            {dataMode === "real" && realStats.hasRealDocs ? (
              <CapBadge capability="real" compact />
            ) : (
              <CapBadge capability="sim" compact />
            )}
          </div>
          <h2 className="mt-1.5 text-base font-bold text-slate-900">
            Tổng quan hợp đồng theo dự án, đối tác, tiến độ thanh toán &amp; cảnh báo hạn mức
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Chuyển đổi linh hoạt giữa danh mục mẫu tổng hợp (minh họa đầy đủ chỉ số Module 1/2/12/14) và số liệu tính trực tiếp từ tệp hợp đồng đã đọc cục bộ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs" role="tablist" aria-label="Nguồn số liệu Dashboard">
            <button
              type="button"
              role="tab"
              aria-selected={dataMode === "sample"}
              onClick={() => setDataMode("sample")}
              className={`rounded-md px-2.5 py-1 font-semibold cursor-pointer ${
                dataMode === "sample" ? "bg-[#0047AB] text-white" : "text-slate-700 hover:bg-white"
              }`}
            >
              Danh mục mẫu (5 HĐ)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dataMode === "real"}
              onClick={() => setDataMode("real")}
              className={`rounded-md px-2.5 py-1 font-semibold cursor-pointer ${
                dataMode === "real" ? "bg-[#0047AB] text-white" : "text-slate-700 hover:bg-white"
              }`}
            >
              Dữ liệu đã đọc ({docs.length})
            </button>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-700 bg-white px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 cursor-pointer"
          >
            <DownloadSimple size={14} aria-hidden />
            Xuất CSV (mở bằng Excel)
          </button>
        </div>
      </div>

      {dataMode === "real" && !realStats.hasRealDocs ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <WarningCircle size={14} className="shrink-0 text-amber-600" aria-hidden />
          <span>
            Đang tổng hợp trên <b>{docs.length} tệp mẫu khởi tạo</b> — hãy chọn thư mục hoặc tải tệp <code>.docx/.txt/.md</code> ở khu vực bên dưới để xem số liệu thật.
          </span>
        </div>
      ) : null}

      {csvNotice ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <CheckCircle size={14} weight="fill" aria-hidden />
          <span>{csvNotice}</span>
        </div>
      ) : null}

      {/* 4 KPI Cards (Module 1) */}
      {dataMode === "sample" ? (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Giá trị hợp đồng</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatVndCompact(sampleTotals.totalValue)}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{SYNTHETIC_PORTFOLIO.length} hợp đồng mẫu · 3 dự án</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0047AB]">Khối lượng thực hiện</p>
            <p className="mt-1 text-lg font-bold text-[#0047AB]">{sampleTotals.avgProgress}%</p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
              <div className="h-full rounded-full bg-[#0047AB]" style={{ width: `${sampleTotals.avgProgress}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Tiến độ thanh toán</p>
            <p className="mt-1 text-lg font-bold text-emerald-900">
              {sampleTotals.paidPct}%{" "}
              <span className="text-xs font-medium text-emerald-700">({formatVndCompact(sampleTotals.totalPaid)})</span>
            </p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${sampleTotals.paidPct}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Hạn mức bảo lãnh</p>
            <p className="mt-1 text-lg font-bold text-amber-950">{formatVndCompact(sampleTotals.guaranteeUsed)}</p>
            <p className="mt-0.5 text-[11px] text-amber-800">
              Trần: {formatVndCompact(sampleTotals.guaranteeLimit)} (
              {Math.round((sampleTotals.guaranteeUsed / Math.max(1, sampleTotals.guaranteeLimit)) * 100)}%)
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hồ sơ đã đọc</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{realStats.count} tệp</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {realStats.contractsCount} hợp đồng · {realStats.addendaCount} phụ lục
            </p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0047AB]">Tổng giá trị trích xuất</p>
            <p className="mt-1 text-lg font-bold text-[#0047AB]">{formatVndCompact(realStats.totalValue)}</p>
            <p className="mt-0.5 text-[11px] text-blue-800">
              {realStats.missingValueCount > 0
                ? `${realStats.missingValueCount} tệp chưa rõ giá trị`
                : `Trung bình ${formatVndCompact(realStats.avgValue)}/tệp`}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Độ phủ trường trích xuất</p>
            <p className="mt-1 text-lg font-bold text-emerald-900">{realStats.fieldCoveragePct}%</p>
            <p className="mt-0.5 text-[11px] text-emerald-700">
              {realStats.approvedFields}/{realStats.totalFields} trường đã duyệt
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Tỷ lệ hồ sơ đã duyệt</p>
            <p className="mt-1 text-lg font-bold text-amber-950">{realStats.approvedDocsPct}%</p>
            <p className="mt-0.5 text-[11px] text-amber-800">
              Duyệt: {realStats.byReviewState.approved} · Chờ: {realStats.byReviewState.pending} · Rà soát: {realStats.byReviewState.review}
            </p>
          </div>
        </div>
      )}

      {/* Chart + 3 Alert Widgets */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Bar chart regrouped by dimension */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                Biểu đồ giá trị &amp; tiến độ thanh toán theo nhóm
              </h3>
              <p className="text-[11px] text-slate-500">Bấm chiều phân tích để gom lại biểu đồ ngay lập tức</p>
            </div>
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Chiều phân nhóm biểu đồ">
              {DIM_OPTIONS.map((dim) => (
                <button
                  key={dim.id}
                  type="button"
                  role="tab"
                  aria-selected={groupDim === dim.id}
                  onClick={() => setGroupDim(dim.id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                    groupDim === dim.id
                      ? "bg-[#0047AB] text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {dim.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {chartGroups.map((g) => (
              <div key={g.label} className="space-y-1 rounded-lg border border-slate-200 bg-white p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-900">
                    {g.label} <span className="font-normal text-slate-500">({g.count} HĐ)</span>
                  </span>
                  <span className="font-mono font-bold text-[#0047AB]">
                    {g.value > 0 ? formatVndCompact(g.value) : "Chưa rõ giá trị"}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#0047AB]/85 transition-all duration-300"
                    style={{ width: `${g.widthPct}%` }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-emerald-100">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${g.overlayPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10.5px] font-semibold text-emerald-700">{g.overlayLabel}</span>
                </div>
              </div>
            ))}
            {chartGroups.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">
                Chưa có hồ sơ nào để thống kê.
              </p>
            ) : null}
          </div>
        </div>

        {/* 3 Alert Widgets (Module 1 & 14) */}
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
              Widget cảnh báo trọng yếu (Module 1 &amp; 14)
            </h3>
            <CapBadge capability="sim" compact />
          </div>

          {(
            [
              { title: "Hợp đồng sắp hết hạn", items: expiringAlerts, tone: "border-rose-200 bg-rose-50/60 text-rose-900" },
              { title: "Phụ lục phát sinh", items: addendumAlerts, tone: "border-amber-200 bg-amber-50/60 text-amber-950" },
              { title: "Công nợ tồn đọng", items: debtAlerts, tone: "border-blue-200 bg-blue-50/60 text-blue-950" },
            ] as const
          ).map((group) => (
            <div key={group.title} className={`rounded-xl border p-2.5 ${group.tone}`}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-bold">{group.title}</span>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold">{group.items.length} mục</span>
              </div>
              <div className="space-y-1.5">
                {group.items.map((al) => (
                  <div key={al.id} className="rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] text-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{al.contractCode}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${
                          al.severity === "high" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {al.severity === "high" ? "Ưu tiên cao" : "Theo dõi"}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800">{al.title}</p>
                    <p className="text-[10.5px] text-slate-500">{al.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Module 12 Tracking Strip */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
              Module 12 · Theo dõi tiến độ mốc &amp; giải ngân lũy kế so với giá trị trần
            </h3>
            <p className="text-[11px] text-slate-500">Mốc thi công → Tạm ứng → Hoàn thành → Quyết toán</p>
          </div>
          <CapBadge capability="sim" compact />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {MILESTONE_STAGES.map((st, idx) => (
            <div key={st.label} className="rounded-lg border border-slate-200 bg-white p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">
                  {idx + 1}. {st.label}
                </span>
                <span className="font-mono font-bold text-[#0047AB]">{st.pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#0047AB]" style={{ width: `${st.pct}%` }} />
              </div>
              <p className="mt-1 text-[10.5px] text-slate-500">{st.note}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="min-w-[220px] flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">Giải ngân lũy kế so với trần hợp đồng</span>
              <span className="font-mono font-bold text-emerald-700">
                {formatVndCompact(sampleTotals.totalPaid)} / {formatVndCompact(sampleTotals.totalValue)} ({sampleTotals.paidPct}%)
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${sampleTotals.paidPct}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10.5px] font-semibold">
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-amber-900">
              Hạn thanh toán: 2 mốc sắp đến
            </span>
            <span className="rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-rose-800">
              Hạn bảo lãnh: 1 HĐ còn 12 ngày
            </span>
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-emerald-800">
              Vượt trần khối lượng: 0 (đang trong trần)
            </span>
          </div>
        </div>
      </div>

      {/* Module 2 Registry Table + Module 3 OCR Highlight Card */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Module 2 Registry */}
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3.5 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                Module 2 · Danh mục &amp; Cơ sở dữ liệu Hợp đồng (Contract Registry)
              </h3>
              <p className="text-[11px] text-slate-500">
                Quản lý Số HĐ, Tên HĐ, Đối tác, Chủ đầu tư, Giá trị, Ngày ký, Tiến độ, Phân loại &amp; Đính kèm
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {["all", "Mua bán", "Thi công xây lắp", "Dịch vụ", "Thầu phụ", "Bảo trì"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold cursor-pointer ${
                    typeFilter === t
                      ? "bg-[#0047AB] text-white"
                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {t === "all" ? "Tất cả" : t}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[680px] border-collapse text-left text-[11px]">
              <thead className="bg-slate-100 text-[10.5px] text-slate-600">
                <tr>
                  <th className="border-b px-2.5 py-2 font-bold">Số HĐ / Tên HĐ</th>
                  <th className="border-b px-2 py-2 font-bold">Đối tác &amp; Chủ đầu tư</th>
                  <th className="border-b px-2 py-2 font-bold">Phân loại</th>
                  <th className="border-b px-2 py-2 text-right font-bold">Giá trị</th>
                  <th className="border-b px-2 py-2 text-center font-bold">Ngày ký / Tiến độ</th>
                  <th className="border-b px-2 py-2 font-bold">Đính kèm</th>
                </tr>
              </thead>
              <tbody>
                {filteredPortfolio.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-2.5 py-2">
                      <p className="font-bold text-[#0047AB]">{row.soHD}</p>
                      <p className="text-[10.5px] text-slate-600">{row.tenHD}</p>
                    </td>
                    <td className="px-2 py-2">
                      <p className="font-semibold text-slate-800">{row.doiTac}</p>
                      <p className="text-[10px] text-slate-500">CĐT: {row.chuDauTu}</p>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${TYPE_CHIP_CLS[row.loai]}`}>
                        {row.loai}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-slate-900">
                      {formatVndCompact(row.giaTriVnd)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <p className="text-[10.5px] text-slate-600">{row.ngayKy}</p>
                      <span className="font-bold text-emerald-700">{row.khoiLuongPct}%</span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.attachments.map((att) => (
                          <span
                            key={att}
                            className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-slate-700"
                          >
                            <FileText size={10} aria-hidden />
                            {att}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Module 3 OCR Highlight Card */}
        <div className="flex flex-col justify-between space-y-2.5 rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 lg:col-span-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-amber-950">
                Module 3 · Smart OCR (Scan / PDF)
              </h3>
              <CapBadge capability="sim" compact />
            </div>
            <p className="text-[11px] leading-snug text-amber-950/90">
              Minh họa tự động bóc tách 6 nhóm trường pháp lý từ bản scan PDF/ảnh chất lượng cao trước khi nạp vào Vector DB:
            </p>
            <div
              className="rounded-lg border border-amber-200 bg-white p-3 text-[11.5px] leading-relaxed text-slate-900 shadow-2xs"
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
            >
              <p className="text-center font-bold">TRANG HỢP ĐỒNG SCAN (MÔ PHỎNG)</p>
              <ul className="mt-2 space-y-1.5">
                <li>
                  <span className="rounded bg-blue-100 px-1 font-sans text-[10px] font-bold text-[#0047AB]">Các bên tham gia</span>{" "}
                  Cty TNHH Vật Tư Mẫu Alpha &amp; Cty CP Thiết Bị Minh Họa Beta
                </li>
                <li>
                  <span className="rounded bg-emerald-100 px-1 font-sans text-[10px] font-bold text-emerald-800">Giá trị</span>{" "}
                  350.000.000 VNĐ (đã gồm VAT)
                </li>
                <li>
                  <span className="rounded bg-amber-100 px-1 font-sans text-[10px] font-bold text-amber-900">Thời hạn</span>{" "}
                  30 ngày kể từ ngày ký
                </li>
                <li>
                  <span className="rounded bg-violet-100 px-1 font-sans text-[10px] font-bold text-violet-800">Thanh toán</span>{" "}
                  Tạm ứng 30%, thanh toán 70% sau nghiệm thu 15 ngày
                </li>
                <li>
                  <span className="rounded bg-cyan-100 px-1 font-sans text-[10px] font-bold text-cyan-900">Bảo lãnh</span>{" "}
                  Bảo lãnh thực hiện 10% giá trị HĐ
                </li>
                <li>
                  <span className="rounded bg-rose-100 px-1 font-sans text-[10px] font-bold text-rose-800">Phạt vi phạm</span>{" "}
                  0,05%/ngày chậm, tối đa 8% phần nghĩa vụ vi phạm
                </li>
              </ul>
            </div>
          </div>
          <p className="text-[10.5px] text-amber-900">
            Trên bản trình duyệt hiện tại, tệp <code>.docx / .txt / .md</code> được đọc thật 100% cục bộ; tệp <code>.pdf / .doc / ảnh scan</code> được gắn nhãn OCR mô phỏng.
          </p>
        </div>
      </div>
    </section>
  );
}
