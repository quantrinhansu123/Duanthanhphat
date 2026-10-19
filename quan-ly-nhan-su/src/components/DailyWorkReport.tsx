"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import ComboBoxInput from "@/components/ComboBoxInput";
import { Plus, TrashSimple, X } from "@/components/icons";
import MultiSelectMenu, { type MultiSelectOption } from "@/components/MultiSelectMenu";
import {
  deleteEquipmentItem,
  deleteIncidentItem,
  deleteWorkItem,
  emptyEquipmentInput,
  emptyIncidentInput,
  emptyWorkInput,
  formatPeopleNames,
  insertEquipmentItem,
  insertIncidentItem,
  insertWorkItem,
  loadDailyReport,
  loadDailyWorkFillFromJournal,
  loadHangMucSuggestions,
  workMachineKey,
  workMachineLabel,
  workTypeWeldMethod,
  type DailyEquipmentItem,
  type DailyIncidentItem,
  type DailyWorkItem,
  type DailyWorkMachine,
  type DailyWorkPerson,
  type DailyWorkType,
  type EquipmentItemInput,
  type IncidentItemInput,
  type WorkItemInput,
  type WorkSection,
} from "@/lib/dailyReportDb";
import { loadPersonnelPickerRows } from "@/lib/personnelCertificatesDb";
import { loadJournalMachineOptions, type JournalMachineOption } from "@/lib/machineRunSchedulesDb";
import { addHoursToWeldTime, DEFAULT_WELD_WORK_HOURS } from "@/lib/weldReportData";
import { deaccent } from "@/i18n/deaccent";

const LINE_TICK = "✓";

function isRailWeldingMachineType(loaiMay: string) {
  return loaiMay.trim().toLocaleLowerCase("vi").includes("hàn ray");
}

function todayIsoLocal() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Số mối tích lũy = hôm qua + hôm nay. */
function cumulativeWelds(denHomQua: string, homNay: string): string {
  const yesterday = Number(String(denHomQua).replace(",", ".").trim());
  const today = Number(String(homNay).replace(",", ".").trim());
  const y = Number.isFinite(yesterday) ? yesterday : 0;
  const t = Number.isFinite(today) ? today : 0;
  if (!String(denHomQua).trim() && !String(homNay).trim()) return "";
  const sum = y + t;
  return Number.isInteger(sum) ? String(sum) : String(sum);
}

type SubTab = { kind: "job" } | { kind: "thiet-bi" } | { kind: "su-co" };

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

/** Khớp chức vụ / vị trí trên hồ sơ nhân sự (nhan_su.chuc_vu). */
const ROLE_KEYWORDS: Record<ManpowerRole, string[]> = {
  cht: ["cht", "chi huy truong", "chi huy", "site manager", "construction manager"],
  ky_su: ["ky su", "ki su", "engineer"],
  lai_may: ["lai may"],
  tho_van_hanh: ["tho van hanh", "van hanh", "operator"],
  cong_nhan: ["cong nhan", "worker"],
};

const ROLE_EMPTY_LABEL: Record<ManpowerRole, string> = {
  cht: "Không có nhân sự vị trí CHT / Chỉ huy trưởng",
  ky_su: "Không có nhân sự vị trí Kỹ sư",
  lai_may: "Không có nhân sự vị trí Lái máy",
  tho_van_hanh: "Không có nhân sự vị trí Thợ vận hành",
  cong_nhan: "Không có nhân sự vị trí Công nhân",
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

function normalizeRoleText(value: string) {
  return deaccent(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesRole(chucVu: string, role: ManpowerRole) {
  const text = normalizeRoleText(chucVu);
  if (!text) return false;
  // CHT: khớp mã CHT đứng riêng (tránh dính chữ khác) hoặc cụm Chỉ huy trưởng.
  if (role === "cht") {
    if (/(^|[^a-z0-9])cht([^a-z0-9]|$)/.test(text)) return true;
  }
  return ROLE_KEYWORDS[role].some((kw) => text.includes(normalizeRoleText(kw)));
}

function optionsForRole(
  personnel: PersonnelOption[],
  role: ManpowerRole,
  selectedIds: string[] = [],
): MultiSelectOption[] {
  const selectedSet = new Set(selectedIds);
  const matched = personnel.filter((p) => matchesRole(p.chucVu, role));
  const matchedIds = new Set(matched.map((p) => p.id));
  const extras = personnel.filter((p) => selectedSet.has(p.id) && !matchedIds.has(p.id));
  // Ưu tiên đúng vị trí; vẫn hiện toàn bộ nhân sự để tick thêm khi cần.
  const rest = personnel.filter((p) => !matchedIds.has(p.id) && !selectedSet.has(p.id));
  const rows = [...matched, ...extras, ...rest];
  return rows.map((p) => ({
    value: p.id,
    label: p.name,
    hint: [p.maNhanSu, p.chucVu].filter(Boolean).join(" · "),
  }));
}

function peopleFromIds(personnel: PersonnelOption[], ids: string[]): DailyWorkPerson[] {
  return ids.map((id) => {
    const person = personnel.find((p) => p.id === id);
    return { id, ten: person?.name ?? "" };
  });
}

function allPersonnelOptions(personnel: PersonnelOption[]): MultiSelectOption[] {
  return personnel.map((p) => ({
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

function PersonnelMultiSelect({
  label,
  role,
  personnel,
  values,
  onChange,
}: {
  label: string;
  role: ManpowerRole;
  personnel: PersonnelOption[];
  values: DailyWorkPerson[];
  onChange: (people: DailyWorkPerson[]) => void;
}) {
  const selectedIds = useMemo(() => values.map((p) => p.id).filter(Boolean), [values]);
  const options = useMemo(
    () => optionsForRole(personnel, role, selectedIds),
    [personnel, role, selectedIds],
  );
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <MultiSelectMenu
        values={selectedIds}
        onChange={(ids) => onChange(peopleFromIds(personnel, ids))}
        options={options}
        allLabel={options.length ? `Chọn ${label} (nhiều người)...` : ROLE_EMPTY_LABEL[role]}
        searchPlaceholder="Tìm theo tên / mã / vị trí..."
        buttonClassName="h-9"
      />
    </div>
  );
}

function PerformerMultiSelect({
  personnel,
  values,
  onChange,
}: {
  personnel: PersonnelOption[];
  values: DailyWorkPerson[];
  onChange: (people: DailyWorkPerson[]) => void;
}) {
  const selectedIds = useMemo(() => values.map((p) => p.id).filter(Boolean), [values]);
  const options = useMemo(() => allPersonnelOptions(personnel), [personnel]);
  return (
    <div>
      <span className={labelCls}>Người thực hiện</span>
      <MultiSelectMenu
        values={selectedIds}
        onChange={(ids) => onChange(peopleFromIds(personnel, ids))}
        options={options}
        allLabel={options.length ? "Chọn người thực hiện (nhiều người)..." : "Chưa có nhân sự"}
        searchPlaceholder="Tìm theo tên / mã / vị trí..."
        buttonClassName="h-9"
      />
    </div>
  );
}

function LineCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#0047AB]"
      />
      {label}
    </label>
  );
}

function WorkFormModal({
  open,
  title,
  saving,
  personnel,
  machines,
  workTypes,
  hangMucOptions,
  phan,
  reportDate,
  onReportDateChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  saving: boolean;
  personnel: PersonnelOption[];
  machines: JournalMachineOption[];
  workTypes: DailyWorkType[];
  hangMucOptions: string[];
  phan: WorkSection;
  reportDate: string;
  onReportDateChange: (iso: string) => void;
  onClose: () => void;
  onSubmit: (values: WorkItemInput) => Promise<void>;
}) {
  const titleId = useId();
  const [workTypeId, setWorkTypeId] = useState(() => workTypes[0]?.id ?? "");
  const workType = workTypes.find((t) => t.id === workTypeId) ?? workTypes[0] ?? null;
  const [form, setForm] = useState<WorkItemInput>(() => emptyWorkInput(workType));
  const [error, setError] = useState("");
  const [filling, setFilling] = useState(false);
  const [fillNote, setFillNote] = useState("");

  const machineOptions = useMemo<MultiSelectOption[]>(
    () =>
      machines.map((m) => ({
        value: m.id,
        label: m.name.trim() || m.code,
        hint: [m.code, m.lastRunDate ? `chạy gần nhất ${displayDate(m.lastRunDate)}` : ""]
          .filter(Boolean)
          .join(" · "),
      })),
    [machines],
  );

  useEffect(() => {
    if (!open) return;
    const initialType = workTypes[0] ?? null;
    setWorkTypeId(initialType?.id ?? "");
    setForm(emptyWorkInput(initialType));
    setError("");
    setFillNote("");
    setFilling(false);
  }, [open, workTypes]);

  if (!open) return null;

  const railMachine = isRailWeldingMachineType(workType?.loaiMayMacDinh ?? "");
  const weldMethod = workTypeWeldMethod(workType);
  const canFillFromJournal = phan === "hom_nay" && Boolean(weldMethod);

  function pickWorkType(id: string) {
    const prevType = workType;
    const nextType = workTypes.find((t) => t.id === id) ?? null;
    setWorkTypeId(id);
    setForm((current) => {
      const blank = emptyWorkInput(nextType);
      const keepHangMuc =
        current.hangMuc.trim() && current.hangMuc !== (prevType?.ten ?? "")
          ? current.hangMuc
          : blank.hangMuc;
      return {
        ...blank,
        hangMuc: keepHangMuc,
        tuyenHa: current.tuyenHa,
        tuyenThuong: current.tuyenThuong,
        ghiChu: current.ghiChu,
        thucHien: current.thucHien,
        thucHienTen: current.thucHienTen,
      };
    });
    setFillNote("");
  }

  function patch(p: Partial<WorkItemInput>) {
    setForm((f) => {
      const next = { ...f, ...p };
      if ("denHomQua" in p || "homNay" in p) {
        next.tichLuy = cumulativeWelds(next.denHomQua, next.homNay);
      }
      return next;
    });
  }

  async function fillFromJournal() {
    if (!weldMethod) return;
    const date = reportDate.trim() || todayIsoLocal();
    setFilling(true);
    setError("");
    setFillNote("");
    try {
      if (reportDate !== date) onReportDateChange(date);
      const filled = await loadDailyWorkFillFromJournal(date, weldMethod);
      setForm((f) => {
        const homNay = filled.homNay || f.homNay;
        return {
          ...f,
          tenMoiHan: filled.tenMoiHan || f.tenMoiHan,
          homNay,
          tichLuy: cumulativeWelds(f.denHomQua, homNay),
          mayChay: filled.mayChay.length > 0 ? filled.mayChay : f.mayChay,
          ghiChu: filled.ghiChu || f.ghiChu,
        };
      });
      setFillNote(
        filled.entryCount > 0
          ? `Đã điền ${filled.homNay || 0} mối · ${filled.entryCount} bản ghi Nhật ký hàn (${weldMethod}) ngày ${displayDate(date)}.`
          : `Không có bản ghi Nhật ký hàn ${weldMethod} ngày ${displayDate(date)}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lấy được Nhật ký hàn");
    } finally {
      setFilling(false);
    }
  }

  function pickMachines(keys: string[]) {
    setForm((f) => ({
      ...f,
      mayChay: keys.map((key) => {
        const existing = f.mayChay.find((m) => workMachineKey(m) === key);
        if (existing) return existing;
        const machine = machines.find((m) => m.id === key);
        return {
          mayId: key.startsWith("code:") ? "" : key,
          maMay: machine?.code ?? "",
          tenMay: machine?.name ?? "",
          soLuong: "1",
          gioBatDau: "",
          gioKetThuc: "",
        };
      }),
    }));
  }

  function patchMachine(index: number, p: Partial<DailyWorkMachine>) {
    setForm((f) => ({
      ...f,
      mayChay: f.mayChay.map((m, i) => (i === index ? { ...m, ...p } : m)),
    }));
  }

  const isNextDayPlan = phan === "ngay_tiep_theo";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.hangMuc.trim()) {
      setError("Vui lòng nhập hạng mục công việc");
      return;
    }
    if (!isNextDayPlan && railMachine && form.mayChay.length === 0) {
      setError("Vui lòng chọn máy hàn ray");
      return;
    }
    setError("");
    try {
      const base = {
        ...form,
        congViecId: workType?.id || form.congViecId,
        hangMuc: form.hangMuc.trim(),
      };
      await onSubmit(
        isNextDayPlan
          ? {
              ...emptyWorkInput(workType),
              hangMuc: base.hangMuc,
              congViecId: base.congViecId,
              tuyenHa: form.tuyenHa,
              tuyenThuong: form.tuyenThuong,
              thucHien: form.thucHien,
              thucHienTen: formatPeopleNames(form.thucHien),
              ghiChu: form.ghiChu.trim(),
            }
          : {
              ...base,
              tichLuy: cumulativeWelds(form.denHomQua, form.homNay),
            },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-xl ${isNextDayPlan ? "max-w-lg" : "max-w-3xl"}`}>
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
          {workTypes.length > 0 && (
            <label>
              <span className={labelCls}>Loại công việc *</span>
              <select
                value={workType?.id ?? ""}
                onChange={(e) => pickWorkType(e.target.value)}
                className={inputCls}
              >
                {workTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.ten}
                  </option>
                ))}
              </select>
            </label>
          )}
          {isNextDayPlan ? (
            <>
              <p className="text-xs text-slate-500">
                Chỉ nhập việc cần làm ngày tiếp theo — không cần số mối hàn hay máy.
              </p>
              <label>
                <span className={labelCls}>Việc cần làm *</span>
                <ComboBoxInput
                  value={form.hangMuc}
                  onChange={(hangMuc) => patch({ hangMuc })}
                  options={hangMucOptions}
                  placeholder="Chọn việc đã có hoặc nhập mới"
                  mono={false}
                  emptyLabel="Chưa có việc đã lưu — gõ để thêm mới"
                  inputClassName={inputCls}
                />
              </label>
              <div>
                <span className={labelCls}>Tuyến</span>
                <div className="flex flex-wrap gap-2">
                  <LineCheckbox
                    label="Tuyến hạ"
                    checked={Boolean(form.tuyenHa)}
                    onChange={(checked) => patch({ tuyenHa: checked ? LINE_TICK : "" })}
                  />
                  <LineCheckbox
                    label="Tuyến thượng"
                    checked={Boolean(form.tuyenThuong)}
                    onChange={(checked) => patch({ tuyenThuong: checked ? LINE_TICK : "" })}
                  />
                </div>
              </div>
              <PerformerMultiSelect
                personnel={personnel}
                values={form.thucHien}
                onChange={(thucHien) =>
                  patch({ thucHien, thucHienTen: formatPeopleNames(thucHien) })
                }
              />
              <Field label="Ghi chú" value={form.ghiChu} onChange={(v) => patch({ ghiChu: v })} />
            </>
          ) : (
            <>
              {canFillFromJournal && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-[10rem] flex-1">
                      <span className={labelCls}>Ngày</span>
                      <input
                        type="date"
                        value={reportDate}
                        onChange={(e) => onReportDateChange(e.target.value)}
                        className={inputCls}
                        aria-label="Ngày lấy từ Nhật ký hàn"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onReportDateChange(todayIsoLocal())}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      disabled={filling || saving || !reportDate}
                      onClick={() => void fillFromJournal()}
                      className="h-9 rounded-lg bg-[#0047AB] px-3 text-xs font-semibold text-white hover:bg-[#00388A] disabled:opacity-60 cursor-pointer"
                    >
                      {filling ? "Đang lấy..." : "Điền từ Nhật ký hàn"}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Chọn ngày trên lịch rồi điền số mối / máy / mã mối từ Nhật ký hàn ({weldMethod}).
                  </p>
                  {fillNote ? <p className="text-[11px] font-medium text-emerald-700">{fillNote}</p> : null}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={labelCls}>Nội dung công việc *</span>
                  <ComboBoxInput
                    value={form.hangMuc}
                    onChange={(hangMuc) => patch({ hangMuc })}
                    options={hangMucOptions}
                    placeholder="Chọn việc đã có hoặc nhập mới"
                    mono={false}
                    emptyLabel="Chưa có việc đã lưu — gõ để thêm mới"
                    inputClassName={inputCls}
                  />
                </label>
                <Field label="Tên mối hàn" value={form.tenMoiHan} onChange={(v) => patch({ tenMoiHan: v })} />
              </div>
              <div>
                <span className={labelCls}>Tuyến</span>
                <div className="flex flex-wrap gap-2">
                  <LineCheckbox
                    label="Tuyến hạ"
                    checked={Boolean(form.tuyenHa)}
                    onChange={(checked) => patch({ tuyenHa: checked ? LINE_TICK : "" })}
                  />
                  <LineCheckbox
                    label="Tuyến thượng"
                    checked={Boolean(form.tuyenThuong)}
                    onChange={(checked) => patch({ tuyenThuong: checked ? LINE_TICK : "" })}
                  />
                </div>
              </div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <Field label="Đơn vị" value={form.donVi} onChange={(v) => patch({ donVi: v })} />
                <Field label="Số mối hàn hôm qua" value={form.denHomQua} onChange={(v) => patch({ denHomQua: v })} />
                <Field label="Số mối hàn hôm nay" value={form.homNay} onChange={(v) => patch({ homNay: v })} />
                <label>
                  <span className={labelCls}>Số mối hàn tích lũy</span>
                  <input
                    value={form.tichLuy}
                    readOnly
                    className={`${inputCls} bg-slate-50 text-slate-700`}
                    aria-label="Số mối hàn tích lũy = hôm qua + hôm nay"
                    title="Tự tính: hôm qua + hôm nay"
                  />
                </label>
              </div>
              <div className="space-y-2">
                <div>
                  <span className={labelCls}>Loại máy{railMachine ? " *" : ""}</span>
                  <MultiSelectMenu
                    values={form.mayChay.map(workMachineKey)}
                    onChange={pickMachines}
                    options={machineOptions}
                    allLabel={machines.length ? "Chọn máy từ nhật ký chạy máy..." : "Chưa có máy trong nhật ký chạy máy"}
                    searchPlaceholder="Tìm máy..."
                    buttonClassName="h-9"
                  />
                </div>
                {form.mayChay.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                    <div className="text-[11px] font-semibold text-slate-600">
                      Tổng số máy:{" "}
                      <span className="font-mono tabular-nums text-slate-900">
                        {form.mayChay.reduce((sum, m) => sum + (Number(m.soLuong.replace(",", ".")) || 0), 0)}
                      </span>
                    </div>
                    {form.mayChay.map((m, index) => (
                      <div
                        key={workMachineKey(m)}
                        className="grid grid-cols-3 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_9rem_9rem]"
                      >
                        <div className="col-span-3 truncate text-sm font-semibold text-slate-800 sm:col-span-1 sm:pb-2">
                          {workMachineLabel(m) || "—"}
                        </div>
                        <label>
                          <span className={labelCls}>Số lượng</span>
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={m.soLuong}
                            onChange={(e) => patchMachine(index, { soLuong: e.target.value })}
                            className={inputCls}
                          />
                        </label>
                        <label>
                          <span className={labelCls}>Giờ bắt đầu</span>
                          <input
                            type="time"
                            value={m.gioBatDau}
                            onChange={(e) => {
                              const gioBatDau = e.target.value;
                              patchMachine(index, {
                                gioBatDau,
                                gioKetThuc: gioBatDau
                                  ? addHoursToWeldTime(gioBatDau, DEFAULT_WELD_WORK_HOURS)
                                  : "",
                              });
                            }}
                            className={inputCls}
                          />
                        </label>
                        <label>
                          <span className={labelCls}>Giờ kết thúc</span>
                          <input
                            type="time"
                            value={m.gioKetThuc}
                            onChange={(e) => patchMachine(index, { gioKetThuc: e.target.value })}
                            className={inputCls}
                            title="Tự điền khi chọn giờ bắt đầu hoặc khi Điền từ Nhật ký hàn"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-5">
                <PersonnelMultiSelect
                  label="CHT"
                  role="cht"
                  personnel={personnel}
                  values={form.cht}
                  onChange={(cht) => patch({ cht, chtTen: formatPeopleNames(cht) })}
                />
                <PersonnelMultiSelect
                  label="Kỹ sư"
                  role="ky_su"
                  personnel={personnel}
                  values={form.kySu}
                  onChange={(kySu) => patch({ kySu, kySuTen: formatPeopleNames(kySu) })}
                />
                <PersonnelMultiSelect
                  label="Lái máy"
                  role="lai_may"
                  personnel={personnel}
                  values={form.laiMay}
                  onChange={(laiMay) => patch({ laiMay, laiMayTen: formatPeopleNames(laiMay) })}
                />
                <PersonnelMultiSelect
                  label="Thợ vận hành"
                  role="tho_van_hanh"
                  personnel={personnel}
                  values={form.thoVanHanh}
                  onChange={(thoVanHanh) =>
                    patch({ thoVanHanh, thoVanHanhTen: formatPeopleNames(thoVanHanh) })
                  }
                />
                <PersonnelMultiSelect
                  label="Công nhân"
                  role="cong_nhan"
                  personnel={personnel}
                  values={form.congNhan}
                  onChange={(congNhan) =>
                    patch({ congNhan, congNhanTen: formatPeopleNames(congNhan) })
                  }
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Tick chọn nhiều người mỗi vai trò. Ưu tiên nhân sự đúng vị trí; vẫn chọn thêm người khác khi cần.
              </p>
              <Field label="Ghi chú" value={form.ghiChu} onChange={(v) => patch({ ghiChu: v })} />
            </>
          )}
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
          <Field label="Bộ phận" value={form.boPhan} onChange={(v) => setForm((f) => ({ ...f, boPhan: v }))} />
          <Field label="Người sử dụng" value={form.nguoiSuDung} onChange={(v) => setForm((f) => ({ ...f, nguoiSuDung: v }))} />
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
          <Field label="Người báo cáo" value={form.nguoiBaoCao} onChange={(v) => setForm((f) => ({ ...f, nguoiBaoCao: v }))} />
          <Field label="Bộ phận báo cáo" value={form.boPhanBaoCao} onChange={(v) => setForm((f) => ({ ...f, boPhanBaoCao: v }))} />
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

function MachineLines({
  machines,
  value,
}: {
  machines: DailyWorkMachine[];
  value: (machine: DailyWorkMachine) => string;
}) {
  if (machines.length === 0) return <>—</>;
  return (
    <>
      {machines.map((m, i) => (
        <div key={`${workMachineKey(m)}-${i}`} className="whitespace-nowrap leading-6">
          {value(m) || "—"}
        </div>
      ))}
    </>
  );
}

function WorkTable({
  rows,
  onDelete,
  planOnly = false,
}: {
  rows: DailyWorkItem[];
  onDelete: (id: string) => void;
  /** Ngày tiếp theo: chỉ hiện danh sách việc cần làm. */
  planOnly?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        Chưa có công việc nào. Nhấn <span className="font-semibold text-slate-700">Thêm mới</span> để nhập.
      </div>
    );
  }

  if (planOnly) {
    return (
      <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className={`${th} w-10`}>TT</th>
              <th className={th}>Việc cần làm</th>
              <th className={th}>Tuyến hạ</th>
              <th className={th}>Tuyến thượng</th>
              <th className={th}>Người thực hiện</th>
              <th className={th}>Ghi chú</th>
              <th className={`${th} w-12`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className="group/row hover:bg-slate-50/80">
                <td className={`${td} text-center font-semibold text-slate-500`}>{i + 1}</td>
                <td className={`${td} font-medium min-w-[220px]`}>{row.hangMuc || "—"}</td>
                <td className={`${td} text-center`}>{row.tuyenHa || ""}</td>
                <td className={`${td} text-center`}>{row.tuyenThuong || ""}</td>
                <td className={`${td} min-w-[140px]`}>{row.thucHienTen || "—"}</td>
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

  return (
    <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[1100px] border-collapse">
        <thead>
          <tr>
            <th className={`${th} w-10`}>TT</th>
            <th className={th}>Hạng mục công việc</th>
            <th className={th}>Tên mối hàn</th>
            <th className={th}>Tuyến hạ</th>
            <th className={th}>Tuyến thượng</th>
            <th className={th}>Đơn vị</th>
            <th className={th}>Số mối hàn hôm qua</th>
            <th className={th}>Số mối hàn hôm nay</th>
            <th className={th}>Số mối hàn tích lũy</th>
            <th className={th}>Loại máy</th>
            <th className={th}>Số lượng</th>
            <th className={th}>Giờ bắt đầu</th>
            <th className={th}>Giờ kết thúc</th>
            <th className={th}>CHT</th>
            <th className={th}>Kỹ sư</th>
            <th className={th}>Lái máy</th>
            <th className={th}>Thợ VH</th>
            <th className={th}>CN</th>
            <th className={th}>Ghi chú</th>
            <th className={`${th} w-12`} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className="group/row hover:bg-slate-50/80">
              <td className={`${td} text-center font-semibold text-slate-500`}>{i + 1}</td>
              <td className={`${td} font-medium min-w-[180px]`}>{row.hangMuc || "—"}</td>
              <td className={`${td} font-mono`}>{row.tenMoiHan || "—"}</td>
              <td className={`${td} text-center`}>{row.tuyenHa || ""}</td>
              <td className={`${td} text-center`}>{row.tuyenThuong || ""}</td>
              <td className={td}>{row.donVi || "—"}</td>
              <td className={`${td} text-center`}>{row.denHomQua || "—"}</td>
              <td className={`${td} text-center`}>{row.homNay || "—"}</td>
              <td className={`${td} text-center`}>{row.tichLuy || "—"}</td>
              <td className={td}>
                <MachineLines machines={row.mayChay} value={workMachineLabel} />
              </td>
              <td className={`${td} text-center`}>
                <MachineLines machines={row.mayChay} value={(m) => m.soLuong} />
              </td>
              <td className={`${td} text-center`}>
                <MachineLines machines={row.mayChay} value={(m) => m.gioBatDau} />
              </td>
              <td className={`${td} text-center`}>
                <MachineLines machines={row.mayChay} value={(m) => m.gioKetThuc} />
              </td>
              <td className={`${td} min-w-[100px]`}>{row.chtTen || "—"}</td>
              <td className={`${td} min-w-[100px]`}>{row.kySuTen || "—"}</td>
              <td className={`${td} min-w-[100px]`}>{row.laiMayTen || "—"}</td>
              <td className={`${td} min-w-[100px]`}>{row.thoVanHanhTen || "—"}</td>
              <td className={`${td} min-w-[100px]`}>{row.congNhanTen || "—"}</td>
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
  const [workTypes, setWorkTypes] = useState<DailyWorkType[]>([]);
  const [activeTab, setActiveTab] = useState<SubTab>({ kind: "job" });
  const [workSection, setWorkSection] = useState<WorkSection>("hom_nay");
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
  const [machines, setMachines] = useState<JournalMachineOption[]>([]);
  const [hangMucSaved, setHangMucSaved] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadJournalMachineOptions()
      .then((options) => {
        if (!cancelled) setMachines(options);
      })
      .catch(() => {
        if (!cancelled) setMachines([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadHangMucSuggestions()
      .then((options) => {
        if (!cancelled) setHangMucSaved(options);
      })
      .catch(() => {
        if (!cancelled) setHangMucSaved([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hangMucOptions = useMemo(() => {
    const uniq = new Map<string, string>();
    function add(raw: string) {
      const text = raw.trim();
      if (!text) return;
      const key = text.toLocaleLowerCase("vi");
      if (!uniq.has(key)) uniq.set(key, text);
    }
    // Ưu tiên danh mục loại công việc (tab gợi ý), rồi các giá trị đã lưu.
    for (const type of workTypes) add(type.ten);
    for (const v of hangMucSaved) add(v);
    for (const row of workToday) add(row.hangMuc);
    for (const row of workNext) add(row.hangMuc);
    const typeKeys = new Set(workTypes.map((t) => t.ten.trim().toLocaleLowerCase("vi")));
    const preferred = [...uniq.values()].filter((v) => typeKeys.has(v.toLocaleLowerCase("vi")));
    const rest = [...uniq.values()]
      .filter((v) => !typeKeys.has(v.toLocaleLowerCase("vi")))
      .sort((a, b) => a.localeCompare(b, "vi"));
    return [...preferred, ...rest];
  }, [hangMucSaved, workToday, workNext, workTypes]);

  const reload = useCallback(async (date: string) => {
    setLoading(true);
    const bundle = await loadDailyReport(date);
    setWorkTypes(bundle.workTypes);
    setWorkToday(bundle.workToday);
    setWorkNext(bundle.workNext);
    setEquipment(bundle.equipment);
    setIncidents(bundle.incidents);
    setLoadError(bundle.error ?? "");
    setActiveTab((current) => {
      if (current.kind === "thiet-bi" || current.kind === "su-co" || current.kind === "job") {
        return current;
      }
      return { kind: "job" };
    });
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
          rows
            .filter((row) => {
              const status = (row.trang_thai ?? "Hoạt động").trim();
              return !status || status === "Hoạt động";
            })
            .map((row) => ({
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

  const activeWorkRows = workSection === "hom_nay" ? workToday : workNext;

  function openAdd() {
    if (activeTab.kind === "job") {
      if (workSection === "hom_nay") setReportDate(todayIsoLocal());
      setModal({ kind: "work", phan: workSection });
    } else if (activeTab.kind === "thiet-bi") setModal({ kind: "equipment" });
    else setModal({ kind: "incident" });
  }

  const panelTitle =
    activeTab.kind === "job"
      ? "BC công việc"
      : activeTab.kind === "thiet-bi"
        ? "Thiết bị sử dụng"
        : "Sự cố — Khó khăn — Vướng mắc";

  const tabs: { key: string; label: string; short: string; tab: SubTab }[] = [
    { key: "job", label: "BC công việc", short: "BC CV", tab: { kind: "job" } },
    { key: "thiet-bi", label: "Thiết bị sử dụng", short: "Thiết bị", tab: { kind: "thiet-bi" } },
    { key: "su-co", label: "Sự cố — Khó khăn", short: "Sự cố", tab: { kind: "su-co" } },
  ];

  function isActiveTab(tab: SubTab) {
    return tab.kind === activeTab.kind;
  }

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
      {loadError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 sm:text-sm">
          <div className="font-semibold">Chế độ cục bộ / cảnh báo dữ liệu</div>
          <div className="mt-0.5">
            Chạy <span className="font-mono">supabase/bao_cao_ngay.sql</span> và{" "}
            <span className="font-mono">supabase/migration_20260924_danh_muc_cong_viec_bao_cao.sql</span> trên Supabase.
            {" "}{loadError}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900">Báo cáo công việc ngày</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Tab BC công việc — nhập A hôm nay / B tiếp theo; chọn loại công việc khi thêm mới.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          <label className="flex items-center gap-2">
            Ngày báo cáo
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-hidden focus:ring-2 focus:ring-[#0047ab]/25"
            />
          </label>
          <button
            type="button"
            onClick={() => setReportDate(todayIsoLocal())}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Hôm nay
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="table-scroll overflow-x-auto">
          <div
            className="inline-flex min-w-max gap-1 rounded-xl border border-slate-200 bg-slate-100/90 p-1 shadow-xs"
            role="tablist"
          >
            {tabs.map((item) => {
              const active = isActiveTab(item.tab);
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(item.tab)}
                  className={`flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047ab]/25 ${
                    active
                      ? "bg-[#0047AB] text-white shadow-xs"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  <span className="sm:hidden">{item.short}</span>
                  <span className="hidden sm:inline">{item.label}</span>
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

        {activeTab.kind === "job" && (
          <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {([
              { id: "hom_nay" as const, label: "A. Hôm nay" },
              { id: "ngay_tiep_theo" as const, label: "B. Ngày tiếp theo" },
            ]).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setWorkSection(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  workSection === item.id
                    ? "bg-white text-[#0047AB] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Đang tải...</div>
        ) : activeTab.kind === "job" ? (
          <WorkTable
            rows={activeWorkRows}
            planOnly={workSection === "ngay_tiep_theo"}
            onDelete={async (id) => {
              if (!window.confirm("Xóa hạng mục này?")) return;
              await deleteWorkItem(id);
              if (workSection === "hom_nay") setWorkToday((rows) => rows.filter((r) => r.id !== id));
              else setWorkNext((rows) => rows.filter((r) => r.id !== id));
              showToast("Đã xóa hạng mục");
            }}
          />
        ) : activeTab.kind === "thiet-bi" ? (
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
                    <th className={th}>Bộ phận</th>
                    <th className={th}>Người sử dụng</th>
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
                      <td className={td}>{row.boPhan || "—"}</td>
                      <td className={td}>{row.nguoiSuDung || "—"}</td>
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
                  <th className={th}>Người báo cáo</th>
                  <th className={th}>Bộ phận báo cáo</th>
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
                    <td className={td}>{row.nguoiBaoCao || "—"}</td>
                    <td className={td}>{row.boPhanBaoCao || "—"}</td>
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
        title={
          modal?.kind === "work"
            ? `Thêm · BC công việc · ${modal.phan === "ngay_tiep_theo" ? "Ngày tiếp theo" : "Hôm nay"}`
            : "Thêm công việc"
        }
        saving={saving}
        personnel={personnel}
        machines={machines}
        workTypes={workTypes}
        hangMucOptions={hangMucOptions}
        phan={modal?.kind === "work" ? modal.phan : "hom_nay"}
        reportDate={reportDate}
        onReportDateChange={setReportDate}
        onClose={() => setModal(null)}
        onSubmit={async (values) => {
          if (!modal || modal.kind !== "work") return;
          setSaving(true);
          try {
            const item = await insertWorkItem(reportDate, modal.phan, values);
            if (modal.phan === "hom_nay") setWorkToday((rows) => [...rows, item]);
            else setWorkNext((rows) => [...rows, item]);
            const added = item.hangMuc.trim();
            if (added) {
              setHangMucSaved((prev) => {
                const key = added.toLocaleLowerCase("vi");
                if (prev.some((v) => v.toLocaleLowerCase("vi") === key)) return prev;
                return [...prev, added].sort((a, b) => a.localeCompare(b, "vi"));
              });
            }
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
