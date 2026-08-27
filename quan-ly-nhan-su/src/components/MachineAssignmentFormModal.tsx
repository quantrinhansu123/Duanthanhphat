"use client";

import { useEffect, useId, useState } from "react";
import { machines } from "@/data/machines";
import type { MachineAssignment } from "@/data/machineAssignments";
import { welders } from "@/data/welders";

export type MachineAssignmentFormValues = Omit<MachineAssignment, "id">;

const personnelOptions = welders.map((w) => w.name);
const railTypes = ["UIC60", "P50", "P43"];
const shifts: MachineAssignment["shift"][] = ["Ca 1", "Ca 2", "Ca 3"];
const statuses: MachineAssignment["status"][] = ["Đang thực hiện", "Hoàn thành", "Tạm dừng"];

type MachineAssignmentFormModalProps = {
  open: boolean;
  mode: "add" | "edit" | "view";
  initial?: MachineAssignment | null;
  onClose: () => void;
  onSubmit: (values: MachineAssignmentFormValues) => void;
};

function emptyForm(): MachineAssignmentFormValues {
  const m = machines[0];
  return {
    date: new Date().toISOString().slice(0, 10),
    machineCode: m.code,
    machineName: m.name,
    plant: m.plant,
    shift: "Ca 1",
    personsInCharge: [personnelOptions[0]],
    weldJoint: "",
    railType: "UIC60",
    status: "Đang thực hiện",
  };
}

function fromAssignment(row: MachineAssignment): MachineAssignmentFormValues {
  return {
    date: row.date,
    machineCode: row.machineCode,
    machineName: row.machineName,
    plant: row.plant,
    shift: row.shift,
    personsInCharge: [...row.personsInCharge],
    weldJoint: row.weldJoint,
    railType: row.railType,
    status: row.status,
  };
}

export default function MachineAssignmentFormModal({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: MachineAssignmentFormModalProps) {
  const titleId = useId();
  const readOnly = mode === "view";
  const [form, setForm] = useState<MachineAssignmentFormValues>(emptyForm());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(initial ? fromAssignment(initial) : emptyForm());
    setError("");
  }, [open, initial, mode]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function selectMachine(code: string) {
    const m = machines.find((x) => x.code === code);
    if (!m) return;
    setForm((f) => ({
      ...f,
      machineCode: m.code,
      machineName: m.name,
      plant: m.plant,
    }));
  }

  function togglePerson(name: string) {
    setForm((f) => {
      const next = f.personsInCharge.includes(name)
        ? f.personsInCharge.filter((n) => n !== name)
        : [...f.personsInCharge, name];
      return { ...f, personsInCharge: next };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.weldJoint.trim()) {
      setError("Vui lòng nhập mã mối hàn.");
      return;
    }
    if (form.personsInCharge.length === 0) {
      setError("Vui lòng chọn ít nhất một nhân sự phụ trách.");
      return;
    }
    onSubmit(form);
    onClose();
  }

  const title =
    mode === "add" ? "Thêm phân công máy" : mode === "edit" ? "Sửa phân công máy" : "Chi tiết phân công máy";

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
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <h2 id={titleId} className="text-base sm:text-lg font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
            aria-label="Đóng"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-3.5">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-rose-700 shadow-2xs">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Ngày
              <input
                type="date"
                readOnly={readOnly}
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Ca
              <select
                disabled={readOnly}
                value={form.shift}
                onChange={(e) =>
                  setForm((f) => ({ ...f, shift: e.target.value as MachineAssignment["shift"] }))
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden disabled:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
              >
                {shifts.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Máy
            <select
              disabled={readOnly}
              value={form.machineCode}
              onChange={(e) => selectMachine(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden disabled:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
            >
              {machines.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code} · {m.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Nhà máy
            <input
              readOnly
              value={form.plant}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs sm:text-sm text-slate-500 font-medium"
            />
          </label>

          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Mối hàn *
            <input
              readOnly={readOnly}
              value={form.weldJoint}
              onChange={(e) => setForm((f) => ({ ...f, weldJoint: e.target.value }))}
              placeholder="VD: MH-HN-2026-0312-01"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Loại ray
              <select
                disabled={readOnly}
                value={form.railType}
                onChange={(e) => setForm((f) => ({ ...f, railType: e.target.value }))}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden disabled:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
              >
                {railTypes.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Trạng thái
              <select
                disabled={readOnly}
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as MachineAssignment["status"] }))
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden disabled:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="block">
            <legend className="text-xs sm:text-[13px] font-semibold text-slate-700">
              Nhân sự phụ trách *
              {!readOnly && <span className="ml-1 font-normal text-slate-400">(chọn nhiều người)</span>}
            </legend>
            {readOnly ? (
              <p className="mt-2 text-xs sm:text-sm font-medium text-slate-900">{form.personsInCharge.join(", ")}</p>
            ) : (
              <>
                <div className="mt-2 max-h-[160px] space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 bg-slate-50">
                  {personnelOptions.map((name) => {
                    const checked = form.personsInCharge.includes(name);
                    return (
                      <label
                        key={name}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors duration-150 ${
                          checked ? "bg-blue-50 text-[#0047AB] font-semibold" : "text-slate-700 hover:bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerson(name)}
                          className="h-4 w-4 accent-[#0047AB] rounded cursor-pointer"
                        />
                        <span>{name}</span>
                      </label>
                    );
                  })}
                </div>
                {form.personsInCharge.length > 0 && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Đã chọn <strong className="text-[#0047AB] font-semibold font-mono tabular-nums">{form.personsInCharge.length}</strong> nhân sự
                  </p>
                )}
              </>
            )}
          </fieldset>

          <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
            >
              {readOnly ? "Đóng" : "Hủy"}
            </button>
            {!readOnly && (
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
              >
                {mode === "add" ? "Thêm mới" : "Lưu thay đổi"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
