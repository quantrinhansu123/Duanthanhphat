"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatWeldingDate,
  weldingHistory as seedHistory,
  type WeldingHistoryRecord,
} from "@/data/weldingHistory";

const resultStyle: Record<WeldingHistoryRecord["result"], string> = {
  Đạt: "bg-[#0047AB] text-white",
  "Không đạt": "bg-[#ef4444] text-white",
  "Sửa chữa": "bg-[#f59e0b] text-white",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-[#0f172a]/45" aria-label="Đóng" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e8eef8] px-5 py-4">
          <div>
            <div className="text-[12px] font-semibold text-[#0047AB]">{title}</div>
            <h2 className="mt-0.5 text-[18px] font-bold text-[#0f172a]">
              {mode === "create" ? "Bản ghi mới" : form.weldJoint || form.weldingId}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
            aria-label="Đóng"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-medium text-[#64748b]">
              Ngày
              <input
                readOnly={readOnly}
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
              />
            </label>
            <label className="block text-[12px] font-medium text-[#64748b]">
              Welding ID
              <input
                readOnly={readOnly}
                value={form.weldingId}
                onChange={(e) => setForm({ ...form, weldingId: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-medium text-[#64748b]">
              Thợ hàn
              <input
                readOnly={readOnly}
                value={form.welderName}
                onChange={(e) => setForm({ ...form, welderName: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
              />
            </label>
            <label className="block text-[12px] font-medium text-[#64748b]">
              Hạng
              <input
                readOnly={readOnly}
                value={form.rank}
                onChange={(e) => setForm({ ...form, rank: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
              />
            </label>
          </div>
          <label className="block text-[12px] font-medium text-[#64748b]">
            Mối hàn
            <input
              readOnly={readOnly}
              value={form.weldJoint}
              onChange={(e) => setForm({ ...form, weldJoint: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-medium text-[#64748b]">
              Máy
              <input
                readOnly={readOnly}
                value={form.machine}
                onChange={(e) => setForm({ ...form, machine: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
              />
            </label>
            <label className="block text-[12px] font-medium text-[#64748b]">
              Loại ray
              <input
                readOnly={readOnly}
                value={form.railType}
                onChange={(e) => setForm({ ...form, railType: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
              />
            </label>
          </div>
          <label className="block text-[12px] font-medium text-[#64748b]">
            Dự án
            <input
              readOnly={readOnly}
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none read-only:bg-[#f8fafc] focus:border-[#0047AB]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-medium text-[#64748b]">
              Ca
              {readOnly ? (
                <div className="mt-2 text-[13px] text-[#0f172a]">{form.shift}</div>
              ) : (
                <select
                  value={form.shift}
                  onChange={(e) => setForm({ ...form, shift: e.target.value as WeldingHistoryRecord["shift"] })}
                  className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
                >
                  {shiftOptions.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              )}
            </label>
            <label className="block text-[12px] font-medium text-[#64748b]">
              Kết quả
              {readOnly ? (
                <div className="mt-2">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${resultStyle[form.result]}`}>
                    {form.result}
                  </span>
                </div>
              ) : (
                <select
                  value={form.result}
                  onChange={(e) => setForm({ ...form, result: e.target.value as WeldingHistoryRecord["result"] })}
                  className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
                >
                  {resultOptions.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              )}
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#e8eef8] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            {readOnly ? "Đóng" : "Hủy"}
          </button>
          {!readOnly && onSave && (
            <button
              type="button"
              onClick={() => onSave(form)}
              className="h-10 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
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
    <div className="min-w-[160px] flex-1 rounded-xl border border-[#e2e8f0] bg-white px-3.5 py-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">{title}</div>
      <div className="flex max-h-[120px] flex-col gap-1.5 overflow-y-auto">
        {options.map((opt) => {
          const checked = selected.includes(opt);
          return (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-[13px] text-[#334155] hover:bg-[#f8fafc]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(toggleValue(selected, opt))}
                className="h-3.5 w-3.5 accent-[#0047AB]"
              />
              <span className={checked ? "font-medium text-[#0f172a]" : ""}>{opt}</span>
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

  const welderCount = useMemo(() => new Set(filtered.map((r) => r.welderName)).size, [filtered]);
  const passed = filtered.filter((r) => r.result === "Đạt").length;

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

  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#475569]">
        <span>
          <strong className="text-[#0f172a]">{filtered.length}</strong> mối hàn
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#0f172a]">{welderCount}</strong> thợ phục vụ
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#0f172a]">{passed}</strong> đạt ·{" "}
          {filtered.length - passed} không đạt / sửa
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="relative min-w-[240px] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mối hàn, thợ hàn, máy, dự án..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>
        <label className="block text-[12px] font-semibold text-[#475569]">
          Từ ngày
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 block h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] outline-none focus:border-[#0047AB]"
          />
        </label>
        <label className="block text-[12px] font-semibold text-[#475569]">
          Đến ngày
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 block h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#0f172a] outline-none focus:border-[#0047AB]"
          />
        </label>
        <select
          value={welder}
          onChange={(e) => setWelder(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {welderOptions.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
        <select
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
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
            className="mb-0.5 inline-flex h-10 items-center rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] font-medium text-[#64748b] hover:bg-[#f8fafc]"
          >
            Xóa lọc
          </button>
        )}
        <button
          type="button"
          onClick={() => setModal({ record: emptyRecord(), mode: "create" })}
          className="mb-0.5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
        >
          + Thêm mới
        </button>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-[#d9e2f1] bg-white">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#f8fafc]"
          aria-expanded={filtersOpen}
        >
          <div className="flex items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className={`text-[#64748b] transition ${filtersOpen ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            <span className="text-[13px] font-semibold text-[#0f172a]">Bộ lọc chi tiết</span>
            <span className="text-[12px] text-[#64748b]">Máy · Loại ray · Dự án · Ca</span>
            {advancedFilterCount > 0 && (
              <span className="inline-flex rounded-full bg-[#0047AB] px-2 py-0.5 text-[10px] font-semibold text-white">
                {advancedFilterCount} đang chọn
              </span>
            )}
          </div>
          <span className="text-[12px] font-medium text-[#0047AB]">
            {filtersOpen ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
          </span>
        </button>

        {filtersOpen && (
          <div className="border-t border-[#e8eef8] px-3 pb-3 pt-3">
            <div className="flex flex-wrap gap-2">
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
                  className="text-[12px] font-medium text-[#64748b] hover:text-[#0047AB]"
                >
                  Xóa lọc chi tiết
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e8eef8] bg-[#f7f9fc] text-[12px] font-semibold uppercase tracking-[0.03em] text-[#64748b]">
                <th className="px-4 py-3">Ngày</th>
                <th className="px-3 py-3">Welding ID</th>
                <th className="px-3 py-3">Thợ hàn</th>
                <th className="px-3 py-3">Hạng</th>
                <th className="px-3 py-3">Mối hàn</th>
                <th className="px-3 py-3">Máy</th>
                <th className="px-3 py-3">Loại ray</th>
                <th className="px-3 py-3">Dự án</th>
                <th className="px-3 py-3">Ca</th>
                <th className="px-3 py-3">Kết quả</th>
                <th className="w-12 px-2 py-3" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3 font-medium text-[#0f172a]">{formatWeldingDate(row.date)}</td>
                  <td className="px-3 py-3 font-mono text-[12px] text-[#64748b]">{row.weldingId}</td>
                  <td className="px-3 py-3 font-semibold text-[#0f172a]">{row.welderName}</td>
                  <td className="px-3 py-3 text-[#334155]">{row.rank}</td>
                  <td className="px-3 py-3">
                    <span className="font-mono text-[12px] font-semibold text-[#0047AB]">{row.weldJoint}</span>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{row.machine}</td>
                  <td className="px-3 py-3 text-[#334155]">{row.railType}</td>
                  <td className="max-w-[200px] px-3 py-3 text-[#334155]">
                    <div className="line-clamp-2">{row.project}</div>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{row.shift}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${resultStyle[row.result]}`}
                    >
                      {row.result}
                    </span>
                  </td>
                  <td className="relative px-2 py-3">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === row.id ? null : row.id)}
                      className="rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0]"
                      aria-label="Tùy chọn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {menuOpen === row.id && (
                      <div className="absolute right-2 top-10 z-20 w-36 rounded-lg border border-[#e2e8f0] bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#f8fafc]"
                          onClick={() => {
                            setModal({ record: row, mode: "view" });
                            setMenuOpen(null);
                          }}
                        >
                          Xem
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#f8fafc]"
                          onClick={() => {
                            setModal({ record: row, mode: "edit" });
                            setMenuOpen(null);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[12px] text-[#dc2626] hover:bg-[#fef2f2]"
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
                  <td colSpan={11} className="px-4 py-10 text-center text-[#64748b]">
                    Không tìm thấy lịch sử hàn.
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
