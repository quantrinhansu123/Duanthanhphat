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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-[#0f172a]/45" aria-label="Đóng" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[90vh] w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-[#e8eef8] px-5 py-4">
          <h2 id={titleId} className="text-[18px] font-bold text-[#0f172a]">
            {title}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(90vh-140px)] space-y-3 overflow-y-auto px-5 py-4">
          {error && (
            <div className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-semibold text-[#475569]">
              Ngày
              <input
                type="date"
                readOnly={readOnly}
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
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
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none disabled:bg-[#f8fafc] focus:border-[#0047AB]"
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
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none disabled:bg-[#f8fafc] focus:border-[#0047AB]"
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
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-[#f8fafc] px-3 text-[13px] text-[#64748b]"
            />
          </label>

          <label className="block text-[12px] font-semibold text-[#475569]">
            Mối hàn *
            <input
              readOnly={readOnly}
              value={form.weldJoint}
              onChange={(e) => setForm((f) => ({ ...f, weldJoint: e.target.value }))}
              placeholder="VD: MH-HN-2026-0312-01"
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-semibold text-[#475569]">
              Loại ray
              <select
                disabled={readOnly}
                value={form.railType}
                onChange={(e) => setForm((f) => ({ ...f, railType: e.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none disabled:bg-[#f8fafc] focus:border-[#0047AB]"
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
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none disabled:bg-[#f8fafc] focus:border-[#0047AB]"
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
              <p className="mt-2 text-[13px] text-[#0f172a]">{form.personsInCharge.join(", ")}</p>
            ) : (
              <>
                <div className="mt-2 max-h-[160px] space-y-1 overflow-y-auto rounded-lg border border-[#d9e2f1] p-2">
                  {personnelOptions.map((name) => {
                    const checked = form.personsInCharge.includes(name);
                    return (
                      <label
                        key={name}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] transition ${
                          checked ? "bg-[#eef4ff] text-[#0f172a]" : "text-[#334155] hover:bg-[#f8fafc]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerson(name)}
                          className="h-4 w-4 accent-[#0047AB]"
                        />
                        <span className="font-medium">{name}</span>
                      </label>
                    );
                  })}
                </div>
                {form.personsInCharge.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-[#64748b]">
                    Đã chọn {form.personsInCharge.length} nhân sự
                  </p>
                )}
              </>
            )}
          </fieldset>

          <div className="flex justify-end gap-2 border-t border-[#e8eef8] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]"
            >
              {readOnly ? "Đóng" : "Hủy"}
            </button>
            {!readOnly && (
              <button
                type="submit"
                className="h-10 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
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
