"use client";

import { useEffect, useMemo, useState } from "react";
import { printOrPdfAcceptance } from "@/lib/pdfExport";
import { loadBbntPrintSeq, advanceBbntPrintSeq, type RecordSet } from "@/lib/weldQualityClient";
import WeldAcceptanceRecordPages, { ACCEPTANCE_DOCS, acceptancePrintCss, type RecordKind } from "@/components/WeldAcceptanceRecordPages";
import { defaultAcceptancePrintKinds, advanceBbntcvSeq, nextBbntcvSeq } from "@/lib/weldAcceptance";

const LABELS: Record<RecordKind, string> = { "phu-luc": "(1) Phụ lục", "giai-doan": "(2) BBNTCV", "hoan-thanh": "(3) Hoàn thành" };
const projectIdOf = (row: RecordSet) => String((row.dot.phieu_yeu_cau_nghiem_thu.du_an as { id?: string } | undefined)?.id ?? "");
const savedNo = (row: RecordSet) => (row.sua_doi ?? []).map((r) => (r.thong_tin as Record<string, string> | null)?.so_bb?.trim()).find(Boolean)
  || (row.ho_so.map((h) => (h as { thong_tin?: Record<string, string> | null }).thong_tin?.so_bb?.trim()).find(Boolean)) || "";

/** In hàng loạt hồ sơ nghiệm thu: xếp nối nhiều bộ biên bản trong một lần in; số BBNTCV chưa có thì cấp liên tiếp. */
export default function WeldAcceptanceBatchPrint({ records, onClose, onPrinted }: { records: RecordSet[]; onClose: () => void; onPrinted?: () => void }) {
  const projectId = projectIdOf(records[0]);
  const [kinds, setKinds] = useState<RecordKind[]>(() => defaultAcceptancePrintKinds((records[0].dot.phieu_yeu_cau_nghiem_thu?.thong_tin ?? {}) as Record<string, unknown>));
  const [start, setStart] = useState(() => nextBbntcvSeq(projectId));
  useEffect(() => {
    if (!projectId) return;
    let live = true;
    void loadBbntPrintSeq(projectId).then((r) => { if (live && r.so_tiep >= Math.max(1, start)) setStart(r.so_tiep); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const complete = records.filter((r) => ACCEPTANCE_DOCS.every((d) => r.ho_so.some((h) => h.loai === d.loai)));
  const seqs = useMemo(() => { let n = start; return complete.map((r) => (savedNo(r) ? start : n++)); }, [complete, start]);

  function print() {
    const nums = [...document.querySelectorAll<HTMLElement>("[data-bb-no]")].map((el) => Number(/\/(\d+)\/BBNTCV/i.exec(el.dataset.bbNo ?? "")?.[1])).filter((n) => n >= 1);
    void printOrPdfAcceptance("Ho-so-nghiem-thu-hang-loat");
    onPrinted?.();
    const last = Math.max(0, ...nums);
    if (!kinds.includes("giai-doan") || !last || !projectId) return;
    advanceBbntcvSeq(`FBW/${last}/BBNTCV`, projectId);
    void advanceBbntPrintSeq(projectId, last).then((r) => r.so_tiep >= 1 && setStart(r.so_tiep)).catch(() => {});
  }

  return <div className="acceptance-print-root fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="In hàng loạt hồ sơ nghiệm thu">
    <style>{acceptancePrintCss}</style>
    <div className="weld-print-pack-actions mx-auto mb-3 flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <div className="min-w-[16rem] flex-1 space-y-1.5">
        <p className="text-sm font-semibold">In hàng loạt {complete.length} hồ sơ nghiệm thu</p>
        <div className="flex flex-wrap gap-2">
          {ACCEPTANCE_DOCS.map((d) => (
            <label key={d.kind} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold">
              <input type="checkbox" checked={kinds.includes(d.kind)} onChange={() => setKinds((cur) => cur.includes(d.kind) ? cur.filter((k) => k !== d.kind) : [...cur, d.kind])} />
              {LABELS[d.kind]}
            </label>
          ))}
        </div>
        {complete.length < records.length && <p role="alert" className="text-sm text-amber-800">Bỏ qua {records.length - complete.length} phiếu thiếu biên bản (hãy mở phiếu đó để tải lại hồ sơ).</p>}
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={!kinds.length || !complete.length} onClick={print} className="min-h-11 rounded-lg bg-[#0047AB] px-5 text-sm font-semibold text-white disabled:opacity-50">In / Lưu PDF</button>
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold">Thoát</button>
      </div>
    </div>
    {kinds.length > 0 && complete.map((r, i) => <WeldAcceptanceRecordPages key={String(r.dot.id ?? i)} record={r} kinds={kinds} bbSeq={seqs[i]} />)}
  </div>;
}
