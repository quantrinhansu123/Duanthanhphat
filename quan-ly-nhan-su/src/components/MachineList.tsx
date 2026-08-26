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
  "Hoạt động": "bg-[#22a94f] text-white",
  "Bảo trì": "bg-[#f59e0b] text-white",
  Ngừng: "bg-[#94a3b8] text-white",
  Hỏng: "bg-[#ef4444] text-white",
};

const maintTypeStyle: Record<MachineMaintenanceHistoryRow["type"], string> = {
  "Bảo dưỡng": "bg-[#eef4ff] text-[#0047AB]",
  "Sửa chữa": "bg-[#fef2f2] text-[#dc2626]",
  "Kiểm định": "bg-[#e7f7ed] text-[#15803d]",
  "Thay phụ tùng": "bg-[#fff4dd] text-[#b45309]",
};

const maintStatusStyle: Record<MachineMaintenanceHistoryRow["status"], string> = {
  "Đã xong": "bg-[#e7f7ed] text-[#15803d]",
  "Đang làm": "bg-[#eef4ff] text-[#0047AB]",
  "Chờ xác nhận": "bg-[#fef3c7] text-[#b45309]",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-b border-[#f1f5f9] py-2.5 text-[13px] last:border-b-0">
      <div className="font-medium text-[#64748b]">{label}</div>
      <div className="text-[#0f172a]">{value}</div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-[#0f172a]/45" aria-label="Đóng" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="machine-detail-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e8eef8] px-5 py-4">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-[#0047AB]">{machine.code}</div>
            <h2 id="machine-detail-title" className="mt-0.5 text-[18px] font-bold text-[#0f172a]">
              {machine.name}
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

        {showHistoryTab && (
          <div className="flex gap-1 border-b border-[#e8eef8] px-5 pt-1">
            <button
              type="button"
              onClick={() => setTab("info")}
              className={`border-b-2 px-3 py-2.5 text-[13px] font-semibold transition ${
                tab === "info"
                  ? "border-[#0047AB] text-[#0047AB]"
                  : "border-transparent text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              Thông tin
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={`border-b-2 px-3 py-2.5 text-[13px] font-semibold transition ${
                tab === "history"
                  ? "border-[#0047AB] text-[#0047AB]"
                  : "border-transparent text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              Lịch sử bảo trì
              {history.length > 0 && (
                <span className="ml-1.5 rounded-full bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-bold text-[#0047AB]">
                  {history.length}
                </span>
              )}
            </button>
          </div>
        )}

        <div className="overflow-y-auto px-5 py-4">
          {tab === "info" || !showHistoryTab ? (
            <>
              <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-xl bg-[#e2e8f0]">
                <Image src={machine.image} alt={machine.name} fill className="object-cover" sizes="780px" />
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[machine.status]}`}>
                  {machine.status}
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    machine.available ? "bg-[#e8eef8] text-[#0047AB]" : "bg-[#f1f5f9] text-[#64748b]"
                  }`}
                >
                  {machine.available ? "Khả dụng" : "Không khả dụng"}
                </span>
              </div>

              <DetailRow label="Mã máy" value={machine.code} />
              <DetailRow label="Model" value={machine.model} />
              <DetailRow label="Nhà máy" value={machine.plant} />
              <DetailRow label="Số serial" value={machine.serialNumber} />
              <DetailRow label="Năm lắp đặt" value={machine.yearInstalled} />
              <DetailRow label="Tổ đội" value={machine.team} />
              <DetailRow label="Thợ vận hành" value={machine.operator} />
              <DetailRow label="Số mối hàn" value={machine.weldCount.toLocaleString("vi-VN")} />
              <DetailRow label="Giờ vận hành" value={`${machine.operatingHours.toLocaleString("vi-VN")} giờ`} />
              <DetailRow label="Tỷ lệ lỗi" value={machine.errorRate} />
              <DetailRow label="Bảo trì gần nhất" value={machine.lastMaintenance} />
              <DetailRow label="Bảo trì tiếp theo" value={machine.nextMaintenance} />
              <DetailRow label="Ghi chú" value={machine.note} />
            </>
          ) : (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[13px] text-[#64748b]">
                  <strong className="text-[#0f172a]">{history.length}</strong> lần bảo trì · sắp xếp mới nhất trước
                </div>
              </div>

              {history.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-[#d9e2f1]">
                  <table className="w-full min-w-[680px] border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#eef1f5] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                        <th className="px-3 py-2.5">Ngày</th>
                        <th className="px-3 py-2.5">Giờ</th>
                        <th className="min-w-[200px] px-3 py-2.5">Công việc</th>
                        <th className="px-3 py-2.5">Loại</th>
                        <th className="px-3 py-2.5">Trạng thái</th>
                        <th className="px-3 py-2.5">Thời lượng</th>
                        <th className="min-w-[160px] px-3 py-2.5">Nhân sự</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={row.id} className="border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#f8fafc]">
                          <td className="whitespace-nowrap px-3 py-3 font-medium text-[#0f172a]">
                            {formatMaintenanceDate(row.date)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-[#334155]">{row.time}</td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-[#0f172a]">{row.title}</div>
                            {row.note && <div className="mt-0.5 text-[11px] text-[#64748b]">{row.note}</div>}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${maintTypeStyle[row.type]}`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${maintStatusStyle[row.status]}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-[#334155]">{row.durationMin} phút</td>
                          <td className="px-3 py-3 text-[12px] text-[#334155]">{row.assignees.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[#d9e2f1] px-4 py-10 text-center text-[13px] text-[#64748b]">
                  Chưa có lịch sử bảo trì cho máy này.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#e8eef8] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Đóng
          </button>
          <button
            type="button"
            className="h-10 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987]"
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
  const [activeId, setActiveId] = useState(seedMachines[0]?.id ?? "");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
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

  const active = filtered.find((m) => m.id === activeId) ?? filtered[0];
  const running = seedMachines.filter((m) => m.status === "Hoạt động").length;
  const maint = seedMachines.filter((m) => m.status === "Bảo trì").length;

  function openDetail(m: Machine, tab: "info" | "history" = "info") {
    setActiveId(m.id);
    setMenuOpen(null);
    setDetailTab(tab);
    setDetail(m);
  }

  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#475569]">
        <span>
          <strong className="text-[#0f172a]">{seedMachines.length}</strong> máy
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#0f172a]">{running}</strong> hoạt động · {maint} bảo trì
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
            placeholder="Tìm mã máy, tên máy, model..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>
        <select
          value={plant}
          onChange={(e) => setPlant(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {plants.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {["Tất cả trạng thái", "Hoạt động", "Bảo trì", "Ngừng", "Hỏng"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <ul className="divide-y divide-[#f1f5f9]">
          {filtered.map((m) => {
            const selected = active?.id === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => openDetail(m)}
                  className={`group relative flex w-full cursor-pointer items-start gap-3 px-3 py-2.5 text-left transition ${
                    selected ? "bg-[#eef2f7]" : "hover:bg-[#f8fafc]"
                  }`}
                >
                  {selected && (
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[#64748b]">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  )}

                  <div className="relative ml-3 h-[80px] w-[144px] flex-none overflow-hidden rounded-lg border border-[#dbe4f3] bg-[#e2e8f0]">
                    <Image src={m.image} alt={m.name} fill className="object-cover" sizes="144px" />
                    <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      {m.code}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="line-clamp-2 text-[14px] font-semibold leading-snug text-[#0f172a]">
                      {m.name}
                    </div>
                    <div className="mt-1 text-[12px] text-[#64748b]">
                      {m.model} · {m.plant} · {m.weldCount.toLocaleString("vi-VN")} mối hàn
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyle[m.status]}`}
                      >
                        {m.status}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          m.available ? "bg-[#e8eef8] text-[#0047AB]" : "bg-[#f1f5f9] text-[#64748b]"
                        }`}
                      >
                        {m.available ? "Khả dụng" : "Không khả dụng"}
                      </span>
                    </div>
                  </div>

                  <div
                    className="relative flex-none"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setMenuOpen(menuOpen === m.id ? null : m.id);
                        }
                      }}
                      className={`rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0] ${
                        selected || menuOpen === m.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      aria-label="Tùy chọn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </span>
                    {menuOpen === m.id && (
                      <div className="absolute right-0 top-8 z-10 w-40 rounded-lg border border-[#e2e8f0] bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#f8fafc]"
                          onClick={() => openDetail(m)}
                        >
                          Xem chi tiết
                        </button>
                        {m.model === "K920" && (
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#f8fafc]"
                            onClick={() => openDetail(m, "history")}
                          >
                            Lịch sử bảo trì
                          </button>
                        )}
                        <div className="px-3 py-2 text-[12px] text-[#334155] hover:bg-[#f8fafc]">Phân công</div>
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-[13px] text-[#64748b]">Không tìm thấy máy phù hợp.</li>
          )}
        </ul>
      </div>

      {detail && (
        <MachineDetailModal
          machine={detail}
          initialTab={detailTab}
          onClose={() => setDetail(null)}
        />
      )}
    </main>
  );
}
