"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { loadRfiNumber, notifyWeldQualityChanged, qualityRequest } from "@/lib/weldQualityClient";
import { GEOMETRY_CRITERIA, GEOMETRY_LABELS, type GeometryMeasurements } from "@/lib/weldQuality";
import WeldAcceptanceDocument from "@/components/WeldAcceptanceDocument";

export type SplitKind = "hinh-hoc" | "sieu-am";
type Candidate = { moi_han_id: string; ma_lich_su: string; ngay_mai: string | null; da_nt_truc_quan: boolean };
type Ticket = { id: string; so_phieu: string; ngay_moi: string; ngay_nghiem_thu: string | null; nguoi_lap: string; nguoi_nghiem_thu: string | null };
type Evidence = { co_the_dat: boolean; ngay_mai: string; truc_quan: string; gia_tri_do: GeometryMeasurements; ngay_ndt: string | null; ket_qua_ndt: string | null; phuong_phap_ndt: string; ten_tieu_chuan: string | null };
type Item = { moi_han_id: string; ma_lich_su: string; ma_diem?: string | null; ly_trinh?: string | null; current?: Evidence | null; version?: number; du_lieu_chot: Evidence; ket_qua: string | null; ly_do: string | null };
type Detail = { ticket: Ticket; items: Item[] };
type List = { candidates: Candidate[]; tickets: Ticket[] };
type Decision = { ket_qua: string; ly_do: string };
const field = "min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold disabled:opacity-50";
const primary = "min-h-10 rounded-lg bg-[#0047ab] px-4 text-sm font-semibold text-white disabled:opacity-50";
const today = () => new Date().toLocaleDateString("sv-SE");
const errorText = (e: unknown) => e instanceof Error ? e.message : "Không tải được dữ liệu.";
const dateLabel = (v: string | null) => v?.split("-").reverse().join("/") || "—";
const kindName = (kind: SplitKind) => kind === "hinh-hoc" ? "hình học, trực quan" : "siêu âm";

function evidenceText(kind: SplitKind, e?: Evidence | null) {
  if (!e) return "Kiểm tra lại dữ liệu chất lượng của mối.";
  if (kind === "sieu-am") return [e.phuong_phap_ndt, e.ket_qua_ndt || "Chưa có kết quả", dateLabel(e.ngay_ndt)].join(" · ");
  return ["Trực quan " + (e.truc_quan ?? "—"), ...GEOMETRY_CRITERIA.map(k =>
    GEOMETRY_LABELS[k] + " " + (e.gia_tri_do[k] == null ? "—" : e.gia_tri_do[k] + " mm"))].join(" · ");
}

export default function SplitWeldAcceptance({ project, projectName, kind }: { project: string; projectName: string; kind: SplitKind }) {
  const prefix = "RFI";
  const request = useCallback(<T,>(action: string, data: Record<string, unknown> = {}) =>
    qualityRequest<T>({ action, du_an_id: project, loai: kind, ...data }), [project, kind]);
  const [list, setList] = useState<List | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [number, setNumber] = useState("");
  const [inviteDate, setInviteDate] = useState(today);
  const [date, setDate] = useState(today);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [results, setResults] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doc, setDoc] = useState<"invite" | null>(null);
  const [ticketQuery, setTicketQuery] = useState("");
  const [ticketStatus, setTicketStatus] = useState<"" | "cho" | "xong">("");

  useEffect(() => {
    let active = true;
    request<List>("split-list").then(data => { if (active) setList(data); })
      .catch(e => { if (active) setError(errorText(e)); });
    // Gợi ý sẵn số phiếu tiếp theo để không phải gõ tay (vẫn sửa được).
    loadRfiNumber(project).then(r => { if (active) setNumber(cur => cur || r.so_phieu); }).catch(() => undefined);
    return () => { active = false; };
  }, [request, project]);

  async function run(task: () => Promise<void>) {
    setBusy(true); setError("");
    try { await task(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function refresh() {
    const next = await request<List>("split-list");
    setList(next);
    setSelected(prev => prev.filter(id => next.candidates.some(c => c.moi_han_id === id)));
  }
  async function openTicket(id: string) {
    const next = await request<Detail>("split-detail", { id });
    setDetail(next); setResults({}); setDate(next.ticket.ngay_nghiem_thu || [today(), next.ticket.ngay_moi].sort()[1]);
  }
  function patch(id: string, data: Partial<Decision>) {
    setResults(prev => ({ ...prev, [id]: { ...(prev[id] ?? { ket_qua: "", ly_do: "" }), ...data } }));
  }
  const tickets = useMemo(() => {
    const q = ticketQuery.trim().toLowerCase();
    return (list?.tickets ?? [])
      .filter((t) => (ticketStatus === "" || (ticketStatus === "xong") === Boolean(t.ngay_nghiem_thu))
        && (!q || [t.so_phieu, dateLabel(t.ngay_moi), dateLabel(t.ngay_nghiem_thu), t.nguoi_lap, t.nguoi_nghiem_thu ?? ""].some((v) => v.toLowerCase().includes(q))))
      .sort((a, b) => b.ngay_moi.localeCompare(a.ngay_moi) || b.so_phieu.localeCompare(a.so_phieu, "vi", { numeric: true }));
  }, [list, ticketQuery, ticketStatus]);
  const candidates = list?.candidates.filter(c => c.ma_lich_su.toLowerCase().includes(query.trim().toLowerCase())) ?? [];

  return <section className="space-y-4">
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {!detail && <>
      <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" onSubmit={e => {
        e.preventDefault();
        void run(async () => {
          const { id } = await request<{ id: string }>("split-publish", { id: crypto.randomUUID(), so_phieu: number, ngay_moi: inviteDate, moi_han_ids: selected });
          setSelected([]); setNumber(""); await openTicket(id); await refresh();
          void loadRfiNumber(project).then(r => setNumber(r.so_phieu)).catch(() => undefined);
        });
      }}>
        <h3 className="font-bold">Phát {prefix} nghiệm thu {kindName(kind)}</h3>
        <p className="text-sm text-slate-600">{kind === "hinh-hoc" ? "Chọn mối đã xác nhận nội bộ đạt hình học và trực quan sau mài." : "Chỉ hiện mối đã nghiệm thu hình học ĐẠT, đang chờ siêu âm."}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">Số phiếu {prefix}<input required maxLength={80} placeholder={prefix + "-001"} className={field} value={number} onChange={e => setNumber(e.target.value)} /></label>
          <label className="grid gap-1 text-sm">Ngày mời<input required type="date" className={field} value={inviteDate} onChange={e => setInviteDate(e.target.value)} /></label>
        </div>
        <input aria-label="Tìm mã mối hàn" placeholder="Tìm mã mối hàn…" className={field + " w-full"} value={query} onChange={e => setQuery(e.target.value)} />
        <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {candidates.map(c => <label key={c.moi_han_id} className="flex min-h-10 items-center gap-3 px-3 text-sm">
            <input type="checkbox" checked={selected.includes(c.moi_han_id)} disabled={busy || (selected.length >= 200 && !selected.includes(c.moi_han_id))}
              onChange={e => setSelected(e.target.checked ? [...selected, c.moi_han_id] : selected.filter(id => id !== c.moi_han_id))} />
            <b>{c.ma_lich_su}</b><span className="text-slate-600">{c.da_nt_truc_quan ? "Đã nghiệm thu trực quan" : "Đã xác nhận nội bộ"} · {dateLabel(c.ngay_mai)}</span>
          </label>)}
          {!candidates.length && <p className="p-3 text-sm text-slate-600">{list ? "Không tìm thấy mối đủ điều kiện." : error ? "Chưa tải được danh sách." : "Đang tải danh sách…"}</p>}
        </div>
        <button disabled={busy || !number.trim() || !selected.length} className={primary}>Phát {prefix} ({selected.length} mối)</button>
        {!number.trim() && selected.length > 0 && <p role="status" className="text-sm text-amber-800">Nhập số phiếu {prefix} (ô trên) thì mới phát được.</p>}
      </form>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">Phiếu đã phát và biên bản <span className="font-mono text-xs font-semibold text-slate-500">{tickets.length}/{list?.tickets.length ?? 0}</span></h3>
          <button className={button} disabled={busy} onClick={() => run(refresh)}>Tải lại</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Tìm phiếu" placeholder="Tìm số phiếu, ngày, người lập / nghiệm thu…" className={field + " min-w-0 flex-1"} value={ticketQuery} onChange={e => setTicketQuery(e.target.value)} />
          <select aria-label="Lọc trạng thái phiếu" className={field} value={ticketStatus} onChange={e => setTicketStatus(e.target.value as typeof ticketStatus)}>
            <option value="">Tất cả trạng thái</option><option value="cho">Chờ nghiệm thu</option><option value="xong">Đã nghiệm thu</option>
          </select>
        </div>
        {list && list.tickets.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr><th className="px-3 py-2">STT</th><th className="px-3 py-2">Số phiếu</th><th className="px-3 py-2">Ngày mời</th><th className="px-3 py-2">Ngày nghiệm thu</th><th className="px-3 py-2">Người lập</th><th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2 text-right">Thao tác</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t, i) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 font-bold">{t.so_phieu}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono">{dateLabel(t.ngay_moi)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono">{dateLabel(t.ngay_nghiem_thu)}</td>
                    <td className="px-3 py-2">{t.nguoi_lap || "—"}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.ngay_nghiem_thu ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{t.ngay_nghiem_thu ? "Đã nghiệm thu" : "Chờ nghiệm thu"}</span></td>
                    <td className="px-3 py-2 text-right"><button disabled={busy} className={button} onClick={() => run(() => openTicket(t.id))}>{t.ngay_nghiem_thu ? "Xem" : "Nghiệm thu"}</button></td>
                  </tr>
                ))}
                {tickets.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center text-slate-500">Không có phiếu khớp bộ lọc.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {list?.tickets.length === 0 && <p className="text-sm text-slate-500">Chưa có phiếu {prefix} trong nhánh này.</p>}
      </div>
    </>}
    {detail && <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} disabled={busy} onClick={() => { setDetail(null); void run(refresh); }}>← Danh sách</button>
        <button className={button} onClick={() => setDoc("invite")}>Xem phiếu {prefix}</button>
        {!detail.ticket.ngay_nghiem_thu && <button className={button} disabled={busy} onClick={() => run(() => openTicket(detail.ticket.id))}>Tải lại số đo</button>}
      </div>
      <h3 className="font-bold">{detail.ticket.so_phieu} · Nghiệm thu {kindName(kind)}</h3>
      <form className="space-y-3" onSubmit={e => {
        e.preventDefault();
        void run(async () => {
          await request("split-complete", { id: detail.ticket.id, ngay_nghiem_thu: date, results: detail.items.map(i => ({
            id: i.moi_han_id, phien_ban: i.version, ...results[i.moi_han_id],
          })) });
          notifyWeldQualityChanged();
          await openTicket(detail.ticket.id); await refresh();
        });
      }}>
        <label className="flex flex-wrap items-center gap-2 text-sm">Ngày nghiệm thu<input type="date" required className={field} min={detail.ticket.ngay_moi}
          disabled={Boolean(detail.ticket.ngay_nghiem_thu) || busy} value={date} onChange={e => setDate(e.target.value)} /></label>
        {detail.items.map(i => <div key={i.moi_han_id} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <b>{i.ma_lich_su}</b>
            <p className="mt-0.5 text-slate-600">{evidenceText(kind, detail.ticket.ngay_nghiem_thu ? i.du_lieu_chot : i.current)}</p>
            {!i.ket_qua && !i.current?.co_the_dat && <p className="mt-1 text-amber-800">{kind === "sieu-am" ? "Để chọn Đạt, ghi kết quả bằng phương pháp Siêu âm và ngày thí nghiệm trong Kiểm tra chất lượng." : "Để chọn Đạt, bổ sung đủ số đo theo tiêu chí trong Kiểm tra chất lượng."}</p>}
          </div>
          <div className="flex shrink-0 flex-col gap-1.5 sm:w-48">
            {i.ket_qua ? <p className={`rounded-md px-2 py-1.5 text-center font-semibold ${i.ket_qua === "Đạt" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{i.ket_qua}{i.ly_do ? ` · ${i.ly_do}` : ""}</p> : <>
              <select aria-label={"Kết quả " + i.ma_lich_su} required disabled={busy} className={field + " w-full"} value={results[i.moi_han_id]?.ket_qua || ""} onChange={e => patch(i.moi_han_id, { ket_qua: e.target.value, ly_do: "" })}>
                <option value="">Chọn kết quả</option><option disabled={!i.current?.co_the_dat}>Đạt</option><option>Không đạt</option>
              </select>
              {results[i.moi_han_id]?.ket_qua === "Không đạt" && <input required maxLength={1000} aria-label={"Lý do " + i.ma_lich_su} placeholder="Lý do không đạt" className={field + " w-full"} value={results[i.moi_han_id]?.ly_do || ""} onChange={e => patch(i.moi_han_id, { ly_do: e.target.value })} />}
            </>}
          </div>
        </div>)}
        {!detail.ticket.ngay_nghiem_thu && <button className={primary} disabled={busy}>Chốt nghiệm thu và lập biên bản</button>}
      </form>
    </div>}
    {doc === "invite" && detail && createPortal(<WeldAcceptanceDocument onClose={() => setDoc(null)} view={{ kind: "rfi", rfi: {
      projectName,
      rfi: { ...detail.ticket, trang_thai: detail.ticket.ngay_nghiem_thu ? "Đã hoàn thành" : "Đã phát hành", created_at: "",
        tong_moi: detail.items.length, con_lai: detail.ticket.ngay_nghiem_thu ? 0 : detail.items.length,
        thong_tin: { loai_rfi: "nghiem-thu", nt_hinh_hoc: kind === "hinh-hoc" ? "1" : "", nt_sieu_am: kind === "sieu-am" ? "1" : "" } },
      welds: detail.items.map(i => ({ moi_han_id: i.moi_han_id, ma_lich_su: i.ma_lich_su, ly_trinh: i.ly_trinh ?? null, ma_diem: i.ma_diem ?? null,
        con_hieu_luc: !detail.ticket.ngay_nghiem_thu, ngay_thuc_hien: null, vi_do: null, kinh_do: null,
        phien_ban: i.version ?? 0, tinh_trang: i.ket_qua ?? "Chưa nghiệm thu", du_dieu_kien_nghiem_thu: Boolean(i.current?.co_the_dat) })),
    } }} />, document.body)}
  </section>;
}
