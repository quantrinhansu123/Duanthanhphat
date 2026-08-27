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
        className="fixed inset-0 bg-[#071633]/60 backdrop-blur-xs transition-opacity duration-200"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-[#d9e2f1] bg-white shadow-[0_24px_60px_rgba(7,22,51,0.24)] animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e8eef8] px-5 sm:px-6 py-4 bg-white">
          <h2 id={titleId} className="text-[17px] sm:text-[18px] font-bold text-[#0f172a]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors duration-150 cursor-pointer"
            aria-label="Đóng"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-3.5">
          {error && (
            <div className="rounded-lg bg-[#fef2f2] border border-[#fecaca] px-3.5 py-2.5 text-[12.5px] font-medium text-[#b91c1c]">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-[12px] font-semibold text-[#475569]">
              Ngày
              <input
                type="date"
                readOnly={readOnly}
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden read-only:bg-[#f8fafc] focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
              />
            </label>
            <label className="block text-[12px] font-semibold text-[#475569]">
              Ca
              <select
                disabled={readOnly}
                value={form.shift}
                onChange={(e) =>
                  setForm((f) => ({ ...f, shift: e.target.value as MachineAssignment["shift"] }))
                }
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden disabled:bg-[#f8fafc] focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
              >
                {shifts.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-[12px] font-semibold text-[#475569]">
            Máy
            <select
              disabled={readOnly}
              value={form.machineCode}
              onChange={(e) => selectMachine(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden disabled:bg-[#f8fafc] focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
            >
              {machines.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code} · {m.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[12px] font-semibold text-[#475569]">
            Nhà máy
            <input
              readOnly
              value={form.plant}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-[#f8fafc] px-3 text-[13px] text-[#64748b] font-medium"
            />
          </label>

          <label className="block text-[12px] font-semibold text-[#475569]">
            Mối hàn *
            <input
              readOnly={readOnly}
              value={form.weldJoint}
              onChange={(e) => setForm((f) => ({ ...f, weldJoint: e.target.value }))}
              placeholder="VD: MH-HN-2026-0312-01"
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden read-only:bg-[#f8fafc] focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150 font-mono"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-[12px] font-semibold text-[#475569]">
              Loại ray
              <select
                disabled={readOnly}
                value={form.railType}
                onChange={(e) => setForm((f) => ({ ...f, railType: e.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden disabled:bg-[#f8fafc] focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
              >
                {railTypes.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] font-semibold text-[#475569]">
              Trạng thái
              <select
                disabled={readOnly}
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as MachineAssignment["status"] }))
                }
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] shadow-2xs outline-hidden disabled:bg-[#f8fafc] focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="block">
            <legend className="text-[12px] font-semibold text-[#475569]">
              Nhân sự phụ trách *
              {!readOnly && <span className="ml-1 font-normal text-[#94a3b8]">(chọn nhiều người)</span>}
            </legend>
            {readOnly ? (
              <p className="mt-2 text-[13px] font-medium text-[#0f172a]">{form.personsInCharge.join(", ")}</p>
            ) : (
              <>
                <div className="mt-2 max-h-[160px] space-y-1 overflow-y-auto rounded-lg border border-[#d9e2f1] p-2 bg-[#f8fafc]">
                  {personnelOptions.map((name) => {
                    const checked = form.personsInCharge.includes(name);
                    return (
                      <label
                        key={name}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors duration-150 ${
                          checked ? "bg-[#eff6ff] text-[#0047AB] font-semibold" : "text-[#334155] hover:bg-white"
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
                  <p className="mt-1.5 text-[11.5px] text-[#64748b]">
                    Đã chọn <strong className="text-[#0047AB] font-semibold">{form.personsInCharge.length}</strong> nhân sự
                  </p>
                )}
              </>
            )}
          </fieldset>

          <div className="flex shrink-0 justify-end gap-2.5 border-t border-[#e8eef8] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0f172a] hover:border-[#cbd5e1] active:bg-[#f1f5f9] transition-all duration-150 cursor-pointer shadow-2xs"
            >
              {readOnly ? "Đóng" : "Hủy"}
            </button>
            {!readOnly && (
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white shadow-xs hover:bg-[#00388a] active:bg-[#002d6e] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/25 transition-all duration-150 cursor-pointer"
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
