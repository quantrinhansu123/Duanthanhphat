"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { welders as seedWelders, type Welder } from "@/data/welders";

const rankStyle: Record<string, string> = {
  "Hạng 1": "bg-[#0047AB] text-white",
  "Hạng 2": "bg-[#0d9488] text-white",
  "Hạng 3": "bg-[#c9a227] text-white",
};

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
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
      <div className="flex flex-col gap-1.5">
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

export default function WelderManagement() {
  const [list, setList] = useState<Welder[]>(seedWelders);
  const [query, setQuery] = useState("");
  const [ranksSel, setRanksSel] = useState<string[]>([]);
  const [railsSel, setRailsSel] = useState<string[]>([]);
  const [machinesSel, setMachinesSel] = useState<string[]>([]);
  const [statusesSel, setStatusesSel] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState("");

  const rankOptions = useMemo(() => Array.from(new Set(list.map((w) => w.rank))).sort(), [list]);
  const railOptions = useMemo(() => {
    const all = list.flatMap((w) => w.railTypes.split(",").map((s) => s.trim()).filter(Boolean));
    return Array.from(new Set(all)).sort();
  }, [list]);
  const machineOptions = useMemo(() => {
    const all = list.flatMap((w) => w.trainedMachines.split(",").map((s) => s.trim()).filter(Boolean));
    return Array.from(new Set(all)).sort();
  }, [list]);
  const statusOptions = ["Hoạt động", "Khóa"];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((w) => {
      const matchQ =
        !q ||
        w.name.toLowerCase().includes(q) ||
        w.weldingId.toLowerCase().includes(q) ||
        w.email.toLowerCase().includes(q) ||
        w.railTypes.toLowerCase().includes(q) ||
        w.trainedMachines.toLowerCase().includes(q);
      const matchRank = ranksSel.length === 0 || ranksSel.includes(w.rank);
      const matchRail =
        railsSel.length === 0 || railsSel.some((r) => w.railTypes.split(",").map((s) => s.trim()).includes(r));
      const matchMachine =
        machinesSel.length === 0 ||
        machinesSel.some((m) => w.trainedMachines.split(",").map((s) => s.trim()).includes(m));
      const matchStatus = statusesSel.length === 0 || statusesSel.includes(w.status);
      return matchQ && matchRank && matchRail && matchMachine && matchStatus;
    });
  }, [list, query, ranksSel, railsSel, machinesSel, statusesSel]);

  const activeCount = list.filter((w) => w.status === "Hoạt động").length;
  const lockedCount = list.filter((w) => w.status === "Khóa").length;
  const rank1 = list.filter((w) => w.rank === "Hạng 1").length;
  const rankOther = list.filter((w) => w.rank !== "Hạng 1").length;

  const allSelected = filtered.length > 0 && filtered.every((w) => selected.includes(w.id));

  function toggleAll() {
    if (allSelected) setSelected((prev) => prev.filter((id) => !filtered.some((w) => w.id === id)));
    else setSelected((prev) => Array.from(new Set([...prev, ...filtered.map((w) => w.id)])));
  }

  function toggleOne(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  const hasFilter =
    ranksSel.length > 0 || railsSel.length > 0 || machinesSel.length > 0 || statusesSel.length > 0 || query.trim();

  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-[#d9e2f1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">Tổng thợ hàn</div>
              <div className="mt-2 text-[28px] font-bold leading-none text-[#0f172a]">{list.length}</div>
              <div className="mt-1.5 text-[12px] text-[#94a3b8]">Toàn bộ hồ sơ trong hệ thống</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8eef8] text-[#0047AB]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#d9e2f1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">Trạng thái</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[28px] font-bold leading-none text-[#0f172a]">{activeCount}</span>
                <span className="text-[13px] font-medium text-[#0047AB]">hoạt động</span>
              </div>
              <div className="mt-1.5 text-[12px] text-[#94a3b8]">
                <span className="font-semibold text-[#64748b]">{lockedCount}</span> đang khóa
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ecfdf5] text-[#0d9488]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4 12 14.01l-3-3" />
              </svg>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eef2f7]">
            <div
              className="h-full rounded-full bg-[#0047AB]"
              style={{ width: `${list.length ? (activeCount / list.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#d9e2f1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:col-span-2 xl:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">Phân hạng</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[28px] font-bold leading-none text-[#0f172a]">{rank1}</span>
                <span className="text-[13px] font-medium text-[#0047AB]">hạng 1</span>
              </div>
              <div className="mt-1.5 text-[12px] text-[#94a3b8]">
                <span className="font-semibold text-[#64748b]">{rankOther}</span> hạng khác
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff7ed] text-[#c2410c]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2l3 7h7l-5.5 4.2L18.5 21 12 16.8 5.5 21l2-7.8L2 9h7z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex gap-1.5">
            <div
              className="h-1.5 rounded-full bg-[#0047AB]"
              style={{ flex: rank1 || 0.01 }}
              title={`Hạng 1: ${rank1}`}
            />
            <div
              className="h-1.5 rounded-full bg-[#94a3b8]"
              style={{ flex: rankOther || 0.01 }}
              title={`Hạng khác: ${rankOther}`}
            />
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
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
            placeholder="Tìm theo tên, Welding ID, loại ray, máy..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>
        <button
          type="button"
          onClick={() => showToast("Form thêm thợ hàn sẽ bổ sung sau")}
          className="inline-flex h-10 items-center gap-1 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
        >
          <span className="text-base leading-none">+</span> Thêm mới
        </button>
        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRanksSel([]);
              setRailsSel([]);
              setMachinesSel([]);
              setStatusesSel([]);
            }}
            className="inline-flex h-10 items-center rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] font-medium text-[#64748b] hover:bg-[#f8fafc]"
          >
            Xóa lọc
          </button>
        )}
        <span className="text-[13px] text-[#64748b]">
          <strong className="text-[#0f172a]">{filtered.length}</strong> kết quả
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterGroup title="Hạng" options={rankOptions} selected={ranksSel} onChange={setRanksSel} />
        <FilterGroup title="Loại ray" options={railOptions} selected={railsSel} onChange={setRailsSel} />
        <FilterGroup title="Máy đã đào tạo" options={machineOptions} selected={machinesSel} onChange={setMachinesSel} />
        <FilterGroup title="Trạng thái" options={statusOptions} selected={statusesSel} onChange={setStatusesSel} />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e8eef8] bg-[#f7f9fc] text-[12px] font-semibold uppercase tracking-[0.03em] text-[#64748b]">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Chọn tất cả" />
                </th>
                <th className="px-3 py-3">Welding ID</th>
                <th className="px-3 py-3">Thợ hàn</th>
                <th className="px-3 py-3">Hạng</th>
                <th className="px-3 py-3">Loại ray</th>
                <th className="px-3 py-3">Máy đã đào tạo</th>
                <th className="px-3 py-3">Kinh nghiệm</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={w.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(w.id)}
                      onChange={() => toggleOne(w.id)}
                      aria-label={`Chọn ${w.name}`}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-[#0f172a]">{w.weldingId}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-[#e2e8f0] ring-1 ring-[#dbe4f3]">
                        <Image src={w.photo} alt={w.name} fill className="object-cover" sizes="40px" />
                      </div>
                      <div className="min-w-0 leading-tight">
                        <div className="truncate font-semibold text-[#0f172a]">{w.name}</div>
                        <div className="truncate text-[12px] text-[#64748b]">
                          {w.position} · {w.department}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        rankStyle[w.rank] ?? "bg-[#e8eef8] text-[#475569]"
                      }`}
                    >
                      {w.rank}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{w.railTypes}</td>
                  <td className="px-3 py-3 text-[#334155]">{w.trainedMachines}</td>
                  <td className="px-3 py-3 text-[#334155]">{w.experience}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${
                        w.status === "Hoạt động" ? "bg-[#0047AB]" : "bg-[#94a3b8]"
                      }`}
                    >
                      {w.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1 text-[#64748b]">
                      <button type="button" className="rounded-md p-1.5 hover:bg-[#eef3fb] hover:text-[#0047AB]" aria-label="Xem">
                        <IconEye />
                      </button>
                      <button type="button" className="rounded-md p-1.5 hover:bg-[#eef3fb] hover:text-[#0047AB]" aria-label="Sửa">
                        <IconEdit />
                      </button>
                      <button type="button" className="rounded-md p-1.5 hover:bg-[#eef3fb] hover:text-[#0047AB]" aria-label="Khóa">
                        <IconLock />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setList((prev) => prev.filter((x) => x.id !== w.id));
                          setSelected((prev) => prev.filter((id) => id !== w.id));
                          showToast(`Đã xóa ${w.name}`);
                        }}
                        className="rounded-md p-1.5 hover:bg-[#eef3fb] hover:text-[#0047AB]"
                        aria-label="Xóa"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[#64748b]">
                    Không tìm thấy thợ hàn phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-[#071633] px-4 py-3 text-[13px] font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
