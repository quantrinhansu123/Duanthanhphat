"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, X } from "@/components/icons";
import {
  formatOperatingHours,
  formatScheduleDate,
  type LookupOption,
  type MachineOption,
  type MachineRunSchedule,
} from "@/data/machineAssignments";
import { HOURS_PER_WELD_SHIFT, loadMachineRunScheduleBundle } from "@/lib/machineRunSchedulesDb";
import {
  deleteDailyFuel,
  formatFuelDate,
  loadDailyFuelRows,
  upsertDailyFuel,
  type DailyFuelFormValues,
  type DailyFuelRow,
} from "@/lib/dailyFuelDb";

const WELD_METHOD_OPTIONS = ["FBW", "ATW"] as const;
const WELD_TYPE_OPTIONS = ["Sản xuất", "Thử nghiệm", "Đào tạo"] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyFuelForm(machineId = ""): DailyFuelFormValues {
  return {
    date: todayIso(),
    machineId,
    liters: 0,
    pumpOpened: false,
    personId: "",
    note: "",
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
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [machineId, setMachineId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [personId, setPersonId] = useState("");
  const [weldMethod, setWeldMethod] = useState("");
  const [weldType, setWeldType] = useState("");

  const [fuelRows, setFuelRows] = useState<DailyFuelRow[]>([]);
  const [fuelError, setFuelError] = useState("");
  const [fuelLoading, setFuelLoading] = useState(true);
  const [fuelSaving, setFuelSaving] = useState(false);
  const [fuelDateFrom, setFuelDateFrom] = useState("");
  const [fuelDateTo, setFuelDateTo] = useState("");
  const [fuelMachineId, setFuelMachineId] = useState("");
  const [fuelModal, setFuelModal] = useState<"add" | "edit" | null>(null);
  const [fuelEditId, setFuelEditId] = useState<string | null>(null);
  const [fuelForm, setFuelForm] = useState<DailyFuelFormValues>(emptyFuelForm);
  const [fuelFormError, setFuelFormError] = useState("");
  const [toast, setToast] = useState("");

  const reloadFuel = useCallback(async () => {
    setFuelLoading(true);
    const result = await loadDailyFuelRows();
    setFuelRows(result.rows);
    setFuelError(result.error ?? "");
    setFuelLoading(false);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const bundle = await loadMachineRunScheduleBundle();
    setList(bundle.schedules);
    setMachines(bundle.machines);
    setProjects(bundle.projects);
    setPersonnel(bundle.personnel);
    setLoadError(bundle.error ?? "");
    const fromUrl = readProjectFilterFromUrl(bundle.projects);
    if (fromUrl) setProjectId(fromUrl);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    void reloadFuel();
  }, [reload, reloadFuel]);

  const filtered = useMemo(() => {
    return list.filter((row) => {
      if (dateFrom && row.date < dateFrom) return false;
      if (dateTo && row.date > dateTo) return false;
      if (machineId && row.machineId !== machineId) return false;
      if (projectId && row.projectId !== projectId) return false;
      if (personId && row.personInChargeId !== personId) return false;
      if (weldMethod && (row.weldMethod || "") !== weldMethod) return false;
      if (weldType && (row.weldType || "") !== weldType) return false;
      return true;
    });
  }, [list, dateFrom, dateTo, machineId, projectId, personId, weldMethod, weldType]);

  const filteredFuel = useMemo(() => {
    return fuelRows.filter((row) => {
      if (fuelDateFrom && row.date < fuelDateFrom) return false;
      if (fuelDateTo && row.date > fuelDateTo) return false;
      if (fuelMachineId && row.machineId !== fuelMachineId) return false;
      return true;
    });
  }, [fuelRows, fuelDateFrom, fuelDateTo, fuelMachineId]);

  const machineHours = useMemo(() => {
    const totals = new Map<string, { label: string; hours: number; welds: number }>();
    for (const row of filtered) {
      const current = totals.get(row.machineId) ?? {
        label: `${row.machineCode} · ${row.machineName}`,
        hours: 0,
        welds: 0,
      };
      current.hours += row.operatingHours;
      current.welds += row.weldCount ?? 0;
      totals.set(row.machineId, current);
    }
    return Array.from(totals.values()).sort((a, b) => b.hours - a.hours);
  }, [filtered]);

  const fuelByMachine = useMemo(() => {
    const totals = new Map<string, { label: string; liters: number; pumpOpens: number; runs: number }>();
    for (const row of filteredFuel) {
      const current = totals.get(row.machineId) ?? {
        label: `${row.machineCode} · ${row.machineName}`,
        liters: 0,
        pumpOpens: 0,
        runs: 0,
      };
      current.liters += row.liters;
      current.runs += 1;
      if (row.pumpOpened) current.pumpOpens += 1;
      totals.set(row.machineId, current);
    }
    return Array.from(totals.values()).sort((a, b) => b.liters - a.liters);
  }, [filteredFuel]);

  const totalHours = filtered.reduce((sum, row) => sum + row.operatingHours, 0);
  const totalWelds = filtered.reduce((sum, row) => sum + (row.weldCount ?? 0), 0);
  const totalFailed = filtered.reduce((sum, row) => sum + (row.failedWeldCount ?? 0), 0);
  const machineCount = new Set(filtered.map((row) => row.machineId)).size;
  const totalFuelLiters = filteredFuel.reduce((sum, row) => sum + row.liters, 0);
  const hasFilter = Boolean(
    dateFrom || dateTo || machineId || projectId || personId || weldMethod || weldType,
  );
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

  function openFuelAdd() {
    setFuelForm(emptyFuelForm(machines[0]?.id ?? ""));
    setFuelEditId(null);
    setFuelFormError("");
    setFuelModal("add");
  }

  function openFuelEdit(row: DailyFuelRow) {
    setFuelForm({
      date: row.date,
      machineId: row.machineId,
      liters: row.liters,
      pumpOpened: row.pumpOpened,
      personId: row.personId,
      note: row.note,
    });
    setFuelEditId(row.id);
    setFuelFormError("");
    setFuelModal("edit");
  }

  async function handleFuelSave() {
    if (!fuelForm.date) {
      setFuelFormError("Chọn ngày cấp dầu.");
      return;
    }
    if (!fuelForm.machineId) {
      setFuelFormError("Chọn máy nhận dầu.");
      return;
    }
    if (!Number.isFinite(fuelForm.liters) || fuelForm.liters < 0) {
      setFuelFormError("Số lít dầu không hợp lệ.");
      return;
    }
    setFuelSaving(true);
    setFuelFormError("");
    try {
      await upsertDailyFuel(fuelForm, fuelEditId ?? undefined);
      setFuelModal(null);
      await reloadFuel();
      showToast(fuelEditId ? "Đã cập nhật cấp dầu" : "Đã ghi cấp dầu hàng ngày");
    } catch (error) {
      setFuelFormError(error instanceof Error ? error.message : "Không lưu được cấp dầu");
    } finally {
      setFuelSaving(false);
    }
  }

  async function handleFuelDelete(row: DailyFuelRow) {
    if (!window.confirm(`Xóa cấp dầu ${row.machineCode} ngày ${formatFuelDate(row.date)}?`)) return;
    setFuelSaving(true);
    try {
      await deleteDailyFuel(row.id);
      await reloadFuel();
      showToast("Đã xóa bản ghi cấp dầu");
    } catch (error) {
      setFuelError(error instanceof Error ? error.message : "Không xóa được cấp dầu");
    } finally {
      setFuelSaving(false);
    }
  }

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs text-slate-700 sm:text-sm">
        <div className="font-semibold text-[#0047AB]">Lịch chạy máy = tổng hợp nhật ký hàn + cấp dầu hàng ngày</div>
        <div className="mt-0.5">
          Phần chạy máy lấy từ{" "}
          <Link href="/nhat-ky-han" className="font-semibold text-[#0047AB] hover:underline">
            Nhật ký hàn
          </Link>
          {" "}(chỉ đọc). Cấp dầu ghi riêng bên dưới.
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 sm:text-sm">
          <div className="font-semibold">Không tải được nhật ký hàn</div>
          <div className="mt-0.5">{loadError}</div>
        </div>
      )}

      <div className="mb-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Lượt chạy</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">{filtered.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng mối hàn</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#0047AB]">
            {totalWelds.toLocaleString("vi-VN")}
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            Lỗi: <span className="font-mono font-semibold text-rose-600">{totalFailed.toLocaleString("vi-VN")}</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Giờ máy (ước tính)</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">
            {totalHours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Số máy</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-emerald-700">{machineCount}</div>
        </div>
        <div className="rounded-xl border border-emerald-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng dầu đã cấp</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-emerald-700">
            {totalFuelLiters.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
          </div>
          <div className="mt-1.5 text-xs text-slate-400">Lít</div>
        </div>
      </div>

      <section className="mb-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-slate-900">Số giờ / mối theo máy</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Tự động cộng từ nhật ký hàn{selectedProject ? ` · dự án ${selectedProject.label}` : ""}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {machineHours.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5"
            >
              <span className="min-w-0 truncate text-xs font-semibold text-slate-700 sm:text-sm" title={item.label}>
                {item.label}
              </span>
              <div className="shrink-0 text-right">
                <div className="font-mono text-xs font-bold tabular-nums text-[#0047AB] sm:text-sm">
                  {formatOperatingHours(item.hours)}
                </div>
                <div className="font-mono text-[11px] tabular-nums text-slate-500">
                  {item.welds.toLocaleString("vi-VN")} mối
                </div>
              </div>
            </div>
          ))}
          {!loading && machineHours.length === 0 && (
            <div className="text-sm text-slate-500">Chưa có dữ liệu từ nhật ký hàn.</div>
          )}
        </div>
      </section>

      <section className="mb-4 rounded-xl border border-emerald-200/80 bg-white p-4 shadow-xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Cấp dầu hàng ngày</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Ghi số lít dầu cấp theo máy / ngày
            </p>
          </div>
          <button
            type="button"
            onClick={openFuelAdd}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] px-4 text-xs font-semibold text-white shadow-xs hover:bg-[#00388A] sm:text-sm"
          >
            <Plus size={14} weight="bold" aria-hidden /> Thêm cấp dầu
          </button>
        </div>

        {fuelError && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {fuelError}
          </div>
        )}

        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="date"
            value={fuelDateFrom}
            onChange={(e) => setFuelDateFrom(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Cấp dầu từ ngày"
          />
          <input
            type="date"
            value={fuelDateTo}
            onChange={(e) => setFuelDateTo(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Cấp dầu đến ngày"
          />
          <select
            value={fuelMachineId}
            onChange={(e) => setFuelMachineId(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Lọc máy cấp dầu"
          >
            <option value="">Tất cả máy</option>
            {machines.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.code}
              </option>
            ))}
          </select>
          {(fuelDateFrom || fuelDateTo || fuelMachineId) && (
            <button
              type="button"
              onClick={() => {
                setFuelDateFrom("");
                setFuelDateTo("");
                setFuelMachineId("");
              }}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
            >
              Xóa lọc dầu
            </button>
          )}
        </div>

        {fuelByMachine.length > 0 && (
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {fuelByMachine.map((item) => (
              <div key={item.label} className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3.5 py-2.5">
                <div className="truncate text-xs font-semibold text-slate-700 sm:text-sm" title={item.label}>
                  {item.label}
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-sm font-bold tabular-nums text-emerald-700">
                    {item.liters.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} lít
                  </span>
                  <span className="text-xs text-slate-500">
                    {item.runs} lần · bơm {item.pumpOpens}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[780px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-3.5 py-2.5">Ngày</th>
                <th className="px-3.5 py-2.5">Máy</th>
                <th className="px-3.5 py-2.5 text-right">Số lít</th>
                <th className="px-3.5 py-2.5">Bơm</th>
                <th className="px-3.5 py-2.5">Người cấp</th>
                <th className="px-3.5 py-2.5">Ghi chú</th>
                <th className="px-3.5 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFuel.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-900">
                    {formatFuelDate(row.date)}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="font-mono font-bold text-[#0047AB]">{row.machineCode}</div>
                    <div className="text-xs text-slate-500">{row.machineName}</div>
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-700">
                    {row.liters.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-700">
                    {row.pumpOpened ? "Đã mở" : "Không mở"}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-800">{row.personName}</td>
                  <td className="max-w-[220px] px-3.5 py-2.5 text-xs text-slate-600">
                    <div className="line-clamp-2" title={row.note}>{row.note || "—"}</div>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openFuelEdit(row)}
                        className="rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        disabled={fuelSaving}
                        onClick={() => void handleFuelDelete(row)}
                        className="rounded-lg px-2.5 py-1.5 font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!fuelLoading && filteredFuel.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    Chưa có bản ghi cấp dầu. Bấm <strong>Thêm cấp dầu</strong> để ghi nhận.
                  </td>
                </tr>
              )}
              {fuelLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    Đang tải cấp dầu…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-slate-900">Lịch chạy máy (tổng hợp từ nhật ký hàn)</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Lọc theo dự án, phương pháp hàn, loại mối hàn, máy, thợ và khoảng ngày
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.label}
              </option>
            ))}
          </select>
          <select
            value={weldMethod}
            onChange={(event) => setWeldMethod(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Lọc theo phương pháp hàn"
          >
            <option value="">Tất cả phương pháp hàn</option>
            {WELD_METHOD_OPTIONS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
          <select
            value={weldType}
            onChange={(event) => setWeldType(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Lọc theo loại mối hàn"
          >
            <option value="">Tất cả loại mối hàn</option>
            {WELD_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={machineId}
            onChange={(event) => setMachineId(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Lọc theo máy"
          >
            <option value="">Tất cả máy</option>
            {machines.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.code}
              </option>
            ))}
          </select>
          <select
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Lọc theo thợ hàn"
          >
            <option value="">Tất cả thợ hàn</option>
            {personnel.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Từ ngày"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Đến ngày"
          />
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setMachineId("");
                setProjectId("");
                setPersonId("");
                setWeldMethod("");
                setWeldType("");
                syncProjectToUrl("");
              }}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Ngày</th>
                <th className="px-3.5 py-3">Máy</th>
                <th className="px-3.5 py-3">PP hàn</th>
                <th className="px-3.5 py-3">Loại mối</th>
                <th className="px-3.5 py-3">Ca</th>
                <th className="px-3.5 py-3 text-right">Giờ (ước tính)</th>
                <th className="px-3.5 py-3 text-right">Mối hàn</th>
                <th className="px-3.5 py-3 text-right">Lỗi</th>
                <th className="px-3.5 py-3">Dự án</th>
                <th className="px-3.5 py-3">Thợ hàn</th>
                <th className="px-3.5 py-3 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                    {formatScheduleDate(row.date)}
                  </td>
                  <td className="px-3.5 py-3">
                    <div className="font-mono font-bold text-[#0047AB]">{row.machineCode}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{row.machineName}</div>
                  </td>
                  <td className="px-3.5 py-3 font-mono font-semibold text-slate-800">
                    {row.weldMethod || "—"}
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{row.weldType || "—"}</td>
                  <td className="px-3.5 py-3 text-xs font-semibold text-slate-700">
                    {(row.shifts ?? []).join(", ") || "—"}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-bold tabular-nums text-slate-900">
                    {formatOperatingHours(row.operatingHours)}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-bold tabular-nums text-[#0047AB]">
                    {(row.weldCount ?? 0).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-bold tabular-nums text-rose-600">
                    {(row.failedWeldCount ?? 0).toLocaleString("vi-VN")}
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
                        title="Lọc theo dự án này"
                      >
                        {row.projectName}
                      </Link>
                    ) : (
                      <span className="text-slate-700">{row.projectName}</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 font-medium text-slate-900">{row.personInChargeName}</td>
                  <td className="px-3.5 py-3 text-right">
                    <Link
                      href={`/nhat-ky-han?q=${encodeURIComponent(row.machineCode)}`}
                      className="rounded-lg px-2.5 py-1.5 font-semibold text-[#0047AB] hover:bg-blue-50"
                    >
                      Nhật ký hàn
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-500">
                    Chưa có dữ liệu tổng hợp từ nhật ký hàn phù hợp bộ lọc.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-500">
                    Đang tổng hợp từ nhật ký hàn…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {fuelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4">
          <button
            type="button"
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            aria-label="Đóng"
            onClick={() => !fuelSaving && setFuelModal(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {fuelModal === "add" ? "Thêm cấp dầu hàng ngày" : "Sửa cấp dầu"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">Một máy · một ngày (ghi đè nếu trùng)</p>
              </div>
              <button
                type="button"
                disabled={fuelSaving}
                onClick={() => setFuelModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <label className="block text-xs font-semibold text-slate-700">
                Ngày *
                <input
                  type="date"
                  value={fuelForm.date}
                  onChange={(e) => setFuelForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm outline-hidden focus:border-[#0047AB]"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Máy *
                <select
                  value={fuelForm.machineId}
                  onChange={(e) => setFuelForm((f) => ({ ...f, machineId: e.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-hidden focus:border-[#0047AB]"
                >
                  <option value="">Chọn máy</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} — {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Số lít dầu *
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={fuelForm.liters}
                    onChange={(e) => setFuelForm((f) => ({ ...f, liters: Number(e.target.value) }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm outline-hidden focus:border-[#0047AB]"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Trạng thái bơm
                  <select
                    value={fuelForm.pumpOpened ? "open" : "closed"}
                    onChange={(e) => setFuelForm((f) => ({ ...f, pumpOpened: e.target.value === "open" }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-hidden focus:border-[#0047AB]"
                  >
                    <option value="closed">Không mở bơm</option>
                    <option value="open">Đã mở bơm</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-700">
                Người cấp
                <select
                  value={fuelForm.personId}
                  onChange={(e) => setFuelForm((f) => ({ ...f, personId: e.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-hidden focus:border-[#0047AB]"
                >
                  <option value="">— Không chọn —</option>
                  {personnel.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Ghi chú
                <textarea
                  rows={2}
                  value={fuelForm.note}
                  onChange={(e) => setFuelForm((f) => ({ ...f, note: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-hidden focus:border-[#0047AB]"
                  placeholder="VD: Đổ đầy thùng phụ, kiểm tra rò…"
                />
              </label>
              {fuelFormError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {fuelFormError}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={fuelSaving}
                onClick={() => setFuelModal(null)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={fuelSaving}
                onClick={() => void handleFuelSave()}
                className="h-10 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A] disabled:opacity-50"
              >
                {fuelSaving ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl sm:text-sm">
          <Check size={16} weight="bold" aria-hidden className="text-emerald-500" />
          {toast}
        </div>
      )}
    </main>
  );
}
