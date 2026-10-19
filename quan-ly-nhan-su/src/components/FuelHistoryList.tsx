"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { compareNewestDate } from "@/lib/dateOrder";
import { formatFuelDate, loadDailyFuelRows, type DailyFuelRow } from "@/lib/dailyFuelDb";

const filterClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm";

function isLiterUnit(unit: string) {
  const value = unit.trim().toLowerCase();
  return value === "lít" || value === "lit" || value === "l";
}

function readMachineFilterFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("machineId")?.trim() || "";
}

export default function FuelHistoryList() {
  const [rows, setRows] = useState<DailyFuelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [machineId, setMachineId] = useState(readMachineFilterFromUrl);
  const [personId, setPersonId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadDailyFuelRows().then((result) => {
      if (cancelled) return;
      setRows(result.rows);
      setLoadError(result.error ?? "");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fromUrl = readMachineFilterFromUrl();
    if (fromUrl) setMachineId(fromUrl);
  }, []);

  const machineOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.machineId && !map.has(row.machineId)) map.set(row.machineId, row.machineCode);
    }
    return Array.from(map, ([id, code]) => ({ id, code })).sort((a, b) => a.code.localeCompare(b.code, "vi"));
  }, [rows]);

  const personOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.personId && !map.has(row.personId)) map.set(row.personId, row.personName);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (machineId && row.machineId !== machineId) return false;
        if (personId && row.personId !== personId) return false;
        if (dateFrom && row.date < dateFrom) return false;
        if (dateTo && row.date > dateTo) return false;
        return true;
      }).sort((a, b) => compareNewestDate(a.date, b.date) || b.id.localeCompare(a.id)),
    [rows, machineId, personId, dateFrom, dateTo],
  );

  const totals = useMemo(() => {
    let liters = 0;
    const machines = new Set<string>();
    for (const row of filtered) {
      if (isLiterUnit(row.unit)) liters += row.liters;
      machines.add(row.machineId);
    }
    return { liters, machines: machines.size };
  }, [filtered]);

  const hasFilter = Boolean(machineId || personId || dateFrom || dateTo);

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Lượt cấp</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {filtered.length.toLocaleString("vi-VN")}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tổng nhiên liệu</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0047AB]">
            {totals.liters.toLocaleString("vi-VN")}
            <span className="ml-1 text-sm font-semibold text-slate-400">lít</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Số máy</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700">
            {totals.machines.toLocaleString("vi-VN")}
          </div>
        </div>
      </div>

      <section className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-2.5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs sm:p-4">
        <label className="flex w-full flex-col gap-1 text-[11px] font-semibold leading-4 text-slate-500 sm:w-48">
          Máy
          <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className={filterClass}>
            <option value="">Tất cả máy</option>
            {machineOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.code}</option>
            ))}
          </select>
        </label>
        <label className="flex w-full flex-col gap-1 text-[11px] font-semibold leading-4 text-slate-500 sm:w-48">
          Người cấp
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} className={filterClass}>
            <option value="">Tất cả người cấp</option>
            {personOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="flex w-full flex-col gap-1 text-[11px] font-semibold leading-4 text-slate-500 sm:w-40">
          Từ ngày
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${filterClass} font-mono`} />
        </label>
        <label className="flex w-full flex-col gap-1 text-[11px] font-semibold leading-4 text-slate-500 sm:w-40">
          Đến ngày
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${filterClass} font-mono`} />
        </label>
        <div className="flex h-10 shrink-0 items-center gap-3">
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setMachineId("");
                setPersonId("");
                setDateFrom("");
                setDateTo("");
              }}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
            >
              Xóa lọc
            </button>
          )}
          <span className="whitespace-nowrap text-xs text-slate-500 sm:text-sm">
            <strong className="font-mono font-semibold tabular-nums text-slate-900">{filtered.length}</strong> bản ghi
          </span>
        </div>
      </section>

      <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs text-slate-600">
        Nhiên liệu được ghi theo từng dòng tại{" "}
        <Link href="/phan-cong-may" className="font-semibold text-[#0047AB] hover:underline">Lịch chạy máy</Link>.
      </div>

      {loadError && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Không tải được lịch sử cấp nhiên liệu: {loadError}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Ngày</th>
                <th className="px-3.5 py-3">Máy</th>
                <th className="px-3.5 py-3 text-right">Nhiên liệu</th>
                <th className="px-3.5 py-3">Người cấp</th>
                <th className="px-3.5 py-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-700">{formatFuelDate(row.date)}</td>
                  <td className="px-3.5 py-3">
                    <div className="font-mono font-semibold text-[#0047AB]">{row.machineCode}</div>
                    {row.machineName && row.machineName !== row.machineCode && <div className="mt-0.5 text-xs text-slate-500">{row.machineName}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                    {row.liters.toLocaleString("vi-VN")} <span className="font-sans font-medium text-slate-500">{row.unit}</span>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{row.personName}</td>
                  <td className="max-w-[320px] px-3.5 py-3 text-slate-600">
                    <div className="line-clamp-2">{row.note || "—"}</div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    Đang tải lịch sử cấp nhiên liệu...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                    Chưa có lượt cấp nhiên liệu phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
