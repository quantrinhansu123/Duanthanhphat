"use client";

import { useCallback, useEffect, useState } from "react";
import GtusBbntPrintDialog from "@/components/GtusBbntPrintDialog";
import GtusRfiDialog from "@/components/GtusRfiDialog";
import PendingDialog from "@/components/PendingDialog";
import RowActionsMenu from "@/components/RowActionsMenu";
import { useBbntScan } from "@/components/useBbntScan";
import { bbntScanInfo, loadGtusDetail, loadRfiOverview, rfiPendingInfo, setRfiPending, type GtusThanh, type RfiSummary } from "@/lib/weldQualityClient";

type Row = { rfi: RfiSummary; items: GtusThanh[] };

const dmy = (v: string | null | undefined) => (v ? v.slice(0, 10).split("-").reverse().join("/") : "—");
/** Số phiếu GTUS phát đi: số RFI chính (chạy liên tục) + đuôi -GTUS, như -HH / -SA của hình học và siêu âm. */
export const gtusTicketNo = (soPhieu: string) => `${soPhieu.replace(/-GTUS$/i, "")}-GTUS`;

const stats = (items: GtusThanh[]) => {
  const pass = items.filter((t) => t.ket_qua === "Đạt").length;
  const fail = items.filter((t) => t.ket_qua === "Không đạt").length;
  return { pass, fail, waiting: items.length - pass - fail, paid: items.filter((t) => t.ty_le != null).length };
};

/**
 * Tab «Giải toả ứng suất»: như tab Nghiệm thu Hình Học / Siêu âm, có hai mục:
 * - «Chờ nghiệm thu»: phiếu đã phát còn thanh chưa nghiệm thu (kể cả phiếu Pending chờ phát lại);
 * - «Hồ sơ nghiệm thu»: phiếu đã nghiệm thu đủ các thanh — in BBNT, tải lên bản scan đã ký.
 * Phiếu được phát ở tab «Phát phiếu RFI» (số chạy liên tục cùng RFI chính).
 */
export default function GtusAcceptanceTab({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [sub, setSub] = useState<"cho" | "ho-so">("cho");
  const [manage, setManage] = useState<RfiSummary | null>(null);
  const [print, setPrint] = useState<RfiSummary | null>(null);
  const [pendingDlg, setPendingDlg] = useState<RfiSummary | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const { rfis } = await loadRfiOverview(projectId);
      const gtus = rfis.filter((r) => r.thong_tin?.cong_viec === "gtus").sort((a, b) => (a.ngay_moi < b.ngay_moi ? 1 : -1));
      const details = await Promise.all(gtus.map((rfi) => loadGtusDetail(rfi.id).then((d) => d.items).catch(() => [] as GtusThanh[])));
      setRows(gtus.map((rfi, i) => ({ rfi, items: details[i] })));
    } catch (e) { setError(e instanceof Error ? e.message : "Không tải được danh sách."); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const scan = useBbntScan({ onDone: async (m) => { setOkMsg(m); await load(); }, onError: setError });

  /** Pending (huỷ / không thực hiện) hoặc phát lại phiếu với ngày mới; số phiếu giữ nguyên. */
  async function submitPending(rfi: RfiSummary, input: { ly_do?: string; ngay_moi?: string }) {
    const pend = rfiPendingInfo(rfi.thong_tin);
    await setRfiPending({ id: rfi.id, kind: "rfi", hanh_dong: pend ? "phat-lai" : "hoan", ...input });
    await load();
  }

  // Hồ sơ = đã có kết quả cho mọi thanh và không ở trạng thái Pending; còn lại là chờ nghiệm thu.
  const isRecord = ({ rfi, items }: Row) => items.length > 0 && stats(items).waiting === 0 && !rfiPendingInfo(rfi.thong_tin);
  const waitingRows = rows.filter((r) => !isRecord(r));
  const recordRows = rows.filter(isRecord);
  const shown = sub === "cho" ? waitingRows : recordRows;
  const cols = sub === "cho" ? 11 : 9;

  const subButton = (id: "cho" | "ho-so", label: string, count: number) => (
    <button key={id} type="button" aria-pressed={sub === id} onClick={() => setSub(id)}
      className={`min-h-12 rounded-xl border-2 px-4 text-sm font-bold ${sub === id ? "border-[#0047AB] bg-[#0047AB] text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}>
      {label} ({count})
    </button>
  );

  return (
    <section className="space-y-3">
      {scan.node}
      <div className="grid gap-2 sm:grid-cols-2">
        {subButton("cho", "Chờ nghiệm thu giải toả ứng suất", waitingRows.length)}
        {subButton("ho-so", "Hồ sơ nghiệm thu", recordRows.length)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">{sub === "cho" ? "Phiếu giải toả ứng suất chờ nghiệm thu" : "Hồ sơ nghiệm thu giải toả ứng suất"}</h2>
        <button type="button" onClick={() => { setLoading(true); void load(); }} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-50">Tải lại</button>
      </div>
      <p className="text-xs text-slate-600">
        {sub === "cho"
          ? "Phát phiếu ở tab «Phát phiếu RFI» (chọn «3. Giải toả ứng suất»). Số phiếu chạy liên tục cùng RFI chính; phiếu phát đi mang đuôi -GTUS. Ở đây nghiệm thu, thanh toán từng thanh, hoãn (Pending) hoặc phát lại."
          : "Phiếu đã nghiệm thu đủ các thanh: in BBNT, tải lên bản scan biên bản đã ký (lưu vào AppSheet) và xem lại."}
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {okMsg && <p role="status" className="text-sm text-emerald-700">{okMsg}</p>}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full whitespace-nowrap text-xs sm:text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-10 p-2 text-left">STT</th>
              <th className="p-2 text-left">Số phiếu</th>
              <th className="p-2 text-left">Ngày phát</th>
              {sub === "ho-so" && <th className="p-2 text-left">Ngày nghiệm thu</th>}
              <th className="p-2 text-left">Thanh LWR</th>
              <th className="p-2 text-center">Thanh</th>
              <th className="p-2 text-center">Đạt</th>
              <th className="p-2 text-center">K.đạt</th>
              {sub === "cho" && <th className="p-2 text-center">Chưa NT</th>}
              <th className="p-2 text-center">Đã TT</th>
              <th className="p-2 text-left">Trạng thái</th>
              <th className="p-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={cols + 2} className="p-4 text-center text-slate-500">Đang tải…</td></tr>
              : shown.length === 0 ? <tr><td colSpan={cols + 2} className="p-4 text-center text-slate-500">{sub === "cho" ? "Không có phiếu giải toả ứng suất nào đang chờ nghiệm thu." : "Chưa có hồ sơ giải toả ứng suất nào đã nghiệm thu đủ."}</td></tr>
              : shown.map(({ rfi, items }, i) => {
                const { pass, fail, waiting, paid } = stats(items);
                const pend = rfiPendingInfo(rfi.thong_tin);
                const saved = bbntScanInfo(rfi.thong_tin);
                const lastDate = items.map((t) => t.ngay_nghiem_thu).filter(Boolean).sort().at(-1);
                const status = pend ? "Pending" : sub === "ho-so" ? (fail ? "Có thanh không đạt" : "Đã nghiệm thu") : items.some((t) => t.ket_qua) ? "Đang nghiệm thu" : "Chờ nghiệm thu";
                return (
                  <tr key={rfi.id}>
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2 font-medium">{gtusTicketNo(rfi.so_phieu)}</td>
                    <td className="p-2">{dmy(rfi.ngay_moi)}</td>
                    {sub === "ho-so" && <td className="p-2">{dmy(lastDate)}</td>}
                    <td className="max-w-[18rem] truncate p-2" title={rfi.thong_tin?.lwr_codes}>{rfi.thong_tin?.lwr_codes || "—"}</td>
                    <td className="p-2 text-center">{items.length}</td>
                    <td className="p-2 text-center">{pass}</td>
                    <td className="p-2 text-center">{fail}</td>
                    {sub === "cho" && <td className="p-2 text-center">{waiting}</td>}
                    <td className="p-2 text-center">{paid}</td>
                    <td className="p-2">
                      {pend ? <span className="rounded-full bg-orange-100 px-2 py-0.5 font-bold text-orange-800" title={pend.ly_do || "Hoãn / không thực hiện — chờ phát lại"}>Pending</span> : status}
                      {saved && <a href={saved.url} target="_blank" rel="noopener" title={`Biên bản đã ký: ${saved.ten ?? ""}`} className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 hover:underline">📎 Đã scan</a>}
                    </td>
                    <td className="p-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => setManage(rfi)} className="h-8 rounded-md border border-[#0047AB]/40 bg-[#0047AB]/5 px-2.5 font-semibold text-[#0047AB] hover:bg-[#0047AB]/10">{sub === "cho" ? "Nghiệm thu / thanh toán" : "Xem / thanh toán"}</button>
                        <button type="button" onClick={() => setPrint(rfi)} className="h-8 rounded-md border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50">In BBNT</button>
                        <RowActionsMenu label={`Thao tác phiếu ${rfi.so_phieu}`} actions={[
                          ...(sub === "ho-so" ? scan.actions({ id: rfi.id, kind: "rfi", so_phieu: rfi.so_phieu, thong_tin: rfi.thong_tin }) : []),
                          ...(sub === "cho" ? [{ label: pend ? "Phát lại (ngày mới)" : "Pending (hoãn / không thực hiện)", onSelect: () => setPendingDlg(rfi) }] : []),
                        ]} />
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {pendingDlg && (
        <PendingDialog
          mode={rfiPendingInfo(pendingDlg.thong_tin) ? "phat-lai" : "hoan"}
          soPhieu={pendingDlg.so_phieu}
          oldDate={pendingDlg.ngay_moi}
          reason={rfiPendingInfo(pendingDlg.thong_tin)?.ly_do}
          onSubmit={(input) => submitPending(pendingDlg, input)}
          onClose={() => setPendingDlg(null)}
        />
      )}
      {manage && <GtusRfiDialog rfiId={manage.id} onClose={() => { setManage(null); void load(); }} onPrint={() => setPrint(manage)} />}
      {print && (
        <GtusBbntPrintDialog
          projectId={projectId}
          projectName={projectName}
          cellIds={String(print.thong_tin?.lwr_ids ?? "").split(",").filter(Boolean)}
          pycSo={gtusTicketNo(print.so_phieu).replace(/^RFI-/i, "")}
          onClose={() => setPrint(null)}
        />
      )}
    </section>
  );
}
