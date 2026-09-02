"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { welders as seedWelders, type Welder } from "@/data/welders";
import {
  Check,
  DotsThree,
  MagnifyingGlass,
  CaretDown,
  Users,
  SealCheck,
  Sparkle,
} from "@/components/icons";

const rankStyle: Record<string, string> = {
  "Hạng 1": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Hạng 2": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Hạng 3": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function MultiSelectCombobox({
  title,
  options,
  selected,
  onChange,
  minWidth = "min-w-[140px]",
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  minWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const count = selected.length;
  let displayLabel = title;
  if (count === 1) {
    displayLabel = selected[0];
  } else if (count > 1) {
    displayLabel = `${title} (${count})`;
  }

  return (
    <div ref={dropdownRef} className={`relative ${minWidth}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`h-10 w-full rounded-lg border px-3 text-xs sm:text-sm font-medium shadow-2xs outline-hidden hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer flex items-center justify-between gap-1.5 whitespace-nowrap ${
          count > 0
            ? "border-[#0047AB]/50 bg-blue-50/50 text-[#0047AB] font-semibold"
            : "border-slate-300 bg-white text-slate-700"
        } ${open ? "border-[#0047AB] ring-2 ring-[#0047AB]/20" : ""}`}
      >
        <span className="truncate">{displayLabel}</span>
        <div className="flex items-center gap-1 shrink-0">
          {count > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-[#0047AB] px-1.5 py-0.2 text-[11px] font-bold text-white font-mono">
              {count}
            </span>
          )}
          <CaretDown
            size={13}
            weight="bold"
            aria-hidden
            className={`shrink-0 text-slate-400 transition-transform duration-150 ${open ? "rotate-180 text-[#0047AB]" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex max-h-64 w-full min-w-full flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
            <span className="truncate">{title}</span>
            {count > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                className="text-[#0047AB] hover:underline font-semibold cursor-pointer lowercase shrink-0 ml-1"
              >
                Bỏ chọn
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5 pt-1">
            {options.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors duration-150 ${
                    checked
                      ? "bg-blue-50/70 font-semibold text-[#0047AB]"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange(toggleValue(selected, opt))}
                    className="h-4 w-4 rounded border-slate-300 accent-[#0047AB] cursor-pointer shrink-0"
                  />
                  <span className="truncate">{opt}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WelderManagement() {
  const [list, setList] = useState<Welder[]>(seedWelders);
  const [query, setQuery] = useState("");
  const [ranksSel, setRanksSel] = useState<string[]>([]);
  const [teamsSel, setTeamsSel] = useState<string[]>([]);
  const [railsSel, setRailsSel] = useState<string[]>([]);
  const [machinesSel, setMachinesSel] = useState<string[]>([]);
  const [statusesSel, setStatusesSel] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    function handleClickOutside() {
      setMenuOpen(null);
    }
    if (menuOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpen]);

  const rankOptions = useMemo(() => Array.from(new Set(list.map((w) => w.rank))).sort(), [list]);
  const teamOptions = useMemo(() => Array.from(new Set(list.map((w) => w.weldingTeam))).sort(), [list]);
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
        w.weldingTeam.toLowerCase().includes(q) ||
        w.railTypes.toLowerCase().includes(q) ||
        w.trainedMachines.toLowerCase().includes(q);
      const matchRank = ranksSel.length === 0 || ranksSel.includes(w.rank);
      const matchTeam = teamsSel.length === 0 || teamsSel.includes(w.weldingTeam);
      const matchRail =
        railsSel.length === 0 || railsSel.some((r) => w.railTypes.split(",").map((s) => s.trim()).includes(r));
      const matchMachine =
        machinesSel.length === 0 ||
        machinesSel.some((m) => w.trainedMachines.split(",").map((s) => s.trim()).includes(m));
      const matchStatus = statusesSel.length === 0 || statusesSel.includes(w.status);
      return matchQ && matchRank && matchTeam && matchRail && matchMachine && matchStatus;
    });
  }, [list, query, ranksSel, teamsSel, railsSel, machinesSel, statusesSel]);

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
    ranksSel.length > 0 || teamsSel.length > 0 || railsSel.length > 0 || machinesSel.length > 0 || statusesSel.length > 0 || query.trim();

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng thợ hàn</div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold leading-none text-slate-900 font-mono tabular-nums">{list.length}</div>
              <div className="mt-1.5 text-xs text-slate-400">Toàn bộ hồ sơ trong hệ thống</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#0047AB] ring-1 ring-blue-200">
              <Users size={22} aria-hidden />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Trạng thái</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold leading-none text-slate-900 font-mono tabular-nums">{activeCount}</span>
                <span className="text-xs sm:text-sm font-semibold text-emerald-700">hoạt động</span>
              </div>
              <div className="mt-1.5 text-xs text-slate-400">
                <span className="font-semibold text-rose-700 font-mono tabular-nums">{lockedCount}</span> đang khóa
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
              <SealCheck size={22} aria-hidden />
            </div>
          </div>
          <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${list.length ? (activeCount / list.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs sm:col-span-2 xl:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Phân hạng</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold leading-none text-slate-900 font-mono tabular-nums">{rank1}</span>
                <span className="text-xs sm:text-sm font-semibold text-[#0047AB]">hạng 1</span>
              </div>
              <div className="mt-1.5 text-xs text-slate-400">
                <span className="font-semibold text-slate-600 font-mono tabular-nums">{rankOther}</span> hạng khác
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
              <Sparkle size={22} aria-hidden />
            </div>
          </div>
          <div className="mt-3.5 flex gap-1.5">
            <div
              className="h-1.5 rounded-full bg-[#0047AB]"
              style={{ flex: rank1 || 0.01 }}
              title={`Hạng 1: ${rank1}`}
            />
            <div
              className="h-1.5 rounded-full bg-slate-200"
              style={{ flex: rankOther || 0.01 }}
              title={`Hạng khác: ${rankOther}`}
            />
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, Welding ID, loại ray, máy..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>

        <MultiSelectCombobox
          title="Hạng"
          options={rankOptions}
          selected={ranksSel}
          onChange={setRanksSel}
          minWidth="min-w-[130px]"
        />
        <MultiSelectCombobox
          title="Tổ hàn"
          options={teamOptions}
          selected={teamsSel}
          onChange={setTeamsSel}
          minWidth="min-w-[140px]"
        />
        <MultiSelectCombobox
          title="Loại ray"
          options={railOptions}
          selected={railsSel}
          onChange={setRailsSel}
          minWidth="min-w-[145px]"
        />
        <MultiSelectCombobox
          title="Máy đã đào tạo"
          options={machineOptions}
          selected={machinesSel}
          onChange={setMachinesSel}
          minWidth="min-w-[185px]"
        />
        <MultiSelectCombobox
          title="Trạng thái"
          options={statusOptions}
          selected={statusesSel}
          onChange={setStatusesSel}
          minWidth="min-w-[140px]"
        />

        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRanksSel([]);
              setTeamsSel([]);
              setRailsSel([]);
              setMachinesSel([]);
              setStatusesSel([]);
            }}
            className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs whitespace-nowrap"
          >
            Xóa lọc
          </button>
        )}

        <span className="text-xs sm:text-sm text-slate-500 shrink-0 px-1">
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{filtered.length}</strong> kết quả
        </span>

        <button
          type="button"
          onClick={() => showToast("Form thêm thợ hàn sẽ bổ sung sau")}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer whitespace-nowrap"
        >
          <span className="text-base leading-none">+</span> Thêm mới
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Chọn tất cả" className="h-4 w-4 accent-[#0047AB] rounded cursor-pointer" />
                </th>
                <th className="px-3.5 py-3">Welding ID</th>
                <th className="px-3.5 py-3">Thợ hàn</th>
                <th className="px-3.5 py-3">Tổ hàn</th>
                <th className="px-3.5 py-3">Hạng</th>
                <th className="px-3.5 py-3">Loại ray</th>
                <th className="px-3.5 py-3">Máy đã đào tạo</th>
                <th className="px-3.5 py-3">Kinh nghiệm</th>
                <th className="px-3.5 py-3">Trạng thái</th>
                <th className="w-12 px-2 py-3 text-center" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(w.id)}
                      onChange={() => toggleOne(w.id)}
                      aria-label={`Chọn ${w.name}`}
                      className="h-4 w-4 accent-[#0047AB] rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-3.5 py-3 font-mono font-semibold text-[#0047AB] text-xs sm:text-sm">{w.weldingId}</td>
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200 shadow-2xs">
                        <Image src={w.photo} alt={w.name} fill className="object-cover" sizes="40px" />
                      </div>
                      <div className="min-w-0 leading-tight">
                        <div className="truncate font-semibold text-slate-900 text-xs sm:text-sm">{w.name}</div>
                        <div className="truncate text-xs text-slate-500">
                          {w.position} · {w.department}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="inline-flex whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#0047AB]">
                      {w.weldingTeam}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        rankStyle[w.rank] ?? "bg-slate-100 border border-slate-200 text-slate-700 shadow-2xs"
                      }`}
                    >
                      {w.rank}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700 font-mono text-xs sm:text-sm">{w.railTypes}</td>
                  <td className="px-3.5 py-3 text-slate-700 font-mono text-xs sm:text-sm">{w.trainedMachines}</td>
                  <td className="px-3.5 py-3 text-slate-700">{w.experience}</td>
                  <td className="px-3.5 py-3">
                    {w.status === "Hoạt động" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-2xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {w.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-700 shadow-2xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        {w.status}
                      </span>
                    )}
                  </td>
                  <td className="relative px-2 py-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === w.id ? null : w.id);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
                      aria-label="Tùy chọn"
                    >
                      <DotsThree size={16} weight="bold" aria-hidden />
                    </button>
                    {menuOpen === w.id && (
                      <div className="absolute right-2 top-10 z-30 w-36 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100 text-left">
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            showToast(`${w.name} · ${w.weldingId} · ${w.rank}`);
                            setMenuOpen(null);
                          }}
                        >
                          Xem
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => {
                            showToast(`Sửa thông tin ${w.name}`);
                            setMenuOpen(null);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => {
                            setList((prev) =>
                              prev.map((x) =>
                                x.id === w.id
                                  ? { ...x, status: x.status === "Hoạt động" ? "Khóa" : "Hoạt động" }
                                  : x
                              )
                            );
                            showToast(
                              `Đã ${w.status === "Hoạt động" ? "khóa" : "mở khóa"} ${w.name}`
                            );
                            setMenuOpen(null);
                          }}
                        >
                          {w.status === "Hoạt động" ? "Khóa" : "Mở khóa"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setList((prev) => prev.filter((x) => x.id !== w.id));
                            setSelected((prev) => prev.filter((id) => id !== w.id));
                            showToast(`Đã xóa ${w.name}`);
                            setMenuOpen(null);
                          }}
                          className="block w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
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
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Không tìm thấy thợ hàn phù hợp</div>
                    <div className="mt-1 text-xs text-slate-400">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 px-4 py-3 text-xs sm:text-sm font-medium text-white shadow-xl border border-white/10 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Check size={16} weight="bold" aria-hidden className="text-emerald-500" />
          {toast}
        </div>
      )}
    </main>
  );
}
