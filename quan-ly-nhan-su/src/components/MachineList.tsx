"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  formatMaintenanceDate,
  getMachineMaintenanceHistory,
  type MachineMaintenanceHistoryRow,
} from "@/data/machine-maintenance-history";
import { machines as seedMachines, type Machine } from "@/data/machines";

const statusStyle: Record<Machine["status"], string> = {
  "Hoạt động": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Bảo trì": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  Ngừng: "bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs",
  Hỏng: "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
};

const maintTypeStyle: Record<MachineMaintenanceHistoryRow["type"], string> = {
  "Bảo dưỡng": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Sửa chữa": "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  "Kiểm định": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Thay phụ tùng": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

const maintStatusStyle: Record<MachineMaintenanceHistoryRow["status"], string> = {
  "Đã xong": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Đang làm": "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs",
  "Chờ xác nhận": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2.5 text-xs sm:text-sm last:border-b-0">
      <div className="font-medium text-slate-500">{label}</div>
      <div className="text-slate-900 font-semibold">{value}</div>
    </div>
  );
}

function MachineDetailModal({
  machine,
  onClose,
  initialTab = "info",
}: {
  machine: Machine;
  onClose: () => void;
  initialTab?: "info" | "history";
}) {
  const [tab, setTab] = useState<"info" | "history">(initialTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const showHistoryTab = machine.model === "K920";
  const history = useMemo(
    () => (showHistoryTab ? getMachineMaintenanceHistory(machine.code) : []),
    [machine.code, showHistoryTab],
  );

  useEffect(() => {
    setTab(initialTab);
  }, [machine.id, initialTab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        aria-labelledby="machine-detail-title"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div className="min-w-0">
            <div className="text-xs font-bold font-mono uppercase tracking-wider text-[#0047AB]">{machine.code}</div>
            <h2 id="machine-detail-title" className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">
              {machine.name}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
                aria-label="Tùy chọn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100 text-left">
                  <div className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors">Chỉnh sửa</div>
                  <div className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors">Phân công máy</div>
                  <div className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors">Lên lịch bảo trì</div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
              aria-label="Đóng"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {showHistoryTab && (
          <div className="flex gap-1 border-b border-slate-200 px-5 sm:px-6 pt-1 bg-slate-50">
            <button
              type="button"
              onClick={() => setTab("info")}
              className={`border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors duration-150 cursor-pointer ${
                tab === "info"
                  ? "border-[#0047AB] text-[#0047AB]"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              Thông tin
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={`border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors duration-150 cursor-pointer ${
                tab === "history"
                  ? "border-[#0047AB] text-[#0047AB]"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              Lịch sử bảo trì
              {history.length > 0 && (
                <span className="ml-1.5 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold font-mono text-[#0047AB]">
                  {history.length}
                </span>
              )}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {tab === "info" || !showHistoryTab ? (
            <>
              <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
                <Image src={machine.image} alt={machine.name} fill className="object-cover" sizes="780px" />
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[machine.status]}`}>
                  {machine.status}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    machine.available ? "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs" : "bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs"
                  }`}
                >
                  {machine.available ? "Khả dụng" : "Không khả dụng"}
                </span>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4 py-1">
                <DetailRow label="Mã máy" value={<span className="font-mono text-[#0047AB]">{machine.code}</span>} />
                <DetailRow label="Model" value={machine.model} />
                <DetailRow label="Nhà máy" value={machine.plant} />
                <DetailRow label="Số serial" value={<span className="font-mono">{machine.serialNumber}</span>} />
                <DetailRow label="Năm lắp đặt" value={machine.yearInstalled} />
                <DetailRow label="Tổ đội" value={machine.team} />
                <DetailRow label="Thợ vận hành" value={machine.operator} />
                <DetailRow label="Số mối hàn" value={<span className="font-mono tabular-nums">{machine.weldCount.toLocaleString("vi-VN")}</span>} />
                <DetailRow label="Giờ vận hành" value={<span className="font-mono tabular-nums">{`${machine.operatingHours.toLocaleString("vi-VN")} giờ`}</span>} />
                <DetailRow label="Tỷ lệ lỗi" value={<span className="font-mono text-rose-700 tabular-nums">{machine.errorRate}</span>} />
                <DetailRow label="Bảo trì gần nhất" value={<span className="font-mono tabular-nums">{machine.lastMaintenance}</span>} />
                <DetailRow label="Bảo trì tiếp theo" value={<span className="font-mono tabular-nums">{machine.nextMaintenance}</span>} />
                <DetailRow label="Ghi chú" value={machine.note} />
              </div>
            </>
          ) : (
            <div>
              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs sm:text-sm text-slate-500">
                  <strong className="font-semibold text-slate-900 font-mono tabular-nums">{history.length}</strong> lần bảo trì · sắp xếp mới nhất trước
                </div>
              </div>

              {history.length > 0 ? (
                <div className="table-scroll overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[680px] border-collapse text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        <th className="px-3.5 py-2.5">Ngày</th>
                        <th className="px-3.5 py-2.5">Giờ</th>
                        <th className="min-w-[200px] px-3.5 py-2.5">Công việc</th>
                        <th className="px-3.5 py-2.5">Loại</th>
                        <th className="px-3.5 py-2.5">Trạng thái</th>
                        <th className="px-3.5 py-2.5">Thời lượng</th>
                        <th className="min-w-[160px] px-3.5 py-2.5">Nhân sự</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                          <td className="whitespace-nowrap px-3.5 py-3 font-semibold font-mono text-slate-900">
                            {formatMaintenanceDate(row.date)}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-3 tabular-nums font-mono text-slate-700">{row.time}</td>
                          <td className="px-3.5 py-3">
                            <div className="font-semibold text-slate-900">{row.title}</div>
                            {row.note && <div className="mt-0.5 text-xs text-slate-500">{row.note}</div>}
                          </td>
                          <td className="px-3.5 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${maintTypeStyle[row.type]}`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="px-3.5 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${maintStatusStyle[row.status]}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-3 font-mono text-slate-700 tabular-nums">{row.durationMin} phút</td>
                          <td className="px-3.5 py-3 text-xs sm:text-sm text-slate-700">{row.assignees.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-xs sm:text-sm text-slate-500">
                  Chưa có lịch sử bảo trì cho máy này.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Đóng
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
          >
            Chỉnh sửa
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MachineList() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [plant, setPlant] = useState("Tất cả nhà máy");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Machine | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "history">("info");

  const plants = useMemo(
    () => ["Tất cả nhà máy", ...Array.from(new Set(seedMachines.map((m) => m.plant)))],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return seedMachines.filter((m) => {
      const matchQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q);
      const matchStatus = status === "Tất cả trạng thái" || m.status === status;
      const matchPlant = plant === "Tất cả nhà máy" || m.plant === plant;
      return matchQ && matchStatus && matchPlant;
    });
  }, [query, status, plant]);

  const running = seedMachines.filter((m) => m.status === "Hoạt động").length;
  const maint = seedMachines.filter((m) => m.status === "Bảo trì").length;

  function openDetail(m: Machine, tab: "info" | "history" = "info") {
    setActiveId(m.id);
    setDetailTab(tab);
    setDetail(m);
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{seedMachines.length}</strong> máy
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{running}</strong> hoạt động · <span className="font-medium text-amber-700 font-mono tabular-nums">{maint}</span> bảo trì
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
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
            placeholder="Tìm mã máy, tên máy, model..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <select
            value={plant}
            onChange={(e) => setPlant(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {plants.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {["Tất cả trạng thái", "Hoạt động", "Bảo trì", "Ngừng", "Hỏng"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <ul className="divide-y divide-slate-100">
          {filtered.map((m) => {
            const selected = activeId === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => openDetail(m)}
                  className={`group relative flex w-full cursor-pointer items-start gap-3.5 px-4 py-3.5 text-left transition-colors duration-150 ${
                    selected ? "bg-blue-50/70" : "hover:bg-slate-50/80"
                  }`}
                >
                  {selected && (
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[#0047AB]">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  )}

                  <div className="relative h-[76px] w-[130px] sm:h-[80px] sm:w-[144px] flex-none overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-2xs">
                    <Image src={m.image} alt={m.name} fill className="object-cover" sizes="144px" />
                    <span className="absolute bottom-1 right-1 rounded bg-slate-900/85 px-1.5 py-0.5 text-[9px] font-bold font-mono text-white tracking-wide">
                      {m.code}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="line-clamp-2 text-xs sm:text-sm font-semibold leading-snug text-slate-900">
                      {m.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      <strong className="text-slate-700 font-semibold">{m.model}</strong> · {m.plant} · <span className="font-mono tabular-nums">{m.weldCount.toLocaleString("vi-VN")}</span> mối hàn
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[m.status]}`}
                      >
                        {m.status}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          m.available ? "bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs" : "bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs"
                        }`}
                      >
                        {m.available ? "Khả dụng" : "Không khả dụng"}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-xs sm:text-sm text-slate-500">Không tìm thấy máy phù hợp.</li>
          )}
        </ul>
      </div>

      {detail && (
        <MachineDetailModal
          machine={detail}
          initialTab={detailTab}
          onClose={() => { setDetail(null); setActiveId(null); }}
        />
      )}
    </main>
  );
}
