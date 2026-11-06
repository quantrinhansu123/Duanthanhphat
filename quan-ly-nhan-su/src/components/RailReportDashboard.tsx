"use client";

import { useMemo, useState } from "react";
import { Printer } from "@/components/icons";
import RailReportPrint, { type RailReportPrintPayload } from "@/components/RailReportPrint";
import { useReportFilters } from "@/contexts/ReportFilterContext";
import { useWeldReportData } from "@/hooks/useWeldReportData";
import {
  filterWeldReportRows,
  getJournalRowDateIso,
  resolveWeldTestStatus,
  type WeldReportRow,
} from "@/lib/weldReportData";
import { parseCoordinateCode } from "@/lib/weldCode";

/** Một dòng trong mẫu "Báo cáo ray": mỗi mối hàn là một thanh ray. */
type RailRow = {
  key: string;
  maLisp: string;      // Tên mối hàn theo thiết kế (mã Autolisp: TT0123…)
  maHienTruong: string; // Tên mối hàn tại hiện trường (mã hệ thống / mã hiện trường)
  lyTrinh: string;
  ngayHan: string;
  chieuDai: string;    // Chiều dài thanh ray (mm)
  tinhTrang: string;
  ghiChu: string;
};

const RAIL_LENGTH_MM = 24695; // Chiều dài thanh ray tiêu chuẩn 60R2 tại dự án Phú Quốc

const ROUTE_LABELS: Record<string, string> = {
  TT: "Tuyến thượng · Ray trái",
  TP: "Tuyến thượng · Ray phải",
  HT: "Tuyến hạ · Ray trái",
  HP: "Tuyến hạ · Ray phải",
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${Number(d)}/${Number(m)}/${y}` : "—";
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-04" → "4-Nov-26" (đúng định dạng mẫu theo dõi điển hình ray). */
function formatDateShortEn(iso: string | null | undefined) {
  const [y, m, d] = String(iso ?? "").slice(0, 10).split("-");
  const month = MONTHS_SHORT[Number(m) - 1];
  if (!y || !month || !d) return "—";
  return `${Number(d)}-${month}-${y.slice(-2)}`;
}

/**
 * "FBW 041126 001" — tên mối hàn tại hiện trường theo mẫu:
 * {công nghệ} {ddmmaa} {số thứ tự trong ngày, 3 chữ số}.
 * Nguồn: mã hiện trường (FBW-05-11-26-0015) → đổi sang ddmmaa và lấy 3 số cuối phần TT.
 */
function formatSiteWeldName(row: WeldReportRow): string {
  const method = (row.cong_nghe_han ?? "FBW").trim().toUpperCase();
  const iso = getJournalRowDateIso(row);
  const [, mm, dd] = String(iso ?? "").slice(0, 10).split("-");
  const ddmmaa = mm && dd ? `${dd}${mm}${String(iso).slice(2, 4)}` : "";

  // Mã hiện trường dạng FBW-05-11-26-0015 → lấy phần số thứ tự cuối.
  const raw = (row.ma_hien_truong ?? "").trim() || (row.ma_lich_su ?? "").trim();
  const seqMatch = /(\d+)$/.exec(raw);
  const seq = seqMatch ? String(Number(seqMatch[1])).padStart(3, "0") : "";

  return [method, ddmmaa, seq].filter(Boolean).join(" ");
}

function chainageSortKey(value: string) {
  const match = /(\d+)\+(\d+(?:\.\d+)?)/.exec(value ?? "");
  return match ? Number(match[1]) * 1000 + Number(match[2]) : Number.MAX_SAFE_INTEGER;
}

/** Đưa "Km3+837.77" về "Km3+837.77" (chuẩn hoá khoảng trắng, giữ 2 số lẻ tối thiểu). */
function normalizeChainage(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const match = /(\d+)\+(\d+(?:[.,]\d+)?)/.exec(raw);
  if (!match) return raw;
  return `Km${match[1]}+${match[2].replace(",", ".")}`;
}

function statusLabel(row: WeldReportRow) {
  const quality = row.tinh_trang_chat_luong;
  if (quality) return quality;
  return resolveWeldTestStatus(row);
}

export default function RailReportDashboard() {
  const { appliedFilters } = useReportFilters();
  const { rows, loading, error } = useWeldReportData();
  const [search, setSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState("Tất cả tuyến · ray");
  const [printPayload, setPrintPayload] = useState<RailReportPrintPayload | null>(null);

  const baseRows = useMemo(() => filterWeldReportRows(rows, appliedFilters), [rows, appliedFilters]);

  const railRows = useMemo<RailRow[]>(() => {
    return baseRows
      .map((row) => {
        const maLisp = (row.ma_diem ?? "").trim();
        const parsed = maLisp ? parseCoordinateCode(maLisp) : null;
        const route = parsed?.prefix ?? "";
        return {
          key: row.id,
          maLisp: maLisp || "—",
          maHienTruong: formatSiteWeldName(row),
          lyTrinh: normalizeChainage(row.ly_trinh),
          ngayHan: formatDateShortEn(getJournalRowDateIso(row)),
          chieuDai: String(RAIL_LENGTH_MM),
          tinhTrang: statusLabel(row),
          ghiChu: (row.ghi_chu ?? "").trim() || "—",
          route,
        };
      })
      .filter((row) => {
        if (routeFilter !== "Tất cả tuyến · ray" && ROUTE_LABELS[row.route] !== routeFilter) return false;
        const q = search.trim().toLocaleLowerCase("vi");
        if (!q) return true;
        return (
          row.maLisp.toLocaleLowerCase("vi").includes(q) ||
          row.maHienTruong.toLocaleLowerCase("vi").includes(q) ||
          row.lyTrinh.toLocaleLowerCase("vi").includes(q)
        );
      })
      .sort((a, b) => chainageSortKey(a.lyTrinh) - chainageSortKey(b.lyTrinh) || a.maLisp.localeCompare(b.maLisp, "vi"));
  }, [baseRows, search, routeFilter]);

  const routeOptions = useMemo(() => {
    const found = new Set<string>();
    for (const row of baseRows) {
      const parsed = row.ma_diem ? parseCoordinateCode(row.ma_diem) : null;
      if (parsed) found.add(ROUTE_LABELS[parsed.prefix]);
    }
    return Array.from(found).filter(Boolean).sort((a, b) => a.localeCompare(b, "vi"));
  }, [baseRows]);

  /** Mở bản in với đúng dữ liệu đang xem. */
  function openPrint() {
    setPrintPayload({
      rows: railRows,
      title: "THEO DÕI ĐIỂN HÀNH RAY",
      projectLabel:
        appliedFilters.projects.length === 1
          ? appliedFilters.projects[0]
          : appliedFilters.projects.length > 1
            ? `${appliedFilters.projects.length} dự án`
            : "Tất cả dự án",
      dateLabel:
        appliedFilters.dateFrom || appliedFilters.dateTo
          ? `${formatDate(appliedFilters.dateFrom)} – ${formatDate(appliedFilters.dateTo)}`
          : "Toàn bộ kỳ",
    });
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 px-3 py-3 text-slate-700 sm:px-5 sm:py-4 lg:px-6">
      <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-[#0047AB]"}`}>
        {error
          ? `Không tải được Supabase: ${error}`
          : loading
            ? "Đang tải dữ liệu nhật ký hàn…"
            : `${railRows.length.toLocaleString("vi-VN")} thanh ray · lấy từ Nhật ký hàn`}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <label className="min-w-[13rem] flex-1 text-xs font-semibold text-slate-600">
          Tìm mã mối / lý trình
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="TT0123, PQ-FBW-06-11-26-0001, Km3+837…"
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Tuyến · ray
          <select
            value={routeFilter}
            onChange={(event) => setRouteFilter(event.target.value)}
            className="mt-1 block h-10 min-w-[13rem] rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
          >
            <option>Tất cả tuyến · ray</option>
            {routeOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={openPrint}
          disabled={!railRows.length}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A] disabled:opacity-50"
        >
          <Printer size={16} weight="bold" aria-hidden />
          In báo cáo ray
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <th className="px-3 py-2.5">Tên mối hàn theo thiết kế</th>
              <th className="px-3 py-2.5">Tên mối hàn tại hiện trường</th>
              <th className="px-3 py-2.5">Lý trình</th>
              <th className="px-3 py-2.5">Ngày hàn</th>
              <th className="px-3 py-2.5 text-right">Chiều dài thanh ray</th>
              <th className="px-3 py-2.5">Tình trạng</th>
              <th className="px-3 py-2.5">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !railRows.length ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Đang tải dữ liệu…</td></tr>
            ) : railRows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Không có mối hàn nào khớp bộ lọc.</td></tr>
            ) : (
              railRows.map((row) => (
                <tr key={row.key} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-[#0047AB]">{row.maLisp}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-700">{row.maHienTruong}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-slate-800">{row.lyTrinh}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700">{row.ngayHan}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-slate-700">{row.chieuDai}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.tinhTrang}</td>
                  <td className="px-3 py-2 text-slate-600">{row.ghiChu}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RailReportPrint payload={printPayload} onClose={() => setPrintPayload(null)} />
    </div>
  );
}
