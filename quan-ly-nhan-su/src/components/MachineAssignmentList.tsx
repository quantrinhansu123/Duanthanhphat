"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check } from "@/components/icons";
import MachineAssignmentFormModal from "@/components/MachineAssignmentFormModal";
import {
  formatOperatingHours,
  formatScheduleDate,
  type LookupOption,
  type MachineOption,
  type MachineRunSchedule,
} from "@/data/machineAssignments";
import {
  deleteMachineRunSchedule,
  insertMachineRunSchedule,
  loadMachineRunScheduleBundle,
  updateMachineRunSchedule,
  type MachineRunScheduleFormValues,
} from "@/lib/machineRunSchedulesDb";

type ModalState =
  | { mode: "add" }
  | { mode: "view" | "edit"; row: MachineRunSchedule };

function createLocalSchedule(
  values: MachineRunScheduleFormValues,
  machines: MachineOption[],
  projects: LookupOption[],
  personnel: LookupOption[],
  id = `local-${Date.now()}`,
): MachineRunSchedule {
  const machine = machines.find((item) => item.id === values.machineId);
  const project = projects.find((item) => item.id === values.projectId);
  const person = personnel.find((item) => item.id === values.personInChargeId);
  return {
    id,
    date: values.date,
    machineId: values.machineId,
    machineCode: machine?.code ?? "—",
    machineName: machine?.name ?? "Máy chưa xác định",
    location: values.location,
    operatingHours: values.operatingHours,
    projectId: values.projectId,
    projectName: project?.label ?? "Dự án chưa xác định",
    personInChargeId: values.personInChargeId,
    personInChargeName: person?.label ?? "Chưa xác định",
  };
}

export default function MachineAssignmentList() {
  const [list, setList] = useState<MachineRunSchedule[]>([]);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [projects, setProjects] = useState<LookupOption[]>([]);
  const [personnel, setPersonnel] = useState<LookupOption[]>([]);
  const [source, setSource] = useState<"supabase" | "seed">("seed");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [machineId, setMachineId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [personId, setPersonId] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const bundle = await loadMachineRunScheduleBundle();
    setList(bundle.schedules);
    setMachines(bundle.machines);
    setProjects(bundle.projects);
    setPersonnel(bundle.personnel);
    setSource(bundle.source);
    setLoadError(bundle.error ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    return list.filter((row) => {
      if (dateFrom && row.date < dateFrom) return false;
      if (dateTo && row.date > dateTo) return false;
      if (machineId && row.machineId !== machineId) return false;
      if (projectId && row.projectId !== projectId) return false;
      if (personId && row.personInChargeId !== personId) return false;
      if (!keyword) return true;
      return [row.machineCode, row.machineName, row.location, row.projectName, row.personInChargeName]
        .some((value) => value.toLocaleLowerCase("vi").includes(keyword));
    });
  }, [list, query, dateFrom, dateTo, machineId, projectId, personId]);

  const machineHours = useMemo(() => {
    const totals = new Map<string, { label: string; hours: number }>();
    for (const row of filtered) {
      const current = totals.get(row.machineId) ?? {
        label: `${row.machineCode} · ${row.machineName}`,
        hours: 0,
      };
      current.hours += row.operatingHours;
      totals.set(row.machineId, current);
    }
    return Array.from(totals.values()).sort((a, b) => b.hours - a.hours);
  }, [filtered]);

  const totalHours = filtered.reduce((sum, row) => sum + row.operatingHours, 0);
  const hasFilter = Boolean(query || dateFrom || dateTo || machineId || projectId || personId);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  async function handleSave(values: MachineRunScheduleFormValues) {
    setSaving(true);
    try {
      if (source === "supabase") {
        if (modal?.mode === "edit") await updateMachineRunSchedule(modal.row.id, values);
        else await insertMachineRunSchedule(values);
        await reload();
      } else if (modal?.mode === "edit") {
        setList((current) => current.map((row) =>
          row.id === modal.row.id
            ? createLocalSchedule(values, machines, projects, personnel, row.id)
            : row,
        ));
      } else {
        setList((current) => [createLocalSchedule(values, machines, projects, personnel), ...current]);
      }
      setModal(null);
      showToast(modal?.mode === "edit" ? "Đã cập nhật lịch chạy máy" : "Đã thêm lịch chạy máy");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Không thể lưu lịch chạy máy");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: MachineRunSchedule) {
    if (!window.confirm(`Xóa lịch chạy ${row.machineCode} ngày ${formatScheduleDate(row.date)}?`)) return;
    setSaving(true);
    try {
      if (source === "supabase") await deleteMachineRunSchedule(row.id);
      setList((current) => current.filter((item) => item.id !== row.id));
      showToast("Đã xóa lịch chạy máy");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Không thể xóa lịch chạy máy");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-8 sm:px-6">
      {loadError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 sm:text-sm">
          <div className="font-semibold">Đang hiển thị dữ liệu mẫu</div>
          <div className="mt-0.5">
            Hãy chạy file <span className="font-mono">supabase/lich_chay_may.sql</span> để bật lưu dữ liệu thật. {loadError}
          </div>
        </div>
      )}

      <div className="mb-4 grid gap-3.5 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Lượt chạy</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">{filtered.length}</div>
          <div className="mt-1.5 text-xs text-slate-400">Theo bộ lọc hiện tại</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng giờ hoạt động</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#0047AB]">
            {totalHours.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1.5 text-xs text-slate-400">Giờ máy đã ghi nhận</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Máy có hoạt động</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-emerald-700">{machineHours.length}</div>
          <div className="mt-1.5 text-xs text-slate-400">Trên {machines.length} máy trong danh mục</div>
        </div>
      </div>

      <section className="mb-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Số giờ theo máy</h2>
            <p className="mt-0.5 text-xs text-slate-500">Tự động cộng từ các dòng lịch chạy bên dưới</p>
          </div>
          <button
            type="button"
            onClick={() => setModal({ mode: "add" })}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#00388A] sm:text-sm"
          >
            <span className="text-base leading-none">+</span> Thêm lịch chạy
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {machineHours.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
              <span className="min-w-0 truncate text-xs font-semibold text-slate-700 sm:text-sm" title={item.label}>{item.label}</span>
              <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-[#0047AB] sm:text-sm">{formatOperatingHours(item.hours)}</span>
            </div>
          ))}
          {!loading && machineHours.length === 0 && <div className="text-sm text-slate-500">Chưa có dữ liệu giờ máy.</div>}
        </div>
      </section>

      <section className="mb-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm máy, vị trí, dự án…"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm xl:col-span-2"
          />
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] sm:text-sm" aria-label="Từ ngày" />
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] sm:text-sm" aria-label="Đến ngày" />
          <select value={machineId} onChange={(event) => setMachineId(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm" aria-label="Lọc theo máy">
            <option value="">Tất cả máy</option>
            {machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.code}</option>)}
          </select>
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm" aria-label="Lọc theo dự án">
            <option value="">Tất cả dự án</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}
          </select>
          <select value={personId} onChange={(event) => setPersonId(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm xl:col-start-5" aria-label="Lọc theo người phụ trách">
            <option value="">Tất cả người phụ trách</option>
            {personnel.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
          </select>
          {hasFilter && (
            <button type="button" onClick={() => { setQuery(""); setDateFrom(""); setDateTo(""); setMachineId(""); setProjectId(""); setPersonId(""); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm">
              Xóa bộ lọc
            </button>
          )}
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Ngày</th>
                <th className="px-3.5 py-3">Tên máy</th>
                <th className="px-3.5 py-3">Vị trí</th>
                <th className="px-3.5 py-3 text-right">Số giờ hoạt động</th>
                <th className="px-3.5 py-3">Dự án</th>
                <th className="px-3.5 py-3">Người phụ trách</th>
                <th className="px-3.5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{formatScheduleDate(row.date)}</td>
                  <td className="px-3.5 py-3">
                    <div className="font-mono font-bold text-[#0047AB]">{row.machineCode}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{row.machineName}</div>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{row.location}</td>
                  <td className="px-3.5 py-3 text-right font-mono font-bold tabular-nums text-slate-900">{formatOperatingHours(row.operatingHours)}</td>
                  <td className="px-3.5 py-3 text-slate-700">{row.projectName}</td>
                  <td className="px-3.5 py-3 font-medium text-slate-900">{row.personInChargeName}</td>
                  <td className="px-3.5 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setModal({ mode: "view", row })} className="rounded-lg px-2.5 py-1.5 font-semibold text-[#0047AB] hover:bg-blue-50">Xem</button>
                      <button type="button" onClick={() => setModal({ mode: "edit", row })} className="rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100">Sửa</button>
                      <button type="button" disabled={saving} onClick={() => void handleDelete(row)} className="rounded-lg px-2.5 py-1.5 font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Chưa có lịch chạy máy phù hợp.</td></tr>}
              {loading && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Đang tải lịch chạy máy…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <MachineAssignmentFormModal
        open={modal !== null}
        mode={modal?.mode ?? "add"}
        initial={modal && modal.mode !== "add" ? modal.row : null}
        machines={machines}
        projects={projects}
        personnel={personnel}
        saving={saving}
        onClose={() => setModal(null)}
        onSubmit={(values) => void handleSave(values)}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 px-4 py-3 text-xs sm:text-sm font-medium text-white shadow-xl border border-white/10 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Check size={16} weight="bold" aria-hidden className="text-emerald-500" />
          {toast}
        </div>
      )}
    </main>
  );
}
