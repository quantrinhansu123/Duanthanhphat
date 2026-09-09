"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CaretLeft, CaretRight, DotsThree, MagnifyingGlass, X } from "@/components/icons";
import {
  type MachineRunSchedule,
} from "@/data/machineAssignments";
import { getProjectPersonnel, type ProjectPersonnel } from "@/data/projectPersonnel";
import { getProjectWelds, type ProjectWeld, type ProjectWeldStatus } from "@/data/projectWelds";
import { type Project, type TheoreticalProgressRow } from "@/data/projects";
import { useProjectsData } from "@/hooks/useProjectsData";
import {
  loadMachineRunScheduleBundle,
} from "@/lib/machineRunSchedulesDb";
import {
  buildDailyWeldPlan,
  clampOffDaysToRange,
  deleteDuAn,
  flattenTheoreticalProgress,
  insertDuAn,
  projectDurationDays,
  projectWorkingDays,
  saveTheoreticalProgress,
  updateDuAn,
} from "@/lib/projectsDb";
import {
  downloadTheoreticalProgressExcelTemplate,
  exportTheoreticalProgressToExcel,
  groupTheoreticalProgressByProject,
  parseTheoreticalProgressExcel,
} from "@/lib/parseTheoreticalProgressExcel";
import {
  loadPersonnelCertificateRows,
  type PersonnelCertificateRow,
} from "@/lib/personnelCertificatesDb";
import { useCatalogOptions } from "@/hooks/useSystemCatalogs";
import { loadMachineCatalog } from "@/lib/machineCatalogDb";
import type { Machine } from "@/data/machines";
import { welders } from "@/data/welders";
import { REPORT_MACHINES } from "@/lib/weldReportData";

const MACHINE_TYPES = [...REPORT_MACHINES];
const activeWelders = welders.filter((w) => w.status === "Hoạt động");

const statusStyle: Record<Project["status"], string> = {
  "Đang triển khai": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Hoàn thành": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Tạm dừng": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

const weldStatusStyle: Record<ProjectWeldStatus, string> = {
  Đạt: "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  Lỗi: "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  "Chờ kiểm tra": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

const statusOptions: Project["status"][] = ["Đang triển khai", "Hoàn thành", "Tạm dừng"];

type DetailTab = "info" | "personnel" | "work" | "progress" | "machines";

function viDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("vi-VN");
}

function emptyProject(): Project {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const firstDayOfCurrentMonth = `${today.slice(0, 8)}01`;
  return {
    id: "",
    name: "",
    manager: "",
    managerId: undefined,
    plant: "",
    staffCount: 0,
    machineCount: 0,
    status: "Đang triển khai",
    startDate: firstDayOfCurrentMonth,
    endDate: today,
    location: "",
    plannedWeldCount: 0,
    personnelIds: [],
    machineTypes: [],
    weldTypes: [],
    railTypes: [],
    offDays: [],
  };
}

function toggleItem(list: string[], item: string) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

const WEEKDAYS_VI = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTHS_VI = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

function OffDaysCalendar({
  startDate,
  endDate,
  offDays,
  onChange,
  readOnly,
}: {
  startDate: string;
  endDate: string;
  offDays: string[];
  onChange: (next: string[]) => void;
  readOnly: boolean;
}) {
  const initialView = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
  const [viewDate, setViewDate] = useState(initialView);
  const offSet = useMemo(() => new Set(offDays), [offDays]);

  useEffect(() => {
    if (startDate) setViewDate(new Date(`${startDate}T00:00:00`));
  }, [startDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startPad = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: startPad + daysInMonth }, (_, index) => {
    if (index < startPad) return null;
    return index - startPad + 1;
  });

  function isoForDay(day: number) {
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  }

  function inProjectRange(iso: string) {
    if (!startDate || !endDate) return false;
    return iso >= startDate && iso <= endDate;
  }

  function toggleDay(iso: string) {
    if (readOnly || !inProjectRange(iso)) return;
    onChange(toggleItem(offDays, iso).sort());
  }

  const sortedOff = [...offDays].sort();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs sm:text-[13px] font-semibold text-slate-700">Ngày nghỉ dự án</div>
          <p className="mt-0.5 text-[11px] font-normal text-slate-500">
            Bấm ngày trong khoảng dự án để đánh dấu nghỉ. Ngày nghỉ không được chia mối hàn lý thuyết.
          </p>
        </div>
        <div className="shrink-0 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold font-mono text-amber-800">
          {offDays.length} ngày nghỉ
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          aria-label="Tháng trước"
        >
          <CaretLeft size={14} weight="bold" />
        </button>
        <div className="text-sm font-bold text-slate-900">
          {MONTHS_VI[month]} {year}
        </div>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          aria-label="Tháng sau"
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS_VI.map((label) => (
          <div key={label} className="py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {label}
          </div>
        ))}
        {cells.map((day, index) => {
          if (!day) return <div key={`pad-${index}`} />;
          const iso = isoForDay(day);
          const inRange = inProjectRange(iso);
          const isOff = offSet.has(iso);
          return (
            <button
              key={iso}
              type="button"
              disabled={readOnly || !inRange}
              onClick={() => toggleDay(iso)}
              className={`h-9 rounded-lg text-xs font-semibold transition-colors ${
                isOff
                  ? "bg-amber-500 text-white shadow-xs"
                  : inRange
                    ? "bg-slate-50 text-slate-800 hover:bg-blue-50 hover:text-[#0047AB] cursor-pointer"
                    : "text-slate-300 cursor-not-allowed"
              } disabled:cursor-default`}
              title={isOff ? "Bỏ ngày nghỉ" : inRange ? "Chọn ngày nghỉ" : "Ngoài khoảng dự án"}
            >
              {day}
            </button>
          );
        })}
      </div>

      {sortedOff.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          {sortedOff.map((day) => (
            <button
              key={day}
              type="button"
              disabled={readOnly}
              onClick={() => toggleDay(day)}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:hover:bg-amber-50 cursor-pointer disabled:cursor-default"
              title={readOnly ? undefined : "Bỏ ngày nghỉ"}
            >
              {viDate(day)}
              {!readOnly && <span aria-hidden>×</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckboxGroup({
  label,
  hint,
  options,
  selected,
  onChange,
  readOnly,
  renderLabel,
  searchable = false,
}: {
  label: string;
  hint?: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  readOnly: boolean;
  renderLabel?: (option: string) => string;
  searchable?: boolean;
}) {
  const display = renderLabel ?? ((option: string) => option);
  const [search, setSearch] = useState("");
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  const visibleOptions = options.filter((option) => normalize(display(option)).includes(normalize(search.trim())))
    .sort((a, b) => Number(selected.includes(b)) - Number(selected.includes(a)));

  if (readOnly) {
    return (
      <div className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        {label}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.length > 0 ? (
            selected.map((item) => (
              <span
                key={item}
                className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
              >
                {display(item)}
              </span>
            ))
          ) : (
            <span className="text-xs sm:text-sm font-normal text-slate-400">Chưa chọn</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <fieldset className="block min-w-0 text-xs sm:text-[13px] font-semibold text-slate-700">
      <legend className="flex flex-wrap items-center gap-2">
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-[#0047AB] px-2 py-0.5 text-[11px] font-bold text-white font-mono">
            {selected.length}
          </span>
        )}
      </legend>
      {hint ? <p className="mt-1 text-xs font-normal text-slate-500">{hint}</p> : null}
      {searchable && <input type="search" aria-label={`Tìm ${label.toLowerCase()}`} placeholder="Gõ tên để tìm…" value={search} onChange={(e) => setSearch(e.target.value)} className="mt-2 h-9 w-full rounded-lg border border-slate-300 px-3 font-normal" />}
      <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2 space-y-0.5">
        <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 hover:bg-white rounded-lg cursor-pointer transition-colors border-b border-slate-200/80 pb-2 mb-0.5">
          <input
            type="checkbox"
            checked={visibleOptions.length > 0 && visibleOptions.every((opt) => selected.includes(opt))}
            disabled={visibleOptions.length === 0}
            onChange={() => {
              const all = visibleOptions.every((opt) => selected.includes(opt));
              onChange(all ? selected.filter((opt) => !visibleOptions.includes(opt)) : Array.from(new Set([...selected, ...visibleOptions])));
            }}
            className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
          />
          <span>Tất cả</span>
        </label>
        {visibleOptions.map((option) => (
          <label
            key={option}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm text-slate-700 hover:bg-white rounded-lg cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onChange(toggleItem(selected, option))}
              className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
            />
            <span className="truncate">{display(option)}</span>
          </label>
        ))}
        {visibleOptions.length === 0 && <p className="p-2 font-normal text-slate-500">Không tìm thấy kết quả</p>}
      </div>
    </fieldset>
  );
}

function TabAddButton({
  label,
  readOnly,
  onAdd,
  onStartEdit,
}: {
  label: string;
  readOnly: boolean;
  onAdd: () => void;
  onStartEdit?: (addAction?: () => void) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => (readOnly ? onStartEdit?.(onAdd) : onAdd())}
      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#0047AB]/30 bg-[#0047AB]/5 px-3 text-xs font-semibold text-[#0047AB] hover:bg-[#0047AB]/10 cursor-pointer transition-colors"
    >
      <span className="text-base leading-none">+</span>
      {label}
    </button>
  );
}

function ProjectTheoreticalProgressTab({
  projectName,
  rows,
  offDays = [],
}: {
  projectName: string;
  rows: TheoreticalProgressRow[];
  offDays?: string[];
}) {
  const total = rows.reduce((sum, row) => sum + row.so_moi_han, 0);
  const offDaySet = new Set(offDays);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs sm:text-sm text-slate-500">
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{rows.length}</strong> ngày ·{" "}
          <strong className="font-semibold text-[#0047AB] font-mono tabular-nums">{total.toLocaleString("vi-VN")}</strong>{" "}
          mối hàn lý thuyết
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0047AB]">
          Tự động tạo từ thông tin dự án
        </span>
      </div>
      <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs">
        <table className="w-full min-w-[520px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <th className="px-3.5 py-2.5">Ngày</th>
              <th className="px-3.5 py-2.5">Dự án</th>
              <th className="px-3.5 py-2.5 text-right">Số mối hàn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={`${row.ngay}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-3.5 py-2.5">
                  <span className="font-mono text-slate-900">{viDate(row.ngay)}</span>
                </td>
                <td className="px-3.5 py-2.5 font-medium text-slate-900">{projectName}</td>
                <td className="px-3.5 py-2.5 text-right">
                  {offDaySet.has(row.ngay) ? (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      Ngày nghỉ · 0
                    </span>
                  ) : (
                    <span className="font-mono font-semibold tabular-nums text-[#0047AB]">
                      {row.so_moi_han.toLocaleString("vi-VN")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-slate-500">
                  Nhập tổng mối hàn và khoảng ngày tại tab Thông tin để hệ thống tự tạo kế hoạch.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AllTheoreticalProgressTable({
  rows,
  loading,
  importing,
  onDownloadTemplate,
  onUploadExcel,
  onExportExcel,
  onChangeRow,
}: {
  rows: ReturnType<typeof flattenTheoreticalProgress>;
  loading: boolean;
  importing: boolean;
  onDownloadTemplate: () => void;
  onUploadExcel: (file: File | null) => void;
  onExportExcel: () => void;
  onChangeRow: (row: ReturnType<typeof flattenTheoreticalProgress>[number], next: TheoreticalProgressRow | null) => Promise<boolean>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<{ key: string; date: string; count: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  async function changeRow(row: ReturnType<typeof flattenTheoreticalProgress>[number], remove = false) {
    if (savingRef.current || importing) return;
    if (remove && !window.confirm(`Xóa kế hoạch ngày ${viDate(row.ngay)} của dự án ${row.du_an}?`)) return;
    if (!remove && (!editing?.date || !editing.count.trim() || !Number.isSafeInteger(Number(editing.count)) || Number(editing.count) < 0)) {
      window.alert("Nhập ngày hợp lệ và số mối hàn là số nguyên không âm.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await onChangeRow(row, remove ? null : { ngay: editing!.date, so_moi_han: Number(editing!.count) });
      if (saved) setEditing(null);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <div className="border-b border-slate-200 px-4 sm:px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              Tiến độ lý thuyết
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Số mối hàn dự kiến theo dự án theo ngày — tải mẫu Excel hoặc nhập file để cập nhật
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onDownloadTemplate}
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Tải mẫu Excel
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
              onChange={(e) => {
                onUploadExcel(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={importing || saving}
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-9 items-center rounded-lg border border-[#0047AB] bg-white px-3 text-xs font-semibold text-[#0047AB] hover:bg-blue-50 disabled:opacity-50 cursor-pointer"
            >
              {importing ? "Đang nhập…" : "Tải Excel lên"}
            </button>
            <button
              type="button"
              disabled={!rows.length}
              onClick={onExportExcel}
              className="inline-flex h-9 items-center rounded-lg border border-emerald-600 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
            >
              Xuất Excel ({rows.length})
            </button>
          </div>
        </div>
      </div>
      <div className="table-scroll overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <th className="px-4 py-3">Ngày</th>
              <th className="px-3.5 py-3">Dự án</th>
              <th className="px-3.5 py-3 text-right">Số mối hàn</th>
              <th className="px-3.5 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  Đang tải tiến độ lý thuyết…
                </td>
              </tr>
            ) : rows.length > 0 ? (
              rows.map((row, index) => (
                <tr key={`${row.du_an_id}-${row.ngay}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-900 whitespace-nowrap">
                    {editing?.key === `${row.du_an_id}-${row.ngay}` ? <input aria-label="Ngày kế hoạch" type="date" disabled={saving} value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className="rounded border border-slate-300 p-1" /> : viDate(row.ngay)}
                  </td>
                  <td className="px-3.5 py-3 font-medium text-slate-900">{row.du_an}</td>
                  <td className="px-3.5 py-3 text-right font-mono font-semibold tabular-nums text-[#0047AB]">
                    {editing?.key === `${row.du_an_id}-${row.ngay}` ? <input aria-label="Số mối hàn kế hoạch" type="number" min="0" step="1" disabled={saving} value={editing.count} onChange={(e) => setEditing({ ...editing, count: e.target.value })} className="w-24 rounded border border-slate-300 p-1 text-right" /> : row.so_moi_han.toLocaleString("vi-VN")}
                  </td>
                  <td className="px-3.5 py-3 text-right whitespace-nowrap">
                    {editing?.key === `${row.du_an_id}-${row.ngay}` ? <>
                      <button disabled={saving || importing} onClick={() => void changeRow(row)} className="px-2 text-blue-700 disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu"}</button>
                      <button disabled={saving} onClick={() => setEditing(null)} className="px-2 text-slate-600">Hủy</button>
                    </> : <>
                      <button disabled={saving || importing} onClick={() => setEditing({ key: `${row.du_an_id}-${row.ngay}`, date: row.ngay, count: String(row.so_moi_han) })} className="px-2 text-blue-700 disabled:opacity-50">Sửa</button>
                      <button disabled={saving || importing} onClick={() => void changeRow(row, true)} className="px-2 text-rose-700 disabled:opacity-50">Xóa</button>
                    </>}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  Chưa có kế hoạch. Tải mẫu Excel hoặc mở dự án để tạo tiến độ theo ngày.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProjectInfoFields({
  form,
  setForm,
  readOnly,
  personnelOptions,
  machineOptions,
  railOptions,
  weldOptions,
}: {
  form: Project;
  setForm: (p: Project) => void;
  readOnly: boolean;
  personnelOptions: PersonnelCertificateRow[];
  machineOptions: Machine[];
  railOptions: string[];
  weldOptions: string[];
}) {
  const [managerSuggestionsOpen, setManagerSuggestionsOpen] = useState(false);
  function updateForm(patch: Partial<Project>) {
    const next = { ...form, ...patch };
    next.staffCount = next.personnelIds.length;
    next.machineCount = next.machineTypes.length;
    next.offDays = clampOffDaysToRange(
      next.offDays ?? [],
      next.startDate,
      next.endDate,
    );
    if (patch.startDate !== undefined || patch.endDate !== undefined || patch.plannedWeldCount !== undefined || patch.offDays !== undefined) {
    next.theoreticalProgress = buildDailyWeldPlan(
      next.plannedWeldCount,
      next.startDate,
      next.endDate,
      next.offDays,
    );
    }
    setForm(next);
  }

  const durationDays = projectDurationDays(form.startDate, form.endDate);
  const workingDays = projectWorkingDays(form.startDate, form.endDate, form.offDays ?? []);
  const averagePerDay = workingDays > 0 ? form.plannedWeldCount / workingDays : 0;
  const managerSuggestions = useMemo(() => {
    const query = form.manager.trim().toLocaleLowerCase("vi");
    return personnelOptions
      .filter((person) => {
        const position = person.chuc_vu?.trim().toLocaleLowerCase("vi") ?? "";
        if (position && !position.includes("thợ hàn") && !position.includes("tổ trưởng")) return false;
        if (!query) return true;
        return [person.ho_ten, person.ma_nhan_su || "", person.chuc_vu || ""]
          .some((value) => value.toLocaleLowerCase("vi").includes(query));
      })
      .slice(0, 12);
  }, [form.manager, personnelOptions]);

  return (
    <div className="space-y-3.5">
      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Tên dự án
        <input
          readOnly={readOnly}
          value={form.name}
          onChange={(e) => updateForm({ name: e.target.value })}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
        />
      </label>
      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Người phụ trách
        {readOnly ? (
          <div className="mt-1.5 h-10 flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm text-slate-900">
            {form.manager || <span className="text-slate-400">Chưa chọn</span>}
          </div>
        ) : (
          <div className="relative mt-1.5">
            <input
              value={form.manager}
              onChange={(e) => {
                updateForm({ manager: e.target.value, managerId: undefined });
                setManagerSuggestionsOpen(true);
              }}
              onFocus={() => setManagerSuggestionsOpen(true)}
              onBlur={() => window.setTimeout(() => setManagerSuggestionsOpen(false), 150)}
              placeholder="Gõ tên hoặc mã nhân sự để chọn"
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150"
            />
            {managerSuggestionsOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {managerSuggestions.length > 0 ? managerSuggestions.map((person) => (
                  <button
                    key={person.employee_id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      updateForm({ manager: person.ho_ten, managerId: person.employee_id });
                      setManagerSuggestionsOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left hover:bg-blue-50"
                  >
                    <span className="block text-sm font-semibold text-slate-900">{person.ho_ten}</span>
                    <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                      {[person.ma_nhan_su, person.chuc_vu, person.to_han].filter(Boolean).join(" · ") || "Nhân sự"}
                    </span>
                  </button>
                )) : (
                  <div className="px-3 py-2 text-xs font-normal text-slate-500">Không tìm thấy nhân sự phù hợp</div>
                )}
              </div>
            )}
            {form.managerId && (
              <div className="mt-1 text-[11px] font-medium text-emerald-700">Đã liên kết hồ sơ nhân sự</div>
            )}
          </div>
        )}
      </label>
      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Vị trí
        <input
          readOnly={readOnly}
          value={form.location}
          onChange={(e) => updateForm({ location: e.target.value })}
          placeholder="VD: Hà Nội · Km 12+450"
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
        />
      </label>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Từ ngày
          <input
            readOnly={readOnly}
            type="date"
            value={form.startDate}
            onChange={(e) => updateForm({ startDate: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 font-mono"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Tới ngày
          <input
            readOnly={readOnly}
            type="date"
            min={form.startDate}
            value={form.endDate}
            onChange={(e) => updateForm({ endDate: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 font-mono"
          />
        </label>
      </div>

      <OffDaysCalendar
        startDate={form.startDate}
        endDate={form.endDate}
        offDays={form.offDays ?? []}
        onChange={(offDays) => updateForm({ offDays })}
        readOnly={readOnly}
      />

      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Tổng mối hàn dự tính
        <input
          readOnly={readOnly}
          type="number"
          min={0}
          step={1}
          value={form.plannedWeldCount}
          onChange={(e) => updateForm({ plannedWeldCount: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 font-mono"
        />
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tổng ngày</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900">{durationDays}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ngày làm việc</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900">{workingDays}</div>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bình quân/ngày LV</div>
          <div className="mt-1 font-mono text-xl font-bold text-[#0047AB]">
            {averagePerDay.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
          </div>
        </div>
        <p className="col-span-2 sm:col-span-3 text-xs text-slate-600">
          Khi lưu, hệ thống chia {form.plannedWeldCount.toLocaleString("vi-VN")} mối cho {workingDays} ngày làm việc
          {(form.offDays?.length ?? 0) > 0
            ? ` (bỏ ${(form.offDays ?? []).length} ngày nghỉ)`
            : ""}
          ; phần dư được cộng từ ngày làm việc đầu.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <CheckboxGroup
        label="Nhân sự tham gia"
        searchable
        hint="Chọn nhiều thợ hàn từ danh sách hồ sơ thợ hàn"
        options={personnelOptions.map((p) => p.employee_id)}
        selected={form.personnelIds}
        onChange={(personnelIds) => updateForm({ personnelIds })}
        readOnly={readOnly}
        renderLabel={(id) => {
          const person = personnelOptions.find((p) => p.employee_id === id);
          return person ? `${person.ho_ten} · ${person.chuc_vu || "Nhân sự"}` : id;
        }}
      />

      <CheckboxGroup
        label="Loại máy"
        hint="Chọn các loại máy hàn sử dụng trong dự án"
        options={machineOptions.map((m) => m.code)}
        selected={form.machineTypes}
        onChange={(machineTypes) => updateForm({ machineTypes })}
        readOnly={readOnly}
        renderLabel={(code) => {
          const machine = machineOptions.find((m) => m.code === code);
          return machine ? `${machine.code} · ${machine.name}` : code;
        }}
      />

      <CheckboxGroup
        label="Loại ray"
        hint="Chọn các loại ray áp dụng cho dự án"
        options={railOptions}
        selected={form.railTypes}
        onChange={(railTypes) => updateForm({ railTypes })}
        readOnly={readOnly}
      />

      <CheckboxGroup
        label="Loại mối hàn"
        hint="Chọn loại mối hàn áp dụng cho dự án"
        options={weldOptions}
        selected={form.weldTypes}
        onChange={(weldTypes) => updateForm({ weldTypes })}
        readOnly={readOnly}
      />
      </div>

      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Trạng thái
        {readOnly ? (
          <div className="mt-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[form.status]}`}>
              {form.status}
            </span>
          </div>
        ) : (
          <select
            value={form.status}
            onChange={(e) => updateForm({ status: e.target.value as Project["status"] })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {statusOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
      </label>
    </div>
  );
}

function ProjectPersonnelTab({
  projectId,
  rows,
  readOnly,
  onChange,
  onStartEdit,
}: {
  projectId: string;
  rows: ProjectPersonnel[];
  readOnly: boolean;
  onChange: (rows: ProjectPersonnel[]) => void;
  onStartEdit?: (addAction?: () => void) => void;
}) {
  const onDuty = rows.filter((p) => p.onDuty).length;

  function addRow() {
    const welder = activeWelders[0];
    if (!welder) return;
    onChange([
      ...rows,
      {
        id: `p-${Date.now()}`,
        projectId,
        name: welder.name,
        position: welder.position,
        role: "Nhân viên",
        onDuty: true,
        weldsToday: 0,
      },
    ]);
  }

  function updateRow(index: number, patch: Partial<ProjectPersonnel>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500">
          <span>
            <strong className="font-semibold text-slate-900 font-mono tabular-nums">{rows.length}</strong> nhân sự
          </span>
          <span className="text-slate-300">|</span>
          <span>
            <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{onDuty}</strong> đang trực
          </span>
        </div>
        <TabAddButton label="Thêm nhân sự" readOnly={readOnly} onAdd={addRow} onStartEdit={onStartEdit} />
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs">
        <table className="w-full border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <th className="px-3.5 py-2.5">Họ tên</th>
              <th className="px-3.5 py-2.5">Vị trí</th>
              <th className="px-3.5 py-2.5">Vai trò</th>
              <th className="px-3.5 py-2.5">Trạng thái</th>
              <th className="px-3.5 py-2.5 text-right">Mối hôm nay</th>
              {!readOnly && <th className="w-12 px-2 py-2.5" aria-label="Xóa" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p, index) =>
              readOnly ? (
                <PersonnelRow key={p.id} row={p} />
              ) : (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3.5 py-2.5">
                    <select
                      value={p.name}
                      onChange={(e) => {
                        const welder = activeWelders.find((w) => w.name === e.target.value);
                        updateRow(index, {
                          name: e.target.value,
                          position: welder?.position ?? p.position,
                        });
                      }}
                      className="h-9 w-full min-w-[140px] rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 outline-hidden"
                    >
                      {activeWelders.map((w) => (
                        <option key={w.id} value={w.name}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-700">{p.position}</td>
                  <td className="px-3.5 py-2.5">
                    <select
                      value={p.role}
                      onChange={(e) => updateRow(index, { role: e.target.value })}
                      className="h-9 w-full min-w-[110px] rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 outline-hidden"
                    >
                      {["Nhân viên", "Tổ trưởng", "Kiểm tra", "Giám sát"].map((role) => (
                        <option key={role}>{role}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.onDuty}
                        onChange={(e) => updateRow(index, { onDuty: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 accent-[#0047AB]"
                      />
                      <span className="text-xs font-medium text-slate-700">{p.onDuty ? "Đang trực" : "Nghỉ"}</span>
                    </label>
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    <input
                      type="number"
                      min={0}
                      value={p.weldsToday}
                      onChange={(e) =>
                        updateRow(index, { weldsToday: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="h-9 w-20 rounded-lg border border-slate-300 bg-white px-2 text-right text-xs font-mono text-slate-900 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 outline-hidden ml-auto block"
                    />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                      aria-label="Xóa"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ),
            )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 5 : 6} className="px-3 py-8 text-center text-xs sm:text-sm text-slate-500">
                  Chưa có nhân sự được gán cho dự án này.
                  {!readOnly && " Bấm «Thêm nhân sự» để gán thợ hàn."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PersonnelRow({ row }: { row: ProjectPersonnel }) {
  return (
    <tr className="hover:bg-slate-50/80 transition-colors duration-150">
      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{row.name}</td>
      <td className="px-3.5 py-2.5 text-slate-700">{row.position}</td>
      <td className="px-3.5 py-2.5 text-slate-700">{row.role}</td>
      <td className="px-3.5 py-2.5">
        {row.onDuty ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Đang trực
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
            Nghỉ
          </span>
        )}
      </td>
      <td className="px-3.5 py-2.5 text-right font-semibold font-mono tabular-nums text-slate-900">{row.weldsToday}</td>
    </tr>
  );
}

const WELD_STATUS_OPTIONS: ProjectWeldStatus[] = ["Đạt", "Lỗi", "Chờ kiểm tra"];

function ProjectWorkTab({
  projectId,
  rows,
  readOnly,
  onChange,
  onStartEdit,
}: {
  projectId: string;
  rows: ProjectWeld[];
  readOnly: boolean;
  onChange: (rows: ProjectWeld[]) => void;
  onStartEdit?: (addAction?: () => void) => void;
}) {
  const passed = rows.filter((w) => w.status === "Đạt").length;
  const failed = rows.filter((w) => w.status === "Lỗi").length;

  function addRow() {
    const welder = activeWelders[0];
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    onChange([
      ...rows,
      {
        id: `w-${Date.now()}`,
        projectId,
        weldId: `FBW-${stamp}-${rows.length + 1}`,
        performedAt: now.toISOString(),
        method: "FBW",
        machine: MACHINE_TYPES[0],
        welderName: welder?.name ?? "",
        status: "Chờ kiểm tra",
        errorReason: "",
      },
    ]);
  }

  function updateRow(index: number, patch: Partial<ProjectWeld>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500">
          <span>
            <strong className="font-semibold text-slate-900 font-mono tabular-nums">{rows.length}</strong> mối hàn
          </span>
          <span className="text-slate-300">|</span>
          <span>
            <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{passed}</strong> đạt ·{" "}
            <strong className="font-semibold text-rose-700 font-mono tabular-nums">{failed}</strong> lỗi
          </span>
        </div>
        <TabAddButton label="Thêm mối hàn" readOnly={readOnly} onAdd={addRow} onStartEdit={onStartEdit} />
      </div>
      <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <th className="px-3.5 py-2.5">ID mối hàn</th>
              <th className="px-3.5 py-2.5">Thời gian</th>
              <th className="px-3.5 py-2.5">PP hàn</th>
              <th className="px-3.5 py-2.5">Máy</th>
              <th className="px-3.5 py-2.5">Thợ hàn</th>
              <th className="px-3.5 py-2.5">Trạng thái</th>
              <th className="px-3.5 py-2.5">Lỗi gặp phải</th>
              {!readOnly && <th className="w-12 px-2 py-2.5" aria-label="Xóa" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((w, index) =>
              readOnly ? (
                <WeldRow key={w.id} row={w} />
              ) : (
                <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3.5 py-2.5">
                    <input
                      value={w.weldId}
                      onChange={(e) => updateRow(index, { weldId: e.target.value })}
                      className="h-9 w-full min-w-[100px] rounded-lg border border-slate-300 bg-white px-2 text-xs font-mono text-[#0047AB] focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 outline-hidden"
                    />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <input
                      type="datetime-local"
                      value={w.performedAt.slice(0, 16)}
                      onChange={(e) =>
                        updateRow(index, {
                          performedAt: e.target.value ? new Date(e.target.value).toISOString() : w.performedAt,
                        })
                      }
                      className="h-9 w-full min-w-[160px] rounded-lg border border-slate-300 bg-white px-2 text-xs font-mono text-slate-900 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 outline-hidden"
                    />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <select
                      value={w.method}
                      onChange={(e) => updateRow(index, { method: e.target.value as ProjectWeld["method"] })}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-[#0047AB] focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 outline-hidden"
                    >
                      <option value="FBW">FBW</option>
                      <option value="ATW">ATW</option>
                    </select>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <select
                      value={w.machine}
                      onChange={(e) => updateRow(index, { machine: e.target.value })}
                      className="h-9 w-full min-w-[88px] rounded-lg border border-slate-300 bg-white px-2 text-xs font-mono text-slate-900 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 outline-hidden"
                    >
                      {MACHINE_TYPES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <select
                      value={w.welderName}
                      onChange={(e) => updateRow(index, { welderName: e.target.value })}
                      className="h-9 w-full min-w-[120px] rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 outline-hidden"
                    >
                      {activeWelders.map((welder) => (
                        <option key={welder.id} value={welder.name}>
                          {welder.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <select
                      value={w.status}
                      onChange={(e) => updateRow(index, { status: e.target.value as ProjectWeldStatus })}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 outline-hidden"
                    >
                      {WELD_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <input
                      value={w.errorReason}
                      onChange={(e) => updateRow(index, { errorReason: e.target.value })}
                      placeholder="—"
                      className="h-9 w-full min-w-[120px] rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 outline-hidden"
                    />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                      aria-label="Xóa"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ),
            )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 7 : 8} className="px-3 py-8 text-center text-xs sm:text-sm text-slate-500">
                  Chưa có mối hàn nào trong dự án này.
                  {!readOnly && " Bấm «Thêm mối hàn» để ghi nhận công việc."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeldRow({ row }: { row: ProjectWeld }) {
  return (
    <tr className="hover:bg-slate-50/80 transition-colors duration-150">
      <td className="px-3.5 py-2.5 font-mono font-bold text-[#0047AB]">{row.weldId}</td>
      <td className="px-3.5 py-2.5 text-slate-700 font-mono whitespace-nowrap">{formatDateTime(row.performedAt)}</td>
      <td className="px-3.5 py-2.5">
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#0047AB] border border-blue-200 shadow-2xs">
          {row.method}
        </span>
      </td>
      <td className="px-3.5 py-2.5 text-slate-700 font-mono">{row.machine}</td>
      <td className="px-3.5 py-2.5 text-slate-900 font-medium">{row.welderName}</td>
      <td className="px-3.5 py-2.5">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${weldStatusStyle[row.status]}`}>
          {row.status}
        </span>
      </td>
      <td className="px-3.5 py-2.5 text-slate-700">
        {row.errorReason || <span className="text-slate-400">—</span>}
      </td>
    </tr>
  );
}

function useProjectMachineRuns(projectId: string, projectName: string, enabled: boolean) {
  const [runs, setRuns] = useState<MachineRunSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setRuns([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    loadMachineRunScheduleBundle()
      .then((bundle) => {
        if (!active) return;
        const rows = bundle.schedules
          .filter(
            (s) =>
              (projectId && s.projectId === projectId) ||
              (projectName && s.projectName === projectName),
          );
        setRuns(rows);
        if (bundle.error) setError(bundle.error);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Không tải được lịch chạy máy");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, projectName, enabled]);

  return { runs, loading, error };
}

function ProjectMachineRunsTab({
  runs,
  loading,
  error,
}: {
  runs: MachineRunSchedule[];
  loading: boolean;
  error: string;
}) {
  const totalHours = runs.reduce((sum, row) => sum + row.operatingHours, 0);

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-400">Đang tải lịch chạy máy…</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {error}
        </div>
      )}
      <p className="text-xs text-slate-500">
        Dữ liệu lấy từ trang <span className="font-semibold text-slate-700">Quản lý máy móc › Lịch chạy máy</span>.
        {runs.length > 0 && (
          <>
            {" "}Tổng{" "}
            <span className="font-mono font-semibold tabular-nums text-slate-900">
              {totalHours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
            </span>{" "}
            giờ trên {runs.length} lượt chạy.
          </>
        )}
      </p>

      {runs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
          Chưa có lịch chạy máy nào gắn với dự án này.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="px-3.5 py-2.5">Ngày</th>
                  <th className="px-3.5 py-2.5">Tên máy</th>
                  <th className="px-3.5 py-2.5">Vị trí</th>
                  <th className="px-3.5 py-2.5 text-right">Số giờ</th>
                  <th className="px-3.5 py-2.5">Người phụ trách</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="px-3.5 py-2.5 whitespace-nowrap font-mono text-slate-700">{viDate(row.date)}</td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-mono font-bold text-[#0047AB]">{row.machineCode}</div>
                      <div className="text-xs text-slate-500">{row.machineName}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-xs text-slate-700 whitespace-nowrap">
                      {row.location}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-900">
                      {row.operatingHours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-900 font-medium">{row.personInChargeName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectModal({
  project,
  mode,
  onClose: closeModal,
  onSave,
  onSavePersonnel,
  onSaveWork,
  onStartEdit,
  personnelOptions,
  machineOptions,
  railOptions,
  weldOptions,
}: {
  project: Project;
  mode: "view" | "edit" | "create";
  onClose: () => void;
  onSave?: (updated: Project) => Promise<void>;
  onSavePersonnel?: (projectId: string, rows: ProjectPersonnel[]) => void;
  onSaveWork?: (projectId: string, rows: ProjectWeld[]) => void;
  onStartEdit?: () => void;
  personnelOptions: PersonnelCertificateRow[];
  machineOptions: Machine[];
  railOptions: string[];
  weldOptions: string[];
}) {
  const [form, setForm] = useState(project);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const onClose = useCallback(() => {
    if (!savingRef.current) closeModal();
  }, [closeModal]);
  const [personnelRows, setPersonnelRows] = useState<ProjectPersonnel[]>([]);
  const [workRows, setWorkRows] = useState<ProjectWeld[]>([]);
  const [tab, setTab] = useState<DetailTab>("info");
  const pendingAddRef = useRef<(() => void) | null>(null);

  function requestEdit(addAction?: () => void) {
    if (addAction) pendingAddRef.current = addAction;
    onStartEdit?.();
  }

  useEffect(() => {
    if (mode === "edit" && pendingAddRef.current) {
      pendingAddRef.current();
      pendingAddRef.current = null;
    }
  }, [mode]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setTab("info");
    setForm({
      ...project,
      location: project.location?.trim() || "",
      personnelIds: project.personnelIds ?? [],
      machineTypes: project.machineTypes ?? [],
      weldTypes: project.weldTypes ?? [],
      railTypes: project.railTypes ?? [],
      offDays: clampOffDaysToRange(project.offDays ?? [], project.startDate, project.endDate),
    });
    setPersonnelRows(project.projectPersonnel ?? getProjectPersonnel(project.id));
    setWorkRows(project.projectWelds ?? getProjectWelds(project.id));
  }, [project]);

  const readOnly = mode === "view";
  const isCreate = mode === "create";
  const personnelCount = personnelRows.length;
  const weldCount = workRows.length;
  const progressCount = form.theoreticalProgress?.length ?? 0;
  const machineRuns = useProjectMachineRuns(project.id, project.name, !isCreate);

  const tabs: { id: DetailTab; label: string; count?: number }[] = [
    { id: "info", label: "Thông tin" },
    ...(isCreate
      ? [{ id: "progress" as const, label: "Xem kế hoạch theo ngày", count: progressCount }]
      : [
          { id: "personnel" as const, label: "Nhân sự", count: personnelCount },
          { id: "work" as const, label: "Công việc", count: weldCount },
          { id: "machines" as const, label: "Lịch chạy máy", count: machineRuns.runs.length },
          { id: "progress" as const, label: "Tiến độ lý thuyết", count: progressCount },
        ]),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
              {mode === "view" ? "Chi tiết dự án" : mode === "create" ? "Thêm dự án" : "Sửa dự án"}
            </div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">
              {isCreate ? "Dự án mới" : project.name}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {readOnly && onStartEdit && (
              <button
                type="button"
                onClick={onStartEdit}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#0047AB] bg-[#0047AB]/5 px-3 text-xs font-semibold text-[#0047AB] hover:bg-[#0047AB]/10 transition-colors cursor-pointer"
              >
                Sửa dự án
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
              aria-label="Đóng"
            >
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 px-5 sm:px-6 bg-white">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-colors duration-150 cursor-pointer ${
                  tab === t.id
                    ? "border-[#0047AB] text-[#0047AB]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
                {t.count != null && (
                  <span className="ml-1.5 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-semibold font-mono tabular-nums text-slate-600">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {tab === "info" && (
            <ProjectInfoFields
              form={form}
              setForm={setForm}
              readOnly={readOnly}
              personnelOptions={personnelOptions}
              machineOptions={machineOptions}
              railOptions={railOptions}
              weldOptions={weldOptions}
            />
          )}
          {tab === "personnel" && (
            <ProjectPersonnelTab
              projectId={project.id}
              rows={personnelRows}
              readOnly={readOnly}
              onChange={setPersonnelRows}
              onStartEdit={requestEdit}
            />
          )}
          {tab === "work" && (
            <ProjectWorkTab
              projectId={project.id}
              rows={workRows}
              readOnly={readOnly}
              onChange={setWorkRows}
              onStartEdit={requestEdit}
            />
          )}
          {tab === "machines" && (
            <ProjectMachineRunsTab
              runs={machineRuns.runs}
              loading={machineRuns.loading}
              error={machineRuns.error}
            />
          )}
          {tab === "progress" && (
            <ProjectTheoreticalProgressTab
              projectName={form.name || project.name}
              rows={form.theoreticalProgress ?? []}
              offDays={form.offDays ?? []}
            />
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            {readOnly ? "Đóng" : "Hủy"}
          </button>
          {readOnly && onStartEdit && (
            <button
              type="button"
              onClick={onStartEdit}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] px-4 text-xs font-semibold text-white shadow-xs hover:bg-[#00388A] sm:text-sm cursor-pointer"
            >
              Sửa dự án
            </button>
          )}
          {!readOnly && onSave && (tab === "info" || isCreate) && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                if (savingRef.current) return;
                if (!form.name.trim()) {
                  window.alert("Vui lòng nhập tên dự án.");
                  return;
                }
                if (!form.location.trim()) {
                  window.alert("Vui lòng nhập vị trí.");
                  return;
                }
                if (projectDurationDays(form.startDate, form.endDate) <= 0) {
                  window.alert("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
                  return;
                }
                if (form.plannedWeldCount <= 0) {
                  window.alert("Tổng mối hàn dự tính phải lớn hơn 0.");
                  return;
                }
                if (projectWorkingDays(form.startDate, form.endDate, form.offDays ?? []) <= 0) {
                  window.alert("Dự án phải có ít nhất một ngày làm việc sau khi trừ ngày nghỉ.");
                  return;
                }
                savingRef.current = true;
                setSaving(true);
                try {
                await onSave({
                  ...form,
                  location: form.location.trim(),
                  plant: "",
                  staffCount: form.personnelIds.length,
                  machineCount: form.machineTypes.length,
                  offDays: clampOffDaysToRange(form.offDays ?? [], form.startDate, form.endDate),
                  theoreticalProgress: form.theoreticalProgress ?? buildDailyWeldPlan(
                    form.plannedWeldCount,
                    form.startDate,
                    form.endDate,
                    form.offDays ?? [],
                  ),
                });
                } catch (error) {
                  window.alert(error instanceof Error ? error.message : "Không lưu được dự án.");
                } finally {
                  savingRef.current = false;
                  setSaving(false);
                }
              }}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
            >
              {saving ? "Đang lưu…" : isCreate ? "Thêm dự án" : "Lưu thay đổi"}
            </button>
          )}
          {!readOnly && onSavePersonnel && tab === "personnel" && project.id && (
            <button
              type="button"
              onClick={() => onSavePersonnel(project.id, personnelRows)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
            >
              Lưu nhân sự
            </button>
          )}
          {!readOnly && onSaveWork && tab === "work" && project.id && (
            <button
              type="button"
              onClick={() => onSaveWork(project.id, workRows)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
            >
              Lưu công việc
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectManagement() {
  const { projects: list, setProjects, loading, error, source, reload } = useProjectsData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [modal, setModal] = useState<{ project: Project; mode: "view" | "edit" | "create" } | null>(null);
  const [personnelOptions, setPersonnelOptions] = useState<PersonnelCertificateRow[]>([]);
  const [machineOptions, setMachineOptions] = useState<Machine[]>([]);
  const [importingExcel, setImportingExcel] = useState(false);
  const railOptions = useCatalogOptions("Loại ray");
  const weldOptions = useCatalogOptions("Loại mối hàn", "name");

  useEffect(() => {
    let active = true;
    loadPersonnelCertificateRows()
      .then((rows) => {
        if (active) setPersonnelOptions(rows);
      })
      .catch(() => {
        if (active) setPersonnelOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadMachineCatalog()
      .then((result) => {
        if (active) setMachineOptions(result.machines);
      })
      .catch(() => {
        if (active) setMachineOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const progressRows = useMemo(() => flattenTheoreticalProgress(list), [list]);

  useEffect(() => {
    if (!projectMenuOpen) return;
    function onDocClick(event: MouseEvent) {
      if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
        setProjectMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [projectMenuOpen]);

  const projectMenuOptions = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    return [...list]
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [list, projectSearch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((p) => {
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.manager.toLowerCase().includes(q) ||
        p.plant.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q);
      const matchStatus = status === "Tất cả trạng thái" || p.status === status;
      const matchProject = projectFilter.length === 0 || projectFilter.includes(p.id);
      const matchDate =
        (!dateFrom || (p.endDate ?? "") >= dateFrom) &&
        (!dateTo || (p.startDate ?? "") <= dateTo);
      return matchQ && matchStatus && matchProject && matchDate;
    });
  }, [list, query, status, projectFilter, dateFrom, dateTo]);

  const activeCount = list.filter((p) => p.status === "Đang triển khai").length;

  function handleDelete(project: Project) {
    if (!window.confirm(`Xóa dự án "${project.name}"?`)) return;
    void (async () => {
      if (source === "supabase") {
        const { error: deleteError } = await deleteDuAn(project.id);
        if (deleteError) {
          window.alert(`Không xóa được: ${deleteError}`);
          return;
        }
        await reload();
      } else {
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
      }
      setMenuOpen(null);
    })();
  }

  async function handleSave(updated: Project) {
      if (source === "supabase") {
        const { project: saved, error: saveError } = await updateDuAn(updated.id, {
          name: updated.name,
          manager: updated.manager,
          managerId: updated.managerId,
          location: updated.location,
          startDate: updated.startDate,
          endDate: updated.endDate,
          plannedWeldCount: updated.plannedWeldCount,
          theoreticalProgress: updated.theoreticalProgress,
          status: updated.status,
          personnelIds: updated.personnelIds,
          machineTypes: updated.machineTypes,
          weldTypes: updated.weldTypes,
          railTypes: updated.railTypes,
          offDays: updated.offDays ?? [],
        });
        if (saveError) {
          window.alert(`Không lưu được: ${saveError}`);
          return;
        }
        if (saved) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === updated.id
                ? {
                    ...updated,
                    ...saved,
                    plant: "",
                    status: updated.status,
                    personnelIds: updated.personnelIds,
                    machineTypes: updated.machineTypes,
                    weldTypes: updated.weldTypes,
                    railTypes: updated.railTypes ?? [],
                    offDays: updated.offDays ?? [],
                    staffCount: updated.staffCount,
                    machineCount: updated.machineCount,
                  }
                : p,
            ),
          );
        }
      } else {
        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
      setModal(null);
  }

  async function handleCreate(project: Project) {
      if (source === "supabase") {
        const { project: created, error: createError } = await insertDuAn({
          name: project.name,
          maDuAn: project.maDuAn,
          manager: project.manager,
          managerId: project.managerId,
          location: project.location,
          startDate: project.startDate,
          endDate: project.endDate,
          plannedWeldCount: project.plannedWeldCount,
          status: project.status,
          personnelIds: project.personnelIds,
          machineTypes: project.machineTypes,
          weldTypes: project.weldTypes,
          railTypes: project.railTypes,
          offDays: project.offDays ?? [],
        });
        if (createError) {
          window.alert(`Không thêm được: ${createError}`);
          return;
        }
        if (created) {
          setProjects((prev) => [
            {
              ...created,
              ...project,
              id: created.id,
              offDays: project.offDays ?? [],
              theoreticalProgress: buildDailyWeldPlan(
                project.plannedWeldCount,
                project.startDate,
                project.endDate,
                project.offDays ?? [],
              ),
            },
            ...prev,
          ]);
        }
      } else {
        const id = String(Date.now());
        setProjects((prev) => [{
          ...project,
          id,
          offDays: project.offDays ?? [],
          theoreticalProgress: buildDailyWeldPlan(
            project.plannedWeldCount,
            project.startDate,
            project.endDate,
            project.offDays ?? [],
          ),
        }, ...prev]);
      }
      setModal(null);
  }

  function handleSavePersonnel(projectId: string, rows: ProjectPersonnel[]) {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, projectPersonnel: rows, staffCount: rows.length } : p,
      ),
    );
    setModal(null);
  }

  function handleSaveWork(projectId: string, rows: ProjectWeld[]) {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, projectWelds: rows } : p)),
    );
    setModal(null);
  }

  function resolveProjectForExcelKey(key: string): Project | undefined {
    const normalized = key.trim().toLocaleLowerCase("vi");
    return list.find(
      (p) =>
        (p.maDuAn || "").trim().toLocaleLowerCase("vi") === normalized ||
        p.name.trim().toLocaleLowerCase("vi") === normalized,
    );
  }

  async function handleChangeProgressRow(
    row: ReturnType<typeof flattenTheoreticalProgress>[number],
    next: TheoreticalProgressRow | null,
  ): Promise<boolean> {
    const project = list.find((item) => item.id === row.du_an_id);
    if (!project) return false;
    const current = project.theoreticalProgress ?? [];
    if (next && next.ngay !== row.ngay && current.some((item) => item.ngay === next.ngay)) {
      window.alert("Dự án đã có kế hoạch ngày này. Hãy sửa dòng hiện có.");
      return false;
    }
    const progress = current.flatMap((item) => item.ngay === row.ngay ? (next ? [next] : []) : [item])
      .sort((a, b) => a.ngay.localeCompare(b.ngay));
    try {
      if (source === "supabase") {
        const result = await saveTheoreticalProgress(project.id, progress);
        if (result.error) throw new Error(result.error);
      }
      setProjects((prev) => prev.map((item) => item.id === project.id ? {
        ...item,
        theoreticalProgress: progress,
        plannedWeldCount: progress.reduce((sum, item) => sum + item.so_moi_han, 0),
        startDate: progress[0]?.ngay || item.startDate,
        endDate: progress.at(-1)?.ngay || item.endDate,
      } : item));
      return true;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Không lưu được tiến độ lý thuyết.");
      return false;
    }
  }

  async function handleUploadTheoreticalExcel(file: File | null) {
    if (!file) return;
    setImportingExcel(true);
    try {
      const parsed = await parseTheoreticalProgressExcel(file);
      if (!parsed.rows.length) {
        window.alert(
          parsed.errors.length
            ? parsed.errors.slice(0, 8).join("\n")
            : "File không có dòng dữ liệu hợp lệ.",
        );
        return;
      }

      const grouped = groupTheoreticalProgressByProject(parsed.rows);
      let updated = 0;
      const missing: string[] = [];
      const saveErrors: string[] = [];

      for (const [key, progress] of grouped) {
        const project = resolveProjectForExcelKey(key);
        if (!project) {
          missing.push(key);
          continue;
        }

        const tong = progress.reduce((sum, row) => sum + row.so_moi_han, 0);
        const startDate = progress[0]?.ngay || project.startDate;
        const endDate = progress.at(-1)?.ngay || project.endDate;

        if (source === "supabase") {
          const { error: saveError } = await saveTheoreticalProgress(project.id, progress);
          if (saveError) {
            saveErrors.push(`${project.name}: ${saveError}`);
            continue;
          }
        }

        setProjects((prev) =>
          prev.map((p) =>
            p.id === project.id
              ? {
                  ...p,
                  theoreticalProgress: progress,
                  plannedWeldCount: tong,
                  startDate,
                  endDate,
                }
              : p,
          ),
        );
        updated += 1;
      }

      if (source === "supabase" && updated > 0) {
        await reload();
      }

      const parts = [`Đã cập nhật ${updated} dự án từ Excel (${file.name}).`];
      if (parsed.errors.length) {
        parts.push(`Cảnh báo dòng: ${parsed.errors.slice(0, 5).join("; ")}`);
      }
      if (missing.length) {
        parts.push(`Không khớp dự án: ${missing.slice(0, 8).join(", ")}`);
      }
      if (saveErrors.length) {
        parts.push(saveErrors.slice(0, 5).join("; "));
      }
      window.alert(parts.join("\n"));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không đọc được file Excel");
    } finally {
      setImportingExcel(false);
    }
  }

  function handleExportTheoreticalExcel() {
    exportTheoreticalProgressToExcel(
      progressRows.map((row) => {
        const project = list.find((p) => p.id === row.du_an_id);
        return {
          ngay: row.ngay,
          du_an: row.du_an,
          so_moi_han: row.so_moi_han,
          ma_du_an: project?.maDuAn || "",
        };
      }),
    );
  }

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
      {(error || source === "seed") && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-xs font-medium ${
            error
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {error
            ? `Supabase: ${error} · đang dùng dữ liệu mẫu cục bộ`
            : "Chưa kết nối Supabase · tiến độ lý thuyết chỉ lưu trên trình duyệt"}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{list.length}</strong> dự án
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{activeCount}</strong> đang triển khai
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tên dự án, người phụ trách, lý trình..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          <option>Tất cả trạng thái</option>
          <option>Đang triển khai</option>
          <option>Hoàn thành</option>
          <option>Tạm dừng</option>
        </select>

        {/* Lọc theo dự án */}
        <div ref={projectMenuRef} className="relative w-full sm:w-[220px]">
          <button
            type="button"
            onClick={() => setProjectMenuOpen((v) => !v)}
            className="flex h-10 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            <span className="truncate">
              {projectFilter.length === 0 ? "Tất cả dự án" : `Đã chọn ${projectFilter.length} dự án`}
            </span>
            <svg
              className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${projectMenuOpen ? "rotate-180 text-[#0047AB]" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {projectMenuOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 flex max-h-72 flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <div className="relative mb-1.5">
                <MagnifyingGlass
                  aria-hidden
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={14}
                />
                <input
                  autoFocus
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Tìm dự án..."
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                />
              </div>
              <div className="flex flex-col gap-0.5 overflow-y-auto overscroll-contain">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border-b border-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={projectFilter.length === 0}
                    onChange={() => setProjectFilter([])}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 accent-[#0047AB] cursor-pointer"
                  />
                  <span className="truncate">Tất cả</span>
                </label>
                {projectMenuOptions.length === 0 ? (
                  <p className="px-2.5 py-3 text-center text-xs text-slate-400">Không tìm thấy dự án</p>
                ) : (
                  projectMenuOptions.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      <input
                        type="checkbox"
                        checked={projectFilter.includes(p.id)}
                        onChange={() =>
                          setProjectFilter((prev) =>
                            prev.includes(p.id)
                              ? prev.filter((x) => x !== p.id)
                              : [...prev, p.id],
                          )
                        }
                        className="h-4 w-4 shrink-0 rounded border-slate-300 accent-[#0047AB] cursor-pointer"
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Lọc theo thời gian dự án */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Từ ngày"
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-xs sm:text-sm text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 cursor-pointer"
          />
          <span className="text-slate-400">–</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Đến ngày"
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-xs sm:text-sm text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 cursor-pointer"
          />
        </div>

        <button
          type="button"
          onClick={() => setModal({ project: emptyProject(), mode: "create" })}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Thêm dự án
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1320px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Tên dự án</th>
                <th className="min-w-[190px] px-3.5 py-3">Vị trí</th>
                <th className="px-3.5 py-3">Người phụ trách</th>
                <th className="px-3.5 py-3">Nhân sự</th>
                <th className="px-3.5 py-3">Máy</th>
                <th className="px-3.5 py-3 text-right">Tổng mối hàn dự kiến</th>
                <th className="px-3.5 py-3 text-right">Số ngày</th>
                <th className="min-w-[190px] px-3.5 py-3">Thời gian dự án</th>
                <th className="px-3.5 py-3">Trạng thái</th>
                <th className="w-12 px-2 py-3" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                  <td className="px-3.5 py-3 text-xs text-slate-700">
                    {p.location}
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{p.manager}</td>
                  <td className="px-3.5 py-3 font-medium font-mono tabular-nums text-slate-900">{p.staffCount}</td>
                  <td className="px-3.5 py-3 font-medium font-mono tabular-nums text-slate-900">{p.machineCount}</td>
                  <td className="px-3.5 py-3 text-right font-semibold font-mono tabular-nums text-[#0047AB]">
                    {p.plannedWeldCount.toLocaleString("vi-VN")}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-semibold text-slate-900">
                    {projectDurationDays(p.startDate, p.endDate)}
                  </td>
                  <td className="px-3.5 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                    {viDate(p.startDate)} → {viDate(p.endDate)}
                  </td>
                  <td className="px-3.5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="relative px-2 py-3">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
                      aria-label="Tùy chọn"
                    >
                      <DotsThree size={16} weight="bold" aria-hidden />
                    </button>
                    {menuOpen === p.id && (
                      <div className="absolute right-2 top-10 z-30 w-36 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100">
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            setModal({ project: p, mode: "view" });
                            setMenuOpen(null);
                          }}
                        >
                          Xem
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            setModal({ project: p, mode: "edit" });
                            setMenuOpen(null);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                          onClick={() => handleDelete(p)}
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy dự án phù hợp</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AllTheoreticalProgressTable
        rows={progressRows}
        loading={loading}
        importing={importingExcel}
        onDownloadTemplate={() => downloadTheoreticalProgressExcelTemplate()}
        onUploadExcel={(file) => void handleUploadTheoreticalExcel(file)}
        onExportExcel={handleExportTheoreticalExcel}
        onChangeRow={handleChangeProgressRow}
      />

      {modal && (
        <ProjectModal
          project={modal.project}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSave={
            modal.mode === "edit"
              ? handleSave
              : modal.mode === "create"
                ? handleCreate
                : undefined
          }
          onSavePersonnel={modal.mode === "edit" ? handleSavePersonnel : undefined}
          onSaveWork={modal.mode === "edit" ? handleSaveWork : undefined}
          onStartEdit={() => setModal((m) => (m ? { ...m, mode: "edit" } : null))}
          personnelOptions={personnelOptions}
          machineOptions={machineOptions}
          railOptions={railOptions}
          weldOptions={weldOptions}
        />
      )}
    </main>
  );
}
