"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { loadRecordSet, reviseRecord, saveRfiPrintInfo, type RecordSet, type RfiSummary, type RfiWeld } from "@/lib/weldQualityClient";
import WeldAcceptanceRecordPages, { acceptancePrintCss, type RecordKind } from "@/components/WeldAcceptanceRecordPages";
import { fieldWeldCode, parseCoordinateCode } from "@/lib/weldCode";
import { rfiScope, SIGNER_KEYS, SIGNER_PARTIES, loadSignerDefaults, saveSignerDefaults } from "@/lib/weldAcceptance";
import { loadPersonnelPickerRows } from "@/lib/personnelCertificatesDb";
import { loadJournalMachineOptions } from "@/lib/machineRunSchedulesDb";
import { loadRfiSignatures, saveRfiSignature, uploadSignatureImage, type SignatureKey, type SignatureStore } from "@/lib/rfiSignatures";

export type DocKind = "rfi" | "hoan-thanh" | "phu-luc" | "giai-doan";

type View = { kind: DocKind; rfi?: { rfi: RfiSummary; welds: RfiWeld[]; projectName: string }; record?: RecordSet };

const TITLES: Record<DocKind, string> = {
  rfi: "PHIẾU YÊU CẦU NGHIỆM THU (RFI)",
  "phu-luc": "BIÊN BẢN NGHIỆM THU MỐI HÀN CHẢY GIÁP MÉP",
  "giai-doan": "BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG",
  "hoan-thanh": "BIÊN BẢN NGHIỆM THU HOÀN THÀNH GIAI ĐOẠN THI CÔNG",
};
const css = `@media print {
  body * { visibility: hidden !important; }
  #weld-doc-print, #weld-doc-print * { visibility: visible !important; }
  #weld-doc-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: #fff; }
  .weld-doc-actions { display: none !important; }
  #weld-doc-print table { page-break-inside: auto; } #weld-doc-print tr { page-break-inside: avoid; }
  #weld-doc-print thead { display: table-header-group; }
  /* Phiếu YCNT 1 trang: lề trang = 0 để trình duyệt tự bỏ đầu trang / cuối trang (ngày giờ, tiêu đề); lề thật đặt bằng padding. */
  @page { size: A4; margin: 0; }
  #weld-doc-print { box-sizing: border-box; padding: 15mm 15mm 15mm 20mm !important; max-width: none !important; }
}`;

const LOAI: Record<DocKind, string> = { rfi: "", "hoan-thanh": "Hoàn thành công việc", "phu-luc": "Phụ lục công việc", "giai-doan": "Giai đoạn xây dựng" };

/** Thông tin / thời gian trên mẫu — sửa được ở bản xem trước (để trống = tự lấy từ dữ liệu đã chốt). */
const PRINT_INFO_KEYS: string[] = ["ngay_nghiem_thu", "gio_bat_dau", "gio_ket_thuc", "ca_han", "bien_phap", "tuyen", "ten_tho_han", "id_tho_han", "may_han", "goong", "kmFrom", "kmTo", "so_bb", "ngay_ky_tvgs", "ngay_ky_ntc", "ngay_ky_ntp", ...SIGNER_KEYS];

/** Mục 5 (a–g) của BB nghiệm thu hoàn thành: nhập tay, lưu qua bản sửa đổi thông tin in. */
const FREE_TEXT_FIELDS: [string, string][] = [
  ["tai_lieu_can_cu", "a) Các tài liệu căn cứ nghiệm thu"],
  ["danh_gia_chat_luong", "b) Đánh giá chất lượng công trình so với thiết kế được phê duyệt"],
  ["dieu_chinh", "c) Những điều chỉnh, thay đổi bổ sung trong quá trình thi công"],
  ["so_voi_thiet_ke", "d) Chất lượng hạng mục — so với thiết kế, chỉ dẫn kỹ thuật"],
  ["so_voi_hop_dong", "d) Chất lượng hạng mục — so với hợp đồng"],
  ["ket_qua_thi_nghiem", "e) Kết quả thí nghiệm, kiểm tra, kiểm định, chạy thử"],
  ["tuan_thu_phccc", "f) Tuân thủ quy định phòng cháy chữa cháy, bảo vệ môi trường"],
  ["y_kien_khac", "g) Các ý kiến khác (nếu có)"],
];

const flagOn = (v: unknown) => v === true || v === "1" || v === "true";

export default function WeldAcceptanceDocument({ view, onClose, onEditRfi }: {
  view: View;
  onClose: () => void;
  /** Mở form sửa phiếu YCNT (chỉ khi xem RFI). */
  onEditRfi?: (rfi: RfiSummary) => void;
}) {
  const { kind } = view;
  const [record, setRecord] = useState(view.record);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ dia_diem: "", thanh_phan: "", ly_do: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signatures, setSignatures] = useState<SignatureStore>({});
  // Hai bản in phiếu YCNT: có chữ ký dán sẵn (phát hành ngay) / không dán chữ ký (in ra ký trực tiếp).
  const [withSignatures, setWithSignatures] = useState(true);
  const [sigOpen, setSigOpen] = useState(false);
  const [pickers, setPickers] = useState<{ people: { name: string; code: string }[]; machines: string[] }>({ people: [], machines: [] });
  const [sigError, setSigError] = useState("");
  const [sigLoadError, setSigLoadError] = useState("");
  const [sigLinks, setSigLinks] = useState<Partial<Record<SignatureKey, string>>>({});
  // Sửa nội dung in của phiếu YCNT ngay trên bản xem trước (lưu theo phiếu trên máy này; để trống = tự lấy).
  const rfiKey = view.rfi ? `rfi-print:${view.rfi.rfi.id}` : "";
  const [rfiEditOpen, setRfiEditOpen] = useState(false);
  const [printSaved, setPrintSaved] = useState("");
  const printSaveTimer = useRef<number | null>(null);
  // Ưu tiên: nội dung đã lưu theo phiếu (dùng chung mọi máy) > bản nháp trên máy > giá trị nhập gần nhất (tự điền cho phiếu mới).
  const [rfiOverrides, setRfiOverrides] = useState<RfiOverrides>(() => {
    if (!rfiKey) return {};
    let local: RfiOverrides = {}, remembered: RfiOverrides = {};
    try { local = JSON.parse(window.localStorage.getItem(rfiKey) ?? "{}") as RfiOverrides; } catch { /* bỏ qua */ }
    try { remembered = JSON.parse(window.localStorage.getItem(RFI_PRINT_DEFAULTS) ?? "{}") as RfiOverrides; } catch { /* bỏ qua */ }
    const saved: RfiOverrides = {};
    for (const key of RFI_PRINT_SAVED_KEYS) {
      const value = view.rfi?.rfi.thong_tin?.[`in_${key}`];
      if (value) saved[key] = value;
    }
    return { doi_tuong: remembered.doi_tuong, noi_dung: remembered.noi_dung, ...local, ...saved };
  });
  function persistOverrides(next: RfiOverrides) {
    try { window.localStorage.setItem(rfiKey, JSON.stringify(next)); } catch { /* bỏ qua khi không lưu được */ }
    // Nhớ đối tượng + nội dung vị trí để tự điền cho các phiếu sau (khi đổi thì sửa lại).
    try { window.localStorage.setItem(RFI_PRINT_DEFAULTS, JSON.stringify({ doi_tuong: next.doi_tuong ?? "", noi_dung: next.noi_dung ?? "" })); } catch { /* bỏ qua */ }
    if (printSaveTimer.current) window.clearTimeout(printSaveTimer.current);
    setPrintSaved("Đang lưu…");
    printSaveTimer.current = window.setTimeout(() => {
      const values = Object.fromEntries(RFI_PRINT_SAVED_KEYS.map((k) => [k, next[k] ?? ""]));
      saveRfiPrintInfo(view.rfi!.rfi.id, values).then(() => setPrintSaved("Đã lưu cho phiếu này")).catch(() => setPrintSaved("Chưa lưu được lên máy chủ (vẫn nhớ trên máy này)"));
    }, 700);
  }
  function setOverride(key: keyof RfiOverrides, value: string) {
    const next = { ...rfiOverrides, [key]: value };
    setRfiOverrides(next);
    persistOverrides(next);
  }
  function resetOverrides() {
    setRfiOverrides({});
    persistOverrides({});
    try { window.localStorage.removeItem(rfiKey); } catch { /* bỏ qua */ }
  }

  function printVersion(signed: boolean) {
    flushSync(() => setWithSignatures(signed));
    window.print();
  }

  async function changeSignatureLink(key: SignatureKey, url: string) {
    setSigError(""); setBusy(true);
    try {
      setSignatures(await saveRfiSignature(key, url));
      setSigLinks((cur) => ({ ...cur, [key]: "" }));
    } catch (e) { setSigError(e instanceof Error ? e.message : "Không lưu được link."); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!editing || kind === "rfi") return;
    let live = true;
    void Promise.all([loadPersonnelPickerRows().catch(() => []), loadJournalMachineOptions().catch(() => [])]).then(([people, machines]) => {
      if (!live) return;
      setPickers({
        people: people.filter((p) => (p.trang_thai || "Hoạt động") !== "Khóa").map((p) => ({ name: p.ho_ten, code: p.ma_nhan_su ?? "" })),
        machines: [...new Set(machines.map((m) => m.name?.trim() || m.code).filter(Boolean))],
      });
    });
    return () => { live = false; };
  }, [editing, kind]);
  const hoSo = record?.ho_so.find((h) => h.loai === LOAI[kind]);
  const revisions = (record?.sua_doi ?? []).filter((r) => r.ho_so_id === hoSo?.id);
  const latest = revisions[revisions.length - 1];

  useEffect(() => {
    if (kind === "rfi") loadRfiSignatures().then((v) => { setSignatures(v); setSigLoadError(""); }).catch((e) => setSigLoadError(e instanceof Error ? e.message : "Không tải được chữ ký"));
  }, [kind]);

  async function changeSignature(key: SignatureKey, file: File | null) {
    setSigError(""); setBusy(true);
    try {
      setSignatures(await saveRfiSignature(key, file ? await uploadSignatureImage(file) : null));
    } catch (e) { setSigError(e instanceof Error ? e.message : "Không lưu được chữ ký."); } finally { setBusy(false); }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function saveRevision() {
    if (!hoSo || !record) return;
    setBusy(true); setError("");
    try {
      const { ly_do, ...thongTin } = form;
      saveSignerDefaults(thongTin); // nhớ người ký cho các lần in sau
      await reviseRecord(hoSo.id, thongTin, ly_do.trim() || "Cập nhật nội dung nhập tay");
      setRecord(await loadRecordSet(String(record.dot.id)));
      setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được bản sửa đổi."); } finally { setBusy(false); }
  }

  return (
    <div className={`${kind === "rfi" ? "" : "acceptance-print-root"} fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4`} role="dialog" aria-modal="true" aria-label={TITLES[kind]}>
      <style>{kind === "rfi" ? css : acceptancePrintCss}</style>
      <div className="weld-doc-actions sticky top-0 z-[110] mx-auto mb-3 flex max-w-3xl flex-nowrap items-center justify-end gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
        {kind === "rfi" && view.rfi && onEditRfi ? (
          <button type="button" onClick={() => onEditRfi(view.rfi!.rfi)} className="h-9 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-800 cursor-pointer hover:bg-slate-50">
            Sửa phiếu
          </button>
        ) : null}
        {kind === "rfi" && view.rfi ? (
          <button type="button" onClick={() => setRfiEditOpen((v) => !v)} className="h-9 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-800 cursor-pointer hover:bg-slate-50">Sửa nội dung in</button>
        ) : null}
        {kind === "rfi" ? (
          <button type="button" onClick={() => setSigOpen((v) => !v)} className="h-9 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-800 cursor-pointer hover:bg-slate-50">Chữ ký</button>
        ) : null}
        {hoSo && (
          <button type="button" onClick={() => { setForm({ dia_diem: String(latest?.thong_tin.dia_diem ?? ((record?.dot.thong_tin as Record<string, string> | undefined)?.dia_diem ?? "")), thanh_phan: String(latest?.thong_tin.thanh_phan ?? ((record?.dot.thong_tin as Record<string, string> | undefined)?.thanh_phan ?? "")), ...Object.fromEntries(FREE_TEXT_FIELDS.map(([k]) => [k, String(latest?.thong_tin[k] ?? "")])), ...Object.fromEntries(PRINT_INFO_KEYS.map((k) => {
            const saved = latest?.thong_tin[k];
            if (saved) return [k, String(saved)];
            if (k === "ngay_nghiem_thu") return [k, String(record?.dot.ngay_nghiem_thu ?? "").slice(0, 10)];
            return [k, String(loadSignerDefaults()[k] ?? "")];
          })), ly_do: "" }); setEditing((v) => !v); }}
            className="h-9 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-800 cursor-pointer hover:bg-slate-50">Sửa thông tin in</button>
        )}
        {kind === "rfi" ? (
          <>
            <button type="button" onClick={() => printVersion(true)} title="Chữ ký nhà thầu chính / phụ đã dán sẵn trên phiếu — dùng để phát hành ngay" className="h-9 whitespace-nowrap rounded-lg bg-[#0047AB] px-3 text-[13px] font-semibold text-white cursor-pointer hover:bg-[#00388A]">In có chữ ký</button>
            <button type="button" onClick={() => printVersion(false)} title="Không dán chữ ký — in ra để ký trực tiếp" className="h-9 whitespace-nowrap rounded-lg border border-[#0047AB] bg-white px-3 text-[13px] font-semibold text-[#0047AB] cursor-pointer hover:bg-blue-50">In ký tay</button>
          </>
        ) : (
          <button type="button" onClick={() => window.print()} className="h-9 whitespace-nowrap rounded-lg bg-[#0047AB] px-3 text-[13px] font-semibold text-white cursor-pointer hover:bg-[#00388A]">In / Lưu PDF</button>
        )}
        <button type="button" onClick={onClose} className="h-9 whitespace-nowrap rounded-lg border border-slate-300 bg-slate-100 px-3 text-[13px] font-semibold text-slate-900 cursor-pointer hover:bg-slate-200">Thoát</button>
      </div>
      {kind === "rfi" && sigLoadError && (
        <p role="alert" className="weld-doc-actions mx-auto mb-3 max-w-3xl rounded-lg bg-red-50 p-2 text-sm text-red-700">Không tải được chữ ký đã lưu: {sigLoadError}</p>
      )}
      {kind === "rfi" && view.rfi && rfiEditOpen && (
        <div className="weld-doc-actions mx-auto mb-3 max-w-3xl space-y-2 rounded-xl bg-white p-4 text-sm">
          <p className="text-xs text-slate-600">Sửa giá trị trên phiếu trước khi in. Để trống = tự lấy theo dữ liệu. Nội dung sửa được lưu vào hệ thống theo phiếu, dùng lâu dài trên mọi máy.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {RFI_OVERRIDE_FIELDS.map(([key, label, type, placeholder]) => (
              <label key={key} className={`block text-xs font-semibold text-slate-700 ${type === "textarea" ? "sm:col-span-3" : ""}`}>{label}
                {type === "textarea"
                  ? <textarea rows={2} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm font-normal" value={rfiOverrides[key] ?? ""} onChange={(e) => setOverride(key, e.target.value)} />
                  : <input type={type} placeholder={placeholder} className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" value={rfiOverrides[key] ?? ""} onChange={(e) => setOverride(key, e.target.value)} />}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={resetOverrides} className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold cursor-pointer hover:bg-slate-50">Về mặc định</button>
            {printSaved && <span className="text-xs text-slate-500">{printSaved}</span>}
          </div>
        </div>
      )}
      {kind === "rfi" && sigOpen && (
        <div className="weld-doc-actions mx-auto mb-3 max-w-3xl space-y-2 rounded-xl bg-white p-4 text-sm">
          <p className="text-xs text-slate-600">Chữ ký hiện trên phiếu của dự án Phú Quốc. Chọn ảnh PNG/JPG (nền trắng); ảnh được tải lên Cloudinary một lần và lưu lại để mọi máy dùng chung, không cần tải lại.</p>
          {(["chi-huy-truong", "nha-thau-phu", "gach-trang-tri"] as SignatureKey[]).map((key) => (
            <div key={key} className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2">
              <span className="w-44 font-semibold">{SIG_LABELS[key]}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {signatures[key] ? <img src={signatures[key]} alt="" className="h-10 max-w-[8rem] object-contain" /> : <span className="text-xs text-slate-500">Chưa có</span>}
              <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                {signatures[key] ? "Đổi ảnh" : "Tải ảnh lên"}
                <input type="file" accept="image/png,image/jpeg" disabled={busy} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void changeSignature(key, f); }} />
              </label>
              {signatures[key] && <button type="button" disabled={busy} onClick={() => void changeSignature(key, null)} className="text-xs font-semibold text-rose-600 cursor-pointer">Xóa</button>}
              <div className="flex w-full gap-2">
                <input type="url" inputMode="url" placeholder="Hoặc dán link ảnh (https://…)" value={sigLinks[key] ?? ""} onChange={(e) => setSigLinks((cur) => ({ ...cur, [key]: e.target.value }))}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-2 text-xs" />
                <button type="button" disabled={busy || !(sigLinks[key] ?? "").trim()} onClick={() => void changeSignatureLink(key, (sigLinks[key] ?? "").trim())}
                  className="h-9 rounded-lg bg-[#0047AB] px-3 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer">Lưu link</button>
              </div>
            </div>
          ))}
          {sigError && <p role="alert" className="text-red-600">{sigError}</p>}
        </div>
      )}
      {editing && (
        <div className="weld-doc-actions mx-auto mb-3 max-w-3xl space-y-2 rounded-xl bg-white p-4 text-sm">
          <p className="text-xs text-slate-600">Sửa địa điểm, thành phần tham dự, thông tin và thời gian trên mẫu, và các mục nhập tay (BB hoàn thành). Số đo và danh sách mối đã chốt không thay đổi; bản sửa đổi được lưu kèm lý do và người sửa.</p>
          <input className="h-9 w-full rounded-lg border border-slate-300 px-2" placeholder="Địa điểm" value={form.dia_diem} onChange={(e) => setForm({ ...form, dia_diem: e.target.value })} />
          <input className="h-9 w-full rounded-lg border border-slate-300 px-2" placeholder="Thành phần tham dự" value={form.thanh_phan} onChange={(e) => setForm({ ...form, thanh_phan: e.target.value })} />
          {kind !== "rfi" && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Thông tin và thời gian trên mẫu</p>
              <p className="text-xs text-slate-500">Chọn hoặc nhập để in lên mẫu; để trống thì mẫu tự lấy theo dữ liệu mối hàn / Nhật ký hàn.</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block text-xs font-semibold text-slate-700">Ngày nghiệm thu
                  <input type="date" className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" value={form.ngay_nghiem_thu ?? ""} onChange={(e) => setForm({ ...form, ngay_nghiem_thu: e.target.value })} />
                </label>
                {kind !== "phu-luc" && (<>
                  <label className="block text-xs font-semibold text-slate-700">Bắt đầu (giờ)
                    <input type="time" className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" value={form.gio_bat_dau ?? ""} onChange={(e) => setForm({ ...form, gio_bat_dau: e.target.value })} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">Kết thúc (giờ)
                    <input type="time" className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" value={form.gio_ket_thuc ?? ""} onChange={(e) => setForm({ ...form, gio_ket_thuc: e.target.value })} />
                  </label>
                </>)}
              </div>
              {kind === "giai-doan" && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 sm:max-w-xs">Số biên bản (để trống = tự đặt FBW/số RFI/BBNTCV)
                    <input className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" placeholder="FBW/01/BBNTCV" value={form.so_bb ?? ""} onChange={(e) => setForm({ ...form, so_bb: e.target.value })} />
                  </label>
                  <p className="text-xs font-semibold text-slate-700">Người trực tiếp tham gia nghiệm thu <span className="font-normal text-slate-500">— nhớ cho các lần in sau; lần nào người khác ký thì nhập lại.</span></p>
                  {SIGNER_PARTIES.map(([party, label]) => (
                    <div key={party} className="rounded-lg border border-slate-200 bg-white p-2">
                      <p className="mb-1 text-xs font-semibold text-slate-600">{label}</p>
                      {[1, 2].map((i) => (
                        <div key={i} className="mb-1 grid gap-2 sm:grid-cols-2">
                          <input aria-label={`${label} người ${i}: họ tên`} className="h-9 rounded-lg border border-slate-300 px-2 text-sm" placeholder={`Ông (người ${i})`} value={form[`nguoi_${party}_${i}_ten`] ?? ""} onChange={(e) => setForm({ ...form, [`nguoi_${party}_${i}_ten`]: e.target.value })} />
                          <input aria-label={`${label} người ${i}: chức vụ`} className="h-9 rounded-lg border border-slate-300 px-2 text-sm" placeholder="Chức vụ" value={form[`nguoi_${party}_${i}_cv`] ?? ""} onChange={(e) => setForm({ ...form, [`nguoi_${party}_${i}_cv`]: e.target.value })} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {kind === "phu-luc" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">Ca hàn
                    <select className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" value={form.ca_han ?? ""} onChange={(e) => setForm({ ...form, ca_han: e.target.value })}>
                      <option value="">Tự động theo nhật ký</option><option value="ngay">Ngày</option><option value="dem">Đêm</option><option value="ngay-dem">Ngày và đêm</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">Biện pháp hàn
                    <select className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" value={form.bien_phap ?? ""} onChange={(e) => setForm({ ...form, bien_phap: e.target.value })}>
                      <option value="">Tự động theo máy</option><option value="co-dinh">Hàn cố định</option><option value="di-dong">Hàn di động</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">Tuyến
                    <select className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" value={form.tuyen ?? ""} onChange={(e) => setForm({ ...form, tuyen: e.target.value })}>
                      <option value="">Tự động theo mã mối hàn</option><option value="thuong">Tuyến thượng</option><option value="ha">Tuyến hạ</option><option value="ca-hai">Tuyến thượng và tuyến hạ</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">Goòng phẳng
                    <input className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" placeholder="KPS25-L8" value={form.goong ?? ""} onChange={(e) => setForm({ ...form, goong: e.target.value })} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">Tên thợ hàn (chọn từ Nhân sự hoặc nhập)
                    <input list="rec-people" className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" value={form.ten_tho_han ?? ""}
                      onChange={(e) => { const name = e.target.value; const match = pickers.people.find((p) => p.name === name); setForm({ ...form, ten_tho_han: name, ...(match?.code ? { id_tho_han: match.code } : {}) }); }} />
                    <datalist id="rec-people">{pickers.people.map((p) => <option key={p.name + p.code} value={p.name}>{p.code}</option>)}</datalist>
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">ID thợ hàn
                    <input className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" value={form.id_tho_han ?? ""} onChange={(e) => setForm({ ...form, id_tho_han: e.target.value })} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">Máy hàn (chọn từ danh sách hoặc nhập)
                    <input list="rec-machines" className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" value={form.may_han ?? ""} onChange={(e) => setForm({ ...form, may_han: e.target.value })} />
                    <datalist id="rec-machines">{pickers.machines.map((m) => <option key={m} value={m} />)}</datalist>
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">Vị trí: Km đầu
                    <input className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" placeholder="3+862.74" value={form.kmFrom ?? ""} onChange={(e) => setForm({ ...form, kmFrom: e.target.value })} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">Vị trí: Km cuối
                    <input className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" placeholder="4+087.42" value={form.kmTo ?? ""} onChange={(e) => setForm({ ...form, kmTo: e.target.value })} />
                  </label>
                  <p className="text-xs font-semibold text-slate-700 sm:col-span-2">Khung chữ ký cuối phụ lục <span className="font-normal text-slate-500">— để trống ngày = lấy ngày nghiệm thu ở trên.</span></p>
                  {SIGNER_PARTIES.map(([party, label]) => (
                    <div key={party} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:col-span-2 sm:grid-cols-2">
                      <label className="block text-xs font-semibold text-slate-600">{label}: họ và tên
                        <input className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" value={form[`nguoi_${party}_1_ten`] ?? ""} onChange={(e) => setForm({ ...form, [`nguoi_${party}_1_ten`]: e.target.value })} />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">{label}: ngày
                        <input type="date" className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal" value={form[`ngay_ky_${party}`] ?? ""} onChange={(e) => setForm({ ...form, [`ngay_ky_${party}`]: e.target.value })} />
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {kind === "hoan-thanh" && FREE_TEXT_FIELDS.map(([key, label]) => (
            <label key={key} className="block text-xs font-semibold text-slate-700">{label}
              <textarea rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm font-normal" value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </label>
          ))}
          <input className="h-9 w-full rounded-lg border border-slate-300 px-2" placeholder="Lý do sửa đổi (không bắt buộc)" value={form.ly_do} onChange={(e) => setForm({ ...form, ly_do: e.target.value })} />
          {error && <p role="alert" className="text-red-600">{error}</p>}
          <button type="button" disabled={busy} onClick={() => void saveRevision()} className="h-9 rounded-lg bg-[#0047AB] px-4 font-semibold text-white disabled:opacity-50 cursor-pointer">Lưu bản sửa đổi</button>
        </div>
      )}
      {kind === "rfi" && view.rfi ? <RfiForm {...view.rfi} o={rfiOverrides} signatures={withSignatures ? signatures : { ...signatures, "chi-huy-truong": undefined, "nha-thau-phu": undefined }} /> : (
      record ? <WeldAcceptanceRecordPages record={record} kind={kind as RecordKind} /> : null)}
    </div>
  );
}

const PQ = {
  duAn: "Tuyến tàu điện đô thị đoạn 1", goiThau: "Gói thầu XL03: Cung cấp và thi công lắp đặt hệ thống ray", diaDiem: "Đặc khu Phú Quốc, Tỉnh An Giang", noiLap: "Phú Quốc",
  kinhGui: ["Ban Quản lý dự án - Công ty TNHH MTV BOT tàu điện Phú Quốc;", "Tư vấn giám sát – Công ty CP TVTK XDCT GT Miền Bắc (Tedi North)."],
  chinh: { ten: "Nguyễn Tất Đạt", chucVu: "Chỉ huy trưởng", chuKy: "/chu-ky/chi-huy-truong.jpg", key: "chi-huy-truong" as SignatureKey },
  phu: { ten: "Trần Công Tiến", chucVu: "Chỉ huy trưởng", chuKy: "/chu-ky/nha-thau-phu.jpg", key: "nha-thau-phu" as SignatureKey },
};
const DOTS = "……………";
const SIG_LABELS: Record<SignatureKey, string> = { "chi-huy-truong": "Chữ ký Nhà thầu chính", "nha-thau-phu": "Chữ ký Nhà thầu phụ", "gach-trang-tri": "Gạch trang trí dưới tiêu đề" };

/** Khối ký của nhà thầu: chữ ký ảnh dán sẵn (chỉ có cho dự án Phú Quốc), phần còn lại để trống cho nhà thầu khác. */
function Signer({ title, org, who, ten, chucVu, signatures }: { title: string; org: string; who?: { ten: string; chucVu: string; chuKy: string; key: SignatureKey }; ten?: string; chucVu?: string; signatures: SignatureStore }) {
  // Ô nhập tay > mặc định của dự án (Phú Quốc) > không in.
  const name = ten?.trim() || who?.ten, role = chucVu?.trim() || who?.chucVu;
  return (
    <div className="text-center">
      <p className="font-bold">{title}</p>
      <p className="italic">({org})</p>
      <div className="flex h-20 items-center justify-center overflow-hidden">
        {/* Kích thước cố định (không dùng % chiều cao) để ảnh luôn hiện khi in; không hiệu ứng blend. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {who && signatures[who.key] && <img key={signatures[who.key]} src={signatures[who.key]} alt="" className="block h-20 w-auto max-w-full object-contain" />}
      </div>
      {(name || role) && <p className="italic">{name && <><b>Tên:</b> {name}</>}{name && role && <>&nbsp;</>}{role && <><b>Chức vụ:</b> {role}</>}</p>}
    </div>
  );
}

/** Mọi mục sửa ở «Sửa nội dung in» được lưu vào CSDL theo phiếu (dùng lâu dài, mọi máy). */
const RFI_PRINT_SAVED_KEYS = ["doi_tuong", "noi_dung", "ngay_nt", "gio", "km_dau", "km_cuoi", "so_phieu", "ngay_lap", "noi_lap", "ngay_nhan", "dia_diem", "hang_muc", "nguoi_nhan", "chuc_vu_nhan", "kinh_gui", "ntp_ten", "ntp_chuc_vu", "ntc_ten", "ntc_chuc_vu"] as const;
const RFI_PRINT_DEFAULTS = "rfi-print-defaults";
type RfiOverrides = Partial<Record<"noi_dung" | "so_phieu" | "ngay_lap" | "noi_lap" | "dia_diem" | "hang_muc" | "kinh_gui" | "doi_tuong" | "ngay_nt" | "gio" | "km_dau" | "km_cuoi" | "nguoi_nhan" | "chuc_vu_nhan" | "ngay_nhan" | "ntp_ten" | "ntp_chuc_vu" | "ntc_ten" | "ntc_chuc_vu", string>>;
const RFI_OVERRIDE_FIELDS: [keyof RfiOverrides, string, "text" | "date" | "time" | "textarea", string][] = [
  ["so_phieu", "Số phiếu", "text", "007/PYC-HR"],
  ["ngay_lap", "Ngày lập phiếu", "date", ""],
  ["noi_lap", "Nơi lập", "text", "Phú Quốc"],
  ["ngay_nt", "Ngày nghiệm thu (mục 2)", "date", ""],
  ["gio", "Giờ nghiệm thu (mặc định 8h00)", "time", ""],
  ["ngay_nhan", "Ngày nhận (TVGS)", "date", ""],
  ["km_dau", "Lý trình", "text", "4+486.85"],
  ["noi_dung", "Nội dung tại vị trí (mục 2) — nhập một lần, tự nhớ", "text", "Giám sát thi công hàn ray"],
  ["dia_diem", "Địa điểm", "text", ""],
  ["hang_muc", "Hạng mục", "text", ""],
  ["nguoi_nhan", "Người nhận (TVGS)", "text", ""],
  ["chuc_vu_nhan", "Chức vụ người nhận", "text", "Tư vấn giám sát trưởng"],
  // 4 ô dưới: để trống thì không in dòng tương ứng ở khối ký.
  ["ntp_ten", "Nhà thầu phụ — tên", "text", ""],
  ["ntp_chuc_vu", "Nhà thầu phụ — chức vụ", "text", ""],
  ["ntc_ten", "Nhà thầu chính — tên", "text", ""],
  ["ntc_chuc_vu", "Nhà thầu chính — chức vụ", "text", ""],
  ["kinh_gui", "Kính gửi (mỗi dòng một bên)", "textarea", ""],
  ["doi_tuong", "Đối tượng nghiệm thu (mỗi dòng một mục, thay toàn bộ mục 1)", "textarea", ""],
];
/** Nơi lập tự lấy từ địa điểm của phiếu: chỉ tên nơi (bỏ chữ «Địa điểm:», phần sau dấu phẩy, và đoạn lý trình/Km). */
function placeName(v?: string) {
  const p = (v ?? "").replace(/^\s*địa điểm\s*:?\s*/i, "").split(",")[0].trim();
  return /\d|lý trình/i.test(p) ? "" : p;
}
function viDate(iso?: string) {
  const [y, m, d] = (iso ?? "").split("-");
  return y && m && d ? `${d} tháng ${m} năm ${y}` : "";
}

function RfiForm({ rfi, welds, projectName, signatures, o = {} }: { rfi: RfiSummary; welds: RfiWeld[]; projectName: string; signatures: SignatureStore; o?: RfiOverrides }) {
  const t = rfi.thong_tin ?? {}, pq = /phú quốc/i.test(projectName) ? PQ : null;
  const monitoring = t.loai_rfi === "theo-doi";
  const ultrasoundOnly = !monitoring && (() => { const sc = rfiScope(t); return sc.ultrasound && !sc.geometry; })();
  const lines = (v?: string) => (v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  const [y, m, d] = (o.ngay_lap?.trim() || rfi.ngay_moi).split("-");
  const km = welds.map((w) => w.ly_trinh).filter((v): v is string => !!v)
    .flatMap((v) => { const p = /(\d+)\+(\d+(?:\.\d+)?)/.exec(v); return p ? [{ v, n: Number(p[1]) * 1000 + Number(p[2]) }] : []; })
    .sort((a, b) => a.n - b.n);
  const benNhanLines = lines((t.ben_nhan ?? "").replace(/;/g, "\n"));
  const kinhGui = lines(o.kinh_gui).length ? lines(o.kinh_gui) : benNhanLines.length ? benNhanLines : pq?.kinhGui ?? [DOTS];
  const routes = welds.map((w) => parseCoordinateCode(w.ma_diem ?? "")?.prefix);
  const autoUpper = routes.some((r) => r === "TT" || r === "TP");
  const autoLower = routes.some((r) => r === "HT" || r === "HP");
  const hasRouteOverride = "tuyen_thuong" in t || "tuyen_ha" in t;
  const upper = hasRouteOverride ? flagOn(t.tuyen_thuong) : autoUpper;
  const lower = hasRouteOverride ? flagOn(t.tuyen_ha) : autoLower;
  const missingRoutes = welds.filter((_, i) => !routes[i]);
  const tuyen = upper && lower ? "tuyến thượng và tuyến hạ" : upper ? "tuyến thượng" : lower ? "tuyến hạ" : `tuyến ${DOTS}`;
  const chainage = (value?: string) => value ? `Km${value.replace(/^\s*km\s*/i, "")}` : `Km ${DOTS}`;
  // Giờ nghiệm thu: chưa nhập thì gợi ý sẵn 8h00 (sửa được ở «Sửa nội dung in»).
  const gio = (o.gio?.trim() || t.gio_bat_dau || "08:00").trim();
  const [hh, mm] = gio.includes(":") ? gio.split(":") : ["", ""];
  const ngay = `${d ?? "……"} tháng ${m ?? "……"} năm ${y ?? "……"}`;
  // Ngày nghiệm thu (mục 2) = ngày phát phiếu + 1.
  const ngayNghiemThu = viDate(o.ngay_nt?.trim()) || (() => {
    const next = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d) + 1));
    if (!y || !m || !d || Number.isNaN(next.getTime())) return ngay;
    return `${String(next.getUTCDate()).padStart(2, "0")} tháng ${String(next.getUTCMonth() + 1).padStart(2, "0")} năm ${next.getUTCFullYear()}`;
  })();
  const heading = "mt-3 font-bold";
  return (
    <article id="weld-doc-print" className="weld-rfi mx-auto max-w-3xl bg-white p-10 text-[11pt] leading-[1.55] text-black" style={{ fontFamily: "'Times New Roman', serif" }}>
      <div className="text-center font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br />Độc lập - Tự do - Hạnh phúc</div>
      {signatures["gach-trang-tri"] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={signatures["gach-trang-tri"]} alt="" className="mx-auto my-0.5 block h-[5.3mm] w-[55mm] max-w-full object-cover contrast-125" />
      ) : (
        <p className="text-center font-bold leading-none" style={{ fontFamily: "'Segoe UI Symbol', 'Noto Sans Symbols2', 'Times New Roman', serif" }} aria-hidden="true">
          ----------- ☙★❧ -----------
        </p>
      )}
      <p className="mt-3 text-right italic">{o.noi_lap?.trim() || pq?.noiLap || placeName(o.dia_diem?.trim() || t.dia_diem) || DOTS}, ngày {ngay}</p>
      <h2 className="mt-3 text-center font-bold">PHIẾU YÊU CẦU NGHIỆM THU</h2>
      <p className="text-center">Số: {o.so_phieu?.trim() || `${rfi.so_phieu.replace(/^RFI-(?:HH-|SA-)?/i, "")}/PYC-HR`}</p>
      <dl className="mt-3 grid grid-cols-[6rem_1fr] font-bold">
        <dt>Dự án</dt><dd className="font-normal">: {pq?.duAn ?? projectName ?? DOTS}</dd>
        <dt>Hạng mục</dt><dd className="font-normal">: {o.hang_muc?.trim() || pq?.goiThau || DOTS}</dd>
        <dt>Địa điểm</dt><dd className="font-normal">: {o.dia_diem?.trim() || t.dia_diem || pq?.diaDiem || DOTS}</dd>
      </dl>
      <div className="mt-2 flex gap-2 pl-[6rem]"><b className="shrink-0 whitespace-nowrap italic">Kính gửi:</b><div className="min-w-0 flex-1 font-bold">{kinhGui.map((k) => <p key={k}>- {k}</p>)}</div></div>
      <p className={heading}>1. Đối tượng nghiệm thu:</p>
      {lines(o.doi_tuong).length > 0 ? lines(o.doi_tuong).map((x) => <p key={x}>- {x.replace(/^-\s*/, "")}</p>) : <>
      {(monitoring || t.loai_rfi === "ca-hai") && <p>- {t.cong_viec === "gtus" ? "Giám sát và nghiệm thu giải toả ứng suất ray" : "Giám sát thi công hàn ray"} {t.giam_sat?.trim() || tuyen}{t.pham_vi ? ` (${t.pham_vi})` : ""}</p>}
      {!monitoring && (() => { const s = rfiScope(t), codes = welds.map(w => fieldWeldCode(w.ma_lich_su)).join(", "), pv = t.pham_vi ? ` (${t.pham_vi})` : "";
        return <>{s.geometry && <p>- Nghiệm thu kích thước hình học, trực quan mối hàn {codes}{pv}</p>}{s.ultrasound && <p>- Nghiệm thu siêu âm mối hàn {codes}{pv}</p>}</>; })()}
      </>}
      {missingRoutes.length > 0 && !hasRouteOverride && <p className="weld-doc-actions text-red-600">Chưa xác định tuyến: {missingRoutes.map((w) => fieldWeldCode(w.ma_lich_su)).join(", ")}</p>}
      <p className={`${heading} mt-6`}>2. Thời gian và vị trí nghiệm thu: Ngày {ngayNghiemThu}</p>
      <p className="pl-3">{hh ? String(Number(hh)) : "…. "}h{mm || "…"} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {chainage(o.km_dau?.trim() || (monitoring ? t.kmFrom : km[0]?.v))}{o.noi_dung?.trim() ? <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {o.noi_dung.trim()}</> : null}</p>
      <p className={`${heading} mt-6`}>3. Đánh giá công việc:</p>
        <p className="text-justify">- Nhà thầu cam kết hạng mục trên đã đáp ứng yêu cầu chất lượng theo hồ sơ thiết kế, chỉ dẫn kỹ thuật, Hợp đồng thi công xây dựng và các tài liệu có liên quan khác;</p>
        <p className="mt-2 text-justify">- Công việc chuẩn bị hồ sơ, thủ tục đã đầy đủ sẵn sàng để kiểm tra nghiệm thu;</p>
        <p className="mt-2 text-justify">- Đề nghị Tư vấn giám sát đến công trường kiểm tra, nghiệm thu các công việc đề nghị nêu trên để nhà thầu triển khai các công việc tiếp theo.</p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {/* Phiếu nghiệm thu siêu âm (không kèm hình học) chỉ có Nhà thầu chính ký; để trống bên trái giữ vị trí chữ ký bên phải. */}
        {ultrasoundOnly ? <div aria-hidden /> : <Signer title="NHÀ THẦU PHỤ" org="Công ty CP công trình Thành Phát" who={pq?.phu} ten={o.ntp_ten} chucVu={o.ntp_chuc_vu} signatures={signatures} />}
        <Signer title="NHÀ THẦU CHÍNH" org="Liên danh VNR-CRCC16" who={pq?.chinh} ten={o.ntc_ten} chucVu={o.ntc_chuc_vu} signatures={signatures} />
      </div>
      <table className="mt-3 w-full border-collapse border border-black">
        <tbody>
          <tr className="h-28">
            <td className="w-1/4 border border-black text-center font-bold">TƯ VẤN<br />GIÁM SÁT</td>
            <td className="w-[40%] border border-black p-1 align-top">
              <div className="flex h-full min-h-[6.5rem] flex-col justify-between">
                <span>Người nhận: {o.nguoi_nhan?.trim() || (pq ? "Trần Văn Thanh" : DOTS)}</span>
                <span>Ngày nhận: {viDate(o.ngay_nhan?.trim()) || ngay}</span>
              </div>
            </td>
            <td className="border border-black p-1 align-top">
              <div className="flex h-full min-h-[6.5rem] flex-col justify-between">
                <span>Chức vụ: {o.chuc_vu_nhan?.trim() || "Tư vấn giám sát trưởng"}</span>
                <span>Chữ ký:..........................................</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
