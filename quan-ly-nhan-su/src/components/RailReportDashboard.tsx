"use client";

import { useEffect, useMemo, useState } from "react";
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
import { fieldWeldCode, parseCoordinateCode } from "@/lib/weldCode";
import { createClient } from "@/lib/supabase/client";
import { clearWeldPayments, loadRfis, loadTicketWelds, loadWeldPayments, saveWeldPayments, type RfiSummary, type WeldPayment } from "@/lib/weldQualityClient";

/** Một dòng trong mẫu "Báo cáo ray": mỗi mối hàn là một thanh ray. */
type RailRow = {
  key: string;
  maLisp: string;      // Tên mối hàn theo thiết kế (mã Autolisp: TT0123…)
  maHienTruong: string; // Tên mối hàn tại hiện trường (mã hệ thống / mã hiện trường)
  lyTrinh: string;
  lyTrinhCuoi: string;
  ngayHan: string;
  chieuDai: string;    // Chiều dài thanh ray (mm)
  tinhTrang: string;
  ghiChu: string;
  daNghiemThu: boolean;
  thanhToan: string; // tỷ lệ đã thanh toán, VD "50%" ("—" nếu chưa)
  thanhToanGhiChu: string;
};

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

/** Mã hiện trường dạng «FBW ddmmyy xxxx» (theo mẫu VNR). */
function formatSiteWeldName(row: WeldReportRow): string {
  return fieldWeldCode(null, row.ma_hien_truong) || "—";
}

/** Số thứ tự cuối mã hiện trường; mối chưa có mã xếp cuối bảng. */
function siteSeq(row: WeldReportRow) {
  const m = /(\d+)\s*$/.exec((row.ma_hien_truong ?? "").trim());
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

const pct = (n: number, total: number | null) => (total ? ` (${((n / total) * 100).toFixed(1)}%)` : "");

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

  const phuQuocRows = useMemo(() => rows.filter(row => row.du_an.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("phu quoc")), [rows]);
  // Bỏ bản ghi rác: không có mã hiện trường lẫn mã thiết kế thì không xác định được là thanh ray nào.
  const baseRows = useMemo(() => filterWeldReportRows(phuQuocRows, { ...appliedFilters, projects: [] })
    .filter((row) => (row.ma_hien_truong ?? "").trim() || (row.ma_diem ?? "").trim()), [phuQuocRows, appliedFilters]);

  // Thanh toán theo mối hàn (chỉ mối đã nghiệm thu Đạt mới ghi được).
  const [payments, setPayments] = useState<Map<string, WeldPayment>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payPercent, setPayPercent] = useState(100);
  const [payNote, setPayNote] = useState("");
  const [rfis, setRfis] = useState<RfiSummary[]>([]);
  const [payMessage, setPayMessage] = useState("");
  const projectIdForPay = baseRows[0]?.du_an_id;
  const reloadPayments = () => {
    if (!projectIdForPay) return Promise.resolve();
    return loadWeldPayments(projectIdForPay).then((r) => setPayments(new Map(r.payments.map((p) => [p.moi_han_id, p]))))
      .catch(() => setPayMessage("Không tải được dữ liệu thanh toán (cần chạy migration thanh_toan_moi_han)."));
  };
  useEffect(() => { void reloadPayments(); }, [projectIdForPay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (projectIdForPay) loadRfis(projectIdForPay).then((r) => setRfis(r.rfis)).catch(() => setRfis([])); }, [projectIdForPay]);

  /** Chọn theo phiếu: chọn mọi mối của phiếu đó đang hiện trong bảng. */
  async function selectByTicket(ticketId: string) {
    if (!projectIdForPay || !ticketId) return;
    setPayMessage("");
    try {
      const { moi_han_ids } = await loadTicketWelds(projectIdForPay, ticketId);
      const shown = new Set(railRows.map((r) => r.key));
      setSelected(new Set(moi_han_ids.filter((id) => shown.has(id))));
    } catch (e) { setPayMessage(e instanceof Error ? e.message : "Không đọc được phiếu."); }
  }

  // Lấy điểm cuối trước khi lọc ngày hoặc tìm kiếm.
  // Điểm thiết kế (toa_do) cho cả mối chưa hàn / chưa gắn mối hàn → luôn có lý trình cuối của thanh ray.
  const [designPoints, setDesignPoints] = useState<{ ma_diem: string; ly_trinh: string | null }[]>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      const db = createClient(), all: { ma_diem: string; ly_trinh: string | null }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db.from("toa_do").select("ma_diem,ly_trinh").order("ma_diem").range(from, from + 999);
        if (error) return;
        all.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) break;
      }
      if (active) setDesignPoints(all);
    })();
    return () => { active = false; };
  }, []);
  const endChainages = useMemo(() => {
    const points = new Map<string, string>();
    for (const point of designPoints) {
      const code = parseCoordinateCode((point.ma_diem ?? "").trim());
      if (code && point.ly_trinh) points.set(`${code.prefix}:${code.seq}`, normalizeChainage(point.ly_trinh));
    }
    for (const row of phuQuocRows) {
      const code = parseCoordinateCode((row.ma_diem ?? "").trim());
      if (code && row.ly_trinh) points.set(`${code.prefix}:${code.seq}`, normalizeChainage(row.ly_trinh));
    }
    return points;
  }, [phuQuocRows, designPoints]);

  const railRows = useMemo<RailRow[]>(() => {
    return baseRows
      .map((row) => {
        const maLisp = (row.ma_diem ?? "").trim();
        const parsed = maLisp ? parseCoordinateCode(maLisp) : null;
        const route = parsed?.prefix ?? "";
        const lyTrinhCuoi = parsed
          ? endChainages.get(`${parsed.prefix}:${parsed.seq + 1}`) ?? "—"
          : "—";
        const start = chainageSortKey(normalizeChainage(row.ly_trinh));
        const end = chainageSortKey(lyTrinhCuoi);
        const lengthMm = start !== Number.MAX_SAFE_INTEGER && end !== Number.MAX_SAFE_INTEGER && end >= start
          ? Math.ceil(Number(((end - start) * 1000).toFixed(3))) // làm tròn lên nguyên số mm
          : null;
        return {
          iso: getJournalRowDateIso(row).slice(0, 10),
          seq: siteSeq(row),
          key: row.id,
          maLisp: maLisp || "—",
          maHienTruong: formatSiteWeldName(row),
          lyTrinh: normalizeChainage(row.ly_trinh),
          lyTrinhCuoi,
          ngayHan: formatDateShortEn(getJournalRowDateIso(row)),
          chieuDai: lengthMm === null ? "—" : String(lengthMm),
          tinhTrang: statusLabel(row),
          ghiChu: (row.ghi_chu ?? "").trim() || "—",
          daNghiemThu: row.tinh_trang_chat_luong === "Đạt",
          thanhToan: payments.get(row.id) ? `${payments.get(row.id)!.ty_le}%` : "—",
          thanhToanGhiChu: payments.get(row.id)?.ghi_chu ?? "",
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
          row.lyTrinh.toLocaleLowerCase("vi").includes(q) ||
          row.lyTrinhCuoi.toLocaleLowerCase("vi").includes(q)
        );
      })
      // Thứ tự theo mã hiện trường (đúng thứ tự hàn): mối chưa có mã xuống cuối; cùng mã thì theo lý trình.
      .sort((a, b) => (a.seq === b.seq ? 0 : a.seq === Number.MAX_SAFE_INTEGER ? 1 : b.seq === Number.MAX_SAFE_INTEGER ? -1 : a.iso.localeCompare(b.iso) || a.seq - b.seq)
        || chainageSortKey(a.lyTrinh) - chainageSortKey(b.lyTrinh) || a.maLisp.localeCompare(b.maLisp, "vi"))
      .map(({ iso: _iso, seq: _seq, ...rest }) => rest);
  }, [baseRows, endChainages, search, routeFilter, payments]);

  const routeOptions = useMemo(() => {
    const found = new Set<string>();
    for (const row of baseRows) {
      const parsed = row.ma_diem ? parseCoordinateCode(row.ma_diem) : null;
      if (parsed) found.add(ROUTE_LABELS[parsed.prefix]);
    }
    return Array.from(found).filter(Boolean).sort((a, b) => a.localeCompare(b, "vi"));
  }, [baseRows]);

  // Tổng hợp theo kỳ lọc: không tính mối «Chấp thuận»; mẫu số = tổng mối dự kiến của dự án.
  const projectId = baseRows[0]?.du_an_id;
  const [plannedTotal, setPlannedTotal] = useState<number | null>(null);
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    createClient().from("du_an").select("tong_moi_han_du_kien").eq("id", projectId).maybeSingle()
      .then(({ data }) => { if (active) setPlannedTotal(Number(data?.tong_moi_han_du_kien) > 0 ? Number(data?.tong_moi_han_du_kien) : null); });
    return () => { active = false; };
  }, [projectId]);
  const summary = useMemo(() => {
    const welded = baseRows.filter((r) => r.loai_moi_han !== "Chấp thuận");
    const accepted = welded.filter((r) => r.tinh_trang_chat_luong === "Đạt").length;
    const paid = welded.filter((r) => payments.get(r.id)?.ty_le === 100).length;
    const partial = welded.filter((r) => payments.has(r.id) && payments.get(r.id)!.ty_le < 100).length;
    return [
      `Tổng số mối đã hàn: ${welded.length.toLocaleString("vi-VN")}${pct(welded.length, plannedTotal)} (không tính chấp thuận)`,
      `Tổng số mối đã nghiệm thu: ${accepted.toLocaleString("vi-VN")}${pct(accepted, plannedTotal)}`,
      `Tổng số mối đã thanh toán: ${paid.toLocaleString("vi-VN")}${pct(paid, plannedTotal)}${partial ? ` · thanh toán một phần: ${partial}` : ""}`,
    ];
  }, [baseRows, plannedTotal, payments]);

  async function applyPayment(clear: boolean) {
    if (!projectIdForPay || selected.size === 0) return;
    setPayMessage("");
    try {
      const chosen = [...selected];
      if (clear) await clearWeldPayments(projectIdForPay, chosen);
      else await saveWeldPayments(projectIdForPay, chosen, payDate, payPercent, payNote);
      await reloadPayments();
      setSelected(new Set());
      setPayMessage(clear ? `Đã bỏ thanh toán ${chosen.length} mối.` : `Đã ghi thanh toán ${chosen.length} mối.`);
    } catch (e) { setPayMessage(e instanceof Error ? e.message : "Không ghi được thanh toán."); }
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const head = ["Tên mối hàn theo thiết kế", "Tên mối hàn tại hiện trường", "Lý trình đầu", "Lý trình cuối", "Ngày hàn", "Chiều dài thanh ray (mm)", "Tình trạng", "Thanh toán", "Ghi chú thanh toán"];
    const aoa = [["THEO DÕI CÔNG VIỆC HÀN RAY"], [`Dự án: ${baseRows[0]?.du_an || "Phú Quốc"}`], ...summary.map((l) => [l]), [], head,
      ...railRows.map((r) => [r.maLisp, r.maHienTruong, r.lyTrinh, r.lyTrinhCuoi, r.ngayHan, r.chieuDai === "—" ? "" : Number(r.chieuDai), r.tinhTrang, r.thanhToan === "—" ? "" : r.thanhToan, r.thanhToanGhiChu])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [18, 24, 14, 14, 12, 14, 18, 12, 24].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Theo doi han ray");
    XLSX.writeFile(wb, `Theo-doi-cong-viec-han-ray-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /** Mở bản in với đúng dữ liệu đang xem. */
  function openPrint() {
    setPrintPayload({
      rows: railRows,
      title: "THEO DÕI CÔNG VIỆC HÀN RAY",
      summary,
      projectLabel: baseRows[0]?.du_an || "Phú Quốc",
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
            : `${railRows.length.toLocaleString("vi-VN")} thanh ray · Dự án Phú Quốc · lấy từ Nhật ký hàn`}
      </div>

      <div className="grid gap-1 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 shadow-xs">
        {summary.map((line) => <div key={line}>{line}</div>)}
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
        <button type="button" onClick={exportExcel} disabled={!railRows.length}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
          Xuất Excel
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <span className="text-xs font-semibold text-slate-600">Thanh toán theo mối hàn · đã chọn {selected.size} mối (chỉ mối đã nghiệm thu Đạt)</span>
        <label className="text-xs font-semibold text-slate-600">Ngày thanh toán
          <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="mt-1 block h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal" />
        </label>
        <label className="text-xs font-semibold text-slate-600">Tình trạng thanh toán
          <select value={payPercent} onChange={(e) => setPayPercent(Number(e.target.value))} className="mt-1 block h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal">
            {[30, 50, 70, 100].map((n) => <option key={n} value={n}>{n}%{n === 100 ? " (mặc định)" : ""}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Ghi chú
          <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder={payPercent < 100 ? `VD: thanh toán ${payPercent}%` : "Ghi chú thanh toán"} className="mt-1 block h-10 w-52 rounded-lg border border-slate-300 px-3 text-sm font-normal" />
        </label>
        <label className="text-xs font-semibold text-slate-600">Chọn theo phiếu
          <select defaultValue="" onChange={(e) => { void selectByTicket(e.target.value); e.target.value = ""; }} className="mt-1 block h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal">
            <option value="">— Chọn phiếu RFI —</option>
            {rfis.map((r) => <option key={r.id} value={r.id}>{r.so_phieu}</option>)}
          </select>
        </label>
        <button type="button" disabled={!selected.size || !payDate} onClick={() => void applyPayment(false)} className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">Ghi thanh toán</button>
        <button type="button" disabled={!selected.size} onClick={() => void applyPayment(true)} className="h-10 rounded-lg border border-rose-300 bg-rose-50 px-4 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">Bỏ thanh toán</button>
        <button type="button" onClick={() => setSelected(new Set(railRows.filter((r) => r.daNghiemThu && r.thanhToan === "—").map((r) => r.key)))} className="h-10 rounded-lg border border-sky-300 bg-sky-50 px-4 text-sm font-bold text-sky-800 hover:bg-sky-100">Chọn mối đạt chưa thanh toán</button>
        {payMessage && <span className="text-xs font-medium text-slate-700" role="status">{payMessage}</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full min-w-[1000px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <th className="w-8 px-3 py-2.5"></th>
              <th className="px-3 py-2.5">Tên mối hàn theo thiết kế</th>
              <th className="px-3 py-2.5">Tên mối hàn tại hiện trường</th>
              <th className="px-3 py-2.5">Lý trình đầu</th>
              <th className="px-3 py-2.5">Lý trình cuối</th>
              <th className="px-3 py-2.5">Ngày hàn</th>
              <th className="px-3 py-2.5 text-right">Chiều dài thanh ray (mm)</th>
              <th className="px-3 py-2.5">Tình trạng</th>
              <th className="px-3 py-2.5">Thanh toán</th>
              <th className="px-3 py-2.5">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !railRows.length ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">Đang tải dữ liệu…</td></tr>
            ) : railRows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">Không có mối hàn nào khớp bộ lọc.</td></tr>
            ) : (
              railRows.map((row) => (
                <tr key={row.key} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2"><input type="checkbox" aria-label={`Chọn ${row.maHienTruong}`} disabled={!row.daNghiemThu && row.thanhToan === "—"} checked={selected.has(row.key)}
                    onChange={(e) => setSelected((prev) => { const next = new Set(prev); if (e.target.checked) next.add(row.key); else next.delete(row.key); return next; })} /></td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-[#0047AB]">{row.maLisp}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-700">{row.maHienTruong}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-slate-800">{row.lyTrinh}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-slate-800">{row.lyTrinhCuoi}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700">{row.ngayHan}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-slate-700">{row.chieuDai}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.tinhTrang}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700" title={row.thanhToanGhiChu}>{row.thanhToan}{row.thanhToanGhiChu ? " ·" : ""}</td>
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
