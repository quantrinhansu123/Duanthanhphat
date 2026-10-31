"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadProjects } from "@/lib/projectsDb";
import { completeAcceptance, loadRecords, loadRecordSet, loadRfiCandidates, loadRfiDetail, loadRfiNumber, loadRfis,
  publishRfi, setRecordSign, type RecordSet, type RecordSummary, type RfiSummary, type RfiWeld } from "@/lib/weldQualityClient";
import { defaultDecisions, summarizeDecisions, type AcceptanceDecision, type RfiCandidate, type RfiCandidateFilter } from "@/lib/weldAcceptance";
import WeldAcceptanceDocument, { type DocKind } from "@/components/WeldAcceptanceDocument";
import WeldBbntDocument from "@/components/WeldBbntDocument";

const input = "h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs sm:text-sm";
const btn = "h-9 rounded-lg px-4 text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const primary = `${btn} bg-[#0047AB] text-white hover:bg-[#00388A]`;
const secondary = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const today = () => new Date().toLocaleDateString("sv-SE");
const message = (e: unknown) => (e instanceof Error ? e.message : "Có lỗi xảy ra.");

type Project = { id: string; name: string };
type View = { kind: DocKind; rfi?: { rfi: RfiSummary; welds: RfiWeld[]; projectName: string }; record?: RecordSet } | null;

export default function WeldAcceptanceWorkflow() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tab, setTab] = useState<"rfi" | "accept" | "records">("rfi");
  const [view, setView] = useState<View>(null);
  const [bbnt, setBbnt] = useState<RecordSet | null>(null);

  useEffect(() => {
    loadProjects({ includeProgress: false }).then((r) => {
      setProjects(r.projects.map((p) => ({ id: p.id, name: p.name })));
      setProjectId((cur) => cur || r.projects[0]?.id || "");
    }).catch(() => setProjects([]));
  }, []);
  const projectName = projects.find((p) => p.id === projectId)?.name ?? "";

  async function openRfi(rfi: RfiSummary) {
    const d = await loadRfiDetail(rfi.id);
    setView({ kind: "rfi", rfi: { rfi: d.rfi, welds: d.welds, projectName } });
  }
  async function openRecord(id: string, kind: DocKind) {
    setView({ kind, record: await loadRecordSet(id) });
  }
  async function openBbnt(id: string) {
    setBbnt(await loadRecordSet(id));
  }

  return (
    <div className="px-4 sm:px-6 pb-8 no-print-root">
      <div className="no-print flex flex-wrap items-center gap-2 mb-3">
        <select className={input} value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Dự án">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {([["rfi", "Phát RFI"], ["accept", "Nghiệm thu"], ["records", "Hồ sơ nghiệm thu"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={tab === id ? primary : secondary}>{label}</button>
        ))}
      </div>
      {!projectId ? <p className="text-sm text-slate-500">Chọn dự án.</p> : (
        <div className="no-print">
          {tab === "rfi" && <RfiPanel key={projectId} projectId={projectId} onOpen={openRfi} />}
          {tab === "accept" && <AcceptPanel key={projectId} projectId={projectId} />}
          {tab === "records" && <RecordsPanel key={projectId} projectId={projectId} onOpen={openRecord} onOpenBbnt={openBbnt} />}
        </div>
      )}
      {view && createPortal(<WeldAcceptanceDocument view={view} onClose={() => setView(null)} />, document.body)}
      {bbnt && createPortal(<WeldBbntDocument record={bbnt} onClose={() => setBbnt(null)} />, document.body)}
    </div>
  );
}

function RfiPanel({ projectId, onOpen }: { projectId: string; onOpen: (r: RfiSummary) => unknown }) {
  const [kind, setKind] = useState<"nghiem-thu" | "theo-doi">("nghiem-thu");
  const monitoring = kind === "theo-doi";
  const [filters, setFilters] = useState<RfiCandidateFilter>({});
  const [rows, setRows] = useState<RfiCandidate[]>([]);
  const [info, setInfo] = useState<{ missing: string[]; excluded: Record<string, number>; total: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rfis, setRfis] = useState<RfiSummary[]>([]);
  const [soPhieu, setSoPhieu] = useState("");
  const [ngayMoi, setNgayMoi] = useState(today());
  const [thongTin, setThongTin] = useState({ dia_diem: "", ben_moi: "", ben_nhan: "", pham_vi: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());

  const refresh = useCallback(async () => {
    const [list, num] = await Promise.all([loadRfis(projectId), loadRfiNumber(projectId)]);
    setRfis(list.rfis); setSoPhieu(num.so_phieu);
  }, [projectId]);
  useEffect(() => { setRows([]); setInfo(null); setSelected(new Set()); setError(""); requestId.current = crypto.randomUUID(); refresh().catch((e) => setError(message(e))); }, [projectId, kind, refresh]);

  async function search() {
    setBusy(true); setError("");
    try {
      const r = await loadRfiCandidates(projectId, filters);
      setRows(r.rows); setInfo({ missing: r.missingChainage, excluded: r.excluded, total: r.total });
      setSelected((cur) => new Set([...cur])); // giữ ID đã chọn khi đổi bộ lọc
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function publish() {
    setBusy(true); setError("");
    try {
      await publishRfi({ id: requestId.current, du_an_id: projectId, so_phieu: soPhieu, ngay_moi: ngayMoi, moi_han_ids: monitoring ? [] : [...selected], thong_tin: thongTin, loai_rfi: kind, filters });
      requestId.current = crypto.randomUUID(); // chỉ đổi ID sau khi thành công để thử lại không tạo phiếu thứ hai
      setSelected(new Set()); await refresh(); if (!monitoring) await search();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const set = (k: keyof RfiCandidateFilter) => (e: React.ChangeEvent<HTMLInputElement>) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section className="space-y-3">
      <div role="group" aria-label="Loại RFI" className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} aria-pressed={!monitoring} onClick={() => setKind("nghiem-thu")} className={!monitoring ? primary : secondary}>1. RFI nghiệm thu</button>
        <button type="button" disabled={busy} aria-pressed={monitoring} onClick={() => setKind("theo-doi")} className={monitoring ? primary : secondary}>2. RFI theo dõi công việc hàn</button>
      </div>
      {monitoring && <p className="text-sm text-slate-600">Nhập phạm vi mối hàn và/hoặc lý trình để mời theo dõi công việc hàn. Phiếu này không xác nhận chất lượng nghiệm thu.</p>}
      <div className="flex flex-wrap items-end gap-2">
        {!monitoring && <>
        <input className={input} placeholder="Tìm mã mối" value={filters.query ?? ""} onChange={set("query")} />
        <input className={input} type="date" title="Từ ngày hàn" value={filters.dateFrom ?? ""} onChange={set("dateFrom")} />
        <input className={input} type="date" title="Đến ngày hàn" value={filters.dateTo ?? ""} onChange={set("dateTo")} />
        </>}
        <input className={input} placeholder="Từ mối" value={filters.nameFrom ?? ""} onChange={set("nameFrom")} />
        <input className={input} placeholder="Đến mối" value={filters.nameTo ?? ""} onChange={set("nameTo")} />
        <input className={`${input} w-28`} placeholder="Từ Km0+000" value={filters.kmFrom ?? ""} onChange={set("kmFrom")} />
        <input className={`${input} w-28`} placeholder="Đến Km2+000" value={filters.kmTo ?? ""} onChange={set("kmTo")} />
        {!monitoring && <button type="button" className={primary} disabled={busy} onClick={search}>Tìm mối đủ điều kiện</button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {info && (
        <div className="text-xs text-slate-600 space-y-1">
          <p>{rows.length}/{info.total} mối đủ điều kiện khớp bộ lọc. Đã chọn {selected.size}.</p>
          {info.missing.length > 0 && <p className="text-amber-700">{info.missing.length} mối thiếu lý trình nên không nằm trong khoảng Km (vẫn tìm được bằng mã).</p>}
          {Object.keys(info.excluded).length > 0 && <p>Chưa đủ điều kiện: {Object.entries(info.excluded).map(([k, v]) => `${k} (${v})`).join("; ")}.</p>}
        </div>
      )}
      {rows.length > 0 && (
        <>
          <div className="flex gap-2">
            <button type="button" className={secondary} onClick={() => setSelected((c) => new Set([...c, ...rows.map((r) => r.id)]))}>Chọn tất cả kết quả lọc</button>
            <button type="button" className={secondary} onClick={() => setSelected(new Set())}>Bỏ chọn</button>
          </div>
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50"><tr><th className="p-2 w-8" /><th className="p-2 text-left">Mã mối</th><th className="p-2 text-left">Ngày hàn</th><th className="p-2 text-left">Lý trình</th><th className="p-2 text-left">Tình trạng</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-2"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={r.ma_lich_su} /></td>
                  <td className="p-2">{r.ma_lich_su}</td><td className="p-2">{r.ngay_thuc_hien ?? "—"}</td><td className="p-2">{r.ly_trinh ?? "—"}</td><td className="p-2">{r.tinh_trang}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </>
      )}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3">
        <input className={input} value={soPhieu} onChange={(e) => setSoPhieu(e.target.value)} placeholder="Số phiếu" />
        <input className={input} type="date" value={ngayMoi} onChange={(e) => setNgayMoi(e.target.value)} />
        <input className={input} placeholder="Địa điểm" value={thongTin.dia_diem} onChange={(e) => setThongTin({ ...thongTin, dia_diem: e.target.value })} />
        <input className={input} placeholder="Bên mời (nhà thầu)" value={thongTin.ben_moi} onChange={(e) => setThongTin({ ...thongTin, ben_moi: e.target.value })} />
        <input className={input} placeholder="Bên nhận (TVGS/CĐT)" value={thongTin.ben_nhan} onChange={(e) => setThongTin({ ...thongTin, ben_nhan: e.target.value })} />
        <input className={input} placeholder="Phạm vi" value={thongTin.pham_vi} onChange={(e) => setThongTin({ ...thongTin, pham_vi: e.target.value })} />
        <button type="button" className={primary} disabled={busy || (!monitoring && !selected.size) || !soPhieu.trim() || !ngayMoi} onClick={publish}>{monitoring ? "Phát hành RFI theo dõi" : `Phát hành RFI (${selected.size} mối)`}</button>
      </div>
      <h3 className="text-sm font-bold">Phiếu đã phát hành</h3>
      <ul className="divide-y divide-slate-100 text-sm">
        {rfis.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>{r.so_phieu} · {r.ngay_moi} · {r.thong_tin?.loai_rfi === "theo-doi" ? "Theo dõi công việc hàn" : `${r.tong_moi} mối (còn ${r.con_lai})`} · {r.trang_thai}</span>
            <button type="button" className={secondary} onClick={() => Promise.resolve(onOpen(r)).catch((e) => setError(message(e)))}>Xem / In</button>
          </li>))}
        {!rfis.length && <li className="py-2 text-slate-500">Chưa có phiếu.</li>}
      </ul>
    </section>
  );
}

function AcceptPanel({ projectId }: { projectId: string }) {
  const [rfis, setRfis] = useState<RfiSummary[]>([]);
  const [active, setActive] = useState<{ rfi: RfiSummary; welds: RfiWeld[] } | null>(null);
  const [decisions, setDecisions] = useState<AcceptanceDecision[]>([]);
  const [ngay, setNgay] = useState(today());
  const [thongTin, setThongTin] = useState({ dia_diem: "", thanh_phan: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const requestId = useRef(crypto.randomUUID());

  const refresh = useCallback(() => loadRfis(projectId).then((r) => setRfis(r.rfis.filter((x) => x.trang_thai === "Đã phát hành" && x.con_lai > 0))), [projectId]);
  useEffect(() => { setActive(null); refresh().catch((e) => setError(message(e))); }, [projectId, refresh]);

  async function open(r: RfiSummary) {
    setError(""); setDone("");
    const d = await loadRfiDetail(r.id);
    const open = d.welds.filter((w) => w.con_hieu_luc);
    setActive({ rfi: d.rfi, welds: open });
    setDecisions(defaultDecisions(open));
    requestId.current = crypto.randomUUID();
  }
  const patch = (id: string, p: Partial<AcceptanceDecision>) => setDecisions((cur) => cur.map((d) => (d.moi_han_id === id ? { ...d, ...p } : d)));
  const sum = useMemo(() => summarizeDecisions(decisions), [decisions]);
  const missingReason = decisions.some((d) => d.ket_qua !== "Đạt" && !d.ly_do?.trim());

  async function complete() {
    if (!active) return;
    setBusy(true); setError("");
    try {
      await completeAcceptance({ id: requestId.current, phieu_id: active.rfi.id, ngay_nghiem_thu: ngay, ket_qua: decisions, thong_tin: thongTin });
      setDone(`Đã hoàn thành nghiệm thu: ${sum.accepted} đạt, ${sum.failed} không đạt, ${sum.deferred} chưa nghiệm thu. Xem bộ hồ sơ ở tab Hồ sơ nghiệm thu.`);
      setActive(null); await refresh();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }

  return (
    <section className="space-y-3">
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}
      {!active && (
        <ul className="divide-y divide-slate-100 text-sm">
          {rfis.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{r.so_phieu} · mời {r.ngay_moi} · còn {r.con_lai}/{r.tong_moi} mối</span>
              <button type="button" className={primary} onClick={() => open(r).catch((e) => setError(message(e)))}>Nghiệm thu</button>
            </li>))}
          {!rfis.length && <li className="py-2 text-slate-500">Không có RFI nào đang chờ nghiệm thu.</li>}
        </ul>
      )}
      {active && (
        <>
          <p className="text-sm font-semibold">{active.rfi.so_phieu} — mặc định “Đạt” cho mối đủ điều kiện; mối chưa đủ điều kiện được đặt “Chưa nghiệm thu”.</p>
          <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50"><tr><th className="p-2 text-left">Mã mối</th><th className="p-2 text-left">Tình trạng</th><th className="p-2 text-left">Kết quả</th><th className="p-2 text-left">Lý do (nếu loại)</th></tr></thead>
              <tbody>{active.welds.map((w) => {
                const d = decisions.find((x) => x.moi_han_id === w.moi_han_id);
                if (!d) return null;
                return (
                  <tr key={w.moi_han_id} className="border-t border-slate-100">
                    <td className="p-2">{w.ma_lich_su}</td><td className="p-2">{w.tinh_trang}</td>
                    <td className="p-2">
                      <select className={input} value={d.ket_qua} onChange={(e) => patch(w.moi_han_id, { ket_qua: e.target.value as AcceptanceDecision["ket_qua"] })}>
                        <option value="Đạt" disabled={!w.du_dieu_kien_nghiem_thu}>Hoàn thành (Đạt)</option>
                        <option value="Chưa nghiệm thu">Chưa nghiệm thu</option>
                        <option value="Không đạt">Không đạt</option>
                      </select>
                    </td>
                    <td className="p-2"><input className={`${input} w-full`} value={d.ly_do ?? ""} disabled={d.ket_qua === "Đạt"} onChange={(e) => patch(w.moi_han_id, { ly_do: e.target.value })} /></td>
                  </tr>);
              })}</tbody>
            </table>
          </div>
          <p className="text-sm">Tổng {sum.total} · chấp nhận <b>{sum.accepted}</b> · không đạt {sum.failed} · chưa nghiệm thu {sum.deferred}. Sẽ sinh 3 hồ sơ: Hoàn thành công việc, Phụ lục, Giai đoạn xây dựng.</p>
          <div className="flex flex-wrap items-end gap-2">
            <input className={input} type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} />
            <input className={input} placeholder="Địa điểm" value={thongTin.dia_diem} onChange={(e) => setThongTin({ ...thongTin, dia_diem: e.target.value })} />
            <input className={input} placeholder="Thành phần tham dự" value={thongTin.thanh_phan} onChange={(e) => setThongTin({ ...thongTin, thanh_phan: e.target.value })} />
            <button type="button" className={primary} disabled={busy || !sum.accepted || missingReason} onClick={complete}>Hoàn thành nghiệm thu</button>
            <button type="button" className={secondary} onClick={() => setActive(null)}>Quay lại</button>
          </div>
          {missingReason && <p className="text-xs text-amber-700">Nhập lý do cho mọi mối không được chấp nhận.</p>}
        </>
      )}
    </section>
  );
}

function RecordsPanel({ projectId, onOpen, onOpenBbnt }: { projectId: string; onOpen: (id: string, kind: DocKind) => unknown; onOpenBbnt: (id: string) => unknown }) {
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [error, setError] = useState("");
  const refresh = useCallback(() => loadRecords(projectId).then((r) => setRecords(r.records)), [projectId]);
  useEffect(() => { refresh().catch((e) => setError(message(e))); }, [refresh]);
  const kinds: [string, DocKind][] = [["Hoàn thành công việc", "hoan-thanh"], ["Phụ lục công việc", "phu-luc"], ["Giai đoạn xây dựng", "giai-doan"]];

  return (
    <section className="space-y-3">
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {records.map((r) => (
        <div key={r.id} className="rounded-lg border border-slate-200 p-3 text-sm space-y-2">
          <p className="font-semibold">{r.phieu_yeu_cau_nghiem_thu.so_phieu} · nghiệm thu {r.ngay_nghiem_thu} · {r.nguoi_lap}</p>
          <div className="flex flex-wrap gap-2">
            {kinds.map(([loai, kind]) => {
              const doc = r.ho_so_nghiem_thu.find((h) => h.loai === loai);
              return (
                <span key={kind} className="inline-flex items-center gap-1">
                  <button type="button" className={secondary} onClick={() => Promise.resolve(onOpen(r.id, kind)).catch((e) => setError(message(e)))}>{loai}</button>
                  {doc && (
                    <button type="button" className="text-xs underline cursor-pointer" onClick={() =>
                      setRecordSign(doc.id, doc.tinh_trang_ky === "Đã ký" ? "Chờ ký" : "Đã ký").then(refresh).catch((e) => setError(message(e)))}>
                      {doc.tinh_trang_ky}
                    </button>)}
                </span>);
            })}
            <button type="button" className={secondary} onClick={() => Promise.resolve(onOpenBbnt(r.id)).catch((e) => setError(message(e)))}>BBNT mối hàn</button>
          </div>
        </div>))}
      {!records.length && <p className="text-sm text-slate-500">Chưa có hồ sơ nghiệm thu.</p>}
    </section>
  );
}
