"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import RowActionsMenu from "@/components/RowActionsMenu";
import GtusBbntPrintDialog from "@/components/GtusBbntPrintDialog";
import { loadProjectOptions } from "@/lib/projectsDb";
import { loadGtusCandidates, type GtusCandidate, loadRfiCandidates, loadRfiDetail, loadRfiOverview, deleteRfi, publishRfi, saveWeldPayments, setRfiChildSign, updateRfi, type RecordSet, type RfiSummary, type RfiWeld } from "@/lib/weldQualityClient";
import { rfiAcceptanceTitle, type RfiCandidate, type RfiCandidateFilter } from "@/lib/weldAcceptance";
import SplitWeldAcceptance, { type SplitKind } from "@/components/SplitWeldAcceptance";
import WeldAcceptanceDocument, { type DocKind } from "@/components/WeldAcceptanceDocument";
import WeldAcceptancePrintPack from "@/components/WeldAcceptancePrintPack";
import RfiIssuedListDocument from "@/components/RfiIssuedListDocument";
import { fieldWeldCode, parseCoordinateCode } from "@/lib/weldCode";

const input = "min-h-11 min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-2 text-base sm:text-sm";
const btn = "min-h-11 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
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
  giam_sat: string;
  tuyen_thuong: boolean;
  tuyen_ha: boolean;
  gio_bat_dau: string;
  nt_hinh_hoc: boolean;
  nt_sieu_am: boolean;
  /** "gtus" = phiếu giám sát và nghiệm thu giải toả ứng suất ray (theo tuyến, không cần chọn mối). */
  cong_viec: string;
  /** Phiếu GTUS: id và mã các thanh LWR đã chọn (cách nhau bằng dấu phẩy). */
  lwr_ids: string;
  lwr_codes: string;
};

const emptyThongTin = (): RfiThongTin => ({
  dia_diem: "", ben_moi: "", ben_nhan: "", pham_vi: "", giam_sat: "",
  // Giờ nghiệm thu gợi ý sẵn 8h00 cho mọi loại phiếu (nghiệm thu / theo dõi / cả giám sát và nghiệm thu).
  tuyen_thuong: false, tuyen_ha: false, gio_bat_dau: "08:00", nt_hinh_hoc: true, nt_sieu_am: true, cong_viec: "", lwr_ids: "", lwr_codes: "",
});

function thongTinToPayload(t: RfiThongTin): Record<string, string> {
  return {
    dia_diem: t.dia_diem,
    ben_moi: t.ben_moi,
    ben_nhan: t.ben_nhan,
    pham_vi: t.pham_vi,
    giam_sat: t.giam_sat,
    tuyen_thuong: t.tuyen_thuong ? "1" : "",
    tuyen_ha: t.tuyen_ha ? "1" : "",
    gio_bat_dau: t.gio_bat_dau,
    nt_hinh_hoc: t.nt_hinh_hoc ? "1" : "",
    nt_sieu_am: t.nt_sieu_am ? "1" : "",
    cong_viec: t.cong_viec,
    lwr_ids: t.lwr_ids,
    lwr_codes: t.lwr_codes,
  };
}

function thongTinFromStored(raw: Record<string, string> | undefined): RfiThongTin {
  const t = raw ?? {};
  return {
    dia_diem: t.dia_diem ?? "",
    ben_moi: t.ben_moi ?? "",
    ben_nhan: t.ben_nhan ?? "",
    pham_vi: t.pham_vi ?? "",
    giam_sat: t.giam_sat ?? "",
    tuyen_thuong: t.tuyen_thuong === "1" || t.tuyen_thuong === "true",
    tuyen_ha: t.tuyen_ha === "1" || t.tuyen_ha === "true",
    gio_bat_dau: t.gio_bat_dau ?? "",
    nt_hinh_hoc: t.nt_hinh_hoc == null ? true : t.nt_hinh_hoc === "1",
    nt_sieu_am: t.nt_sieu_am == null ? true : t.nt_sieu_am === "1",
    cong_viec: t.cong_viec ?? "",
    lwr_ids: t.lwr_ids ?? "",
    lwr_codes: t.lwr_codes ?? "",
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
      dia_diem: t.dia_diem, ben_moi: t.ben_moi, ben_nhan: t.ben_nhan, pham_vi: t.pham_vi, giam_sat: t.giam_sat,
      tuyen_thuong: t.tuyen_thuong, tuyen_ha: t.tuyen_ha, gio_bat_dau: t.gio_bat_dau,
      nt_hinh_hoc: t.nt_hinh_hoc, nt_sieu_am: t.nt_sieu_am, cong_viec: t.cong_viec,
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
  type Mode = "rfi" | SplitKind;
  const [mode, setMode] = useState<Mode>("rfi");
  // Modal «Duyệt siêu âm luôn?» → Có: sang tab siêu âm và mở sẵn phiếu vừa chuyển.
  const [openUltrasoundId, setOpenUltrasoundId] = useState<string | null>(null);
  const goToUltrasound = useCallback((id: string) => { setOpenUltrasoundId(id); setMode("sieu-am"); }, []);
  const clearOpenUltrasound = useCallback(() => setOpenUltrasoundId(null), []);
  const [view, setView] = useState<View>(null);
  const [editRfiId, setEditRfiId] = useState<string | null>(null);
  const [issuedList, setIssuedList] = useState<{ rfis: RfiSummary[]; unassigned: RfiCandidate[] } | null>(null);
  const [printPack, setPrintPack] = useState<RecordSet | null>(null);
  const consumeEditRfi = useCallback(() => setEditRfiId(null), []);

  useEffect(() => {
    const remembered = (() => {
      try { return window.localStorage.getItem(LS_PROJECT) || ""; } catch { return ""; }
    })();
    loadProjectOptions().then((list) => {
      setProjects(list);
      const phuQuoc = list.find((project) => project.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("phu quoc"));
      setProjectId((cur) => cur || phuQuoc?.id || (remembered && list.some((p) => p.id === remembered) ? remembered : list[0]?.id) || "");
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
  function startEditRfi(rfi: RfiSummary) {
    setView(null);
    setMode("rfi");
    setEditRfiId(rfi.id);
  }

  return (
    <div className="px-4 sm:px-6 pb-8 no-print-root">
      <div className="no-print mb-3">
        <select
          className={`${input} w-full`}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="Dự án"
        >
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {/* Thẻ kiểu sổ: tab bo góc phía trên, tab đang chọn liền khối với khung nội dung bên dưới. */}
      <div role="tablist" aria-label="Phương án nghiệm thu" className="no-print flex flex-wrap items-end gap-1 px-1">
        {([
          ["rfi", "Phát phiếu RFI"],
          ["hinh-hoc", "Nghiệm thu Hình Học"],
          ["sieu-am", "Nghiệm thu Siêu âm"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
            className={`relative cursor-pointer rounded-t-xl border-2 border-b-0 px-4 text-sm font-bold transition-colors ${mode === id
              ? "z-10 -mb-[2px] border-[#0047AB] bg-white py-3 text-[#0047AB]"
              : "border-slate-200 bg-slate-100 py-2.5 text-slate-600 hover:bg-white hover:text-slate-900"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="rounded-b-xl rounded-tr-xl border-2 border-[#0047AB] bg-white p-3 sm:p-4">
        {!projectId ? <p className="text-sm text-slate-500">Chọn dự án.</p> : (<>
        {mode !== "rfi" && (
          <div className="mb-4">
            {/* Phiếu được phát trong tab RFI; hai tab chuyên môn dùng để duyệt và xem hồ sơ. */}
            <SplitWeldAcceptance key={projectId + mode} project={projectId} projectName={projectName}
              kind={mode} stage="duyet" onPrintRecord={setPrintPack}
              onGoToUltrasound={mode === "hinh-hoc" ? goToUltrasound : undefined}
              initialTicketId={mode === "sieu-am" ? openUltrasoundId : null} onInitialTicketOpened={clearOpenUltrasound} />
          </div>
        )}
        {mode === "rfi" && (
          <div className="no-print">
            <RfiPanel
              key={projectId}
              projectId={projectId}
              projects={projects}
              onProjectChange={setProjectId}
              editRfiId={editRfiId}
              onEditConsumed={consumeEditRfi}
              onOpen={openRfi}
              onOpenIssuedList={setIssuedList}
            />
          </div>
        )}
        </>)}
      </div>
      {view && createPortal(
        <WeldAcceptanceDocument
          view={view}
          onClose={() => setView(null)}
          onEditRfi={view.kind === "rfi" ? startEditRfi : undefined}
        />,
        document.body,
      )}
      {issuedList && createPortal(
        <RfiIssuedListDocument projectName={projectName} {...issuedList} onClose={() => setIssuedList(null)} />,
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
  projects,
  onProjectChange,
}: {
  projectId: string;
  /** Danh sách dự án + đổi dự án ngay trong bộ lọc chọn mối. */
  projects?: { id: string; name: string }[];
  onProjectChange?: (id: string) => void;
  editRfiId: string | null;
  onEditConsumed: () => void;
  onOpen: (r: RfiSummary) => unknown;
  onOpenIssuedList: (list: { rfis: RfiSummary[]; unassigned: RfiCandidate[] }) => void;
}) {
  const [kind, setKind] = useState<"nghiem-thu" | "theo-doi" | "ca-hai">("nghiem-thu");
  const [gtusPrint, setGtusPrint] = useState<RfiSummary | null>(null);
  const monitoring = kind === "theo-doi";
  const [filters, setFilters] = useState<RfiCandidateFilter>({});
  const [rows, setRows] = useState<RfiCandidate[]>([]);
  const [info, setInfo] = useState<{ missing: string[]; excluded: Record<string, number>; total: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rfis, setRfis] = useState<RfiSummary[]>([]);
  const [unassigned, setUnassigned] = useState<RfiCandidate[]>([]);
  const [soPhieu, setSoPhieu] = useState("");
  const [ngayMoi, setNgayMoi] = useState(today());
  const [thongTin, setThongTin] = useState<RfiThongTin>(() => {
    const draft = loadRfiDraft(projectId);
    return { ...emptyThongTin(), ...draft };
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rfiTab, setRfiTab] = useState<"publish" | "issued">("publish");
  const [publishStep, setPublishStep] = useState<"kind" | "welds" | "details">("kind");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  // Thanh toán theo phiếu: áp cho các mối đã nghiệm thu Đạt của RFI (tỷ lệ 30/50/70/100%).
  const [payment, setPayment] = useState<{ rfi: RfiSummary; ids: string[]; rate: string; note: string } | null>(null);
  const paymentDialog = useRef<HTMLDialogElement | null>(null);
  const paymentOpen = Boolean(payment);
  useEffect(() => {
    if (paymentOpen) paymentDialog.current?.showModal();
    else paymentDialog.current?.close();
  }, [paymentOpen]);
  const requestId = useRef(crypto.randomUUID());
  const editFormRef = useRef<HTMLDivElement | null>(null);
  const publishDialogRef = useRef<HTMLDialogElement | null>(null);

  const refresh = useCallback(async (keepSoPhieu = false) => {
    const { rfis, so_phieu, candidates } = await loadRfiOverview(projectId);
    setRfis(rfis);
    setUnassigned(candidates.rows);
    if (!keepSoPhieu) setSoPhieu(so_phieu);
  }, [projectId]);

  async function toggleChildSigning(rfi: RfiSummary) {
    setBusy(true); setError("");
    try {
      await setRfiChildSign(rfi.id, rfi.child_signing?.allSigned ? "Chờ ký" : "Đã ký");
      await refresh(true);
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }

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
        setRfiTab("publish");
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
        setKind(d.rfi.thong_tin?.loai_rfi === "theo-doi" ? "theo-doi" : d.rfi.thong_tin?.loai_rfi === "ca-hai" ? "ca-hai" : "nghiem-thu");
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
      await publishRfi({
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
      await refresh();
      if (!monitoring) {
        await search();
      }
      setRfiTab("issued");
      setPublishStep("kind");
      setOkMsg(monitoring ? "Đã phát phiếu theo dõi mới." : `Đã phát phiếu yêu cầu mới (${weldCount} mối).`);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }

  function beginEdit(r: RfiSummary) {
    setBusy(true);
    setError("");
    setOkMsg("");
    loadRfiDetail(r.id)
      .then((d) => {
        setRfiTab("publish");
        setKind(d.rfi.thong_tin?.loai_rfi === "theo-doi" ? "theo-doi" : d.rfi.thong_tin?.loai_rfi === "ca-hai" ? "ca-hai" : "nghiem-thu");
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

  async function removeRfi(r: RfiSummary) {
    if (busy || !window.confirm(`Xóa phiếu ${r.so_phieu}?\n\nHồ sơ nháp liên quan sẽ bị xóa. Các mối hàn được giữ lại để phát phiếu mới. Không thể hoàn tác.`)) return;
    setBusy(true); setError(""); setOkMsg("");
    try {
      await deleteRfi(r.id);
      setRfis((current) => current.filter((item) => item.id !== r.id));
      if (editingId === r.id) {
        setEditingId(null);
        requestId.current = crypto.randomUUID();
      }
      setRows([]); setInfo(null); setSelected(new Set());
      setOkMsg(`Đã xóa phiếu ${r.so_phieu}.`);
      await refresh(editingId !== null && editingId !== r.id);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }

  const toggle = (id: string) => setSelected((cur) => {
    const n = new Set(cur);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const set = (k: keyof RfiCandidateFilter) => (e: React.ChangeEvent<HTMLInputElement>) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const gtus = monitoring && thongTin.cong_viec === "gtus";
  // Phiếu GTUS: tìm các thanh LWR đã hoàn thành (đã đưa lên track map) thay cho nhập tay tuyến / nội dung.
  const [gtusCandidates, setGtusCandidates] = useState<GtusCandidate[]>([]);
  const [gtusError, setGtusError] = useState("");
  useEffect(() => {
    if (!gtus || !projectId) return;
    let active = true;
    loadGtusCandidates(projectId).then((r) => { if (active) { setGtusCandidates(r.candidates); setGtusError(""); } })
      .catch((e) => { if (active) setGtusError(e instanceof Error ? e.message : "Không tải được danh sách thanh LWR."); });
    return () => { active = false; };
  }, [gtus, projectId]);
  const gtusSelected = new Set(thongTin.lwr_ids.split(",").filter(Boolean));
  const kmText = (m: number) => `Km${Math.floor(m / 1000)}+${(Math.round((m % 1000) * 100) / 100).toFixed(2).padStart(6, "0")}`;
  function toggleGtus(id: string, on: boolean) {
    const next = new Set(gtusSelected);
    if (on) next.add(id); else next.delete(id);
    const chosen = gtusCandidates.filter((c) => next.has(c.id));
    const from = chosen.length ? Math.min(...chosen.map((c) => c.startMetres)) : 0;
    const to = chosen.length ? Math.max(...chosen.map((c) => c.endMetres)) : 0;
    setThongTin((t) => ({
      ...t,
      lwr_ids: chosen.map((c) => c.id).join(","),
      lwr_codes: chosen.map((c) => c.code).join(", "),
      tuyen_thuong: chosen.some((c) => c.route === "thuong"),
      tuyen_ha: chosen.some((c) => c.route === "ha"),
      giam_sat: chosen.length ? `${chosen.map((c) => c.code).join(", ")} (${kmText(from)} – ${kmText(to)})` : "",
    }));
  }
  const routeMissing = gtus ? !thongTin.lwr_ids : monitoring && !thongTin.tuyen_thuong && !thongTin.tuyen_ha && !thongTin.giam_sat.trim();
  const canPublishNew = monitoring || selected.size > 0;
  const scopeMissing = !thongTin.nt_hinh_hoc && !thongTin.nt_sieu_am;
  const activeStep = editingId ? "details" : publishStep;
  const tooManyWelds = !monitoring && !editingId && selected.size > 200;
  const publishDisabled = busy || routeMissing || tooManyWelds || (!editingId && !canPublishNew) || !soPhieu.trim() || !ngayMoi;

  return (
    <section className="space-y-4">
      <div role="tablist" aria-label="Phát hành RFI" className="grid grid-cols-2 gap-2">
        {([["publish", "Phát phiếu"], ["issued", "Danh sách phiếu đã phát"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`rfi-tab-${id}`} aria-controls={`rfi-panel-${id}`}
            aria-selected={rfiTab === id} onClick={() => setRfiTab(id)} className={rfiTab === id ? primary : secondary}>
            {label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {okMsg && <p role="status" className="text-sm text-emerald-700">{okMsg}</p>}
      <dialog ref={paymentDialog} aria-labelledby="rfi-payment-title"
        onCancel={(e) => { e.preventDefault(); if (!busy) { setPayment(null); setError(""); } }}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/40">
        {payment && <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          setBusy(true); setError("");
          void saveWeldPayments(projectId, payment.ids, today(), Number(payment.rate), payment.note)
            .then((saved) => { setPayment(null); setOkMsg(`Đã lưu thanh toán ${payment.rate}% cho ${saved.count} mối Đạt của phiếu ${payment.rfi.so_phieu}.`); return refresh(); })
            .catch((err) => setError(message(err)))
            .finally(() => setBusy(false));
        }}>
          <h3 id="rfi-payment-title" className="text-lg font-bold">Thanh toán phiếu {payment.rfi.so_phieu}</h3>
          <p className="text-sm text-slate-600">Áp dụng cho {payment.ids.length} mối đã nghiệm thu Đạt của phiếu; thay thế thông tin thanh toán đã lưu của các mối đó.</p>
          <label className="grid gap-1 text-sm">Phần trăm
            <select className={input} required disabled={busy} value={payment.rate} onChange={(e) => setPayment({ ...payment, rate: e.target.value })}>
              <option value="">Chọn tỷ lệ</option>
              {[30, 50, 70, 100].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">Ghi chú
            <textarea className={input} rows={3} maxLength={500} disabled={busy} value={payment.note} onChange={(e) => setPayment({ ...payment, note: e.target.value })} />
          </label>
          {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={secondary} disabled={busy} onClick={() => { setPayment(null); setError(""); }}>Hủy</button>
            <button type="submit" className={primary} disabled={busy || !payment.rate}>Lưu thanh toán</button>
          </div>
        </form>}
      </dialog>
      <div role="tabpanel" id="rfi-panel-publish" aria-labelledby="rfi-tab-publish" hidden={rfiTab !== "publish"} className="space-y-4">
      <div className="rounded-xl border border-[#0047AB]/25 bg-[#0047AB]/5 p-4">
        <h2 className="text-sm font-bold text-slate-900">Phát phiếu yêu cầu nghiệm thu mới</h2>
        <p className="mt-1 text-xs text-slate-600">
          {editingId
            ? `Đang sửa phiếu đã phát · ${soPhieu}. Thông tin in có thể đổi; danh sách mối giữ nguyên.`
            : "Làm lần lượt: (1) chọn loại phiếu → (2) tìm & chọn mối → (3) điền số phiếu / ngày / địa điểm → (4) bấm Phát phiếu yêu cầu mới."}
        </p>
      </div>

      <div role="tablist" aria-label="Các bước phát phiếu RFI" className="grid grid-cols-3 gap-2">
        {([["kind", "1. Loại phiếu"], ["welds", "2. Chọn mối"], ["details", "3. Thông tin phiếu"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`rfi-step-${id}`} aria-controls={`rfi-step-panel-${id}`}
            aria-selected={activeStep === id} disabled={busy || (Boolean(editingId) && id !== "details") || (monitoring && id === "welds")}
            onClick={() => setPublishStep(id)}
            className={`${activeStep === id ? primary : secondary} h-auto min-h-10 px-2 py-2 text-center text-xs leading-tight`}>
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="rfi-step-panel-kind" aria-labelledby="rfi-step-kind" hidden={activeStep !== "kind"} className="space-y-3">
      <div role="group" aria-label="Loại phiếu" className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !!editingId} aria-pressed={kind === "nghiem-thu"} onClick={() => { setKind("nghiem-thu"); setThongTin((t) => ({ ...t, cong_viec: "" })); }} className={kind === "nghiem-thu" ? primary : secondary}>1. Phiếu yêu cầu nghiệm thu</button>
        <button type="button" disabled={busy || !!editingId} aria-pressed={monitoring && thongTin.cong_viec !== "gtus"} onClick={() => { setKind("theo-doi"); setThongTin((t) => ({ ...t, cong_viec: "" })); }} className={monitoring && thongTin.cong_viec !== "gtus" ? primary : secondary}>2. Phiếu theo dõi công việc hàn</button>
        <button type="button" disabled={busy || !!editingId} aria-pressed={kind === "ca-hai"} onClick={() => { setKind("ca-hai"); setThongTin((t) => ({ ...t, cong_viec: "" })); }} className={kind === "ca-hai" ? primary : secondary}>Cả giám sát và nghiệm thu</button>
        <button type="button" disabled={busy || !!editingId} aria-pressed={monitoring && thongTin.cong_viec === "gtus"} onClick={() => { setKind("theo-doi"); setThongTin((t) => ({ ...t, cong_viec: "gtus" })); }} className={monitoring && thongTin.cong_viec === "gtus" ? primary : secondary}>3. Giải toả ứng suất (GTUS)</button>
      </div>
      {monitoring && <p className="text-sm text-slate-600">{thongTin.cong_viec === "gtus" ? "Phiếu giám sát và nghiệm thu giải toả ứng suất: chọn các thanh ray màu xám trên track map ở bước Thông tin phiếu; tuyến và lý trình tự lấy đúng theo từng thanh đã chọn." : "Phiếu theo dõi có thể phát ngay mà không cần chọn mối."}</p>}
      <button type="button" className={secondary} disabled={busy} onClick={() => setPublishStep(monitoring ? "details" : "welds")}>Tiếp tục</button>
      </div>
      <dialog ref={publishDialogRef} aria-labelledby="rfi-publish-title" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border-0 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/40">
        <form method="dialog" className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          if (publishDisabled || scopeMissing) return;
          publishDialogRef.current?.close();
          void publish();
        }}>
          <h3 id="rfi-publish-title" className="text-base font-bold">Nội dung nghiệm thu</h3>
          <p className="text-sm text-slate-700">Phiếu <b>{soPhieu}</b> · {selected.size} mối</p>
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-2 text-slate-600">Chọn một hoặc cả hai nội dung</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={thongTin.nt_hinh_hoc} onChange={(e) => setThongTin({ ...thongTin, nt_hinh_hoc: e.target.checked })} />
              Hình học, trực quan
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={thongTin.nt_sieu_am} onChange={(e) => setThongTin({ ...thongTin, nt_sieu_am: e.target.checked })} />
              Siêu âm
            </label>
          </fieldset>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondary} onClick={() => publishDialogRef.current?.close()}>Hủy</button>
            <button type="submit" className={primary} disabled={publishDisabled || scopeMissing}>Phát yêu cầu mới</button>
          </div>
        </form>
      </dialog>
      <div role="tabpanel" id="rfi-step-panel-welds" aria-labelledby="rfi-step-welds" hidden={activeStep !== "welds"} className="space-y-3">
      {!monitoring && !editingId && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <h3 className="text-xs font-bold text-slate-500">Tìm các mối đủ điều kiện Hình học và Siêu âm</h3>
          <p className="text-xs text-slate-600">Chọn mối rồi bấm phát để chọn Hình học, Siêu âm hoặc cả hai.</p>
          {tooManyWelds && <p role="alert" className="text-sm text-amber-800">Chọn tối đa 200 mối cho một phiếu để có thể duyệt đầy đủ.</p>}
          <div className="flex flex-wrap items-end gap-2">
            <select aria-label="Lọc theo dự án" title="Lọc theo dự án" className={`${input} min-w-52`} value={projectId} onChange={(e) => onProjectChange?.(e.target.value)} disabled={!onProjectChange || busy}>
              {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
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
                      <td className="p-2" title={r.ma_lich_su}>{fieldWeldCode(r.ma_lich_su)}</td><td className="p-2">{r.ngay_thuc_hien ?? "—"}</td><td className="p-2">{r.ly_trinh ?? "—"}</td><td className="p-2">{r.tinh_trang}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
      <button type="button" className={secondary} disabled={busy || !selected.size || tooManyWelds} onClick={() => setPublishStep("details")}>
        Tiếp tục · {selected.size} mối đã chọn
      </button>
      </div>

      <div role="tabpanel" id="rfi-step-panel-details" aria-labelledby="rfi-step-details" hidden={activeStep !== "details"} className="space-y-3">
      {gtus && !editingId && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Chọn thanh ray màu xám trên track map (đã rải, chưa giải toả)</h3>
          {gtusError && <p role="alert" className="text-xs text-red-700">{gtusError}</p>}
          {!gtusError && gtusCandidates.length === 0 && <p className="text-xs text-slate-600">Chưa có thanh ray xám nào trên track map của dự án này. Rải thanh ray lên track map rồi quay lại.</p>}
          {("thuong,ha".split(",") as ("thuong" | "ha")[]).map((route) => {
            const list = gtusCandidates.filter((c) => c.route === route);
            if (!list.length) return null;
            return (
              <fieldset key={route} className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <legend className="px-1 text-xs font-semibold text-slate-700">{route === "ha" ? "Tuyến hạ" : "Tuyến thượng"}</legend>
                {list.map((c) => (
                  <label key={c.id} className={`flex min-h-9 items-center gap-2 text-sm ${c.used ? "opacity-50" : "cursor-pointer"}`}>
                    <input type="checkbox" disabled={Boolean(c.used)} checked={gtusSelected.has(c.id)} onChange={(e) => toggleGtus(c.id, e.target.checked)} />
                    <span className="font-mono font-semibold">{c.code}</span>
                    <span>{c.rail === "trai" ? "Ray trái" : "Ray phải"}{c.lwr ? ` · LWR ${c.lwr}` : ""} · {kmText(c.startMetres)} – {kmText(c.endMetres)} · {(Math.round((c.endMetres - c.startMetres) * 100) / 100).toLocaleString("vi-VN")} m</span>
                    {c.used ? <span className="text-xs text-amber-800">đã có phiếu {c.used}</span> : null}
                  </label>
                ))}
              </fieldset>
            );
          })}
          {thongTin.lwr_codes && <p className="text-xs text-slate-700">Đã chọn: <b>{thongTin.lwr_codes}</b> → {thongTin.giam_sat}</p>}
        </div>
      )}
      {monitoring && !gtus && !editingId && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3">
          <input className={input} placeholder="Từ mối" value={filters.nameFrom ?? ""} onChange={set("nameFrom")} />
          <input className={input} placeholder="Đến mối" value={filters.nameTo ?? ""} onChange={set("nameTo")} />
          <input className={`${input} w-28`} placeholder="Từ Km0+000" value={filters.kmFrom ?? ""} onChange={set("kmFrom")} />
          <input className={`${input} w-28`} placeholder="Đến Km2+000" value={filters.kmTo ?? ""} onChange={set("kmTo")} />
        </div>
      )}


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
          {!gtus && <fieldset className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 text-xs font-semibold text-slate-700 ${routeMissing ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
            <legend className="px-1">Tuyến {monitoring ? "(bắt buộc)" : ""}</legend>
            <label className="inline-flex min-h-11 items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={thongTin.tuyen_thuong} onChange={(e) => setThongTin({ ...thongTin, tuyen_thuong: e.target.checked })} />
              Tuyến thượng
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={thongTin.tuyen_ha} onChange={(e) => setThongTin({ ...thongTin, tuyen_ha: e.target.checked })} />
              Tuyến hạ
            </label>
          </fieldset>}
          <button
            type="button"
            className={primary}
            disabled={publishDisabled}
            title={!editingId && !monitoring && !selected.size ? "Cần tìm và chọn ít nhất 1 mối trước khi phát phiếu mới" : undefined}
            onClick={() => {
              if (editingId || monitoring) void publish();
              else publishDialogRef.current?.showModal();
            }}
          >
            {editingId
              ? "Lưu sửa phiếu"
              : monitoring
                ? "Phát phiếu theo dõi mới"
                : `Phát phiếu yêu cầu mới (${selected.size} mối)`}
          </button>
          {editingId ? <button type="button" className={secondary} disabled={busy} onClick={cancelEdit}>Hủy sửa — phát phiếu mới</button> : null}
        </div>
        {routeMissing && <p className="text-xs text-amber-800">{gtus ? "Chọn ít nhất một thanh ray xám trước khi phát phiếu giải toả ứng suất." : "Chọn tuyến hoặc nhập nội dung giám sát trước khi phát phiếu theo dõi."}</p>}
        {!editingId && !monitoring && !selected.size && (
          <p className="text-xs text-amber-800">Mở tab <b>2. Chọn mối</b> để tìm và chọn các mối trước khi phát phiếu.</p>
        )}
      </div>

      </div>
      </div>
      <div role="tabpanel" id="rfi-panel-issued" aria-labelledby="rfi-tab-issued" hidden={rfiTab !== "issued"} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <h3 className="text-sm font-bold">Danh sách phiếu yêu cầu nghiệm thu đã phát</h3>
        <button
          type="button"
          className={secondary}
          disabled={!rfis.length && !unassigned.length}
          onClick={() => onOpenIssuedList({ rfis, unassigned })}
          title="Xem và in danh sách toàn bộ phiếu đã phát theo dự án"
        >
          Xem / In danh sách
        </button>
      </div>
      {unassigned.length > 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Có <b>{unassigned.length} mối sẵn sàng chưa có RFI</b>. Mở “Xem / In danh sách” để đối soát mã mối và KM, hoặc sang tab “Phát phiếu” để chọn mối.
      </p>}
      <div className="overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs sm:text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 w-10 text-left">STT</th>
              <th className="p-2 text-left">Số phiếu</th>
              <th className="p-2 text-left">Ngày phát</th>
              <th className="p-2 text-left">Loại</th>
              <th className="p-2 text-left">Mối trong RFI</th>
              <th className="p-2 text-left">Nghiệm thu đạt / chờ ký / đã ký</th>
              <th className="p-2 text-left">Chưa NT / Không đạt</th>
              <th className="p-2 text-left">KM nghiệm thu đạt</th>
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
                <td className="p-2">{r.thong_tin?.loai_rfi === "theo-doi" ? (r.thong_tin?.cong_viec === "gtus" ? "Giải toả ứng suất" : "Theo dõi") : rfiAcceptanceTitle(r.thong_tin)}</td>
                <td className="p-2">{r.thong_tin?.loai_rfi === "theo-doi" ? "—" : r.tong_moi}</td>
                <td className="p-2">{r.thong_tin?.loai_rfi === "theo-doi" ? "—" : `${r.tracking?.da_nghiem_thu ?? 0} / ${r.tracking?.cho_ky ?? 0} / ${r.tracking?.da_ky ?? 0}`}</td>
                <td className="p-2">{r.thong_tin?.loai_rfi === "theo-doi" ? "—" : `${r.tracking?.chua_nghiem_thu ?? r.con_lai} / ${r.tracking?.khong_dat ?? 0}`}</td>
                <td className="p-2 min-w-48">{r.tracking?.km_nghiem_thu ?? "—"}{!!r.tracking?.thieu_ly_trinh && <p className="text-amber-800">{r.tracking.thieu_ly_trinh} mối thiếu KM</p>}</td>
                <td className="p-2">{r.child_signing?.status ?? r.trang_thai}</td>
                <td className="whitespace-nowrap p-2 text-right">
                  <RowActionsMenu
                    label={`Thao tác phiếu ${r.so_phieu}`}
                    actions={[
                      { label: "Sửa", disabled: busy, onSelect: () => beginEdit(r) },
                      ...(r.thong_tin?.cong_viec === "gtus" && r.thong_tin?.lwr_ids ? [{ label: "In BBNT - GTUS", onSelect: () => setGtusPrint(r) }] : []),
                      { label: "Xem / In", onSelect: () => { void Promise.resolve(onOpen(r)).catch((e) => setError(message(e))); } },
                      ...(r.child_signing ? [{
                        label: r.child_signing.allSigned ? "Đặt lại cả bộ: Chờ ký" : "Đánh dấu cả bộ: Đã ký",
                        disabled: busy || !r.child_signing.canSign, onSelect: () => void toggleChildSigning(r),
                      }] : []),
                      (() => {
                        const paidIds = (r.tracking?.moi ?? []).filter((m) => m.ket_qua === "Đạt").map((m) => m.moi_han_id);
                        return {
                          label: paidIds.length ? "Thanh toán" : "Thanh toán (sau khi nghiệm thu)",
                          disabled: busy || !paidIds.length,
                          onSelect: () => { setError(""); setOkMsg(""); setPayment({ rfi: r, ids: paidIds, rate: "", note: "" }); },
                        };
                      })(),
                      { label: "Xóa", danger: true, disabled: busy, onSelect: () => removeRfi(r) },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {!rfis.length && (
              <tr><td colSpan={10} className="p-3 text-slate-500">Chưa có phiếu. Mở tab “Phát phiếu” để tạo phiếu mới.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
      {gtusPrint && (
        <GtusBbntPrintDialog
          projectId={projectId}
          projectName={projects?.find((p) => p.id === projectId)?.name ?? ""}
          cellIds={String(gtusPrint.thong_tin?.lwr_ids ?? "").split(",").filter(Boolean)}
          onClose={() => setGtusPrint(null)}
        />
      )}
    </section>
  );
}
