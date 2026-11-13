"use client";

import { useCallback, useEffect, useState } from "react";
import GtusBbntPrintDialog from "@/components/GtusBbntPrintDialog";
import GtusRfiDialog from "@/components/GtusRfiDialog";
import { loadGtusDetail, loadRfiOverview, type GtusThanh, type RfiSummary } from "@/lib/weldQualityClient";

type Row = { rfi: RfiSummary; items: GtusThanh[] };

const dmy = (v: string) => (v ? v.slice(0, 10).split("-").reverse().join("/") : "—");
/** Số phiếu GTUS phát đi: số RFI chính (chạy liên tục) + đuôi -GTUS, như -HH / -SA của hình học và siêu âm. */
export const gtusTicketNo = (soPhieu: string) => `${soPhieu.replace(/-GTUS$/i, "")}-GTUS`;

/**
 * Tab «Giải toả ứng suất»: quản lý các RFI giải toả ứng suất đã phát — nghiệm thu / thanh toán từng thanh, in biên bản —
 * giống tab Nghiệm thu Hình Học và Siêu âm. Phiếu được phát ở tab «Phát phiếu RFI» (số chạy liên tục cùng RFI chính).
 */
export default function GtusAcceptanceTab({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manage, setManage] = useState<RfiSummary | null>(null);
  const [print, setPrint] = useState<RfiSummary | null>(null);

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

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">Phiếu giải toả ứng suất đã phát</h2>
        <button type="button" onClick={() => { setLoading(true); void load(); }} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-50">Tải lại</button>
      </div>
      <p className="text-xs text-slate-600">Phát phiếu ở tab «Phát phiếu RFI» (chọn «3. Giải toả ứng suất»). Số phiếu chạy liên tục cùng RFI chính; phiếu phát đi mang đuôi -GTUS. Ở đây nghiệm thu, thanh toán từng thanh và in hồ sơ.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full whitespace-nowrap text-xs sm:text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-10 p-2 text-left">STT</th>
              <th className="p-2 text-left">Số phiếu</th>
              <th className="p-2 text-left">Ngày phát</th>
              <th className="p-2 text-left">Thanh LWR</th>
              <th className="p-2 text-center">Thanh</th>
              <th className="p-2 text-center">Đạt</th>
              <th className="p-2 text-center">K.đạt</th>
              <th className="p-2 text-center">Chưa NT</th>
              <th className="p-2 text-center">Đã TT</th>
              <th className="p-2 text-left">Trạng thái</th>
              <th className="p-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={11} className="p-4 text-center text-slate-500">Đang tải…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={11} className="p-4 text-center text-slate-500">Chưa có phiếu giải toả ứng suất nào.</td></tr>
              : rows.map(({ rfi, items }, i) => {
                const pass = items.filter((t) => t.ket_qua === "Đạt").length;
                const fail = items.filter((t) => t.ket_qua === "Không đạt").length;
                const paid = items.filter((t) => t.ty_le != null).length;
                const pending = items.length - pass - fail;
                const status = items.length && pending === 0 ? (fail ? "Có thanh không đạt" : "Đã nghiệm thu") : items.some((t) => t.ket_qua) ? "Đang nghiệm thu" : "Chờ nghiệm thu";
                return (
                  <tr key={rfi.id}>
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2 font-medium">{gtusTicketNo(rfi.so_phieu)}</td>
                    <td className="p-2">{dmy(rfi.ngay_moi)}</td>
                    <td className="max-w-[18rem] truncate p-2" title={rfi.thong_tin?.lwr_codes}>{rfi.thong_tin?.lwr_codes || "—"}</td>
                    <td className="p-2 text-center">{items.length}</td>
                    <td className="p-2 text-center">{pass}</td>
                    <td className="p-2 text-center">{fail}</td>
                    <td className="p-2 text-center">{pending}</td>
                    <td className="p-2 text-center">{paid}</td>
                    <td className="p-2">{status}</td>
                    <td className="p-2 text-right">
                      <div className="inline-flex gap-1">
                        <button type="button" onClick={() => setManage(rfi)} className="h-8 rounded-md border border-[#0047AB]/40 bg-[#0047AB]/5 px-2.5 font-semibold text-[#0047AB] hover:bg-[#0047AB]/10">Nghiệm thu / thanh toán</button>
                        <button type="button" onClick={() => setPrint(rfi)} className="h-8 rounded-md border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50">In BBNT</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
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
