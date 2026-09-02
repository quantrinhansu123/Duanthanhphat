"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ImportTab = "projects" | "welders" | "years";

type ProjectWeldRow = {
  id: string;
  ma_lich_su: string;
  ma_du_an: string;
  du_an: string;
  nam_thuc_hien: number;
  loai_ray: string;
  loai_moi_han: "Thử nghiệm" | "Đào tạo" | "Sản xuất";
  cong_nghe_han: "FBW" | "ATW";
  so_luong_thuc_hien: number;
  so_luong_loi: number;
  ma_nhan_su: string;
  ten_tho_han: string;
  nguyen_nhan_loi: string | null;
};

type WelderSummaryRow = {
  tho_han_id: string;
  ma_nhan_su: string;
  ho_ten: string;
  thuc_hien_fbw: number;
  thuc_hien_atw: number;
  loi_fbw: number;
  loi_atw: number;
  tong_thuc_hien: number;
  tong_loi: number;
};

type YearSummaryRow = {
  nam_thuc_hien: number;
  thu_nghiem_dao_tao_fbw: number;
  thu_nghiem_dao_tao_atw: number;
  san_xuat_fbw: number;
  san_xuat_atw: number;
  loi_fbw: number;
  loi_atw: number;
  tong_thuc_hien: number;
  tong_loi: number;
};

type WeldData = {
  projects: ProjectWeldRow[];
  welders: WelderSummaryRow[];
  years: YearSummaryRow[];
};

const numberFormatter = new Intl.NumberFormat("vi-VN");

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function MethodBadge({ method }: { method: "FBW" | "ATW" }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        method === "FBW"
          ? "border-blue-200 bg-blue-50 text-[#0047AB]"
          : "border-violet-200 bg-violet-50 text-violet-700"
      }`}
    >
      {method}
    </span>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "blue" | "red" }) {
  const color = tone === "red" ? "text-rose-700" : tone === "blue" ? "text-[#0047AB]" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-xl font-bold tabular-nums ${color}`}>{formatNumber(value)}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-xs">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#0047AB]" />
      <div className="mt-3 text-sm font-semibold text-slate-700">Đang tải dữ liệu từ Supabase...</div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center shadow-xs">
      <div className="text-sm font-semibold text-rose-800">Không tải được dữ liệu Supabase</div>
      <div className="mx-auto mt-1 max-w-2xl text-xs text-rose-700">{message}</div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 h-9 rounded-lg bg-rose-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-rose-800"
      >
        Thử lại
      </button>
    </div>
  );
}

function ProjectTable({ rows }: { rows: ProjectWeldRow[] }) {
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("Tất cả dự án");
  const [year, setYear] = useState("Tất cả năm");

  const projects = useMemo(
    () => ["Tất cả dự án", ...Array.from(new Set(rows.map((row) => row.du_an))).sort()],
    [rows],
  );
  const years = useMemo(
    () => ["Tất cả năm", ...Array.from(new Set(rows.map((row) => row.nam_thuc_hien))).sort((a, b) => b - a).map(String)],
    [rows],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    return rows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        row.ma_lich_su.toLocaleLowerCase("vi").includes(normalizedQuery) ||
        row.du_an.toLocaleLowerCase("vi").includes(normalizedQuery) ||
        row.ten_tho_han.toLocaleLowerCase("vi").includes(normalizedQuery) ||
        row.loai_ray.toLocaleLowerCase("vi").includes(normalizedQuery);
      const matchesProject = project === "Tất cả dự án" || row.du_an === project;
      const matchesYear = year === "Tất cả năm" || row.nam_thuc_hien === Number(year);
      return matchesQuery && matchesProject && matchesYear;
    });
  }, [project, query, rows, year]);

  const total = filtered.reduce((sum, row) => sum + row.so_luong_thuc_hien, 0);
  const errors = filtered.reduce((sum, row) => sum + row.so_luong_loi, 0);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Dòng dữ liệu" value={filtered.length} />
        <StatCard label="Tổng mối hàn" value={total} tone="blue" />
        <StatCard label="Tổng lỗi" value={errors} tone="red" />
        <StatCard label="Số dự án" value={new Set(filtered.map((row) => row.ma_du_an)).size} />
      </div>

      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
        <div className="relative min-w-[240px] flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mã, dự án, loại ray, thợ hàn..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 outline-hidden transition-all focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
          />
        </div>
        <select value={project} onChange={(event) => setProject(event.target.value)} className="h-10 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:max-w-[360px] sm:text-sm">
          {projects.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={year} onChange={(event) => setYear(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm">
          {years.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-[#0047AB] text-xs font-bold uppercase tracking-wide text-white">
              <tr>
                <th className="px-3 py-3">Mã</th>
                <th className="px-3 py-3">Dự án</th>
                <th className="px-3 py-3 text-center">Năm</th>
                <th className="px-3 py-3">Loại ray</th>
                <th className="px-3 py-3">Loại mối</th>
                <th className="px-3 py-3 text-center">Công nghệ</th>
                <th className="px-3 py-3 text-right">Thực hiện</th>
                <th className="px-3 py-3 text-right">Lỗi</th>
                <th className="px-3 py-3">Thợ hàn</th>
                <th className="px-3 py-3">Nguyên nhân lỗi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-blue-50/50">
                  <td className="px-3 py-3 font-mono font-semibold text-[#0047AB]">{row.ma_lich_su}</td>
                  <td className="max-w-[320px] px-3 py-3 font-medium text-slate-900">{row.du_an}</td>
                  <td className="px-3 py-3 text-center font-mono text-slate-700">{row.nam_thuc_hien}</td>
                  <td className="px-3 py-3 font-mono text-slate-700">{row.loai_ray}</td>
                  <td className="px-3 py-3 text-slate-700">{row.loai_moi_han}</td>
                  <td className="px-3 py-3 text-center"><MethodBadge method={row.cong_nghe_han} /></td>
                  <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">{formatNumber(row.so_luong_thuc_hien)}</td>
                  <td className={`px-3 py-3 text-right font-mono font-semibold tabular-nums ${row.so_luong_loi > 0 ? "text-rose-700" : "text-slate-400"}`}>{formatNumber(row.so_luong_loi)}</td>
                  <td className="px-3 py-3 font-medium text-slate-900">{row.ten_tho_han}</td>
                  <td className="px-3 py-3 text-slate-600">{row.nguyen_nhan_loi || <span className="text-slate-400">—</span>}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">Không tìm thấy dữ liệu phù hợp.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function WelderTable({ rows }: { rows: WelderSummaryRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.tong_thuc_hien, 0);
  const errors = rows.reduce((sum, row) => sum + row.tong_loi, 0);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Số thợ hàn" value={rows.length} />
        <StatCard label="Tổng mối hàn" value={total} tone="blue" />
        <StatCard label="Tổng lỗi" value={errors} tone="red" />
        <StatCard label="Tỷ lệ lỗi (‰)" value={total > 0 ? Math.round((errors / total) * 1000) : 0} />
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#0047AB] text-xs font-bold uppercase tracking-wide text-white">
                <th rowSpan={2} className="border-r border-blue-600 px-4 py-3">Mã thợ</th>
                <th rowSpan={2} className="border-r border-blue-600 px-4 py-3">Tên thợ hàn</th>
                <th colSpan={3} className="border-r border-blue-600 px-4 py-3 text-center">Số mối thực hiện</th>
                <th colSpan={3} className="px-4 py-3 text-center">Lỗi</th>
              </tr>
              <tr className="bg-blue-700 text-[11px] font-semibold uppercase text-white">
                {["FBW", "ATW", "Tổng", "FBW", "ATW", "Tổng"].map((label, index) => <th key={`${label}-${index}`} className="border-r border-blue-500 px-3 py-2 text-right">{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.tho_han_id} className="transition-colors hover:bg-blue-50/50">
                  <td className="px-4 py-3 font-mono font-semibold text-[#0047AB]">{row.ma_nhan_su}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.ho_ten}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(row.thuc_hien_fbw)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(row.thuc_hien_atw)}</td>
                  <td className="bg-slate-50 px-3 py-3 text-right font-mono font-bold tabular-nums text-slate-900">{formatNumber(row.tong_thuc_hien)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-rose-700">{formatNumber(row.loi_fbw)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-rose-700">{formatNumber(row.loi_atw)}</td>
                  <td className="bg-rose-50/60 px-3 py-3 text-right font-mono font-bold tabular-nums text-rose-700">{formatNumber(row.tong_loi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function YearTable({ rows }: { rows: YearSummaryRow[] }) {
  const totals = rows.reduce(
    (acc, row) => ({
      trialFbw: acc.trialFbw + row.thu_nghiem_dao_tao_fbw,
      trialAtw: acc.trialAtw + row.thu_nghiem_dao_tao_atw,
      productionFbw: acc.productionFbw + row.san_xuat_fbw,
      productionAtw: acc.productionAtw + row.san_xuat_atw,
      errorFbw: acc.errorFbw + row.loi_fbw,
      errorAtw: acc.errorAtw + row.loi_atw,
      total: acc.total + row.tong_thuc_hien,
      errors: acc.errors + row.tong_loi,
    }),
    { trialFbw: 0, trialAtw: 0, productionFbw: 0, productionAtw: 0, errorFbw: 0, errorAtw: 0, total: 0, errors: 0 },
  );

  const renderCells = (fbw: number, atw: number, emphasize = false) => (
    <>
      <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(fbw)}</td>
      <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(atw)}</td>
      <td className={`px-3 py-3 text-right font-mono font-bold tabular-nums ${emphasize ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-900"}`}>{formatNumber(fbw + atw)}</td>
    </>
  );

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Số năm" value={rows.length} />
        <StatCard label="Tổng mối hàn" value={totals.total} tone="blue" />
        <StatCard label="Tổng FBW" value={totals.trialFbw + totals.productionFbw} />
        <StatCard label="Tổng ATW" value={totals.trialAtw + totals.productionAtw} />
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-200 px-4 py-4 text-center">
          <h2 className="text-sm font-bold uppercase tracking-wide text-rose-700 sm:text-base">Tổng hợp khối lượng mối hàn ray đã thực hiện</h2>
        </div>
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#0047AB] text-xs font-bold uppercase tracking-wide text-white">
                <th rowSpan={2} className="border-r border-blue-600 px-3 py-3 text-center">Năm</th>
                <th colSpan={3} className="border-r border-blue-600 px-3 py-3 text-center">Thử nghiệm – đào tạo</th>
                <th colSpan={3} className="border-r border-blue-600 px-3 py-3 text-center">Sản xuất</th>
                <th colSpan={3} className="px-3 py-3 text-center">Lỗi</th>
              </tr>
              <tr className="bg-blue-700 text-[11px] font-semibold uppercase text-white">
                {["FBW", "ATW", "Tổng", "FBW", "ATW", "Tổng", "FBW", "ATW", "Tổng"].map((label, index) => <th key={`${label}-${index}`} className="border-r border-blue-500 px-3 py-2 text-right">{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.nam_thuc_hien} className="transition-colors hover:bg-blue-50/50">
                  <td className="px-3 py-3 text-center font-mono font-semibold text-slate-900">{row.nam_thuc_hien}</td>
                  {renderCells(row.thu_nghiem_dao_tao_fbw, row.thu_nghiem_dao_tao_atw)}
                  {renderCells(row.san_xuat_fbw, row.san_xuat_atw)}
                  {renderCells(row.loi_fbw, row.loi_atw, true)}
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
                <td className="px-3 py-3 text-center uppercase">Tổng</td>
                {renderCells(totals.trialFbw, totals.trialAtw)}
                {renderCells(totals.productionFbw, totals.productionAtw)}
                {renderCells(totals.errorFbw, totals.errorAtw, true)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function BulkImportList() {
  const [tab, setTab] = useState<ImportTab>("projects");
  const [data, setData] = useState<WeldData>({ projects: [], welders: [], years: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const supabase = createClient();
        const [projectResult, welderResult, yearResult] = await Promise.all([
          supabase
            .from("bao_cao_moi_han_theo_du_an")
            .select("id,ma_lich_su,ma_du_an,du_an,nam_thuc_hien,loai_ray,loai_moi_han,cong_nghe_han,so_luong_thuc_hien,so_luong_loi,ma_nhan_su,ten_tho_han,nguyen_nhan_loi")
            .order("nam_thuc_hien", { ascending: false })
            .order("ma_lich_su", { ascending: true }),
          supabase
            .from("bao_cao_moi_han_theo_tho")
            .select("tho_han_id,ma_nhan_su,ho_ten,thuc_hien_fbw,thuc_hien_atw,loi_fbw,loi_atw,tong_thuc_hien,tong_loi")
            .order("ma_nhan_su", { ascending: true }),
          supabase
            .from("bao_cao_moi_han_theo_nam")
            .select("nam_thuc_hien,thu_nghiem_dao_tao_fbw,thu_nghiem_dao_tao_atw,san_xuat_fbw,san_xuat_atw,loi_fbw,loi_atw,tong_thuc_hien,tong_loi")
            .order("nam_thuc_hien", { ascending: true }),
        ]);

        const firstError = projectResult.error ?? welderResult.error ?? yearResult.error;
        if (firstError) throw firstError;

        if (active) {
          setData({
            projects: (projectResult.data ?? []) as ProjectWeldRow[],
            welders: (welderResult.data ?? []) as WelderSummaryRow[],
            years: (yearResult.data ?? []) as YearSummaryRow[],
          });
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Lỗi không xác định");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();
    return () => { active = false; };
  }, [reloadToken]);

  const tabs: Array<{ id: ImportTab; label: string; count: number }> = [
    { id: "projects", label: "Theo dự án", count: data.projects.length },
    { id: "welders", label: "Theo thợ hàn", count: data.welders.length },
    { id: "years", label: "Theo năm", count: data.years.length },
  ];

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-all sm:text-sm ${tab === item.id ? "bg-white text-[#0047AB] shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              {item.label}
              {!loading && <span className="ml-1.5 rounded-full bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{item.count}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Dữ liệu trực tiếp từ Supabase</span>
          <button type="button" onClick={() => setReloadToken((value) => value + 1)} disabled={loading} className="h-9 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50">Làm mới</button>
        </div>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={() => setReloadToken((value) => value + 1)} />}
      {!loading && !error && tab === "projects" && <ProjectTable rows={data.projects} />}
      {!loading && !error && tab === "welders" && <WelderTable rows={data.welders} />}
      {!loading && !error && tab === "years" && <YearTable rows={data.years} />}
    </main>
  );
}
