"use client";

import { useEffect, useMemo, useState } from "react";
import type { Welder } from "@/data/welders";
import type { Machine } from "@/data/machines";
import { X } from "@/components/icons";
import { loadMachineCatalog } from "@/lib/machineCatalogDb";
import {
  parseTrainedMachineTokens,
  personTrainedOnMachine,
} from "@/lib/personnelCertificatesDb";
import { useCatalogOptions } from "@/hooks/useSystemCatalogs";

export type WelderFormValues = {
  id?: string;
  weldingId: string;
  name: string;
  position: string;
  department: string;
  weldingTeam: string;
  rank: string;
  railTypes: string;
  trainedMachines: string;
  experience: string;
  photo: string;
  status: Welder["status"];
};

const fieldClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20";

const emptyForm: WelderFormValues = {
  weldingId: "",
  name: "",
  position: "Thợ hàn",
  department: "Bộ phận hàn ray (Welding Department)",
  weldingTeam: "Tổ hàn 1",
  rank: "Hạng 2",
  railTypes: "",
  trainedMachines: "",
  experience: "",
  photo: "",
  status: "Hoạt động",
};

type WelderFormModalProps = {
  open: boolean;
  initial?: Welder | null;
  saving?: boolean;
  isEn?: boolean;
  /** Loại ray từ Quản lý mối hàn / danh mục Loại ray */
  railOptions?: string[];
  onClose: () => void;
  onSubmit: (values: WelderFormValues) => void | Promise<void>;
};

export default function WelderFormModal({
  open,
  initial,
  saving,
  isEn,
  railOptions,
  onClose,
  onSubmit,
}: WelderFormModalProps) {
  const [form, setForm] = useState<WelderFormValues>(emptyForm);
  const [error, setError] = useState("");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(false);

  const configuredRailOptions = useCatalogOptions("Loại ray");
  const departmentOptions = useCatalogOptions("Phòng ban", "name");
  const defaultDepartment = departmentOptions[0] || "Bộ phận hàn ray (Welding Department)";
  const effectiveDepartments = useMemo(() => {
    const list = departmentOptions.length > 0 ? departmentOptions : ["Bộ phận hàn ray (Welding Department)"];
    if (form.department && !list.includes(form.department)) {
      return [form.department, ...list];
    }
    return list;
  }, [departmentOptions, form.department]);

  const selectedRailTypes = useMemo(
    () => parseTrainedMachineTokens(form.railTypes),
    [form.railTypes],
  );

  const railTypeChoices = useMemo(() => {
    const fromProp = (railOptions ?? []).map((v) => v.trim()).filter(Boolean);
    return Array.from(new Set([...configuredRailOptions, ...fromProp, ...selectedRailTypes])).sort((a, b) =>
      a.localeCompare(b, "vi"),
    );
  }, [configuredRailOptions, railOptions, selectedRailTypes]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        id: initial.id,
        weldingId: initial.weldingId === "Chưa có mã" ? "" : initial.weldingId,
        name: initial.name,
        position: initial.position,
        department: initial.department && initial.department !== "Chưa cập nhật" ? initial.department : defaultDepartment,
        weldingTeam: initial.weldingTeam === "Chưa phân tổ" ? "" : initial.weldingTeam,
        rank: initial.rank === "Chưa phân hạng" ? "Hạng 2" : initial.rank,
        railTypes: initial.railTypes === "Chưa cập nhật" ? "" : initial.railTypes,
        trainedMachines: initial.trainedMachines === "Chưa cập nhật" ? "" : initial.trainedMachines,
        experience: initial.experience === "Chưa cập nhật" ? "" : initial.experience,
        photo: initial.photo?.startsWith("http") ? initial.photo : "",
        status: initial.status,
      });
    } else {
      setForm({ ...emptyForm, department: defaultDepartment });
    }
    setError("");
  }, [open, initial, defaultDepartment]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setMachinesLoading(true);
    loadMachineCatalog()
      .then((result) => {
        if (!active) return;
        setMachines(result.machines);
      })
      .catch(() => {
        if (active) setMachines([]);
      })
      .finally(() => {
        if (active) setMachinesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const selectedMachineCodes = useMemo(() => {
    const tokens = parseTrainedMachineTokens(form.trainedMachines);
    const codes = new Set<string>();
    for (const machine of machines) {
      if (personTrainedOnMachine(form.trainedMachines, { code: machine.code, model: machine.model })) {
        codes.add(machine.code);
      }
    }
    // Giữ token lẻ không khớp catalog (không xóa dữ liệu cũ)
    for (const token of tokens) {
      const matched = machines.some((m) =>
        personTrainedOnMachine(token, { code: m.code, model: m.model }),
      );
      if (!matched) codes.add(token);
    }
    return codes;
  }, [form.trainedMachines, machines]);

  function set<K extends keyof WelderFormValues>(key: K, value: WelderFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMachine(code: string) {
    const next = new Set(selectedMachineCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    // Ưu tiên lưu theo mã máy (cùng chuẩn với mục Nhân sự đã đào tạo trong Danh sách máy)
    const ordered = machines
      .filter((m) => next.has(m.code))
      .map((m) => m.code);
    const orphans = [...next].filter((token) => !machines.some((m) => m.code === token));
    set("trainedMachines", [...ordered, ...orphans].join(", "));
  }

  function toggleRailType(code: string) {
    const next = new Set(selectedRailTypes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    const ordered = railTypeChoices.filter((item) => next.has(item));
    set("railTypes", ordered.join(", "));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(isEn ? "Please enter full name." : "Vui lòng nhập họ tên.");
      return;
    }
    void onSubmit({
      ...form,
      weldingId: form.weldingId.trim(),
      name: form.name.trim(),
      position: form.position.trim() || "Thợ hàn",
      department: form.department.trim(),
      weldingTeam: form.weldingTeam.trim(),
      railTypes: form.railTypes.trim(),
      trainedMachines: form.trainedMachines.trim(),
      experience: form.experience.trim(),
      photo: form.photo.trim(),
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5">
      <button type="button" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} aria-label="Đóng" />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#0047AB]">
              {isEn ? "Welder profile" : "Hồ sơ thợ hàn"}
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {initial ? (isEn ? "Edit welder" : "Chỉnh sửa thợ hàn") : isEn ? "Add welder" : "Thêm thợ hàn"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {isEn ? "Welding ID" : "Mã thợ hàn"}
              </label>
              <input className={fieldClass} value={form.weldingId} onChange={(e) => set("weldingId", e.target.value)} placeholder="TH-R4-001" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {isEn ? "Full name *" : "Họ tên *"}
              </label>
              <input className={fieldClass} value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {isEn ? "Position" : "Chức vụ"}
              </label>
              <input className={fieldClass} value={form.position} onChange={(e) => set("position", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {isEn ? "Department" : "Đơn vị"}
              </label>
              <select
                className={fieldClass}
                value={form.department || defaultDepartment}
                onChange={(e) => set("department", e.target.value)}
              >
                {effectiveDepartments.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {isEn ? "Welding team" : "Tổ hàn"}
              </label>
              <input className={fieldClass} value={form.weldingTeam} onChange={(e) => set("weldingTeam", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {isEn ? "Grade" : "Hạng"}
              </label>
              <select className={fieldClass} value={form.rank} onChange={(e) => set("rank", e.target.value)}>
                <option value="Hạng 1">Hạng 1</option>
                <option value="Hạng 2">Hạng 2</option>
                <option value="Hạng 3">Hạng 3</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {isEn ? "Allowed rail types" : "Loại ray được phép hàn"}
            </label>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {isEn ? "From Rail type catalog / Weld joint management" : "Từ danh mục Loại ray · Quản lý mối hàn"}
            </p>
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 space-y-1">
              {railTypeChoices.map((rail) => {
                const checked = selectedRailTypes.includes(rail);
                return (
                  <label
                    key={rail}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs sm:text-sm transition-colors ${
                      checked ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRailType(rail)}
                      className="h-4 w-4 rounded border-slate-300 text-[#0047AB] focus:ring-[#0047AB]"
                    />
                    <span className="font-mono font-bold text-[#0047AB]">{rail}</span>
                  </label>
                );
              })}
            </div>
            {selectedRailTypes.length > 0 && (
              <div className="mt-1.5 text-[11px] text-slate-500 font-mono">
                {selectedRailTypes.join(", ")}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {isEn ? "Trained machines" : "Máy đã đào tạo"}
              </label>
              <span className="text-[11px] text-slate-500">
                {isEn ? "Linked to machine personnel training" : "Liên kết mục Nhân sự đã đào tạo (Danh sách máy)"}
              </span>
            </div>
            {machinesLoading ? (
              <div className="mt-1 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500">
                {isEn ? "Loading machines…" : "Đang tải danh sách máy…"}
              </div>
            ) : machines.length === 0 ? (
              <input
                className={fieldClass}
                value={form.trainedMachines}
                onChange={(e) => set("trainedMachines", e.target.value)}
                placeholder="K920, AMS60"
              />
            ) : (
              <div className="mt-1.5 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 space-y-1">
                {machines.map((machine) => {
                  const checked = selectedMachineCodes.has(machine.code);
                  return (
                    <label
                      key={machine.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs sm:text-sm transition-colors ${
                        checked ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMachine(machine.code)}
                        className="h-4 w-4 rounded border-slate-300 text-[#0047AB] focus:ring-[#0047AB]"
                      />
                      <span className="font-mono font-bold text-[#0047AB]">{machine.code}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-700">
                        {machine.name}
                        <span className="text-slate-400"> · {machine.model}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {selectedMachineCodes.size > 0 && (
              <div className="mt-1.5 text-[11px] text-slate-500 font-mono">
                {[...selectedMachineCodes].join(", ")}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {isEn ? "Experience" : "Kinh nghiệm"}
              </label>
              <input
                className={fieldClass}
                value={form.experience}
                onChange={(e) => set("experience", e.target.value)}
                placeholder="5 năm"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {isEn ? "Status" : "Trạng thái"}
              </label>
              <select
                className={fieldClass}
                value={form.status}
                onChange={(e) => set("status", e.target.value as Welder["status"])}
              >
                <option value="Hoạt động">{isEn ? "Active" : "Hoạt động"}</option>
                <option value="Khóa">{isEn ? "Locked" : "Khóa"}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {isEn ? "Photo URL" : "Ảnh (URL)"}
            </label>
            <input
              className={fieldClass}
              value={form.photo}
              onChange={(e) => set("photo", e.target.value)}
              placeholder="https://..."
            />
          </div>

          {error && <div className="text-xs font-semibold text-rose-600">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
          >
            {isEn ? "Cancel" : "Hủy"}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 py-2 text-xs sm:text-sm font-bold text-white cursor-pointer disabled:opacity-50"
          >
            {saving ? (isEn ? "Saving…" : "Đang lưu…") : isEn ? "Save" : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}
