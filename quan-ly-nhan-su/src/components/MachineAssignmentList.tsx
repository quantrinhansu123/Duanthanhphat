"use client";

import Link from "next/link";
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
    createdAt: new Date().toISOString(),
    fuelAddedLiters: values.fuelAddedLiters,
    pumpOpened: values.pumpOpened,
    machineCondition: values.machineCondition,
    conditionDescription: values.conditionDescription,
    recommendation: values.recommendation,
    imageAssets: values.imageAssets,
  };
}

function readProjectFilterFromUrl(projects: LookupOption[]) {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("projectId")?.trim() || params.get("duAn")?.trim() || "";
  if (projectId && projects.some((item) => item.id === projectId)) return projectId;
  const projectName = params.get("project")?.trim() || params.get("du_an")?.trim() || "";
  if (!projectName) return projectId;
  const matched = projects.find(
    (item) => item.label.localeCompare(projectName, "vi", { sensitivity: "accent" }) === 0,
  );
  return matched?.id ?? "";
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
    const fromUrl = readProjectFilterFromUrl(bundle.projects);
    if (fromUrl) setProjectId(fromUrl);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    return list.filter((row) => {
      if (dateFrom && row.date < dateFrom) return false;
      if (dateTo && row.date > dateTo) return false;
      if (machineId && row.machineId !== machineId) return false;
      if (projectId && row.projectId !== projectId) return false;
      if (personId && row.personInChargeId !== personId) return false;
      return true;
    });
  }, [list, dateFrom, dateTo, machineId, projectId, personId]);

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

  const oilReport = useMemo(() => {
    const byMachine = new Map<string, {
      label: string;
      liters: number;
      pumpOpens: number;
      runs: number;
    }>();
    let totalLiters = 0;
    let pumpOpenCount = 0;
    for (const row of filtered) {
      totalLiters += row.fuelAddedLiters;
      if (row.pumpOpened) pumpOpenCount += 1;
      const current = byMachine.get(row.machineId) ?? {
        label: `${row.machineCode} · ${row.machineName}`,
        liters: 0,
        pumpOpens: 0,
        runs: 0,
      };
      current.liters += row.fuelAddedLiters;
      current.runs += 1;
      if (row.pumpOpened) current.pumpOpens += 1;
      byMachine.set(row.machineId, current);
    }
    return {
      totalLiters,
      pumpOpenCount,
      byMachine: Array.from(byMachine.values()).sort((a, b) => b.liters - a.liters),
    };
  }, [filtered]);

  const totalHours = filtered.reduce((sum, row) => sum + row.operatingHours, 0);
  const issueCount = filtered.filter(
    (row) => row.machineCondition.trim().toLocaleLowerCase("vi") !== "bình thường",
  ).length;
  const hasFilter = Boolean(dateFrom || dateTo || machineId || projectId || personId);
  const selectedProject = projects.find((item) => item.id === projectId);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  function syncProjectToUrl(nextProjectId: string) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (nextProjectId) url.searchParams.set("projectId", nextProjectId);
    else url.searchParams.delete("projectId");
    url.searchParams.delete("duAn");
    url.searchParams.delete("project");
    url.searchParams.delete("du_an");
    window.history.replaceState({}, "", url.toString());
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
      throw error;
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
    <main className="w-full px-4 pb-8 sm:px-6">
      {loadError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 sm:text-sm">
          <div className="font-semibold">Đang hiển thị dữ liệu mẫu</div>
          <div className="mt-0.5">
            Hãy chạy file <span className="font-mono">supabase/migration_20260908_nhat_ky_van_hanh_may_chi_tiet.sql</span> để bật đầy đủ nhật ký vận hành. {loadError}
          </div>
        </div>
      )}

      <div className="mb-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Lượt chạy</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">{filtered.length}</div>
          <div className="mt-1.5 text-xs text-slate-400">Theo bộ lọc hiện tại</div>
        </div>
        <div className="rounded-xl border border-amber-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Cần chú ý</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-amber-700">{issueCount}</div>
          <div className="mt-1.5 text-xs text-slate-400">Lượt có tình trạng bất thường</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng giờ hoạt động</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#0047AB]">
            {totalHours.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1.5 text-xs text-slate-400">Giờ máy đã ghi nhận</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng dầu đã đổ</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-emerald-700">
            {oilReport.totalLiters.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
          </div>
          <div className="mt-1.5 text-xs text-slate-400">Lít · theo bộ lọc hiện tại</div>
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

      <section className="mb-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Báo cáo dầu</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Tổng dầu đổ và số lần mở bơm theo máy{selectedProject ? ` · dự án ${selectedProject.label}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
            <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
              Tổng đổ: {oilReport.totalLiters.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} lít
            </span>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-700">
              Mở bơm: {oilReport.pumpOpenCount}/{filtered.length} lượt
            </span>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {oilReport.byMachine.map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
              <div className="truncate text-xs font-semibold text-slate-700 sm:text-sm" title={item.label}>{item.label}</div>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-sm font-bold tabular-nums text-emerald-700">
                  {item.liters.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} lít
                </span>
                <span className="text-xs text-slate-500">
                  {item.runs} lượt · bơm {item.pumpOpens}
                </span>
              </div>
            </div>
          ))}
          {!loading && oilReport.byMachine.length === 0 && (
            <div className="text-sm text-slate-500">Chưa có dữ liệu dầu theo máy.</div>
          )}
        </div>
      </section>

      <section className="mb-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-slate-900">Nhật ký chạy máy</h2>
          <p className="mt-0.5 text-xs text-slate-500">Lọc theo dự án, máy, người phụ trách và khoảng ngày</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <select
            value={projectId}
            onChange={(event) => {
              const next = event.target.value;
              setProjectId(next);
              syncProjectToUrl(next);
            }}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Lọc theo dự án"
          >
            <option value="">Tất cả dự án</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] sm:text-sm" aria-label="Từ ngày" />
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] sm:text-sm" aria-label="Đến ngày" />
          <select value={machineId} onChange={(event) => setMachineId(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm" aria-label="Lọc theo máy">
            <option value="">Tất cả máy</option>
            {machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.code}</option>)}
          </select>
          <select value={personId} onChange={(event) => setPersonId(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm" aria-label="Lọc theo người phụ trách">
            <option value="">Tất cả người phụ trách</option>
            {personnel.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
          </select>
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setMachineId("");
                setProjectId("");
                setPersonId("");
                syncProjectToUrl("");
              }}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm xl:col-start-5"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1640px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Ngày</th>
                <th className="px-3.5 py-3">Tên máy</th>
                <th className="px-3.5 py-3">Vị trí</th>
                <th className="px-3.5 py-3 text-right">Số giờ hoạt động</th>
                <th className="px-3.5 py-3">Vận hành / Dầu</th>
                <th className="px-3.5 py-3">Tình trạng máy</th>
                <th className="px-3.5 py-3">Mô tả / Đề nghị</th>
                <th className="px-3.5 py-3 text-center">Ảnh</th>
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
                  <td className="px-3.5 py-3 font-mono text-xs text-slate-700">{row.location}</td>
                  <td className="px-3.5 py-3 text-right font-mono font-bold tabular-nums text-slate-900">{formatOperatingHours(row.operatingHours)}</td>
                  <td className="px-3.5 py-3 text-xs text-slate-700">
                    <div><span className="font-semibold">Đổ dầu:</span> {row.fuelAddedLiters.toLocaleString("vi-VN")} lít</div>
                    <div className="mt-1"><span className="font-semibold">Bơm:</span> {row.pumpOpened ? "Đã mở" : "Không mở"}</div>
                  </td>
                  <td className="px-3.5 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      row.machineCondition.trim().toLocaleLowerCase("vi") === "bình thường"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}>
                      {row.machineCondition}
                    </span>
                  </td>
                  <td className="max-w-[320px] px-3.5 py-3 text-xs text-slate-600">
                    <div className="line-clamp-2" title={row.conditionDescription}>{row.conditionDescription || "—"}</div>
                    {row.recommendation && <div className="mt-1 line-clamp-2 font-medium text-[#0047AB]" title={row.recommendation}>Đề nghị: {row.recommendation}</div>}
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    {row.imageAssets.length > 0 ? (
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 font-mono text-xs font-bold text-[#0047AB]">{row.imageAssets.length}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3.5 py-3">
                    {row.projectId ? (
                      <Link
                        href={`/phan-cong-may?projectId=${encodeURIComponent(row.projectId)}`}
                        onClick={() => {
                          setProjectId(row.projectId);
                          syncProjectToUrl(row.projectId);
                        }}
                        className="font-medium text-[#0047AB] hover:underline"
                        title="Lọc nhật ký chạy máy theo dự án này"
                      >
                        {row.projectName}
                      </Link>
                    ) : (
                      <span className="text-slate-700">{row.projectName}</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 font-medium text-slate-900">{row.personInChargeName}</td>
                  <td className="px-3.5 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setModal({ mode: "view", row })} className="rounded-lg px-2.5 py-1.5 font-semibold text-[#0047AB] hover:bg-blue-50">Nhật ký</button>
                      <button type="button" onClick={() => setModal({ mode: "edit", row })} className="rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100">Sửa</button>
                      <button type="button" disabled={saving} onClick={() => void handleDelete(row)} className="rounded-lg px-2.5 py-1.5 font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-500">Chưa có lịch chạy máy phù hợp.</td></tr>}
              {loading && <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-500">Đang tải lịch chạy máy…</td></tr>}
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
        onSubmit={handleSave}
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
