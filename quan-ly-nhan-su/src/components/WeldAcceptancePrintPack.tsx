"use client";

import { useEffect, useState } from "react";
import { isTouchDevice, printOrPdfAcceptance } from "@/lib/pdfExport";
import { reloadRecordSet, reviseRecord, notifyWeldQualityChanged, loadBbntPrintSeq, advanceBbntPrintSeq, type RecordSet } from "@/lib/weldQualityClient";
import WeldAcceptanceRecordPages, { ACCEPTANCE_DOCS, acceptancePrintCss, skippedWeldIds, onlySkippedWelds, type RecordKind } from "@/components/WeldAcceptanceRecordPages";
import { fieldWeldCode } from "@/lib/weldCode";
import { ACCEPTANCE_TECHNICIAN, SIGNER_PARTIES, BBNTCV_SIGNER_KEYS, DEFAULT_SIGNERS, loadSignerDefaults, saveSignerDefaults, defaultAcceptancePrintKinds, advanceBbntcvSeq, nextBbntcvSeq } from "@/lib/weldAcceptance";
import { loadPersonnelPickerRows } from "@/lib/personnelCertificatesDb";
import { loadJournalMachineOptions } from "@/lib/machineRunSchedulesDb";
import ComboInput from "@/components/ComboInput";

/** Các mục thông tin trên mẫu dùng chung cho cả bộ — sửa một lần, áp dụng cho 3 biên bản. */
const SHARED_KEYS = ["dia_diem", "ben_moi", "ben_nhan", "pham_vi", "ngay_nghiem_thu", "gio_bat_dau", "gio_ket_thuc", "ca_han", "bien_phap", "tuyen", "goong", "ten_tho_han", "id_tho_han", "may_han", "kmFrom", "kmTo", "so_bb",
  ...SIGNER_PARTIES.flatMap(([party]) => [`nguoi_${party}_1_ten`, `nguoi_${party}_1_cv`, `ngay_ky_${party}`]),
  ...BBNTCV_SIGNER_KEYS];
const PRINT_DOC_LABELS: Record<RecordKind, string> = {
  "phu-luc": "(1) Phụ lục",
  "giai-doan": "(2) BBNTCV",
  "hoan-thanh": "(3) Hoàn thành",
};
const projectIdOf = (row: RecordSet) => String((row.dot.phieu_yeu_cau_nghiem_thu.du_an as { id?: string } | undefined)?.id ?? "");
const input = "mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal";
const label = "block text-xs font-semibold text-slate-700";

export default function WeldAcceptancePrintPack({ record: initial, onClose: closeNow, autoPrint = false }: {
  record: RecordSet; onClose: () => void; autoPrint?: boolean;
}) {
  // Sửa trực tiếp trên bản xem trước: các ô đã gõ nằm trong `draft` cho tới khi bấm «Lưu chỉnh sửa» (áp dụng cho cả bộ 3 biên bản).
  const [draft, setDraft] = useState<Record<string, string>>({});
  const draftCount = Object.keys(draft).length;
  // Biên bản RIÊNG cho mối treo (gộp nhiều phiếu): chỉ để in, mọi chỉnh sửa giữ trên màn hình này, không ghi vào phiếu nào.
  const local = (initial.dot.thong_tin as Record<string, unknown> | undefined)?.rieng_moi_treo === "1";
  const onClose = () => {
    if (!local && draftCount > 0 && !window.confirm(`Còn ${draftCount} chỉnh sửa chưa lưu. Đóng và bỏ các chỉnh sửa này?`)) return;
    closeNow();
  };
  // Tải lại / đóng tab khi còn chỉnh sửa chưa lưu → trình duyệt hỏi lại.
  useEffect(() => {
    if (!draftCount || local) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftCount, local]);
  const [record, setRecord] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [people, setPeople] = useState<{ name: string; code: string }[]>([]);
  const [machines, setMachines] = useState<string[]>([]);
  // HH mặc định 1 tờ (Phụ lục); SA mặc định 2 tờ (Phụ lục + BBNTCV); tờ 3 vẫn tick được khi cần.
  const [printKinds, setPrintKinds] = useState<RecordKind[]>(() =>
    defaultAcceptancePrintKinds((initial.dot.phieu_yeu_cau_nghiem_thu?.thong_tin ?? {}) as Record<string, unknown>),
  );
  const projectId = projectIdOf(record);
  const [bbSeq, setBbSeq] = useState(() => nextBbntcvSeq(projectIdOf(initial)));
  useEffect(() => {
    if (!projectId) return;
    let live = true;
    const local = nextBbntcvSeq(projectId);
    loadBbntPrintSeq(projectId).then(async (remote) => {
      if (!live || remote.so_tiep < 1) return;
      if (local > remote.so_tiep) {
        const bumped = await advanceBbntPrintSeq(projectId, local - 1);
        if (live && bumped.so_tiep >= 1) setBbSeq(bumped.so_tiep);
        return;
      }
      setBbSeq(remote.so_tiep);
    }).catch(() => {});
    return () => { live = false; };
  }, [projectId]);
  const missing = ACCEPTANCE_DOCS.filter((d) => !record.ho_so.some((h) => h.loai === d.loai));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !editing) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editing]);
  useEffect(() => {
    if (!autoPrint || missing.length || !printKinds.length) return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint, missing.length, printKinds.length]);
  useEffect(() => {
    if (!editing) return;
    let live = true;
    void Promise.all([loadPersonnelPickerRows().catch(() => []), loadJournalMachineOptions().catch(() => [])]).then(([p, m]) => {
      if (!live) return;
      setPeople(p.filter((x) => (x.trang_thai || "Hoạt động") !== "Khóa").map((x) => ({ name: x.ho_ten, code: x.ma_nhan_su ?? "" })));
      setMachines([...new Set(m.map((x) => x.name?.trim() || x.code).filter(Boolean))]);
    });
    return () => { live = false; };
  }, [editing]);

  const latestOf = (hoSoId: string) => (record.sua_doi ?? []).filter((r) => r.ho_so_id === hoSoId).sort((a, b) => a.phien_ban - b.phien_ban).at(-1);

  function togglePrintKind(kind: RecordKind) {
    setPrintKinds((cur) => cur.includes(kind) ? cur.filter((k) => k !== kind) : [...cur, kind]);
  }

  function openEditor() {
    // Giá trị hiện hành: bản sửa mới nhất của biên bản đầu tiên có giá trị, rồi tới dữ liệu đợt.
    const rfiInfoForm = (record.dot.phieu_yeu_cau_nghiem_thu?.thong_tin ?? {}) as Record<string, string>;
    const dot = { ...rfiInfoForm, ...((record.dot.thong_tin ?? {}) as Record<string, string>) };
    const infos = record.ho_so.map((h) => (latestOf(h.id)?.thong_tin ?? {}) as Record<string, string>);
    const defaults = loadSignerDefaults();
    setForm(Object.fromEntries(SHARED_KEYS.map((k) => {
      const saved = infos.map((i) => i[k]).find(Boolean) ?? dot[k];
      // Địa điểm cũ nhập «Lý trình …» đã có ở mục Vị trí nên không nạp lại vào ô này.
      if (saved && !(k === "dia_diem" && /^s*lý trình/i.test(String(saved)))) return [k, String(saved)];
      if (k === "ngay_nghiem_thu") return [k, String(record.dot.ngay_nghiem_thu ?? "").slice(0, 10)];
      if (k === "gio_bat_dau") return [k, "08:00"];
      if (k === "gio_ket_thuc") return [k, "17:00"];
      return [k, String(defaults[k] || DEFAULT_SIGNERS[k] || "")];
    })));
    setError("");
    setEditing(true);
  }

  async function save() {
    if (local) { setEditing(false); return; } // biên bản riêng: giữ chỉnh sửa trên màn hình để in
    setBusy(true); setError("");
    try {
      saveSignerDefaults(formView);
      for (const hoSo of record.ho_so) {
        const current = (latestOf(hoSo.id)?.thong_tin ?? {}) as Record<string, string>;
        await reviseRecord(hoSo.id, { ...current, ...formView }, "Sửa thông tin in cả bộ hồ sơ");
      }
      setRecord(await reloadRecordSet(record));
      setDraft({});
      setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được."); } finally { setBusy(false); }
  }

  async function saveDraft() {
    setBusy(true); setError("");
    try {
      saveSignerDefaults(draft);
      for (const hoSo of record.ho_so) {
        const current = (latestOf(hoSo.id)?.thong_tin ?? {}) as Record<string, string>;
        await reviseRecord(hoSo.id, { ...current, ...draft }, "Sửa trực tiếp trên bản xem trước");
      }
      setRecord(await reloadRecordSet(record));
      setDraft({});
      notifyWeldQualityChanged(); // danh sách mối treo tự cập nhật
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được."); } finally { setBusy(false); }
  }

  // Mối gạt khỏi bộ biên bản (TVGS chưa ký…): chỉ ảnh hưởng bản in, lưu cùng «Lưu chỉnh sửa»; mối vẫn nằm trong đợt để gom lập biên bản riêng sau.
  const skipped = skippedWeldIds(record, draft);
  const onlySkipped = onlySkippedWelds(record, draft);
  const toggleSkip = (id: string) => {
    const next = new Set(skipped);
    if (!next.delete(id)) next.add(id);
    setDraft((cur) => ({ ...cur, bo_moi: [...next].join(",") }));
  };
  const weldCode = (m: RecordSet["moi"][number]) => fieldWeldCode(String(m.du_lieu_chot.moi_han?.ma_lich_su ?? ""), m.du_lieu_chot.moi_han?.ma_hien_truong as string | null | undefined) || m.moi_han_id.slice(0, 8);

  // Giá trị đang hiển thị trong form = bản chụp lúc mở form, bị đè bởi mọi chỉnh sửa chưa lưu (cả ở form lẫn gõ trực tiếp trên mẫu).
  const formView: Record<string, string> = { ...form, ...draft };
  const set = (key: string, value: string) => setDraft((cur) => ({ ...cur, [key]: value }));
  const printPack = () => {
    const printed = document.querySelector<HTMLElement>("[data-bb-no]")?.getAttribute("data-bb-no") ?? "";
    void printOrPdfAcceptance("Bo-bien-ban-nghiem-thu");
    if (!printKinds.includes("giai-doan") || !printed) return;
    const matched = /\/(\d+)\/BBNTCV/i.exec(printed.trim()) ?? /(\d+)\s*$/.exec(printed.trim());
    const n = matched ? Number(matched[1]) : 0;
    setDraft((cur) => {
      if (!("so_bb" in cur)) return { ...cur };
      const next = { ...cur };
      delete next.so_bb;
      return next;
    });
    if (!projectId || !Number.isInteger(n) || n < 1) return;
    void advanceBbntPrintSeq(projectId, n).then((remote) => {
      if (remote.so_tiep >= 1) { setBbSeq(remote.so_tiep); return; }
      advanceBbntcvSeq(printed, projectId);
      setBbSeq(nextBbntcvSeq(projectId));
    }).catch(() => {
      advanceBbntcvSeq(printed, projectId);
      setBbSeq(nextBbntcvSeq(projectId));
    });
  };
  const text = (key: string, text: string, placeholder = "", listId?: string) => (
    <label className={label}>{text}
      <input className={input} list={listId} placeholder={placeholder} value={formView[key] ?? ""} onChange={(e) => set(key, e.target.value)} />
    </label>
  );

  // Ẩn / hiện cột «Lý trình mối hàn» của phụ lục: bản nháp > bản sửa đổi mới nhất > dữ liệu phiếu.
  const lyTrinhHidden = (draft.an_ly_trinh
    ?? [...(record.sua_doi ?? [])].sort((a, b) => b.phien_ban - a.phien_ban).map((r) => (r.thong_tin as Record<string, string> | null)?.an_ly_trinh).find((v) => v !== undefined)
    ?? (record.dot.thong_tin as Record<string, string> | null)?.an_ly_trinh) !== "0"; // mặc định ẩn cột lý trình; tick «Cột lý trình» mới hiện

  return <div className="acceptance-print-root fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="In bộ biên bản nghiệm thu">
    <style>{acceptancePrintCss}</style>
    <div className="weld-print-pack-actions mx-auto mb-3 flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <div className="min-w-[16rem] flex-1 space-y-1.5">
        <p className="text-sm">Xuất tờ: chọn trước khi in (mặc định theo HH / SA).</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Chọn tờ in">
          {ACCEPTANCE_DOCS.map((d) => (
            <label key={d.kind} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold">
              <input type="checkbox" checked={printKinds.includes(d.kind)} onChange={() => togglePrintKind(d.kind)} />
              {PRINT_DOC_LABELS[d.kind]}
            </label>
          ))}
        </div>
        {missing.length > 0 && <p role="alert" className="text-sm text-amber-800">Thiếu {missing.length} biên bản. Hãy tải lại hồ sơ.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold" title="Ẩn / hiện cột Lý trình mối hàn trên phụ lục">
          <input type="checkbox" checked={!lyTrinhHidden} onChange={(e) => setDraft((cur) => ({ ...cur, an_ly_trinh: e.target.checked ? "0" : "1" }))} />
          Cột lý trình
        </label>
        {!local && <button type="button" onClick={() => setSkipOpen((v) => !v)} title="Gạt mối chưa được TVGS ký ra khỏi bộ biên bản đang in"
          className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${skipped.size ? "border-amber-400 bg-amber-50 text-amber-900" : "border-slate-300 bg-white"}`}>
          Bỏ mối khỏi biên bản{skipped.size ? ` (${skipped.size})` : ""}
        </button>}
        {draftCount > 0 && !local && <button type="button" disabled={busy} onClick={() => void saveDraft()} className="min-h-11 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white disabled:opacity-50">Lưu chỉnh sửa ({draftCount})</button>}
        <button type="button" disabled={missing.length > 0} onClick={() => (editing ? setEditing(false) : openEditor())} className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold disabled:opacity-50">{editing ? "Đóng sửa" : "Sửa thông tin in"}</button>
        <button type="button" disabled={missing.length > 0 || !printKinds.length || busy} onClick={printPack} className="min-h-11 rounded-lg bg-[#0047AB] px-5 text-sm font-semibold text-white disabled:opacity-50">In / Lưu PDF</button>
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold">Thoát</button>
      </div>
    </div>
    {local && (
      <p role="status" className="weld-print-pack-actions mx-auto mb-2 max-w-4xl rounded-lg bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-900">BIÊN BẢN RIÊNG cho {record.moi.length} mối treo (gộp từ nhiều phiếu). Chỉ dùng để in: chỉnh sửa trên mẫu không ghi vào phiếu nào. Ký xong, quay lại «Hồ sơ nghiệm thu» bấm «Đã lập biên bản riêng».</p>
    )}
    {skipOpen && !local && (
      <div className="weld-print-pack-actions mx-auto mb-3 max-w-4xl space-y-2 rounded-xl bg-white p-4 text-sm shadow-lg">
        <p className="text-xs text-slate-600">Tick mối cần <b>bỏ khỏi bộ biên bản</b> (VD TVGS chưa ký vì lý do kỹ thuật). Phụ lục, BBNTCV, biên bản hoàn thành tự tính lại STT, Km đầu–cuối, tên mối. Nhớ bấm «Lưu chỉnh sửa» để lưu lựa chọn.</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <button type="button" className="rounded border border-slate-300 px-2 py-1 font-semibold" onClick={() => setDraft((cur) => ({ ...cur, bo_moi: "" }))}>Bỏ chọn hết</button>
          <button type="button" className="rounded border border-slate-300 px-2 py-1 font-semibold"
            onClick={() => setDraft((cur) => ({ ...cur, bo_moi: record.moi.filter((m) => m.ket_qua !== "Đạt").map((m) => m.moi_han_id).join(",") }))}>Chọn mối chưa Đạt</button>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={onlySkipped} disabled={!skipped.size} onChange={(e) => setDraft((cur) => ({ ...cur, bo_moi_rieng: e.target.checked ? "1" : "0" }))} />
          In riêng các mối đã bỏ (biên bản cho mối treo, dùng khi TVGS đã đồng ý ký)
        </label>
        <div className="grid max-h-64 gap-1 overflow-auto sm:grid-cols-2">
          {[...record.moi].sort((a, b) => weldCode(a).localeCompare(weldCode(b), "vi", { numeric: true })).map((m) => (
            <label key={m.moi_han_id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 ${skipped.has(m.moi_han_id) ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}>
              <input type="checkbox" checked={skipped.has(m.moi_han_id)} onChange={() => toggleSkip(m.moi_han_id)} />
              <span className="font-semibold">{weldCode(m)}</span>
              <span className="text-slate-500">{String(m.du_lieu_chot.moi_han?.ly_trinh ?? "")}</span>
              <span className="ml-auto text-xs text-slate-500">{m.ket_qua}</span>
            </label>
          ))}
        </div>
      </div>
    )}
    {skipped.size > 0 && (
      <p role="status" className="weld-print-pack-actions mx-auto mb-2 max-w-4xl rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">
        {onlySkipped ? `Đang in RIÊNG ${skipped.size} mối đã bỏ` : `Đã bỏ ${skipped.size} mối khỏi bản in`}: {record.moi.filter((m) => skipped.has(m.moi_han_id)).map(weldCode).join(", ")}.
      </p>
    )}
    {editing && (
      <div className="weld-print-pack-actions mx-auto mb-3 max-w-4xl space-y-3 rounded-xl bg-white p-4 text-sm shadow-lg">
        <p className="text-xs text-slate-600">Sửa một lần, áp dụng cho cả 3 biên bản trong bộ. Để trống thì mẫu tự lấy theo dữ liệu mối hàn / Nhật ký hàn. Số đo và danh sách mối đã chốt không thay đổi.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {text("dia_diem", "Địa điểm", "Phú Quốc - An Giang")}
          {text("pham_vi", "Phạm vi")}
          {text("ben_moi", "Bên mời (nhà thầu)")}
          {text("ben_nhan", "Bên nhận (TVGS/CĐT)")}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className={label}>Ngày nghiệm thu
            <input type="date" className={input} value={formView.ngay_nghiem_thu ?? ""} onChange={(e) => set("ngay_nghiem_thu", e.target.value)} />
          </label>
          <label className={label}>Giờ bắt đầu
            <input type="time" className={input} value={(formView.gio_bat_dau || "08:00").slice(0, 5)} onChange={(e) => set("gio_bat_dau", e.target.value)} />
          </label>
          <label className={label}>Giờ kết thúc
            <input type="time" className={input} value={(formView.gio_ket_thuc || "17:00").slice(0, 5)} onChange={(e) => set("gio_ket_thuc", e.target.value)} />
          </label>
          <label className={label}>Ca hàn
            <select className={input} value={formView.ca_han ?? ""} onChange={(e) => set("ca_han", e.target.value)}>
              <option value="">Tự động theo nhật ký</option><option value="ngay">Ngày</option><option value="dem">Đêm</option><option value="ngay-dem">Ngày và đêm</option>
            </select>
          </label>
          <label className={label}>Biện pháp hàn
            <select className={input} value={formView.bien_phap ?? ""} onChange={(e) => set("bien_phap", e.target.value)}>
              <option value="">Tự động theo máy</option><option value="co-dinh">Hàn cố định</option><option value="di-dong">Hàn di động</option>
            </select>
          </label>
          <label className={label}>Tuyến
            <select className={input} value={formView.tuyen ?? ""} onChange={(e) => set("tuyen", e.target.value)}>
              <option value="">Tự động theo mã mối hàn</option><option value="thuong">Tuyến thượng</option><option value="ha">Tuyến hạ</option><option value="ca-hai">Tuyến thượng và tuyến hạ</option>
            </select>
          </label>
          {text("goong", "Goòng phẳng", "KPS25-L8")}
          {text("so_bb", "Số biên bản", "Để trống = tự tăng FBW/01, FBW/02…")}
          <label className={label}>Tên thợ hàn (chọn từ Nhân sự hoặc nhập)
            <ComboInput className={input} value={formView.ten_tho_han ?? ""} options={people.map((p) => ({ value: p.name, hint: p.code }))}
              onChange={(name, match) => setDraft((cur) => ({ ...cur, ten_tho_han: name, ...(match?.hint ? { id_tho_han: match.hint } : {}) }))} />
          </label>
          {text("id_tho_han", "ID thợ hàn")}
          <label className={label}>Máy hàn (chọn hoặc nhập)
            <ComboInput className={input} value={formView.may_han ?? ""} options={machines.map((m) => ({ value: m }))} onChange={(v) => set("may_han", v)} />
          </label>
          {text("kmFrom", "Vị trí: Km đầu", "3+862.74")}
          {text("kmTo", "Vị trí: Km cuối", "4+087.42")}
        </div>
        <p className="text-xs font-semibold text-slate-700">Khung chữ ký Phụ lục <span className="font-normal text-slate-500">— để trống ngày = lấy ngày nghiệm thu; người ký được nhớ cho lần in sau.</span></p>
        <div className="grid gap-2 sm:grid-cols-3">
          {SIGNER_PARTIES.map(([party, name]) => (
            <div key={party} className="space-y-1 rounded-lg border border-slate-200 p-2">
              <p className="text-xs font-semibold text-slate-600">{name}</p>
              <input aria-label={`${name}: họ và tên`} className={input} placeholder="Họ và tên" readOnly={party === "ntc"} value={party === "ntc" ? ACCEPTANCE_TECHNICIAN.ten : formView[`nguoi_${party}_1_ten`] ?? ""} onChange={(e) => set(`nguoi_${party}_1_ten`, e.target.value)} />
              <input aria-label={`${name}: chức vụ`} className={input} placeholder="Chức vụ" readOnly={party === "ntc"} value={party === "ntc" ? ACCEPTANCE_TECHNICIAN.chucVu : formView[`nguoi_${party}_1_cv`] ?? ""} onChange={(e) => set(`nguoi_${party}_1_cv`, e.target.value)} />
              <input aria-label={`${name}: ngày`} type="date" className={input} value={formView[`ngay_ky_${party}`] ?? ""} onChange={(e) => set(`ngay_ky_${party}`, e.target.value)} />
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold text-slate-700">Người ký BBNTCV (tờ 2) <span className="font-normal text-slate-500">— khác Phụ lục; tự nhớ trên máy này, đổi khi cần.</span></p>
        <div className="grid gap-2 sm:grid-cols-3">
          {SIGNER_PARTIES.map(([party, name]) => (
            <div key={`bbntcv-${party}`} className="space-y-1 rounded-lg border border-slate-200 p-2">
              <p className="text-xs font-semibold text-slate-600">{name}</p>
              {[1, 2].map((i) => (
                <div key={i} className="grid gap-1">
                  <input aria-label={`BBNTCV ${name} người ${i}: họ tên`} className={input} placeholder={`Ông (người ${i})`} readOnly={party === "ntc" && i === 1} value={party === "ntc" && i === 1 ? ACCEPTANCE_TECHNICIAN.ten : formView[`bbntcv_nguoi_${party}_${i}_ten`] ?? ""} onChange={(e) => set(`bbntcv_nguoi_${party}_${i}_ten`, e.target.value)} />
                  <input aria-label={`BBNTCV ${name} người ${i}: chức vụ`} className={input} placeholder="Chức vụ" readOnly={party === "ntc" && i === 1} value={party === "ntc" && i === 1 ? ACCEPTANCE_TECHNICIAN.chucVu : formView[`bbntcv_nguoi_${party}_${i}_cv`] ?? ""} onChange={(e) => set(`bbntcv_nguoi_${party}_${i}_cv`, e.target.value)} />
                </div>
              ))}
            </div>
          ))}
        </div>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => void save()} className="min-h-10 rounded-lg bg-[#0047AB] px-5 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer">{busy ? "Đang lưu…" : local ? "Áp dụng" : "Lưu"}</button>
          <button type="button" disabled={busy} onClick={() => { setDraft({}); setEditing(false); }} className="min-h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold cursor-pointer">Hủy</button>
        </div>
      </div>
    )}
    {(record.dot.thong_tin as Record<string, unknown> | undefined)?.ban_nhap === "1" && (
      <p role="status" className="weld-print-pack-actions mx-auto mb-2 max-w-4xl rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">BẢN NHÁP: kết quả đang tạm ghi Đạt, chưa chốt nghiệm thu nên Nhật ký thi công chưa ghi. In để các bên ký; đến đúng ngày nghiệm thu mới bấm «Nghiệm thu» trong hệ thống.</p>
    )}
    <p className="weld-print-pack-actions mx-auto mb-2 max-w-4xl text-xs text-white/90">Bấm trực tiếp vào các ô trống / ô có viền xanh trên mẫu để điền hoặc sửa, rồi bấm «Lưu chỉnh sửa».</p>
    {!printKinds.length
      ? <p role="status" className="weld-print-pack-actions mx-auto max-w-4xl rounded-lg bg-white px-3 py-2 text-sm text-slate-700">Chọn ít nhất một tờ ở trên để xem / in.</p>
      : <WeldAcceptanceRecordPages record={record} kinds={printKinds} bbSeq={bbSeq} editor={{ draft, set: (k, v) => setDraft((cur) => ({ ...cur, [k]: v })) }} />}
  </div>;
}
