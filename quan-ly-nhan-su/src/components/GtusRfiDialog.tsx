"use client";

import { useEffect, useState } from "react";
import { loadGtusDetail, saveGtus, type GtusThanh } from "@/lib/weldQualityClient";

type Draft = { ketQua: "" | "Đạt" | "Không đạt"; ngayNt: string; lyDo: string; tyLe: string; ngayTt: string; ghiChu: string };

const today = () => new Date().toISOString().slice(0, 10);
const input = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900";

const toDraft = (t: GtusThanh): Draft => ({
  ketQua: t.ket_qua ?? "", ngayNt: t.ngay_nghiem_thu ?? today(), lyDo: t.ly_do ?? "",
  tyLe: t.ty_le == null ? "" : String(t.ty_le), ngayTt: t.ngay_thanh_toan ?? today(), ghiChu: t.ghi_chu_thanh_toan ?? "",
});

/**
 * Nghiệm thu và thanh toán từng thanh ray của RFI giải toả ứng suất — cùng cách làm như mối hàn của RFI nghiệm thu:
 * kết quả Đạt / Không đạt, tỷ lệ thanh toán 30 / 50 / 70 / 100%, lưu trong hệ thống; thanh Đạt tự đánh dấu «đã giải toả» trên track map.
 */
export default function GtusRfiDialog({ rfiId, onClose, onPrint }: { rfiId: string; onClose: () => void; onPrint: () => void }) {
  const [soPhieu, setSoPhieu] = useState("");
  const [items, setItems] = useState<GtusThanh[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    loadGtusDetail(rfiId).then((r) => {
      if (!active) return;
      setSoPhieu(r.rfi.so_phieu);
      setItems(r.items);
      setDrafts(Object.fromEntries(r.items.map((t) => [t.thanh_id, toDraft(t)])));
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Không tải được phiếu."); });
    return () => { active = false; };
  }, [rfiId]);

  const patch = (id: string, change: Partial<Draft>) => setDrafts((cur) => ({ ...cur, [id]: { ...cur[id], ...change } }));
  const total = items.length;
  const passed = items.filter((t) => drafts[t.thanh_id]?.ketQua === "Đạt").length;
  const failed = items.filter((t) => drafts[t.thanh_id]?.ketQua === "Không đạt").length;
  const paid = items.filter((t) => drafts[t.thanh_id]?.tyLe).length;
  const km = (t: GtusThanh) => `${t.ly_trinh_dau} – ${t.ly_trinh_cuoi}`;
  const passedLength = items.filter((t) => drafts[t.thanh_id]?.ketQua === "Đạt").reduce((sum, t) => sum + Number(t.chieu_dai), 0);

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await saveGtus(rfiId, items.map((t) => {
        const d = drafts[t.thanh_id];
        return {
          thanh_id: t.thanh_id, ket_qua: d.ketQua || null, ngay_nghiem_thu: d.ngayNt, ly_do: d.lyDo,
          ty_le: d.tyLe ? Number(d.tyLe) : null, ngay_thanh_toan: d.ngayTt, ghi_chu: d.ghiChu,
        };
      }));
      setMessage(`Đã lưu.${result.released ? ` ${result.released} thanh được cập nhật trạng thái giải toả trên track map.` : ""}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được."); }
    finally { setBusy(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Nghiệm thu và thanh toán GTUS ${soPhieu}`} className="fixed inset-0 z-[1500] flex items-start justify-center overflow-auto bg-slate-900/60 p-3 sm:p-6">
      <div className="w-full max-w-5xl space-y-3 rounded-xl bg-white p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">Giải toả ứng suất · {soPhieu || "…"} — nghiệm thu &amp; thanh toán từng thanh</h2>
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold">Đóng</button>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <p className="text-sm text-slate-700">
          {total} thanh · đạt <b>{passed}</b> ({passedLength.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} m) · không đạt <b>{failed}</b> · đã thanh toán <b>{paid}</b>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold" disabled={busy || !total}
            onClick={() => setDrafts((cur) => Object.fromEntries(Object.entries(cur).map(([id, d]) => [id, { ...d, ketQua: d.ketQua || "Đạt" }])))}>Chọn Đạt cho các thanh chưa có kết quả</button>
          <button type="button" className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold" disabled={busy || !total}
            onClick={() => setDrafts((cur) => Object.fromEntries(Object.entries(cur).map(([id, d]) => [id, d.ketQua === "Đạt" && !d.tyLe ? { ...d, tyLe: "100" } : d])))}>Thanh toán 100% cho thanh Đạt</button>
          <button type="button" className="h-9 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !total} onClick={() => void save()}>{busy ? "Đang lưu…" : "Lưu"}</button>
          <button type="button" className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold" onClick={onPrint}>In BBNT - GTUS</button>
          {message && <span role="status" className="self-center text-sm text-emerald-700">{message}</span>}
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="p-2">Thanh</th><th className="p-2">Tuyến · Ray</th><th className="p-2">Lý trình</th><th className="p-2 text-right">Dài (m)</th>
                <th className="p-2">Nghiệm thu</th><th className="p-2">Ngày NT / Lý do</th><th className="p-2">Thanh toán</th><th className="p-2">Ghi chú TT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((t) => {
                const d = drafts[t.thanh_id];
                if (!d) return null;
                return (
                  <tr key={t.thanh_id}>
                    <td className="whitespace-nowrap p-2 font-mono font-semibold">{t.ma_thanh}{t.ma_lwr ? <span className="ml-1 text-xs font-normal text-slate-500">({t.ma_lwr})</span> : null}</td>
                    <td className="whitespace-nowrap p-2">{t.route === "ha" ? "Hạ" : "Thượng"} · {t.ray === "trai" ? "trái" : "phải"}</td>
                    <td className="whitespace-nowrap p-2 font-mono text-xs">{km(t)}</td>
                    <td className="p-2 text-right tabular-nums">{Number(t.chieu_dai).toLocaleString("vi-VN", { maximumFractionDigits: 3 })}</td>
                    <td className="p-2">
                      <select aria-label={`Kết quả ${t.ma_thanh}`} className={input} value={d.ketQua} onChange={(e) => patch(t.thanh_id, { ketQua: e.target.value as Draft["ketQua"] })}>
                        <option value="">Chưa nghiệm thu</option><option value="Đạt">Đạt</option><option value="Không đạt">Không đạt</option>
                      </select>
                    </td>
                    <td className="p-2">
                      {d.ketQua === "Không đạt"
                        ? <input aria-label={`Lý do ${t.ma_thanh}`} className={input} placeholder="Lý do không đạt" value={d.lyDo} onChange={(e) => patch(t.thanh_id, { lyDo: e.target.value })} />
                        : d.ketQua ? <input aria-label={`Ngày nghiệm thu ${t.ma_thanh}`} type="date" className={input} value={d.ngayNt} onChange={(e) => patch(t.thanh_id, { ngayNt: e.target.value })} /> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-2">
                      <select aria-label={`Thanh toán ${t.ma_thanh}`} className={input} value={d.tyLe} onChange={(e) => patch(t.thanh_id, { tyLe: e.target.value })}>
                        <option value="">Chưa thanh toán</option>{[30, 50, 70, 100].map((n) => <option key={n} value={n}>{n}%</option>)}
                      </select>
                    </td>
                    <td className="p-2">{d.tyLe ? <input aria-label={`Ghi chú thanh toán ${t.ma_thanh}`} className={input} value={d.ghiChu} onChange={(e) => patch(t.thanh_id, { ghiChu: e.target.value })} /> : <span className="text-slate-400">—</span>}</td>
                  </tr>
                );
              })}
              {!items.length && !error && <tr><td colSpan={8} className="p-3 text-slate-500">Đang tải…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
