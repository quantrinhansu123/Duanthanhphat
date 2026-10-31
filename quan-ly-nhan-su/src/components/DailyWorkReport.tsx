"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import ComboBoxInput from "@/components/ComboBoxInput";
import DailyWorkReportPrint, { type DailyPrintDay } from "@/components/DailyWorkReportPrint";
import { loadPhotoReport, type PhotoReport } from "@/lib/photoReportDb";
import { photoReportHasContent } from "@/components/PhotoReportPrintSheet";
import { loadAcceptedOnDate, loadReportWeather } from "@/lib/weldQualityClient";
import { CalendarBlank, Camera, CaretDown, Eye, PencilSimple, Plus, Printer, TrashSimple, X } from "@/components/icons";

const PhotoReportForm = dynamic(() => import("@/components/PhotoReport"), { ssr: false });
import MultiSelectMenu, { type MultiSelectOption } from "@/components/MultiSelectMenu";
import {
  deleteDailyReport,
  deleteEquipmentItem,
  deleteIncidentItem,
  deleteWorkItem,
  emptyEquipmentInput,
  emptyIncidentInput,
  emptyWorkInput,
  ensureDailyReportProject,
  formatPeopleNames,
  insertEquipmentItem,
  insertIncidentItem,
  insertWorkItem,
  loadDailyReport,
  loadDailyReportList,
  loadDailyWorkFillFromJournal,
  loadLastWorkDefaults,
  loadHangMucSuggestions,
  matchWorkType,
  workMachineKey,
  workMachineLabel,
  workTypeWeldMethod,
  type DailyEquipmentItem,
  type DailyIncidentItem,
  type DailyReportHeader,
  type DailyReportSummary,
  type DailyWorkItem,
  type DailyWorkMachine,
  type DailyWorkPerson,
  type DailyWorkType,
  type EquipmentItemInput,
  type IncidentItemInput,
  type WorkItemInput,
  type WorkSection,
} from "@/lib/dailyReportDb";
import SelectMenu from "@/components/SelectMenu";
import { loadPersonnelPickerRows } from "@/lib/personnelCertificatesDb";
import { loadJournalMachineOptions, type JournalMachineOption } from "@/lib/machineRunSchedulesDb";
import { loadProjects } from "@/lib/projectsDb";
import { loadProjectEquipment } from "@/lib/projectEquipmentDb";
import type { ProjectEquipment } from "@/lib/projectEquipment";
import { addHoursToWeldTime, DEFAULT_WELD_WORK_HOURS } from "@/lib/weldReportData";
import { deaccent } from "@/i18n/deaccent";
import { useLanguage } from "@/i18n/LanguageProvider";

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
function applyJournalFill(
  form: WorkItemInput,
  filled: {
    tenMoiHan: string;
    homNay: string;
    denHomQua: string;
    tuyenThuong?: string;
    tuyenHa?: string;
    chuaPhanLoai?: number;
    mayChay: DailyWorkMachine[];
    ghiChu: string;
  },
): WorkItemInput {
  const homNay = filled.homNay || form.homNay;
  const denHomQua = filled.denHomQua || form.denHomQua;
  return {
    ...form,
    tenMoiHan: filled.tenMoiHan || form.tenMoiHan,
    homNay,
    denHomQua,
    tuyenThuong: filled.tuyenThuong || form.tuyenThuong,
    tuyenHa: filled.tuyenHa || form.tuyenHa,
    tichLuy: cumulativeWelds(denHomQua, homNay),
    mayChay: filled.mayChay.length > 0 ? filled.mayChay : form.mayChay,
    ghiChu: [filled.ghiChu, filled.chuaPhanLoai ? `${filled.chuaPhanLoai} mối chưa gắn mã tọa độ (chưa phân tuyến/thanh)` : ""]
      .filter(Boolean)
      .join(" · ") || form.ghiChu,
  };
}

function cumulativeWelds(denHomQua: string, homNay: string): string {
  const yesterday = Number(String(denHomQua).replace(",", ".").trim());
  const today = Number(String(homNay).replace(",", ".").trim());
  const y = Number.isFinite(yesterday) ? yesterday : 0;
  const t = Number.isFinite(today) ? today : 0;
  if (!String(denHomQua).trim() && !String(homNay).trim()) return "";
  const sum = y + t;
  return Number.isInteger(sum) ? String(sum) : String(sum);
}

type ModalState = { kind: "work" } | { kind: "equipment" } | { kind: "incident" };

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

const inputCls =
  "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-hidden focus:ring-2 focus:ring-[#0047ab]/25";
const labelCls = "mb-1 block text-[11px] font-semibold text-slate-600";

function displayDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function StatusPill({ status }: { status: DailyReportSummary["trangThai"] }) {
  const tone =
    status === "Đã duyệt"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Đã gửi"
        ? "bg-blue-50 text-[#0047AB]"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>
      {status}
    </span>
  );
}

function DayActions({
  dateLabel,
  busy,
  onView,
  onEdit,
  onPrint,
  onDelete,
}: {
  dateLabel: string;
  busy?: boolean;
  onView: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={onView}
        disabled={busy}
        aria-label={`Xem ${dateLabel}`}
        title="Xem"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-[#0047AB] disabled:opacity-50 cursor-pointer"
      >
        <Eye size={16} weight="bold" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onEdit}
        disabled={busy}
        aria-label={`Sửa ${dateLabel}`}
        title="Sửa"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-[#0047AB] disabled:opacity-50 cursor-pointer"
      >
        <PencilSimple size={16} weight="bold" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onPrint}
        disabled={busy}
        aria-label={`In báo cáo ${dateLabel}`}
        title="In báo cáo"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-[#0047AB] disabled:opacity-50 cursor-pointer"
      >
        <Printer size={16} weight="bold" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        aria-label={`Xóa ${dateLabel}`}
        title="Xóa"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 cursor-pointer"
      >
        <TrashSimple size={16} weight="bold" aria-hidden />
      </button>
    </div>
  );
}

function EditorItem({
  title,
  hint,
  onDelete,
}: {
  title: string;
  hint?: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-800">{title}</div>
        {hint ? <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div> : null}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
        aria-label="Xóa"
        title="Xóa"
      >
        <TrashSimple size={14} weight="bold" aria-hidden />
      </button>
    </div>
  );
}

function DayEditorModal({
  open,
  date,
  workToday,
  workNext,
  equipment,
  incidents,
  onClose,
  onAdd,
  onDeleteWork,
  onDeleteEquipment,
  onDeleteIncident,
}: {
  open: boolean;
  date: string;
  workToday: DailyWorkItem[];
  workNext: DailyWorkItem[];
  equipment: DailyEquipmentItem[];
  incidents: DailyIncidentItem[];
  onClose: () => void;
  onAdd: (kind: ModalState["kind"]) => void;
  onDeleteWork: (id: string, phan: WorkSection) => void;
  onDeleteEquipment: (id: string) => void;
  onDeleteIncident: (id: string) => void;
}) {
  const titleId = useId();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 id={titleId} className="text-sm sm:text-base font-bold text-slate-900">
            Sửa báo cáo · {displayDate(date)}
          </h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Đóng">
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <EditorSection title="A. Hôm nay" onAdd={() => onAdd("work")} addLabel="Thêm công việc">
            {workToday.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có hạng mục</p>
            ) : (
              workToday.map((row) => (
                <EditorItem
                  key={row.id}
                  title={row.hangMuc || "Hạng mục"}
                  hint={[row.tenMoiHan, row.homNay && `${row.homNay} ${row.donVi}`.trim()].filter(Boolean).join(" · ")}
                  onDelete={() => onDeleteWork(row.id, "hom_nay")}
                />
              ))
            )}
          </EditorSection>
          <EditorSection title="B. Ngày tiếp theo" onAdd={() => onAdd("work")} addLabel="Thêm công việc">
            {workNext.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có hạng mục</p>
            ) : (
              workNext.map((row) => (
                <EditorItem
                  key={row.id}
                  title={row.hangMuc || "Hạng mục"}
                  hint={row.thucHienTen || row.ghiChu}
                  onDelete={() => onDeleteWork(row.id, "ngay_tiep_theo")}
                />
              ))
            )}
          </EditorSection>
          <EditorSection title="Thiết bị" onAdd={() => onAdd("equipment")} addLabel="Thêm thiết bị">
            {equipment.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có thiết bị</p>
            ) : (
              equipment.map((row) => (
                <EditorItem
                  key={row.id}
                  title={row.tenThietBi || "Thiết bị"}
                  hint={[row.soLuong, row.boPhan, row.nguoiSuDung].filter(Boolean).join(" · ")}
                  onDelete={() => onDeleteEquipment(row.id)}
                />
              ))
            )}
          </EditorSection>
          <EditorSection title="Sự cố" onAdd={() => onAdd("incident")} addLabel="Thêm sự cố">
            {incidents.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có sự cố</p>
            ) : (
              incidents.map((row) => (
                <EditorItem
                  key={row.id}
                  title={row.noiDung || "Sự cố"}
                  hint={[row.tinhTrangXuLy, row.nguoiBaoCao].filter(Boolean).join(" · ")}
                  onDelete={() => onDeleteIncident(row.id)}
                />
              ))
            )}
          </EditorSection>
        </div>
      </div>
    </div>
  );
}

function EditorSection({
  title,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-[#0047AB] hover:bg-blue-50 cursor-pointer"
        >
          <Plus size={12} weight="bold" aria-hidden />
          {addLabel}
        </button>
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
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

/** Nhân lực chỉ ghi số lượng: lưu thành 1 mục {id:"", ten:"3"} nên DB/in ấn giữ nguyên. */
function ManpowerCount({
  label,
  values,
  onChange,
}: {
  label: string;
  values: DailyWorkPerson[];
  onChange: (people: DailyWorkPerson[]) => void;
}) {
  const shown = values.length === 1 && !values[0].id ? values[0].ten : values.length ? String(values.length) : "";
  return (
    <label>
      <span className={labelCls}>{label}</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={shown}
        onChange={(e) => onChange(e.target.value.trim() ? [{ id: "", ten: e.target.value.trim() }] : [])}
        className={inputCls}
      />
    </label>
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
  projects,
  currentDuAnId,
  hangMucOptions,
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
  projects: { id: string; name: string }[];
  currentDuAnId: string;
  hangMucOptions: string[];
  reportDate: string;
  onReportDateChange: (iso: string) => void;
  onClose: () => void;
  onSubmit: (values: WorkItemInput, duAnId: string, phan: WorkSection) => Promise<void>;
}) {
  const titleId = useId();
  const [phan, setPhan] = useState<WorkSection>("hom_nay");
  const [projectId, setProjectId] = useState(currentDuAnId);
  const { lang } = useLanguage();
  const [form, setForm] = useState<WorkItemInput>(() => emptyWorkInput());
  const workType = matchWorkType(workTypes, form.hangMuc, form.congViecId);
  const [error, setError] = useState("");
  const [filling, setFilling] = useState(false);
  const [fillNote, setFillNote] = useState("");
  const [assignedMachines, setAssignedMachines] = useState<ProjectEquipment[]>([]);
  useEffect(() => {
    if (!open || !projectId) { setAssignedMachines([]); return; }
    let live = true;
    setAssignedMachines([]);
    loadProjectEquipment(projectId).then((rows) => { if (live) setAssignedMachines(rows.filter((m) => !m.missing)); }).catch((e) => { if (live) setError(e instanceof Error ? e.message : "Không tải được thiết bị dự án."); });
    return () => { live = false; };
  }, [open, projectId]);

  const machineOptions = useMemo<MultiSelectOption[]>(
    () =>
      (projectId ? assignedMachines.map((m) => ({ ...m, lastRunDate: "" })) : machines).map((m) => ({
        value: m.id,
        label: m.name.trim() || m.code,
        hint: [m.code, m.lastRunDate ? `chạy gần nhất ${displayDate(m.lastRunDate)}` : ""]
          .filter(Boolean)
          .join(" · "),
      })),
    [machines, projectId, assignedMachines],
  );

  useEffect(() => {
    if (!open) return;
    setPhan("hom_nay");
    setProjectId(currentDuAnId);
    setForm(emptyWorkInput());
    setError("");
    setFillNote("");
    setFilling(false);
  }, [open, currentDuAnId]);

  useEffect(() => {
    if (!open || phan !== "hom_nay") return;
    const type = matchWorkType(workTypes, form.hangMuc);
    const method = workTypeWeldMethod(type);
    if (!method || !type) return;
    const date = reportDate.trim() || todayIsoLocal();
    let cancelled = false;
    setFilling(true);
    setError("");
    void loadDailyWorkFillFromJournal(date, method, projectId || undefined)
      .then((filled) => {
        if (cancelled) return;
        setForm((current) =>
          applyJournalFill(
            {
              ...emptyWorkInput(type),
              hangMuc: current.hangMuc || type.ten,
              congViecId: type.id,
              tuyenHa: current.tuyenHa,
              tuyenThuong: current.tuyenThuong,
              cht: current.cht,
              kySu: current.kySu,
              laiMay: current.laiMay,
              thoVanHanh: current.thoVanHanh,
              congNhan: current.congNhan,
              vnr: current.vnr,
              chtTen: current.chtTen,
              kySuTen: current.kySuTen,
              laiMayTen: current.laiMayTen,
              thoVanHanhTen: current.thoVanHanhTen,
              congNhanTen: current.congNhanTen,
              vnrTen: current.vnrTen,
              mayChay: current.mayChay,
            },
            filled,
          ),
        );
        setFillNote(
          filled.entryCount > 0
            ? `Đã điền ${filled.homNay || 0} mối · ${filled.entryCount} bản ghi Nhật ký hàn (${method}) ngày ${displayDate(date)}.`
            : `Không có bản ghi Nhật ký hàn ${method} ngày ${displayDate(date)}.`,
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Không lấy được Nhật ký hàn");
      })
      .finally(() => {
        if (!cancelled) setFilling(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, phan, form.hangMuc, reportDate, workTypes, projectId]);

  // Chỉ lấy lần báo cáo trước của cùng dự án và hạng mục.
  useEffect(() => {
    if (!open || phan !== "hom_nay" || !form.hangMuc.trim()) return;
    let cancelled = false;
    void loadLastWorkDefaults(form.hangMuc, reportDate || todayIsoLocal(), projectId).then((last) => {
      if (cancelled || !last) return;
      setForm((f) => ({
        ...f,
        mayChay: f.mayChay.length ? f.mayChay : last.mayChay,
        cht: f.cht.length ? f.cht : last.cht,
        kySu: f.kySu.length ? f.kySu : last.kySu,
        laiMay: f.laiMay.length ? f.laiMay : last.laiMay,
        thoVanHanh: f.thoVanHanh.length ? f.thoVanHanh : last.thoVanHanh,
        congNhan: f.congNhan.length ? f.congNhan : last.congNhan,
        vnr: f.vnr.length ? f.vnr : last.vnr,
        chtTen: f.cht.length ? f.chtTen : last.chtTen,
        kySuTen: f.kySu.length ? f.kySuTen : last.kySuTen,
        laiMayTen: f.laiMay.length ? f.laiMayTen : last.laiMayTen,
        thoVanHanhTen: f.thoVanHanh.length ? f.thoVanHanhTen : last.thoVanHanhTen,
        congNhanTen: f.congNhan.length ? f.congNhanTen : last.congNhanTen,
        vnrTen: f.vnr.length ? f.vnrTen : last.vnrTen,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [open, phan, form.hangMuc, reportDate, projectId]);

  if (!open) return null;

  const railMachine = isRailWeldingMachineType(workType?.loaiMayMacDinh ?? "");
  const weldMethod = workTypeWeldMethod(workType);
  const canFillFromJournal = phan === "hom_nay" && Boolean(weldMethod);

  function patchHangMuc(hangMuc: string) {
    const type = matchWorkType(workTypes, hangMuc);
    setForm((current) => ({
      ...current,
      hangMuc,
      congViecId: type?.id ?? "",
      donVi:
        type?.donViMacDinh && (!current.donVi.trim() || current.donVi === "mối hàn")
          ? type.donViMacDinh
          : current.donVi,
    }));
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
      const filled = await loadDailyWorkFillFromJournal(date, weldMethod, projectId || undefined);
      setForm((f) => applyJournalFill(f, filled));
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
        const machine = assignedMachines.find((m) => m.id === key) ?? machines.find((m) => m.id === key);
        return {
          mayId: key.startsWith("code:") ? "" : key,
          maMay: machine?.code ?? "",
          tenMay: machine?.name ?? "",
          soLuong: String(assignedMachines.find((m) => m.id === key)?.quantity ?? 1),
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
    if (!projectId) {
      setError("Vui lòng chọn dự án");
      return;
    }
    if (!form.hangMuc.trim()) {
      setError("Vui lòng nhập nội dung công việc");
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
              donVi: form.donVi || workType?.donViMacDinh || "mối hàn",
              homNay: form.homNay.trim(),
              ghiChu: form.ghiChu.trim(),
            }
          : {
              ...base,
              tichLuy: cumulativeWelds(form.denHomQua, form.homNay),
            },
        projectId,
        phan,
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
          <div>
            <span className={labelCls}>Phần *</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {([
                { id: "hom_nay" as const, label: "A. Hôm nay" },
                { id: "ngay_tiep_theo" as const, label: "B. Ngày tiếp theo" },
              ]).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPhan(item.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    phan === item.id
                      ? "bg-white text-[#0047AB] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={labelCls}>Dự án *</span>
            <SelectMenu
              searchable
              value={projectId}
              onChange={setProjectId}
              options={projects.map((project) => ({ value: project.id, label: project.name }))}
              placeholder="Chọn dự án"
              emptyLabel="Chưa có dự án"
            />
          </div>
          {isNextDayPlan ? (
            <>
              <p className="text-xs text-slate-500">
                Nhập việc cần làm và khối lượng dự kiến ngày tiếp theo — máy và nhân lực không cần nhập.
              </p>
              <label>
                <span className={labelCls}>Việc cần làm *</span>
                <ComboBoxInput
                  value={form.hangMuc}
                  onChange={patchHangMuc}
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
              <div className="grid grid-cols-2 gap-3">
                <Field label="KL dự kiến ngày tiếp theo" value={form.homNay} onChange={(v) => patch({ homNay: v })} />
                <Field label="Đơn vị" value={form.donVi} onChange={(v) => patch({ donVi: v })} />
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
                    onChange={patchHangMuc}
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
                <Field label="Đơn vị" value={lang === "en" && form.donVi === "mối hàn" ? "Weld" : form.donVi} onChange={(v) => patch({ donVi: v })} />
                <Field label="Số mối hàn đến hôm qua" value={form.denHomQua} onChange={(v) => patch({ denHomQua: v })} />
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
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-6">
                {([
                  ["CHT", "cht", "chtTen"],
                  ["Kỹ sư", "kySu", "kySuTen"],
                  ["Lái máy", "laiMay", "laiMayTen"],
                  ["Thợ vận hành", "thoVanHanh", "thoVanHanhTen"],
                  ["Công nhân", "congNhan", "congNhanTen"],
                  ["Khác", "vnr", "vnrTen"],
                ] as const).map(([label, key, tenKey]) => (
                  <ManpowerCount
                    key={key}
                    label={label}
                    values={form[key]}
                    onChange={(people) => patch({ [key]: people, [tenKey]: formatPeopleNames(people) })}
                  />
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                Chỉ nhập số lượng người mỗi vai trò. Khác gồm VNR và nhân lực khác, không tính trùng vào Công nhân. Hệ thống nhớ và điền sẵn từ lần báo cáo trước.
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

export default function DailyWorkReport() {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const [workTypes, setWorkTypes] = useState<DailyWorkType[]>([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
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
  const [printOpen, setPrintOpen] = useState(false);
  const [printAuto, setPrintAuto] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busyRowId, setBusyRowId] = useState("");
  const [weather, setWeather] = useState("");
  const [temperature, setTemperature] = useState("");
  const [weatherStatus, setWeatherStatus] = useState("");
  const [reportList, setReportList] = useState<DailyReportSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [header, setHeader] = useState<DailyReportHeader | null>(null);
  const [acceptedCount, setAcceptedCount] = useState<number | null>(null);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [batchDays, setBatchDays] = useState<DailyPrintDay[] | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  /** Tab trong Báo cáo ngày: phiếu ngày | mẫu báo cáo ảnh. */
  const [innerTab, setInnerTab] = useState<"ngay" | "anh">("ngay");
  /** Chỉ mount form ảnh sau lần mở tab đầu — giữ mount để không tải lại base64 khi đổi tab. */
  const [photoTabReady, setPhotoTabReady] = useState(false);
  useEffect(() => {
    if (innerTab === "anh") setPhotoTabReady(true);
  }, [innerTab]);

  // In nhiều ngày: mỗi ngày một trang, đọc lại từ dữ liệu đã lưu (không đếm theo số lần in).
  async function printRange() {
    const picked = reportList
      .filter((r) => (!rangeFrom || r.ngayBaoCao >= rangeFrom) && (!rangeTo || r.ngayBaoCao <= rangeTo))
      .sort((a, b) => a.ngayBaoCao.localeCompare(b.ngayBaoCao))
      .slice(0, 31);
    if (!picked.length) { setToast("Không có phiếu nào trong khoảng ngày đã chọn."); return; }
    setBatchBusy(true);
    try {
      const days: DailyPrintDay[] = [];
      for (const row of picked) {
        const bundle = await loadDailyReport(row.ngayBaoCao);
        const accepted = await loadAcceptedOnDate(row.ngayBaoCao, row.duAnId).then((r) => r.count).catch(() => null);
        const photo = await loadPhotoForPrint(row.duAnId, row.ngayBaoCao);
        const conditions = await weatherForPrint(row.duAnId, row.ngayBaoCao);
        days.push({
          reportDate: row.ngayBaoCao,
          ...conditions,
          workToday: bundle.workToday,
          workNext: bundle.workNext,
          equipment: bundle.equipment,
          incidents: bundle.incidents,
          acceptedCount: accepted,
          duAnId: row.duAnId,
          projectName: projectLabel(row.duAnId),
          photo,
        });
      }
      setBatchDays(days); setPrintAuto(false); setPrintOpen(true);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Không tải được các phiếu để in.");
    } finally { setBatchBusy(false); }
  }
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // Tự lấy đúng dự án/ngày; phản hồi đến muộn không ghi đè nội dung đã sửa.
  const weatherEdited = useRef(false);
  useEffect(() => {
    weatherEdited.current = false;
    let cancelled = false;
    setWeather("");
    setTemperature("");
    if (!header?.duAnId) {
      setWeatherStatus("Thời tiết tự điền khi phiếu được gắn dự án; có thể nhập tay.");
      return;
    }
    setWeatherStatus("Đang lấy thời tiết theo địa điểm dự án…");
    loadReportWeather(header.duAnId, reportDate)
      .then((data) => {
        if (cancelled) return;
        if (!weatherEdited.current) {
          setWeather(data.thoiTiet);
          setTemperature(data.nhietDo);
        }
        setWeatherStatus("Tự điền từ Open-Meteo theo địa điểm dự án. Khác thực tế thì sửa trực tiếp.");
      })
      .catch((error) => {
        if (!cancelled) setWeatherStatus(error instanceof Error ? error.message : "Chưa lấy được thời tiết; có thể nhập tay.");
      });
    return () => { cancelled = true; };
  }, [reportDate, header?.duAnId]);

  async function weatherForPrint(projectId: string | null, date: string) {
    if (date === reportDate && projectId === header?.duAnId && (weather || temperature)) return { weather, temperature };
    if (projectId) {
      try {
        const result = await loadReportWeather(projectId, date);
        return { weather: result.thoiTiet, temperature: result.nhietDo };
      } catch { /* Thời tiết thiếu vẫn cho phép in nội dung báo cáo. */ }
    }
    return { weather: "", temperature: "" };
  }

  useEffect(() => {
    let cancelled = false;
    loadProjects({ includeProgress: false })
      .then((result) => {
        if (!cancelled) {
          setProjects(result.projects.map((project) => ({ id: project.id, name: project.name })));
        }
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pickersLoaded = useRef(false);
  const ensurePickersLoaded = useCallback(() => {
    if (pickersLoaded.current) return;
    pickersLoaded.current = true;
    loadJournalMachineOptions()
      .then(setMachines)
      .catch(() => setMachines([]));
    loadHangMucSuggestions()
      .then(setHangMucSaved)
      .catch(() => setHangMucSaved([]));
    loadPersonnelPickerRows()
      .then((rows) => {
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
      })
      .catch(() => setPersonnel([]));
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

  const reloadList = useCallback(async () => {
    const result = await loadDailyReportList();
    setReportList(result.rows);
    setListLoading(false);
  }, []);

  // Khối lượng nghiệm thu trong ngày (cần đăng nhập; lỗi/chưa đăng nhập thì bỏ trống, không chặn báo cáo).
  useEffect(() => {
    let cancelled = false;
    const load = () => loadAcceptedOnDate(reportDate, header?.duAnId)
      .then((r) => { if (!cancelled) setAcceptedCount(r.count); })
      .catch(() => { if (!cancelled) setAcceptedCount(null); });
    load();
    window.addEventListener("weld-quality-changed", load);
    return () => { cancelled = true; window.removeEventListener("weld-quality-changed", load); };
  }, [reportDate, header?.duAnId]);

  const reload = useCallback(async (date: string) => {
    setLoading(true);
    const bundle = await loadDailyReport(date);
    setHeader(bundle.header);
    setWorkTypes(bundle.workTypes);
    setWorkToday(bundle.workToday);
    setWorkNext(bundle.workNext);
    setEquipment(bundle.equipment);
    setIncidents(bundle.incidents);
    setLoadError(bundle.error ?? "");
    setLoading(false);
    return bundle;
  }, [setWorkTypes]);

  useEffect(() => {
    void reload(reportDate);
  }, [reportDate, reload]);

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

  const autoFilledDates = useRef(new Set<string>());

  useEffect(() => {
    if (loading || loadError) return;
    if (workToday.length > 0) return;
    if (autoFilledDates.current.has(reportDate)) return;
    const types = workTypes.filter((type) => workTypeWeldMethod(type));
    if (types.length === 0) return;
    autoFilledDates.current.add(reportDate);
    let cancelled = false;
    void (async () => {
      const seen = new Set<string>();
      const jobs = types.flatMap((type) => {
        const method = workTypeWeldMethod(type);
        if (!method || seen.has(method)) return [];
        seen.add(method);
        return [{ type, method }];
      });
      const fills = await Promise.all(
        jobs.map(async ({ type, method }) => {
          try {
            const filled = await loadDailyWorkFillFromJournal(reportDate, method, header?.duAnId || undefined);
            return filled.entryCount > 0 ? { type, filled } : null;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const created: DailyWorkItem[] = [];
      for (const row of fills) {
        if (!row) continue;
        try {
          created.push(
            await insertWorkItem(reportDate, "hom_nay", {
              ...applyJournalFill(emptyWorkInput(row.type), row.filled),
            }),
          );
        } catch {
          /* bỏ qua loại không điền được */
        }
      }
      if (!cancelled && created.length > 0) {
        setWorkToday(created);
        void reloadList();
        setToast(`Đã điền ${created.length} hạng mục từ Nhật ký hàn`);
        window.setTimeout(() => setToast(""), 2200);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, loadError, reportDate, workToday.length, workTypes, reloadList, header?.duAnId]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function projectLabel(duAnId: string | null | undefined) {
    if (!duAnId) return "—";
    return projects.find((project) => project.id === duAnId)?.name || "—";
  }

  async function loadPhotoForPrint(duAnId: string | null | undefined, date: string): Promise<PhotoReport | null> {
    if (!duAnId) return null;
    try {
      const res = await loadPhotoReport(duAnId, date);
      return photoReportHasContent(res.report) ? res.report : null;
    } catch {
      return null;
    }
  }

  function openAdd(kind: ModalState["kind"]) {
    ensurePickersLoaded();
    setAddMenuOpen(false);
    setModal({ kind });
  }

  async function openDayPrint(row: DailyReportSummary, autoPrint: boolean) {
    setBusyRowId(row.id);
    try {
      setPrintAuto(autoPrint);
      setReportDate(row.ngayBaoCao);
      const bundle = await reload(row.ngayBaoCao);
      const accepted = await loadAcceptedOnDate(row.ngayBaoCao, row.duAnId).then((r) => r.count).catch(() => null);
      const photo = await loadPhotoForPrint(row.duAnId, row.ngayBaoCao);
      const conditions = await weatherForPrint(row.duAnId, row.ngayBaoCao);
      setBatchDays([{
        reportDate: row.ngayBaoCao,
        ...conditions,
        workToday: bundle.workToday,
        workNext: bundle.workNext,
        equipment: bundle.equipment,
        incidents: bundle.incidents,
        acceptedCount: accepted,
        duAnId: row.duAnId,
        projectName: projectLabel(row.duAnId),
        photo,
      }]);
      setPrintOpen(true);
    } finally {
      setBusyRowId("");
    }
  }

  function viewDay(row: DailyReportSummary) {
    return openDayPrint(row, false);
  }

  function printDay(row: DailyReportSummary) {
    return openDayPrint(row, true);
  }

  function projectIdForDate(date: string, fallback?: string | null) {
    return fallback || reportList.find((row) => row.ngayBaoCao === date)?.duAnId || null;
  }

  /** Dự án gắn với phiếu ngày đang chọn (header hoặc danh sách). */
  const linkedProjectId = projectIdForDate(reportDate, header?.duAnId) || "";

  async function onPhotoProjectChange(id: string) {
    if (!id) {
      setHeader((h) => (h ? { ...h, duAnId: null } : h));
      return;
    }
    try {
      const next = await ensureDailyReportProject(reportDate, id);
      setHeader(next);
      void reloadList();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không gắn được dự án");
    }
  }

  // Vào tab ảnh: nếu phiếu ngày chưa có du_an_id nhưng danh sách đã biết → ghi lại (không reload list).
  useEffect(() => {
    if (innerTab !== "anh") return;
    const fromList = reportList.find((row) => row.ngayBaoCao === reportDate)?.duAnId;
    if (!fromList || header?.duAnId) return;
    let cancelled = false;
    ensureDailyReportProject(reportDate, fromList)
      .then((next) => {
        if (!cancelled) setHeader(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [innerTab, reportDate, header?.duAnId, reportList]);

  async function printCurrent() {
    setPrintAuto(false);
    const duAnId = projectIdForDate(reportDate, header?.duAnId);
    const photo = await loadPhotoForPrint(duAnId, reportDate);
    setBatchDays([{
      reportDate,
      weather,
      temperature,
      workToday,
      workNext,
      equipment,
      incidents,
      acceptedCount,
      duAnId,
      projectName: projectLabel(duAnId),
      photo,
    }]);
    setPrintOpen(true);
  }

  async function editDay(row: DailyReportSummary) {
    setBusyRowId(row.id);
    try {
      setReportDate(row.ngayBaoCao);
      await reload(row.ngayBaoCao);
      setEditorOpen(true);
    } finally {
      setBusyRowId("");
    }
  }

  async function deleteDay(row: DailyReportSummary) {
    if (!window.confirm(`Xóa phiếu ngày ${displayDate(row.ngayBaoCao)}?`)) return;
    setBusyRowId(row.id);
    try {
      await deleteDailyReport(row.id);
      if (reportDate === row.ngayBaoCao) {
        setHeader(null);
        setWorkToday([]);
        setWorkNext([]);
        setEquipment([]);
        setIncidents([]);
        setEditorOpen(false);
      }
      await reloadList();
      showToast("Đã xóa phiếu");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể xóa phiếu");
    } finally {
      setBusyRowId("");
    }
  }

  async function removeWork(id: string, phan: WorkSection) {
    if (!window.confirm("Xóa hạng mục này?")) return;
    try {
      await deleteWorkItem(id);
      if (phan === "hom_nay") setWorkToday((rows) => rows.filter((row) => row.id !== id));
      else setWorkNext((rows) => rows.filter((row) => row.id !== id));
      void reloadList();
      showToast("Đã xóa hạng mục");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể xóa");
    }
  }

  async function removeEquipment(id: string) {
    if (id.startsWith("project:")) { showToast("Thiết bị này được gán từ dự án. Chỉnh danh sách trong Quản lý dự án."); return; }
    if (!window.confirm("Xóa thiết bị này?")) return;
    try {
      await deleteEquipmentItem(id);
      setEquipment((rows) => rows.filter((row) => row.id !== id));
      void reloadList();
      showToast("Đã xóa thiết bị");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể xóa");
    }
  }

  async function removeIncident(id: string) {
    if (!window.confirm("Xóa sự cố này?")) return;
    try {
      await deleteIncidentItem(id);
      setIncidents((rows) => rows.filter((row) => row.id !== id));
      void reloadList();
      showToast("Đã xóa sự cố");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể xóa");
    }
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

      <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Trong báo cáo ngày">
          {([
            ["ngay", "Báo cáo ngày", CalendarBlank],
            ["anh", "Báo cáo ảnh", Camera],
          ] as const).map(([id, label, Icon]) => {
            const active = innerTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setInnerTab(id)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold cursor-pointer sm:text-sm ${
                  active
                    ? "bg-[#0047AB] text-white shadow-xs"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon size={15} weight={active ? "fill" : "regular"} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void printCurrent()}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-[#00388A] cursor-pointer sm:text-sm"
        >
          <Printer size={15} weight="bold" aria-hidden />
          In báo cáo
        </button>
      </div>

      {photoTabReady ? (
        <div className={innerTab === "anh" ? undefined : "hidden"} hidden={innerTab !== "anh"}>
          <PhotoReportForm
            embedded
            active={innerTab === "anh"}
            date={reportDate}
            onDateChange={setReportDate}
            projectId={linkedProjectId}
            onProjectIdChange={(id) => void onPhotoProjectChange(id)}
            projects={projects}
          />
        </div>
      ) : null}
      <div className={innerTab === "ngay" ? undefined : "hidden"} hidden={innerTab !== "ngay"}>
      <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900">Báo cáo công việc ngày</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Mỗi dòng là một ngày đã báo cáo. Nhấn Thêm mới để nhập công việc, thiết bị hoặc sự cố. Báo cáo ảnh nằm tab bên cạnh — in kèm nhau.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-600 shadow-xs sm:flex sm:flex-wrap sm:items-end sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <label className="col-span-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            Ngày báo cáo
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-hidden focus:ring-2 focus:ring-[#0047ab]/25 sm:w-auto"
            />
          </label>
          <button
            type="button"
            onClick={() => setReportDate(todayIsoLocal())}
            className="col-span-2 h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Hôm nay
          </button>
          <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            Thời tiết
            <input
              value={weather}
              onChange={(e) => {
                weatherEdited.current = true;
                setWeather(e.target.value);
              }}
              placeholder="Tự điền, có thể sửa"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-hidden focus:ring-2 focus:ring-[#0047ab]/25"
            />
          </label>
          <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            Nhiệt độ
            <span className="flex items-center gap-1.5">
            <input
              value={temperature}
              onChange={(e) => {
                weatherEdited.current = true;
                setTemperature(e.target.value);
              }}
              placeholder="°C"
              inputMode="decimal"
              className="h-10 w-full rounded-lg sm:w-16 border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-hidden focus:ring-2 focus:ring-[#0047ab]/25"
            />
            <span>°C</span>
            </span>
          </label>
          <p role="status" className="col-span-2 max-w-md text-[11px] font-normal text-slate-500 sm:basis-full">{weatherStatus}</p>
          <Link
            href="/nhat-ky-han"
            className="col-span-2 inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Mở Nhật ký hàn
          </Link>
        </div>
      </div>

      <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Danh sách đã báo cáo</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Xem, sửa, in hoặc xóa từng phiếu
            </p>
          </div>
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
            <div className="font-mono text-sm font-bold tabular-nums text-[#0047AB]">
              {reportList.length.toLocaleString("vi-VN")}
              <span className="ml-1 text-[11px] font-semibold text-slate-400">phiếu</span>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddMenuOpen((open) => !open)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-3.5 text-xs font-semibold text-white shadow-xs cursor-pointer"
              >
                <Plus size={14} weight="bold" aria-hidden />
                Thêm phiếu mới
                <CaretDown size={12} weight="bold" aria-hidden />
              </button>
              {addMenuOpen && (
                <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <button type="button" onClick={() => openAdd("work")} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                    Công việc
                  </button>
                  <button type="button" onClick={() => openAdd("equipment")} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                    Thiết bị
                  </button>
                  <button type="button" onClick={() => openAdd("incident")} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                    Sự cố
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs text-slate-600">
          <span className="font-semibold">In nhiều ngày:</span>
          <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} aria-label="Từ ngày" className="h-9 rounded-lg border border-slate-300 px-2" />
          <span>–</span>
          <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} aria-label="Đến ngày" className="h-9 rounded-lg border border-slate-300 px-2" />
          <button type="button" onClick={() => void printRange()} disabled={batchBusy || !reportList.length}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            <Printer size={14} weight="bold" aria-hidden />
            {batchBusy ? "Đang tải…" : "In các ngày"}
          </button>
          <span className="text-slate-400">tối đa 31 ngày, mỗi ngày một trang</span>
        </div>
        {listLoading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Đang tải danh sách...</div>
        ) : reportList.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Chưa có phiếu báo cáo. Nhấn <span className="font-semibold text-slate-700">Thêm phiếu mới</span> để nhập công việc —
            phiếu sẽ hiện ở đây.
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 sm:hidden">
              {reportList.map((row) => {
                const active = row.ngayBaoCao === reportDate;
                return (
                  <div
                    key={row.id}
                    className={`px-4 py-3 ${active ? "bg-blue-50/80" : "bg-white"}`}
                  >
                    <button
                      type="button"
                      onClick={() => setReportDate(row.ngayBaoCao)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CalendarBlank size={14} weight="bold" className="text-[#0047AB]" aria-hidden />
                          <span className="font-mono text-sm font-bold text-slate-900">{displayDate(row.ngayBaoCao)}</span>
                          <StatusPill status={row.trangThai} />
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {projectLabel(row.duAnId)} · {row.workTodayCount} hạng mục · {row.equipmentCount} thiết bị · {row.incidentCount} sự cố
                        </div>
                      </div>
                      {active && <span className="text-[11px] font-bold text-[#0047AB]">Đang xem</span>}
                    </button>
                    <div className="mt-2 flex justify-end">
                      <DayActions
                        dateLabel={displayDate(row.ngayBaoCao)}
                        busy={busyRowId === row.id}
                        onView={() => void viewDay(row)}
                        onEdit={() => void editDay(row)}
                        onPrint={() => void printDay(row)}
                        onDelete={() => void deleteDay(row)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="table-scroll hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5">Ngày</th>
                    <th className="px-3 py-2.5">Dự án</th>
                    <th className="px-3 py-2.5">Trạng thái</th>
                    <th className="px-3 py-2.5 text-right">Hạng mục</th>
                    <th className="px-3 py-2.5 text-right">Ngày tới</th>
                    <th className="px-3 py-2.5 text-right">Thiết bị</th>
                    <th className="px-3 py-2.5 text-right">Sự cố</th>
                    <th className="px-3 py-2.5">Người lập</th>
                    <th className="px-3 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportList.map((row) => {
                    const active = row.ngayBaoCao === reportDate;
                    return (
                      <tr
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setReportDate(row.ngayBaoCao)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setReportDate(row.ngayBaoCao);
                          }
                        }}
                        className={`cursor-pointer transition-colors ${active ? "bg-blue-50/80" : "hover:bg-slate-50/80"}`}
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono font-semibold text-[#0047AB]">
                          {displayDate(row.ngayBaoCao)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">{projectLabel(row.duAnId)}</td>
                        <td className="px-3 py-2.5">
                          <StatusPill status={row.trangThai} />
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.workTodayCount}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-500">{row.workNextCount}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.equipmentCount}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.incidentCount}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.nguoiLap || "—"}</td>
                        <td className="px-3 py-2.5">
                          <DayActions
                            dateLabel={displayDate(row.ngayBaoCao)}
                            busy={busyRowId === row.id}
                            onView={() => void viewDay(row)}
                            onEdit={() => void editDay(row)}
                            onPrint={() => void printDay(row)}
                            onDelete={() => void deleteDay(row)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <DayEditorModal
        open={editorOpen}
        date={reportDate}
        workToday={workToday}
        workNext={workNext}
        equipment={equipment}
        incidents={incidents}
        onClose={() => setEditorOpen(false)}
        onAdd={openAdd}
        onDeleteWork={(id, phan) => void removeWork(id, phan)}
        onDeleteEquipment={(id) => void removeEquipment(id)}
        onDeleteIncident={(id) => void removeIncident(id)}
      />

      <WorkFormModal
        open={modal?.kind === "work"}
        title="Thêm công việc"
        saving={saving}
        personnel={personnel}
        machines={machines}
        workTypes={workTypes}
        projects={projects}
        currentDuAnId={header?.duAnId ?? ""}
        hangMucOptions={hangMucOptions}
        reportDate={reportDate}
        onReportDateChange={setReportDate}
        onClose={() => setModal(null)}
        onSubmit={async (values, duAnId, phan) => {
          if (!modal || modal.kind !== "work") return;
          setSaving(true);
          try {
            const item = await insertWorkItem(reportDate, phan, values, undefined, duAnId);
            setHeader((current) =>
              current
                ? { ...current, duAnId }
                : {
                    id: item.baoCaoId,
                    ngayBaoCao: reportDate,
                    ngayTiepTheo: null,
                    duAnId,
                    nguoiLap: "",
                    ghiChu: "",
                    trangThai: "Nháp",
                  },
            );
            if (phan === "hom_nay") setWorkToday((rows) => [...rows, item]);
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
            void reloadList();
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
            void reloadList();
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
            void reloadList();
            showToast("Đã thêm sự cố");
          } finally {
            setSaving(false);
          }
        }}
      />
      </>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <DailyWorkReportPrint
        open={printOpen}
        reportDate={reportDate}
        weather={weather}
        temperature={temperature}
        workTypes={workTypes}
        workToday={workToday}
        workNext={workNext}
        equipment={equipment}
        incidents={incidents}
        days={batchDays ?? undefined}
        acceptedCount={acceptedCount}
        duAnId={header?.duAnId}
        projectName={projectLabel(header?.duAnId)}
        autoPrint={printAuto}
        onClose={() => {
          setPrintOpen(false);
          setPrintAuto(false);
          setBatchDays(null);
        }}
        onPrint={() => window.print()}
      />
    </main>
  );
}
