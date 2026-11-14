"use client";

import { useEffect, useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Hộp thoại Pending / Phát lại phiếu.
 * - hoan: huỷ hoặc không thực hiện nghiệm thu → nhập lý do (không bắt buộc); phiếu giữ nguyên số và mối.
 * - phat-lai: chọn ngày mời nghiệm thu mới; số phiếu giữ nguyên.
 */
export default function PendingDialog({ mode, soPhieu, oldDate, reason, onSubmit, onClose }: {
  mode: "hoan" | "phat-lai";
  soPhieu: string;
  /** Ngày mời hiện tại của phiếu (hiện khi phát lại). */
  oldDate?: string;
  /** Lý do đã ghi lúc hoãn (hiện khi phát lại). */
  reason?: string;
  onSubmit: (input: { ly_do?: string; ngay_moi?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [lyDo, setLyDo] = useState("");
  const [ngay, setNgay] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function submit() {
    if (mode === "phat-lai" && !ngay) { setError("Chọn ngày mời nghiệm thu mới."); return; }
    setBusy(true); setError("");
    try {
      await onSubmit(mode === "hoan" ? { ly_do: lyDo.trim() } : { ngay_moi: ngay });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được phiếu.");
      setBusy(false);
    }
  }

  const reissue = mode === "phat-lai";
  return (
    <div className="no-print fixed inset-0 z-[1600] flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label={reissue ? "Phát lại phiếu" : "Chuyển phiếu sang Pending"}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700" aria-hidden>{reissue ? "↻" : "⏸"}</span>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900">{reissue ? `Phát lại phiếu ${soPhieu}` : `Chuyển phiếu ${soPhieu} sang Pending`}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {reissue
                ? "Số phiếu giữ nguyên, đổi ngày mời nghiệm thu rồi đi lại luồng nghiệm thu → ký BBNT → lưu trữ."
                : "Huỷ hoặc không thực hiện nghiệm thu lần này. Phiếu giữ nguyên số và các mối để theo dõi, phát lại sau."}
            </p>
          </div>
        </div>

        {reissue ? (
          <div className="mt-4 space-y-3">
            {(oldDate || reason) && (
              <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-900">
                {oldDate ? <>Ngày mời trước: <b>{oldDate.split("-").reverse().join("/")}</b>. </> : null}
                {reason ? <>Lý do hoãn: {reason}</> : "Không ghi lý do hoãn."}
              </p>
            )}
            <label className="block text-sm font-semibold text-slate-700">Ngày mời nghiệm thu mới
              <input type="date" autoFocus value={ngay} onChange={(e) => setNgay(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-base font-normal" />
            </label>
          </div>
        ) : (
          <label className="mt-4 block text-sm font-semibold text-slate-700">Lý do <span className="font-normal text-slate-500">(không bắt buộc)</span>
            <textarea autoFocus rows={3} maxLength={300} value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Ví dụ: mưa, chưa đủ điều kiện nghiệm thu, hoãn theo yêu cầu TVGS…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-normal" />
          </label>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Huỷ</button>
          <button type="button" disabled={busy} onClick={() => void submit()} className="h-11 rounded-lg bg-orange-600 px-5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50">
            {busy ? "Đang lưu…" : reissue ? "Phát lại" : "Chuyển Pending"}
          </button>
        </div>
      </div>
    </div>
  );
}
