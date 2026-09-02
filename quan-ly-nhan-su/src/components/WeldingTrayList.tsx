"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { weldingTrays, type WeldingTray } from "@/data/welding-trays";
import { CaretRight, DotsThree, MagnifyingGlass, X } from "@/components/icons";

const statusStyle: Record<WeldingTray["status"], string> = {
  "Sẵn sàng": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Đang dùng": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Bảo trì": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  Hỏng: "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
};

const statusOptions: WeldingTray["status"][] = ["Sẵn sàng", "Đang dùng", "Bảo trì", "Hỏng"];

const defaultTrayImage =
  "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=480&h=270&q=80";

function emptyTray(): WeldingTray {
  return {
    id: "",
    code: "",
    name: "",
    machine: "",
    location: "",
    status: "Sẵn sàng",
    capacity: "",
    image: defaultTrayImage,
    railTypes: "",
    lastMaintenance: "—",
    nextMaintenance: "—",
    note: "",
    assignedTo: "",
  };
}

function TrayFormFields({
  form,
  setForm,
}: {
  form: WeldingTray;
  setForm: (t: WeldingTray) => void;
}) {
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Mã ray
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="VD: KH-006"
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Trạng thái
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as WeldingTray["status"] })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 cursor-pointer"
          >
            {statusOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Tên ray hàn
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
        />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Máy gắn kèm
          <input
            value={form.machine}
            onChange={(e) => setForm({ ...form, machine: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Vị trí
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Sức chứa
          <input
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            placeholder="VD: 12 khuôn"
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Loại ray
          <input
            value={form.railTypes}
            onChange={(e) => setForm({ ...form, railTypes: e.target.value })}
            placeholder="VD: UIC60, P50"
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </label>
      </div>
      <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
        Người phụ trách
        <input
          value={form.assignedTo}
          onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
        />
      </label>
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
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2.5 text-xs sm:text-sm last:border-b-0">
      <div className="font-medium text-slate-500">{label}</div>
      <div className="text-slate-900 font-semibold">{value}</div>
    </div>
  );
}

function TrayDetailModal({ tray, onClose }: { tray: WeldingTray; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        aria-labelledby="tray-detail-title"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div className="min-w-0">
            <div className="text-xs font-bold font-mono uppercase tracking-wider text-[#0047AB]">{tray.code}</div>
            <h2 id="tray-detail-title" className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">
              {tray.name}
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
          <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
            <Image src={tray.image} alt={tray.name} fill className="object-cover" sizes="680px" />
          </div>

          <div className="mb-4">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[tray.status]}`}>
              {tray.status}
            </span>
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4 py-1">
            <DetailRow label="Mã ray" value={<span className="font-mono text-[#0047AB]">{tray.code}</span>} />
            <DetailRow label="Máy gắn kèm" value={tray.machine} />
            <DetailRow label="Vị trí" value={tray.location} />
            <DetailRow label="Sức chứa" value={tray.capacity} />
            <DetailRow label="Loại ray" value={tray.railTypes} />
            <DetailRow label="Người phụ trách" value={tray.assignedTo} />
            <DetailRow label="Bảo trì gần nhất" value={<span className="font-mono tabular-nums">{tray.lastMaintenance}</span>} />
            <DetailRow label="Bảo trì tiếp theo" value={<span className="font-mono tabular-nums">{tray.nextMaintenance}</span>} />
            <DetailRow label="Ghi chú" value={tray.note} />
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
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

function TrayFormModal({
  tray,
  mode,
  onClose,
  onSave,
}: {
  tray: WeldingTray;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (updated: WeldingTray) => void;
}) {
  const [form, setForm] = useState(tray);
  const isCreate = mode === "create";

  useEffect(() => {
    setForm(tray);
  }, [tray]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit() {
    if (!form.code.trim()) {
      window.alert("Vui lòng nhập mã ray.");
      return;
    }
    if (!form.name.trim()) {
      window.alert("Vui lòng nhập tên ray hàn.");
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
              {isCreate ? "Thêm ray hàn" : "Sửa ray hàn"}
            </div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">
              {isCreate ? "Ray hàn mới" : tray.name}
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
          <TrayFormFields form={form} setForm={setForm} />
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
            {isCreate ? "Thêm ray hàn" : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WeldingTrayList() {
  const [list, setList] = useState(weldingTrays);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WeldingTray | null>(null);
  const [formModal, setFormModal] = useState<{ tray: WeldingTray; mode: "create" | "edit" } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((t) => {
      const matchQ =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.machine.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q);
      const matchStatus = status === "Tất cả trạng thái" || t.status === status;
      return matchQ && matchStatus;
    });
  }, [list, query, status]);

  function openDetail(t: WeldingTray) {
    setActiveId(t.id);
    setDetail(t);
  }

  function handleDelete(tray: WeldingTray) {
    if (!window.confirm(`Xóa ray hàn "${tray.name}"?`)) return;
    setList((prev) => prev.filter((t) => t.id !== tray.id));
    if (activeId === tray.id) {
      setActiveId(null);
      setDetail(null);
    }
  }

  function handleSave(updated: WeldingTray) {
    setList((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (detail?.id === updated.id) setDetail(updated);
    setFormModal(null);
  }

  function handleCreate(tray: WeldingTray) {
    const id = String(Date.now());
    setList((prev) => [{ ...tray, id }, ...prev]);
    setFormModal(null);
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{list.length}</strong> ray hàn
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">
            {list.filter((t) => t.status === "Sẵn sàng").length}
          </strong>{" "}
          sẵn sàng · <span className="font-medium text-[#0047AB] font-mono tabular-nums">{list.filter((t) => t.status === "Đang dùng").length}</span> đang dùng
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mã ray, tên, máy, vị trí..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          {["Tất cả trạng thái", "Sẵn sàng", "Đang dùng", "Bảo trì", "Hỏng"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setFormModal({ tray: emptyTray(), mode: "create" })}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Thêm ray hàn
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <ul className="divide-y divide-slate-100">
          {filtered.map((t) => {
            const selected = activeId === t.id;
            return (
              <li key={t.id} className={`flex items-start ${selected ? "bg-blue-50/70" : "hover:bg-slate-50/80"} transition-colors duration-150`}>
                <button
                  type="button"
                  onClick={() => openDetail(t)}
                  className="group relative flex flex-1 cursor-pointer items-start gap-3.5 px-4 py-3.5 text-left"
                >
                  {selected && (
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[#0047AB]">
                      <CaretRight size={10} weight="fill" aria-hidden />
                    </span>
                  )}

                  <div className="relative h-[72px] w-[128px] flex-none overflow-hidden rounded-lg bg-slate-100 border border-slate-200 shadow-2xs">
                    <Image src={t.image} alt={t.name} fill className="object-cover" sizes="128px" />
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-slate-900/85 px-1.5 py-0.5 text-[11px] font-bold font-mono text-white tracking-wide">
                      {t.code}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="line-clamp-2 text-xs sm:text-sm font-semibold leading-snug text-slate-900">
                      {t.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Máy <strong className="text-slate-700 font-semibold">{t.machine}</strong> · {t.location} · {t.capacity}
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[t.status]}`}
                      >
                        {t.status}
                      </span>
                    </div>
                  </div>
                </button>

                <div className="relative flex shrink-0 items-center gap-1 px-3 py-3.5">
                  <button
                    type="button"
                    onClick={() => setFormModal({ tray: t, mode: "edit" })}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-[#0047AB] transition-colors duration-150 cursor-pointer"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors duration-150 cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-xs sm:text-sm text-slate-500">Không tìm thấy ray hàn.</li>
          )}
        </ul>
      </div>

      {detail && <TrayDetailModal tray={detail} onClose={() => { setDetail(null); setActiveId(null); }} />}

      {formModal && (
        <TrayFormModal
          tray={formModal.tray}
          mode={formModal.mode}
          onClose={() => setFormModal(null)}
          onSave={formModal.mode === "create" ? handleCreate : handleSave}
        />
      )}
    </main>
  );
}
