"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { qualityRequest } from "@/lib/weldQualityClient";
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
  const [doc, setDoc] = useState<"invite" | "record" | null>(null);

  useEffect(() => {
    let active = true;
    request<List>("split-list").then(data => { if (active) setList(data); })
      .catch(e => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [request]);

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
  const candidates = list?.candidates.filter(c => c.ma_lich_su.toLowerCase().includes(query.trim().toLowerCase())) ?? [];

  return <section className="space-y-4">
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {!detail && <>
      <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" onSubmit={e => {
        e.preventDefault();
        void run(async () => {
          const { id } = await request<{ id: string }>("split-publish", { id: crypto.randomUUID(), so_phieu: number, ngay_moi: inviteDate, moi_han_ids: selected });
          setSelected([]); setNumber(""); await openTicket(id); await refresh();
        });
      }}>
        <h3 className="font-bold">Phát {prefix} nghiệm thu {kindName(kind)}</h3>
        <p className="text-sm text-slate-600">{kind === "hinh-hoc" ? "Chọn mối đã xác nhận nội bộ đạt hình học và trực quan sau mài." : "Chọn mối đã nghiệm thu trực quan hoặc đã xác nhận nội bộ trực quan sau mài."}</p>
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
      </form>
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between"><h3 className="font-bold">Phiếu đã phát và biên bản</h3><button className={button} disabled={busy} onClick={() => run(refresh)}>Tải lại</button></div>
        {list?.tickets.map(t => <button key={t.id} disabled={busy} className={button + " flex w-full items-center justify-between gap-3 text-left"} onClick={() => run(() => openTicket(t.id))}>
          <span>{t.so_phieu} · {dateLabel(t.ngay_moi)}</span><span>{t.ngay_nghiem_thu ? "Xem biên bản" : "Nghiệm thu"}</span>
        </button>)}
        {list?.tickets.length === 0 && <p className="text-sm text-slate-500">Chưa có phiếu {prefix} trong nhánh này.</p>}
      </div>
    </>}
    {detail && <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} disabled={busy} onClick={() => { setDetail(null); void run(refresh); }}>← Danh sách</button>
        <button className={button} onClick={() => setDoc("invite")}>Xem phiếu {prefix}</button>
        {detail.ticket.ngay_nghiem_thu ? <button className={primary} onClick={() => setDoc("record")}>Xem biên bản</button>
          : <button className={button} disabled={busy} onClick={() => run(() => openTicket(detail.ticket.id))}>Tải lại số đo</button>}
      </div>
      <h3 className="font-bold">{detail.ticket.so_phieu} · Nghiệm thu {kindName(kind)}</h3>
      <form className="space-y-3" onSubmit={e => {
        e.preventDefault();
        void run(async () => {
          await request("split-complete", { id: detail.ticket.id, ngay_nghiem_thu: date, results: detail.items.map(i => ({
            id: i.moi_han_id, phien_ban: i.version, ...results[i.moi_han_id],
          })) });
          await openTicket(detail.ticket.id); setDoc("record"); await refresh();
        });
      }}>
        <label className="flex flex-wrap items-center gap-2 text-sm">Ngày nghiệm thu<input type="date" required className={field} min={detail.ticket.ngay_moi}
          disabled={Boolean(detail.ticket.ngay_nghiem_thu) || busy} value={date} onChange={e => setDate(e.target.value)} /></label>
        {detail.items.map(i => <div key={i.moi_han_id} className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
          <b>{i.ma_lich_su}</b><p>{evidenceText(kind, detail.ticket.ngay_nghiem_thu ? i.du_lieu_chot : i.current)}</p>
          {i.ket_qua ? <p>{i.ket_qua} {i.ly_do}</p> : <>
            <select aria-label={"Kết quả " + i.ma_lich_su} required disabled={busy} className={field} value={results[i.moi_han_id]?.ket_qua || ""} onChange={e => patch(i.moi_han_id, { ket_qua: e.target.value, ly_do: "" })}>
              <option value="">Chọn kết quả</option><option disabled={!i.current?.co_the_dat}>Đạt</option><option>Không đạt</option>
            </select>
            {!i.current?.co_the_dat && <p className="text-amber-800">{kind === "sieu-am" ? "Để chọn Đạt, ghi kết quả bằng phương pháp Siêu âm và ngày thí nghiệm trong Kiểm tra chất lượng." : "Để chọn Đạt, bổ sung đủ số đo theo tiêu chí trong Kiểm tra chất lượng."}</p>}
            {results[i.moi_han_id]?.ket_qua === "Không đạt" && <input required maxLength={1000} aria-label={"Lý do " + i.ma_lich_su} placeholder="Lý do không đạt" className={field + " w-full"} value={results[i.moi_han_id]?.ly_do || ""} onChange={e => patch(i.moi_han_id, { ly_do: e.target.value })} />}
          </>}
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
    {doc === "record" && detail && createPortal(<div className="split-weld-print fixed inset-0 z-[110] overflow-y-auto bg-slate-100 p-4" role="dialog" aria-modal="true" aria-label="Biên bản nghiệm thu">
      <style>{`@media print { body > :not(.split-weld-print) {display:none!important} .split-weld-print {position:static!important;overflow:visible!important;padding:0!important;background:white!important} .split-weld-print article {max-width:none!important;padding:0!important} .split-weld-print tr {break-inside:avoid} @page {size:A4;margin:16mm} }`}</style>
      <div className="mx-auto mb-3 flex max-w-4xl justify-end gap-2 print:hidden"><button className={button} onClick={() => setDoc(null)}>Đóng</button><button className={primary} onClick={() => window.print()}>In / lưu PDF</button></div>
      <article className="mx-auto max-w-4xl space-y-4 bg-white p-6 font-serif text-black sm:p-10">
        <h2 className="text-center text-lg font-bold uppercase">{doc === "record" ? "Biên bản nghiệm thu" : "Phiếu yêu cầu nghiệm thu"} {kindName(kind)}</h2>
        <p>Dự án: <b>{projectName}</b><br />Phiếu {prefix}: {detail.ticket.so_phieu} · Ngày mời: {dateLabel(detail.ticket.ngay_moi)}<br />
          {doc === "record" ? "Ngày nghiệm thu: " + dateLabel(detail.ticket.ngay_nghiem_thu) + " · Người ghi nhận: " + detail.ticket.nguoi_nghiem_thu : "Người lập: " + detail.ticket.nguoi_lap}</p>
        <table className="w-full border-collapse text-sm"><thead><tr>{["STT", "Mã mối hàn", ...(doc === "record" ? ["Dữ liệu kiểm tra", "Kết quả / lý do"] : [])].map(h => <th key={h} className="border border-black p-2">{h}</th>)}</tr></thead>
          <tbody>{detail.items.map((i,n) => <tr key={i.moi_han_id}><td className="border border-black p-2">{n+1}</td><td className="border border-black p-2">{i.ma_lich_su}</td>
            {doc === "record" && <><td className="border border-black p-2">{evidenceText(kind,i.du_lieu_chot)}</td><td className="border border-black p-2">{i.ket_qua} {i.ly_do}</td></>}</tr>)}</tbody></table>
        <div className="grid min-h-24 break-inside-avoid grid-cols-2 text-center font-bold"><p>Đại diện nhà thầu</p><p>Tư vấn giám sát</p></div>
      </article>
    </div>, document.body)}
  </section>;
}
