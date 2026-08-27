"use client";

import { useMemo, useState } from "react";
import {
  historicalWeldColumns,
  historicalWelds,
  type HistoricalWeldRecord,
} from "@/data/historicalWelds";
import {
  historicalProjectSummary,
  weldCategoryLabel,
  type HistoricalProjectSummary,
} from "@/data/historicalProjectSummary";
import {
  formatVolumeCell,
  historicalVolumeSummary,
  volumeSummaryTitle,
  volumeTotal,
  type HistoricalVolumeSummary,
  type VolumeByMethod,
} from "@/data/historicalVolumeSummary";

type ImportTab = "detail" | "summary" | "volume";

const statusStyle: Record<HistoricalWeldRecord["status"], string> = {
  Đạt: "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  Lỗi: "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
};

function DetailImportTable() {
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("Tất cả phương pháp");
  const [weldType, setWeldType] = useState("Tất cả loại mối");
  const [status, setStatus] = useState("Tất cả trạng thái");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return historicalWelds.filter((row) => {
      const matchQ =
        !q ||
        row.weldId.toLowerCase().includes(q) ||
        row.welderName.toLowerCase().includes(q) ||
        row.project.toLowerCase().includes(q) ||
        row.errorReason.toLowerCase().includes(q);
      const matchMethod = method === "Tất cả phương pháp" || row.method === method;
      const matchType = weldType === "Tất cả loại mối" || row.weldType === weldType;
      const matchStatus = status === "Tất cả trạng thái" || row.status === status;
      return matchQ && matchMethod && matchType && matchStatus;
    });
  }, [query, method, weldType, status]);

  const passed = historicalWelds.filter((r) => r.status === "Đạt").length;
  const failed = historicalWelds.filter((r) => r.status === "Lỗi").length;

  return (
    <>
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs sm:text-sm text-[#0047AB] shadow-2xs">
        <strong>Mẫu 1 – Chi tiết từng mối hàn:</strong> {historicalWeldColumns.join(" · ")}. FBW = hàn
        điểm, ATW = hàn nhiệt luyện.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{historicalWelds.length}</strong> bản ghi mẫu
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{passed}</strong> đạt · <span className="font-semibold text-rose-700 font-mono tabular-nums">{failed}</span> lỗi
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm ID mối hàn, thợ hàn, dự án..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          {["Tất cả phương pháp", "FBW", "ATW"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select
          value={weldType}
          onChange={(e) => setWeldType(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          {["Tất cả loại mối", "Thử nghiệm", "Đào tạo", "Sản xuất"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          {["Tất cả trạng thái", "Đạt", "Lỗi"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                {historicalWeldColumns.map((col) => (
                  <th key={col} className="px-4 py-3">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-4 py-3 font-mono font-bold text-[#0047AB]">{row.weldId}</td>
                  <td className="px-4 py-3 text-slate-700 font-mono">{row.year}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#0047AB] border border-blue-200 shadow-2xs">
                      {row.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.weldType}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.welderName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.project}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.errorReason || <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy bản ghi phù hợp</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SummaryImportTable() {
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("Tất cả dự án");

  const projects = useMemo(
    () => ["Tất cả dự án", ...Array.from(new Set(historicalProjectSummary.map((r) => r.project)))],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return historicalProjectSummary.filter((row) => {
      const matchQ =
        !q ||
        row.welderName.toLowerCase().includes(q) ||
        row.project.toLowerCase().includes(q) ||
        row.errorReason.toLowerCase().includes(q);
      const matchProject = project === "Tất cả dự án" || row.project === project;
      return matchQ && matchProject;
    });
  }, [query, project]);

  const totalWelds = filtered.reduce((s, r) => s + r.weldCount, 0);
  const totalErrors = filtered.reduce((s, r) => s + r.errorCount, 0);

  return (
    <>
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs sm:text-sm text-[#0047AB] shadow-2xs">
        <strong>Mẫu 2 – Tổng hợp theo dự án:</strong> nhập theo năm, loại mối (PD = Phát triển, SX
        = Sản xuất), công nghệ FBW/ATW, cột <strong>Thành phẩm</strong> và <strong>Hàng lỗi</strong>.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{filtered.length}</strong> dòng mẫu
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{totalWelds.toLocaleString("vi-VN")}</strong> thành phẩm ·{" "}
          <span className="font-semibold text-rose-700 font-mono tabular-nums">{totalErrors}</span> hàng lỗi
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm dự án, thợ hàn..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="h-10 max-w-[280px] rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          {projects.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[#00388A] bg-[#0047AB] text-xs font-bold uppercase tracking-wider text-white">
                <th rowSpan={2} className="border-r border-blue-600 px-3 py-2.5 text-center">
                  TT
                </th>
                <th rowSpan={2} className="border-r border-blue-600 px-3.5 py-2.5">
                  Dự án
                </th>
                <th rowSpan={2} className="border-r border-blue-600 px-3.5 py-2.5">
                  Ngày thực hiện
                </th>
                <th rowSpan={2} className="border-r border-blue-600 px-3.5 py-2.5">
                  Loại mối hàn
                </th>
                <th rowSpan={2} className="border-r border-blue-600 px-3.5 py-2.5">
                  Công nghệ hàn
                </th>
                <th colSpan={2} className="border-r border-blue-600 px-3.5 py-2.5 text-center">
                  Số lượng mối hàn
                </th>
                <th rowSpan={2} className="border-r border-blue-600 px-3.5 py-2.5">
                  Tên thợ hàn
                </th>
                <th rowSpan={2} className="px-3.5 py-2.5">
                  Nguyên nhân lỗi
                </th>
              </tr>
              <tr className="border-b border-blue-600 bg-blue-700 text-[11px] font-semibold uppercase text-white">
                <th className="border-r border-blue-500 px-3 py-2 text-center">Thành phẩm</th>
                <th className="border-r border-blue-500 px-3 py-2 text-center">Hàng lỗi</th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] italic text-slate-500">
                <th className="px-3 py-2 font-normal" />
                <th className="px-3.5 py-2 font-normal">Nhập tên Dự án</th>
                <th className="px-3.5 py-2 font-normal">Nhập năm thực hiện</th>
                <th className="px-3.5 py-2 font-normal">Nhập &quot;PD&quot; or &quot;SX&quot;</th>
                <th className="px-3.5 py-2 font-normal">Nhập FBW or ATW</th>
                <th className="px-3.5 py-2 font-normal text-center">Nhập số mối thành phẩm</th>
                <th className="px-3.5 py-2 font-normal text-center">Nhập số mối bị lỗi</th>
                <th className="px-3.5 py-2 font-normal">Nhập tên thợ hàn</th>
                <th className="px-3.5 py-2 font-normal">Nhập nguyên nhân lỗi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <SummaryRow key={row.id} row={row} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy bản ghi phù hợp</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function VolumeMethodCells({ data }: { data: VolumeByMethod }) {
  const total = volumeTotal(data);
  return (
    <>
      <td className="px-3.5 py-3 text-center text-slate-700 font-mono tabular-nums">{formatVolumeCell(data.fbw) || "—"}</td>
      <td className="px-3.5 py-3 text-center text-slate-700 font-mono tabular-nums">{formatVolumeCell(data.atw) || "—"}</td>
      <td className="px-3.5 py-3 text-center font-bold font-mono tabular-nums text-slate-900 bg-slate-50/70">
        {formatVolumeCell(total) || "—"}
      </td>
    </>
  );
}

function VolumeImportTable() {
  const filledYears = historicalVolumeSummary.filter(
    (r) =>
      r.trialTraining.fbw != null ||
      r.trialTraining.atw != null ||
      r.production.fbw != null ||
      r.production.atw != null,
  ).length;

  return (
    <>
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs sm:text-sm text-[#0047AB] shadow-2xs">
        <strong>Mẫu 3 – Tổng hợp khối lượng theo năm:</strong> nhập số mối hàn FBW/ATW cho từng
        nhóm (Thử nghiệm–Đào tạo, Thành phẩm, Hàng lỗi). Cột Tổng = FBW + ATW. Dòng 1–2 (2017–2018)
        để trống cột Thành phẩm và Hàng lỗi theo mẫu Excel.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{historicalVolumeSummary.length}</strong> năm (2017–2026)
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-[#0047AB] font-mono tabular-nums">{filledYears}</strong> năm có dữ liệu mẫu
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="border-b border-slate-200 bg-white px-4 py-4 text-center">
          <h2 className="text-sm sm:text-base font-bold uppercase tracking-wide text-rose-700">
            {volumeSummaryTitle}
          </h2>
        </div>
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[#00388A] bg-[#0047AB] text-xs font-bold uppercase tracking-wider text-white">
                <th rowSpan={2} className="w-12 border-r border-blue-600 px-3 py-2.5 text-center">
                  TT
                </th>
                <th rowSpan={2} className="min-w-[100px] border-r border-blue-600 px-3.5 py-2.5 text-center">
                  Thời gian thực hiện
                </th>
                <th colSpan={3} className="border-r border-blue-600 px-3.5 py-2.5 text-center">
                  Mối hàn thử nghiệm – đào tạo
                </th>
                <th colSpan={3} className="border-r border-blue-600 px-3.5 py-2.5 text-center">
                  Thành phẩm
                </th>
                <th colSpan={3} className="border-r border-blue-600 px-3.5 py-2.5 text-center">
                  Hàng lỗi
                </th>
                <th rowSpan={2} className="min-w-[180px] px-3.5 py-2.5 text-center">
                  Nguyên nhân lỗi
                </th>
              </tr>
              <tr className="border-b border-[#00388A] bg-blue-700 text-[11px] font-semibold uppercase text-white">
                {(["FBW", "ATW", "Tổng"] as const).map((label) => (
                  <th key={`trial-${label}`} className="border-r border-blue-500 px-2 py-2 text-center">
                    {label}
                  </th>
                ))}
                {(["FBW", "ATW", "Tổng"] as const).map((label) => (
                  <th key={`prod-${label}`} className="border-r border-blue-500 px-2 py-2 text-center">
                    {label}
                  </th>
                ))}
                {(["FBW", "ATW", "Tổng"] as const).map((label) => (
                  <th key={`def-${label}`} className="border-r border-blue-500 px-2 py-2 text-center">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historicalVolumeSummary.map((row, idx) => (
                <VolumeRow key={row.id} row={row} striped={idx % 2 === 1} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function VolumeRow({ row, striped }: { row: HistoricalVolumeSummary; striped: boolean }) {
  return (
    <tr className={`hover:bg-blue-50/50 transition-colors duration-150 ${striped ? "bg-slate-50/60" : "bg-white"}`}>
      <td className="px-3 py-3 text-center font-mono tabular-nums text-slate-500">{row.no}</td>
      <td className="px-3.5 py-3 text-center font-semibold font-mono tabular-nums text-slate-900">{row.year}</td>
      <VolumeMethodCells data={row.trialTraining} />
      <VolumeMethodCells data={row.production} />
      <VolumeMethodCells data={row.defective} />
      <td className="px-3.5 py-3 text-slate-700">
        {row.errorReason || <span className="text-slate-400">—</span>}
      </td>
    </tr>
  );
}

function SummaryRow({ row }: { row: HistoricalProjectSummary }) {
  return (
    <tr className="hover:bg-slate-50/80 transition-colors duration-150">
      <td className="px-3 py-3 text-center font-mono tabular-nums text-slate-500">{row.no}</td>
      <td className="px-3.5 py-3 font-semibold text-slate-900">{row.project}</td>
      <td className="px-3.5 py-3 text-slate-700 font-mono tabular-nums">{row.year}</td>
      <td className="px-3.5 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            row.weldCategory === "PD" ? "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs" : "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs"
          }`}
          title={weldCategoryLabel[row.weldCategory]}
        >
          {row.weldCategory}
        </span>
      </td>
      <td className="px-3.5 py-3">
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#0047AB] border border-blue-200 shadow-2xs">
          {row.technology}
        </span>
      </td>
      <td className="px-3.5 py-3 font-semibold font-mono tabular-nums text-slate-900">{row.weldCount.toLocaleString("vi-VN")}</td>
      <td className="px-3.5 py-3 text-center font-mono tabular-nums">
        <span
          className={`font-semibold ${row.errorCount > 0 ? "text-rose-700" : "text-emerald-700"}`}
        >
          {row.errorCount}
        </span>
      </td>
      <td className="px-3.5 py-3 font-medium text-slate-900">{row.welderName}</td>
      <td className="px-3.5 py-3 text-slate-700">
        {row.errorReason || <span className="text-slate-400">—</span>}
      </td>
    </tr>
  );
}

export default function BulkImportList() {
  const [tab, setTab] = useState<ImportTab>("detail");

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 gap-1">
          <button
            type="button"
            onClick={() => setTab("detail")}
            className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer ${
              tab === "detail" ? "bg-white text-[#0047AB] shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Chi tiết mối hàn
          </button>
          <button
            type="button"
            onClick={() => setTab("summary")}
            className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer ${
              tab === "summary" ? "bg-white text-[#0047AB] shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tổng hợp theo dự án
          </button>
          <button
            type="button"
            onClick={() => setTab("volume")}
            className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer ${
              tab === "volume" ? "bg-white text-[#0047AB] shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tổng hợp khối lượng
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Tải mẫu Excel
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
          >
            <span className="text-base leading-none">+</span> Import file
          </button>
        </div>
      </div>

      {tab === "detail" && <DetailImportTable />}
      {tab === "summary" && <SummaryImportTable />}
      {tab === "volume" && <VolumeImportTable />}
    </main>
  );
}
