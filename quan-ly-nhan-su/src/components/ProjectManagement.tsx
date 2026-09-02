"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DotsThree, MagnifyingGlass, X } from "@/components/icons";
import { getProjectPersonnel, type ProjectPersonnel } from "@/data/projectPersonnel";
import { getProjectWelds, type ProjectWeld, type ProjectWeldStatus } from "@/data/projectWelds";
import { type Project, type TheoreticalProgressRow } from "@/data/projects";
import { welders } from "@/data/welders";
import { useProjectsData } from "@/hooks/useProjectsData";
import {
  buildDailyWeldPlan,
  deleteDuAn,
  flattenTheoreticalProgress,
  insertDuAn,
  projectDurationDays,
  updateDuAn,
} from "@/lib/projectsDb";
import { REPORT_MACHINES } from "@/lib/weldReportData";

const MACHINE_TYPES = [...REPORT_MACHINES];
const WELD_TYPES = ["Sản xuất", "Thử nghiệm", "Đào tạo"] as const;
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

type DetailTab = "info" | "personnel" | "work" | "progress";

function viDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("vi-VN");
}

function emptyProject(): Project {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: "",
    name: "",
    manager: "",
    plant: "",
    staffCount: 0,
    machineCount: 0,
    status: "Đang triển khai",
    startDate: today,
    endDate: today,
    routeFrom: "",
    routeTo: "",
    plannedWeldCount: 0,
    personnelIds: [],
    machineTypes: [],
    weldTypes: [],
  };
}

function toggleItem(list: string[], item: string) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function CheckboxGroup({
  label,
  hint,
  options,
  selected,
  onChange,
  readOnly,
  renderLabel,
}: {
  label: string;
  hint?: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  readOnly: boolean;
  renderLabel?: (option: string) => string;
}) {
  const display = renderLabel ?? ((option: string) => option);

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
    <fieldset className="block text-xs sm:text-[13px] font-semibold text-slate-700">
      <legend className="flex flex-wrap items-center gap-2">
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-[#0047AB] px-2 py-0.5 text-[11px] font-bold text-white font-mono">
            {selected.length}
          </span>
        )}
      </legend>
      {hint ? <p className="mt-1 text-xs font-normal text-slate-500">{hint}</p> : null}
      <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2 space-y-0.5">
        <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 hover:bg-white rounded-lg cursor-pointer transition-colors border-b border-slate-200/80 pb-2 mb-0.5">
          <input
            type="checkbox"
            checked={selected.length === 0 || selected.length === options.length}
            onChange={() => onChange([])}
            className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
          />
          <span>Tất cả</span>
        </label>
        {options.map((option) => (
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
}: {
  projectName: string;
  rows: TheoreticalProgressRow[];
}) {
  const total = rows.reduce((sum, row) => sum + row.so_moi_han, 0);

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
                  <span className="font-mono font-semibold tabular-nums text-[#0047AB]">
                    {row.so_moi_han.toLocaleString("vi-VN")}
                  </span>
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
}: {
  rows: ReturnType<typeof flattenTheoreticalProgress>;
  loading: boolean;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <div className="border-b border-slate-200 px-4 sm:px-5 py-4">
        <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">Tiến độ lý thuyết</h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Tự động chia tổng mối hàn cho từng ngày trong thời gian dự án
        </p>
      </div>
      <div className="table-scroll overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <th className="px-4 py-3">Ngày</th>
              <th className="px-3.5 py-3">Dự án</th>
              <th className="px-3.5 py-3 text-right">Số mối hàn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                  Đang tải tiến độ lý thuyết…
                </td>
              </tr>
            ) : rows.length > 0 ? (
              rows.map((row, index) => (
                <tr key={`${row.du_an_id}-${row.ngay}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-900 whitespace-nowrap">{viDate(row.ngay)}</td>
                  <td className="px-3.5 py-3 font-medium text-slate-900">{row.du_an}</td>
                  <td className="px-3.5 py-3 text-right font-mono font-semibold tabular-nums text-[#0047AB]">
                    {row.so_moi_han.toLocaleString("vi-VN")}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                  Chưa có kế hoạch. Mở dự án và nhập tổng mối hàn cùng khoảng thời gian để tự động tạo.
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
}: {
  form: Project;
  setForm: (p: Project) => void;
  readOnly: boolean;
}) {
  function updateForm(patch: Partial<Project>) {
    const next = { ...form, ...patch };
    next.staffCount = next.personnelIds.length;
    next.machineCount = next.machineTypes.length;
    next.theoreticalProgress = buildDailyWeldPlan(
      next.plannedWeldCount,
      next.startDate,
      next.endDate,
    );
    setForm(next);
  }

  const durationDays = projectDurationDays(form.startDate, form.endDate);
  const averagePerDay = durationDays > 0 ? form.plannedWeldCount / durationDays : 0;

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
          <select
            value={form.manager}
            onChange={(e) => updateForm({ manager: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            <option value="">— Chọn thợ hàn —</option>
            {activeWelders.map((w) => (
              <option key={w.id} value={w.name}>
                {w.name} · {w.weldingId} · {w.position}
              </option>
            ))}
          </select>
        )}
      </label>
      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Nhà máy
        <input
          readOnly={readOnly}
          value={form.plant}
          onChange={(e) => updateForm({ plant: e.target.value })}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
        />
      </label>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Lý trình từ vị trí
          <input
            readOnly={readOnly}
            value={form.routeFrom}
            onChange={(e) => updateForm({ routeFrom: e.target.value })}
            placeholder="VD: Km 12+450"
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Đến vị trí
          <input
            readOnly={readOnly}
            value={form.routeTo}
            onChange={(e) => updateForm({ routeTo: e.target.value })}
            placeholder="VD: Km 24+900"
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
          />
        </label>
      </div>

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

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Số ngày thực hiện</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900">{durationDays}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bình quân/ngày</div>
          <div className="mt-1 font-mono text-xl font-bold text-[#0047AB]">
            {averagePerDay.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
          </div>
        </div>
        <p className="col-span-2 text-xs text-slate-600">
          Khi lưu, hệ thống tự chia {form.plannedWeldCount.toLocaleString("vi-VN")} mối cho {durationDays} ngày; phần dư được cộng từ ngày đầu.
        </p>
      </div>

      <CheckboxGroup
        label="Nhân sự tham gia"
        hint="Chọn nhiều thợ hàn từ danh sách hồ sơ thợ hàn"
        options={activeWelders.map((w) => w.id)}
        selected={form.personnelIds}
        onChange={(personnelIds) => updateForm({ personnelIds })}
        readOnly={readOnly}
        renderLabel={(id) => {
          const welder = activeWelders.find((w) => w.id === id);
          return welder ? `${welder.name} · ${welder.position}` : id;
        }}
      />

      <CheckboxGroup
        label="Loại máy"
        hint="Chọn các loại máy hàn sử dụng trong dự án"
        options={MACHINE_TYPES}
        selected={form.machineTypes}
        onChange={(machineTypes) => updateForm({ machineTypes })}
        readOnly={readOnly}
      />

      <CheckboxGroup
        label="Loại mối hàn"
        hint="Chọn loại mối hàn áp dụng cho dự án"
        options={[...WELD_TYPES]}
        selected={form.weldTypes}
        onChange={(weldTypes) => updateForm({ weldTypes })}
        readOnly={readOnly}
      />

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

function ProjectModal({
  project,
  mode,
  onClose,
  onSave,
  onSavePersonnel,
  onSaveWork,
  onStartEdit,
}: {
  project: Project;
  mode: "view" | "edit" | "create";
  onClose: () => void;
  onSave?: (updated: Project) => void;
  onSavePersonnel?: (projectId: string, rows: ProjectPersonnel[]) => void;
  onSaveWork?: (projectId: string, rows: ProjectWeld[]) => void;
  onStartEdit?: () => void;
}) {
  const [form, setForm] = useState(project);
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
      personnelIds: project.personnelIds ?? [],
      machineTypes: project.machineTypes ?? [],
      weldTypes: project.weldTypes ?? [],
    });
    setPersonnelRows(project.projectPersonnel ?? getProjectPersonnel(project.id));
    setWorkRows(project.projectWelds ?? getProjectWelds(project.id));
  }, [project]);

  const readOnly = mode === "view";
  const isCreate = mode === "create";
  const personnelCount = personnelRows.length;
  const weldCount = workRows.length;
  const progressCount = form.theoreticalProgress?.length ?? 0;

  const tabs: { id: DetailTab; label: string; count?: number }[] = [
    { id: "info", label: "Thông tin" },
    ...(isCreate
      ? []
      : [
          { id: "personnel" as const, label: "Nhân sự", count: personnelCount },
          { id: "work" as const, label: "Công việc", count: weldCount },
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
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
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
          {tab === "info" && <ProjectInfoFields form={form} setForm={setForm} readOnly={readOnly} />}
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
          {tab === "progress" && (
            <ProjectTheoreticalProgressTab
              projectName={form.name || project.name}
              rows={form.theoreticalProgress ?? []}
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
          {!readOnly && onSave && tab === "info" && (
            <button
              type="button"
              onClick={() => {
                if (!form.name.trim()) {
                  window.alert("Vui lòng nhập tên dự án.");
                  return;
                }
                if (!form.manager.trim()) {
                  window.alert("Vui lòng chọn người phụ trách.");
                  return;
                }
                if (!form.routeFrom.trim() || !form.routeTo.trim()) {
                  window.alert("Vui lòng nhập đầy đủ lý trình từ vị trí tới vị trí.");
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
                onSave({
                  ...form,
                  staffCount: form.personnelIds.length,
                  machineCount: form.machineTypes.length,
                  theoreticalProgress: buildDailyWeldPlan(
                    form.plannedWeldCount,
                    form.startDate,
                    form.endDate,
                  ),
                });
              }}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
            >
              {isCreate ? "Thêm dự án" : "Lưu thay đổi"}
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
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [modal, setModal] = useState<{ project: Project; mode: "view" | "edit" | "create" } | null>(null);

  const progressRows = useMemo(() => flattenTheoreticalProgress(list), [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((p) => {
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.manager.toLowerCase().includes(q) ||
        p.plant.toLowerCase().includes(q) ||
        p.routeFrom.toLowerCase().includes(q) ||
        p.routeTo.toLowerCase().includes(q);
      const matchStatus = status === "Tất cả trạng thái" || p.status === status;
      return matchQ && matchStatus;
    });
  }, [list, query, status]);

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

  function handleSave(updated: Project) {
    void (async () => {
      if (source === "supabase") {
        const { project: saved, error: saveError } = await updateDuAn(updated.id, {
          name: updated.name,
          routeFrom: updated.routeFrom,
          routeTo: updated.routeTo,
          startDate: updated.startDate,
          endDate: updated.endDate,
          plannedWeldCount: updated.plannedWeldCount,
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
                    plant: updated.plant,
                    status: updated.status,
                    personnelIds: updated.personnelIds,
                    machineTypes: updated.machineTypes,
                    weldTypes: updated.weldTypes,
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
    })();
  }

  function handleCreate(project: Project) {
    void (async () => {
      if (source === "supabase") {
        const { project: created, error: createError } = await insertDuAn({
          name: project.name,
          maDuAn: project.maDuAn,
          routeFrom: project.routeFrom,
          routeTo: project.routeTo,
          startDate: project.startDate,
          endDate: project.endDate,
          plannedWeldCount: project.plannedWeldCount,
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
              theoreticalProgress: buildDailyWeldPlan(
                project.plannedWeldCount,
                project.startDate,
                project.endDate,
              ),
            },
            ...prev,
          ]);
        }
        await reload();
      } else {
        const id = String(Date.now());
        setProjects((prev) => [{
          ...project,
          id,
          theoreticalProgress: buildDailyWeldPlan(
            project.plannedWeldCount,
            project.startDate,
            project.endDate,
          ),
        }, ...prev]);
      }
      setModal(null);
    })();
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

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
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
          <table className="w-full min-w-[1440px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Tên dự án</th>
                <th className="min-w-[190px] px-3.5 py-3">Lý trình</th>
                <th className="px-3.5 py-3">Người phụ trách</th>
                <th className="px-3.5 py-3">Nhà máy</th>
                <th className="px-3.5 py-3">Nhân sự</th>
                <th className="px-3.5 py-3">Máy</th>
                <th className="px-3.5 py-3 text-right">Tổng mối hàn</th>
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
                  <td className="px-3.5 py-3 font-mono text-xs text-slate-700">
                    {p.routeFrom} → {p.routeTo}
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{p.manager}</td>
                  <td className="px-3.5 py-3 text-slate-700">{p.plant}</td>
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
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy dự án phù hợp</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AllTheoreticalProgressTable rows={progressRows} loading={loading} />

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
        />
      )}
    </main>
  );
}
