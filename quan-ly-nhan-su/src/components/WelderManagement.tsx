"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { welders as seedWelders, type Welder } from "@/data/welders";

const rankStyle: Record<string, string> = {
  "Hạng 1": "bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]",
  "Hạng 2": "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
  "Hạng 3": "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]",
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
    <div className="min-w-[150px] flex-1 rounded-xl border border-[#d9e2f1] bg-white px-3.5 py-3 shadow-xs">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748b]">{title}</div>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => {
          const checked = selected.includes(opt);
          return (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[12.5px] text-[#334155] hover:bg-[#f8fafc] transition-colors duration-150"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(toggleValue(selected, opt))}
                className="h-3.5 w-3.5 accent-[#0047AB] rounded cursor-pointer"
              />
              <span className={checked ? "font-semibold text-[#0f172a]" : ""}>{opt}</span>
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
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-[#d9e2f1] bg-white p-4.5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#64748b]">Tổng thợ hàn</div>
              <div className="mt-2 text-[28px] font-bold leading-none text-[#0f172a]">{list.length}</div>
              <div className="mt-1.5 text-[12px] text-[#94a3b8]">Toàn bộ hồ sơ trong hệ thống</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eff6ff] text-[#0047AB] ring-1 ring-[#bfdbfe]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#d9e2f1] bg-white p-4.5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#64748b]">Trạng thái</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[28px] font-bold leading-none text-[#0f172a]">{activeCount}</span>
                <span className="text-[12.5px] font-semibold text-[#15803d]">hoạt động</span>
              </div>
              <div className="mt-1.5 text-[12px] text-[#94a3b8]">
                <span className="font-semibold text-[#b91c1c]">{lockedCount}</span> đang khóa
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0fdf4] text-[#16a34a] ring-1 ring-[#bbf7d0]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4 12 14.01l-3-3" />
              </svg>
            </div>
          </div>
          <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-[#f1f5f9]">
            <div
              className="h-full rounded-full bg-[#16a34a] transition-all"
              style={{ width: `${list.length ? (activeCount / list.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#d9e2f1] bg-white p-4.5 shadow-xs sm:col-span-2 xl:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#64748b]">Phân hạng</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[28px] font-bold leading-none text-[#0f172a]">{rank1}</span>
                <span className="text-[12.5px] font-semibold text-[#0047AB]">hạng 1</span>
              </div>
              <div className="mt-1.5 text-[12px] text-[#94a3b8]">
                <span className="font-semibold text-[#64748b]">{rankOther}</span> hạng khác
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fffbeb] text-[#d97706] ring-1 ring-[#fde68a]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2l3 7h7l-5.5 4.2L18.5 21 12 16.8 5.5 21l2-7.8L2 9h7z" />
              </svg>
            </div>
          </div>
          <div className="mt-3.5 flex gap-1.5">
            <div
              className="h-1.5 rounded-full bg-[#0047AB]"
              style={{ flex: rank1 || 0.01 }}
              title={`Hạng 1: ${rank1}`}
            />
            <div
              className="h-1.5 rounded-full bg-[#cbd5e1]"
              style={{ flex: rankOther || 0.01 }}
              title={`Hạng khác: ${rankOther}`}
            />
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
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
            placeholder="Tìm theo tên, Welding ID, loại ray, máy..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
          />
        </div>
        <button
          type="button"
          onClick={() => showToast("Form thêm thợ hàn sẽ bổ sung sau")}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white shadow-xs hover:bg-[#00388a] active:bg-[#002d6e] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/25 transition-all duration-150 cursor-pointer"
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
            className="inline-flex h-10 items-center rounded-lg border border-[#d9e2f1] bg-white px-3.5 text-[12.5px] font-medium text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a] hover:border-[#cbd5e1] active:bg-[#f1f5f9] transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Xóa lọc
          </button>
        )}
        <span className="text-[12.5px] text-[#64748b]">
          <strong className="font-semibold text-[#0f172a]">{filtered.length}</strong> kết quả
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <FilterGroup title="Hạng" options={rankOptions} selected={ranksSel} onChange={setRanksSel} />
        <FilterGroup title="Loại ray" options={railOptions} selected={railsSel} onChange={setRailsSel} />
        <FilterGroup title="Máy đã đào tạo" options={machineOptions} selected={machinesSel} onChange={setMachinesSel} />
        <FilterGroup title="Trạng thái" options={statusOptions} selected={statusesSel} onChange={setStatusesSel} />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#64748b]">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Chọn tất cả" className="h-4 w-4 accent-[#0047AB] rounded cursor-pointer" />
                </th>
                <th className="px-3.5 py-3">Welding ID</th>
                <th className="px-3.5 py-3">Thợ hàn</th>
                <th className="px-3.5 py-3">Hạng</th>
                <th className="px-3.5 py-3">Loại ray</th>
                <th className="px-3.5 py-3">Máy đã đào tạo</th>
                <th className="px-3.5 py-3">Kinh nghiệm</th>
                <th className="px-3.5 py-3">Trạng thái</th>
                <th className="px-3.5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filtered.map((w) => (
                <tr key={w.id} className="hover:bg-[#f8fafc]/90 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(w.id)}
                      onChange={() => toggleOne(w.id)}
                      aria-label={`Chọn ${w.name}`}
                      className="h-4 w-4 accent-[#0047AB] rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-3.5 py-3 font-mono font-semibold text-[#0047AB] text-[12.5px]">{w.weldingId}</td>
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-[#e2e8f0] ring-1 ring-[#cbd5e1]/80">
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
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        rankStyle[w.rank] ?? "bg-[#f1f5f9] border border-[#e2e8f0] text-[#475569]"
                      }`}
                    >
                      {w.rank}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-[#334155]">{w.railTypes}</td>
                  <td className="px-3.5 py-3 text-[#334155]">{w.trainedMachines}</td>
                  <td className="px-3.5 py-3 text-[#334155]">{w.experience}</td>
                  <td className="px-3.5 py-3">
                    {w.status === "Hoạt động" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-0.5 text-[11px] font-semibold text-[#15803d]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
                        {w.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fef2f2] border border-[#fecaca] px-2.5 py-0.5 text-[11px] font-semibold text-[#b91c1c]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#dc2626]" />
                        {w.status}
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-3">
                    <div className="flex items-center justify-end gap-1 text-[#64748b]">
                      <button type="button" className="rounded-lg p-1.5 hover:bg-[#f1f5f9] hover:text-[#0047AB] transition-colors duration-150 cursor-pointer" aria-label="Xem">
                        <IconEye />
                      </button>
                      <button type="button" className="rounded-lg p-1.5 hover:bg-[#f1f5f9] hover:text-[#0047AB] transition-colors duration-150 cursor-pointer" aria-label="Sửa">
                        <IconEdit />
                      </button>
                      <button type="button" className="rounded-lg p-1.5 hover:bg-[#f1f5f9] hover:text-[#0047AB] transition-colors duration-150 cursor-pointer" aria-label="Khóa">
                        <IconLock />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setList((prev) => prev.filter((x) => x.id !== w.id));
                          setSelected((prev) => prev.filter((id) => id !== w.id));
                          showToast(`Đã xóa ${w.name}`);
                        }}
                        className="rounded-lg p-1.5 hover:bg-[#fef2f2] hover:text-[#dc2626] transition-colors duration-150 cursor-pointer"
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
                  <td colSpan={9} className="px-4 py-12 text-center text-[#64748b]">
                    <div className="text-[14px] font-medium">Không tìm thấy thợ hàn phù hợp</div>
                    <div className="mt-1 text-[12.5px] text-[#94a3b8]">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-[#071633] px-4 py-3 text-[13px] font-medium text-white shadow-xl border border-white/10 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toast}
        </div>
      )}
    </main>
  );
}
