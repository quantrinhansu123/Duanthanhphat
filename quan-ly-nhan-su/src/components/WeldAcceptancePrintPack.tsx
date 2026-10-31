"use client";

import { useEffect } from "react";
import type { RecordSet } from "@/lib/weldQualityClient";
import WeldAcceptanceRecordPages, { ACCEPTANCE_DOCS, acceptancePrintCss } from "@/components/WeldAcceptanceRecordPages";

export default function WeldAcceptancePrintPack({ record, onClose, autoPrint = true }: {
  record: RecordSet; onClose: () => void; autoPrint?: boolean;
}) {
  const missing = ACCEPTANCE_DOCS.filter((d) => !record.ho_so.some((h) => h.loai === d.loai));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (!autoPrint || missing.length) return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint, missing.length]);
  return <div className="acceptance-print-root fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="In bộ biên bản nghiệm thu">
    <style>{acceptancePrintCss}</style>
    <div className="weld-print-pack-actions mx-auto mb-3 flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-sm">Bộ hồ sơ: <b>(1) Phụ lục</b> · <b>(2) Nghiệm thu công việc</b> · <b>(3) Hoàn thành công việc</b>
        {missing.length > 0 && <span role="alert" className="text-amber-800"> — Thiếu {missing.length} biên bản. Hãy tải lại hồ sơ.</span>}</p>
      <div className="flex gap-2">
        <button type="button" disabled={missing.length > 0} onClick={() => window.print()} className="min-h-11 rounded-lg bg-[#0047AB] px-5 text-sm font-semibold text-white disabled:opacity-50">In / Lưu PDF</button>
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold">Thoát</button>
      </div>
    </div>
    <WeldAcceptanceRecordPages record={record} />
  </div>;
}
