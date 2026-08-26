"use client";

import { useMemo, useState } from "react";
import {
  historicalWeldColumns,
  historicalWelds,
  type HistoricalWeldRecord,
} from "@/data/historicalWelds";
import {
  historicalProjectSummary,
  projectSummaryColumns,
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
  Đạt: "bg-[#e7f7ed] text-[#15803d]",
  Lỗi: "bg-[#fdeaea] text-[#c62828]",
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
      <div className="mb-4 rounded-xl border border-[#dbeafe] bg-[#eff6ff] px-4 py-3 text-[13px] text-[#1e40af]">
        <strong>Mẫu 1 – Chi tiết từng mối hàn:</strong> {historicalWeldColumns.join(" · ")}. FBW = hàn
        điểm, ATW = hàn nhiệt luyện.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#475569]">
        <span>
          <strong className="text-[#0f172a]">{historicalWelds.length}</strong> bản ghi mẫu
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#0f172a]">{passed}</strong> đạt · {failed} lỗi
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {["Tất cả phương pháp", "FBW", "ATW"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select
          value={weldType}
          onChange={(e) => setWeldType(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {["Tất cả loại mối", "Thử nghiệm", "Đào tạo", "Sản xuất"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {["Tất cả trạng thái", "Đạt", "Lỗi"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e8eef8] bg-[#fef9c3] text-[12px] font-semibold text-[#713f12]">
                {historicalWeldColumns.map((col) => (
                  <th key={col} className="px-4 py-3">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3 font-semibold text-[#0f172a]">{row.weldId}</td>
                  <td className="px-4 py-3 text-[#334155]">{row.year}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded bg-[#e8eef8] px-2 py-0.5 text-[11px] font-semibold text-[#0047AB]">
                      {row.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#334155]">{row.weldType}</td>
                  <td className="px-4 py-3 font-medium text-[#0f172a]">{row.welderName}</td>
                  <td className="px-4 py-3 text-[#334155]">{row.project}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle[row.status]}`}
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
                  <td colSpan={8} className="px-4 py-10 text-center text-[#64748b]">
                    Không tìm thấy bản ghi phù hợp.
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
      <div className="mb-4 rounded-xl border border-[#dbeafe] bg-[#eff6ff] px-4 py-3 text-[13px] text-[#1e40af]">
        <strong>Mẫu 2 – Tổng hợp theo dự án:</strong> nhập theo năm, loại mối (PD = Phát triển, SX
        = Sản xuất), công nghệ FBW/ATW và số lượng mối thực hiện.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#475569]">
        <span>
          <strong className="text-[#0f172a]">{filtered.length}</strong> dòng mẫu
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#0f172a]">{totalWelds.toLocaleString("vi-VN")}</strong> mối hàn ·{" "}
          {totalErrors} lỗi
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="h-10 max-w-[280px] rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {projects.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#1e3a8a] bg-[#1e40af] text-[11px] font-bold uppercase tracking-[0.04em] text-white">
                {projectSummaryColumns.map((col) => (
                  <th key={col.key} className="px-3 py-2.5">
                    {col.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-[#e8eef8] bg-[#f8fafc] text-[10.5px] italic text-[#64748b]">
                {projectSummaryColumns.map((col) => (
                  <th key={col.key} className="px-3 py-2 font-normal">
                    {col.hint}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <SummaryRow key={row.id} row={row} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[#64748b]">
                    Không tìm thấy bản ghi phù hợp.
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
      <td className="px-3 py-3 text-center text-[#334155]">{formatVolumeCell(data.fbw) || "—"}</td>
      <td className="px-3 py-3 text-center text-[#334155]">{formatVolumeCell(data.atw) || "—"}</td>
      <td className="px-3 py-3 text-center font-semibold text-[#0f172a]">
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
      <div className="mb-4 rounded-xl border border-[#dbeafe] bg-[#eff6ff] px-4 py-3 text-[13px] text-[#1e40af]">
        <strong>Mẫu 3 – Tổng hợp khối lượng theo năm:</strong> nhập số mối hàn FBW/ATW cho từng
        nhóm (Thử nghiệm–Đào tạo, Sản xuất, Lỗi). Cột Tổng = FBW + ATW.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#475569]">
        <span>
          <strong className="text-[#0f172a]">{historicalVolumeSummary.length}</strong> năm (2017–2026)
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#0f172a]">{filledYears}</strong> năm có dữ liệu mẫu
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-[#fecaca] bg-white px-4 py-4 text-center">
          <h2 className="text-[16px] font-bold uppercase tracking-wide text-[#dc2626]">
            {volumeSummaryTitle}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#1e3a8a] bg-[#1e40af] text-[11px] font-bold uppercase tracking-[0.03em] text-white">
                <th rowSpan={2} className="w-12 border-r border-[#2563eb] px-3 py-2.5 text-center">
                  TT
                </th>
                <th rowSpan={2} className="min-w-[100px] border-r border-[#2563eb] px-3 py-2.5 text-center">
                  Thời gian thực hiện
                </th>
                <th colSpan={3} className="border-r border-[#2563eb] px-3 py-2.5 text-center">
                  Mối hàn thử nghiệm – đào tạo
                </th>
                <th colSpan={3} className="border-r border-[#2563eb] px-3 py-2.5 text-center">
                  Mối hàn sản xuất
                </th>
                <th colSpan={3} className="border-r border-[#2563eb] px-3 py-2.5 text-center">
                  Mối hàn lỗi
                </th>
                <th rowSpan={2} className="min-w-[180px] px-3 py-2.5 text-center">
                  Nguyên nhân lỗi
                </th>
              </tr>
              <tr className="border-b border-[#1e3a8a] bg-[#2563eb] text-[10.5px] font-semibold uppercase text-white">
                {(["FBW", "ATW", "Tổng"] as const).map((label) => (
                  <th key={`trial-${label}`} className="border-r border-[#3b82f6] px-2 py-2 text-center">
                    {label}
                  </th>
                ))}
                {(["FBW", "ATW", "Tổng"] as const).map((label) => (
                  <th key={`prod-${label}`} className="border-r border-[#3b82f6] px-2 py-2 text-center">
                    {label}
                  </th>
                ))}
                {(["FBW", "ATW", "Tổng"] as const).map((label) => (
                  <th key={`def-${label}`} className="border-r border-[#3b82f6] px-2 py-2 text-center">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
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
    <tr className={`border-b border-[#e8eef8] ${striped ? "bg-[#f8fafc]" : "bg-white"} hover:bg-[#eff6ff]`}>
      <td className="px-3 py-3 text-center text-[#64748b]">{row.no}</td>
      <td className="px-3 py-3 text-center font-semibold text-[#0f172a]">{row.year}</td>
      <VolumeMethodCells data={row.trialTraining} />
      <VolumeMethodCells data={row.production} />
      <VolumeMethodCells data={row.defective} />
      <td className="px-3 py-3 text-[#334155]">
        {row.errorReason || <span className="text-[#94a3b8]">—</span>}
      </td>
    </tr>
  );
}

function SummaryRow({ row }: { row: HistoricalProjectSummary }) {
  return (
    <tr className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
      <td className="px-3 py-3 text-center text-[#64748b]">{row.no}</td>
      <td className="px-3 py-3 font-semibold text-[#0f172a]">{row.project}</td>
      <td className="px-3 py-3 text-[#334155]">{row.year}</td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${
            row.weldCategory === "PD" ? "bg-[#fff4dd] text-[#b26a00]" : "bg-[#e8eef8] text-[#0047AB]"
          }`}
          title={weldCategoryLabel[row.weldCategory]}
        >
          {row.weldCategory}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="inline-flex rounded bg-[#e8eef8] px-2 py-0.5 text-[11px] font-semibold text-[#0047AB]">
          {row.technology}
        </span>
      </td>
      <td className="px-3 py-3 font-medium text-[#0f172a]">{row.weldCount.toLocaleString("vi-VN")}</td>
      <td className="px-3 py-3">
        <span
          className={`font-semibold ${row.errorCount > 0 ? "text-[#dc2626]" : "text-[#15803d]"}`}
        >
          {row.errorCount}
        </span>
      </td>
      <td className="px-3 py-3 font-medium text-[#0f172a]">{row.welderName}</td>
      <td className="px-3 py-3 text-[#334155]">
        {row.errorReason || <span className="text-[#94a3b8]">—</span>}
      </td>
    </tr>
  );
}

export default function BulkImportList() {
  const [tab, setTab] = useState<ImportTab>("detail");

  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[#d9e2f1] bg-white p-1">
          <button
            type="button"
            onClick={() => setTab("detail")}
            className={`rounded-md px-4 py-2 text-[13px] font-semibold transition ${
              tab === "detail" ? "bg-[#0047AB] text-white" : "text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            Chi tiết mối hàn
          </button>
          <button
            type="button"
            onClick={() => setTab("summary")}
            className={`rounded-md px-4 py-2 text-[13px] font-semibold transition ${
              tab === "summary" ? "bg-[#0047AB] text-white" : "text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            Tổng hợp theo dự án
          </button>
          <button
            type="button"
            onClick={() => setTab("volume")}
            className={`rounded-md px-4 py-2 text-[13px] font-semibold transition ${
              tab === "volume" ? "bg-[#0047AB] text-white" : "text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            Tổng hợp khối lượng
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Tải mẫu Excel
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
          >
            + Import file
          </button>
        </div>
      </div>

      {tab === "detail" && <DetailImportTable />}
      {tab === "summary" && <SummaryImportTable />}
      {tab === "volume" && <VolumeImportTable />}
    </main>
  );
}
