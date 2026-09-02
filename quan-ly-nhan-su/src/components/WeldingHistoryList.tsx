"use client";

import { useEffect, useMemo, useState } from "react";
import { CaretDown, DotsThree, MagnifyingGlass, X } from "@/components/icons";
import {
  formatWeldingDate,
  weldingHistory as seedHistory,
  type WeldingHistoryRecord,
} from "@/data/weldingHistory";

const resultStyle: Record<WeldingHistoryRecord["result"], string> = {
  Đạt: "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Không đạt": "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  "Sửa chữa": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

const resultOptions: WeldingHistoryRecord["result"][] = ["Đạt", "Không đạt", "Sửa chữa"];
const shiftOptions: WeldingHistoryRecord["shift"][] = ["Ca 1", "Ca 2", "Ca 3"];

function emptyRecord(): WeldingHistoryRecord {
  return {
    id: "",
    date: new Date().toISOString().slice(0, 10),
    weldingId: "",
    welderName: "",
    rank: "Hạng 1",
    weldJoint: "",
    machine: "",
    railType: "UIC60",
    project: "",
    shift: "Ca 1",
    result: "Đạt",
  };
}

function HistoryModal({
  record,
  mode,
  onClose,
  onSave,
}: {
  record: WeldingHistoryRecord;
  mode: "view" | "edit" | "create";
  onClose: () => void;
  onSave?: (updated: WeldingHistoryRecord) => void;
}) {
  const [form, setForm] = useState(record);
  const readOnly = mode === "view";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setForm(record);
  }, [record]);

  const title =
    mode === "view" ? "Chi tiết lịch sử hàn" : mode === "edit" ? "Sửa lịch sử hàn" : "Thêm lịch sử hàn";

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
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">{title}</div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">
              {mode === "create" ? "Bản ghi mới" : form.weldJoint || form.weldingId}
            </h2>
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

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Ngày
              <input
                readOnly={readOnly}
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Welding ID
              <input
                readOnly={readOnly}
                value={form.weldingId}
                onChange={(e) => setForm({ ...form, weldingId: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Thợ hàn
              <input
                readOnly={readOnly}
                value={form.welderName}
                onChange={(e) => setForm({ ...form, welderName: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Hạng
              <input
                readOnly={readOnly}
                value={form.rank}
                onChange={(e) => setForm({ ...form, rank: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
              />
            </label>
          </div>
          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Mối hàn
            <input
              readOnly={readOnly}
              value={form.weldJoint}
              onChange={(e) => setForm({ ...form, weldJoint: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Máy
              <input
                readOnly={readOnly}
                value={form.machine}
                onChange={(e) => setForm({ ...form, machine: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
              />
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Loại ray
              <input
                readOnly={readOnly}
                value={form.railType}
                onChange={(e) => setForm({ ...form, railType: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
              />
            </label>
          </div>
          <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
            Dự án
            <input
              readOnly={readOnly}
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden read-only:bg-slate-50 focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Ca
              {readOnly ? (
                <div className="mt-2 text-xs sm:text-sm font-medium text-slate-900">{form.shift}</div>
              ) : (
                <select
                  value={form.shift}
                  onChange={(e) => setForm({ ...form, shift: e.target.value as WeldingHistoryRecord["shift"] })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
                >
                  {shiftOptions.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              )}
            </label>
            <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
              Kết quả
              {readOnly ? (
                <div className="mt-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${resultStyle[form.result]}`}>
                    {form.result}
                  </span>
                </div>
              ) : (
                <select
                  value={form.result}
                  onChange={(e) => setForm({ ...form, result: e.target.value as WeldingHistoryRecord["result"] })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
                >
                  {resultOptions.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              )}
            </label>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            {readOnly ? "Đóng" : "Hủy"}
          </button>
          {!readOnly && onSave && (
            <button
              type="button"
              onClick={() => onSave(form)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
            >
              {mode === "create" ? "Thêm mới" : "Lưu thay đổi"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function FilterGroup({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="min-w-[160px] flex-1 rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-2xs">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="flex max-h-[120px] flex-col gap-1.5 overflow-y-auto">
        {options.map((opt) => {
          const checked = selected.includes(opt);
          return (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5 text-xs sm:text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(toggleValue(selected, opt))}
                className="h-3.5 w-3.5 accent-[#0047AB] cursor-pointer"
              />
              <span className={checked ? "font-medium text-slate-900" : ""}>{opt}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function WeldingHistoryList() {
  const [list, setList] = useState(seedHistory);
  const [query, setQuery] = useState("");
  const [welder, setWelder] = useState("Tất cả thợ hàn");
  const [result, setResult] = useState("Tất cả kết quả");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [machinesSel, setMachinesSel] = useState<string[]>([]);
  const [railsSel, setRailsSel] = useState<string[]>([]);
  const [projectsSel, setProjectsSel] = useState<string[]>([]);
  const [shiftsSel, setShiftsSel] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    record: WeldingHistoryRecord;
    mode: "view" | "edit" | "create";
  } | null>(null);

  const welderOptions = useMemo(
    () => ["Tất cả thợ hàn", ...Array.from(new Set(list.map((r) => r.welderName))).sort()],
    [list],
  );
  const machineOptions = useMemo(
    () => Array.from(new Set(list.map((r) => r.machine))).sort(),
    [list],
  );
  const railOptions = useMemo(
    () => Array.from(new Set(list.map((r) => r.railType))).sort(),
    [list],
  );
  const projectOptions = useMemo(
    () => Array.from(new Set(list.map((r) => r.project))).sort(),
    [list],
  );
  const shiftOptionsFilter = useMemo(
    () => Array.from(new Set(list.map((r) => r.shift))).sort(),
    [list],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((row) => {
        const matchQ =
          !q ||
          row.weldingId.toLowerCase().includes(q) ||
          row.welderName.toLowerCase().includes(q) ||
          row.weldJoint.toLowerCase().includes(q) ||
          row.machine.toLowerCase().includes(q) ||
          row.project.toLowerCase().includes(q);
        const matchWelder = welder === "Tất cả thợ hàn" || row.welderName === welder;
        const matchResult = result === "Tất cả kết quả" || row.result === result;
        const matchFrom = !dateFrom || row.date >= dateFrom;
        const matchTo = !dateTo || row.date <= dateTo;
        const matchMachine = machinesSel.length === 0 || machinesSel.includes(row.machine);
        const matchRail = railsSel.length === 0 || railsSel.includes(row.railType);
        const matchProject = projectsSel.length === 0 || projectsSel.includes(row.project);
        const matchShift = shiftsSel.length === 0 || shiftsSel.includes(row.shift);
        return (
          matchQ &&
          matchWelder &&
          matchResult &&
          matchFrom &&
          matchTo &&
          matchMachine &&
          matchRail &&
          matchProject &&
          matchShift
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [list, query, welder, result, dateFrom, dateTo, machinesSel, railsSel, projectsSel, shiftsSel]);

  function handleDelete(record: WeldingHistoryRecord) {
    if (!window.confirm(`Xóa bản ghi "${record.weldJoint}"?`)) return;
    setList((prev) => prev.filter((r) => r.id !== record.id));
    setMenuOpen(null);
  }

  function handleSave(updated: WeldingHistoryRecord) {
    if (modal?.mode === "create") {
      const next: WeldingHistoryRecord = {
        ...updated,
        id: String(Date.now()),
      };
      setList((prev) => [next, ...prev]);
    } else {
      setList((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    }
    setModal(null);
  }

  const hasFilter =
    query.trim() ||
    dateFrom ||
    dateTo ||
    welder !== "Tất cả thợ hàn" ||
    result !== "Tất cả kết quả" ||
    machinesSel.length > 0 ||
    railsSel.length > 0 ||
    projectsSel.length > 0 ||
    shiftsSel.length > 0;
  const advancedFilterCount =
    machinesSel.length + railsSel.length + projectsSel.length + shiftsSel.length;

  const statPass = filtered.filter((r) => r.result === "Đạt").length;
  const statFail = filtered.filter((r) => r.result === "Không đạt").length;
  const statRework = filtered.filter((r) => r.result === "Sửa chữa").length;

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{list.length}</strong> mối hàn
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{statPass}</strong> đạt · <span className="font-semibold text-rose-700 font-mono tabular-nums">{statFail}</span> không đạt · <span className="font-semibold text-amber-700 font-mono tabular-nums">{statRework}</span> sửa chữa
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mối hàn, thợ hàn, máy, dự án..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Từ ngày
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1.5 block h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
          />
        </label>
        <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
          Đến ngày
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1.5 block h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150 font-mono"
          />
        </label>
        <select
          value={welder}
          onChange={(e) => setWelder(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          {welderOptions.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
        <select
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
        >
          {["Tất cả kết quả", "Đạt", "Không đạt", "Sửa chữa"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setDateFrom("");
              setDateTo("");
              setWelder("Tất cả thợ hàn");
              setResult("Tất cả kết quả");
              setMachinesSel([]);
              setRailsSel([]);
              setProjectsSel([]);
              setShiftsSel([]);
            }}
            className="mb-0.5 inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Xóa lọc
          </button>
        )}
        <button
          type="button"
          onClick={() => setModal({ record: emptyRecord(), mode: "create" })}
          className="mb-0.5 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
        >
          <span className="text-base leading-none">+</span> Thêm mới
        </button>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
          aria-expanded={filtersOpen}
        >
          <div className="flex items-center gap-2">
            <CaretDown
              size={16}
              weight="bold"
              aria-hidden
              className={`text-slate-500 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
            />
            <span className="text-xs sm:text-sm font-bold text-slate-900">Bộ lọc chi tiết</span>
            <span className="text-xs text-slate-500">Máy · Loại ray · Dự án · Ca</span>
            {advancedFilterCount > 0 && (
              <span className="inline-flex rounded-full bg-[#0047AB] px-2 py-0.5 text-[11px] font-bold text-white shadow-2xs font-mono tabular-nums">
                {advancedFilterCount} đang chọn
              </span>
            )}
          </div>
          <span className="text-xs sm:text-sm font-semibold text-[#0047AB]">
            {filtersOpen ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
          </span>
        </button>

        {filtersOpen && (
          <div className="border-t border-slate-200 p-3.5 bg-slate-50/70">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <FilterGroup title="Máy" options={machineOptions} selected={machinesSel} onChange={setMachinesSel} />
              <FilterGroup title="Loại ray" options={railOptions} selected={railsSel} onChange={setRailsSel} />
              <FilterGroup title="Dự án" options={projectOptions} selected={projectsSel} onChange={setProjectsSel} />
              <FilterGroup title="Ca" options={shiftOptionsFilter} selected={shiftsSel} onChange={setShiftsSel} />
            </div>
            {advancedFilterCount > 0 && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMachinesSel([]);
                    setRailsSel([]);
                    setProjectsSel([]);
                    setShiftsSel([]);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-[#0047AB] cursor-pointer transition-colors"
                >
                  Xóa lọc chi tiết
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Ngày</th>
                <th className="px-3.5 py-3">Welding ID</th>
                <th className="px-3.5 py-3">Thợ hàn</th>
                <th className="px-3.5 py-3">Hạng</th>
                <th className="px-3.5 py-3">Mối hàn</th>
                <th className="px-3.5 py-3">Máy</th>
                <th className="px-3.5 py-3">Loại ray</th>
                <th className="px-3.5 py-3">Dự án</th>
                <th className="px-3.5 py-3">Ca</th>
                <th className="px-3.5 py-3">Kết quả</th>
                <th className="w-12 px-2 py-3" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium font-mono text-slate-900">{formatWeldingDate(row.date)}</td>
                  <td className="px-3.5 py-3 font-mono text-xs text-slate-500">{row.weldingId}</td>
                  <td className="px-3.5 py-3 font-semibold text-slate-900">{row.welderName}</td>
                  <td className="px-3.5 py-3 text-slate-700">{row.rank}</td>
                  <td className="px-3.5 py-3">
                    <span className="font-mono text-xs font-bold text-[#0047AB] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shadow-2xs">{row.weldJoint}</span>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{row.machine}</td>
                  <td className="px-3.5 py-3 text-slate-700 font-mono text-xs sm:text-sm">{row.railType}</td>
                  <td className="max-w-[200px] px-3.5 py-3 text-slate-700">
                    <div className="line-clamp-2">{row.project}</div>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{row.shift}</td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${resultStyle[row.result]}`}
                    >
                      {row.result}
                    </span>
                  </td>
                  <td className="relative px-2 py-3">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === row.id ? null : row.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
                      aria-label="Tùy chọn"
                    >
                      <DotsThree size={16} weight="bold" aria-hidden />
                    </button>
                    {menuOpen === row.id && (
                      <div className="absolute right-2 top-10 z-30 w-36 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100">
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            setModal({ record: row, mode: "view" });
                            setMenuOpen(null);
                          }}
                        >
                          Xem
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            setModal({ record: row, mode: "edit" });
                            setMenuOpen(null);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                          onClick={() => handleDelete(row)}
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy lịch sử hàn</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <HistoryModal
          record={modal.record}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSave={modal.mode !== "view" ? handleSave : undefined}
        />
      )}
    </main>
  );
}
