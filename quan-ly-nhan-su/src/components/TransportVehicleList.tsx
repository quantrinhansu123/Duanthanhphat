"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Plus, X } from "@/components/icons";
import {
  machines as seedMachines,
  type Machine,
  type TransportUnitDetail,
} from "@/data/machines";
import {
  loadMachineCatalog,
  updateMachine as updateMachineInDb,
} from "@/lib/machineCatalogDb";

type VehicleRow = {
  machineId: string;
  machineCode: string;
  machineName: string;
  machineStatus: Machine["status"];
  transport: TransportUnitDetail;
};

function hasVehicleInfo(unit?: TransportUnitDetail | null) {
  if (!unit) return false;
  return Boolean(
    unit.code?.trim() ||
      unit.name?.trim() ||
      unit.model?.trim() ||
      unit.plateNumber?.trim() ||
      unit.coverImage?.trim() ||
      unit.manufacturer?.trim() ||
      unit.specs?.weight ||
      unit.specs?.dimensions ||
      unit.specs?.gauge,
  );
}

function toRows(machines: Machine[]): VehicleRow[] {
  return machines
    .filter((machine) => hasVehicleInfo(machine.transportUnit))
    .map((machine) => ({
      machineId: machine.id,
      machineCode: machine.code,
      machineName: machine.name,
      machineStatus: machine.status,
      transport: machine.transportUnit!,
    }));
}

function emptyTransport(): TransportUnitDetail {
  return {
    code: "",
    name: "",
    model: "",
    serial: "",
    manufacturer: "",
    plateNumber: "",
    coverImage: "",
    gallery: [],
    specs: {
      weight: "",
      dimensions: "",
      gauge: "",
    },
  };
}

export default function TransportVehicleList() {
  const [machines, setMachines] = useState<Machine[]>(seedMachines);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<VehicleRow | null>(null);
  const [form, setForm] = useState<TransportUnitDetail>(emptyTransport());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadMachineCatalog()
      .then((result) => {
        if (!active) return;
        if (result.machines.length > 0) setMachines(result.machines);
        else setMachines(seedMachines);
        setError(result.error ?? "");
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Không tải được phương tiện");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => toRows(machines), [machines]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    if (!keyword) return rows;
    return rows.filter((row) =>
      [
        row.machineCode,
        row.machineName,
        row.transport.code,
        row.transport.name,
        row.transport.model,
        row.transport.plateNumber,
        row.transport.manufacturer,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("vi").includes(keyword)),
    );
  }, [rows, query]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  function openEdit(row: VehicleRow) {
    setEditing(row);
    setForm({
      ...row.transport,
      specs: {
        ...row.transport.specs,
        weight: row.transport.specs?.weight ?? "",
        dimensions: row.transport.specs?.dimensions ?? "",
        gauge: row.transport.specs?.gauge ?? "",
      },
    });
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const parent = machines.find((item) => item.id === editing.machineId);
      if (!parent) throw new Error("Không tìm thấy máy gắn phương tiện");
      const next: Machine = {
        ...parent,
        transportUnit: {
          ...form,
          manufacturer: form.manufacturer?.trim() || "",
          specs: {
            ...form.specs,
            weight: String(form.specs?.weight ?? "").trim(),
            dimensions: String(form.specs?.dimensions ?? "").trim(),
            gauge: String(form.specs?.gauge ?? "").trim(),
          },
        },
      };
      const saved = await updateMachineInDb(next);
      setMachines((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setEditing(null);
      showToast("Đã cập nhật phương tiện");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu phương tiện");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      {error && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800 sm:text-sm">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Quản lý phương tiện vận chuyển</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Tên NSX · Tải trọng · Kích thước · Khổ đường — {filtered.length}/{rows.length} phương tiện
          </p>
        </div>
        <Link
          href="/danh-sach-may"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
        >
          <Plus size={14} weight="bold" aria-hidden /> Gắn qua danh sách máy hàn
        </Link>
      </div>

      <div className="mb-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm mã xe, biển số, NSX, máy gắn…"
          className="h-10 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <ul className="divide-y divide-slate-100">
          {filtered.map((row) => {
            const image = row.transport.coverImage || row.transport.gallery?.[0] || "";
            return (
              <li key={`${row.machineId}-${row.transport.code || row.transport.plateNumber || "xe"}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50/80">
                <div className="relative h-[96px] w-[148px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:h-[112px] sm:w-[176px]">
                  {image ? (
                    <Image src={image} alt="" fill className="object-cover" sizes="176px" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">Chưa có ảnh</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">
                    {row.transport.name || "Phương tiện chưa đặt tên"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-[#0047AB]">{row.transport.code || "—"}</span>
                    {row.transport.plateNumber ? ` · Biển số ${row.transport.plateNumber}` : ""}
                    {row.transport.model ? ` · ${row.transport.model}` : ""}
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-slate-700 sm:grid-cols-2">
                    <div><span className="text-slate-500">Tên NSX:</span> {row.transport.manufacturer || "—"}</div>
                    <div><span className="text-slate-500">Tải trọng:</span> {String(row.transport.specs?.weight || "—")}</div>
                    <div><span className="text-slate-500">Kích thước:</span> {String(row.transport.specs?.dimensions || "—")}</div>
                    <div><span className="text-slate-500">Khổ đường:</span> {String(row.transport.specs?.gauge || "—")}</div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    Gắn máy: <Link href={`/danh-sach-may?may=${encodeURIComponent(row.machineCode)}`} className="font-mono font-semibold text-[#0047AB] hover:underline">{row.machineCode}</Link>
                    {" · "}{row.machineStatus}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#0047AB] hover:bg-blue-50"
                >
                  Sửa
                </button>
              </li>
            );
          })}
          {!loading && filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-sm text-slate-500">Chưa có phương tiện vận chuyển.</li>
          )}
          {loading && (
            <li className="px-4 py-12 text-center text-sm text-slate-500">Đang tải phương tiện…</li>
          )}
        </ul>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={() => !saving && setEditing(null)}>
          <div
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">Phương tiện vận chuyển</div>
                <h3 className="text-base font-bold text-slate-900">Sửa thông tin xe · {editing.machineCode}</h3>
              </div>
              <button type="button" disabled={saving} onClick={() => setEditing(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="space-y-3.5 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Mã phương tiện
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm outline-hidden focus:border-[#0047AB]" />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Biển số
                  <input value={form.plateNumber || ""} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm outline-hidden focus:border-[#0047AB]" />
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-700">
                Tên phương tiện
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-hidden focus:border-[#0047AB]" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Tên NSX
                <input value={form.manufacturer || ""} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="VD: Volvo / TCW" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-hidden focus:border-[#0047AB]" />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Tải trọng
                  <input
                    value={String(form.specs?.weight ?? "")}
                    onChange={(e) => setForm({ ...form, specs: { ...form.specs, weight: e.target.value } })}
                    placeholder="VD: 32 ton"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-hidden focus:border-[#0047AB]"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Kích thước
                  <input
                    value={String(form.specs?.dimensions ?? "")}
                    onChange={(e) => setForm({ ...form, specs: { ...form.specs, dimensions: e.target.value } })}
                    placeholder="VD: 8300 × 2500 × 950 mm"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-hidden focus:border-[#0047AB]"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Khổ đường
                  <input
                    value={String(form.specs?.gauge ?? "")}
                    onChange={(e) => setForm({ ...form, specs: { ...form.specs, gauge: e.target.value } })}
                    placeholder="VD: 1435 mm"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-hidden focus:border-[#0047AB]"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" disabled={saving} onClick={() => setEditing(null)} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Hủy</button>
              <button type="button" disabled={saving} onClick={() => void handleSave()} className="h-10 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A] disabled:opacity-50">
                {saving ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl sm:text-sm">
          <Check size={16} weight="bold" className="text-emerald-500" aria-hidden />
          {toast}
        </div>
      )}
    </main>
  );
}
