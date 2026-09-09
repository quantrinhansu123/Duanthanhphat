"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useState } from "react";
import {
  formatMaintenanceDate,
  getMachineMaintenanceHistory,
  type MachineMaintenanceHistoryRow,
} from "@/data/machine-maintenance-history";
import type { MaintenanceEvent } from "@/data/maintenance";
import {
  machines as seedMachines,
  type Machine,
  type EquipmentAsset,
  type WeldingUnitDetail,
  type TransportUnitDetail,
} from "@/data/machines";
import {
  CaretRight,
  MagnifyingGlass,
  Plus,
  Trash,
  UploadSimple,
  X,
} from "@/components/icons";
import {
  createMachine as createMachineInDb,
  deleteMachine as deleteMachineInDb,
  loadMachineCatalog,
  updateMachine as updateMachineInDb,
} from "@/lib/machineCatalogDb";
import { deleteCloudinaryAsset, uploadToCloudinary } from "@/lib/cloudinaryClient";
import ComboBoxInput from "@/components/ComboBoxInput";
import SelectMenu from "@/components/SelectMenu";
import { loadMachineMaintenanceEvents } from "@/lib/maintenanceDb";
import { useCatalogOptions } from "@/hooks/useSystemCatalogs";
import { useProjectsData } from "@/hooks/useProjectsData";
import {
  appendTrainedMachineToken,
  loadPersonnelCertificateRows,
  personTrainedOnMachine,
  updatePersonnelTrainedMachines,
  type PersonnelCertificateRow,
} from "@/lib/personnelCertificatesDb";

type DetailTab = "welding" | "transport" | "history" | "personnel";

const statusStyle: Record<Machine["status"], string> = {
  "Đang làm việc": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Sẵn sàng": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Bảo trì": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  Hỏng: "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
};

const maintTypeStyle: Record<MachineMaintenanceHistoryRow["type"], string> = {
  "Bảo dưỡng": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Sửa chữa": "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  "Kiểm định": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Thay phụ tùng": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

const maintStatusStyle: Record<MachineMaintenanceHistoryRow["status"], string> = {
  "Đã xong": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Đang làm": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Chờ xác nhận": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

const statusOptions: Machine["status"][] = ["Đang làm việc", "Sẵn sàng", "Bảo trì", "Hỏng"];
const modelOptions = ["KCM-007 (K922-1)", "UN5-150ZC2-C6"] as const;
const NO_PROJECT_LABEL = "Chưa gắn dự án";
const WELDING_TECH_OPTIONS = [
  "Flash Butt Welding – FBW (Hàn tiếp xúc đối đầu)",
  "Hàn nhiệt nhôm (Thermit)",
  "Hàn hồ quang tay (SMAW)",
] as const;

const defaultMachineImage = "/may-han/kcm007.jpg";

const modelImages: Record<string, string> = {
  "KCM-007 (K922-1)": "/may-han/kcm007.jpg",
  KCM007: "/may-han/kcm007.jpg",
  "UN5-150ZC2-C6": "/may-han/un5-150zc2-c6-main.jpg",
};

function imageForModel(model: string) {
  return modelImages[model] ?? defaultMachineImage;
}

function cloudinaryPublicIds(machine: Machine): Set<string> {
  const assets = [
    machine.weldingUnit?.coverAsset,
    ...(machine.weldingUnit?.galleryAssets ?? []),
    machine.transportUnit?.coverAsset,
    ...(machine.transportUnit?.galleryAssets ?? []),
  ];
  return new Set(
    assets
      .map((asset) => asset?.publicId?.trim())
      .filter((publicId): publicId is string => Boolean(publicId)),
  );
}

async function deleteUnreferencedAssets(
  removedFrom: Machine,
  remainingMachines: Machine[],
): Promise<string[]> {
  const referenced = new Set(
    remainingMachines.flatMap((machine) => [...cloudinaryPublicIds(machine)]),
  );
  const orphanIds = [...cloudinaryPublicIds(removedFrom)].filter(
    (publicId) => !referenced.has(publicId),
  );
  const outcomes = await Promise.all(
    orphanIds.map(async (publicId) => ({
      publicId,
      deleted: await deleteCloudinaryAsset(publicId),
    })),
  );
  return outcomes.filter((outcome) => !outcome.deleted).map((outcome) => outcome.publicId);
}

function emptyMachine(): Machine {
  return {
    id: "",
    code: "",
    name: "",
    model: "KCM-007 (K922-1)",
    type: "",
    nameEn: "",
    nameVi: "",
    brand: "",
    manufacturer: "",
    plant: "",
    location: "",
    currentProject: "",
    status: "Sẵn sàng",
    available: true,
    weldCount: 0,
    image: imageForModel("KCM007"),
    gallery: [imageForModel("KCM007")],
    serialNumber: "",
    yearInstalled: 0,
    weldingTechnology: "",
    supportedRails: "",
    weldingCapacity: "",
    operator: "",
    personInCharge: "",
    team: "",
    lastMaintenance: "—",
    nextMaintenance: "—",
    operatingHours: 0,
    errorRate: "0,0%",
    note: "",
    specs: {},
    weldingUnit: {
      code: "",
      name: "",
      model: "",
      serial: "",
      manufacturer: "",
      coverImage: "",
      gallery: [],
      specs: {},
    },
    transportUnit: {
      code: "",
      name: "",
      model: "",
      serial: "",
      manufacturer: "",
      plateNumber: "",
      coverImage: "",
      gallery: [],
      specs: {},
    },
  };
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2.5 text-xs sm:text-sm last:border-b-0">
      <div className="font-medium text-slate-500">{label}</div>
      <div className="text-slate-900 font-semibold">{value}</div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component quản lý Upload ảnh đơn & bộ sưu tập ảnh (Cover & Gallery)
// -----------------------------------------------------------------------------
function ImageUploader({
  title,
  folder,
  coverImage,
  coverAsset,
  gallery,
  galleryAssets,
  onChangeCover,
  onChangeGallery,
  onUploadingChange,
}: {
  title: string;
  folder: "thanhphat/machines" | "thanhphat/vehicles";
  coverImage: string;
  coverAsset?: EquipmentAsset;
  gallery: string[];
  galleryAssets?: EquipmentAsset[];
  onChangeCover: (url: string, asset?: EquipmentAsset) => void;
  onChangeGallery: (urls: string[], assets: EquipmentAsset[]) => void;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const coverInputId = useId();
  const galleryInputId = useId();
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const alignedAssets = gallery.map(
    (url, index) =>
      galleryAssets?.find((asset) => asset.url === url) ??
      (galleryAssets?.[index]?.url === url ? galleryAssets[index] : undefined) ??
      { url },
  );

  async function handleUploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    onUploadingChange(true);
    setUploadError("");

    const { result, error } = await uploadToCloudinary(file, folder);
    setIsUploading(false);
    onUploadingChange(false);

    if (error || !result) {
      setUploadError(error || "Tải ảnh đại diện thất bại");
      return;
    }
    const asset: EquipmentAsset = {
      url: result.secure_url,
      publicId: result.public_id,
      name: file.name,
    };
    onChangeCover(result.secure_url, asset);
    if (!gallery.includes(result.secure_url)) {
      onChangeGallery([result.secure_url, ...gallery], [asset, ...alignedAssets]);
    } else {
      onChangeGallery(
        gallery,
        alignedAssets.map((item) => (item.url === result.secure_url ? asset : item)),
      );
    }
    e.target.value = "";
  }

  async function handleUploadGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setIsUploading(true);
    onUploadingChange(true);
    setUploadError("");

    const newAssets: EquipmentAsset[] = [];
    for (const file of files) {
      const { result, error } = await uploadToCloudinary(file, folder);
      if (error || !result) {
        setUploadError(`Lỗi tải ảnh "${file.name}": ${error}`);
        break;
      }
      newAssets.push({
        url: result.secure_url,
        publicId: result.public_id,
        name: file.name,
      });
    }

    setIsUploading(false);
    onUploadingChange(false);

    if (newAssets.length > 0) {
      onChangeGallery(
        [...gallery, ...newAssets.map((asset) => asset.url)],
        [...alignedAssets, ...newAssets],
      );
    }
    e.target.value = "";
  }

  function handleRemoveGalleryItem(indexToRemove: number) {
    const updated = gallery.filter((_, idx) => idx !== indexToRemove);
    const updatedAssets = alignedAssets.filter((_, idx) => idx !== indexToRemove);
    onChangeGallery(updated, updatedAssets);
    if (coverImage === gallery[indexToRemove]) {
      onChangeCover(updated[0] ?? "", updatedAssets[0]);
    }
  }

  function handleMoveGalleryItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= gallery.length) return;
    const updated = [...gallery];
    const updatedAssets = [...alignedAssets];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    [updatedAssets[index], updatedAssets[target]] = [updatedAssets[target], updatedAssets[index]];
    onChangeGallery(updated, updatedAssets);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#0047AB]">
          {title}
        </h4>
        {isUploading && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 animate-pulse">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-600"></span>
            Đang tải ảnh lên Cloudinary...
          </span>
        )}
      </div>

      {uploadError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {uploadError}
        </div>
      )}

      {/* Ảnh đại diện */}
      <div>
        <span className="block text-xs font-semibold text-slate-700 mb-1.5">Ảnh đại diện (Cover Photo)</span>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative h-24 w-36 flex-none overflow-hidden rounded-lg border border-slate-200 bg-slate-200 shadow-2xs">
            {coverImage ? (
              <Image src={coverImage} alt="Cover preview" fill className="object-cover" sizes="144px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">Chưa có ảnh</div>
            )}
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor={coverInputId}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer shadow-2xs"
              >
                <UploadSimple size={14} weight="bold" />
                Thay ảnh từ máy tính
                <input
                  id={coverInputId}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadCover}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
              {coverImage && (
                <button
                  type="button"
                  onClick={() => onChangeCover("")}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <Trash size={13} weight="bold" /> Xóa ảnh
                </button>
              )}
            </div>
            <input
              type="text"
              value={coverImage}
              onChange={(e) => {
                const url = e.target.value;
                onChangeCover(url, url === coverAsset?.url ? coverAsset : (url ? { url } : undefined));
              }}
              placeholder="Hoặc dán URL ảnh trực tiếp..."
              className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-hidden focus:border-[#0047AB]"
            />
          </div>
        </div>
      </div>

      {/* Thư viện ảnh chi tiết (Gallery) */}
      <div className="pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700">Bộ ảnh chi tiết (Gallery: {gallery.length} ảnh)</span>
          <label
            htmlFor={galleryInputId}
            className="inline-flex h-7 items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2.5 text-[11px] font-bold text-[#0047AB] hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <Plus size={12} weight="bold" /> Thêm ảnh chi tiết
            <input
              id={galleryInputId}
              type="file"
              multiple
              accept="image/*"
              onChange={handleUploadGallery}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        </div>

        {gallery.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {gallery.map((url, idx) => (
              <div key={idx} className="group relative aspect-[4/3] rounded-md overflow-hidden border border-slate-200 bg-slate-100">
                <Image src={url} alt={`Gallery ${idx + 1}`} fill className="object-cover" sizes="100px" />
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveGalleryItem(idx, -1)}
                    disabled={idx === 0}
                    title="Chuyển ảnh sang trái"
                    className="p-1 rounded bg-white/90 text-slate-800 hover:bg-white disabled:opacity-40 text-[10px]"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeCover(url, alignedAssets[idx])}
                    title="Đặt làm ảnh đại diện"
                    className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-[10px]"
                  >
                    Cover
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveGalleryItem(idx, 1)}
                    disabled={idx === gallery.length - 1}
                    title="Chuyển ảnh sang phải"
                    className="p-1 rounded bg-white/90 text-slate-800 hover:bg-white disabled:opacity-40 text-[10px]"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveGalleryItem(idx)}
                    title="Xóa ảnh"
                    className="p-1 rounded bg-rose-600 text-white hover:bg-rose-700"
                  >
                    <X size={12} weight="bold" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic py-1">Chưa có ảnh trong bộ sưu tập chi tiết.</div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MachineDetailModal: Máy hàn / Xe / Bảo trì / Nhân sự đã đào tạo
// -----------------------------------------------------------------------------
function MachineDetailModal({
  machine,
  onClose,
  onEdit,
  initialTab = "welding",
}: {
  machine: Machine;
  onClose: () => void;
  onEdit: () => void;
  initialTab?: DetailTab;
}) {
  const [tab, setTab] = useState<DetailTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, machine.id]);
  const [personnelRows, setPersonnelRows] = useState<PersonnelCertificateRow[]>([]);
  const [personnelLoading, setPersonnelLoading] = useState(false);
  const [personnelError, setPersonnelError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [personSearch, setPersonSearch] = useState("");
  const [personSuggestOpen, setPersonSuggestOpen] = useState(false);
  const [savingPersonnel, setSavingPersonnel] = useState(false);

  // Welding images
  const weldingCover = machine.weldingUnit?.coverImage || machine.image || defaultMachineImage;
  const weldingGallery = machine.weldingUnit?.gallery?.length
    ? machine.weldingUnit.gallery
    : machine.gallery?.length
      ? machine.gallery
      : [weldingCover];
  const [activeWeldingImg, setActiveWeldingImg] = useState(weldingCover);

  // Vehicle images
  const transportCover = machine.transportUnit?.coverImage || "";
  const transportGallery = machine.transportUnit?.gallery?.length
    ? machine.transportUnit.gallery
    : transportCover
      ? [transportCover]
      : [];
  const [activeTransportImg, setActiveTransportImg] = useState(transportCover);

  const [savedMaintenance, setSavedMaintenance] = useState<MaintenanceEvent[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceError, setMaintenanceError] = useState("");
  const history = useMemo(
    () => getMachineMaintenanceHistory(machine.code, savedMaintenance),
    [machine.code, savedMaintenance],
  );

  useEffect(() => {
    let active = true;
    setSavedMaintenance([]);
    setMaintenanceLoading(true);
    setMaintenanceError("");
    void loadMachineMaintenanceEvents(machine.code)
      .then((events) => {
        if (active) setSavedMaintenance(events);
      })
      .catch((error: unknown) => {
        if (active) {
          setMaintenanceError(
            error instanceof Error ? error.message : "Không thể tải lịch sử bảo trì.",
          );
        }
      })
      .finally(() => {
        if (active) setMaintenanceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [machine.code]);

  const trainedPersonnel = useMemo(
    () =>
      personnelRows.filter((row) =>
        personTrainedOnMachine(row.loai_may, { code: machine.code, model: machine.model }),
      ),
    [personnelRows, machine.code, machine.model],
  );

  const availablePersonnel = useMemo(
    () =>
      personnelRows.filter(
        (row) => !personTrainedOnMachine(row.loai_may, { code: machine.code, model: machine.model }),
      ),
    [personnelRows, machine.code, machine.model],
  );

  const personnelSuggestions = useMemo(() => {
    const q = personSearch.trim().toLowerCase();
    const pool = availablePersonnel;
    if (!q) return pool.slice(0, 8);
    return pool
      .filter((person) => {
        const haystack = [
          person.ho_ten,
          person.ma_nhan_su || "",
          person.chuc_vu || "",
          person.to_han || "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 10);
  }, [availablePersonnel, personSearch]);

  const selectedPersonLabel = useMemo(() => {
    const person = personnelRows.find((row) => row.employee_id === selectedEmployeeId);
    if (!person) return "";
    return `${person.ma_nhan_su || "—"} · ${person.ho_ten}`;
  }, [personnelRows, selectedEmployeeId]);

  async function refreshPersonnel() {
    setPersonnelLoading(true);
    setPersonnelError("");
    try {
      const rows = await loadPersonnelCertificateRows();
      setPersonnelRows(rows);
    } catch (error) {
      setPersonnelError(error instanceof Error ? error.message : "Không tải được danh sách nhân sự");
      setPersonnelRows([]);
    } finally {
      setPersonnelLoading(false);
    }
  }

  useEffect(() => {
    setActiveWeldingImg(weldingCover);
  }, [weldingCover]);

  useEffect(() => {
    setActiveTransportImg(transportCover);
  }, [transportCover]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (tab !== "personnel") return;
    let active = true;
    setPersonnelLoading(true);
    setPersonnelError("");
    loadPersonnelCertificateRows()
      .then((rows) => {
        if (!active) return;
        setPersonnelRows(rows);
      })
      .catch((error) => {
        if (!active) return;
        setPersonnelError(error instanceof Error ? error.message : "Không tải được danh sách nhân sự");
        setPersonnelRows([]);
      })
      .finally(() => {
        if (active) setPersonnelLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, machine.code]);

  async function handleAddTrainedPersonnel() {
    if (!selectedEmployeeId) return;
    const person = personnelRows.find((row) => row.employee_id === selectedEmployeeId);
    if (!person) return;
    setSavingPersonnel(true);
    setPersonnelError("");
    try {
      const next = appendTrainedMachineToken(person.loai_may, machine.code);
      await updatePersonnelTrainedMachines(person.employee_id, next);
      await refreshPersonnel();
      setSelectedEmployeeId("");
      setPersonSearch("");
      setPersonSuggestOpen(false);
      setAddOpen(false);
    } catch (error) {
      setPersonnelError(error instanceof Error ? error.message : "Không thể thêm nhân sự");
    } finally {
      setSavingPersonnel(false);
    }
  }

  const weldingUnit = machine.weldingUnit;
  const transportUnit = machine.transportUnit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="machine-detail-title"
        className="relative z-10 flex max-h-[94dvh] w-full max-w-[1320px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        {/* Header tổ hợp */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-[#0047AB] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {machine.code}
              </span>
              <span className="text-xs font-bold text-slate-500 font-mono">
                {machine.model}
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                {machine.brand}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[machine.status]}`}>
                {machine.status}
              </span>
            </div>
            <h2 id="machine-detail-title" className="mt-1 text-base sm:text-lg font-bold text-slate-900">
              {machine.name}
            </h2>
            <div className="mt-0.5 text-xs text-slate-500">
              Vị trí: <strong className="text-slate-700">{machine.location}</strong> · Dự án: <strong className="text-slate-700">{machine.currentProject || "—"}</strong>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
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

        {/* Tab Selection */}
        <div className="flex shrink-0 gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 px-5 sm:px-6 pt-1 bg-slate-50">
          <button
            type="button"
            onClick={() => setTab("welding")}
            className={`shrink-0 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors duration-150 cursor-pointer ${
              tab === "welding"
                ? "border-[#0047AB] text-[#0047AB] bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            ⚡ Máy hàn (Welding Unit)
          </button>
          <button
            type="button"
            onClick={() => setTab("transport")}
            className={`shrink-0 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors duration-150 cursor-pointer ${
              tab === "transport"
                ? "border-[#0047AB] text-[#0047AB] bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            🚛 Phương tiện vận chuyển (Transport Unit)
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`shrink-0 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors duration-150 cursor-pointer ${
              tab === "history"
                ? "border-[#0047AB] text-[#0047AB] bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            🔧 Lịch sử bảo trì
            {history.length > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold font-mono text-[#0047AB]">
                {history.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("personnel")}
            className={`shrink-0 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors duration-150 cursor-pointer ${
              tab === "personnel"
                ? "border-[#0047AB] text-[#0047AB] bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            👥 Nhân sự đã được đào tạo
            {trainedPersonnel.length > 0 && (
              <span className="ml-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold font-mono text-emerald-700">
                {trainedPersonnel.length}
              </span>
            )}
          </button>
        </div>

        {/* Nội dung các Tab */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {tab === "welding" && (
            <div className="space-y-5">
              {/* Ảnh máy hàn */}
              <div className="space-y-2.5">
                <div className="relative mx-auto h-[180px] w-full max-w-[420px] overflow-hidden rounded-xl bg-slate-900 border border-slate-200 shadow-md sm:h-[200px]">
                  <Image
                    src={activeWeldingImg}
                    alt={weldingUnit?.name || machine.name}
                    fill
                    className="object-cover"
                    sizes="420px"
                    priority
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-xs font-mono">
                      {weldingUnit?.code || machine.code}
                    </span>
                  </div>
                  <div className="absolute bottom-2 left-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-[11px] text-white backdrop-blur-xs font-mono">
                    Đầu hàn: {weldingUnit?.model || machine.model}
                  </div>
                </div>

                {weldingGallery.length > 1 && (
                  <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs font-semibold text-slate-500 shrink-0">Thư viện ({weldingGallery.length}):</span>
                    {weldingGallery.map((img, idx) => {
                      const isActive = img === activeWeldingImg;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveWeldingImg(img)}
                          className={`relative h-11 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all cursor-pointer ${
                            isActive ? "border-[#0047AB] ring-2 ring-[#0047AB]/30" : "border-slate-200 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <Image src={img} alt={`Góc máy ${idx + 1}`} fill className="object-cover" sizes="64px" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Hồ sơ đầu hàn & thiết bị */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                  Hồ sơ thiết bị hàn
                </h3>
                <div className="divide-y divide-slate-100">
                  <DetailRow label="Mã thiết bị hàn" value={<span className="font-mono font-bold text-[#0047AB]">{weldingUnit?.code || machine.code}</span>} />
                  <DetailRow label="Tên đầu hàn" value={weldingUnit?.name || machine.name} />
                  <DetailRow label="Model đầu hàn" value={<span className="font-mono font-bold text-slate-800">{weldingUnit?.model || machine.model}</span>} />
                  <DetailRow label="Số Serial đầu hàn" value={<span className="font-mono text-slate-700">{weldingUnit?.serial || machine.serialNumber}</span>} />
                  <DetailRow label="Nhà sản xuất" value={weldingUnit?.manufacturer || machine.manufacturer} />
                  <DetailRow label="Công nghệ hàn" value={<span className="font-semibold text-[#0047AB]">{machine.weldingTechnology}</span>} />
                  <DetailRow label="Loại ray hỗ trợ" value={<span className="font-mono">{machine.supportedRails}</span>} />
                  <DetailRow label="Năng suất thiết kế" value={<span className="font-bold text-emerald-700">{machine.weldingCapacity}</span>} />
                  <DetailRow label="Tổng giờ hoạt động" value={<span className="font-mono tabular-nums">{`${machine.operatingHours.toLocaleString("vi-VN")} giờ`}</span>} />
                  <DetailRow label="Tổng mối hàn đã thực hiện" value={<span className="font-mono tabular-nums text-slate-900">{`${machine.weldCount.toLocaleString("vi-VN")} mối`}</span>} />
                </div>
              </div>

              {/* Thông số kỹ thuật hàn chuẩn Catalogue */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                    Thông số kỹ thuật hàn (Welding Specifications)
                  </h3>
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-[#0047AB]">
                    Welding Catalogue
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs sm:text-sm">
                  <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                    <span className="text-slate-500">Lực ép lớn nhất (Upsetting force)</span>
                    <span className="font-semibold text-slate-900 font-mono text-right">{String(weldingUnit?.specs.upsettingForce || machine.specs?.upsettingForce || "—")}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                    <span className="text-slate-500">Lực kẹp định mức (Clamping force)</span>
                    <span className="font-semibold text-slate-900 font-mono text-right">{String(weldingUnit?.specs.clampingForce || machine.specs?.clampingForce || "—")}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                    <span className="text-slate-500">Hành trình hàn lớn nhất</span>
                    <span className="font-semibold text-slate-900 font-mono text-right">{String(weldingUnit?.specs.weldingStroke || machine.specs?.weldingStroke || "—")}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                    <span className="text-slate-500">Năng suất thực tế</span>
                    <span className="font-semibold text-slate-900 font-mono text-right">{String(weldingUnit?.specs.efficiency || machine.specs?.efficiency || "—")}</span>
                  </div>
                  {weldingUnit?.specs.oilTankCapacity && (
                    <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                      <span className="text-slate-500">Dung tích thùng dầu</span>
                      <span className="font-semibold text-slate-900 text-right">{String(weldingUnit.specs.oilTankCapacity)}</span>
                    </div>
                  )}
                  {weldingUnit?.specs.coolingCapacity && (
                    <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                      <span className="text-slate-500">Công suất làm mát</span>
                      <span className="font-semibold text-slate-900 text-right">{String(weldingUnit.specs.coolingCapacity)}</span>
                    </div>
                  )}
                  {weldingUnit?.specs.powerSupply && (
                    <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1 sm:col-span-2">
                      <span className="text-slate-500">Nguồn điện cấp</span>
                      <span className="font-semibold text-slate-900 text-right">{String(weldingUnit.specs.powerSupply)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "transport" && (
            <div className="space-y-5">
              {/* Ảnh phương tiện vận chuyển */}
              <div className="space-y-2.5">
                <div className="relative mx-auto h-[180px] w-full max-w-[420px] overflow-hidden rounded-xl bg-slate-100 border border-slate-200 shadow-md sm:h-[200px]">
                  {activeTransportImg ? (
                    <Image
                      src={activeTransportImg}
                      alt={transportUnit?.name || "Phương tiện vận chuyển"}
                      fill
                      className="object-cover"
                      sizes="420px"
                      priority
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">
                      Chưa cập nhật ảnh phương tiện
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-xs font-mono">
                      {transportUnit?.code || "Chưa cập nhật"}
                    </span>
                    {transportUnit?.plateNumber && (
                      <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-400/95 px-2 py-0.5 text-[11px] font-bold text-slate-900 font-mono shadow-2xs">
                        {transportUnit.plateNumber}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-2 left-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-[11px] text-white backdrop-blur-xs font-mono">
                    {transportUnit?.model || "Chưa cập nhật model"}
                  </div>
                </div>

                {transportGallery.length > 1 && (
                  <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs font-semibold text-slate-500 shrink-0">Thư viện ({transportGallery.length}):</span>
                    {transportGallery.map((img, idx) => {
                      const isActive = img === activeTransportImg;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveTransportImg(img)}
                          className={`relative h-11 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all cursor-pointer ${
                            isActive ? "border-[#0047AB] ring-2 ring-[#0047AB]/30" : "border-slate-200 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <Image src={img} alt={`Góc xe ${idx + 1}`} fill className="object-cover" sizes="64px" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Thông tin hồ sơ phương tiện vận chuyển */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                  Hồ sơ phương tiện vận chuyển / Xe
                </h3>
                <div className="divide-y divide-slate-100">
                  <DetailRow label="Mã phương tiện" value={<span className="font-mono font-bold text-[#0047AB]">{transportUnit?.code || "—"}</span>} />
                  <DetailRow label="Tên phương tiện" value={transportUnit?.name || "—"} />
                  <DetailRow label="Model / Dòng xe" value={<span className="font-mono font-bold text-slate-800">{transportUnit?.model || "—"}</span>} />
                  <DetailRow label="Biển số / Mã đăng kiểm" value={<span className="font-mono font-bold text-amber-700">{transportUnit?.plateNumber || "—"}</span>} />
                  <DetailRow label="Số khung / Serial" value={<span className="font-mono text-slate-700">{transportUnit?.serial || "—"}</span>} />
                  <DetailRow label="Nhà sản xuất xe" value={transportUnit?.manufacturer || "—"} />
                </div>
              </div>

              {/* Thông số phương tiện theo đúng tài liệu ảnh 3 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                    Thông số phương tiện kỹ thuật (Vehicle Specifications)
                  </h3>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                    Vehicle Specs
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs sm:text-sm">
                  <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                    <span className="text-slate-500">Phạm vi hoạt động (Application of work)</span>
                    <span className="font-semibold text-slate-900 text-right">{String(transportUnit?.specs.applicationWork || "—")}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                    <span className="text-slate-500">Tiêu chuẩn khí thải (Emission standard)</span>
                    <span className="font-semibold text-slate-900 font-mono text-right">{String(transportUnit?.specs.emissionStandard || "—")}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                    <span className="text-slate-500">Số trục (Number of axles)</span>
                    <span className="font-semibold text-slate-900 font-mono text-right">{transportUnit?.specs.axes ? `${String(transportUnit.specs.axes)} trục` : "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                    <span className="text-slate-500">Độ dốc kẹp lớn nhất (Max clamping gradient)</span>
                    <span className="font-semibold text-slate-900 font-mono text-right">{String(transportUnit?.specs.clampingGradient || "—")}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                    <span className="text-slate-500">Tốc độ chạy đường bộ (Speed on road)</span>
                    <span className="font-semibold text-slate-900 font-mono text-right">{String(transportUnit?.specs.speedRoad || "—")}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                    <span className="text-slate-500">Tốc độ chạy trên ray (Speed on rail)</span>
                    <span className="font-semibold text-slate-900 font-mono text-right">{String(transportUnit?.specs.speedRail || "—")}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                    <span className="text-slate-500">Khổ đường (Gauge)</span>
                    <span className="font-semibold text-slate-900 font-mono text-right">{String(transportUnit?.specs.gauge || "—")}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                    <span className="text-slate-500">Tổng trọng lượng (Total weight)</span>
                    <span className="font-semibold text-slate-900 font-mono text-right">{String(transportUnit?.specs.weight || "—")}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1 sm:col-span-2">
                    <span className="text-slate-500">Kích thước (Dimensions L×W×H)</span>
                    <span className="font-semibold text-slate-900 font-mono text-right">{String(transportUnit?.specs.dimensions || "—")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "history" && (
            <div>
              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs sm:text-sm text-slate-500">
                  {maintenanceLoading ? (
                    "Đang tải lịch sử bảo trì..."
                  ) : (
                    <><strong className="font-semibold text-slate-900 font-mono tabular-nums">{history.length}</strong> lần bảo trì · sắp xếp mới nhất trước</>
                  )}
                </div>
              </div>

              {maintenanceError && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Chưa tải được dữ liệu bảo trì từ Supabase: {maintenanceError}
                </div>
              )}

              {history.length > 0 ? (
                <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[1080px] border-collapse text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        <th className="px-3.5 py-2.5">Ngày</th>
                        <th className="px-3.5 py-2.5">Giờ</th>
                        <th className="min-w-[200px] px-3.5 py-2.5">Công việc</th>
                        <th className="px-3.5 py-2.5">Loại</th>
                        <th className="px-3.5 py-2.5">Trạng thái</th>
                        <th className="px-3.5 py-2.5">Thời lượng</th>
                        <th className="min-w-[180px] px-3.5 py-2.5">Nhân sự sửa chữa</th>
                        <th className="min-w-[240px] px-3.5 py-2.5">Ghi chú</th>
                        <th className="min-w-[150px] px-3.5 py-2.5">Ảnh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                          <td className="whitespace-nowrap px-3.5 py-3 font-semibold font-mono text-slate-900">
                            {formatMaintenanceDate(row.date)}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-3 tabular-nums font-mono text-slate-700">{row.time}</td>
                          <td className="px-3.5 py-3">
                            <div className="font-semibold text-slate-900">{row.title}</div>
                          </td>
                          <td className="px-3.5 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${maintTypeStyle[row.type]}`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="px-3.5 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${maintStatusStyle[row.status]}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-3 font-mono text-slate-700 tabular-nums">{row.durationMin} phút</td>
                          <td className="px-3.5 py-3 text-xs sm:text-sm text-slate-700">{row.assignees.join(", ")}</td>
                          <td className="px-3.5 py-3 text-xs leading-relaxed text-slate-600">
                            {row.note || "—"}
                          </td>
                          <td className="px-3.5 py-3">
                            {row.images?.length ? (
                              <div className="flex max-w-[190px] flex-wrap gap-1.5">
                                {row.images.map((imageUrl, index) => (
                                  <a
                                    key={`${row.id}-image-${index}`}
                                    href={imageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="relative block h-10 w-14 overflow-hidden rounded-md border border-slate-200 bg-slate-100"
                                    title={`Ảnh bảo trì ${index + 1}`}
                                  >
                                    <Image src={imageUrl} alt={`Ảnh bảo trì ${index + 1}`} fill className="object-cover" sizes="56px" />
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Chưa có ảnh</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-xs sm:text-sm text-slate-500">
                  Chưa có lịch sử bảo trì cho máy này.
                </div>
              )}
            </div>
          )}

          {tab === "personnel" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs sm:text-sm text-slate-500">
                  Nhân sự có{" "}
                  <span className="font-mono font-semibold text-[#0047AB]">{machine.code}</span> trong mục đào tạo máy
                  ·{" "}
                  <strong className="font-semibold text-slate-900 font-mono tabular-nums">
                    {trainedPersonnel.length}
                  </strong>{" "}
                  người
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen((v) => !v);
                    setSelectedEmployeeId("");
                    setPersonSearch("");
                    setPersonSuggestOpen(false);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-3.5 text-xs sm:text-sm font-semibold text-white shadow-xs cursor-pointer"
                >
                  <Plus size={14} weight="bold" /> Thêm mới
                </button>
              </div>

              {addOpen && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-700">
                    Gõ tên / mã nhân sự để hiện gợi ý từ mục Hồ sơ nhân sự
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={personSearch}
                        onChange={(e) => {
                          setPersonSearch(e.target.value);
                          setSelectedEmployeeId("");
                          setPersonSuggestOpen(true);
                        }}
                        onFocus={() => setPersonSuggestOpen(true)}
                        onBlur={() => {
                          // Delay để kịp click gợi ý
                          window.setTimeout(() => setPersonSuggestOpen(false), 150);
                        }}
                        placeholder="Nhập tên thợ hàn, mã NS…"
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-800 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                        autoComplete="off"
                      />
                      {personSuggestOpen && personnelSuggestions.length > 0 && (
                        <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                          {personnelSuggestions.map((person) => (
                            <li key={person.employee_id}>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setSelectedEmployeeId(person.employee_id);
                                  setPersonSearch(`${person.ma_nhan_su || "—"} · ${person.ho_ten}`);
                                  setPersonSuggestOpen(false);
                                }}
                                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-blue-50 cursor-pointer"
                              >
                                <span className="text-xs sm:text-sm font-semibold text-slate-900">
                                  {person.ho_ten}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {person.ma_nhan_su || "—"}
                                  {person.chuc_vu ? ` · ${person.chuc_vu}` : ""}
                                  {person.to_han ? ` · ${person.to_han}` : ""}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {personSuggestOpen && personSearch.trim() && personnelSuggestions.length === 0 && (
                        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-500 shadow-lg">
                          Không tìm thấy nhân sự phù hợp
                        </div>
                      )}
                      {selectedEmployeeId && selectedPersonLabel && (
                        <div className="mt-1.5 text-[11px] font-medium text-emerald-700">
                          Đã chọn: {selectedPersonLabel}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!selectedEmployeeId || savingPersonnel}
                      onClick={handleAddTrainedPersonnel}
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] disabled:opacity-50 px-4 text-xs sm:text-sm font-semibold text-white cursor-pointer"
                    >
                      {savingPersonnel ? "Đang lưu…" : "Gắn máy này"}
                    </button>
                  </div>
                  {availablePersonnel.length === 0 && !personnelLoading && (
                    <div className="text-xs text-slate-500">
                      Tất cả nhân sự trong danh mục đã được gắn máy này, hoặc chưa có dữ liệu nhân sự.
                    </div>
                  )}
                </div>
              )}

              {personnelError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {personnelError}
                </div>
              )}

              {personnelLoading ? (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-xs sm:text-sm text-slate-500">
                  Đang tải danh sách nhân sự…
                </div>
              ) : trainedPersonnel.length > 0 ? (
                <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        <th className="px-3.5 py-2.5">Mã NS</th>
                        <th className="px-3.5 py-2.5">Họ tên</th>
                        <th className="px-3.5 py-2.5">Chức vụ</th>
                        <th className="px-3.5 py-2.5">Tổ hàn</th>
                        <th className="px-3.5 py-2.5">Cấp bậc</th>
                        <th className="px-3.5 py-2.5">Máy đã đào tạo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trainedPersonnel.map((person) => (
                        <tr key={person.employee_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-3 font-mono font-semibold text-[#0047AB]">
                            {person.ma_nhan_su || "—"}
                          </td>
                          <td className="px-3.5 py-3 font-semibold text-slate-900">{person.ho_ten}</td>
                          <td className="px-3.5 py-3 text-slate-700">{person.chuc_vu || "—"}</td>
                          <td className="px-3.5 py-3 text-slate-700">{person.to_han || "—"}</td>
                          <td className="px-3.5 py-3 font-mono text-slate-700">{person.cap_bac || "—"}</td>
                          <td className="px-3.5 py-3 text-slate-700 max-w-[280px] truncate" title={person.loai_may || ""}>
                            {person.loai_may || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-xs sm:text-sm text-slate-500">
                  Chưa có nhân sự nào được gắn đào tạo máy này.
                  <div className="mt-1">Bấm <strong>Thêm mới</strong> để chọn từ mục nhân sự.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
          >
            Chỉnh sửa tổ hợp & máy
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MachineFormModal: Chỉnh sửa và thêm máy với 2 tab riêng (Máy hàn vs Xe) + Upload ảnh Cloudinary
// -----------------------------------------------------------------------------
function MachineFormModal({
  machine,
  mode,
  modelSuggestions = [],
  techSuggestions = [],
  onClose,
  onSave,
}: {
  machine: Machine;
  mode: "create" | "edit";
  modelSuggestions?: string[];
  techSuggestions?: string[];
  onClose: () => void;
  onSave: (updated: Machine) => void;
}) {
  const [form, setForm] = useState<Machine>(() => {
    // Chỉ kế thừa dữ liệu đã có; không tự điền thông số kỹ thuật chưa được xác nhận.
    const wUnit: WeldingUnitDetail = machine.weldingUnit ?? {
      code: machine.code || "",
      name: machine.name || "",
      model: machine.model || "",
      serial: machine.serialNumber || "",
      manufacturer: machine.manufacturer || "",
      coverImage: machine.image || "",
      gallery: machine.gallery ?? [],
      specs: {
        supportedRails: machine.supportedRails || "",
        weldingTechnology: machine.weldingTechnology || "",
      },
    };

    const tUnit: TransportUnitDetail = machine.transportUnit ?? {
      code: "",
      name: "",
      model: "",
      serial: "",
      manufacturer: "",
      plateNumber: "",
      coverImage: "",
      gallery: [],
      specs: {},
    };

    return {
      ...machine,
      weldingUnit: wUnit,
      transportUnit: tUnit,
    };
  });

  const [formTab, setFormTab] = useState<"assembly" | "vehicle">("assembly");
  const [isUploading, setIsUploading] = useState(false);
  const isCreate = mode === "create";
  const railOptions = useCatalogOptions("Loại ray");
  const { projects } = useProjectsData();

  const [personnelDirectory, setPersonnelDirectory] = useState<PersonnelCertificateRow[]>([]);
  useEffect(() => {
    let active = true;
    loadPersonnelCertificateRows()
      .then((rows) => {
        if (active) setPersonnelDirectory(rows);
      })
      .catch(() => {
        if (active) setPersonnelDirectory([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const teamOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of personnelDirectory) {
      const team = row.to_han?.trim();
      if (team && team !== "Chưa phân tổ") set.add(team);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [personnelDirectory]);

  const personOptions = useMemo(() => {
    const team = form.team?.trim();
    const set = new Set<string>();
    for (const row of personnelDirectory) {
      const name = row.ho_ten?.trim();
      if (!name) continue;
      if (team && row.to_han?.trim() !== team) continue;
      set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [personnelDirectory, form.team]);
  const selectedRails = form.supportedRails
    .split(/[,;|/]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  function toggleRail(rail: string) {
    const next = new Set(selectedRails);
    if (next.has(rail)) next.delete(rail);
    else next.add(rail);
    setForm((previous) => ({
      ...previous,
      supportedRails: railOptions.filter((item) => next.has(item)).join(", "),
    }));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isUploading) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isUploading]);

  function handleSubmit() {
    if (isUploading) {
      window.alert("Ảnh đang được tải lên Cloudinary, vui lòng đợi hoàn tất.");
      return;
    }
    if (!form.name.trim()) {
      window.alert("Vui lòng nhập tên tổ hợp máy.");
      return;
    }
    if (!form.code.trim()) {
      window.alert("Vui lòng nhập mã máy.");
      return;
    }
    if (!form.location.trim()) {
      window.alert("Vui lòng nhập vị trí hiện tại của máy.");
      return;
    }

    // Đảm bảo đồng bộ ảnh máy chính từ weldingUnit
    const syncImage = form.weldingUnit?.coverImage || form.image;
    const syncGallery = form.weldingUnit?.gallery?.length ? form.weldingUnit.gallery : form.gallery;

    onSave({
      ...form,
      image: syncImage,
      gallery: syncGallery,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
        aria-label="Đóng"
        onClick={() => {
          if (!isUploading) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[92dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
              {isCreate ? "Thêm tổ hợp thiết bị mới" : "Chỉnh sửa tổ hợp thiết bị & máy"}
            </div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900 truncate">
              {isCreate ? "Tổ hợp thiết bị mới" : form.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer disabled:opacity-50"
            aria-label="Đóng"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Tab chuyển đổi giữa Phần Tổ Hợp / Máy hàn & Phần Xe vận chuyển */}
        <div className="flex border-b border-slate-200 px-5 sm:px-6 bg-slate-50 gap-2">
          <button
            type="button"
            onClick={() => setFormTab("assembly")}
            className={`border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              formTab === "assembly"
                ? "border-[#0047AB] text-[#0047AB] bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            ⚡ 1. Tổ hợp & Máy hàn
          </button>
          <button
            type="button"
            onClick={() => setFormTab("vehicle")}
            className={`border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              formTab === "vehicle"
                ? "border-[#0047AB] text-[#0047AB] bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            🚛 2. Phương tiện vận chuyển / Xe
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {formTab === "assembly" ? (
            <div className="space-y-4">
              {/* Quản lý ảnh máy hàn */}
              <ImageUploader
                title="Ảnh máy hàn (Cloudinary: thanhphat/machines)"
                folder="thanhphat/machines"
                coverImage={form.weldingUnit?.coverImage || form.image}
                coverAsset={form.weldingUnit?.coverAsset}
                gallery={form.weldingUnit?.gallery || form.gallery || []}
                galleryAssets={form.weldingUnit?.galleryAssets}
                onChangeCover={(url, asset) => {
                  setForm((prev) => ({
                    ...prev,
                    image: url,
                    weldingUnit: prev.weldingUnit
                      ? { ...prev.weldingUnit, coverImage: url, coverAsset: asset }
                      : undefined,
                  }));
                }}
                onChangeGallery={(urls, assets) => {
                  setForm((prev) => ({
                    ...prev,
                    gallery: urls,
                    weldingUnit: prev.weldingUnit
                      ? { ...prev.weldingUnit, gallery: urls, galleryAssets: assets }
                      : undefined,
                  }));
                }}
                onUploadingChange={setIsUploading}
              />

              {/* Thông tin định danh tổ hợp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Mã tổ hợp / Mã máy
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="VD: KCM007-03"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 font-mono"
                  />
                </label>
                <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Model tổ hợp
                  <ComboBoxInput
                    value={form.model}
                    onChange={(model) => setForm({ ...form, model })}
                    options={[...modelSuggestions, ...modelOptions]}
                    placeholder="Chọn model có sẵn hoặc nhập model mới"
                    className="mt-1.5"
                    inputClassName="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                  />
                </label>
              </div>

              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                Tên tổ hợp máy hàn
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: Tổ hợp máy hàn ray lưu động KCM-007..."
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Công nghệ hàn
                  <ComboBoxInput
                    value={form.weldingTechnology}
                    onChange={(weldingTechnology) => setForm({ ...form, weldingTechnology })}
                    options={[...techSuggestions, ...WELDING_TECH_OPTIONS]}
                    placeholder="Chọn công nghệ có sẵn hoặc nhập mới"
                    className="mt-1.5"
                    inputClassName="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </label>
                <div className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Loại ray hỗ trợ
                  <div className="mt-1.5 max-h-32 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2">
                    {railOptions.map((rail) => (
                      <label key={rail} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 font-mono text-xs text-slate-700 hover:bg-slate-50">
                        <input type="checkbox" checked={selectedRails.includes(rail)} onChange={() => toggleRail(rail)} className="h-4 w-4 accent-[#0047AB]" />
                        {rail}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Vị trí hiện tại
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="VD: Km 15+200 · Ga Hà Nội"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </label>
                <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Dự án đang phục vụ
                  <ComboBoxInput
                    strict
                    mono={false}
                    value={form.currentProject || NO_PROJECT_LABEL}
                    onChange={(next) =>
                      setForm({
                        ...form,
                        currentProject: next === NO_PROJECT_LABEL ? "" : next,
                      })
                    }
                    options={[
                      NO_PROJECT_LABEL,
                      ...(form.currentProject &&
                      !projects.some((project) => project.name === form.currentProject)
                        ? [form.currentProject]
                        : []),
                      ...projects.map((project) => project.name),
                    ]}
                    placeholder={NO_PROJECT_LABEL}
                    className="mt-1.5"
                    inputClassName="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Trạng thái
                  <SelectMenu
                    value={form.status}
                    onChange={(next) => {
                      const status = next as Machine["status"];
                      setForm({ ...form, status, available: status === "Sẵn sàng" });
                    }}
                    options={statusOptions.map((s) => ({ value: s, label: s }))}
                    className="mt-1.5"
                    buttonClassName="h-10 font-medium shadow-2xs"
                  />
                </label>
                <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Số serial đầu hàn
                  <input
                    value={form.weldingUnit?.serial || form.serialNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        serialNumber: val,
                        weldingUnit: prev.weldingUnit
                          ? { ...prev.weldingUnit, serial: val }
                          : undefined,
                      }));
                    }}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] font-mono"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Tổ vận hành
                  <ComboBoxInput
                    strict
                    mono={false}
                    value={form.team}
                    onChange={(team) =>
                      setForm((prev) => {
                        const stillValid =
                          !team.trim() ||
                          !prev.personInCharge ||
                          personnelDirectory.some(
                            (row) =>
                              row.ho_ten?.trim() === prev.personInCharge &&
                              row.to_han?.trim() === team.trim(),
                          );
                        return stillValid
                          ? { ...prev, team }
                          : { ...prev, team, personInCharge: "", operator: "" };
                      })
                    }
                    options={[
                      ...(form.team && !teamOptions.includes(form.team) ? [form.team] : []),
                      ...teamOptions,
                    ]}
                    placeholder="Chọn tổ vận hành..."
                    emptyLabel="Không tìm thấy tổ phù hợp"
                    className="mt-1.5"
                    inputClassName="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </label>
                <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Người phụ trách / Vận hành
                  <ComboBoxInput
                    strict
                    mono={false}
                    value={form.personInCharge}
                    onChange={(next) =>
                      setForm({ ...form, personInCharge: next, operator: next })
                    }
                    options={[
                      ...(form.personInCharge && !personOptions.includes(form.personInCharge)
                        ? [form.personInCharge]
                        : []),
                      ...personOptions,
                    ]}
                    placeholder="Chọn người phụ trách..."
                    emptyLabel="Không tìm thấy nhân sự phù hợp"
                    className="mt-1.5"
                    inputClassName="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </label>
              </div>

              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                Ghi chú tổ hợp
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={2}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] resize-y"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quản lý ảnh xe vận chuyển */}
              <ImageUploader
                title="Ảnh phương tiện vận chuyển (Cloudinary: thanhphat/vehicles)"
                folder="thanhphat/vehicles"
                coverImage={form.transportUnit?.coverImage || ""}
                coverAsset={form.transportUnit?.coverAsset}
                gallery={form.transportUnit?.gallery || []}
                galleryAssets={form.transportUnit?.galleryAssets}
                onChangeCover={(url, asset) => {
                  setForm((prev) => ({
                    ...prev,
                    transportUnit: prev.transportUnit
                      ? { ...prev.transportUnit, coverImage: url, coverAsset: asset }
                      : undefined,
                  }));
                }}
                onChangeGallery={(urls, assets) => {
                  setForm((prev) => ({
                    ...prev,
                    transportUnit: prev.transportUnit
                      ? { ...prev.transportUnit, gallery: urls, galleryAssets: assets }
                      : undefined,
                  }));
                }}
                onUploadingChange={setIsUploading}
              />

              {/* Thông tin cơ bản xe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Mã phương tiện
                  <input
                    value={form.transportUnit?.code || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        transportUnit: prev.transportUnit
                          ? { ...prev.transportUnit, code: val }
                          : undefined,
                      }));
                    }}
                    placeholder="VD: TU-UN5-CARRIER-01"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] font-mono"
                  />
                </label>
                <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Biển số / Mã đăng ký xe
                  <input
                    value={form.transportUnit?.plateNumber || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        transportUnit: prev.transportUnit
                          ? { ...prev.transportUnit, plateNumber: val }
                          : undefined,
                      }));
                    }}
                    placeholder="VD: ĐS-TP-1501 hoặc 29H-882.16"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] font-mono"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Tên phương tiện
                  <input
                    value={form.transportUnit?.name || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        transportUnit: prev.transportUnit
                          ? { ...prev.transportUnit, name: val }
                          : undefined,
                      }));
                    }}
                    placeholder="VD: Toa xe chuyên dùng trên ray"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </label>
                <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                  Model / Dòng xe
                  <input
                    value={form.transportUnit?.model || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        transportUnit: prev.transportUnit
                          ? { ...prev.transportUnit, model: val }
                          : undefined,
                      }));
                    }}
                    placeholder="VD: Toa xe chuyên dùng hoặc Volvo FMX 330"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </label>
              </div>

              {/* Bộ thông số kỹ thuật riêng của phương tiện */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                  Bộ thông số phương tiện
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Phạm vi hoạt động (Application of work)
                    <input
                      value={form.transportUnit?.specs.applicationWork || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          transportUnit: prev.transportUnit
                            ? {
                                ...prev.transportUnit,
                                specs: { ...prev.transportUnit.specs, applicationWork: val },
                              }
                            : undefined,
                        }));
                      }}
                      placeholder="VD: On rail / stationary"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Tiêu chuẩn khí thải (Emission standard)
                    <input
                      value={form.transportUnit?.specs.emissionStandard || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          transportUnit: prev.transportUnit
                            ? {
                                ...prev.transportUnit,
                                specs: { ...prev.transportUnit.specs, emissionStandard: val },
                              }
                            : undefined,
                        }));
                      }}
                      placeholder="VD: Euro V"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Số trục (Number of axles)
                    <input
                      value={String(form.transportUnit?.specs.axes ?? "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          transportUnit: prev.transportUnit
                            ? {
                                ...prev.transportUnit,
                                specs: { ...prev.transportUnit.specs, axes: val },
                              }
                            : undefined,
                        }));
                      }}
                      placeholder="VD: 4"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Độ dốc kẹp lớn nhất (Clamping gradient)
                    <input
                      value={form.transportUnit?.specs.clampingGradient || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          transportUnit: prev.transportUnit
                            ? {
                                ...prev.transportUnit,
                                specs: { ...prev.transportUnit.specs, clampingGradient: val },
                              }
                            : undefined,
                        }));
                      }}
                      placeholder="VD: 5%"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Tốc độ chạy đường bộ (Speed on road)
                    <input
                      value={form.transportUnit?.specs.speedRoad || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          transportUnit: prev.transportUnit
                            ? {
                                ...prev.transportUnit,
                                specs: { ...prev.transportUnit.specs, speedRoad: val },
                              }
                            : undefined,
                        }));
                      }}
                      placeholder="VD: — (Không tự hành) hoặc 80 km/h"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Tốc độ chạy trên ray (Speed on rail)
                    <input
                      value={form.transportUnit?.specs.speedRail || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          transportUnit: prev.transportUnit
                            ? {
                                ...prev.transportUnit,
                                specs: { ...prev.transportUnit.specs, speedRail: val },
                              }
                            : undefined,
                        }));
                      }}
                      placeholder="VD: 20 km/h"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Khổ đường (Gauge)
                    <input
                      value={form.transportUnit?.specs.gauge || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          transportUnit: prev.transportUnit
                            ? {
                                ...prev.transportUnit,
                                specs: { ...prev.transportUnit.specs, gauge: val },
                              }
                            : undefined,
                        }));
                      }}
                      placeholder="VD: 1435 mm"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Tổng trọng lượng (Total weight)
                    <input
                      value={form.transportUnit?.specs.weight || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          transportUnit: prev.transportUnit
                            ? {
                                ...prev.transportUnit,
                                specs: { ...prev.transportUnit.specs, weight: val },
                              }
                            : undefined,
                        }));
                      }}
                      placeholder="VD: 32 ton"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">
                    Kích thước DxRxC (Dimensions)
                    <input
                      value={form.transportUnit?.specs.dimensions || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          transportUnit: prev.transportUnit
                            ? {
                                ...prev.transportUnit,
                                specs: { ...prev.transportUnit.specs, dimensions: val },
                              }
                            : undefined,
                        }));
                      }}
                      placeholder="VD: 8300 × 2500 × 950 mm"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <div className="text-xs text-slate-500">
            {isUploading && <span className="text-amber-600 font-semibold">Đang upload ảnh lên Cloudinary...</span>}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isUploading}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer disabled:opacity-50"
            >
              {isUploading ? "Đang tải ảnh..." : isCreate ? "Thêm máy mới" : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component chính: MachineList
// -----------------------------------------------------------------------------
export default function MachineList() {
  const [list, setList] = useState(seedMachines);
  const [source, setSource] = useState<"supabase" | "seed">("seed");
  const [dataError, setDataError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Machine | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("welding");
  const [formModal, setFormModal] = useState<{ machine: Machine; mode: "create" | "edit" } | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    loadMachineCatalog().then((result) => {
      if (!active) return;
      // Không thay bằng mảng rỗng nếu Supabase trả về bất thường
      if (result.machines.length > 0) {
        setList(result.machines);
        setSource(result.source);
      } else if (result.source === "seed") {
        setList(seedMachines);
        setSource("seed");
      }
      setDataError(result.error ?? "");
      setCatalogLoading(false);

      const params = new URLSearchParams(window.location.search);
      const mayCode = params.get("may")?.trim();
      const tabRaw = params.get("tab")?.trim().toLowerCase();
      const openTab: DetailTab =
        tabRaw === "personnel" || tabRaw === "nhan-su"
          ? "personnel"
          : tabRaw === "history"
            ? "history"
            : tabRaw === "transport"
              ? "transport"
              : "welding";
      if (mayCode) {
        const pool = result.machines.length > 0 ? result.machines : seedMachines;
        const match = pool.find(
          (m) => m.code.toLowerCase() === mayCode.toLowerCase() || m.id === mayCode,
        );
        if (match) {
          // Chỉ mở chi tiết — không set query để tránh lọc mất danh sách
          setActiveId(match.id);
          setDetail(match);
          setDetailTab(openTab);
        }
      }
    }).catch((error) => {
      if (!active) return;
      setCatalogLoading(false);
      setDataError(error instanceof Error ? error.message : "Không tải được danh sách máy");
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((m) => {
      const matchQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        m.location.toLowerCase().includes(q) ||
        (m.transportUnit?.plateNumber && m.transportUnit.plateNumber.toLowerCase().includes(q));
      const matchStatus = status === "Tất cả trạng thái" || m.status === status;
      return matchQ && matchStatus;
    });
  }, [list, query, status]);

  const running = list.filter((m) => m.status === "Đang làm việc").length;
  const ready = list.filter((m) => m.status === "Sẵn sàng").length;
  const maint = list.filter((m) => m.status === "Bảo trì").length;

  function openEdit(machine: Machine) {
    setDetail(null);
    setFormModal({ machine, mode: "edit" });
  }

  function openDetail(m: Machine, tab: DetailTab = "welding") {
    setActiveId(m.id);
    setDetailTab(tab);
    setDetail(m);
  }

  async function handleDelete(machine: Machine) {
    if (!window.confirm(`Xóa máy "${machine.name}"?`)) return;
    try {
      await deleteMachineInDb(machine.id);
      const remaining = list.filter((m) => m.id !== machine.id);
      setList(remaining);
      if (activeId === machine.id) {
        setActiveId(null);
        setDetail(null);
      }
      setDataError("");
      const failedAssets = await deleteUnreferencedAssets(machine, remaining);
      if (failedAssets.length > 0) {
        setDataError(`Đã xóa máy nhưng chưa dọn được ${failedAssets.length} ảnh Cloudinary.`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Không thể xóa máy";
      setDataError(msg);
      window.alert(`Lỗi xóa máy trên Supabase:\n${msg}\n\nThao tác xóa đã bị hủy.`);
    }
  }

  async function handleSave(updated: Machine) {
    try {
      const previous = list.find((machine) => machine.id === updated.id);
      await updateMachineInDb(updated);
      const nextList = list.map((machine) => (machine.id === updated.id ? updated : machine));
      setList(nextList);
      if (detail?.id === updated.id) setDetail(updated);
      setDataError("");
      setFormModal(null);
      if (previous) {
        const failedAssets = await deleteUnreferencedAssets(previous, nextList);
        if (failedAssets.length > 0) {
          setDataError(`Đã lưu dữ liệu nhưng chưa dọn được ${failedAssets.length} ảnh Cloudinary cũ.`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Không thể cập nhật máy";
      setDataError(msg);
      window.alert(`Lỗi lưu máy lên Supabase:\n${msg}\n\nVui lòng kiểm tra lại thông số.`);
    }
  }

  async function handleCreate(machine: Machine) {
    try {
      const created = await createMachineInDb(machine);
      setList((prev) => [created, ...prev]);
      setDataError("");
      setFormModal(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Không thể thêm máy";
      setDataError(msg);
      window.alert(`Lỗi thêm máy mới lên Supabase:\n${msg}\n\nVui lòng kiểm tra lại thông số.`);
    }
  }

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
      {dataError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800 sm:text-sm">
          {source === "seed" ? "Đang dùng dữ liệu mẫu. " : "Lỗi dữ liệu máy: "}{dataError}
        </div>
      )}
      {catalogLoading && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-medium text-[#0047AB] sm:text-sm">
          Đang đồng bộ danh sách máy từ Supabase…
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{list.length}</strong> máy
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-[#0047AB] font-mono tabular-nums">{running}</strong> đang làm việc · <span className="font-medium text-emerald-700 font-mono tabular-nums">{ready}</span> sẵn sàng · <span className="font-medium text-amber-700 font-mono tabular-nums">{maint}</span> bảo trì
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mã máy, tên máy, model, vị trí, biển số xe..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          {["Tất cả trạng thái", ...statusOptions].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setFormModal({ machine: emptyMachine(), mode: "create" })}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          <Plus size={16} weight="bold" /> Thêm máy mới
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <ul className="divide-y divide-slate-100">
          {filtered.map((m) => {
            const selected = activeId === m.id;
            return (
              <li key={m.id} className={`flex items-start ${selected ? "bg-blue-50/70" : "hover:bg-slate-50/80"} transition-colors duration-150`}>
                <button
                  type="button"
                  onClick={() => openDetail(m)}
                  className="group relative flex flex-1 cursor-pointer items-start gap-3.5 px-4 py-3.5 text-left"
                >
                  {selected && (
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[#0047AB]">
                      <CaretRight size={10} weight="fill" aria-hidden />
                    </span>
                  )}

                  <div className="relative h-[56px] w-[96px] sm:h-[64px] sm:w-[112px] flex-none overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-2xs">
                    <Image src={m.image} alt={m.name} fill className="object-cover" sizes="112px" />
                    <span className="absolute bottom-1 right-1 rounded bg-slate-900/85 px-1.5 py-0.5 text-[11px] font-bold font-mono text-white tracking-wide">
                      {m.code}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="line-clamp-2 text-xs sm:text-sm font-semibold leading-snug text-slate-900">
                      {m.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      <strong className="text-slate-700 font-semibold">{m.model}</strong> · {m.location} · <span className="font-mono tabular-nums">{m.weldCount.toLocaleString("vi-VN")}</span> mối hàn
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[m.status]}`}
                      >
                        {m.status}
                      </span>
                      {m.transportUnit?.plateNumber && (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-700">
                          Xe: {m.transportUnit.plateNumber}
                        </span>
                      )}
                      {m.status === "Sẵn sàng" && (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-2xs">
                          Có thể phân công
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <div className="relative flex shrink-0 items-center gap-1 px-3 py-3.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(m);
                    }}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-[#0047AB] transition-colors duration-150 cursor-pointer"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(m)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors duration-150 cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-xs sm:text-sm text-slate-500">Không tìm thấy máy phù hợp.</li>
          )}
        </ul>
      </div>

      {detail && (
        <MachineDetailModal
          machine={detail}
          initialTab={detailTab}
          onClose={() => { setDetail(null); setActiveId(null); }}
          onEdit={() => openEdit(detail)}
        />
      )}

      {formModal && (
        <MachineFormModal
          machine={formModal.machine}
          mode={formModal.mode}
          modelSuggestions={Array.from(
            new Set([
              ...modelOptions,
              ...list.map((m) => m.model?.trim()).filter((m): m is string => Boolean(m)),
            ]),
          ).sort((a, b) => a.localeCompare(b, "vi"))}
          techSuggestions={Array.from(
            new Set([
              ...WELDING_TECH_OPTIONS,
              ...list.map((m) => m.weldingTechnology?.trim()).filter((m): m is string => Boolean(m)),
            ]),
          ).sort((a, b) => a.localeCompare(b, "vi"))}
          onClose={() => setFormModal(null)}
          onSave={formModal.mode === "create" ? handleCreate : handleSave}
        />
      )}
    </main>
  );
}
