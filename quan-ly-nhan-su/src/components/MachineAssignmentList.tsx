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
  "Đang thực hiện": "bg-[#0047AB] text-white",
  "Hoàn thành": "bg-[#22a94f] text-white",
  "Tạm dừng": "bg-[#f59e0b] text-white",
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
    <div className="min-w-[180px] flex-1 rounded-xl border border-[#e2e8f0] bg-white px-3.5 py-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">{title}</div>
      <div className="flex max-h-[140px] flex-col gap-1.5 overflow-y-auto">
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
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#d9e2f1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">Tổng phân công</div>
          <div className="mt-2 text-[28px] font-bold leading-none text-[#0f172a]">{filtered.length}</div>
          <div className="mt-1.5 text-[12px] text-[#94a3b8]">Theo bộ lọc hiện tại</div>
        </div>
        <div className="rounded-2xl border border-[#d9e2f1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">Đang thực hiện</div>
          <div className="mt-2 text-[28px] font-bold leading-none text-[#0047AB]">{inProgress}</div>
          <div className="mt-1.5 text-[12px] text-[#94a3b8]">Ca đang vận hành</div>
        </div>
        <div className="rounded-2xl border border-[#d9e2f1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">Hoàn thành</div>
          <div className="mt-2 text-[28px] font-bold leading-none text-[#22a94f]">{completed}</div>
          <div className="mt-1.5 text-[12px] text-[#94a3b8]">Mối hàn đã xong</div>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-[#e2e8f0] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-end gap-3">
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
              className="mb-0.5 inline-flex h-10 items-center rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] font-medium text-[#64748b] hover:bg-[#f8fafc]"
            >
              Xóa lọc
            </button>
          )}
          <button
            type="button"
            onClick={() => setModal({ mode: "add" })}
            className="mb-0.5 ml-auto inline-flex h-10 items-center gap-1 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
          >
            <span className="text-base leading-none">+</span> Thêm mới
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
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

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e8eef8] bg-[#f7f9fc] text-[12px] font-semibold uppercase tracking-[0.03em] text-[#64748b]">
                <th className="px-4 py-3">Ngày</th>
                <th className="px-3 py-3">Máy</th>
                <th className="px-3 py-3">Nhà máy</th>
                <th className="px-3 py-3">Ca</th>
                <th className="min-w-[180px] px-3 py-3">Nhân sự phụ trách</th>
                <th className="px-3 py-3">Mối hàn</th>
                <th className="px-3 py-3">Loại ray</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3 font-medium text-[#0f172a]">{formatAssignmentDate(row.date)}</td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-[#0f172a]">{row.machineCode}</div>
                    <div className="mt-0.5 text-[12px] text-[#64748b]">{row.machineName}</div>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{row.plant}</td>
                  <td className="px-3 py-3 text-[#334155]">{row.shift}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-[#0f172a]">{formatPersons(row.personsInCharge)}</div>
                    {row.personsInCharge.length > 1 && (
                      <div className="mt-0.5 text-[11px] text-[#64748b]">{row.personsInCharge.length} người</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-mono text-[12px] font-semibold text-[#0047AB]">{row.weldJoint}</span>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{row.railType}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setModal({ mode: "view", row })}
                        className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#0047AB] hover:bg-[#eef4ff]"
                      >
                        Xem
                      </button>
                      <button
                        type="button"
                        onClick={() => setModal({ mode: "edit", row })}
                        className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#334155] hover:bg-[#f1f5f9]"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#dc2626] hover:bg-[#fef2f2]"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[#64748b]">
                    Không có phân công phù hợp bộ lọc.
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
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-[#071633] px-4 py-3 text-[13px] font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
