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
  Đạt: "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
  Lỗi: "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]",
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
      <div className="mb-4 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-[13px] text-[#1e40af]">
        <strong>Mẫu 1 – Chi tiết từng mối hàn:</strong> {historicalWeldColumns.join(" · ")}. FBW = hàn
        điểm, ATW = hàn nhiệt luyện.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-[12.5px] sm:text-[13px] text-[#475569]">
        <span>
          <strong className="font-semibold text-[#0f172a]">{historicalWelds.length}</strong> bản ghi mẫu
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="font-semibold text-[#15803d]">{passed}</strong> đạt · <span className="font-semibold text-[#b91c1c]">{failed}</span> lỗi
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
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
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
          />
        </div>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
        >
          {["Tất cả phương pháp", "FBW", "ATW"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select
          value={weldType}
          onChange={(e) => setWeldType(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
        >
          {["Tất cả loại mối", "Thử nghiệm", "Đào tạo", "Sản xuất"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
        >
          {["Tất cả trạng thái", "Đạt", "Lỗi"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#64748b]">
                {historicalWeldColumns.map((col) => (
                  <th key={col} className="px-4 py-3">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-[#f8fafc]/90 transition-colors duration-150">
                  <td className="px-4 py-3 font-mono font-bold text-[#0047AB]">{row.weldId}</td>
                  <td className="px-4 py-3 text-[#334155] font-mono">{row.year}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-[11px] font-semibold text-[#0047AB] border border-[#bfdbfe]">
                      {row.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#334155]">{row.weldType}</td>
                  <td className="px-4 py-3 font-semibold text-[#0f172a]">{row.welderName}</td>
                  <td className="px-4 py-3 text-[#334155]">{row.project}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#334155]">
                    {row.errorReason || <span className="text-[#94a3b8]">—</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[#64748b]">
                    <div className="text-[14px] font-medium">Không tìm thấy bản ghi phù hợp</div>
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
      <div className="mb-4 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-[13px] text-[#1e40af]">
        <strong>Mẫu 2 – Tổng hợp theo dự án:</strong> nhập theo năm, loại mối (PD = Phát triển, SX
        = Sản xuất), công nghệ FBW/ATW, cột <strong>Thành phẩm</strong> và <strong>Hàng lỗi</strong>.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-[12.5px] sm:text-[13px] text-[#475569]">
        <span>
          <strong className="font-semibold text-[#0f172a]">{filtered.length}</strong> dòng mẫu
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="font-semibold text-[#15803d] font-mono">{totalWelds.toLocaleString("vi-VN")}</strong> thành phẩm ·{" "}
          <span className="font-semibold text-[#b91c1c] font-mono">{totalErrors}</span> hàng lỗi
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
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
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
          />
        </div>
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="h-10 max-w-[280px] rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
        >
          {projects.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#1e3a8a] bg-[#0047AB] text-[11px] font-bold uppercase tracking-[0.04em] text-white">
                <th rowSpan={2} className="border-r border-[#1d4ed8] px-3 py-2.5 text-center">
                  TT
                </th>
                <th rowSpan={2} className="border-r border-[#1d4ed8] px-3.5 py-2.5">
                  Dự án
                </th>
                <th rowSpan={2} className="border-r border-[#1d4ed8] px-3.5 py-2.5">
                  Ngày thực hiện
                </th>
                <th rowSpan={2} className="border-r border-[#1d4ed8] px-3.5 py-2.5">
                  Loại mối hàn
                </th>
                <th rowSpan={2} className="border-r border-[#1d4ed8] px-3.5 py-2.5">
                  Công nghệ hàn
                </th>
                <th colSpan={2} className="border-r border-[#1d4ed8] px-3.5 py-2.5 text-center">
                  Số lượng mối hàn
                </th>
                <th rowSpan={2} className="border-r border-[#1d4ed8] px-3.5 py-2.5">
                  Tên thợ hàn
                </th>
                <th rowSpan={2} className="px-3.5 py-2.5">
                  Nguyên nhân lỗi
                </th>
              </tr>
              <tr className="border-b border-[#1d4ed8] bg-[#1d4ed8] text-[10.5px] font-semibold uppercase text-white">
                <th className="border-r border-[#2563eb] px-3 py-2 text-center">Thành phẩm</th>
                <th className="border-r border-[#2563eb] px-3 py-2 text-center">Hàng lỗi</th>
              </tr>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10.5px] italic text-[#64748b]">
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
            <tbody className="divide-y divide-[#f1f5f9]">
              {filtered.map((row) => (
                <SummaryRow key={row.id} row={row} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#64748b]">
                    <div className="text-[14px] font-medium">Không tìm thấy bản ghi phù hợp</div>
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
      <td className="px-3.5 py-3 text-center text-[#334155] font-mono">{formatVolumeCell(data.fbw) || "—"}</td>
      <td className="px-3.5 py-3 text-center text-[#334155] font-mono">{formatVolumeCell(data.atw) || "—"}</td>
      <td className="px-3.5 py-3 text-center font-bold font-mono text-[#0f172a] bg-[#f8fafc]">
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
      <div className="mb-4 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-[13px] text-[#1e40af]">
        <strong>Mẫu 3 – Tổng hợp khối lượng theo năm:</strong> nhập số mối hàn FBW/ATW cho từng
        nhóm (Thử nghiệm–Đào tạo, Thành phẩm, Hàng lỗi). Cột Tổng = FBW + ATW. Dòng 1–2 (2017–2018)
        để trống cột Thành phẩm và Hàng lỗi theo mẫu Excel.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-[12.5px] sm:text-[13px] text-[#475569]">
        <span>
          <strong className="font-semibold text-[#0f172a]">{historicalVolumeSummary.length}</strong> năm (2017–2026)
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="font-semibold text-[#0047AB]">{filledYears}</strong> năm có dữ liệu mẫu
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-xs">
        <div className="border-b border-[#e8eef8] bg-white px-4 py-4 text-center">
          <h2 className="text-[15px] sm:text-[16px] font-bold uppercase tracking-wide text-[#b91c1c]">
            {volumeSummaryTitle}
          </h2>
        </div>
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#1e3a8a] bg-[#0047AB] text-[11px] font-bold uppercase tracking-[0.03em] text-white">
                <th rowSpan={2} className="w-12 border-r border-[#1d4ed8] px-3 py-2.5 text-center">
                  TT
                </th>
                <th rowSpan={2} className="min-w-[100px] border-r border-[#1d4ed8] px-3.5 py-2.5 text-center">
                  Thời gian thực hiện
                </th>
                <th colSpan={3} className="border-r border-[#1d4ed8] px-3.5 py-2.5 text-center">
                  Mối hàn thử nghiệm – đào tạo
                </th>
                <th colSpan={3} className="border-r border-[#1d4ed8] px-3.5 py-2.5 text-center">
                  Thành phẩm
                </th>
                <th colSpan={3} className="border-r border-[#1d4ed8] px-3.5 py-2.5 text-center">
                  Hàng lỗi
                </th>
                <th rowSpan={2} className="min-w-[180px] px-3.5 py-2.5 text-center">
                  Nguyên nhân lỗi
                </th>
              </tr>
              <tr className="border-b border-[#1e3a8a] bg-[#1d4ed8] text-[10.5px] font-semibold uppercase text-white">
                {(["FBW", "ATW", "Tổng"] as const).map((label) => (
                  <th key={`trial-${label}`} className="border-r border-[#2563eb] px-2 py-2 text-center">
                    {label}
                  </th>
                ))}
                {(["FBW", "ATW", "Tổng"] as const).map((label) => (
                  <th key={`prod-${label}`} className="border-r border-[#2563eb] px-2 py-2 text-center">
                    {label}
                  </th>
                ))}
                {(["FBW", "ATW", "Tổng"] as const).map((label) => (
                  <th key={`def-${label}`} className="border-r border-[#2563eb] px-2 py-2 text-center">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
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
    <tr className={`hover:bg-[#eff6ff]/50 transition-colors duration-150 ${striped ? "bg-[#f8fafc]" : "bg-white"}`}>
      <td className="px-3 py-3 text-center font-mono text-[#64748b]">{row.no}</td>
      <td className="px-3.5 py-3 text-center font-semibold font-mono text-[#0f172a]">{row.year}</td>
      <VolumeMethodCells data={row.trialTraining} />
      <VolumeMethodCells data={row.production} />
      <VolumeMethodCells data={row.defective} />
      <td className="px-3.5 py-3 text-[#334155]">
        {row.errorReason || <span className="text-[#94a3b8]">—</span>}
      </td>
    </tr>
  );
}

function SummaryRow({ row }: { row: HistoricalProjectSummary }) {
  return (
    <tr className="hover:bg-[#f8fafc]/90 transition-colors duration-150">
      <td className="px-3 py-3 text-center font-mono text-[#64748b]">{row.no}</td>
      <td className="px-3.5 py-3 font-semibold text-[#0f172a]">{row.project}</td>
      <td className="px-3.5 py-3 text-[#334155] font-mono">{row.year}</td>
      <td className="px-3.5 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            row.weldCategory === "PD" ? "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]" : "bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]"
          }`}
          title={weldCategoryLabel[row.weldCategory]}
        >
          {row.weldCategory}
        </span>
      </td>
      <td className="px-3.5 py-3">
        <span className="inline-flex items-center rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-[11px] font-semibold text-[#0047AB] border border-[#bfdbfe]">
          {row.technology}
        </span>
      </td>
      <td className="px-3.5 py-3 font-semibold font-mono text-[#0f172a]">{row.weldCount.toLocaleString("vi-VN")}</td>
      <td className="px-3.5 py-3 text-center font-mono">
        <span
          className={`font-semibold ${row.errorCount > 0 ? "text-[#b91c1c]" : "text-[#15803d]"}`}
        >
          {row.errorCount}
        </span>
      </td>
      <td className="px-3.5 py-3 font-medium text-[#0f172a]">{row.welderName}</td>
      <td className="px-3.5 py-3 text-[#334155]">
        {row.errorReason || <span className="text-[#94a3b8]">—</span>}
      </td>
    </tr>
  );
}

export default function BulkImportList() {
  const [tab, setTab] = useState<ImportTab>("detail");

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-[#d9e2f1] bg-[#f1f5f9] p-1 gap-1">
          <button
            type="button"
            onClick={() => setTab("detail")}
            className={`rounded-lg px-3.5 py-2 text-[12.5px] sm:text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
              tab === "detail" ? "bg-white text-[#0047AB] shadow-xs" : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            Chi tiết mối hàn
          </button>
          <button
            type="button"
            onClick={() => setTab("summary")}
            className={`rounded-lg px-3.5 py-2 text-[12.5px] sm:text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
              tab === "summary" ? "bg-white text-[#0047AB] shadow-xs" : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            Tổng hợp theo dự án
          </button>
          <button
            type="button"
            onClick={() => setTab("volume")}
            className={`rounded-lg px-3.5 py-2 text-[12.5px] sm:text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
              tab === "volume" ? "bg-white text-[#0047AB] shadow-xs" : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            Tổng hợp khối lượng
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0f172a] hover:border-[#cbd5e1] active:bg-[#f1f5f9] transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Tải mẫu Excel
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white shadow-xs hover:bg-[#00388a] active:bg-[#002d6e] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/25 transition-all duration-150 cursor-pointer"
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
