"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadProjects } from "@/lib/projectsDb";
import { completeAcceptance, loadRecords, loadRecordSet, loadRfiCandidates, loadRfiDetail, loadRfiNumber, loadRfis,
  publishRfi, setRecordSetSign, updateRfi, type RecordSet, type RecordSummary, type RfiSummary, type RfiWeld } from "@/lib/weldQualityClient";
import { defaultDecisions, summarizeDecisions, type AcceptanceDecision, type RfiCandidate, type RfiCandidateFilter } from "@/lib/weldAcceptance";
import WeldAcceptanceDocument, { type DocKind } from "@/components/WeldAcceptanceDocument";
import WeldAcceptancePrintPack from "@/components/WeldAcceptancePrintPack";
import RfiIssuedListDocument from "@/components/RfiIssuedListDocument";
import { parseCoordinateCode } from "@/lib/weldCode";

const input = "h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs sm:text-sm";
const btn = "h-9 rounded-lg px-4 text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const primary = `${btn} bg-[#0047AB] text-white hover:bg-[#00388A]`;
const secondary = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const today = () => new Date().toLocaleDateString("sv-SE");
const message = (e: unknown) => (e instanceof Error ? e.message : "Có lỗi xảy ra.");

const LS_PROJECT = "weld-acceptance-project-id";
const rfiDraftKey = (projectId: string) => `weld-rfi-draft:${projectId}`;

type Project = { id: string; name: string };
type View = { kind: DocKind; rfi?: { rfi: RfiSummary; welds: RfiWeld[]; projectName: string }; record?: RecordSet } | null;
type RfiThongTin = {
  dia_diem: string;
  ben_moi: string;
  ben_nhan: string;
  pham_vi: string;
  tuyen_thuong: boolean;
  tuyen_ha: boolean;
  gio_bat_dau: string;
};

const emptyThongTin = (): RfiThongTin => ({
  dia_diem: "", ben_moi: "", ben_nhan: "", pham_vi: "",
  tuyen_thuong: false, tuyen_ha: false, gio_bat_dau: "",
});

function thongTinToPayload(t: RfiThongTin): Record<string, string> {
  return {
    dia_diem: t.dia_diem,
    ben_moi: t.ben_moi,
    ben_nhan: t.ben_nhan,
    pham_vi: t.pham_vi,
    tuyen_thuong: t.tuyen_thuong ? "1" : "",
    tuyen_ha: t.tuyen_ha ? "1" : "",
    gio_bat_dau: t.gio_bat_dau,
  };
}

function thongTinFromStored(raw: Record<string, string> | undefined): RfiThongTin {
  const t = raw ?? {};
  return {
    dia_diem: t.dia_diem ?? "",
    ben_moi: t.ben_moi ?? "",
    ben_nhan: t.ben_nhan ?? "",
    pham_vi: t.pham_vi ?? "",
    tuyen_thuong: t.tuyen_thuong === "1" || t.tuyen_thuong === "true",
    tuyen_ha: t.tuyen_ha === "1" || t.tuyen_ha === "true",
    gio_bat_dau: t.gio_bat_dau ?? "",
  };
}

function loadRfiDraft(projectId: string): Partial<RfiThongTin> | null {
  try {
    const raw = window.localStorage.getItem(rfiDraftKey(projectId));
    return raw ? (JSON.parse(raw) as Partial<RfiThongTin>) : null;
  } catch {
    return null;
  }
}

function saveRfiDraft(projectId: string, t: RfiThongTin) {
  try {
    window.localStorage.setItem(rfiDraftKey(projectId), JSON.stringify({
      dia_diem: t.dia_diem, ben_moi: t.ben_moi, ben_nhan: t.ben_nhan, pham_vi: t.pham_vi,
      tuyen_thuong: t.tuyen_thuong, tuyen_ha: t.tuyen_ha, gio_bat_dau: t.gio_bat_dau,
    }));
  } catch { /* ignore */ }
}

function inferRoutes(welds: { ma_diem?: string | null }[]): { upper: boolean; lower: boolean } {
  const routes = welds.map((w) => parseCoordinateCode(w.ma_diem ?? "")?.prefix);
  return {
    upper: routes.some((r) => r === "TT" || r === "TP"),
    lower: routes.some((r) => r === "HT" || r === "HP"),
  };
}

export default function WeldAcceptanceWorkflow() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tab, setTab] = useState<"rfi" | "accept" | "records">("rfi");
  const [view, setView] = useState<View>(null);
  const [editRfiId, setEditRfiId] = useState<string | null>(null);
  const [issuedList, setIssuedList] = useState<RfiSummary[] | null>(null);
  const [printPack, setPrintPack] = useState<RecordSet | null>(null);
  const consumeEditRfi = useCallback(() => setEditRfiId(null), []);

  useEffect(() => {
    const remembered = (() => {
      try { return window.localStorage.getItem(LS_PROJECT) || ""; } catch { return ""; }
    })();
    loadProjects({ includeProgress: false }).then((r) => {
      const list = r.projects.map((p) => ({ id: p.id, name: p.name }));
      setProjects(list);
      setProjectId((cur) => cur || (remembered && list.some((p) => p.id === remembered) ? remembered : list[0]?.id) || "");
    }).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    try { window.localStorage.setItem(LS_PROJECT, projectId); } catch { /* ignore */ }
  }, [projectId]);

  const projectName = projects.find((p) => p.id === projectId)?.name ?? "";

  async function openRfi(rfi: RfiSummary) {
    const d = await loadRfiDetail(rfi.id);
    setView({ kind: "rfi", rfi: { rfi: d.rfi, welds: d.welds, projectName } });
  }
  async function openRecord(id: string, kind: DocKind) {
    setView({ kind, record: await loadRecordSet(id) });
  }
  async function openPrintPack(id: string) {
    setPrintPack(await loadRecordSet(id));
  }
  function startEditRfi(rfi: RfiSummary) {
    setView(null);
    setTab("rfi");
    setEditRfiId(rfi.id);
  }

  async function afterAccepted(recordId: string) {
    setTab("records");
    setView({ kind: "giai-doan", record: await loadRecordSet(recordId) });
  }

  /** Sau phát RFI: hỏi in bộ 3 biên bản mang hiện trường. */
  async function afterPublishedRfi(phieuId: string) {
    const wantPrint = window.confirm("Bạn có muốn in biên bản nghiệm thu luôn không?\n\nBấm OK để in đủ hồ sơ (1)(2)(3) mang ra hiện trường.");
    if (!wantPrint) return;
    try {
      const { records } = await loadRecords(projectId);
      const match = records.find((r) => r.phieu_yeu_cau_nghiem_thu.id === phieuId);
      if (!match) {
        window.alert("Đã phát RFI nhưng chưa thấy bộ 3 biên bản.\n\nChạy migration tạo hồ sơ khi phát RFI, rồi mở tab Hồ sơ nghiệm thu để in.");
        setTab("records");
        return;
      }
      setPrintPack(await loadRecordSet(match.id));
      setTab("records");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không mở được bộ in biên bản.");
      setTab("records");
    }
  }

  return (
    <div className="px-4 sm:px-6 pb-8 no-print-root">
      <div className="no-print flex flex-wrap items-center gap-2 mb-3">
        <select
          className={input}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="Dự án"
        >
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {([["rfi", "Phát phiếu YCNT"], ["accept", "Nghiệm thu"], ["records", "Hồ sơ nghiệm thu"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={tab === id ? primary : secondary}>{label}</button>
        ))}
      </div>
      {!projectId ? <p className="text-sm text-slate-500">Chọn dự án.</p> : (
        <div className="no-print">
          {tab === "rfi" && (
            <RfiPanel
              key={projectId}
              projectId={projectId}
              editRfiId={editRfiId}
              onEditConsumed={consumeEditRfi}
              onOpen={openRfi}
              onOpenIssuedList={setIssuedList}
              onPublished={afterPublishedRfi}
            />
          )}
          {tab === "accept" && (
            <AcceptPanel key={projectId} projectId={projectId} onCompleted={afterAccepted} />
          )}
          {tab === "records" && (
            <RecordsPanel key={projectId} projectId={projectId} onOpen={openRecord} onPrint={openPrintPack} />
          )}
        </div>
      )}
      {view && createPortal(
        <WeldAcceptanceDocument
          view={view}
          onClose={() => setView(null)}
          onEditRfi={view.kind === "rfi" ? startEditRfi : undefined}
        />,
        document.body,
      )}
      {issuedList && createPortal(
        <RfiIssuedListDocument projectName={projectName} rfis={issuedList} onClose={() => setIssuedList(null)} />,
        document.body,
      )}
      {printPack && createPortal(
        <WeldAcceptancePrintPack record={printPack} onClose={() => setPrintPack(null)} />,
        document.body,
      )}
    </div>
  );
}

function RfiPanel({
  projectId,
  editRfiId,
  onEditConsumed,
  onOpen,
  onOpenIssuedList,
  onPublished,
}: {
  projectId: string;
  editRfiId: string | null;
  onEditConsumed: () => void;
  onOpen: (r: RfiSummary) => unknown;
  onOpenIssuedList: (rfis: RfiSummary[]) => void;
  onPublished?: (phieuId: string) => unknown;
}) {
  const [kind, setKind] = useState<"nghiem-thu" | "theo-doi">("nghiem-thu");
  const monitoring = kind === "theo-doi";
  const [filters, setFilters] = useState<RfiCandidateFilter>({});
  const [rows, setRows] = useState<RfiCandidate[]>([]);
  const [info, setInfo] = useState<{ missing: string[]; excluded: Record<string, number>; total: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rfis, setRfis] = useState<RfiSummary[]>([]);
  const [soPhieu, setSoPhieu] = useState("");
  const [ngayMoi, setNgayMoi] = useState(today());
  const [thongTin, setThongTin] = useState<RfiThongTin>(() => {
    const draft = loadRfiDraft(projectId);
    return { ...emptyThongTin(), ...draft };
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const editFormRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async (keepSoPhieu = false) => {
    const [list, num] = await Promise.all([loadRfis(projectId), loadRfiNumber(projectId)]);
    setRfis(list.rfis);
    if (!keepSoPhieu) setSoPhieu(num.so_phieu);
  }, [projectId]);

  useEffect(() => {
    setRows([]); setInfo(null); setSelected(new Set()); setError(""); setOkMsg("");
    setEditingId(null);
    requestId.current = crypto.randomUUID();
    const draft = loadRfiDraft(projectId);
    setThongTin({ ...emptyThongTin(), ...draft });
    refresh().catch((e) => setError(message(e)));
  }, [projectId, refresh]);

  useEffect(() => {
    setRows([]); setInfo(null); setSelected(new Set());
  }, [kind]);

  useEffect(() => {
    if (!editRfiId) return;
    let live = true;
    setBusy(true);
    loadRfiDetail(editRfiId)
      .then((d) => {
        if (!live) return;
        setEditingId(d.rfi.id);
        setSoPhieu(d.rfi.so_phieu);
        setNgayMoi(d.rfi.ngay_moi);
        const info = thongTinFromStored(d.rfi.thong_tin);
        const inferred = inferRoutes(d.welds);
        setThongTin({
          ...info,
          tuyen_thuong: d.rfi.thong_tin?.tuyen_thuong == null ? inferred.upper : info.tuyen_thuong,
          tuyen_ha: d.rfi.thong_tin?.tuyen_ha == null ? inferred.lower : info.tuyen_ha,
        });
        setKind(d.rfi.thong_tin?.loai_rfi === "theo-doi" ? "theo-doi" : "nghiem-thu");
        setOkMsg(`Đang sửa phiếu ${d.rfi.so_phieu}. Lưu sẽ cập nhật thông tin in (không đổi danh sách mối).`);
        setBusy(false);
        onEditConsumed();
        requestAnimationFrame(() => editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      })
      .catch((e) => setError(message(e)))
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [editRfiId, onEditConsumed]);

  useEffect(() => {
    saveRfiDraft(projectId, thongTin);
  }, [projectId, thongTin]);

  async function search() {
    setBusy(true); setError(""); setOkMsg("");
    try {
      const r = await loadRfiCandidates(projectId, filters);
      setRows(r.rows); setInfo({ missing: r.missingChainage, excluded: r.excluded, total: r.total });
      // Tự chọn toàn bộ kết quả tìm được để sẵn sàng phát phiếu mới.
      setSelected(new Set(r.rows.map((row) => row.id)));
      if (!r.rows.length) {
        setOkMsg("Không có mối đủ điều kiện khớp bộ lọc. Nới bộ lọc hoặc kiểm tra nhật ký hàn / kiểm tra chất lượng rồi tìm lại.");
      }
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }

  async function publish() {
    setBusy(true); setError(""); setOkMsg("");
    try {
      const payload = thongTinToPayload(thongTin);
      if (editingId) {
        await updateRfi({ id: editingId, so_phieu: soPhieu, ngay_moi: ngayMoi, thong_tin: payload });
        setOkMsg(`Đã cập nhật phiếu ${soPhieu}.`);
        setEditingId(null);
        requestId.current = crypto.randomUUID();
        await refresh();
        return;
      }
      const published = await publishRfi({
        id: requestId.current,
        du_an_id: projectId,
        so_phieu: soPhieu,
        ngay_moi: ngayMoi,
        moi_han_ids: monitoring ? [] : [...selected],
        thong_tin: payload,
        loai_rfi: kind,
        filters,
      });
      const weldCount = selected.size;
      requestId.current = crypto.randomUUID();
      setSelected(new Set());
      setOkMsg(monitoring
        ? "Đã phát phiếu theo dõi mới."
        : `Đã phát phiếu yêu cầu mới (${weldCount} mối).`);
      await refresh();
      if (!monitoring) {
        await search();
        await Promise.resolve(onPublished?.(published.id));
      }
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }

  function beginEdit(r: RfiSummary) {
    setBusy(true);
    setError("");
    setOkMsg("");
    loadRfiDetail(r.id)
      .then((d) => {
        setKind(d.rfi.thong_tin?.loai_rfi === "theo-doi" ? "theo-doi" : "nghiem-thu");
        setEditingId(d.rfi.id);
        setSoPhieu(d.rfi.so_phieu);
        setNgayMoi(d.rfi.ngay_moi);
        const info = thongTinFromStored(d.rfi.thong_tin);
        const inferred = inferRoutes(d.welds);
        setThongTin({
          ...info,
          tuyen_thuong: d.rfi.thong_tin?.tuyen_thuong == null ? inferred.upper : info.tuyen_thuong,
          tuyen_ha: d.rfi.thong_tin?.tuyen_ha == null ? inferred.lower : info.tuyen_ha,
        });
        setOkMsg(`Đang sửa phiếu ${d.rfi.so_phieu}. Đổi thông tin bên dưới rồi bấm «Lưu sửa phiếu».`);
        requestAnimationFrame(() => editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      })
      .catch((e) => setError(message(e)))
      .finally(() => setBusy(false));
  }

  function cancelEdit() {
    setEditingId(null);
    setOkMsg("");
    refresh().catch((e) => setError(message(e)));
  }

  const toggle = (id: string) => setSelected((cur) => {
    const n = new Set(cur);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const set = (k: keyof RfiCandidateFilter) => (e: React.ChangeEvent<HTMLInputElement>) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const canPublishNew = monitoring || selected.size > 0;
  const publishDisabled = busy || (!editingId && !canPublishNew) || !soPhieu.trim() || !ngayMoi;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-[#0047AB]/25 bg-[#0047AB]/5 p-4">
        <h2 className="text-sm font-bold text-slate-900">Phát phiếu yêu cầu nghiệm thu mới</h2>
        <p className="mt-1 text-xs text-slate-600">
          {editingId
            ? `Đang sửa phiếu đã phát · ${soPhieu}. Thông tin in có thể đổi; danh sách mối giữ nguyên.`
            : "Làm lần lượt: (1) chọn loại phiếu → (2) tìm & chọn mối → (3) điền số phiếu / ngày / địa điểm → (4) bấm Phát phiếu yêu cầu mới."}
        </p>
      </div>

      <div role="group" aria-label="Loại phiếu" className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !!editingId} aria-pressed={!monitoring} onClick={() => setKind("nghiem-thu")} className={!monitoring ? primary : secondary}>1. Phiếu yêu cầu nghiệm thu</button>
        <button type="button" disabled={busy || !!editingId} aria-pressed={monitoring} onClick={() => setKind("theo-doi")} className={monitoring ? primary : secondary}>2. Phiếu theo dõi công việc hàn</button>
      </div>
      {monitoring && <p className="text-sm text-slate-600">Nhập phạm vi / lý trình để mời theo dõi công việc hàn. Phiếu này không xác nhận chất lượng nghiệm thu — có thể phát ngay không cần chọn mối.</p>}

      {!monitoring && !editingId && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Bước 2 — Tìm mối «Chờ siêu âm và nghiệm thu»</h3>
          <p className="text-xs text-slate-600">Chỉ lấy mối đã mài / trực quan / sai số đạt, đang chờ siêu âm. Mối «Chờ ký biên bản» không còn trong danh sách này.</p>
          <div className="flex flex-wrap items-end gap-2">
            <input className={input} placeholder="Tìm mã mối" value={filters.query ?? ""} onChange={set("query")} />
            <input className={input} type="date" title="Từ ngày hàn" value={filters.dateFrom ?? ""} onChange={set("dateFrom")} />
            <input className={input} type="date" title="Đến ngày hàn" value={filters.dateTo ?? ""} onChange={set("dateTo")} />
            <input className={input} placeholder="Từ mối" value={filters.nameFrom ?? ""} onChange={set("nameFrom")} />
            <input className={input} placeholder="Đến mối" value={filters.nameTo ?? ""} onChange={set("nameTo")} />
            <input className={`${input} w-28`} placeholder="Từ Km0+000" value={filters.kmFrom ?? ""} onChange={set("kmFrom")} />
            <input className={`${input} w-28`} placeholder="Đến Km2+000" value={filters.kmTo ?? ""} onChange={set("kmTo")} />
            <button type="button" className={primary} disabled={busy} onClick={() => void search()}>Tìm mối đủ điều kiện</button>
          </div>
          {info && (
            <div className="text-xs text-slate-600 space-y-1">
              <p>{rows.length}/{info.total} mối đủ điều kiện khớp bộ lọc. Đã chọn <b>{selected.size}</b> — sẽ đưa vào phiếu mới.</p>
              {info.missing.length > 0 && <p className="text-amber-700">{info.missing.length} mối thiếu lý trình nên không nằm trong khoảng Km (vẫn tìm được bằng mã).</p>}
              {Object.keys(info.excluded).length > 0 && <p>Chưa đủ điều kiện: {Object.entries(info.excluded).map(([k, v]) => `${k} (${v})`).join("; ")}.</p>}
            </div>
          )}
          {!info && (
            <p className="text-xs text-amber-800">Chưa tìm mối — nút phát phiếu sẽ hiện “(0 mối)” và bị khóa cho đến khi có mối được chọn.</p>
          )}
          {rows.length > 0 && (
            <>
              <div className="flex gap-2">
                <button type="button" className={secondary} onClick={() => setSelected(new Set(rows.map((r) => r.id)))}>Chọn tất cả kết quả lọc</button>
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
        </div>
      )}

      {monitoring && !editingId && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3">
          <input className={input} placeholder="Từ mối" value={filters.nameFrom ?? ""} onChange={set("nameFrom")} />
          <input className={input} placeholder="Đến mối" value={filters.nameTo ?? ""} onChange={set("nameTo")} />
          <input className={`${input} w-28`} placeholder="Từ Km0+000" value={filters.kmFrom ?? ""} onChange={set("kmFrom")} />
          <input className={`${input} w-28`} placeholder="Đến Km2+000" value={filters.kmTo ?? ""} onChange={set("kmTo")} />
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {okMsg && <p className="text-sm text-emerald-700">{okMsg}</p>}

      <div ref={editFormRef} className={`space-y-2 rounded-lg border p-3 ${editingId ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {editingId ? `Sửa phiếu đã phát · ${soPhieu}` : "Bước 3 — Thông tin phiếu & phát hành"}
        </h3>
        {editingId && (
          <p className="text-xs text-amber-900">
            Đang sửa phiếu đã phát. Có thể đổi số phiếu, ngày, giờ, địa điểm, bên mời/nhận, phạm vi và tuyến — <b>không đổi danh sách mối</b>.
          </p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <input className={input} value={soPhieu} onChange={(e) => setSoPhieu(e.target.value)} placeholder="Số phiếu" aria-label="Số phiếu" />
          <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-500">Ngày mời
            <input className={input} type="date" value={ngayMoi} onChange={(e) => setNgayMoi(e.target.value)} />
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-500">Giờ yêu cầu NT
            <input className={input} type="time" value={thongTin.gio_bat_dau} onChange={(e) => setThongTin({ ...thongTin, gio_bat_dau: e.target.value })} />
          </label>
          <input className={input} placeholder="Địa điểm" value={thongTin.dia_diem} onChange={(e) => setThongTin({ ...thongTin, dia_diem: e.target.value })} />
          <input className={input} placeholder="Bên mời (nhà thầu)" value={thongTin.ben_moi} onChange={(e) => setThongTin({ ...thongTin, ben_moi: e.target.value })} />
          <input className={input} placeholder="Bên nhận (TVGS/CĐT)" value={thongTin.ben_nhan} onChange={(e) => setThongTin({ ...thongTin, ben_nhan: e.target.value })} />
          <input className={input} placeholder="Phạm vi" value={thongTin.pham_vi} onChange={(e) => setThongTin({ ...thongTin, pham_vi: e.target.value })} />
          <div className="flex h-9 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={thongTin.tuyen_thuong} onChange={(e) => setThongTin({ ...thongTin, tuyen_thuong: e.target.checked })} />
              Tuyến thượng
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={thongTin.tuyen_ha} onChange={(e) => setThongTin({ ...thongTin, tuyen_ha: e.target.checked })} />
              Tuyến hạ
            </label>
          </div>
          <button
            type="button"
            className={primary}
            disabled={publishDisabled}
            title={!editingId && !monitoring && !selected.size ? "Cần tìm và chọn ít nhất 1 mối trước khi phát phiếu mới" : undefined}
            onClick={() => void publish()}
          >
            {editingId
              ? "Lưu sửa phiếu"
              : monitoring
                ? "Phát phiếu theo dõi mới"
                : `Phát phiếu yêu cầu mới (${selected.size} mối)`}
          </button>
          {editingId ? <button type="button" className={secondary} disabled={busy} onClick={cancelEdit}>Hủy sửa — phát phiếu mới</button> : null}
        </div>
        {!editingId && !monitoring && !selected.size && (
          <p className="text-xs text-amber-800">Nút phát phiếu đang khóa vì chưa chọn mối. Bấm <b>Tìm mối đủ điều kiện</b>, tick mối (mặc định chọn hết), rồi phát lại.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <h3 className="text-sm font-bold">Danh sách phiếu yêu cầu nghiệm thu đã phát</h3>
        <button
          type="button"
          className={secondary}
          disabled={!rfis.length}
          onClick={() => onOpenIssuedList(rfis)}
          title="Xem và in danh sách toàn bộ phiếu đã phát theo dự án"
        >
          Xem / In danh sách
        </button>
      </div>
      <div className="overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs sm:text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 w-10 text-left">STT</th>
              <th className="p-2 text-left">Số phiếu</th>
              <th className="p-2 text-left">Ngày phát</th>
              <th className="p-2 text-left">Loại</th>
              <th className="p-2 text-left">Số mối</th>
              <th className="p-2 text-left">Trạng thái</th>
              <th className="p-2 w-40" />
            </tr>
          </thead>
          <tbody>
            {rfis.map((r, i) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="p-2">{i + 1}</td>
                <td className="p-2 font-medium">{r.so_phieu}</td>
                <td className="p-2">{r.ngay_moi}{r.thong_tin?.gio_bat_dau ? ` ${r.thong_tin.gio_bat_dau}` : ""}</td>
                <td className="p-2">{r.thong_tin?.loai_rfi === "theo-doi" ? "Theo dõi" : "Nghiệm thu"}</td>
                <td className="p-2">{r.thong_tin?.loai_rfi === "theo-doi" ? "—" : `${r.tong_moi} (còn ${r.con_lai})`}</td>
                <td className="p-2">{r.trang_thai}</td>
                <td className="p-2 text-right">
                  <span className="inline-flex flex-wrap justify-end gap-1">
                    <button type="button" className={secondary} onClick={() => beginEdit(r)}>Sửa</button>
                    <button type="button" className={secondary} onClick={() => Promise.resolve(onOpen(r)).catch((e) => setError(message(e)))}>Xem / In</button>
                  </span>
                </td>
              </tr>
            ))}
            {!rfis.length && (
              <tr><td colSpan={7} className="p-3 text-slate-500">Chưa có phiếu. Dùng khung “Phát phiếu yêu cầu nghiệm thu mới” phía trên.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AcceptPanel({ projectId, onCompleted }: { projectId: string; onCompleted: (recordId: string) => unknown }) {
  const [rfis, setRfis] = useState<RfiSummary[]>([]);
  const [active, setActive] = useState<{ rfi: RfiSummary; welds: RfiWeld[] } | null>(null);
  const [decisions, setDecisions] = useState<AcceptanceDecision[]>([]);
  const [ngay, setNgay] = useState(today());
  const [thongTin, setThongTin] = useState({ dia_diem: "", thanh_phan: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const requestId = useRef(crypto.randomUUID());

  const refresh = useCallback(() => loadRfis(projectId).then((r) => setRfis(r.rfis.filter((x) => x.trang_thai === "Đã phát hành" && x.con_lai > 0 && x.thong_tin?.loai_rfi !== "theo-doi"))), [projectId]);
  useEffect(() => { setActive(null); refresh().catch((e) => setError(message(e))); }, [projectId, refresh]);

  async function open(r: RfiSummary) {
    setError(""); setDone("");
    const d = await loadRfiDetail(r.id);
    const openRows = d.welds.filter((w) => w.con_hieu_luc);
    setActive({ rfi: d.rfi, welds: openRows });
    setDecisions(defaultDecisions(openRows));
    setThongTin((t) => ({
      dia_diem: t.dia_diem || d.rfi.thong_tin?.dia_diem || "",
      thanh_phan: t.thanh_phan,
    }));
    requestId.current = crypto.randomUUID();
  }
  const patch = (id: string, p: Partial<AcceptanceDecision>) => setDecisions((cur) => cur.map((d) => (d.moi_han_id === id ? { ...d, ...p } : d)));
  const sum = useMemo(() => summarizeDecisions(decisions), [decisions]);
  const missingReason = decisions.some((d) => d.ket_qua !== "Đạt" && !d.ly_do?.trim());

  async function complete() {
    if (!active) return;
    setBusy(true); setError("");
    try {
      const res = await completeAcceptance({ id: requestId.current, phieu_id: active.rfi.id, ngay_nghiem_thu: ngay, ket_qua: decisions, thong_tin: thongTin });
      setDone(`Đã hoàn thành nghiệm thu: ${sum.accepted} đạt, ${sum.failed} không đạt, ${sum.deferred} chưa nghiệm thu.`);
      setActive(null);
      await refresh();
      await onCompleted(res.id);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }

  return (
    <section className="space-y-3">
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        Bộ 3 biên bản đã có từ lúc phát RFI để in mang đi. Sau khi siêu âm và kiểm tra, bấm <b>Hoàn thành nghiệm thu</b> để cập nhật kết quả, rồi xác nhận ký chung tại <b>Hồ sơ nghiệm thu</b>.
      </p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}
      {!active && (
        <ul className="divide-y divide-slate-100 text-sm">
          {rfis.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{r.so_phieu} · mời {r.ngay_moi}{r.thong_tin?.gio_bat_dau ? ` ${r.thong_tin.gio_bat_dau}` : ""} · còn {r.con_lai}/{r.tong_moi} mối</span>
              <button type="button" className={primary} onClick={() => open(r).catch((e) => setError(message(e)))}>Nghiệm thu</button>
            </li>))}
          {!rfis.length && (
            <li className="py-3 text-slate-600">
              Không có RFI đang chờ nghiệm thu. Hãy sang tab <b>Phát RFI</b> phát hành phiếu nghiệm thu trước, rồi quay lại đây.
            </li>
          )}
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
          <p className="text-sm">Tổng {sum.total} · chấp nhận <b>{sum.accepted}</b> · không đạt {sum.failed} · chưa nghiệm thu {sum.deferred}. Cập nhật kết quả vào bộ 3 biên bản đã tạo lúc phát RFI.</p>
          <div className="flex flex-wrap items-end gap-2">
            <input className={input} type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} />
            <input className={input} placeholder="Địa điểm" value={thongTin.dia_diem} onChange={(e) => setThongTin({ ...thongTin, dia_diem: e.target.value })} />
            <input className={input} placeholder="Thành phần tham dự" value={thongTin.thanh_phan} onChange={(e) => setThongTin({ ...thongTin, thanh_phan: e.target.value })} />
            <button type="button" className={primary} disabled={busy || !sum.accepted || missingReason} onClick={() => void complete()}>Hoàn thành nghiệm thu</button>
            <button type="button" className={secondary} onClick={() => setActive(null)}>Quay lại</button>
          </div>
          {missingReason && <p className="text-xs text-amber-700">Nhập lý do cho mọi mối không được chấp nhận.</p>}
        </>
      )}
    </section>
  );
}

function RecordsPanel({ projectId, onOpen, onPrint }: { projectId: string; onOpen: (id: string, kind: DocKind) => unknown; onPrint: (id: string) => Promise<void> }) {
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => loadRecords(projectId).then((r) => setRecords(r.records)), [projectId]);
  useEffect(() => { refresh().catch((e) => setError(message(e))); }, [refresh]);
  // Chỉ đúng 3 biên bản theo trình tự hồ sơ — không có BBNT thứ 4.
  const kinds: [string, DocKind][] = [
    ["(1) Phụ lục Biên bản nghiệm thu mối hàn", "phu-luc"],
    ["(2) Biên bản nghiệm thu công việc", "giai-doan"],
    ["(3) Biên bản hoàn thành công việc", "hoan-thanh"],
  ];
  const requiredLoai = ["Phụ lục công việc", "Giai đoạn xây dựng", "Hoàn thành công việc"];

  async function toggleSignSet(r: RecordSummary) {
    setBusy(true); setError("");
    try {
      const docs = r.ho_so_nghiem_thu ?? [];
      if (requiredLoai.some((loai) => !docs.some((h) => h.loai === loai))) {
        throw new Error("Thiếu một trong ba biên bản — chưa đủ điều kiện ký.");
      }
      const allSigned = docs.filter((h) => requiredLoai.includes(h.loai)).every((h) => h.tinh_trang_ky === "Đã ký");
      await setRecordSetSign(r.id, allSigned ? "Chờ ký" : "Đã ký");
      await refresh();
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }

  return (
    <section className="space-y-3">
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        Chỉ <b>3 biên bản</b>: (1) Phụ lục BBNT mối hàn · (2) BB nghiệm thu công việc · (3) BB hoàn thành công việc.
        Một nút ký chung cho cả bộ — thiếu bất kỳ cái nào thì chưa đủ điều kiện.
      </p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {records.map((r) => {
        const requiredDocs = (r.ho_so_nghiem_thu ?? []).filter((h) => requiredLoai.includes(h.loai));
        const complete = requiredDocs.length === 3;
        const allSigned = complete && requiredDocs.every((h) => h.tinh_trang_ky === "Đã ký");
        return (
          <div key={r.id} className="rounded-lg border border-slate-200 p-3 text-sm space-y-2">
            <p className="font-semibold">
              {r.phieu_yeu_cau_nghiem_thu.so_phieu} · {r.ngay_nghiem_thu} · {r.nguoi_lap}
              {!complete && <span className="ml-2 text-amber-700 font-medium">· Thiếu hồ sơ</span>}
              {allSigned ? (
                <span className="ml-2 text-emerald-700 font-medium">· Đã ký bộ hồ sơ</span>
              ) : complete ? (
                <span className="ml-2 text-slate-500 font-medium">· Chờ ký</span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {kinds.map(([label, kind]) => (
                <button key={kind} type="button" className={secondary} onClick={() => Promise.resolve(onOpen(r.id, kind)).catch((e) => setError(message(e)))}>{label}</button>
              ))}
              <button
                type="button"
                className={allSigned ? secondary : primary}
                disabled={busy || !complete || r.thong_tin?.draft === true}
                title={!complete ? "Thiếu một trong ba biên bản" : r.thong_tin?.draft === true ? "Hoàn thành kiểm tra và nghiệm thu trước khi xác nhận ký" : undefined}
                onClick={() => void toggleSignSet(r)}
              >
                {allSigned ? "Đặt lại cả bộ: Chờ ký" : "Đánh dấu cả bộ: Đã ký"}
              </button>
              <button type="button" className={secondary} disabled={busy || !complete} onClick={() => onPrint(r.id).catch((e) => setError(message(e)))}>In đủ bộ (1)(2)(3)</button>
            </div>
          </div>
        );
      })}
      {!records.length && (
        <p className="text-sm text-slate-600">
          Chưa có hồ sơ. Phát RFI nghiệm thu xong là bộ 3 biên bản xuất hiện tại đây để in mang đi.
        </p>
      )}
    </section>
  );
}
