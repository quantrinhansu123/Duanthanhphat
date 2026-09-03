"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  formatMaintenanceDate,
  getMachineMaintenanceHistory,
  type MachineMaintenanceHistoryRow,
} from "@/data/machine-maintenance-history";
import { machines as seedMachines, type Machine } from "@/data/machines";
import { CaretRight, DotsThree, MagnifyingGlass, X } from "@/components/icons";
import {
  createMachine as createMachineInDb,
  deleteMachine as deleteMachineInDb,
  loadMachineCatalog,
  updateMachine as updateMachineInDb,
} from "@/lib/machineCatalogDb";

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

const defaultMachineImage = "/may-han/kcm007.jpg";

const modelImages: Record<string, string> = {
  "KCM-007 (K922-1)": "/may-han/kcm007.jpg",
  KCM007: "/may-han/kcm007.jpg",
  "UN5-150ZC2-C6": "/may-han/un5-150zc2-c6-main.jpg",
};

function imageForModel(model: string) {
  return modelImages[model] ?? defaultMachineImage;
}

function emptyMachine(): Machine {
  return {
    id: "",
    code: "",
    name: "",
    model: "KCM-007 (K922-1)",
    type: "Tổ hợp máy hàn ray lưu động gắn trên xe tải (Road-Rail)",
    nameEn: "Rail Welding Complex",
    nameVi: "Tổ hợp máy hàn ray lưu động gắn trên xe tải",
    brand: "TCW",
    manufacturer: "Chengdu Aigre Technology / TCW",
    plant: "Trung tâm Cơ giới TCW",
    location: "",
    currentProject: "Dự án ĐSCT Bắc – Nam",
    status: "Sẵn sàng",
    available: true,
    weldCount: 0,
    image: imageForModel("KCM007"),
    gallery: [imageForModel("KCM007")],
    serialNumber: "Chờ cập nhật theo hồ sơ thiết bị",
    yearInstalled: new Date().getFullYear(),
    weldingTechnology: "Flash Butt Welding – FBW (Hàn tiếp xúc đối đầu)",
    supportedRails: "43 – 75 kg/m · Khổ ray 1.000 mm & 1.435 mm",
    weldingCapacity: "12 mối/giờ",
    operator: "",
    personInCharge: "Kỹ sư trưởng TCW",
    team: "Tổ hàn cơ giới 1",
    lastMaintenance: "—",
    nextMaintenance: "—",
    operatingHours: 0,
    errorRate: "0,0%",
    note: "",
    specs: {
      applicationWork: "On rail / road / stationary",
      emissionStandard: "Euro V",
      axes: 4,
      clampingGradient: "3.5%",
      speedRoad: "80 km/h",
      speedRail: "25 km/h",
      gauge: "1.000 mm, 1.435 mm",
      weight: "35 tấn (ton)",
      dimensions: "10.000 × 3.200 × 2.500 mm",
      upsettingForce: "90 ~ 120 kN",
      clampingForce: "280 kN",
      weldingStroke: "100 – 120 mm",
      efficiency: "12 mối/giờ",
    },
  };
}

function MachineFormFields({
  form,
  setForm,
}: {
  form: Machine;
  setForm: (m: Machine) => void;
}) {
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Mã máy
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="VD: KCM007-03"
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Model
          <select
            value={form.model}
            onChange={(e) => {
              const model = e.target.value;
              const img = imageForModel(model);
              setForm({
                ...form,
                model,
                image: img,
                gallery: model === "UN5-150ZC2-C6"
                  ? ["/may-han/un5-150zc2-c6-main.jpg", "/may-han/un5-150zc2-c6-detail.jpg", "/may-han/un5-150zc2-c6-action.jpg"]
                  : ["/may-han/kcm007.jpg"],
              });
            }}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 cursor-pointer"
          >
            {modelOptions.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Tên máy
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
        />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Loại máy
          <input
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Công nghệ hàn
          <input
            value={form.weldingTechnology}
            onChange={(e) => setForm({ ...form, weldingTechnology: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Loại ray hỗ trợ
          <input
            value={form.supportedRails}
            onChange={(e) => setForm({ ...form, supportedRails: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Năng suất hàn
          <input
            value={form.weldingCapacity}
            onChange={(e) => setForm({ ...form, weldingCapacity: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Vị trí hiện tại
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="VD: Km 15+200 · Ga Hà Nội"
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Dự án đang phục vụ
          <input
            value={form.currentProject}
            onChange={(e) => setForm({ ...form, currentProject: e.target.value })}
            placeholder="VD: Dự án ĐSCT Bắc – Nam"
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Trạng thái
          <select
            value={form.status}
            onChange={(e) => {
              const status = e.target.value as Machine["status"];
              setForm({ ...form, status, available: status === "Sẵn sàng" });
            }}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 cursor-pointer"
          >
            {statusOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 sm:mt-6">
          <strong>Sẵn sàng</strong>: máy không làm việc và không bảo trì, có thể nhận lịch mới.
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Số serial (Catalogue/Hồ sơ)
          <input
            value={form.serialNumber}
            onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Năm sản xuất / đưa vào sử dụng
          <input
            type="number"
            min={1990}
            max={2100}
            value={form.yearInstalled}
            onChange={(e) => setForm({ ...form, yearInstalled: Number(e.target.value) })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Tổ vận hành
          <input
            value={form.team}
            onChange={(e) => setForm({ ...form, team: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Người phụ trách / Vận hành
          <input
            value={form.personInCharge}
            onChange={(e) => setForm({ ...form, personInCharge: e.target.value, operator: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </label>
      </div>
      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Ghi chú
        <textarea
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          rows={3}
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 resize-y"
        />
      </label>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2.5 text-xs sm:text-sm last:border-b-0">
      <div className="font-medium text-slate-500">{label}</div>
      <div className="text-slate-900 font-semibold">{value}</div>
    </div>
  );
}

function MachineDetailModal({
  machine,
  onClose,
  onEdit,
  initialTab = "info",
}: {
  machine: Machine;
  onClose: () => void;
  onEdit: () => void;
  initialTab?: "info" | "history";
}) {
  const [tab, setTab] = useState<"info" | "history">(initialTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(machine.image);
  const history = useMemo(() => getMachineMaintenanceHistory(machine.code), [machine.code]);

  useEffect(() => {
    setActiveImage(machine.image);
  }, [machine.image]);

  useEffect(() => {
    setTab(initialTab);
  }, [machine.id, initialTab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const galleryImages = machine.gallery && machine.gallery.length > 0 ? machine.gallery : [machine.image];

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
        aria-labelledby="machine-detail-title"
        className="relative z-10 flex max-h-[92dvh] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-[#0047AB] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {machine.code}
              </span>
              <span className="text-xs font-bold text-slate-500 font-mono">
                {machine.model}
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                {machine.brand}
              </span>
            </div>
            <h2 id="machine-detail-title" className="mt-1 text-base sm:text-lg font-bold text-slate-900">
              {machine.name}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
                aria-label="Tùy chọn"
              >
                <DotsThree size={16} weight="bold" aria-hidden />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100 text-left">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit();
                    }}
                    className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                  >
                    Chỉnh sửa
                  </button>
                </div>
              )}
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
        </div>

        <div className="flex gap-1 border-b border-slate-200 px-5 sm:px-6 pt-1 bg-slate-50">
          <button
            type="button"
            onClick={() => setTab("info")}
            className={`border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors duration-150 cursor-pointer ${
              tab === "info"
                ? "border-[#0047AB] text-[#0047AB]"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Hồ sơ & Thông số Catalogue
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors duration-150 cursor-pointer ${
              tab === "history"
                ? "border-[#0047AB] text-[#0047AB]"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Lịch sử bảo trì
            {history.length > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold font-mono text-[#0047AB]">
                {history.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {tab === "info" ? (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-900 border border-slate-200 shadow-md">
                  <Image
                    src={activeImage}
                    alt={machine.name}
                    fill
                    className="object-cover"
                    sizes="800px"
                    priority
                  />
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[machine.status]}`}>
                      {machine.status}
                    </span>
                    {machine.status === "Sẵn sàng" && (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/95 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-2xs">
                        Có thể phân công
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-2.5 left-2.5 rounded-md bg-slate-900/80 px-2 py-1 text-xs text-white backdrop-blur-xs font-mono">
                    {machine.code} · {machine.model}
                  </div>
                </div>

                {galleryImages.length > 1 && (
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                    <span className="text-xs font-semibold text-slate-500 shrink-0">Thư viện ảnh ({galleryImages.length}):</span>
                    {galleryImages.map((img, idx) => {
                      const isActive = img === activeImage;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveImage(img)}
                          className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all cursor-pointer ${
                            isActive ? "border-[#0047AB] ring-2 ring-[#0047AB]/30 scale-105" : "border-slate-200 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <Image src={img} alt={`Góc máy ${idx + 1}`} fill className="object-cover" sizes="80px" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 1. Hồ sơ máy (đủ 18 trường thông tin) */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                  1. Hồ sơ thiết bị & Vận hành
                </h3>
                <div className="divide-y divide-slate-100">
                  <DetailRow label="Mã máy" value={<span className="font-mono font-bold text-[#0047AB]">{machine.code}</span>} />
                  <DetailRow label="Tên máy" value={machine.name} />
                  <DetailRow label="Model" value={<span className="font-mono font-bold text-slate-800">{machine.model}</span>} />
                  <DetailRow label="Loại máy" value={machine.type} />
                  <DetailRow label="Serial Number" value={<span className="font-mono text-slate-700">{machine.serialNumber}</span>} />
                  <DetailRow label="Năm sản xuất / Đưa vào dùng" value={machine.yearInstalled} />
                  <DetailRow label="Công nghệ hàn" value={<span className="font-semibold text-[#0047AB]">{machine.weldingTechnology}</span>} />
                  <DetailRow label="Loại ray hỗ trợ" value={<span className="font-mono">{machine.supportedRails}</span>} />
                  <DetailRow label="Công suất / Năng suất hàn" value={<span className="font-bold text-emerald-700">{machine.weldingCapacity}</span>} />
                  <DetailRow label="Tổng số giờ hoạt động" value={<span className="font-mono tabular-nums">{`${machine.operatingHours.toLocaleString("vi-VN")} giờ`}</span>} />
                  <DetailRow label="Tổng số mối hàn" value={<span className="font-mono tabular-nums text-slate-900">{`${machine.weldCount.toLocaleString("vi-VN")} mối`}</span>} />
                  <DetailRow label="Vị trí hiện tại" value={machine.location} />
                  <DetailRow label="Dự án đang phục vụ" value={<span className="text-[#0047AB] font-semibold">{machine.currentProject || "—"}</span>} />
                  <DetailRow label="Người phụ trách" value={machine.personInCharge} />
                  <DetailRow label="Tổ vận hành" value={`${machine.team} ${machine.operator ? `· Thợ chính: ${machine.operator}` : ""}`} />
                  <DetailRow label="Bảo trì gần nhất" value={<span className="font-mono">{machine.lastMaintenance}</span>} />
                  <DetailRow label="Bảo trì tiếp theo" value={<span className="font-mono text-amber-700 font-semibold">{machine.nextMaintenance}</span>} />
                  <DetailRow label="Trạng thái" value={
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[machine.status]}`}>
                      {machine.status}
                    </span>
                  } />
                  <DetailRow label="Ghi chú" value={<span className="text-slate-700 leading-relaxed">{machine.note || "—"}</span>} />
                </div>
              </div>

              {/* 2. Thông số kỹ thuật từ Catalogue chính thức (Thanh Phát – Aigre) */}
              {machine.specs && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                      2. Thông số kỹ thuật chuẩn Catalogue (Thanh Phát – Aigre)
                    </h3>
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-[#0047AB]">
                      Catalogue Official
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs sm:text-sm">
                    {machine.specs.applicationWork && (
                      <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                        <span className="text-slate-500">Ứng dụng thi công</span>
                        <span className="font-semibold text-slate-900 text-right">{machine.specs.applicationWork}</span>
                      </div>
                    )}
                    {machine.specs.emissionStandard && (
                      <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                        <span className="text-slate-500">Tiêu chuẩn khí thải</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">{machine.specs.emissionStandard}</span>
                      </div>
                    )}
                    {machine.specs.axes !== undefined && (
                      <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                        <span className="text-slate-500">Số trục</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">{machine.specs.axes} trục</span>
                      </div>
                    )}
                    {machine.specs.clampingGradient && (
                      <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                        <span className="text-slate-500">Độ dốc kẹp lớn nhất</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">{machine.specs.clampingGradient}</span>
                      </div>
                    )}
                    {machine.specs.speedRoad && (
                      <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                        <span className="text-slate-500">Tốc độ chạy đường bộ</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">{machine.specs.speedRoad}</span>
                      </div>
                    )}
                    {machine.specs.speedRail && (
                      <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                        <span className="text-slate-500">Tốc độ chạy trên ray</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">{machine.specs.speedRail}</span>
                      </div>
                    )}
                    {machine.specs.gauge && (
                      <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                        <span className="text-slate-500">Khổ ray (Gauge)</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">{machine.specs.gauge}</span>
                      </div>
                    )}
                    {machine.specs.weight && (
                      <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                        <span className="text-slate-500">Tổng trọng lượng</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">{machine.specs.weight}</span>
                      </div>
                    )}
                    {machine.specs.dimensions && (
                      <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                        <span className="text-slate-500">Kích thước DxRxC</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">{machine.specs.dimensions}</span>
                      </div>
                    )}
                    {machine.specs.upsettingForce && (
                      <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                        <span className="text-slate-500">Lực ép lớn nhất (Upsetting)</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">{machine.specs.upsettingForce}</span>
                      </div>
                    )}
                    {machine.specs.clampingForce && (
                      <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                        <span className="text-slate-500">Lực kẹp định mức (Clamping)</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">{machine.specs.clampingForce}</span>
                      </div>
                    )}
                    {machine.specs.weldingStroke && (
                      <div className="flex justify-between border-b border-slate-200/80 py-1.5 px-1">
                        <span className="text-slate-500">Hành trình hàn lớn nhất</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">{machine.specs.weldingStroke}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs sm:text-sm text-slate-500">
                  <strong className="font-semibold text-slate-900 font-mono tabular-nums">{history.length}</strong> lần bảo trì · sắp xếp mới nhất trước
                </div>
              </div>

              {history.length > 0 ? (
                <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[680px] border-collapse text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        <th className="px-3.5 py-2.5">Ngày</th>
                        <th className="px-3.5 py-2.5">Giờ</th>
                        <th className="min-w-[200px] px-3.5 py-2.5">Công việc</th>
                        <th className="px-3.5 py-2.5">Loại</th>
                        <th className="px-3.5 py-2.5">Trạng thái</th>
                        <th className="px-3.5 py-2.5">Thời lượng</th>
                        <th className="min-w-[160px] px-3.5 py-2.5">Nhân sự</th>
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
                            {row.note && <div className="mt-0.5 text-xs text-slate-500">{row.note}</div>}
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
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
          >
            Chỉnh sửa
          </button>
        </div>
      </div>
    </div>
  );
}

function MachineFormModal({
  machine,
  mode,
  onClose,
  onSave,
}: {
  machine: Machine;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (updated: Machine) => void;
}) {
  const [form, setForm] = useState(machine);
  const isCreate = mode === "create";

  useEffect(() => {
    setForm(machine);
  }, [machine]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit() {
    if (!form.name.trim()) {
      window.alert("Vui lòng nhập tên máy.");
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
    onSave(form);
  }

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
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
              {isCreate ? "Thêm máy" : "Sửa máy"}
            </div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">
              {isCreate ? "Máy hàn mới" : machine.name}
            </h2>
          </div>
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

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          <MachineFormFields form={form} setForm={setForm} />
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
          >
            {isCreate ? "Thêm máy" : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MachineList() {
  const [list, setList] = useState(seedMachines);
  const [source, setSource] = useState<"supabase" | "seed">("seed");
  const [dataError, setDataError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [plant, setPlant] = useState("Tất cả nhà máy");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Machine | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "history">("info");
  const [formModal, setFormModal] = useState<{ machine: Machine; mode: "create" | "edit" } | null>(null);

  useEffect(() => {
    let active = true;
    loadMachineCatalog().then((result) => {
      if (!active) return;
      setList(result.machines);
      setSource(result.source);
      setDataError(result.error ?? "");
    });
    return () => {
      active = false;
    };
  }, []);

  const plants = useMemo(
    () => ["Tất cả nhà máy", ...Array.from(new Set(list.map((m) => m.plant)))],
    [list],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((m) => {
      const matchQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        m.location.toLowerCase().includes(q);
      const matchStatus = status === "Tất cả trạng thái" || m.status === status;
      const matchPlant = plant === "Tất cả nhà máy" || m.plant === plant;
      return matchQ && matchStatus && matchPlant;
    });
  }, [list, query, status, plant]);

  const running = list.filter((m) => m.status === "Đang làm việc").length;
  const ready = list.filter((m) => m.status === "Sẵn sàng").length;
  function openEdit(machine: Machine) {
    setDetail(null);
    setFormModal({ machine, mode: "edit" });
  }
  const maint = list.filter((m) => m.status === "Bảo trì").length;


  function openDetail(m: Machine, tab: "info" | "history" = "info") {
    setActiveId(m.id);
    setDetailTab(tab);
    setDetail(m);
  }

  async function handleDelete(machine: Machine) {
    if (!window.confirm(`Xóa máy "${machine.name}"?`)) return;
    try {
      await deleteMachineInDb(machine.id);
      setList((prev) => prev.filter((m) => m.id !== machine.id));
      if (activeId === machine.id) {
        setActiveId(null);
        setDetail(null);
      }
      setDataError("");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Không thể xóa máy";
      setDataError(msg);
      window.alert(`Lỗi xóa máy trên Supabase:\n${msg}\n\nThao tác xóa đã bị hủy.`);
    }
  }

  async function handleSave(updated: Machine) {
    try {
      await updateMachineInDb(updated);
      setList((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      if (detail?.id === updated.id) setDetail(updated);
      setDataError("");
      setFormModal(null);
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
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      {dataError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800 sm:text-sm">
          {source === "seed" ? "Đang dùng dữ liệu mẫu. " : "Lỗi dữ liệu máy: "}{dataError}
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
            placeholder="Tìm mã máy, tên máy, model..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <select
            value={plant}
            onChange={(e) => setPlant(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {plants.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {["Tất cả trạng thái", ...statusOptions].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setFormModal({ machine: emptyMachine(), mode: "create" })}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Thêm máy
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

                  <div className="relative h-[76px] w-[130px] sm:h-[80px] sm:w-[144px] flex-none overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-2xs">
                    <Image src={m.image} alt={m.name} fill className="object-cover" sizes="144px" />
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
          onClose={() => setFormModal(null)}
          onSave={formModal.mode === "create" ? handleCreate : handleSave}
        />
      )}
    </main>
  );
}
