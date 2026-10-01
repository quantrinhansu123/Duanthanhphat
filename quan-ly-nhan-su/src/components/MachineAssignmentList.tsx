"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, X } from "@/components/icons";
import {
  formatScheduleDate,
  type LookupOption,
  type MachineOption,
  type MachineRunSchedule,
} from "@/data/machineAssignments";
import { loadMachineRunScheduleBundle } from "@/lib/machineRunSchedulesDb";
import {
  deleteDailyFuel,
  formatFuelDate,
  loadDailyFuelRows,
  OIL_LEVEL_UNITS,
  upsertDailyFuel,
  type DailyFuelFormValues,
  type DailyFuelRow,
} from "@/lib/dailyFuelDb";
import { notifyCommanderOilLow } from "@/lib/notificationsDb";

const WELD_METHOD_OPTIONS = ["FBW", "ATW"] as const;
const WELD_TYPE_OPTIONS = ["Sản xuất", "Thử nghiệm", "Đào tạo"] as const;

function isLiterUnit(unit: string) {
  const value = unit.trim().toLowerCase();
  return value === "lít" || value === "lit" || value === "l";
}

function fuelKey(date: string, machineId: string) {
  return `${date}|${machineId}`;
}

function emptyOilForm(date: string, machineId: string, personId = ""): DailyFuelFormValues {
  return {
    date,
    machineId,
    liters: 0,
    unit: "lít",
    personId,
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
  const [fuelSaving, setFuelSaving] = useState(false);
  const [fuelModal, setFuelModal] = useState<"add" | "edit" | null>(null);
  const [fuelEditId, setFuelEditId] = useState<string | null>(null);
  const [fuelForm, setFuelForm] = useState<DailyFuelFormValues>(emptyOilForm("", ""));
  const [fuelFormError, setFuelFormError] = useState("");
  const [toast, setToast] = useState("");

  const reloadFuel = useCallback(async () => {
    const result = await loadDailyFuelRows();
    setFuelRows(result.rows);
    setFuelError(result.error ?? "");
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

  const fuelByScheduleKey = useMemo(() => {
    const map = new Map<string, DailyFuelRow>();
    for (const row of fuelRows) {
      map.set(fuelKey(row.date, row.machineId), row);
    }
    return map;
  }, [fuelRows]);

  const totalWelds = filtered.reduce((sum, row) => sum + (row.weldCount ?? 0), 0);
  const totalFailed = filtered.reduce((sum, row) => sum + (row.failedWeldCount ?? 0), 0);
  const machineCount = new Set(filtered.map((row) => row.machineId)).size;
  const oilReportCount = useMemo(() => {
    const keys = new Set(filtered.map((row) => fuelKey(row.date, row.machineId)));
    let count = 0;
    for (const key of keys) {
      if (fuelByScheduleKey.has(key)) count += 1;
    }
    return count;
  }, [filtered, fuelByScheduleKey]);
  const hasFilter = Boolean(
    dateFrom || dateTo || machineId || projectId || personId || weldMethod || weldType,
  );

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

  function openOilReport(schedule: MachineRunSchedule) {
    const existing = fuelByScheduleKey.get(fuelKey(schedule.date, schedule.machineId));
    if (existing) {
      setFuelForm({
        date: existing.date,
        machineId: existing.machineId,
        liters: existing.liters,
        unit: existing.unit || "lít",
        personId: existing.personId,
        note: existing.note,
      });
      setFuelEditId(existing.id);
      setFuelFormError("");
      setFuelModal("edit");
      return;
    }
    setFuelForm(emptyOilForm(schedule.date, schedule.machineId, schedule.personInChargeId || ""));
    setFuelEditId(null);
    setFuelFormError("");
    setFuelModal("add");
  }

  async function handleFuelSave() {
    if (!fuelForm.date) {
      setFuelFormError("Thiếu ngày báo cáo.");
      return;
    }
    if (!fuelForm.machineId) {
      setFuelFormError("Thiếu máy cần báo cáo.");
      return;
    }
    if (!Number.isFinite(fuelForm.liters) || fuelForm.liters < 0) {
      setFuelFormError("Mức dầu không hợp lệ.");
      return;
    }
    setFuelSaving(true);
    setFuelFormError("");
    try {
      await upsertDailyFuel(fuelForm, fuelEditId ?? undefined);
      setFuelModal(null);
      await reloadFuel();
      const machine = machines.find((item) => item.id === fuelForm.machineId);
      const quota = machine?.oilQuota ?? null;
      const belowQuota =
        quota != null && isLiterUnit(fuelForm.unit) && fuelForm.liters < quota;
      if (belowQuota && machine) {
        const message = `${machine.code} ngày ${formatFuelDate(fuelForm.date)}: mức dầu ${fuelForm.liters.toLocaleString("vi-VN")} ${fuelForm.unit} dưới định mức ${quota.toLocaleString("vi-VN")} lít.`;
        await notifyCommanderOilLow(message);
        showToast(`Cấp dầu — đã báo Chỉ huy trưởng · ${machine.code}`);
      } else {
        showToast(fuelEditId ? "Đã cập nhật báo cáo mức dầu" : "Đã ghi báo cáo mức dầu");
      }
    } catch (error) {
      setFuelFormError(error instanceof Error ? error.message : "Không lưu được báo cáo mức dầu");
    } finally {
      setFuelSaving(false);
    }
  }

  async function handleFuelDelete() {
    if (!fuelEditId) return;
    const machineLabel =
      machines.find((m) => m.id === fuelForm.machineId)?.code || fuelForm.machineId;
    if (
      !window.confirm(
        `Xóa báo cáo mức dầu ${machineLabel} ngày ${formatFuelDate(fuelForm.date)}?`,
      )
    ) {
      return;
    }
    setFuelSaving(true);
    try {
      await deleteDailyFuel(fuelEditId);
      setFuelModal(null);
      await reloadFuel();
      showToast("Đã xóa báo cáo mức dầu");
    } catch (error) {
      setFuelFormError(error instanceof Error ? error.message : "Không xóa được báo cáo mức dầu");
    } finally {
      setFuelSaving(false);
    }
  }

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <section className="mb-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <select
            value={projectId}
            onChange={(event) => {
              const next = event.target.value;
              setProjectId(next);
              syncProjectToUrl(next);
            }}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
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
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
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
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
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
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
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
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
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
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
            aria-label="Từ ngày"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs outline-hidden focus:border-[#0047AB] sm:text-sm"
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
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </section>

      <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs text-slate-600">
        <span className="font-semibold text-[#0047AB]">Lịch chạy máy</span>
        {" · lấy từ "}
        <Link href="/nhat-ky-han" className="font-semibold text-[#0047AB] hover:underline">
          Nhật ký hàn
        </Link>
        {" · báo cáo mức dầu ghi trên từng dòng."}
      </div>

      {loadError && (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          Không tải được nhật ký hàn: {loadError}
        </div>
      )}

      {fuelError && (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          Không tải được báo cáo mức dầu: {fuelError}
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lượt chạy</div>
          <div className="font-mono text-lg font-bold tabular-nums leading-tight text-slate-900">{filtered.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tổng mối hàn</div>
          <div className="font-mono text-lg font-bold tabular-nums leading-tight text-[#0047AB]">
            {totalWelds.toLocaleString("vi-VN")}
            <span className="ml-1.5 text-[11px] font-semibold text-rose-600">
              Lỗi {totalFailed.toLocaleString("vi-VN")}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Số máy</div>
          <div className="font-mono text-lg font-bold tabular-nums leading-tight text-emerald-700">{machineCount}</div>
        </div>
        <div className="rounded-lg border border-emerald-200/80 bg-white px-3 py-2 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Báo cáo mức dầu</div>
          <div className="font-mono text-lg font-bold tabular-nums leading-tight text-emerald-700">
            {oilReportCount.toLocaleString("vi-VN")}
          </div>
        </div>
      </div>

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
          <table className="w-full min-w-[1200px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Ngày</th>
                <th className="px-3.5 py-3">Máy</th>
                <th className="px-3.5 py-3">PP hàn</th>
                <th className="px-3.5 py-3">Loại mối</th>
                <th className="px-3.5 py-3">Ca</th>
                <th className="px-3.5 py-3 text-right">Mối hàn</th>
                <th className="px-3.5 py-3 text-right">Lỗi</th>
                <th className="px-3.5 py-3">Dự án</th>
                <th className="px-3.5 py-3">Thợ hàn</th>
                <th className="px-3.5 py-3">Mức dầu</th>
                <th className="px-3.5 py-3 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const oil = fuelByScheduleKey.get(fuelKey(row.date, row.machineId));
                const quota = machines.find((item) => item.id === row.machineId)?.oilQuota ?? null;
                const oilLow =
                  oil != null &&
                  quota != null &&
                  isLiterUnit(oil.unit || "lít") &&
                  oil.liters < quota;
                return (
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
                  <td className="px-3.5 py-3">
                    {oil ? (
                      <div className="space-y-1">
                        <div className={`font-mono text-sm font-bold tabular-nums ${oilLow ? "text-rose-600" : "text-emerald-700"}`}>
                          {oil.liters.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}{" "}
                          {oil.unit || "lít"}
                        </div>
                        {oilLow && (
                          <div className="text-xs font-bold text-rose-600">Cấp dầu</div>
                        )}
                        <button
                          type="button"
                          onClick={() => openOilReport(row)}
                          className="text-xs font-semibold text-[#0047AB] hover:underline"
                        >
                          Sửa báo cáo
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openOilReport(row)}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        Báo cáo mức dầu
                      </button>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-right">
                    <Link
                      href={`/nhat-ky-han?query=${encodeURIComponent(row.machineCode)}&from=${encodeURIComponent(row.date)}&to=${encodeURIComponent(row.date)}`}
                      className="rounded-lg px-2.5 py-1.5 font-semibold text-[#0047AB] hover:bg-blue-50"
                    >
                      Nhật ký hàn
                    </Link>
                  </td>
                </tr>
                );
              })}
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
                  {fuelModal === "add" ? "Báo cáo mức dầu" : "Sửa báo cáo mức dầu"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Mức dầu tại thời điểm báo cáo · một máy / một ngày
                </p>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-700">Ngày</div>
                  <div className="mt-1.5 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-800">
                    {formatFuelDate(fuelForm.date)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-700">Máy</div>
                  <div className="mt-1.5 flex h-10 items-center truncate rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-[#0047AB]">
                    {machines.find((m) => m.id === fuelForm.machineId)?.code || "—"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Mức dầu tại thời điểm báo cáo *
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
                  Đơn vị
                  <select
                    value={fuelForm.unit}
                    onChange={(e) => setFuelForm((f) => ({ ...f, unit: e.target.value }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-hidden focus:border-[#0047AB]"
                  >
                    {OIL_LEVEL_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                    {fuelForm.unit &&
                      !(OIL_LEVEL_UNITS as readonly string[]).includes(fuelForm.unit) && (
                        <option value={fuelForm.unit}>{fuelForm.unit}</option>
                      )}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-700">
                Người báo cáo
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
                  placeholder="VD: Mức dầu đầu ca, sau khi kiểm tra…"
                />
              </label>
              {fuelFormError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {fuelFormError}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              {fuelModal === "edit" ? (
                <button
                  type="button"
                  disabled={fuelSaving}
                  onClick={() => void handleFuelDelete()}
                  className="h-10 rounded-lg px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  Xóa
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
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
