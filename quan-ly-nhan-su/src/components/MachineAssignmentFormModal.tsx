"use client";

import { useEffect, useId, useState } from "react";
import { X } from "@/components/icons";
import type {
  LookupOption,
  MachineOption,
  MachineRunSchedule,
} from "@/data/machineAssignments";
import type { MachineRunScheduleFormValues } from "@/lib/machineRunSchedulesDb";

type MachineAssignmentFormModalProps = {
  open: boolean;
  mode: "add" | "edit" | "view";
  initial?: MachineRunSchedule | null;
  machines: MachineOption[];
  projects: LookupOption[];
  personnel: LookupOption[];
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: MachineRunScheduleFormValues) => void;
};

function emptyForm(
  machines: MachineOption[],
  projects: LookupOption[],
  personnel: LookupOption[],
): MachineRunScheduleFormValues {
  return {
    date: new Date().toISOString().slice(0, 10),
    machineId: machines[0]?.id ?? "",
    location: "",
    operatingHours: 0,
    projectId: projects[0]?.id ?? "",
    personInChargeId: personnel[0]?.id ?? "",
  };
}

function fromSchedule(row: MachineRunSchedule): MachineRunScheduleFormValues {
  return {
    date: row.date,
    machineId: row.machineId,
    location: row.location,
    operatingHours: row.operatingHours,
    projectId: row.projectId,
    personInChargeId: row.personInChargeId,
  };
}

export default function MachineAssignmentFormModal({
  open,
  mode,
  initial,
  machines,
  projects,
  personnel,
  saving = false,
  onClose,
  onSubmit,
}: MachineAssignmentFormModalProps) {
  const titleId = useId();
  const readOnly = mode === "view";
  const [form, setForm] = useState<MachineRunScheduleFormValues>(() =>
    emptyForm(machines, projects, personnel),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(initial ? fromSchedule(initial) : emptyForm(machines, projects, personnel));
    setError("");
  }, [open, initial, mode, machines, projects, personnel]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, saving]);

  if (!open) return null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const location = form.location.trim();

    if (!form.date || !form.machineId || !form.projectId || !form.personInChargeId) {
      setError("Vui lòng nhập đầy đủ ngày, máy, dự án và người phụ trách.");
      return;
    }
    if (!location) {
      setError("Vui lòng nhập vị trí.");
      return;
    }
    if (!Number.isFinite(form.operatingHours) || form.operatingHours <= 0 || form.operatingHours > 24) {
      setError("Số giờ hoạt động phải lớn hơn 0 và không vượt quá 24 giờ.");
      return;
    }

    onSubmit({
      ...form,
      location,
    });
  }

  const title =
    mode === "add" ? "Thêm lịch chạy máy" : mode === "edit" ? "Sửa lịch chạy máy" : "Chi tiết lịch chạy máy";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4">
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        aria-label="Đóng"
        onClick={() => !saving && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">Lịch chạy máy</div>
            <h2 id={titleId} className="mt-0.5 text-base font-bold text-slate-900 sm:text-lg">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 sm:text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
              Ngày *
              <input
                type="date"
                readOnly={readOnly}
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
              Số giờ hoạt động *
              <input
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                readOnly={readOnly}
                value={form.operatingHours || ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, operatingHours: Number(event.target.value) }))
                }
                placeholder="VD: 7,5"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
            Tên máy *
            <select
              disabled={readOnly}
              value={form.machineId}
              onChange={(event) => setForm((current) => ({ ...current, machineId: event.target.value }))}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-2xs outline-hidden disabled:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
            >
              {machines.length === 0 ? (
                <option value="">Chưa có danh mục máy</option>
              ) : (
                machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.code} · {machine.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
            Vị trí *
            <input
              readOnly={readOnly}
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              placeholder="VD: Hà Nội"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
            Dự án *
            <select
              disabled={readOnly}
              value={form.projectId}
              onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-2xs outline-hidden disabled:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
            >
              {projects.length === 0 ? (
                <option value="">Chưa có dữ liệu dự án</option>
              ) : (
                projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.label}</option>
                ))
              )}
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
            Người phụ trách *
            <select
              disabled={readOnly}
              value={form.personInChargeId}
              onChange={(event) =>
                setForm((current) => ({ ...current, personInChargeId: event.target.value }))
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-2xs outline-hidden disabled:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
            >
              {personnel.length === 0 ? (
                <option value="">Chưa có dữ liệu nhân sự</option>
              ) : (
                personnel.map((person) => (
                  <option key={person.id} value={person.id}>{person.label}</option>
                ))
              )}
            </select>
          </label>

          <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-60 sm:text-sm"
            >
              {readOnly ? "Đóng" : "Hủy"}
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={saving || machines.length === 0 || projects.length === 0 || personnel.length === 0}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#00388A] disabled:opacity-60 sm:text-sm"
              >
                {saving ? "Đang lưu…" : mode === "add" ? "Thêm lịch chạy" : "Lưu thay đổi"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
