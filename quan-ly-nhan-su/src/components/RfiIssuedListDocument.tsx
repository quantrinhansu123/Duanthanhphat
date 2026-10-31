"use client";

import { useEffect } from "react";
import type { RfiSummary } from "@/lib/weldQualityClient";

const css = `@media print {
  body * { visibility: hidden !important; }
  #rfi-issued-list-print, #rfi-issued-list-print * { visibility: visible !important; }
  #rfi-issued-list-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: #fff;
    font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; }
  .rfi-issued-actions { display: none !important; }
  #rfi-issued-list-print table { width: 100%; border-collapse: collapse; }
  #rfi-issued-list-print th, #rfi-issued-list-print td {
    border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
  #rfi-issued-list-print thead { display: table-header-group; }
  #rfi-issued-list-print tr { break-inside: avoid; }
  @page { size: A4 portrait; margin: 12mm; }
}`;

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function loaiPhieu(r: RfiSummary) {
  return r.thong_tin?.loai_rfi === "theo-doi" ? "Theo dõi công việc hàn" : "Yêu cầu nghiệm thu";
}

function phamVi(r: RfiSummary) {
  const t = r.thong_tin ?? {};
  return [t.pham_vi, t.tuyen_thuong === "1" || t.tuyen_thuong === "true" ? "Tuyến thượng" : "", t.tuyen_ha === "1" || t.tuyen_ha === "true" ? "Tuyến hạ" : ""]
    .filter(Boolean).join("; ") || "—";
}

export default function RfiIssuedListDocument({
  projectName,
  rfis,
  onClose,
}: {
  projectName: string;
  rfis: RfiSummary[];
  onClose: () => void;
}) {
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
      <div className="rfi-issued-actions mx-auto mb-3 flex max-w-4xl flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={printList} className="h-9 cursor-pointer rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A]">In danh sách</button>
        <button type="button" onClick={onClose} className="h-9 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Đóng</button>
      </div>
      <article id="rfi-issued-list-print" className="mx-auto max-w-4xl rounded-lg bg-white p-6 text-sm text-black shadow-lg sm:p-8">
        <h1 className="text-center text-base font-bold uppercase">Danh sách phiếu yêu cầu nghiệm thu đã phát</h1>
        <p className="mt-2 text-center">Dự án: {projectName || "………………"}</p>
        <p className="mt-1 text-center text-xs">Ngày lập danh sách: {new Date().toLocaleDateString("vi-VN")}</p>
        <table className="mt-4 w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-400 px-2 py-1.5 w-10">STT</th>
              <th className="border border-slate-400 px-2 py-1.5">Số phiếu</th>
              <th className="border border-slate-400 px-2 py-1.5">Ngày phát</th>
              <th className="border border-slate-400 px-2 py-1.5">Loại phiếu</th>
              <th className="border border-slate-400 px-2 py-1.5">Phạm vi / tuyến</th>
              <th className="border border-slate-400 px-2 py-1.5">Số mối</th>
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
                  {r.thong_tin?.loai_rfi === "theo-doi" ? "—" : `${r.tong_moi}${r.con_lai < r.tong_moi ? ` (còn ${r.con_lai})` : ""}`}
                </td>
                <td className="border border-slate-400 px-2 py-1.5">{r.trang_thai}</td>
                <td className="border border-slate-400 px-2 py-1.5">{r.nguoi_lap || "—"}</td>
              </tr>
            ))}
            {!rfis.length && (
              <tr>
                <td colSpan={8} className="border border-slate-400 px-2 py-4 text-center text-slate-500">Chưa có phiếu yêu cầu nghiệm thu đã phát.</td>
              </tr>
            )}
          </tbody>
        </table>
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
      </article>
    </div>
  );
}
