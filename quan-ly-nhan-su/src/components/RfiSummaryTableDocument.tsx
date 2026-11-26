"use client";

import { useEffect, useMemo, useState } from "react";
import { qualityRequest } from "@/lib/weldQualityClient";
import { compareWeldCodes, parseChainageMeters } from "@/lib/weldAcceptance";
import { fieldWeldCode } from "@/lib/weldCode";
import { weldRoute } from "@/lib/rfiTracking";

type Ticket = { id: string; loai: "hinh-hoc" | "sieu-am"; so_phieu: string; ngay_moi: string; ngay_nghiem_thu: string | null };
type Weld = { phieu_id: string; moi_han_id: string; ma_lich_su: string; ma_diem: string | null; ly_trinh: string | null };

// Lề A4 mẫu in: trái 2, trên 1.5, phải 1, dưới 1 cm — đặt bằng padding vì @page margin 0 mới bỏ được đầu/chân trang của trình duyệt.
const css = `.rfi-pad { display: none; }
@media print {
  body > *:not(.rfi-summary-root) { display: none !important; }
  .rfi-summary-root { position: static !important; inset: auto !important; overflow: visible !important; height: auto !important; background: #fff !important; padding: 0 !important; }
  .rfi-summary-actions { display: none !important; }
  #rfi-summary-print { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 1cm 0 2cm !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important;
    font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000; }
  #rfi-summary-print table { width: 100%; min-width: 0 !important; border-collapse: collapse; }
  #rfi-summary-print th, #rfi-summary-print td { border: 1px solid #000 !important; padding: 3px 5px; vertical-align: middle; }
  #rfi-summary-print thead { display: table-header-group; }
  #rfi-summary-print tr { break-inside: avoid; }
  /* Hàng đệm lặp ở đầu/cuối mỗi trang = lề trên 1.5cm, lề dưới 1cm (thead/tfoot lặp theo từng trang). */
  .rfi-pad { display: table-row !important; }
  #rfi-summary-print .rfi-pad td { height: 1.5cm; border: 0 !important; padding: 0 !important; }
  #rfi-summary-print .rfi-pad-bottom td { height: 1cm; }
  #rfi-summary-print h1 { margin-top: 1.5cm; }
  #rfi-summary-print table { margin-top: -1.5cm; }
  @page { size: A4 landscape; margin: 0; }
}`;

const date = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

/** Dựng dòng bảng: HH trước, hết HH mới đến SA; SA ghi kèm số phiếu HH của các mối tương ứng. */
function buildRows(tickets: Ticket[], welds: Weld[], withHh: boolean, withSa: boolean) {
  const byTicket = new Map<string, Weld[]>();
  for (const w of welds) byTicket.set(w.phieu_id, [...(byTicket.get(w.phieu_id) ?? []), w]);
  const hhOfWeld = new Map<string, string>();
  for (const t of tickets) if (t.loai === "hinh-hoc") for (const w of byTicket.get(t.id) ?? []) hhOfWeld.set(w.moi_han_id, t.so_phieu);
  const make = (t: Ticket) => {
    const list = [...(byTicket.get(t.id) ?? [])].sort((a, b) => compareWeldCodes(a.ma_lich_su, b.ma_lich_su));
    const km = list.flatMap((w) => { const m = parseChainageMeters(w.ly_trinh); return m == null ? [] : [{ m, text: w.ly_trinh as string }]; }).sort((a, b) => a.m - b.m);
    const first = list[0] ? fieldWeldCode(list[0].ma_lich_su) : "";
    const last = list.length ? fieldWeldCode(list[list.length - 1].ma_lich_su) : "";
    const hh = t.loai === "sieu-am" ? [...new Set(list.map((w) => hhOfWeld.get(w.moi_han_id)).filter(Boolean))] : [];
    return {
      id: t.id, so: t.so_phieu, hh,
      doiTuong: t.loai === "hinh-hoc" ? "Nghiệm thu kích thước hình học, trực quan mối hàn" : "Nghiệm thu kích thước hình học và siêu âm mối hàn",
      ten: !list.length ? "—" : first === last ? first : `${first} đến ${last}`,
      thuong: list.some((w) => weldRoute(w.ma_diem) === "Tuyến thượng"), ha: list.some((w) => weldRoute(w.ma_diem) === "Tuyến hạ"),
      from: km[0]?.text ?? "—", to: km[km.length - 1]?.text ?? "—", ngay: date(t.ngay_nghiem_thu ?? t.ngay_moi),
    };
  };
  const rows: ReturnType<typeof make>[] = [];
  if (withHh) rows.push(...tickets.filter((t) => t.loai === "hinh-hoc").map(make));
  if (withSa) rows.push(...tickets.filter((t) => t.loai === "sieu-am").map(make));
  return rows;
}

export default function RfiSummaryTableDocument({ projectId, projectName, onClose }: { projectId: string; projectName: string; onClose: () => void }) {
  const [data, setData] = useState<{ tickets: Ticket[]; welds: Weld[] } | null>(null);
  const [error, setError] = useState("");
  const [withHh, setWithHh] = useState(true);
  const [withSa, setWithSa] = useState(true);
  useEffect(() => {
    let live = true;
    qualityRequest<{ tickets: Ticket[]; welds: Weld[] }>({ action: "rfi-summary-table", du_an_id: projectId })
      .then((r) => { if (live) setData(r); }).catch((e) => { if (live) setError(e instanceof Error ? e.message : "Không tải được dữ liệu."); });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { live = false; window.removeEventListener("keydown", onKey); };
  }, [projectId, onClose]);
  const rows = useMemo(() => (data ? buildRows(data.tickets, data.welds, withHh, withSa) : []), [data, withHh, withSa]);
  const th = "border border-slate-500 px-2 py-1.5 text-center font-bold";
  const td = "border border-slate-500 px-2 py-1.5";
  return (
    <div className="rfi-summary-root fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Tổng hợp nghiệm thu mối hàn ray">
      <style>{css}</style>
      <div className="rfi-summary-actions mx-auto mb-3 flex max-w-7xl flex-wrap items-center justify-end gap-3">
        <label className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold"><input type="checkbox" checked={withHh} onChange={(e) => setWithHh(e.target.checked)} />Hình học (HH)</label>
        <label className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold"><input type="checkbox" checked={withSa} onChange={(e) => setWithSa(e.target.checked)} />Siêu âm (SA)</label>
        <button type="button" onClick={() => window.print()} className="h-9 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white">In bảng</button>
        <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold">Đóng</button>
      </div>
      <article id="rfi-summary-print" className="mx-auto max-w-7xl overflow-x-auto rounded-lg bg-white p-4 text-sm text-black shadow-lg">
        <h1 className="text-base font-bold uppercase text-red-700">Tổng hợp nghiệm thu mối hàn ray</h1>
        <p className="mb-2 text-xs">Dự án: {projectName || "………………"}</p>
        {error ? <p className="text-red-700">{error}</p> : !data ? <p>Đang tải…</p> : (
          <table className="w-full min-w-[1000px] border-collapse text-xs">
            <thead>
              <tr className="rfi-pad"><td colSpan={11} /></tr>
              <tr>
                <th rowSpan={2} className={th}>STT</th><th rowSpan={2} className={th}>Nội dung</th><th rowSpan={2} className={th}>Số</th>
                <th rowSpan={2} className={th}>Đối tượng nghiệm thu</th><th rowSpan={2} className={th}>Tên mối hàn</th>
                <th colSpan={2} className={th}>Vị trí</th><th colSpan={2} className={th}>Lý trình</th>
                <th rowSpan={2} className={th}>Thời gian</th><th rowSpan={2} className={th}>Ngày tháng</th>
              </tr>
              <tr><th className={th}>Tuyến thượng</th><th className={th}>Tuyến hạ</th><th className={th}>Mối đầu</th><th className={th}>Mối cuối</th></tr>
              <tr>{["(1)", "(2)", "(3)", "(4)", "(5)", "(6)", "(7)", "(8)", "(9)", "(10)", "(11)"].map((n) => <th key={n} className={`${th} font-normal`}>{n}</th>)}</tr>
            </thead>
            <tfoot><tr className="rfi-pad rfi-pad-bottom"><td colSpan={11} /></tr></tfoot>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className={`${td} text-center`}>{i + 1}</td>
                  <td className={`${td} text-center`}>YCNT</td>
                  <td className={`${td} whitespace-nowrap text-center font-semibold`}>{r.so}{r.hh.length > 0 && <div className="text-[10px] font-normal">(HH: {r.hh.join(", ")})</div>}</td>
                  <td className={td}>{r.doiTuong}</td>
                  <td className={`${td} whitespace-nowrap`}>{r.ten}</td>
                  <td className={`${td} text-center`}>{r.thuong ? "✓" : ""}</td>
                  <td className={`${td} text-center`}>{r.ha ? "✓" : ""}</td>
                  <td className={`${td} whitespace-nowrap text-center`}>{r.from}</td>
                  <td className={`${td} whitespace-nowrap text-center`}>{r.to}</td>
                  <td className={`${td} text-center`}>8h</td>
                  <td className={`${td} text-center`}>{r.ngay}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={11} className={`${td} py-4 text-center text-slate-500`}>Chưa có phiếu HH / SA nào.</td></tr>}
            </tbody>
          </table>
        )}
      </article>
    </div>
  );
}
