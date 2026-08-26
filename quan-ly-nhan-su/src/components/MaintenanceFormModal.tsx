"use client";

import { useEffect, useId, useState } from "react";
import type { MaintenanceAssignee, MaintenanceEvent } from "@/data/maintenance";

export type MaintenanceFormValues = {
  date: string;
  time: string;
  durationMin: number;
  title: string;
  machine: string;
  type: MaintenanceEvent["type"];
  status: MaintenanceEvent["status"];
  assigneeNames: string[];
};

const assigneeOptions: MaintenanceAssignee[] = [
  { name: "Phạm Văn Minh", photo: "https://randomuser.me/api/portraits/men/52.jpg" },
  { name: "Trần Quốc Bảo", photo: "https://randomuser.me/api/portraits/men/22.jpg" },
  { name: "Nguyễn Văn Hùng", photo: "https://randomuser.me/api/portraits/men/36.jpg" },
  { name: "Đỗ Thị Lan", photo: "https://randomuser.me/api/portraits/women/48.jpg" },
  { name: "Lê Thị Kim Anh", photo: "https://randomuser.me/api/portraits/women/65.jpg" },
];

const machines = ["K920-01", "K920-02", "AMS60-01", "AMS60-03", "K355-02", "GEO-01"];

export { assigneeOptions, machines as maintenanceMachineOptions };

type MaintenanceFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: MaintenanceFormValues) => void;
  defaultDate: string;
};

export default function MaintenanceFormModal({
  open,
  onClose,
  onSubmit,
  defaultDate,
}: MaintenanceFormModalProps) {
  const titleId = useId();
  const [form, setForm] = useState<MaintenanceFormValues>({
    date: defaultDate,
    time: "08:00",
    durationMin: 60,
    title: "",
    machine: machines[0],
    type: "Bảo dưỡng",
    status: "Chờ xác nhận",
    assigneeNames: [assigneeOptions[0].name],
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      date: defaultDate,
      time: "08:00",
      durationMin: 60,
      title: "",
      machine: machines[0],
      type: "Bảo dưỡng",
      status: "Chờ xác nhận",
      assigneeNames: [assigneeOptions[0].name],
    });
    setError("");
  }, [open, defaultDate]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function toggleAssignee(name: string) {
    setForm((f) => {
      const selected = f.assigneeNames.includes(name)
        ? f.assigneeNames.filter((n) => n !== name)
        : [...f.assigneeNames, name];
      return { ...f, assigneeNames: selected };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Vui lòng nhập tên công việc.");
      return;
    }
    if (form.assigneeNames.length === 0) {
      setError("Vui lòng chọn ít nhất một nhân sự phụ trách.");
      return;
    }
    onSubmit(form);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-[#0f172a]/45" aria-label="Đóng" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-[#e8eef8] px-5 py-4">
          <h2 id={titleId} className="text-[18px] font-bold text-[#0f172a]">
            Thêm lịch bảo trì
          </h2>
          <p className="mt-0.5 text-[13px] text-[#64748b]">Tạo công việc bảo dưỡng / sửa chữa mới</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          {error && (
            <div className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</div>
          )}

          <label className="block text-[12px] font-semibold text-[#475569]">
            Tên công việc *
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
              placeholder="VD: Bảo dưỡng định kỳ 500h"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-semibold text-[#475569]">
              Ngày
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
              />
            </label>
            <label className="block text-[12px] font-semibold text-[#475569]">
              Giờ bắt đầu
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-semibold text-[#475569]">
              Máy
              <select
                value={form.machine}
                onChange={(e) => setForm((f) => ({ ...f, machine: e.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
              >
                {machines.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] font-semibold text-[#475569]">
              Thời lượng (phút)
              <input
                type="number"
                min={15}
                step={15}
                value={form.durationMin}
                onChange={(e) => setForm((f) => ({ ...f, durationMin: Number(e.target.value) || 60 }))}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-semibold text-[#475569]">
              Loại công việc
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value as MaintenanceEvent["type"] }))
                }
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
              >
                {(["Bảo dưỡng", "Sửa chữa", "Kiểm định", "Thay phụ tùng"] as const).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] font-semibold text-[#475569]">
              Trạng thái
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as MaintenanceEvent["status"] }))
                }
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] outline-none focus:border-[#0047AB]"
              >
                {(["Chờ xác nhận", "Đang làm", "Đã xong"] as const).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="block">
            <legend className="text-[12px] font-semibold text-[#475569]">
              Nhân sự phụ trách *
              <span className="ml-1 font-normal text-[#94a3b8]">(chọn nhiều người)</span>
            </legend>
            <div className="mt-2 max-h-[180px] space-y-1 overflow-y-auto rounded-lg border border-[#d9e2f1] p-2">
              {assigneeOptions.map((a) => {
                const checked = form.assigneeNames.includes(a.name);
                return (
                  <label
                    key={a.name}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] transition ${
                      checked ? "bg-[#eef4ff] text-[#0f172a]" : "text-[#334155] hover:bg-[#f8fafc]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAssignee(a.name)}
                      className="h-4 w-4 accent-[#0047AB]"
                    />
                    <span className="font-medium">{a.name}</span>
                  </label>
                );
              })}
            </div>
            {form.assigneeNames.length > 0 && (
              <p className="mt-1.5 text-[11px] text-[#64748b]">
                Đã chọn {form.assigneeNames.length} nhân sự: {form.assigneeNames.join(", ")}
              </p>
            )}
          </fieldset>

          <div className="flex justify-end gap-2 border-t border-[#e8eef8] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="h-10 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
            >
              Lưu lịch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
