"use client";

import { useEffect, useState } from "react";
import { exportPagesPdf, isTouchDevice } from "@/lib/pdfExport";
import { loadRfiDetail, type RfiSummary, type RfiWeld } from "@/lib/weldQualityClient";
import { loadRfiSignatures, type SignatureStore } from "@/lib/rfiSignatures";
import { RfiForm, initialRfiOverrides } from "@/components/WeldAcceptanceDocument";

const css = `
.rfi-batch .weld-rfi { margin-bottom: 16px; }
@media print {
  .weld-rfi .ed-field { border-bottom: 0 !important; background: none !important; }
  .weld-rfi .sig-empty { display: none !important; }
  .weld-rfi .rfi-sign { break-inside: avoid; page-break-inside: avoid; }
  body * { visibility: hidden !important; }
  .rfi-batch, .rfi-batch * { visibility: visible !important; }
  .rfi-batch { position: absolute; left: 0; top: 0; width: 100%; background: #fff; }
  .rfi-batch .weld-rfi { margin: 0 !important; box-sizing: border-box; max-width: none !important; padding: 15mm 10mm 10mm 20mm !important; page-break-after: always; }
  .rfi-batch .weld-rfi:last-child { page-break-after: auto; }
  .weld-doc-actions { display: none !important; }
  .rfi-batch table { page-break-inside: auto; } .rfi-batch tr { page-break-inside: avoid; }
  .rfi-batch thead { display: table-header-group; }
  @page { size: A4; margin: 0; }
}`;

type Loaded = { rfi: RfiSummary; welds: RfiWeld[] };

/** In hàng loạt phiếu YCNT: mỗi phiếu một trang A4, nội dung in theo bản đã lưu của từng phiếu. */
export default function WeldAcceptanceRfiBatchPrint({ rfis, projectName, onClose, onPrinted }: { rfis: RfiSummary[]; projectName: string; onClose: () => void; onPrinted?: () => void }) {
  const [items, setItems] = useState<Loaded[] | null>(null);
  const [signatures, setSignatures] = useState<SignatureStore>({});
  const [withSignatures, setWithSignatures] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void Promise.all([
      Promise.all(rfis.map((r) => loadRfiDetail(r.id))),
      loadRfiSignatures().catch(() => ({} as SignatureStore)),
    ]).then(([details, sigs]) => { if (live) { setItems(details.map((d) => ({ rfi: d.rfi, welds: d.welds }))); setSignatures(sigs); } })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Không tải được phiếu."));
    return () => { live = false; };
  }, [rfis]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sigs: SignatureStore = withSignatures ? signatures : { ...signatures, "chi-huy-truong": undefined, "nha-thau-phu": undefined };
  const print = () => {
    onPrinted?.();
    if (isTouchDevice()) { void exportPagesPdf([...document.querySelectorAll<HTMLElement>(".rfi-batch .weld-rfi")], "Phieu-YCNT-hang-loat", "width:794px;max-width:none;box-sizing:border-box;padding:15mm 10mm 10mm 20mm"); return; }
    window.print();
  };

  return <div className="fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="In hàng loạt phiếu yêu cầu nghiệm thu">
    <style>{css}</style>
    <div className="weld-doc-actions sticky top-0 z-[110] mx-auto mb-3 flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
      <span className="text-sm font-semibold">In hàng loạt {rfis.length} phiếu yêu cầu nghiệm thu</span>
      <span className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-[13px] font-semibold">
          <input type="checkbox" checked={withSignatures} onChange={(e) => setWithSignatures(e.target.checked)} />Dán chữ ký
        </label>
        <button type="button" disabled={!items} onClick={print} className="h-9 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white disabled:opacity-50">In / Lưu PDF</button>
        <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-300 bg-slate-100 px-4 text-[13px] font-semibold">Thoát</button>
      </span>
    </div>
    {error && <p role="alert" className="weld-doc-actions mx-auto mb-3 max-w-3xl rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
    {!items && !error && <p className="weld-doc-actions mx-auto max-w-3xl rounded-lg bg-white p-3 text-sm">Đang tải {rfis.length} phiếu…</p>}
    <div className="rfi-batch">
      {items?.map((d) => <RfiForm key={d.rfi.id} batch rfi={d.rfi} welds={d.welds} projectName={projectName} signatures={sigs} o={initialRfiOverrides({ rfi: d.rfi, projectName })} />)}
    </div>
  </div>;
}
