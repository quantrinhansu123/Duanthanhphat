"use client";

import { useMemo, useState } from "react";
import { useReportFilters } from "@/contexts/ReportFilterContext";
import { useWeldReportData } from "@/hooks/useWeldReportData";
import { filterWeldReportRows, type WeldReportRow } from "@/lib/weldReportData";
import type {
  TongMoiHanNamDuAnRow,
  TongMoiHanNamNhanSuRow,
  TongMoiHanNamRow,
} from "@/lib/tongMoiHanNamDb";

type ViewMode = "nam" | "du-an" | "nhan-su";

function emptyYearRow(year: number): TongMoiHanNamRow {
  return {
    nam: year, tong_moi_han: 0, tong_loi: 0, tong_dat: 0,
    fbw: 0, atw: 0, loi_fbw: 0, loi_atw: 0,
    san_xuat: 0, thu_nghiem: 0, dao_tao: 0,
    loi_san_xuat: 0, loi_thu_nghiem: 0, loi_dao_tao: 0,
  };
}

function addWeld(row: TongMoiHanNamRow, weld: WeldReportRow) {
  const total = Number(weld.so_luong_thuc_hien || 0);
  const errors = Number(weld.so_luong_loi || 0);
  row.tong_moi_han += total;
  row.tong_loi += errors;
  row.tong_dat += total - errors;
  if (weld.cong_nghe_han === "FBW") {
    row.fbw += total;
    row.loi_fbw += errors;
  } else {
    row.atw += total;
    row.loi_atw += errors;
  }
  if (weld.loai_moi_han === "Sản xuất") {
    row.san_xuat += total;
    row.loi_san_xuat += errors;
  } else if (weld.loai_moi_han === "Thử nghiệm") {
    row.thu_nghiem += total;
    row.loi_thu_nghiem += errors;
  } else {
    row.dao_tao += total;
    row.loi_dao_tao += errors;
  }
}

function buildYearReportRows(rows: WeldReportRow[]) {
  const years = new Map<number, TongMoiHanNamRow>();
  const projects = new Map<string, TongMoiHanNamDuAnRow>();
  const personnel = new Map<string, TongMoiHanNamNhanSuRow>();

  for (const weld of rows) {
    const year = weld.nam_thuc_hien;
    const yearRow = years.get(year) ?? emptyYearRow(year);
    addWeld(yearRow, weld);
    years.set(year, yearRow);

    const projectKey = `${year}\0${weld.du_an_id}`;
    const projectRow = projects.get(projectKey) ?? {
      ...emptyYearRow(year), du_an_id: weld.du_an_id, ma_du_an: weld.ma_du_an || null, du_an: weld.du_an,
    };
    addWeld(projectRow, weld);
    projects.set(projectKey, projectRow);

    const personnelKey = `${year}\0${weld.tho_han_id}`;
    const personnelRow = personnel.get(personnelKey) ?? {
      ...emptyYearRow(year), tho_han_id: weld.tho_han_id, ma_nhan_su: weld.ma_nhan_su || null, ten_tho_han: weld.ten_tho_han,
    };
    addWeld(personnelRow, weld);
    personnel.set(personnelKey, personnelRow);
  }

  return { years: [...years.values()], byProject: [...projects.values()], byPersonnel: [...personnel.values()] };
}

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
  const { appliedFilters } = useReportFilters();
  // Không lọc ngày tại nguồn: lịch sử chỉ có năm vẫn phải được hạch toán đúng theo năm.
  const { rows, loading, error } = useWeldReportData();
  const [view, setView] = useState<ViewMode>("nam");
  const selectedRows = useMemo(() => filterWeldReportRows(rows, appliedFilters), [rows, appliedFilters]);
  const { years, byProject, byPersonnel } = useMemo(() => buildYearReportRows(selectedRows), [selectedRows]);

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
    <main className="w-full px-4 sm:px-6 pb-8">
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
            : `Nhật ký hàn Supabase · ${selectedRows.length.toLocaleString("vi-VN")} bản ghi đã lọc · ${years.length} năm`}
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
              Tổng hợp trực tiếp từ nhật ký hàn theo bộ lọc hiện tại.
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
