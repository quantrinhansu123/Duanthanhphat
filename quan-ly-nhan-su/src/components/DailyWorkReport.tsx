"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Plus, TrashSimple, X } from "@/components/icons";
import SelectMenu, { type SelectMenuOption } from "@/components/SelectMenu";
import {
  deleteEquipmentItem,
  deleteIncidentItem,
  deleteWorkItem,
  emptyEquipmentInput,
  emptyIncidentInput,
  emptyWorkInput,
  insertEquipmentItem,
  insertIncidentItem,
  insertWorkItem,
  loadDailyReport,
  type DailyEquipmentItem,
  type DailyIncidentItem,
  type DailyWorkItem,
  type EquipmentItemInput,
  type IncidentItemInput,
  type WorkItemInput,
  type WorkSection,
} from "@/lib/dailyReportDb";
import { loadPersonnelPickerRows } from "@/lib/personnelCertificatesDb";

type SubTab = "hom-nay" | "tiep-theo" | "thiet-bi" | "su-co";

type ModalState =
  | { kind: "work"; phan: WorkSection }
  | { kind: "equipment" }
  | { kind: "incident" };

type PersonnelOption = {
  id: string;
  name: string;
  chucVu: string;
  maNhanSu: string;
};

type ManpowerRole = "cht" | "ky_su" | "lai_may" | "tho_van_hanh" | "cong_nhan";

const SUB_TABS: { id: SubTab; label: string; short: string }[] = [
  { id: "hom-nay", label: "Công việc hôm nay", short: "A. Hôm nay" },
  { id: "tiep-theo", label: "Công việc ngày tiếp theo", short: "B. Tiếp theo" },
  { id: "thiet-bi", label: "Thiết bị sử dụng", short: "Thiết bị" },
  { id: "su-co", label: "Sự cố — Khó khăn", short: "Sự cố" },
];

const ROLE_KEYWORDS: Record<ManpowerRole, string[]> = {
  cht: ["cht", "chỉ huy trưởng", "chi huy truong", "chỉ huy"],
  ky_su: ["kỹ sư", "ky su", "kĩ sư", "ki su"],
  lai_may: ["lái máy", "lai may"],
  tho_van_hanh: ["thợ vận hành", "tho van hanh", "vận hành", "van hanh"],
  cong_nhan: ["công nhân", "cong nhan"],
};

const th =
  "border border-slate-300 bg-slate-100 px-2 py-2 text-left text-[11px] font-bold text-slate-700 whitespace-nowrap";
const td = "border border-slate-200 px-2 py-2 text-[12px] text-slate-800 align-middle";
const inputCls =
  "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-hidden focus:ring-2 focus:ring-[#0047ab]/25";
const labelCls = "mb-1 block text-[11px] font-semibold text-slate-600";

function displayDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function matchesRole(chucVu: string, role: ManpowerRole) {
  const text = chucVu.trim().toLocaleLowerCase("vi");
  if (!text) return false;
  return ROLE_KEYWORDS[role].some((kw) => text.includes(kw));
}

function optionsForRole(personnel: PersonnelOption[], role: ManpowerRole): SelectMenuOption[] {
  return personnel
    .filter((p) => matchesRole(p.chucVu, role))
    .map((p) => ({
      value: p.id,
      label: p.name,
      hint: [p.maNhanSu, p.chucVu].filter(Boolean).join(" · "),
    }));
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className={labelCls}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </label>
  );
}

function PersonnelSelect({
  label,
  role,
  personnel,
  valueId,
  onPick,
}: {
  label: string;
  role: ManpowerRole;
  personnel: PersonnelOption[];
  valueId: string;
  onPick: (id: string, name: string) => void;
}) {
  const options = useMemo(() => optionsForRole(personnel, role), [personnel, role]);
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <SelectMenu
        value={valueId}
        onChange={(id) => {
          const person = personnel.find((p) => p.id === id);
          onPick(id, person?.name ?? "");
        }}
        options={options}
        searchable
        placeholder={options.length ? "Chọn nhân sự..." : "Chưa có nhân sự phù hợp"}
        emptyLabel="Không có nhân sự với chức vụ này"
        searchPlaceholder="Tìm theo tên..."
        buttonClassName="h-9"
      />
    </div>
  );
}

function WorkFormModal({
  open,
  title,
  saving,
  personnel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  saving: boolean;
  personnel: PersonnelOption[];
  onClose: () => void;
  onSubmit: (values: WorkItemInput) => Promise<void>;
}) {
  const titleId = useId();
  const [form, setForm] = useState<WorkItemInput>(emptyWorkInput);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(emptyWorkInput());
      setError("");
    }
  }, [open]);

  if (!open) return null;

  function patch(p: Partial<WorkItemInput>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.hangMuc.trim()) {
      setError("Vui lòng nhập hạng mục công việc");
      return;
    }
    setError("");
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 id={titleId} className="text-sm sm:text-base font-bold text-slate-900">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Đóng">
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto px-4 py-4 sm:px-5 space-y-3">
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
          <Field label="Hạng mục công việc *" value={form.hangMuc} onChange={(v) => patch({ hangMuc: v })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tuyến hạ" value={form.tuyenHa} onChange={(v) => patch({ tuyenHa: v })} />
            <Field label="Tuyến thượng" value={form.tuyenThuong} onChange={(v) => patch({ tuyenThuong: v })} />
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
            <Field label="Đơn vị" value={form.donVi} onChange={(v) => patch({ donVi: v })} />
            <Field label="Đến hôm qua" value={form.denHomQua} onChange={(v) => patch({ denHomQua: v })} />
            <Field label="Hôm nay" value={form.homNay} onChange={(v) => patch({ homNay: v })} />
            <Field label="Tích lũy" value={form.tichLuy} onChange={(v) => patch({ tichLuy: v })} />
            <Field label="Thiết kế" value={form.thietKe} onChange={(v) => patch({ thietKe: v })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Loại máy" value={form.loaiMay} onChange={(v) => patch({ loaiMay: v })} className="sm:col-span-1" />
            <Field label="Máy — Bắt đầu" value={form.mayBatDau} onChange={(v) => patch({ mayBatDau: v })} />
            <Field label="Máy — Kết thúc" value={form.mayKetThuc} onChange={(v) => patch({ mayKetThuc: v })} />
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-5">
            <PersonnelSelect
              label="CHT"
              role="cht"
              personnel={personnel}
              valueId={form.chtId}
              onPick={(id, name) => patch({ chtId: id, chtTen: name })}
            />
            <PersonnelSelect
              label="Kỹ sư"
              role="ky_su"
              personnel={personnel}
              valueId={form.kySuId}
              onPick={(id, name) => patch({ kySuId: id, kySuTen: name })}
            />
            <PersonnelSelect
              label="Lái máy"
              role="lai_may"
              personnel={personnel}
              valueId={form.laiMayId}
              onPick={(id, name) => patch({ laiMayId: id, laiMayTen: name })}
            />
            <PersonnelSelect
              label="Thợ vận hành"
              role="tho_van_hanh"
              personnel={personnel}
              valueId={form.thoVanHanhId}
              onPick={(id, name) => patch({ thoVanHanhId: id, thoVanHanhTen: name })}
            />
            <PersonnelSelect
              label="Công nhân"
              role="cong_nhan"
              personnel={personnel}
              valueId={form.congNhanId}
              onPick={(id, name) => patch({ congNhanId: id, congNhanTen: name })}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Danh sách lấy từ Hồ sơ thợ hàn, lọc theo cột <span className="font-semibold">Chức vụ</span> tương ứng.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="NL — Bắt đầu" value={form.nlBatDau} onChange={(v) => patch({ nlBatDau: v })} />
            <Field label="NL — Kết thúc" value={form.nlKetThuc} onChange={(v) => patch({ nlKetThuc: v })} />
            <Field label="Ghi chú" value={form.ghiChu} onChange={(v) => patch({ ghiChu: v })} />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
              Hủy
            </button>
            <button type="submit" disabled={saving} className="h-10 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A] disabled:opacity-60 cursor-pointer">
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EquipmentFormModal({
  open,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: EquipmentItemInput) => Promise<void>;
}) {
  const titleId = useId();
  const [form, setForm] = useState<EquipmentItemInput>(emptyEquipmentInput);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(emptyEquipmentInput());
      setError("");
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tenThietBi.trim()) {
      setError("Vui lòng nhập tên thiết bị");
      return;
    }
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id={titleId} className="text-sm font-bold text-slate-900">Thêm thiết bị</h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Đóng">
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-4">
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
          <Field label="Thiết bị *" value={form.tenThietBi} onChange={(v) => setForm((f) => ({ ...f, tenThietBi: v }))} />
          <Field label="Số lượng" value={form.soLuong} onChange={(v) => setForm((f) => ({ ...f, soLuong: v }))} />
          <Field label="Ghi chú" value={form.ghiChu} onChange={(v) => setForm((f) => ({ ...f, ghiChu: v }))} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">Hủy</button>
            <button type="submit" disabled={saving} className="h-10 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A] disabled:opacity-60 cursor-pointer">
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IncidentFormModal({
  open,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: IncidentItemInput) => Promise<void>;
}) {
  const titleId = useId();
  const [form, setForm] = useState<IncidentItemInput>(emptyIncidentInput);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(emptyIncidentInput());
      setError("");
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.noiDung.trim()) {
      setError("Vui lòng nhập nội dung sự cố");
      return;
    }
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id={titleId} className="text-sm font-bold text-slate-900">Thêm sự cố</h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Đóng">
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-4">
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
          <Field label="Nội dung *" value={form.noiDung} onChange={(v) => setForm((f) => ({ ...f, noiDung: v }))} />
          <Field label="Phương án xử lý" value={form.phuongAnXuLy} onChange={(v) => setForm((f) => ({ ...f, phuongAnXuLy: v }))} />
          <Field label="Tình trạng xử lý" value={form.tinhTrangXuLy} onChange={(v) => setForm((f) => ({ ...f, tinhTrangXuLy: v }))} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">Hủy</button>
            <button type="submit" disabled={saving} className="h-10 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A] disabled:opacity-60 cursor-pointer">
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WorkTable({
  rows,
  onDelete,
}: {
  rows: DailyWorkItem[];
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        Chưa có công việc nào. Nhấn <span className="font-semibold text-slate-700">Thêm mới</span> để nhập.
      </div>
    );
  }

  return (
    <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[1100px] border-collapse">
        <thead>
          <tr>
            <th className={`${th} w-10`}>TT</th>
            <th className={th}>Hạng mục công việc</th>
            <th className={th}>Tuyến hạ</th>
            <th className={th}>Tuyến thượng</th>
            <th className={th}>Đơn vị</th>
            <th className={th}>Đến hôm qua</th>
            <th className={th}>Hôm nay</th>
            <th className={th}>Tích lũy</th>
            <th className={th}>Thiết kế</th>
            <th className={th}>Loại máy</th>
            <th className={th}>Máy BĐ</th>
            <th className={th}>Máy KT</th>
            <th className={th}>CHT</th>
            <th className={th}>Kỹ sư</th>
            <th className={th}>Lái máy</th>
            <th className={th}>Thợ VH</th>
            <th className={th}>CN</th>
            <th className={th}>NL BĐ</th>
            <th className={th}>NL KT</th>
            <th className={th}>Ghi chú</th>
            <th className={`${th} w-12`} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className="group/row hover:bg-slate-50/80">
              <td className={`${td} text-center font-semibold text-slate-500`}>{i + 1}</td>
              <td className={`${td} font-medium min-w-[180px]`}>{row.hangMuc || "—"}</td>
              <td className={td}>{row.tuyenHa || "—"}</td>
              <td className={td}>{row.tuyenThuong || "—"}</td>
              <td className={td}>{row.donVi || "—"}</td>
              <td className={`${td} text-center`}>{row.denHomQua || "—"}</td>
              <td className={`${td} text-center`}>{row.homNay || "—"}</td>
              <td className={`${td} text-center`}>{row.tichLuy || "—"}</td>
              <td className={`${td} text-center`}>{row.thietKe || "—"}</td>
              <td className={td}>{row.loaiMay || "—"}</td>
              <td className={`${td} text-center`}>{row.mayBatDau || "—"}</td>
              <td className={`${td} text-center`}>{row.mayKetThuc || "—"}</td>
              <td className={`${td} min-w-[100px]`}>{row.chtTen || "—"}</td>
              <td className={`${td} min-w-[100px]`}>{row.kySuTen || "—"}</td>
              <td className={`${td} min-w-[100px]`}>{row.laiMayTen || "—"}</td>
              <td className={`${td} min-w-[100px]`}>{row.thoVanHanhTen || "—"}</td>
              <td className={`${td} min-w-[100px]`}>{row.congNhanTen || "—"}</td>
              <td className={`${td} text-center`}>{row.nlBatDau || "—"}</td>
              <td className={`${td} text-center`}>{row.nlKetThuc || "—"}</td>
              <td className={td}>{row.ghiChu || "—"}</td>
              <td className={`${td} text-center`}>
                <button
                  type="button"
                  onClick={() => onDelete(row.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 opacity-0 transition group-hover/row:opacity-100 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                  aria-label="Xóa"
                >
                  <TrashSimple size={14} weight="bold" aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DailyWorkReport() {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const [activeTab, setActiveTab] = useState<SubTab>("hom-nay");
  const [reportDate, setReportDate] = useState(
    `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
  );
  const [workToday, setWorkToday] = useState<DailyWorkItem[]>([]);
  const [workNext, setWorkNext] = useState<DailyWorkItem[]>([]);
  const [equipment, setEquipment] = useState<DailyEquipmentItem[]>([]);
  const [incidents, setIncidents] = useState<DailyIncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState("");
  const [personnel, setPersonnel] = useState<PersonnelOption[]>([]);

  const reload = useCallback(async (date: string) => {
    setLoading(true);
    const bundle = await loadDailyReport(date);
    setWorkToday(bundle.workToday);
    setWorkNext(bundle.workNext);
    setEquipment(bundle.equipment);
    setIncidents(bundle.incidents);
    setLoadError(bundle.error ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload(reportDate);
  }, [reportDate, reload]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await loadPersonnelPickerRows();
        if (cancelled) return;
        setPersonnel(
          rows.map((row) => ({
            id: row.employee_id,
            name: row.ho_ten?.trim() || "—",
            chucVu: row.chuc_vu?.trim() || "",
            maNhanSu: row.ma_nhan_su?.trim() || "",
          })),
        );
      } catch {
        if (!cancelled) setPersonnel([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function openAdd() {
    if (activeTab === "hom-nay") setModal({ kind: "work", phan: "hom_nay" });
    else if (activeTab === "tiep-theo") setModal({ kind: "work", phan: "ngay_tiep_theo" });
    else if (activeTab === "thiet-bi") setModal({ kind: "equipment" });
    else setModal({ kind: "incident" });
  }

  const panelTitle =
    activeTab === "hom-nay"
      ? "A. Công việc ngày hôm nay"
      : activeTab === "tiep-theo"
        ? "B. Công việc ngày tiếp theo"
        : activeTab === "thiet-bi"
          ? "Thiết bị sử dụng"
          : "Sự cố — Khó khăn — Vướng mắc";

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
      {loadError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 sm:text-sm">
          <div className="font-semibold">Chế độ cục bộ</div>
          <div className="mt-0.5">
            Chạy file <span className="font-mono">supabase/bao_cao_ngay.sql</span> trên Supabase để lưu server. {loadError}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900">Báo cáo công việc ngày</h1>
          <p className="mt-0.5 text-xs text-slate-500">Bảng danh sách công việc đã nhập theo từng phần.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          Ngày báo cáo
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-hidden focus:ring-2 focus:ring-[#0047ab]/25"
          />
        </label>
      </div>

      <div className="mb-4">
        <div className="table-scroll overflow-x-auto">
          <div
            className="inline-flex min-w-max sm:min-w-0 sm:w-full gap-1 rounded-xl border border-slate-200 bg-slate-100/90 p-1 shadow-xs"
            role="tablist"
          >
            {SUB_TABS.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 sm:flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047ab]/25 ${
                    active
                      ? "bg-[#0047AB] text-white shadow-xs"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  <span className="sm:hidden">{tab.short}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{panelTitle}</h2>
            <p className="mt-0.5 text-xs text-slate-500">Ngày: {displayDate(reportDate)}</p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-3.5 text-xs font-semibold text-white shadow-xs cursor-pointer"
          >
            <Plus size={14} weight="bold" aria-hidden />
            Thêm mới
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Đang tải...</div>
        ) : activeTab === "hom-nay" ? (
          <WorkTable
            rows={workToday}
            onDelete={async (id) => {
              if (!window.confirm("Xóa hạng mục này?")) return;
              await deleteWorkItem(id);
              setWorkToday((rows) => rows.filter((r) => r.id !== id));
              showToast("Đã xóa hạng mục");
            }}
          />
        ) : activeTab === "tiep-theo" ? (
          <WorkTable
            rows={workNext}
            onDelete={async (id) => {
              if (!window.confirm("Xóa hạng mục này?")) return;
              await deleteWorkItem(id);
              setWorkNext((rows) => rows.filter((r) => r.id !== id));
              showToast("Đã xóa hạng mục");
            }}
          />
        ) : activeTab === "thiet-bi" ? (
          equipment.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              Chưa có thiết bị. Nhấn <span className="font-semibold text-slate-700">Thêm mới</span> để nhập.
            </div>
          ) : (
            <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={`${th} w-14`}>STT</th>
                    <th className={th}>Thiết bị</th>
                    <th className={`${th} w-28`}>Số lượng</th>
                    <th className={th}>Ghi chú</th>
                    <th className={`${th} w-12`} />
                  </tr>
                </thead>
                <tbody>
                  {equipment.map((row, i) => (
                    <tr key={row.id} className="group/eq hover:bg-slate-50/80">
                      <td className={`${td} text-center font-semibold text-slate-500`}>{i + 1}</td>
                      <td className={`${td} font-medium`}>{row.tenThietBi || "—"}</td>
                      <td className={`${td} text-center`}>{row.soLuong || "—"}</td>
                      <td className={td}>{row.ghiChu || "—"}</td>
                      <td className={`${td} text-center`}>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm("Xóa thiết bị này?")) return;
                            await deleteEquipmentItem(row.id);
                            setEquipment((rows) => rows.filter((r) => r.id !== row.id));
                            showToast("Đã xóa thiết bị");
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 opacity-0 transition group-hover/eq:opacity-100 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                          aria-label="Xóa"
                        >
                          <TrashSimple size={14} weight="bold" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : incidents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            Chưa có sự cố. Nhấn <span className="font-semibold text-slate-700">Thêm mới</span> để nhập.
          </div>
        ) : (
          <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${th} w-14`}>STT</th>
                  <th className={th}>Nội dung</th>
                  <th className={th}>Phương án xử lý</th>
                  <th className={th}>Tình trạng xử lý</th>
                  <th className={`${th} w-12`} />
                </tr>
              </thead>
              <tbody>
                {incidents.map((row, i) => (
                  <tr key={row.id} className="group/inc hover:bg-slate-50/80">
                    <td className={`${td} text-center font-semibold text-slate-500`}>{i + 1}</td>
                    <td className={td}>{row.noiDung || "—"}</td>
                    <td className={td}>{row.phuongAnXuLy || "—"}</td>
                    <td className={td}>{row.tinhTrangXuLy || "—"}</td>
                    <td className={`${td} text-center`}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm("Xóa sự cố này?")) return;
                          await deleteIncidentItem(row.id);
                          setIncidents((rows) => rows.filter((r) => r.id !== row.id));
                          showToast("Đã xóa sự cố");
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 opacity-0 transition group-hover/inc:opacity-100 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                        aria-label="Xóa"
                      >
                        <TrashSimple size={14} weight="bold" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <WorkFormModal
        open={modal?.kind === "work"}
        title={modal?.kind === "work" && modal.phan === "ngay_tiep_theo" ? "Thêm công việc ngày tiếp theo" : "Thêm công việc hôm nay"}
        saving={saving}
        personnel={personnel}
        onClose={() => setModal(null)}
        onSubmit={async (values) => {
          if (!modal || modal.kind !== "work") return;
          setSaving(true);
          try {
            const item = await insertWorkItem(reportDate, modal.phan, values);
            if (modal.phan === "hom_nay") setWorkToday((rows) => [...rows, item]);
            else setWorkNext((rows) => [...rows, item]);
            setModal(null);
            showToast("Đã thêm công việc");
          } finally {
            setSaving(false);
          }
        }}
      />

      <EquipmentFormModal
        open={modal?.kind === "equipment"}
        saving={saving}
        onClose={() => setModal(null)}
        onSubmit={async (values) => {
          setSaving(true);
          try {
            const item = await insertEquipmentItem(reportDate, values);
            setEquipment((rows) => [...rows, item]);
            setModal(null);
            showToast("Đã thêm thiết bị");
          } finally {
            setSaving(false);
          }
        }}
      />

      <IncidentFormModal
        open={modal?.kind === "incident"}
        saving={saving}
        onClose={() => setModal(null)}
        onSubmit={async (values) => {
          setSaving(true);
          try {
            const item = await insertIncidentItem(reportDate, values);
            setIncidents((rows) => [...rows, item]);
            setModal(null);
            showToast("Đã thêm sự cố");
          } finally {
            setSaving(false);
          }
        }}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
