"use client";
import { useEffect, useRef, useState } from "react";
import type { WeldQualitySelection } from "@/lib/weldQuality";
import { markQualityPass } from "@/lib/weldQualityClient";

export default function WeldQualityBulkDialog({ entries, onClose, onDone }: {
  entries: WeldQualitySelection[]; onClose: () => void; onDone: (savedIds: string[]) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const stop = useRef(false);
  const [kind, setKind] = useState<"visual" | "ndt">("visual");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const [method, setMethod] = useState("Siêu âm");
  const [busy, setBusy] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-labelledby="bulk-quality-title" onClose={onClose} onCancel={(e) => { if (busy) e.preventDefault(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_1.5rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-900/50">
    <h2 id="bulk-quality-title" className="text-lg font-bold">Đánh dấu đạt cho {entries.length.toLocaleString("vi-VN")} mối đã chọn</h2>
    <p className="mt-2 text-sm text-slate-600">Chỉ thay đổi tiêu chí bên dưới. Không tự điền số đo, không xóa lỗi tại nghiệm thu và không chuyển thành Nghiệm thu đạt.</p>
    <form className="mt-4 space-y-4" onSubmit={async (e) => {
      e.preventDefault(); stop.current = false; setBusy(true); setErrors([]); setProcessed(0);
      const saved: string[] = [], failures: string[] = [];
      try {
        for (let offset = 0; offset < entries.length && !stop.current; offset += 100) {
          const batch = entries.slice(offset, offset + 100);
          const { results } = await markQualityPass(batch, kind, date, method);
          for (const result of results) {
            if (result.error) failures.push(`${batch.find((r) => r.id === result.id)?.ma_lich_su ?? result.id}: ${result.error}`);
            else saved.push(result.id);
          }
          setProcessed(offset + batch.length);
        }
      } catch (err) { failures.push(err instanceof Error ? err.message : "Mất kết nối. Hãy tải lại danh sách trước khi thử tiếp."); }
      finally { setSuccessCount(saved.length); setErrors(failures); setBusy(false); onDone(saved); }
    }}>
      <fieldset disabled={busy || successCount !== null} className="space-y-3">
        <label className="block text-sm font-semibold">Tiêu chí cập nhật<select className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-blue-500" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="visual">Trực quan đạt sau mài</option><option value="ndt">NDT đạt</option></select></label>
        <label className="block text-sm font-semibold">{kind === "visual" ? "Ngày hoàn thành mài / kiểm tra trực quan" : "Ngày thí nghiệm"}<input type="date" required className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-blue-500" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        {kind === "ndt" && <label className="block text-sm font-semibold">Phương pháp NDT<select className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-blue-500" value={method} onChange={(e) => setMethod(e.target.value)}><option value="Siêu âm">Siêu âm</option><option value="Từ tính">Từ tính</option><option value="Thẩm thấu">Thẩm thấu</option></select></label>}
      </fieldset>
      <div role="status" className="text-sm">{busy ? `Đang xử lý ${processed}/${entries.length} mối…` : successCount !== null ? `Đã lưu ${successCount} mối. ${entries.length - processed} mối chưa xử lý. Các mối lưu lỗi vẫn được giữ trong tập chọn.` : "Kiểm tra đúng số mối và ngày trước khi lưu."}</div>
      {errors.length > 0 && <div role="alert" className="max-h-52 overflow-y-auto rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><ul className="space-y-2">{errors.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
      <div className="flex flex-wrap gap-2">
        {successCount === null && <button disabled={busy} className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{busy ? "Đang lưu…" : `Lưu Đạt cho ${entries.length.toLocaleString("vi-VN")} mối`}</button>}
        {busy ? <button type="button" onClick={() => { stop.current = true; }} className="min-h-11 rounded-lg border px-4 text-sm">Dừng sau lượt hiện tại</button> : <button type="button" onClick={onClose} className="min-h-11 rounded-lg border px-4 text-sm">Đóng</button>}
      </div>
    </form>
  </dialog>;
}
