"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadGeometryRecord, loadRfiNumber, markQualityPass, saveTicketPayments, signSplitRecord, type RecordSet, notifyWeldQualityChanged, qualityRequest } from "@/lib/weldQualityClient";
import RowActionsMenu from "@/components/RowActionsMenu";
import { fieldWeldCode } from "@/lib/weldCode";
import { filterRfiCandidates, type RfiCandidateFilter } from "@/lib/weldAcceptance";
import { GEOMETRY_CRITERIA, GEOMETRY_LABELS, type GeometryMeasurements } from "@/lib/weldQuality";
import WeldAcceptanceDocument from "@/components/WeldAcceptanceDocument";

export type SplitKind = "hinh-hoc" | "sieu-am";
type Candidate = { moi_han_id: string; ma_lich_su: string; ngay_mai: string | null; da_nt_truc_quan: boolean; truc_quan?: string | null; ly_trinh?: string | null };
type TicketInfo = { dia_diem: string; ben_moi: string; ben_nhan: string; pham_vi: string; tuyen_thuong: boolean; tuyen_ha: boolean; gio_bat_dau: string };
type Ticket = { id: string; so_phieu: string; ngay_moi: string; ngay_nghiem_thu: string | null; nguoi_lap: string; nguoi_nghiem_thu: string | null;
  thong_tin?: Record<string, string> | null; da_ky?: boolean | null; nguoi_ky?: string | null; payment_rates?: number[]; payment_notes?: string[] };
// Giờ nghiệm thu gợi ý sẵn 8h00 như RFI chính.
const emptyInfo = (): TicketInfo => ({ dia_diem: "", ben_moi: "", ben_nhan: "", pham_vi: "", tuyen_thuong: false, tuyen_ha: false, gio_bat_dau: "08:00" });
const infoFromTicket = (t: Ticket): TicketInfo => {
  const v = t.thong_tin ?? {};
  return { dia_diem: v.dia_diem ?? "", ben_moi: v.ben_moi ?? "", ben_nhan: v.ben_nhan ?? "", pham_vi: v.pham_vi ?? "",
    tuyen_thuong: v.tuyen_thuong === "1", tuyen_ha: v.tuyen_ha === "1", gio_bat_dau: v.gio_bat_dau || "08:00" };
};
type Evidence = { co_the_dat: boolean; ngay_mai: string; truc_quan: string; gia_tri_do: GeometryMeasurements; ngay_ndt: string | null; ket_qua_ndt: string | null; phuong_phap_ndt: string; ten_tieu_chuan: string | null };
type Item = { moi_han_id: string; ma_lich_su: string; ma_diem?: string | null; ly_trinh?: string | null; current?: Evidence | null; version?: number; du_lieu_chot: Evidence; ket_qua: string | null; ly_do: string | null };
type Detail = { ticket: Ticket; items: Item[] };
type List = { candidates: Candidate[]; tickets: Ticket[] };
type Decision = { ket_qua: string; ly_do: string };
const field = "min-h-11 rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-[#0047AB] focus:outline-none";
const button = "min-h-10 rounded-lg border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 hover:border-[#0047AB]/60 hover:bg-blue-50 disabled:opacity-50";
const primary = "min-h-10 rounded-lg bg-[#0047ab] px-4 text-sm font-bold text-white shadow-md shadow-blue-900/25 hover:bg-[#003a8c] disabled:opacity-50 disabled:shadow-none";
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

/** Tóm tắt một dòng cho bảng nghiệm thu (đầy đủ xem ở tooltip). */
function evidenceShort(kind: SplitKind, e?: Evidence | null) {
  if (!e) return "Kiểm tra lại dữ liệu chất lượng.";
  if (kind === "sieu-am") return `Siêu âm: ${e.ket_qua_ndt ?? "chưa có"}${e.ngay_ndt ? " · " + dateLabel(e.ngay_ndt) : ""}`;
  const filled = GEOMETRY_CRITERIA.filter(k => e.gia_tri_do[k] != null).length;
  return `Trực quan: ${e.truc_quan ?? "chưa"} · số đo ${filled}/${GEOMETRY_CRITERIA.length}`;
}

/**
 * Luồng 2 tab: "tao" (hình học) phát phiếu & duyệt → chốt tự chuyển mối Đạt sang siêu âm cùng số phiếu;
 * "duyet" (siêu âm) duyệt tiếp phiếu được chuyển tới rồi ký biên bản → mối «Đạt».
 */
export type SplitStage = "tao" | "duyet";

export default function SplitWeldAcceptance({ project, projectName, kind, stage = "tao", onPrintRecord, onGoToUltrasound, initialTicketId, onInitialTicketOpened }: {
  project: string; projectName: string; kind: SplitKind; stage?: SplitStage; onPrintRecord?: (record: RecordSet) => void;
  /** Tab 1: sau khi chốt, người dùng chọn «Có» duyệt siêu âm ngay → chuyển sang tab 2 mở phiếu này. */
  onGoToUltrasound?: (sieuAmTicketId: string) => void;
  /** Tab 2: mở sẵn phiếu này khi vào tab (từ modal «Duyệt siêu âm ngay»). */
  initialTicketId?: string | null;
  onInitialTicketOpened?: () => void;
}) {
  const prefix = "RFI";
  const request = useCallback(<T,>(action: string, data: Record<string, unknown> = {}) =>
    qualityRequest<T>({ action, du_an_id: project, loai: kind, ...data }), [project, kind]);
  const [list, setList] = useState<List | null>(null);
  const [filters, setFilters] = useState<RfiCandidateFilter>({});
  const setFilter = (key: keyof RfiCandidateFilter) => (e: React.ChangeEvent<HTMLInputElement>) => setFilters((cur) => ({ ...cur, [key]: e.target.value }));
  const [selected, setSelected] = useState<string[]>([]);
  const [number, setNumber] = useState("");
  const [inviteDate, setInviteDate] = useState(today);
  const [date, setDate] = useState(today);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [results, setResults] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doc, setDoc] = useState<"invite" | null>(null);
  // Tick chọn mối trong phiếu để đặt kết quả hàng loạt.
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkReason, setBulkReason] = useState("");
  const [ticketQuery, setTicketQuery] = useState("");
  const [ticketStatus, setTicketStatus] = useState<"" | "cho" | "xong">("");
  // 3 mục con như RFI chính: Phát phiếu YCNT · Nghiệm thu · Hồ sơ nghiệm thu.
  const [sub, setSub] = useState<"rfi" | "accept" | "records">(stage === "tao" ? "rfi" : "accept");
  // Mục «Phát phiếu» chia 3 bước dạng tab: Chọn mối · Thông tin phiếu · Phiếu đã phát.
  const [step, setStep] = useState<"chon" | "thong-tin" | "da-phat">("chon");
  const [info, setInfo] = useState<TicketInfo>(emptyInfo);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState("");
  const [payment, setPayment] = useState<{ ticket: Ticket; rate: string; note: string } | null>(null);
  const paymentDialog = useRef<HTMLDialogElement>(null);
  const paymentOpen = Boolean(payment);
  useEffect(() => {
    if (paymentOpen) paymentDialog.current?.showModal();
    else paymentDialog.current?.close();
  }, [paymentOpen]);
  const formRef = useRef<HTMLFormElement>(null);
  /** Modal sau khi chốt tab 1: có duyệt siêu âm luôn không. */
  const [askForward, setAskForward] = useState<{ soPhieu: string; count: number; sieuAmId: string; geometryId: string } | null>(null);

  useEffect(() => {
    let active = true;
    request<List>("split-list").then(data => { if (active) setList(data); })
      .catch(e => { if (active) setError(errorText(e)); });
    // Gợi ý sẵn số phiếu tiếp theo để không phải gõ tay (vẫn sửa được).
    loadRfiNumber(project, kind).then(r => { if (active) setNumber(cur => cur || r.so_phieu); }).catch(() => undefined);
    return () => { active = false; };
  }, [request, project, kind]);

  // Vào tab 2 từ modal «Có»: mở ngay phiếu siêu âm vừa được chuyển tới.
  useEffect(() => {
    if (!initialTicketId) return;
    let active = true;
    setBusy(true);
    request<Detail>("split-detail", { id: initialTicketId })
      .then(next => {
        if (!active) return;
        setDetail(next); setPicked([]);
        setResults(next.ticket.ngay_nghiem_thu ? {} : Object.fromEntries(next.items.filter(i => !i.ket_qua && i.current?.co_the_dat).map(i => [i.moi_han_id, { ket_qua: "Đạt", ly_do: "" }])));
        setDate(next.ticket.ngay_nghiem_thu || [today(), next.ticket.ngay_moi].sort()[1]);
      })
      .catch(e => { if (active) setError(errorText(e)); })
      .finally(() => { if (active) { setBusy(false); onInitialTicketOpened?.(); } });
    return () => { active = false; };
  }, [initialTicketId, request, onInitialTicketOpened]);

  async function run(task: () => Promise<void>) {
    setBusy(true); setError(""); setOkMsg("");
    try { await task(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function refresh() {
    const next = await request<List>("split-list");
    setList(next);
    setSelected(prev => prev.filter(id => next.candidates.some(c => c.moi_han_id === id)));
  }
  async function openTicket(id: string) {
    const next = await request<Detail>("split-detail", { id });
    setDetail(next); setPicked([]);
    // Tự chọn sẵn «Đạt» cho mối đã đủ điều kiện (như RFI chính); mối còn thiếu thì tick rồi «Đạt hàng loạt».
    setResults(next.ticket.ngay_nghiem_thu ? {} : Object.fromEntries(next.items.filter(i => !i.ket_qua && i.current?.co_the_dat).map(i => [i.moi_han_id, { ket_qua: "Đạt", ly_do: "" }])));
    setDate(next.ticket.ngay_nghiem_thu || [today(), next.ticket.ngay_moi].sort()[1]);
  }
  /** Trực quan Đạt hàng loạt cho các mối chưa đủ điều kiện của phiếu hình học (ô sai số trống tự điền mức tối đa). */
  async function passVisual() {
    if (!detail) return;
    const targets = detail.items.filter((i) => !i.ket_qua && !i.current?.co_the_dat);
    if (!targets.length) { setError("Các mối đã đủ điều kiện chọn Đạt."); return; }
    if (!window.confirm(`Ghi trực quan ĐẠT cho ${targets.length} mối (ngày ${date})?\nÔ sai số còn trống tự điền mức tối đa theo tiêu chí. Chiều dài mài nhập theo thực tế.`)) return;
    const response = await markQualityPass(targets.map((i) => ({ id: i.moi_han_id, ma_lich_su: i.ma_lich_su, phien_ban: i.version ?? 0 })), "visual", date, "Siêu âm");
    const failed = response.results.filter((r) => r.error);
    const next = await request<Detail>("split-detail", { id: detail.ticket.id });
    setDetail(next);
    // Mối vừa đủ điều kiện → đặt sẵn Đạt.
    setResults((prev) => { const out = { ...prev }; for (const i of next.items) if (!i.ket_qua && i.current?.co_the_dat && !out[i.moi_han_id]?.ket_qua) out[i.moi_han_id] = { ket_qua: "Đạt", ly_do: "" }; return out; });
    if (failed.length) setError(`${failed.length} mối chưa ghi được: ${failed.slice(0, 3).map((f) => `${targets.find((t) => t.moi_han_id === f.id)?.ma_lich_su ?? f.id}: ${f.error}`).join("; ")}`);
  }
  /** Đặt kết quả cho các mối đã tick ("" = xoá kết quả). Không đạt cần lý do. */
  function bulkSet(value: "Đạt" | "Không đạt" | "") {
    if (!detail) return;
    if (value === "Không đạt" && !bulkReason.trim()) { setError("Nhập lý do không đạt (ô bên cạnh) trước khi bấm Không đạt hàng loạt."); return; }
    setError("");
    const eligible = new Set(detail.items.filter(i => !i.ket_qua).map(i => i.moi_han_id));
    setResults(prev => {
      const next = { ...prev };
      for (const id of picked) {
        if (!eligible.has(id)) continue;
        if (value === "") delete next[id]; else next[id] = { ket_qua: value, ly_do: value === "Không đạt" ? bulkReason.trim() : "" };
      }
      return next;
    });
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
  const shownStep = editingId && step === "chon" ? "thong-tin" : step;
  const pendingItems = detail?.items.filter(i => !i.ket_qua) ?? [];
  const counts = {
    pass: pendingItems.filter(i => results[i.moi_han_id]?.ket_qua === "Đạt").length,
    fail: pendingItems.filter(i => results[i.moi_han_id]?.ket_qua === "Không đạt").length,
    none: pendingItems.filter(i => !results[i.moi_han_id]?.ket_qua).length,
  };
  const sortTickets = (rows: Ticket[]) => [...rows].sort((a, b) => b.ngay_moi.localeCompare(a.ngay_moi) || b.so_phieu.localeCompare(a.so_phieu, "vi", { numeric: true }));
  const pendingTickets = sortTickets((list?.tickets ?? []).filter((t) => !t.ngay_nghiem_thu));
  const doneTickets = sortTickets((list?.tickets ?? []).filter((t) => t.ngay_nghiem_thu));

  function beginEdit(t: Ticket) {
    setOkMsg(""); setError("");
    setEditingId(t.id); setNumber(t.so_phieu); setInviteDate(t.ngay_moi); setInfo(infoFromTicket(t)); setSub("rfi"); setStep("thong-tin");
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function cancelEdit() {
    setEditingId(null); setInfo(emptyInfo()); setNumber("");
    void loadRfiNumber(project, kind).then(r => setNumber(r.so_phieu)).catch(() => undefined);
  }
  async function removeTicket(t: Ticket) {
    const message = t.ngay_nghiem_thu
      ? `Xoá phiếu ${t.so_phieu} ĐÃ NGHIỆM THU?\n\nKết quả nghiệm thu của phiếu bị xoá; các mối trở về trạng thái trước nghiệm thu (dữ liệu kiểm tra giữ nguyên). Không thể hoàn tác.`
      : `Xoá phiếu ${t.so_phieu}?\n\nCác mối trong phiếu quay lại danh sách chờ phát phiếu. Không thể hoàn tác.`;
    if (!window.confirm(message)) return;
    await request("split-delete", { id: t.id });
    if (editingId === t.id) cancelEdit();
    setOkMsg(`Đã xoá phiếu ${t.so_phieu}.`);
    await refresh();
  }
  async function toggleSign(t: Ticket) {
    await signSplitRecord(t.id, !t.da_ky);
    setOkMsg(t.da_ky ? `Đã đặt lại phiếu ${t.so_phieu} về Chờ ký.` : `Đã đánh dấu phiếu ${t.so_phieu} đã ký.`);
    await refresh();
  }
  const printRecord = (t: Ticket) => run(async () => { if (onPrintRecord) onPrintRecord(await loadGeometryRecord(t.id)); });

  function renderTicketTable(rows: Ticket[], mode: "rfi" | "accept" | "records") {
    if (!rows.length) return null;
    return <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[680px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr><th className="px-3 py-2">STT</th><th className="px-3 py-2">Số phiếu</th>{kind === "hinh-hoc" && <th className="px-3 py-2">Ngày mời</th>}<th className="px-3 py-2">Ngày nghiệm thu</th><th className="px-3 py-2">Người lập</th><th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2">Thanh toán</th><th className="px-3 py-2">Ghi chú</th><th className="px-3 py-2 text-right">Thao tác</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((t, i) => {
            const done = Boolean(t.ngay_nghiem_thu);
            const primaryAction = mode === "records"
              ? { label: "In biên bản", onClick: () => printRecord(t) }
              : { label: done ? "Xem" : "Nghiệm thu", onClick: () => run(() => openTicket(t.id)) };
            return <tr key={t.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-mono text-slate-500">{i + 1}</td>
              <td className="px-3 py-2 font-bold">{t.so_phieu}</td>
              {kind === "hinh-hoc" && <td className="whitespace-nowrap px-3 py-2 font-mono">{dateLabel(t.ngay_moi)}{t.thong_tin?.gio_bat_dau ? ` ${t.thong_tin.gio_bat_dau}` : ""}</td>}
              <td className="whitespace-nowrap px-3 py-2 font-mono">{dateLabel(t.ngay_nghiem_thu)}</td>
              <td className="px-3 py-2">{t.nguoi_lap || "—"}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${!done ? "bg-amber-50 text-amber-800" : t.da_ky ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-800"}`}>{!done ? "Chờ nghiệm thu" : t.da_ky ? "Đã ký" : "Đã nghiệm thu · Chờ ký"}</span>
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {t.payment_rates?.some(rate => rate > 0)
                  ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{t.payment_rates.filter(rate => rate > 0).map(rate => `${rate}%`).join(" / ")}</span>
                  : <span className="text-xs text-slate-400">{done ? "Chưa thanh toán" : "—"}</span>}
              </td>
              <td className="max-w-[16rem] px-3 py-2 text-xs text-slate-700" title={t.payment_notes?.join(" · ")}>{t.payment_notes?.length ? <span className="line-clamp-2">{t.payment_notes.join(" · ")}</span> : "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                <span className="inline-flex items-center gap-1">
                  <button type="button" disabled={busy} className={button} onClick={primaryAction.onClick}>{primaryAction.label}</button>
                  <RowActionsMenu label={`Thao tác phiếu ${t.so_phieu}`} actions={[
                    { label: done ? "Xem chi tiết" : "Mở / nghiệm thu", disabled: busy, onSelect: () => void run(() => openTicket(t.id)) },
                    { label: "In phiếu YCNT", disabled: busy, onSelect: () => void run(async () => { await openTicket(t.id); setDoc("invite"); }) },
                    ...(onPrintRecord ? [{ label: done ? "In biên bản" : "In mẫu biên bản (trống)", disabled: busy, onSelect: () => void printRecord(t) }] : []),
                    // Số phiếu siêu âm đi theo phiếu hình học → chỉ sửa ở tab tạo phiếu.
                    ...(stage === "tao" ? [{ label: "Sửa phiếu", disabled: busy, onSelect: () => beginEdit(t) }] : []),
                    ...(done ? [{ label: t.da_ky ? "Đặt lại: Chờ ký" : "Đánh dấu: Đã ký", disabled: busy, onSelect: () => void run(() => toggleSign(t)) }] : []),
                    // Thanh toán tính theo các mối Đạt của phiếu → phiếu chưa nghiệm thu thì chưa dùng được (hiện mờ để biết có chức năng).
                    { label: done ? "Thanh toán" : "Thanh toán (sau khi nghiệm thu)", disabled: busy || !done, onSelect: () => {
                      setError(""); setOkMsg("");
                      setPayment({ ticket: t, rate: t.payment_rates?.length === 1 && t.payment_rates[0] ? String(t.payment_rates[0]) : "", note: "" });
                    } },
                    { label: "Xoá phiếu", danger: true, disabled: busy || Boolean(t.da_ky), onSelect: () => void run(() => removeTicket(t)) },
                  ]} />
                </span>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>;
  }

  // Ngày mài mới nhất lên đầu; cùng ngày thì mã lớn hơn trước; mối không có ngày xuống cuối.
  // Lọc như RFI chính: tìm mã, khoảng ngày mài, khoảng tên mối, khoảng Km (dùng chung hàm lọc của RFI chính).
  const filtered = (() => {
    const all = list?.candidates ?? [];
    try {
      const rows = filterRfiCandidates(all.map(c => ({ id: c.moi_han_id, ma_lich_su: c.ma_lich_su, ngay_thuc_hien: c.ngay_mai, ly_trinh: c.ly_trinh ?? null, phien_ban: 0, tinh_trang: "" })), filters).rows;
      const keep = new Set(rows.map(r => r.id));
      return { rows: all.filter(c => keep.has(c.moi_han_id)), error: "" };
    } catch (e) { return { rows: all, error: errorText(e) }; }
  })();
  const candidates = [...filtered.rows]
    .sort((x, y) => (y.ngay_mai ?? "").localeCompare(x.ngay_mai ?? "") || y.ma_lich_su.localeCompare(x.ma_lich_su, "vi", { numeric: true }));

  return <section className="space-y-4">
    {error && !payment && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {okMsg && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{okMsg}</p>}
    <dialog ref={paymentDialog} aria-labelledby="split-payment-title"
      onCancel={e => { e.preventDefault(); if (!busy) { setPayment(null); setError(""); } }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/40">
      {payment && <form className="space-y-3" onSubmit={e => {
        e.preventDefault();
        void run(async () => {
          const saved = await saveTicketPayments(project, payment.ticket.id, today(), Number(payment.rate), payment.note);
          setPayment(null);
          setOkMsg(`Đã lưu thanh toán ${payment.rate}% cho ${saved.count} mối Đạt của phiếu ${payment.ticket.so_phieu}.`);
          await refresh();
        });
      }}>
        <h3 id="split-payment-title" className="text-lg font-bold">Thanh toán phiếu {payment.ticket.so_phieu}</h3>
        <p className="text-sm text-slate-600">Tỷ lệ và ghi chú sẽ thay thế thông tin thanh toán đã lưu của các mối Đạt trong phiếu.</p>
        <label className="grid gap-1 text-sm">Phần trăm
          <select className={field} required disabled={busy} value={payment.rate} onChange={e => setPayment({ ...payment, rate: e.target.value })}>
            <option value="">Chọn tỷ lệ</option>
            {[30, 50, 70, 100].map(rate => <option key={rate} value={rate}>{rate}%</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Ghi chú
          <textarea className={field} rows={3} maxLength={500} disabled={busy} value={payment.note} onChange={e => setPayment({ ...payment, note: e.target.value })} />
        </label>
        {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={button} disabled={busy} onClick={() => { setPayment(null); setError(""); }}>Hủy</button>
          <button type="submit" className={primary} disabled={busy || !payment.rate}>Lưu thanh toán</button>
        </div>
      </form>}
    </dialog>
    {!detail && <div role="tablist" aria-label="Mục phiếu tách" className={`grid gap-2 ${stage === "tao" ? "grid-cols-3" : "grid-cols-2"}`}>
      {(stage === "tao"
        ? [["rfi", "Phát phiếu YCNT"], ["accept", `Nghiệm thu (${pendingTickets.length})`], ["records", `Hồ sơ nghiệm thu (${doneTickets.length})`]] as const
        : [["accept", `Chờ duyệt ${kindName(kind)} (${pendingTickets.length})`], ["records", `Hồ sơ nghiệm thu (${doneTickets.length})`]] as const
      ).map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={sub === id} onClick={() => setSub(id)}
          className={`min-h-12 w-full rounded-xl border-2 px-2 py-2.5 text-center text-xs font-extrabold leading-tight transition-all sm:text-base ${sub === id ? "border-[#0047AB] bg-[#0047AB] text-white shadow-lg shadow-blue-900/25" : "border-slate-300 bg-white text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-[#0047AB]/60 hover:bg-blue-50"}`}>{label}</button>
      ))}
    </div>}

    {!detail && sub === "rfi" && <>
      <div role="tablist" aria-label="Các bước phát phiếu" className="flex flex-wrap gap-2">
        {([
          ...(editingId ? [] : [["chon", `1. Chọn mối (${selected.length})`] as const]),
          ["thong-tin", editingId ? "Thông tin phiếu (đang sửa)" : "2. Thông tin phiếu"] as const,
          ["da-phat", `${editingId ? "" : "3. "}Phiếu đã phát (${list?.tickets.length ?? 0})`] as const,
        ]).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={shownStep === id} onClick={() => setStep(id)}
            className={`cursor-pointer whitespace-nowrap rounded-lg border-2 px-4 py-2.5 text-sm font-extrabold transition-all ${shownStep === id ? "border-[#0047AB] bg-blue-100 text-[#0047AB] shadow-md shadow-blue-900/15" : "border-slate-300 bg-white text-slate-600 hover:border-[#0047AB]/50 hover:bg-blue-50 hover:text-slate-900"}`}>{label}</button>
        ))}
      </div>
      <form ref={formRef} className={`space-y-3 rounded-xl border-2 border-slate-300 bg-white p-4 shadow-sm ${shownStep === "da-phat" ? "hidden" : ""}`} onSubmit={e => {
        e.preventDefault();
        void run(async () => {
          if (editingId) {
            await request("split-update", { id: editingId, so_phieu: number, ngay_moi: inviteDate, thong_tin: info });
            setOkMsg(`Đã cập nhật phiếu ${number}.`);
            setEditingId(null); setInfo(emptyInfo()); setNumber(""); setStep("da-phat");
            await refresh();
            void loadRfiNumber(project, kind).then(r => setNumber(r.so_phieu)).catch(() => undefined);
            return;
          }
          const { id } = await request<{ id: string }>("split-publish", { id: crypto.randomUUID(), so_phieu: number, ngay_moi: inviteDate, moi_han_ids: selected, thong_tin: info });
          setSelected([]); setNumber(""); setStep("da-phat"); await openTicket(id); await refresh();
          void loadRfiNumber(project, kind).then(r => setNumber(r.so_phieu)).catch(() => undefined);
        });
      }}>
        <h3 className="text-lg font-extrabold text-slate-900">{editingId ? `Sửa phiếu ${number}` : `Phát ${prefix} nghiệm thu ${kindName(kind)}`}</h3>
        <p className="text-sm text-slate-600">{editingId ? "Đổi số phiếu / ngày mời / thông tin in. Danh sách mối giữ nguyên." : kind === "hinh-hoc" ? "Chỉ hiện mối «Mài xong» (chưa kết luận trực quan). Khi nghiệm thu bấm «Trực quan đạt» (tự điền sai số max) rồi chọn Đạt → in biên bản hình học; mối Đạt tự chuyển sang tab siêu âm cùng số phiếu." : "Chỉ hiện mối «Chờ siêu âm» (đã nghiệm thu hình học ĐẠT)."}</p>
        {!editingId && <div className={shownStep === "chon" ? "space-y-3" : "hidden"}>
          <div className="flex flex-wrap items-end gap-2">
            <input aria-label="Tìm mã mối hàn" placeholder="Tìm mã mối" className={field} value={filters.query ?? ""} onChange={setFilter("query")} />
            <label className="grid gap-0.5 text-xs font-semibold text-slate-600">Từ ngày<input type="date" className={field} value={filters.dateFrom ?? ""} onChange={setFilter("dateFrom")} /></label>
            <label className="grid gap-0.5 text-xs font-semibold text-slate-600">Đến ngày<input type="date" className={field} value={filters.dateTo ?? ""} onChange={setFilter("dateTo")} /></label>
            <input aria-label="Từ mối" placeholder="Từ mối" className={field + " w-36"} value={filters.nameFrom ?? ""} onChange={setFilter("nameFrom")} />
            <input aria-label="Đến mối" placeholder="Đến mối" className={field + " w-36"} value={filters.nameTo ?? ""} onChange={setFilter("nameTo")} />
            <input aria-label="Từ Km" placeholder="Từ Km0+000" className={field + " w-28"} value={filters.kmFrom ?? ""} onChange={setFilter("kmFrom")} />
            <input aria-label="Đến Km" placeholder="Đến Km2+000" className={field + " w-28"} value={filters.kmTo ?? ""} onChange={setFilter("kmTo")} />
            <button type="button" className={button} disabled={!Object.values(filters).some(Boolean)} onClick={() => setFilters({})}>Xoá lọc</button>
          </div>
          {filtered.error && <p role="alert" className="text-xs text-amber-800">{filtered.error}</p>}
          <p className="text-xs text-slate-600">{candidates.length}/{list?.candidates.length ?? 0} mối khớp bộ lọc (ngày lọc theo ngày mài).</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {/* Chọn tất cả = các mối đang hiện (theo ô tìm), tối đa 200 mối một phiếu. */}
            <button type="button" className={button} disabled={busy || !candidates.length}
              onClick={() => setSelected(prev => [...new Set([...prev, ...candidates.map(c => c.moi_han_id)])].slice(0, 200))}>
              Chọn tất cả ({Math.min(candidates.length, 200)})
            </button>
            <button type="button" className={button} disabled={busy || !selected.length} onClick={() => setSelected([])}>Bỏ chọn</button>
            <span className="text-slate-600">Đã chọn {selected.length}{candidates.length > 200 ? " · tối đa 200 mối một phiếu" : ""}</span>
          </div>
          <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {candidates.map(c => <label key={c.moi_han_id} className="flex min-h-10 items-center gap-3 px-3 text-sm">
              <input type="checkbox" checked={selected.includes(c.moi_han_id)} disabled={busy || (selected.length >= 200 && !selected.includes(c.moi_han_id))}
                onChange={e => setSelected(e.target.checked ? [...selected, c.moi_han_id] : selected.filter(id => id !== c.moi_han_id))} />
              <b title={c.ma_lich_su}>{fieldWeldCode(c.ma_lich_su)}</b><span className="text-slate-600">{kind === "hinh-hoc" ? "Mài xong" : "Chờ siêu âm"} · {dateLabel(c.ngay_mai)}</span>
            </label>)}
            {!candidates.length && <p className="p-3 text-sm text-slate-600">{list ? "Không tìm thấy mối đủ điều kiện." : error ? "Chưa tải được danh sách." : "Đang tải danh sách…"}</p>}
          </div>
        </div>}
        <div className={`space-y-2 rounded-lg border-2 border-slate-300 p-3 ${shownStep === "thong-tin" ? "" : "hidden"}`}>
          <h4 className="-mx-3 -mt-3 mb-1 rounded-t-md bg-slate-200 px-3 py-2 text-sm font-extrabold uppercase tracking-wide text-slate-800">Thông tin phiếu & phát hành</h4>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-slate-800">Số phiếu {prefix}<input maxLength={80} placeholder={kind === "hinh-hoc" ? "RFI-HH-001" : "RFI-SA-001"} className={field} value={number} onChange={e => setNumber(e.target.value)} /></label>
            <label className="grid gap-1 text-sm font-semibold text-slate-800">Ngày mời<input type="date" className={field} value={inviteDate} onChange={e => setInviteDate(e.target.value)} /></label>
            <label className="grid gap-1 text-sm font-semibold text-slate-800">Giờ bắt đầu<input type="time" className={field} value={info.gio_bat_dau} onChange={e => setInfo({ ...info, gio_bat_dau: e.target.value })} /></label>
            <input aria-label="Địa điểm" placeholder="Địa điểm" className={field} value={info.dia_diem} onChange={e => setInfo({ ...info, dia_diem: e.target.value })} />
            <input aria-label="Bên mời (nhà thầu)" placeholder="Bên mời (nhà thầu)" className={field} value={info.ben_moi} onChange={e => setInfo({ ...info, ben_moi: e.target.value })} />
            <input aria-label="Bên nhận (TVGS/CĐT)" placeholder="Bên nhận (TVGS/CĐT)" className={field} value={info.ben_nhan} onChange={e => setInfo({ ...info, ben_nhan: e.target.value })} />
            <input aria-label="Phạm vi" placeholder="Phạm vi" className={field + " sm:col-span-2"} value={info.pham_vi} onChange={e => setInfo({ ...info, pham_vi: e.target.value })} />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold">Tuyến</span>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={info.tuyen_thuong} onChange={e => setInfo({ ...info, tuyen_thuong: e.target.checked })} />Tuyến thượng</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={info.tuyen_ha} onChange={e => setInfo({ ...info, tuyen_ha: e.target.checked })} />Tuyến hạ</label>
            </div>
          </div>
          <p className="text-xs text-slate-500">Bỏ trống tuyến thì phiếu tự xác định theo mã điểm của mối.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy || !number.trim() || !inviteDate || (!editingId && !selected.length)} className={primary}>{editingId ? "Lưu sửa phiếu" : `Phát ${prefix} (${selected.length} mối)`}</button>
          {shownStep === "chon" && <button type="button" className={button} onClick={() => setStep("thong-tin")}>Tiếp: Thông tin phiếu →</button>}
          {shownStep === "thong-tin" && !editingId && <button type="button" className={button} onClick={() => setStep("chon")}>← Chọn mối</button>}
          {editingId && <button type="button" className={button} disabled={busy} onClick={cancelEdit}>Huỷ sửa</button>}
        </div>
        {!number.trim() && selected.length > 0 && <p role="status" className="text-sm text-amber-800">Nhập số phiếu {prefix} thì mới phát được.</p>}
      </form>
      <div className={`space-y-3 rounded-xl border-2 border-slate-300 bg-white p-4 shadow-sm ${shownStep === "da-phat" ? "" : "hidden"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-extrabold text-slate-900">Phiếu đã phát <span className="font-mono text-xs font-semibold text-slate-500">{tickets.length}/{list?.tickets.length ?? 0}</span></h3>
          <button className={button} disabled={busy} onClick={() => run(refresh)}>Tải lại</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Tìm phiếu" placeholder="Tìm số phiếu, ngày, người lập / nghiệm thu…" className={field + " min-w-0 flex-1"} value={ticketQuery} onChange={e => setTicketQuery(e.target.value)} />
          <select aria-label="Lọc trạng thái phiếu" className={field} value={ticketStatus} onChange={e => setTicketStatus(e.target.value as typeof ticketStatus)}>
            <option value="">Tất cả trạng thái</option><option value="cho">Chờ nghiệm thu</option><option value="xong">Đã nghiệm thu</option>
          </select>
        </div>
        {renderTicketTable(tickets, "rfi")}
        {list?.tickets.length === 0 && <p className="text-sm text-slate-500">Chưa có phiếu {prefix} trong nhánh này.</p>}
      </div>
    </>}

    {!detail && sub === "accept" && <div className="space-y-3 rounded-xl border-2 border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-extrabold text-slate-900">Phiếu chờ nghiệm thu {kindName(kind)}</h3>
        <button className={button} disabled={busy} onClick={() => run(refresh)}>Tải lại</button>
      </div>
      <p className="text-sm text-slate-600">{kind === "hinh-hoc" ? "Ghi kết quả từng mối rồi chốt nghiệm thu để lập biên bản và chuyển các mối Đạt sang siêu âm." : "Mở phiếu siêu âm, ghi kết quả từng mối rồi chốt. Ký biên bản trong mục Hồ sơ nghiệm thu."}</p>
      {renderTicketTable(pendingTickets, "accept")}
      {!pendingTickets.length && <p className="text-sm text-slate-500">Không có phiếu chờ duyệt. Sang tab <b>Phát phiếu RFI</b> để phát phiếu.</p>}
    </div>}

    {!detail && sub === "records" && <div className="space-y-3 rounded-xl border-2 border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-extrabold text-slate-900">Hồ sơ nghiệm thu {kindName(kind)}</h3>
        <button className={button} disabled={busy} onClick={() => run(refresh)}>Tải lại</button>
      </div>
      <p className="text-sm text-slate-600">{kind === "sieu-am" ? "In biên bản, ký xong bấm «Đánh dấu: Đã ký» → mối (đã đạt hình học) chuyển «Đạt»." : "In biên bản hình học; đánh dấu đã ký để theo dõi hồ sơ."}</p>
      {renderTicketTable(doneTickets, "records")}
      {!doneTickets.length && <p className="text-sm text-slate-500">Chưa có phiếu đã nghiệm thu.</p>}
    </div>}
    {detail && <div className="space-y-3 rounded-xl border-2 border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} disabled={busy} onClick={() => { setDetail(null); void run(refresh); }}>← Danh sách</button>
        <button className={button} onClick={() => setDoc("invite")}>Xem phiếu {prefix}</button>
        {kind === "hinh-hoc" && detail.ticket.ngay_nghiem_thu && onGoToUltrasound && detail.items.some(i => i.ket_qua === "Đạt") &&
          <button type="button" className={button} disabled={busy} onClick={() => run(async () => {
            const next = await request<{ sieu_am_id?: string; canh_bao?: string }>("split-forward-ultrasound", { id: detail.ticket.id });
            if (next.canh_bao) { setError(next.canh_bao); return; }
            if (next.sieu_am_id) onGoToUltrasound(next.sieu_am_id);
          })}>Mở hoặc tạo phiếu siêu âm</button>}
        {!detail.ticket.ngay_nghiem_thu && <button className={button} disabled={busy} onClick={() => run(() => openTicket(detail.ticket.id))}>Tải lại số đo</button>}
        {onPrintRecord && <button className={primary} disabled={busy} onClick={() => run(async () => onPrintRecord(await loadGeometryRecord(detail.ticket.id)))}>In biên bản {kindName(kind)}</button>}
      </div>
      <h3 className="text-lg font-extrabold text-slate-900">{detail.ticket.so_phieu} · Nghiệm thu {kindName(kind)}</h3>
      <form className="space-y-3" onSubmit={e => {
        e.preventDefault();
        void run(async () => {
          let items = detail.items;
          // Mối chọn Đạt nhưng chưa có kết quả kiểm tra → tự ghi (hình học: trực quan Đạt + điền sai số max; siêu âm: siêu âm Đạt) theo ngày nghiệm thu rồi mới chốt.
          const need = items.filter(i => !i.ket_qua && results[i.moi_han_id]?.ket_qua === "Đạt" && !i.current?.co_the_dat);
          if (need.length) {
            const response = await markQualityPass(need.map(i => ({ id: i.moi_han_id, ma_lich_su: i.ma_lich_su, phien_ban: i.version ?? 0 })), kind === "hinh-hoc" ? "visual" : "ndt", date, "Siêu âm");
            const failed = response.results.find(r => r.error);
            if (failed) throw new Error(`${fieldWeldCode(need.find(i => i.moi_han_id === failed.id)?.ma_lich_su ?? "")}: ${failed.error}`);
            const next = await request<Detail>("split-detail", { id: detail.ticket.id });
            setDetail(next);
            items = next.items;
            const still = items.filter(i => results[i.moi_han_id]?.ket_qua === "Đạt" && !i.current?.co_the_dat);
            if (still.length) throw new Error(`Đã ghi kết quả Đạt nhưng ${still.map(i => fieldWeldCode(i.ma_lich_su)).join(", ")} vẫn chưa đủ điều kiện theo tiêu chí — bổ sung trong Kiểm tra chất lượng.`);
          }
          const done = await request<{ so_moi_chuyen?: number; sieu_am_id?: string; canh_bao?: string }>("split-complete", { id: detail.ticket.id, ngay_nghiem_thu: date, results: items.map(i => ({
            id: i.moi_han_id, phien_ban: i.version, ...results[i.moi_han_id],
          })) });
          notifyWeldQualityChanged();
          await openTicket(detail.ticket.id); await refresh();
          if (done.canh_bao) setError(done.canh_bao);
          if (done.so_moi_chuyen) setOkMsg(`Đã chuyển phiếu ${detail.ticket.so_phieu} (${done.so_moi_chuyen} mối Đạt) sang tab «Nghiệm thu Siêu âm».`);
          else if (kind === "sieu-am") setOkMsg(`Đã duyệt phiếu ${detail.ticket.so_phieu}; ký biên bản ở mục Hồ sơ nghiệm thu.`);
          // Tab 1 đã chuyển mối Đạt sang siêu âm → hỏi duyệt siêu âm luôn (Không thì in biên bản như cũ).
          if (done.so_moi_chuyen && done.sieu_am_id && onGoToUltrasound) {
            setAskForward({ soPhieu: detail.ticket.so_phieu, count: done.so_moi_chuyen, sieuAmId: done.sieu_am_id, geometryId: detail.ticket.id });
            return;
          }
          // Chốt xong: mở ngay bộ biên bản để in (mối Đạt chuyển trạng thái tiếp theo).
          if (onPrintRecord && Object.values(results).some((r) => r.ket_qua === "Đạt")) onPrintRecord(await loadGeometryRecord(detail.ticket.id));
        });
      }}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-wrap items-center gap-2 text-sm">Ngày nghiệm thu<input type="date" required className={field} min={detail.ticket.ngay_moi}
            disabled={Boolean(detail.ticket.ngay_nghiem_thu) || busy} value={date} onChange={e => setDate(e.target.value)} /></label>
          <span className="text-sm text-slate-600">{detail.items.length} mối</span>
          {!detail.ticket.ngay_nghiem_thu && <span className="text-sm text-slate-600">· Đạt {counts.pass} · Không đạt {counts.fail} · Chưa chọn {counts.none}</span>}
        </div>
        {!detail.ticket.ngay_nghiem_thu && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm">
          <button type="button" className={button} disabled={busy} onClick={() => setPicked(pendingItems.map(i => i.moi_han_id))}>Tick tất cả</button>
          <button type="button" className={button} disabled={busy || !picked.length} onClick={() => setPicked([])}>Bỏ tick</button>
          <span className="text-slate-600">Đã tick {picked.length}</span>
          <button type="button" className={primary} disabled={busy || !picked.length} onClick={() => bulkSet("Đạt")} title="Đặt kết quả Đạt cho các mối đã tick (tự ghi kiểm tra khi chốt)">Đạt hàng loạt</button>
          <input aria-label="Lý do không đạt hàng loạt" placeholder="Lý do (cho Không đạt hàng loạt)" className={field + " min-w-0 flex-1"} value={bulkReason} onChange={e => setBulkReason(e.target.value)} />
          <button type="button" className={button} disabled={busy || !picked.length} onClick={() => bulkSet("Không đạt")}>Không đạt hàng loạt</button>
          <button type="button" className={button} disabled={busy || !picked.length} onClick={() => bulkSet("")}>Xoá kết quả</button>
          {kind === "hinh-hoc" && <button type="button" className={button} disabled={busy} onClick={() => run(passVisual)} title="Ghi trực quan Đạt ngay cho các mối chưa đủ điều kiện, ô sai số trống tự điền mức tối đa">Điền trực quan đạt</button>}
        </div>}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                {!detail.ticket.ngay_nghiem_thu && <th className="w-9 px-3 py-2"><input type="checkbox" aria-label="Tick tất cả" checked={pendingItems.length > 0 && picked.length === pendingItems.length} onChange={e => setPicked(e.target.checked ? pendingItems.map(i => i.moi_han_id) : [])} /></th>}
                <th className="px-3 py-2">Mã mối</th><th className="px-3 py-2">Lý trình</th><th className="px-3 py-2">Dữ liệu kiểm tra</th><th className="w-64 px-3 py-2">Kết quả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detail.items.map(i => {
                const data = detail.ticket.ngay_nghiem_thu ? i.du_lieu_chot : i.current;
                const canPass = Boolean(i.current?.co_the_dat) || (kind === "hinh-hoc" ? i.current?.truc_quan !== "Đạt" : !i.current?.ket_qua_ndt);
                const res = results[i.moi_han_id];
                return <tr key={i.moi_han_id} className="hover:bg-slate-50">
                  {!detail.ticket.ngay_nghiem_thu && <td className="px-3 py-1.5">{!i.ket_qua && <input type="checkbox" aria-label={"Tick " + fieldWeldCode(i.ma_lich_su)} checked={picked.includes(i.moi_han_id)} onChange={e => setPicked(e.target.checked ? [...picked, i.moi_han_id] : picked.filter(id => id !== i.moi_han_id))} />}</td>}
                  <td className="whitespace-nowrap px-3 py-1.5 font-bold" title={i.ma_lich_su}>{fieldWeldCode(i.ma_lich_su)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs">{i.ly_trinh ?? "—"}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-600" title={evidenceText(kind, data)}>{evidenceShort(kind, data)}</td>
                  <td className="px-3 py-1.5">
                    {i.ket_qua ? <span className={`inline-block rounded-md px-2 py-1 text-xs font-semibold ${i.ket_qua === "Đạt" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{i.ket_qua}{i.ly_do ? ` · ${i.ly_do}` : ""}</span> : <div className="flex flex-col gap-1">
                      <select aria-label={"Kết quả " + i.ma_lich_su} disabled={busy} className={field + " min-h-9 w-full py-1"} value={res?.ket_qua || ""} onChange={e => patch(i.moi_han_id, { ket_qua: e.target.value, ly_do: "" })}>
                        <option value="">Chưa chọn</option><option disabled={!canPass}>Đạt</option><option>Không đạt</option>
                      </select>
                      {res?.ket_qua === "Không đạt" && <input required maxLength={1000} aria-label={"Lý do " + i.ma_lich_su} placeholder="Lý do không đạt → Sửa chữa/khắc phục" className={field + " min-h-9 w-full py-1"} value={res.ly_do || ""} onChange={e => patch(i.moi_han_id, { ly_do: e.target.value })} />}
                      {!canPass && !res?.ket_qua && <span className="text-xs text-amber-800">{kind === "hinh-hoc" ? "Số đo / chiều dài mài chưa đạt — bổ sung trong Kiểm tra chất lượng." : "Siêu âm đã ghi Không đạt."}</span>}
                    </div>}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {!detail.ticket.ngay_nghiem_thu && <button className={primary} disabled={busy || counts.none > 0}>Chốt nghiệm thu và lập biên bản</button>}
        {!detail.ticket.ngay_nghiem_thu && counts.none > 0 && <p className="text-xs text-amber-800">Còn {counts.none} mối chưa chọn kết quả — tick rồi bấm «Đạt hàng loạt» hoặc chọn từng mối.</p>}
      </form>
    </div>}
    {doc === "invite" && detail && createPortal(<WeldAcceptanceDocument onClose={() => setDoc(null)} view={{ kind: "rfi", rfi: {
      projectName,
      rfi: { ...detail.ticket, trang_thai: detail.ticket.ngay_nghiem_thu ? "Đã hoàn thành" : "Đã phát hành", created_at: "",
        tong_moi: detail.items.length, con_lai: detail.ticket.ngay_nghiem_thu ? 0 : detail.items.length,
        thong_tin: { ...(detail.ticket.thong_tin ?? {}), loai_rfi: "nghiem-thu", nt_hinh_hoc: kind === "hinh-hoc" ? "1" : "", nt_sieu_am: kind === "sieu-am" ? "1" : "" } },
      welds: detail.items.map(i => ({ moi_han_id: i.moi_han_id, ma_lich_su: i.ma_lich_su, ly_trinh: i.ly_trinh ?? null, ma_diem: i.ma_diem ?? null,
        con_hieu_luc: !detail.ticket.ngay_nghiem_thu, ngay_thuc_hien: null, vi_do: null, kinh_do: null,
        phien_ban: i.version ?? 0, tinh_trang: i.ket_qua ?? "Chưa nghiệm thu", du_dieu_kien_nghiem_thu: Boolean(i.current?.co_the_dat) })),
    } }} />, document.body)}
    {askForward && createPortal(
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="ask-forward-title">
        <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
          <h2 id="ask-forward-title" className="text-lg font-extrabold text-slate-900">Duyệt siêu âm luôn?</h2>
          <p className="text-sm text-slate-700">
            Phiếu <b>{askForward.soPhieu}</b> đã duyệt hình học xong, <b>{askForward.count} mối Đạt</b> đã chuyển sang tab «Nghiệm thu Siêu âm».
            Bạn có muốn duyệt siêu âm cho phiếu này ngay không?
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={button} disabled={busy} onClick={() => {
              const { geometryId } = askForward;
              setAskForward(null);
              // Không: ở lại tab 1, in biên bản hình học như trước.
              if (onPrintRecord) void run(async () => onPrintRecord(await loadGeometryRecord(geometryId)));
            }}>Không</button>
            <button type="button" className={primary} disabled={busy} autoFocus onClick={() => {
              const { sieuAmId } = askForward;
              setAskForward(null);
              onGoToUltrasound?.(sieuAmId);
            }}>Có, duyệt ngay</button>
          </div>
        </div>
      </div>,
      document.body,
    )}
  </section>;
}
