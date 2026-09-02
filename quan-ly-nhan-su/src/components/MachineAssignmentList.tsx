"use client";

import { useMemo, useState } from "react";
import MachineAssignmentFormModal, {
  type MachineAssignmentFormValues,
} from "@/components/MachineAssignmentFormModal";
import {
  formatAssignmentDate,
  formatPersons,
  machineAssignments as seedAssignments,
  type MachineAssignment,
} from "@/data/machineAssignments";

const statusStyle: Record<MachineAssignment["status"], string> = {
  "Đang thực hiện": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Hoàn thành": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Tạm dừng": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

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
    <div className="min-w-[160px] flex-1 rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-xs">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="flex max-h-[140px] flex-col gap-1.5 overflow-y-auto">
        {options.map((opt) => {
          const checked = selected.includes(opt);
          return (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs sm:text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-150"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(toggleValue(selected, opt))}
                className="h-3.5 w-3.5 accent-[#0047AB] rounded cursor-pointer"
              />
              <span className={checked ? "font-semibold text-slate-900" : ""}>{opt}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

type ModalState =
  | { mode: "add" }
  | { mode: "view" | "edit"; row: MachineAssignment };

export default function MachineAssignmentList() {
  const [list, setList] = useState<MachineAssignment[]>(seedAssignments);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [machinesSel, setMachinesSel] = useState<string[]>([]);
  const [personsSel, setPersonsSel] = useState<string[]>([]);
  const [jointsSel, setJointsSel] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState("");

  const machineOptions = useMemo(
    () => Array.from(new Set(list.map((a) => `${a.machineCode} · ${a.machineName}`))).sort(),
    [list],
  );
  const personOptions = useMemo(
    () => Array.from(new Set(list.flatMap((a) => a.personsInCharge))).sort(),
    [list],
  );
  const jointOptions = useMemo(
    () => Array.from(new Set(list.map((a) => a.weldJoint))).sort(),
    [list],
  );

  const filtered = useMemo(() => {
    return list.filter((row) => {
      const matchFrom = !dateFrom || row.date >= dateFrom;
      const matchTo = !dateTo || row.date <= dateTo;
      const machineLabel = `${row.machineCode} · ${row.machineName}`;
      const matchMachine = machinesSel.length === 0 || machinesSel.includes(machineLabel);
      const matchPerson =
        personsSel.length === 0 || row.personsInCharge.some((p) => personsSel.includes(p));
      const matchJoint = jointsSel.length === 0 || jointsSel.includes(row.weldJoint);
      return matchFrom && matchTo && matchMachine && matchPerson && matchJoint;
    });
  }, [list, dateFrom, dateTo, machinesSel, personsSel, jointsSel]);

  const hasFilter =
    dateFrom || dateTo || machinesSel.length > 0 || personsSel.length > 0 || jointsSel.length > 0;

  const activeFilterCount =
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    machinesSel.length +
    personsSel.length +
    jointsSel.length;

  const inProgress = filtered.filter((a) => a.status === "Đang thực hiện").length;
  const completed = filtered.filter((a) => a.status === "Hoàn thành").length;

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  function handleSave(values: MachineAssignmentFormValues) {
    if (modal?.mode === "edit") {
      setList((prev) =>
        prev.map((row) => (row.id === modal.row.id ? { ...modal.row, ...values } : row)),
      );
      showToast("Đã cập nhật phân công");
      return;
    }
    const next: MachineAssignment = {
      id: `local-${Date.now()}`,
      ...values,
    };
    setList((prev) => [next, ...prev]);
    showToast("Đã thêm phân công mới");
  }

  function handleDelete(row: MachineAssignment) {
    if (!window.confirm(`Xóa phân công mối hàn ${row.weldJoint}?`)) return;
    setList((prev) => prev.filter((r) => r.id !== row.id));
    showToast("Đã xóa phân công");
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 grid gap-3.5 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng phân công</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold leading-none text-slate-900 font-mono tabular-nums">{filtered.length}</div>
          <div className="mt-1.5 text-xs text-slate-400">Theo bộ lọc hiện tại</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Đang thực hiện</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold leading-none text-[#0047AB] font-mono tabular-nums">{inProgress}</div>
          <div className="mt-1.5 text-xs text-slate-400">Ca đang vận hành</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Hoàn thành</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold leading-none text-emerald-700 font-mono tabular-nums">{completed}</div>
          <div className="mt-1.5 text-xs text-slate-400">Mối hàn đã xong</div>
        </div>
      </div>

      <div className="mb-3 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80 transition-opacity duration-150 cursor-pointer"
            aria-expanded={filtersOpen}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className={`shrink-0 text-slate-500 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            <span className="text-xs sm:text-sm font-bold text-slate-900">Bộ lọc</span>
            <span className="hidden sm:inline text-xs text-slate-500">Máy · Người phụ trách · Mối hàn</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex rounded-full bg-[#0047AB] px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs font-mono tabular-nums">
                {activeFilterCount} đang lọc
              </span>
            )}
          </button>
          <span className="text-xs sm:text-sm font-semibold text-[#0047AB]">
            {filtersOpen ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
          </span>
          <button
            type="button"
            onClick={() => setModal({ mode: "add" })}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
          >
            <span className="text-base leading-none">+</span> Thêm mới
          </button>
        </div>

        {filtersOpen && (
          <div className="border-t border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                Từ ngày
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1.5 block h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
                />
              </label>
              <label className="block text-xs sm:text-[13px] font-semibold text-slate-700">
                Đến ngày
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1.5 block h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
                />
              </label>
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setMachinesSel([]);
                    setPersonsSel([]);
                    setJointsSel([]);
                  }}
                  className="mb-0.5 inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
                >
                  Xóa lọc
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <FilterGroup title="Máy" options={machineOptions} selected={machinesSel} onChange={setMachinesSel} />
              <FilterGroup
                title="Người phụ trách"
                options={personOptions}
                selected={personsSel}
                onChange={setPersonsSel}
              />
              <FilterGroup title="Mối hàn" options={jointOptions} selected={jointsSel} onChange={setJointsSel} />
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Ngày</th>
                <th className="px-3.5 py-3">Máy</th>
                <th className="px-3.5 py-3">Nhà máy</th>
                <th className="px-3.5 py-3">Ca</th>
                <th className="min-w-[180px] px-3.5 py-3">Nhân sự phụ trách</th>
                <th className="px-3.5 py-3">Mối hàn</th>
                <th className="px-3.5 py-3">Loại ray</th>
                <th className="px-3.5 py-3">Trạng thái</th>
                <th className="px-3.5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-4 py-3 font-semibold font-mono text-slate-900 text-xs sm:text-sm">{formatAssignmentDate(row.date)}</td>
                  <td className="px-3.5 py-3">
                    <div className="font-semibold font-mono text-[#0047AB] text-xs sm:text-sm">{row.machineCode}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{row.machineName}</div>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">{row.plant}</td>
                  <td className="px-3.5 py-3 text-slate-700">{row.shift}</td>
                  <td className="px-3.5 py-3">
                    <div className="font-medium text-slate-900">{formatPersons(row.personsInCharge)}</div>
                    {row.personsInCharge.length > 1 && (
                      <div className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">{row.personsInCharge.length} người</div>
                    )}
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="font-mono text-xs font-bold text-[#0047AB] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shadow-2xs">{row.weldJoint}</span>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700 font-mono text-xs sm:text-sm">{row.railType}</td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setModal({ mode: "view", row })}
                        className="rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-[#0047AB] hover:bg-blue-50 transition-colors duration-150 cursor-pointer"
                      >
                        Xem
                      </button>
                      <button
                        type="button"
                        onClick={() => setModal({ mode: "edit", row })}
                        className="rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        className="rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors duration-150 cursor-pointer"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không có phân công phù hợp bộ lọc</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MachineAssignmentFormModal
        open={modal !== null}
        mode={modal?.mode ?? "add"}
        initial={modal && modal.mode !== "add" ? modal.row : null}
        onClose={() => setModal(null)}
        onSubmit={handleSave}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 px-4 py-3 text-xs sm:text-sm font-medium text-white shadow-xl border border-white/10 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toast}
        </div>
      )}
    </main>
  );
}
