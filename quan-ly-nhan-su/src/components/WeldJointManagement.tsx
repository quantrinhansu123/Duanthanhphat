"use client";

import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass } from "@/components/icons";
import {
  formatJournalDateIso,
  loadJournalProjectOptions,
  loadWeldJournalPage,
  type WeldReportRow,
} from "@/lib/weldReportData";
import { hasCertificate } from "@/lib/weldingCertificates";

const PAGE_SIZE = 50;

const weldTypeStyle: Record<WeldReportRow["loai_moi_han"], string> = {
  "Thử nghiệm": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  "Đào tạo": "bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs",
  "Sản xuất": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
};

export default function WeldJointManagement() {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [project, setProject] = useState("Tất cả dự án");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<WeldReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [passCount, setPassCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    loadJournalProjectOptions()
      .then((options) => {
        if (active) setProjects(options);
      })
      .catch(() => {
        if (active) setProjects([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadWeldJournalPage({ page, pageSize: PAGE_SIZE, query: appliedQuery, project })
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setPassCount(result.passCount);
        setFailCount(result.failCount);
      })
      .catch((loadError) => {
        if (!active) return;
        setRows([]);
        setTotal(0);
        setPassCount(0);
        setFailCount(0);
        setError(loadError instanceof Error ? loadError.message : "Không tải được danh sách mối hàn");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, appliedQuery, project]);

  useEffect(() => setPage(1), [appliedQuery, project]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageFrom = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageTo = Math.min(currentPage * PAGE_SIZE, total);
  const linkedCertificateCount = useMemo(
    () => rows.filter((row) =>
      Boolean(row.chung_chi_su_dung) && hasCertificate(row.chung_chi_nhan_su, row.chung_chi_su_dung ?? ""),
    ).length,
    [rows],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <main className="mx-auto max-w-[1568px] px-4 sm:px-6 pb-8">
      <div className={`mb-4 rounded-lg border px-3 py-2 text-xs font-medium ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-[#0047AB]"}`}>
        {error
          ? `Không tải được Supabase: ${error}`
          : loading
            ? "Đang tải mối hàn và nhân sự…"
            : `Supabase · ${total.toLocaleString("vi-VN")} mối hàn · liên kết nhân sự bằng employee_id`}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span><strong className="font-mono font-semibold text-slate-900">{total.toLocaleString("vi-VN")}</strong> mối hàn</span>
        <span className="text-slate-300">|</span>
        <span><strong className="font-mono text-emerald-700">{passCount.toLocaleString("vi-VN")}</strong> đạt · <strong className="font-mono text-rose-700">{failCount.toLocaleString("vi-VN")}</strong> không đạt</span>
        <span className="text-slate-300">|</span>
        <span><strong className="font-mono text-[#0047AB]">{linkedCertificateCount}/{rows.length}</strong> dòng trang này có chứng chỉ sử dụng khớp hồ sơ</span>
      </div>

      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
        <div className="relative min-w-[260px] flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mã mối hàn, mã/tên nhân sự, máy, dự án, chứng chỉ…"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
          />
        </div>
        <select
          value={project}
          onChange={(event) => setProject(event.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
        >
          <option>Tất cả dự án</option>
          {projects.map((item) => <option key={item.id} value={item.label}>{item.label}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1320px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="min-w-[170px] px-3.5 py-3">Mã mối hàn</th>
                <th className="min-w-[125px] px-3.5 py-3">Ngày</th>
                <th className="min-w-[210px] px-3.5 py-3">Nhân sự</th>
                <th className="min-w-[90px] px-3.5 py-3">Công nghệ</th>
                <th className="min-w-[120px] px-3.5 py-3">Loại ray</th>
                <th className="min-w-[120px] px-3.5 py-3">Loại mối</th>
                <th className="min-w-[300px] px-3.5 py-3">Chứng chỉ sử dụng</th>
                <th className="min-w-[220px] px-3.5 py-3">Dự án</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const certificate = row.chung_chi_su_dung?.trim();
                const certificateLinked = certificate
                  ? hasCertificate(row.chung_chi_nhan_su, certificate)
                  : false;
                return (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-3.5 py-3 font-mono font-semibold text-[#0047AB]">{row.ma_lich_su}</td>
                    <td className="px-3.5 py-3 whitespace-nowrap font-mono text-slate-600">
                      {row.ngay_thuc_hien ? formatJournalDateIso(row.ngay_thuc_hien.slice(0, 10)) : `Năm ${row.nam_thuc_hien}`}
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="font-semibold text-slate-900">{row.ten_tho_han}</div>
                      <div className="mt-0.5 font-mono text-xs text-[#0047AB]">{row.ma_nhan_su || "Chưa có mã"}</div>
                    </td>
                    <td className="px-3.5 py-3"><span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#0047AB]">{row.cong_nghe_han}</span></td>
                    <td className="px-3.5 py-3 font-mono">{row.loai_ray}</td>
                    <td className="px-3.5 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${weldTypeStyle[row.loai_moi_han]}`}>{row.loai_moi_han}</span></td>
                    <td className="px-3.5 py-3">
                      <div className={`text-xs font-medium ${certificateLinked ? "text-emerald-700" : "text-amber-700"}`}>
                        {certificate || "Chưa ghi chứng chỉ sử dụng"}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {certificateLinked
                          ? "Khớp hồ sơ nhân sự"
                          : `${row.chung_chi_nhan_su?.length ?? 0} chứng chỉ trên hồ sơ nhân sự`}
                      </div>
                    </td>
                    <td className="px-3.5 py-3"><span className="line-clamp-2" title={row.du_an}>{row.du_an}</span></td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">Không có mối hàn phù hợp.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">Đang tải dữ liệu…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <div className="text-xs text-slate-500">Hiển thị <strong>{pageFrom}–{pageTo}</strong> / {total.toLocaleString("vi-VN")} · Trang {currentPage}/{totalPages}</div>
          <div className="flex gap-2">
            <button type="button" disabled={currentPage <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40">Trước</button>
            <button type="button" disabled={currentPage >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40">Sau</button>
          </div>
        </div>
      </div>
    </main>
  );
}
