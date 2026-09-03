"use client";

import { useMemo, useState } from "react";
import { useTongMoiHanNam } from "@/hooks/useTongMoiHanNam";
import type {
  TongMoiHanNamDuAnRow,
  TongMoiHanNamNhanSuRow,
  TongMoiHanNamRow,
} from "@/lib/tongMoiHanNamDb";

type ViewMode = "nam" | "du-an" | "nhan-su";

function fmt(n: number) {
  return n.toLocaleString("vi-VN");
}

function pct(part: number, total: number) {
  if (total <= 0) return "—";
  return `${((part / total) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

function YearSummaryTable({ rows }: { rows: TongMoiHanNamRow[] }) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.nam - a.nam),
    [rows],
  );

  return (
    <div className="table-scroll overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <th className="px-3.5 py-3 font-semibold">Năm</th>
            <th className="px-3.5 py-3 text-right font-semibold">Tổng mối</th>
            <th className="px-3.5 py-3 text-right font-semibold">Đạt</th>
            <th className="px-3.5 py-3 text-right font-semibold">Lỗi</th>
            <th className="px-3.5 py-3 text-right font-semibold">Tỷ lệ đạt</th>
            <th className="px-3.5 py-3 text-right font-semibold">FBW</th>
            <th className="px-3.5 py-3 text-right font-semibold">ATW</th>
            <th className="px-3.5 py-3 text-right font-semibold">Sản xuất</th>
            <th className="px-3.5 py-3 text-right font-semibold">Thử nghiệm</th>
            <th className="px-3.5 py-3 text-right font-semibold">Đào tạo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((row) => (
            <tr key={row.nam} className="text-slate-700 hover:bg-slate-50/80 transition-colors">
              <td className="px-3.5 py-2.5 font-semibold text-slate-900">{row.nam}</td>
              <td className="px-3.5 py-2.5 text-right font-mono font-semibold tabular-nums text-[#0047AB]">
                {fmt(row.tong_moi_han)}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-emerald-700">
                {fmt(row.tong_dat)}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-rose-700">
                {fmt(row.tong_loi)}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-800">
                {pct(row.tong_dat, row.tong_moi_han)}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{fmt(row.fbw)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{fmt(row.atw)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{fmt(row.san_xuat)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{fmt(row.thu_nghiem)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{fmt(row.dao_tao)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3.5 py-10 text-center text-sm text-slate-500">
                Chưa có dữ liệu tổng hợp theo năm. Chạy <code className="font-mono text-xs">supabase/tong_moi_han_nam.sql</code>.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProjectYearTable({ rows }: { rows: TongMoiHanNamDuAnRow[] }) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.nam - a.nam || a.du_an.localeCompare(b.du_an, "vi")),
    [rows],
  );

  return (
    <div className="table-scroll overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <th className="px-3.5 py-3 font-semibold">Năm</th>
            <th className="px-3.5 py-3 font-semibold">Dự án</th>
            <th className="px-3.5 py-3 text-right font-semibold">Tổng mối</th>
            <th className="px-3.5 py-3 text-right font-semibold">Đạt</th>
            <th className="px-3.5 py-3 text-right font-semibold">Lỗi</th>
            <th className="px-3.5 py-3 text-right font-semibold">Tỷ lệ đạt</th>
            <th className="px-3.5 py-3 text-right font-semibold">FBW</th>
            <th className="px-3.5 py-3 text-right font-semibold">ATW</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((row) => (
            <tr
              key={`${row.nam}-${row.du_an_id}`}
              className="text-slate-700 hover:bg-slate-50/80 transition-colors"
            >
              <td className="px-3.5 py-2.5 font-semibold text-slate-900">{row.nam}</td>
              <td className="px-3.5 py-2.5 max-w-[320px]">
                <span className="line-clamp-2 font-medium text-slate-800" title={row.du_an}>
                  {row.du_an}
                </span>
                {row.ma_du_an ? (
                  <span className="mt-0.5 block font-mono text-[11px] text-slate-400">{row.ma_du_an}</span>
                ) : null}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono font-semibold tabular-nums text-[#0047AB]">
                {fmt(row.tong_moi_han)}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-emerald-700">
                {fmt(row.tong_dat)}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-rose-700">
                {fmt(row.tong_loi)}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                {pct(row.tong_dat, row.tong_moi_han)}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{fmt(row.fbw)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{fmt(row.atw)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3.5 py-10 text-center text-sm text-slate-500">
                Chưa có dữ liệu theo dự án.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PersonnelYearTable({ rows }: { rows: TongMoiHanNamNhanSuRow[] }) {
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => b.nam - a.nam || b.tong_moi_han - a.tong_moi_han || a.ten_tho_han.localeCompare(b.ten_tho_han, "vi"),
      ),
    [rows],
  );

  return (
    <div className="table-scroll overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <th className="px-3.5 py-3 font-semibold">Năm</th>
            <th className="px-3.5 py-3 font-semibold">Nhân sự</th>
            <th className="px-3.5 py-3 text-right font-semibold">Tổng mối</th>
            <th className="px-3.5 py-3 text-right font-semibold">Đạt</th>
            <th className="px-3.5 py-3 text-right font-semibold">Lỗi</th>
            <th className="px-3.5 py-3 text-right font-semibold">Tỷ lệ đạt</th>
            <th className="px-3.5 py-3 text-right font-semibold">FBW</th>
            <th className="px-3.5 py-3 text-right font-semibold">ATW</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((row) => (
            <tr
              key={`${row.nam}-${row.tho_han_id}`}
              className="text-slate-700 hover:bg-slate-50/80 transition-colors"
            >
              <td className="px-3.5 py-2.5 font-semibold text-slate-900">{row.nam}</td>
              <td className="px-3.5 py-2.5">
                <span className="font-medium text-slate-800">{row.ten_tho_han}</span>
                {row.ma_nhan_su ? (
                  <span className="mt-0.5 block font-mono text-[11px] text-slate-400">{row.ma_nhan_su}</span>
                ) : null}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono font-semibold tabular-nums text-[#0047AB]">
                {fmt(row.tong_moi_han)}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-emerald-700">
                {fmt(row.tong_dat)}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-rose-700">
                {fmt(row.tong_loi)}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                {pct(row.tong_dat, row.tong_moi_han)}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{fmt(row.fbw)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{fmt(row.atw)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3.5 py-10 text-center text-sm text-slate-500">
                Chưa có dữ liệu theo nhân sự.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function YearlyWeldReport() {
  const { years, byProject, byPersonnel, loading, error, source } = useTongMoiHanNam();
  const [view, setView] = useState<ViewMode>("nam");

  const totals = useMemo(() => {
    return years.reduce(
      (acc, row) => {
        acc.tong += row.tong_moi_han;
        acc.dat += row.tong_dat;
        acc.loi += row.tong_loi;
        return acc;
      },
      { tong: 0, dat: 0, loi: 0 },
    );
  }, [years]);

  const rowCount =
    view === "nam" ? years.length : view === "du-an" ? byProject.length : byPersonnel.length;

  return (
    <main className="mx-auto max-w-[1568px] px-4 sm:px-6 pb-8">
      <div
        className={`mb-4 rounded-lg border px-3 py-2 text-xs font-medium ${
          error
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-blue-200 bg-blue-50 text-[#0047AB]"
        }`}
      >
        {error
          ? `Không tải được tổng hợp năm: ${error}`
          : loading
            ? "Đang tải báo cáo mối hàn theo năm…"
            : `Supabase · bảng tong_moi_han_nam · ${years.length} năm · nguồn ${source}`}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{fmt(totals.tong)}</strong> mối hàn
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{fmt(totals.dat)}</strong> đạt ·{" "}
          <strong className="font-semibold text-rose-700 font-mono tabular-nums">{fmt(totals.loi)}</strong> lỗi
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Tỷ lệ đạt{" "}
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">
            {pct(totals.dat, totals.tong)}
          </strong>
        </span>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              BÁO CÁO MỐI HÀN THEO NĂM
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Dữ liệu tổng hợp sẵn từ nhật ký hàn — tải nhanh, không kéo toàn bộ lịch sử.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(
              [
                { id: "nam", label: "Theo năm" },
                { id: "du-an", label: "Theo dự án" },
                { id: "nhan-su", label: "Theo nhân sự" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  view === item.id
                    ? "bg-white text-[#0047AB] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#0047AB]">
            {loading ? "Đang tải…" : `${fmt(rowCount)} dòng`}
          </span>
        </div>

        <div className="mt-3.5">
          {view === "nam" && <YearSummaryTable rows={years} />}
          {view === "du-an" && <ProjectYearTable rows={byProject} />}
          {view === "nhan-su" && <PersonnelYearTable rows={byPersonnel} />}
        </div>
      </div>
    </main>
  );
}
