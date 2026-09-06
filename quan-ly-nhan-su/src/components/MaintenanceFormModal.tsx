"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import type {
  MaintenanceAssignee,
  MaintenanceEvent,
  MaintenanceImageAsset,
} from "@/data/maintenance";
import { Trash, UploadSimple, X } from "@/components/icons";
import { deleteCloudinaryAsset, uploadToCloudinary } from "@/lib/cloudinaryClient";

export type MaintenanceFormValues = {
  date: string;
  time: string;
  durationMin: number;
  title: string;
  machine: string;
  type: MaintenanceEvent["type"];
  status: MaintenanceEvent["status"];
  assigneeNames: string[];
  note: string;
  imageAssets: MaintenanceImageAsset[];
};

const assigneeOptions: MaintenanceAssignee[] = [
  { name: "Phạm Văn Minh", photo: "https://randomuser.me/api/portraits/men/52.jpg" },
  { name: "Trần Quốc Bảo", photo: "https://randomuser.me/api/portraits/men/22.jpg" },
  { name: "Nguyễn Văn Hùng", photo: "https://randomuser.me/api/portraits/men/36.jpg" },
  { name: "Đỗ Thị Lan", photo: "https://randomuser.me/api/portraits/women/48.jpg" },
  { name: "Lê Thị Kim Anh", photo: "https://randomuser.me/api/portraits/women/65.jpg" },
];

const machines = ["KCM007-01", "UN5-150ZC2-01", "KCM007-02", "UN5-150ZC2-02"];

export { assigneeOptions, machines as maintenanceMachineOptions };

type MaintenanceFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: MaintenanceFormValues) => Promise<void> | void;
  defaultDate: string;
  initialEvent?: MaintenanceEvent | null;
};

function emptyForm(defaultDate: string): MaintenanceFormValues {
  return {
    date: defaultDate,
    time: "08:00",
    durationMin: 60,
    title: "",
    machine: machines[0],
    type: "Bảo dưỡng",
    status: "Chờ xác nhận",
    assigneeNames: [assigneeOptions[0].name],
    note: "",
    imageAssets: [],
  };
}

function formFromEvent(event: MaintenanceEvent): MaintenanceFormValues {
  return {
    date: event.date,
    time: event.time,
    durationMin: event.durationMin,
    title: event.title,
    machine: event.machine,
    type: event.type,
    status: event.status,
    assigneeNames: event.assignees.map((assignee) => assignee.name),
    note: event.note ?? "",
    imageAssets: event.imageAssets ?? [],
  };
}

export default function MaintenanceFormModal({
  open,
  onClose,
  onSubmit,
  defaultDate,
  initialEvent,
}: MaintenanceFormModalProps) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialAssetIds = useRef(new Set<string>());
  const removedAssets = useRef<MaintenanceImageAsset[]>([]);
  const [form, setForm] = useState<MaintenanceFormValues>(() => emptyForm(defaultDate));
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = initialEvent ? formFromEvent(initialEvent) : emptyForm(defaultDate);
    setForm(next);
    initialAssetIds.current = new Set(next.imageAssets.map((asset) => asset.publicId));
    removedAssets.current = [];
    setError("");
    setUploading(false);
    setSaving(false);
  }, [open, defaultDate, initialEvent]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !uploading && !saving) void closeAndCleanUp();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) return null;

  function toggleAssignee(name: string) {
    setForm((current) => ({
      ...current,
      assigneeNames: current.assigneeNames.includes(name)
        ? current.assigneeNames.filter((item) => item !== name)
        : [...current.assigneeNames, name],
    }));
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    const uploaded: MaintenanceImageAsset[] = [];
    for (const file of Array.from(files)) {
      const { result, error: uploadError } = await uploadToCloudinary(
        file,
        "thanhphat/maintenance",
      );
      if (!result) {
        setError(uploadError || `Không thể tải ảnh ${file.name}.`);
        break;
      }
      uploaded.push({
        publicId: result.public_id,
        secureUrl: result.secure_url,
        name: result.original_filename || file.name,
        bytes: result.bytes,
      });
    }
    if (uploaded.length) {
      setForm((current) => ({
        ...current,
        imageAssets: [...current.imageAssets, ...uploaded],
      }));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
  }

  function removeImage(asset: MaintenanceImageAsset) {
    if (initialAssetIds.current.has(asset.publicId)) removedAssets.current.push(asset);
    else void deleteCloudinaryAsset(asset.publicId);
    setForm((current) => ({
      ...current,
      imageAssets: current.imageAssets.filter((item) => item.publicId !== asset.publicId),
    }));
  }

  async function closeAndCleanUp() {
    const newAssets = form.imageAssets.filter(
      (asset) => !initialAssetIds.current.has(asset.publicId),
    );
    await Promise.allSettled(newAssets.map((asset) => deleteCloudinaryAsset(asset.publicId)));
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("Vui lòng nhập tên công việc.");
      return;
    }
    if (!form.date || !form.time) {
      setError("Vui lòng nhập ngày và giờ bảo trì.");
      return;
    }
    if (form.assigneeNames.length === 0) {
      setError("Vui lòng chọn ít nhất một nhân sự phụ trách.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({ ...form, title: form.title.trim(), note: form.note.trim() });
      await Promise.allSettled(
        removedAssets.current.map((asset) => deleteCloudinaryAsset(asset.publicId)),
      );
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể lưu lịch bảo trì.");
      setSaving(false);
    }
  }

  const isEdit = Boolean(initialEvent);
  const machineOptions = form.machine && !machines.includes(form.machine)
    ? [form.machine, ...machines]
    : machines;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4">
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        aria-label="Đóng"
        onClick={() => void closeAndCleanUp()}
        disabled={uploading || saving}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-base font-bold text-slate-900 sm:text-lg">
              {isEdit ? "Sửa lịch bảo trì" : "Thêm lịch bảo trì"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Ghi nhận nhân sự sửa chữa, ghi chú và nhiều ảnh hiện trường
            </p>
          </div>
          <button
            type="button"
            onClick={() => void closeAndCleanUp()}
            disabled={uploading || saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Đóng"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-3.5 overflow-y-auto px-5 py-5 sm:px-6">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 sm:text-sm">
              {error}
            </div>
          )}

          <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
            Tên công việc *
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              placeholder="VD: Bảo dưỡng định kỳ 500h"
            />
          </label>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
              Ngày *
              <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20" />
            </label>
            <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
              Giờ bắt đầu *
              <input type="time" value={form.time} onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20" />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
              Máy *
              <select value={form.machine} onChange={(event) => setForm((current) => ({ ...current, machine: event.target.value }))} disabled={isEdit} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 disabled:bg-slate-100">
                {machineOptions.map((machine) => <option key={machine}>{machine}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
              Thời lượng (phút) *
              <input type="number" min={1} value={form.durationMin} onChange={(event) => setForm((current) => ({ ...current, durationMin: Number(event.target.value) || 1 }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20" />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
              Loại công việc
              <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as MaintenanceEvent["type"] }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20">
                {(["Bảo dưỡng", "Sửa chữa", "Kiểm định", "Thay phụ tùng"] as const).map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
              Trạng thái
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as MaintenanceEvent["status"] }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20">
                {(["Chờ xác nhận", "Đang làm", "Đã xong"] as const).map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="text-xs font-semibold text-slate-700 sm:text-[13px]">
              Nhân sự sửa chữa * <span className="font-normal text-slate-400">(chọn nhiều)</span>
            </legend>
            <div className="mt-2 grid max-h-[150px] grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
              {assigneeOptions.map((assignee) => {
                const checked = form.assigneeNames.includes(assignee.name);
                return (
                  <label key={assignee.name} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${checked ? "bg-blue-50 font-semibold text-[#0047AB]" : "text-slate-700 hover:bg-white"}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleAssignee(assignee.name)} className="h-4 w-4 accent-[#0047AB]" />
                    {assignee.name}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
            Ghi chú
            <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={3} className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20" placeholder="Nội dung sửa chữa, vật tư thay thế, kết quả kiểm tra..." />
          </label>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-700 sm:text-[13px]">
                Ảnh bảo trì <span className="font-normal text-slate-400">(chọn nhiều ảnh)</span>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-[#0047AB] hover:bg-blue-100 disabled:opacity-50">
                <UploadSimple size={16} aria-hidden />
                {uploading ? "Đang tải..." : "Thêm ảnh"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => void uploadImages(event.target.files)} />
            </div>
            {form.imageAssets.length > 0 ? (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {form.imageAssets.map((asset) => (
                  <div key={asset.publicId} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    <div className="relative h-24"><Image src={asset.secureUrl} alt={asset.name} fill className="object-cover" sizes="180px" /></div>
                    <div className="truncate px-2 py-1.5 pr-9 text-[11px] text-slate-600" title={asset.name}>{asset.name}</div>
                    <button type="button" onClick={() => removeImage(asset)} disabled={uploading || saving} className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-md bg-white/95 text-rose-600 shadow-sm hover:bg-rose-50" aria-label={`Xóa ${asset.name}`}>
                      <Trash size={15} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-400">Chưa có ảnh bảo trì.</div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => void closeAndCleanUp()} disabled={uploading || saving} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
            <button type="submit" disabled={uploading || saving} className="h-10 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A] disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Lưu lịch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
