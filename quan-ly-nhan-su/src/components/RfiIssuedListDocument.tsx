"use client";

import { fieldWeldCode } from "@/lib/weldCode";
import { useEffect, useState } from "react";
import type { RfiSummary } from "@/lib/weldQualityClient";
import type { RfiCandidate } from "@/lib/weldAcceptance";
import { weldRoute } from "@/lib/rfiTracking";
import PrintFrame from "@/components/PrintFrame";

const css = `@media print {
  body * { visibility: hidden !important; }
  #rfi-issued-list-print, #rfi-issued-list-print * { visibility: visible !important; }
  #rfi-issued-list-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: #fff;
    font-family: 'Times New Roman', Times, serif; font-size: 9pt; color: #000; max-width: none; }
  .rfi-issued-actions { display: none !important; }
  #rfi-issued-list-print table { width: 100%; border-collapse: collapse; }
  #rfi-issued-list-print th, #rfi-issued-list-print td {
    border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
  #rfi-issued-list-print thead { display: table-header-group; }
  #rfi-issued-list-print tr { break-inside: avoid; }
  #rfi-issued-list-print .rfi-table-scroll { overflow: visible; }
  #rfi-issued-list-print table { min-width: 0; font-size: 9pt; }
  #rfi-issued-list-print .rfi-control-detail { display: block !important; }
  @page { size: A4 landscape; margin: 0; }
  #rfi-issued-list-print > .print-frame { width: 100%; }
}`;

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function loaiPhieu(r: RfiSummary) {
  return r.thong_tin?.loai_rfi === "theo-doi" ? (r.thong_tin?.cong_viec === "gtus" ? "Giám sát và nghiệm thu giải toả ứng suất" : "Theo dõi công việc hàn") : "Yêu cầu nghiệm thu";
}

function phamVi(r: RfiSummary) {
  const t = r.thong_tin ?? {};
  return [t.pham_vi, t.tuyen_thuong === "1" || t.tuyen_thuong === "true" ? "Tuyến thượng" : "", t.tuyen_ha === "1" || t.tuyen_ha === "true" ? "Tuyến hạ" : ""]
    .filter(Boolean).join("; ") || "—";
}

export default function RfiIssuedListDocument({
  projectName,
  rfis,
  unassigned = [],
  onClose,
}: {
  projectName: string;
  rfis: RfiSummary[];
  unassigned?: RfiCandidate[];
  onClose: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function printList() {
    const previous = document.title;
    document.title = " ";
    const restore = () => { document.title = previous; };
    window.addEventListener("afterprint", restore, { once: true });
    window.print();
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Danh sách phiếu yêu cầu nghiệm thu đã phát">
      <style>{css}</style>
      <div className="rfi-issued-actions mx-auto mb-3 flex max-w-7xl flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => setShowDetails((v) => !v)} className="min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-slate-700" aria-expanded={showDetails}>{showDetails ? "Ẩn chi tiết mối / KM" : "Chi tiết từng mối / KM"}</button>
        <button type="button" onClick={printList} className="h-9 cursor-pointer rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A]">In danh sách</button>
        <button type="button" onClick={onClose} className="h-9 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Đóng</button>
      </div>
      <article id="rfi-issued-list-print" className="mx-auto max-w-7xl rounded-lg bg-white p-3 text-sm text-black shadow-lg sm:p-6">
<PrintFrame>
        <h1 className="text-center text-base font-bold uppercase">Danh sách phiếu yêu cầu nghiệm thu đã phát</h1>
        <p className="mt-2 text-center">Dự án: {projectName || "………………"}</p>
        <p className="mt-1 text-center text-xs">Ngày lập danh sách: {new Date().toLocaleDateString("vi-VN")}</p>
        <p className="mt-3 text-xs text-slate-700">“Đạt” là kết quả nghiệm thu; “Đã ký” là mối có đủ bộ 3 biên bản đã ký. Khoảng KM chỉ thể hiện hai đầu phạm vi, không khẳng định đã nghiệm thu liên tục. Đối chiếu danh sách từng mối / KM bên dưới để kiểm soát bỏ sót.</p>
        <div className="rfi-table-scroll overflow-x-auto">
        <table className="mt-4 w-full min-w-[1150px] border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-400 px-2 py-1.5 w-10">STT</th>
              <th className="border border-slate-400 px-2 py-1.5">Số phiếu</th>
              <th className="border border-slate-400 px-2 py-1.5">Ngày phát</th>
              <th className="border border-slate-400 px-2 py-1.5">Loại phiếu</th>
              <th className="border border-slate-400 px-2 py-1.5">Phạm vi / tuyến</th>
              <th className="border border-slate-400 px-2 py-1.5">Mối trong RFI</th>
              <th className="border border-slate-400 px-2 py-1.5">NT đạt</th>
              <th className="border border-slate-400 px-2 py-1.5">Chưa NT</th>
              <th className="border border-slate-400 px-2 py-1.5">Không đạt</th>
              <th className="border border-slate-400 px-2 py-1.5">Chờ ký / Đã ký</th>
              <th className="border border-slate-400 px-2 py-1.5">KM nghiệm thu đạt</th>
              <th className="border border-slate-400 px-2 py-1.5">Trạng thái</th>
              <th className="border border-slate-400 px-2 py-1.5">Người lập</th>
            </tr>
          </thead>
          <tbody>
            {rfis.map((r, i) => (
              <tr key={r.id}>
                <td className="border border-slate-400 px-2 py-1.5 text-center">{i + 1}</td>
                <td className="border border-slate-400 px-2 py-1.5 font-medium">{r.so_phieu}</td>
                <td className="border border-slate-400 px-2 py-1.5 text-center">{formatDate(r.ngay_moi)}</td>
                <td className="border border-slate-400 px-2 py-1.5">{loaiPhieu(r)}</td>
                <td className="border border-slate-400 px-2 py-1.5">{phamVi(r)}</td>
                <td className="border border-slate-400 px-2 py-1.5 text-center">
                  {r.thong_tin?.loai_rfi === "theo-doi" ? "—" : r.tong_moi}
                </td>
                <td className="border border-slate-400 px-2 py-1.5 text-center">{r.thong_tin?.loai_rfi === "theo-doi" ? "—" : r.tracking?.da_nghiem_thu ?? "—"}</td>
                <td className="border border-slate-400 px-2 py-1.5 text-center">{r.thong_tin?.loai_rfi === "theo-doi" ? "—" : r.tracking?.chua_nghiem_thu ?? r.con_lai}</td>
                <td className="border border-slate-400 px-2 py-1.5 text-center">{r.thong_tin?.loai_rfi === "theo-doi" ? "—" : r.tracking?.khong_dat ?? "—"}</td>
                <td className="border border-slate-400 px-2 py-1.5 text-center">{r.thong_tin?.loai_rfi === "theo-doi" ? "—" : `${r.tracking?.cho_ky ?? "—"} / ${r.tracking?.da_ky ?? "—"}`}</td>
                <td className="border border-slate-400 px-2 py-1.5">
                  {r.tracking?.km_nghiem_thu ?? "—"}
                  {!!r.tracking?.thieu_ly_trinh && <p className="font-semibold text-amber-800">Thiếu KM: {r.tracking.thieu_ly_trinh} mối</p>}
                </td>
                <td className="border border-slate-400 px-2 py-1.5">{r.trang_thai}</td>
                <td className="border border-slate-400 px-2 py-1.5">{r.nguoi_lap || "—"}</td>
              </tr>
            ))}
            {!rfis.length && (
              <tr>
                <td colSpan={13} className="border border-slate-400 px-2 py-4 text-center text-slate-500">Chưa có phiếu yêu cầu nghiệm thu đã phát.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        <section className="mt-5">
          <h2 className="font-bold">Mối sẵn sàng chưa có RFI: {unassigned.length}</h2>
          <p className="mt-1 text-xs text-slate-700">Mối đủ điều kiện phát RFI và chưa nằm trong RFI hiệu lực. Chưa bao gồm mối đang chờ mài, sửa chữa hoặc chưa đủ điều kiện chất lượng.</p>
          {unassigned.length > 0 && <div className="rfi-table-scroll mt-2 overflow-x-auto"><table className="w-full border-collapse text-xs">
            <thead><tr>{["Mã mối", "Ngày hàn", "Lý trình", "Tình trạng"].map((title) => <th key={title} className="border border-slate-400 p-2 text-left">{title}</th>)}</tr></thead>
            <tbody>{unassigned.map((w) => <tr key={w.id}><td className="border border-slate-400 p-2">{fieldWeldCode(w.ma_lich_su)}</td><td className="border border-slate-400 p-2">{w.ngay_thuc_hien ? formatDate(w.ngay_thuc_hien) : "—"}</td><td className="border border-slate-400 p-2">{w.ly_trinh || "Thiếu KM"}</td><td className="border border-slate-400 p-2">{w.tinh_trang}</td></tr>)}</tbody>
          </table></div>}
        </section>
        <section className={`rfi-control-detail mt-5 ${showDetails ? "block" : "hidden"}`}>
          <h2 className="font-bold">Đối soát từng mối / KM theo RFI</h2>
          {rfis.filter((r) => r.thong_tin?.loai_rfi !== "theo-doi").map((r) => <div key={r.id} className="mt-3">
            <h3 className="font-semibold">{r.so_phieu} · {r.tong_moi} mối</h3>
            <div className="rfi-table-scroll overflow-x-auto"><table className="mt-1 w-full min-w-[650px] border-collapse text-xs">
              <thead><tr>{["Mã mối", "Tuyến / Vị trí", "KM", "Kết quả nghiệm thu", "Hồ sơ"].map((title) => <th key={title} className="border border-slate-400 p-2 text-left">{title}</th>)}</tr></thead>
              <tbody>{r.tracking?.moi.map((w) => <tr key={w.moi_han_id}>
                <td className="border border-slate-400 p-2">{fieldWeldCode(w.ma_lich_su)}</td>
                <td className="border border-slate-400 p-2">{weldRoute(w.ma_diem)} · {w.ma_diem || "—"}</td>
                <td className="border border-slate-400 p-2">{w.ly_trinh || "Thiếu KM"}</td>
                <td className="border border-slate-400 p-2">{w.ket_qua}</td>
                <td className="border border-slate-400 p-2">{w.ket_qua === "Đạt" ? w.da_ky ? "Đã ký" : "Chờ ký" : "Chưa hoàn thành nghiệm thu"}</td>
              </tr>)}</tbody>
            </table></div>
          </div>)}
        </section>
        <div className="mt-10 grid grid-cols-2 gap-8 text-center text-sm">
          <div>
            <p className="font-bold">NGƯỜI LẬP DANH SÁCH</p>
            <p className="mt-1 text-xs font-normal">(Ký, ghi rõ họ tên)</p>
          </div>
          <div>
            <p className="font-bold">PHỤ TRÁCH CHẤT LƯỢNG</p>
            <p className="mt-1 text-xs font-normal">(Ký, ghi rõ họ tên)</p>
          </div>
        </div>
</PrintFrame>
      </article>
    </div>
  );
}
