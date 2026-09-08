"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Trash, UploadSimple, X } from "@/components/icons";
import type {
  LookupOption,
  MachineOperationImageAsset,
  MachineOption,
  MachineRunSchedule,
} from "@/data/machineAssignments";
import { MACHINE_CONDITION_SUGGESTIONS } from "@/data/machineAssignments";
import { deleteCloudinaryAsset, uploadToCloudinary } from "@/lib/cloudinaryClient";
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
  onSubmit: (values: MachineRunScheduleFormValues) => Promise<void> | void;
};

function formatGpsLocation(latitude: number, longitude: number) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

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
    fuelAddedLiters: 0,
    pumpOpened: false,
    machineCondition: "Bình thường",
    conditionDescription: "",
    recommendation: "",
    imageAssets: [],
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
    fuelAddedLiters: row.fuelAddedLiters,
    pumpOpened: row.pumpOpened,
    machineCondition: row.machineCondition,
    conditionDescription: row.conditionDescription,
    recommendation: row.recommendation,
    imageAssets: row.imageAssets,
  };
}

function geoErrorMessage(code?: number) {
  if (code === 1) return "Bạn đã từ chối quyền truy cập vị trí.";
  if (code === 2) return "Không lấy được tín hiệu GPS.";
  if (code === 3) return "Hết thời gian chờ lấy vị trí.";
  return "Không lấy được vị trí hiện tại.";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialAssetIds = useRef(new Set<string>());
  const removedAssets = useRef<MachineOperationImageAsset[]>([]);
  const readOnly = mode === "view";
  const [form, setForm] = useState<MachineRunScheduleFormValues>(() =>
    emptyForm(machines, projects, personnel),
  );
  const [error, setError] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [gpsMessage, setGpsMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const closeAndCleanUp = useCallback(async () => {
    const newAssets = form.imageAssets.filter(
      (asset) => !initialAssetIds.current.has(asset.publicId),
    );
    await Promise.allSettled(newAssets.map((asset) => deleteCloudinaryAsset(asset.publicId)));
    onClose();
  }, [form.imageAssets, onClose]);

  function applyCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("error");
      setGpsMessage("Trình duyệt không hỗ trợ GPS.");
      return;
    }

    setGpsStatus("loading");
    setGpsMessage("Đang lấy vị trí hiện tại…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = formatGpsLocation(position.coords.latitude, position.coords.longitude);
        setForm((current) => ({ ...current, location }));
        setGpsStatus("ok");
        setGpsMessage("Đã lấy vị trí GPS hiện tại");
      },
      (geoError) => {
        setGpsStatus("error");
        setGpsMessage(geoErrorMessage(geoError.code));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  useEffect(() => {
    if (!open) return;
    const next = initial ? fromSchedule(initial) : emptyForm(machines, projects, personnel);
    setForm(next);
    initialAssetIds.current = new Set(next.imageAssets.map((asset) => asset.publicId));
    removedAssets.current = [];
    setError("");
    setGpsStatus("idle");
    setGpsMessage("");
    setUploading(false);
    if (mode !== "view") {
      applyCurrentLocation();
    }
  }, [open, initial, mode, machines, projects, personnel]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving && !uploading) void closeAndCleanUp();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, uploading, closeAndCleanUp]);

  if (!open) return null;

  async function uploadImages(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    const uploaded: MachineOperationImageAsset[] = [];
    for (const file of Array.from(files)) {
      const { result, error: uploadError } = await uploadToCloudinary(
        file,
        "thanhphat/machine-operation-logs",
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

  function removeImage(asset: MachineOperationImageAsset) {
    if (initialAssetIds.current.has(asset.publicId)) removedAssets.current.push(asset);
    else void deleteCloudinaryAsset(asset.publicId);
    setForm((current) => ({
      ...current,
      imageAssets: current.imageAssets.filter((item) => item.publicId !== asset.publicId),
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const location = form.location.trim();

    if (!form.date || !form.machineId || !form.projectId || !form.personInChargeId) {
      setError("Vui lòng nhập đầy đủ ngày, máy, dự án và người phụ trách.");
      return;
    }
    if (!location) {
      setError("Vui lòng nhập vị trí hoặc lấy tọa độ GPS hiện tại.");
      return;
    }
    if (!Number.isFinite(form.operatingHours) || form.operatingHours <= 0 || form.operatingHours > 24) {
      setError("Số giờ hoạt động phải lớn hơn 0 và không vượt quá 24 giờ.");
      return;
    }
    if (!Number.isFinite(form.fuelAddedLiters) || form.fuelAddedLiters < 0) {
      setError("Số lít dầu bổ sung không được nhỏ hơn 0.");
      return;
    }
    if (!form.machineCondition.trim()) {
      setError("Vui lòng nhập tình trạng chính của máy.");
      return;
    }

    try {
      await onSubmit({
        ...form,
        location,
        machineCondition: form.machineCondition.trim(),
        conditionDescription: form.conditionDescription.trim(),
        recommendation: form.recommendation.trim(),
      });
      await Promise.allSettled(
        removedAssets.current.map((asset) => deleteCloudinaryAsset(asset.publicId)),
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể lưu nhật ký vận hành máy.");
    }
  }

  const title =
    mode === "add" ? "Thêm lịch chạy máy" : mode === "edit" ? "Sửa lịch chạy máy" : "Chi tiết lịch chạy máy";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4">
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        aria-label="Đóng"
        onClick={() => !saving && !uploading && void closeAndCleanUp()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
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
            onClick={() => !saving && !uploading && void closeAndCleanUp()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
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

          <div className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
            Vị trí *
            <div className="mt-1.5 flex gap-2">
              <input
                readOnly={readOnly}
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                placeholder={gpsStatus === "loading" ? "Đang lấy GPS…" : "Nhập địa điểm hoặc vĩ độ, kinh độ"}
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={applyCurrentLocation}
                  disabled={gpsStatus === "loading"}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-[#0047AB] shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-60 sm:text-sm"
                >
                  {gpsStatus === "loading" ? "Đang lấy…" : "Lấy lại"}
                </button>
              )}
            </div>
            {gpsMessage && (
              <p
                className={`mt-1.5 text-[11px] font-medium ${
                  gpsStatus === "error" ? "text-rose-600" : gpsStatus === "ok" ? "text-emerald-700" : "text-slate-500"
                }`}
              >
                {gpsMessage}
              </p>
            )}
          </div>

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

          <section className="space-y-3.5 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Thông tin vận hành thực tế</h3>
              <p className="mt-0.5 text-xs text-slate-500">Ghi lại nhiên liệu, thao tác bơm và tình trạng máy tại thời điểm chạy.</p>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
                Số lít dầu đã đổ
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  readOnly={readOnly}
                  value={form.fuelAddedLiters}
                  onChange={(event) => setForm((current) => ({ ...current, fuelAddedLiters: Number(event.target.value) }))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
                Trạng thái bơm
                <select
                  disabled={readOnly}
                  value={form.pumpOpened ? "open" : "closed"}
                  onChange={(event) => setForm((current) => ({ ...current, pumpOpened: event.target.value === "open" }))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-hidden disabled:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
                >
                  <option value="closed">Không mở bơm</option>
                  <option value="open">Đã mở bơm</option>
                </select>
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
              Tình trạng chính của máy *
              <input
                list="machine-condition-suggestions"
                readOnly={readOnly}
                value={form.machineCondition}
                onChange={(event) => setForm((current) => ({ ...current, machineCondition: event.target.value }))}
                placeholder="VD: Bình thường, Máy chảy dầu…"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
              />
              <datalist id="machine-condition-suggestions">
                {MACHINE_CONDITION_SUGGESTIONS.map((condition) => <option key={condition} value={condition} />)}
              </datalist>
            </label>

            <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
              Mô tả tình trạng / vấn đề
              <textarea
                rows={3}
                readOnly={readOnly}
                value={form.conditionDescription}
                onChange={(event) => setForm((current) => ({ ...current, conditionDescription: event.target.value }))}
                placeholder="Mô tả vị trí rò dầu, biểu hiện của ắc quy, âm thanh bất thường…"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700 sm:text-[13px]">
              Đề nghị / hướng xử lý
              <textarea
                rows={2}
                readOnly={readOnly}
                value={form.recommendation}
                onChange={(event) => setForm((current) => ({ ...current, recommendation: event.target.value }))}
                placeholder="VD: Đề nghị kiểm tra ống dầu trước ca tiếp theo…"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
              />
            </label>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hình ảnh hiện trường</h3>
                <p className="mt-0.5 text-xs text-slate-500">Có thể lưu nhiều ảnh để đối chiếu vấn đề về sau.</p>
              </div>
              {!readOnly && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || saving}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-[#0047AB] hover:bg-blue-100 disabled:opacity-60"
                  >
                    <UploadSimple size={16} aria-hidden />
                    {uploading ? "Đang tải…" : "Thêm ảnh"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploading || saving}
                    onChange={(event) => void uploadImages(event.target.files)}
                    className="hidden"
                  />
                </>
              )}
            </div>

            {form.imageAssets.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {form.imageAssets.map((asset) => (
                  <div key={asset.publicId} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    <a href={asset.secureUrl} target="_blank" rel="noreferrer" title={asset.name}>
                      <Image src={asset.secureUrl} alt={asset.name} fill unoptimized sizes="180px" className="object-cover" />
                    </a>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeImage(asset)}
                        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-rose-600 shadow hover:bg-rose-50"
                        aria-label={`Xóa ảnh ${asset.name}`}
                      >
                        <Trash size={15} aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500">Chưa có ảnh hiện trường.</div>
            )}
          </section>
          </div>

          <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 bg-slate-50/80 px-5 py-3.5 sm:px-6">
            <button
              type="button"
              onClick={() => void closeAndCleanUp()}
              disabled={saving || uploading}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-60 sm:text-sm"
            >
              {readOnly ? "Đóng" : "Hủy"}
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={saving || uploading || machines.length === 0 || projects.length === 0 || personnel.length === 0}
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
