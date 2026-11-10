"use client";

import { useEffect, useState } from "react";
import { loadRecordSet, reviseRecord, type RecordSet } from "@/lib/weldQualityClient";
import WeldAcceptanceRecordPages, { ACCEPTANCE_DOCS, acceptancePrintCss } from "@/components/WeldAcceptanceRecordPages";
import { SIGNER_PARTIES, loadSignerDefaults, saveSignerDefaults } from "@/lib/weldAcceptance";
import { loadPersonnelPickerRows } from "@/lib/personnelCertificatesDb";
import { loadJournalMachineOptions } from "@/lib/machineRunSchedulesDb";

/** Các mục thông tin trên mẫu dùng chung cho cả bộ — sửa một lần, áp dụng cho 3 biên bản. */
const SHARED_KEYS = ["dia_diem", "ben_moi", "ben_nhan", "pham_vi", "ngay_nghiem_thu", "ca_han", "bien_phap", "tuyen", "goong", "ten_tho_han", "id_tho_han", "may_han", "kmFrom", "kmTo", "so_bb",
  ...SIGNER_PARTIES.flatMap(([party]) => [`nguoi_${party}_1_ten`, `nguoi_${party}_1_cv`, `ngay_ky_${party}`])];
const input = "mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal";
const label = "block text-xs font-semibold text-slate-700";

export default function WeldAcceptancePrintPack({ record: initial, onClose, autoPrint = true }: {
  record: RecordSet; onClose: () => void; autoPrint?: boolean;
}) {
  const [record, setRecord] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [people, setPeople] = useState<{ name: string; code: string }[]>([]);
  const [machines, setMachines] = useState<string[]>([]);
  const missing = ACCEPTANCE_DOCS.filter((d) => !record.ho_so.some((h) => h.loai === d.loai));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !editing) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editing]);
  useEffect(() => {
    if (!autoPrint || missing.length) return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint, missing.length]);
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

  function openEditor() {
    // Giá trị hiện hành: bản sửa mới nhất của biên bản đầu tiên có giá trị, rồi tới dữ liệu đợt.
    const rfiInfo = (record.dot.phieu_yeu_cau_nghiem_thu?.thong_tin ?? {}) as Record<string, string>;
    const dot = { ...rfiInfo, ...((record.dot.thong_tin ?? {}) as Record<string, string>) };
    const infos = record.ho_so.map((h) => (latestOf(h.id)?.thong_tin ?? {}) as Record<string, string>);
    const defaults = loadSignerDefaults();
    setForm(Object.fromEntries(SHARED_KEYS.map((k) => {
      const saved = infos.map((i) => i[k]).find(Boolean) ?? dot[k];
      // Địa điểm cũ nhập «Lý trình …» đã có ở mục Vị trí nên không nạp lại vào ô này.
      if (saved && !(k === "dia_diem" && /^s*lý trình/i.test(String(saved)))) return [k, String(saved)];
      if (k === "ngay_nghiem_thu") return [k, String(record.dot.ngay_nghiem_thu ?? "").slice(0, 10)];
      return [k, String(defaults[k] ?? "")];
    })));
    setError("");
    setEditing(true);
  }

  async function save() {
    setBusy(true); setError("");
    try {
      saveSignerDefaults(form);
      for (const hoSo of record.ho_so) {
        const current = (latestOf(hoSo.id)?.thong_tin ?? {}) as Record<string, string>;
        await reviseRecord(hoSo.id, { ...current, ...form }, "Sửa thông tin in cả bộ hồ sơ");
      }
      setRecord(await loadRecordSet(String(record.dot.id)));
      setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được."); } finally { setBusy(false); }
  }

  const set = (key: string, value: string) => setForm((cur) => ({ ...cur, [key]: value }));
  const text = (key: string, text: string, placeholder = "", listId?: string) => (
    <label className={label}>{text}
      <input className={input} list={listId} placeholder={placeholder} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} />
    </label>
  );

  return <div className="acceptance-print-root fixed inset-0 z-[100] overflow-auto bg-slate-900/70 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="In bộ biên bản nghiệm thu">
    <style>{acceptancePrintCss}</style>
    <div className="weld-print-pack-actions mx-auto mb-3 flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-sm">Bộ hồ sơ: <b>(1) Phụ lục</b> · <b>(2) Nghiệm thu công việc</b> · <b>(3) Hoàn thành công việc</b>
        {missing.length > 0 && <span role="alert" className="text-amber-800"> — Thiếu {missing.length} biên bản. Hãy tải lại hồ sơ.</span>}</p>
      <div className="flex gap-2">
        <button type="button" disabled={missing.length > 0} onClick={() => (editing ? setEditing(false) : openEditor())} className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold disabled:opacity-50">{editing ? "Đóng sửa" : "Sửa thông tin in"}</button>
        <button type="button" disabled={missing.length > 0} onClick={() => window.print()} className="min-h-11 rounded-lg bg-[#0047AB] px-5 text-sm font-semibold text-white disabled:opacity-50">In / Lưu PDF</button>
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold">Thoát</button>
      </div>
    </div>
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
            <input type="date" className={input} value={form.ngay_nghiem_thu ?? ""} onChange={(e) => set("ngay_nghiem_thu", e.target.value)} />
          </label>
          <label className={label}>Ca hàn
            <select className={input} value={form.ca_han ?? ""} onChange={(e) => set("ca_han", e.target.value)}>
              <option value="">Tự động theo nhật ký</option><option value="ngay">Ngày</option><option value="dem">Đêm</option><option value="ngay-dem">Ngày và đêm</option>
            </select>
          </label>
          <label className={label}>Biện pháp hàn
            <select className={input} value={form.bien_phap ?? ""} onChange={(e) => set("bien_phap", e.target.value)}>
              <option value="">Tự động theo máy</option><option value="co-dinh">Hàn cố định</option><option value="di-dong">Hàn di động</option>
            </select>
          </label>
          <label className={label}>Tuyến
            <select className={input} value={form.tuyen ?? ""} onChange={(e) => set("tuyen", e.target.value)}>
              <option value="">Tự động theo mã mối hàn</option><option value="thuong">Tuyến thượng</option><option value="ha">Tuyến hạ</option><option value="ca-hai">Tuyến thượng và tuyến hạ</option>
            </select>
          </label>
          {text("goong", "Goòng phẳng", "KPS25-L8")}
          {text("so_bb", "Số biên bản", "FBW/01/BBNTCV")}
          <label className={label}>Tên thợ hàn (chọn từ Nhân sự hoặc nhập)
            <input list="pack-people" className={input} value={form.ten_tho_han ?? ""}
              onChange={(e) => { const name = e.target.value; const match = people.find((p) => p.name === name); setForm((cur) => ({ ...cur, ten_tho_han: name, ...(match?.code ? { id_tho_han: match.code } : {}) })); }} />
            <datalist id="pack-people">{people.map((p) => <option key={p.name + p.code} value={p.name}>{p.code}</option>)}</datalist>
          </label>
          {text("id_tho_han", "ID thợ hàn")}
          {text("may_han", "Máy hàn (chọn hoặc nhập)", "", "pack-machines")}
          <datalist id="pack-machines">{machines.map((m) => <option key={m} value={m} />)}</datalist>
          {text("kmFrom", "Vị trí: Km đầu", "3+862.74")}
          {text("kmTo", "Vị trí: Km cuối", "4+087.42")}
        </div>
        <p className="text-xs font-semibold text-slate-700">Khung chữ ký <span className="font-normal text-slate-500">— để trống ngày = lấy ngày nghiệm thu; người ký được nhớ cho lần in sau.</span></p>
        <div className="grid gap-2 sm:grid-cols-3">
          {SIGNER_PARTIES.map(([party, name]) => (
            <div key={party} className="space-y-1 rounded-lg border border-slate-200 p-2">
              <p className="text-xs font-semibold text-slate-600">{name}</p>
              <input aria-label={`${name}: họ và tên`} className={input} placeholder="Họ và tên" value={form[`nguoi_${party}_1_ten`] ?? ""} onChange={(e) => set(`nguoi_${party}_1_ten`, e.target.value)} />
              <input aria-label={`${name}: chức vụ`} className={input} placeholder="Chức vụ" value={form[`nguoi_${party}_1_cv`] ?? ""} onChange={(e) => set(`nguoi_${party}_1_cv`, e.target.value)} />
              <input aria-label={`${name}: ngày`} type="date" className={input} value={form[`ngay_ky_${party}`] ?? ""} onChange={(e) => set(`ngay_ky_${party}`, e.target.value)} />
            </div>
          ))}
        </div>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => void save()} className="min-h-10 rounded-lg bg-[#0047AB] px-5 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer">{busy ? "Đang lưu…" : "Lưu"}</button>
          <button type="button" disabled={busy} onClick={() => setEditing(false)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold cursor-pointer">Hủy</button>
        </div>
      </div>
    )}
    <WeldAcceptanceRecordPages record={record} />
  </div>;
}
