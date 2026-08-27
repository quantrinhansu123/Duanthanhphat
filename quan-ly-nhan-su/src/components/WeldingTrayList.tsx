"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { weldingTrays, type WeldingTray } from "@/data/welding-trays";

const statusStyle: Record<WeldingTray["status"], string> = {
  "Sẵn sàng": "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
  "Đang dùng": "bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]",
  "Bảo trì": "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]",
  Hỏng: "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-b border-[#f1f5f9] py-2.5 text-[13px] last:border-b-0">
      <div className="font-medium text-[#64748b]">{label}</div>
      <div className="text-[#0f172a] font-semibold">{value}</div>
    </div>
  );
}

function TrayDetailModal({ tray, onClose }: { tray: WeldingTray; onClose: () => void }) {
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
        className="fixed inset-0 bg-[#071633]/60 backdrop-blur-xs transition-opacity duration-200"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tray-detail-title"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-[#d9e2f1] bg-white shadow-[0_24px_60px_rgba(7,22,51,0.24)] animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#e8eef8] px-5 sm:px-6 py-4 bg-white">
          <div className="min-w-0">
            <div className="text-[11px] font-bold font-mono uppercase tracking-wider text-[#0047AB]">{tray.code}</div>
            <h2 id="tray-detail-title" className="mt-0.5 text-[17px] sm:text-[18px] font-bold text-[#0f172a]">
              {tray.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors duration-150 cursor-pointer"
            aria-label="Đóng"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-xl bg-[#e2e8f0] border border-[#d9e2f1] shadow-2xs">
            <Image src={tray.image} alt={tray.name} fill className="object-cover" sizes="680px" />
          </div>

          <div className="mb-4">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle[tray.status]}`}>
              {tray.status}
            </span>
          </div>

          <div className="divide-y divide-[#f1f5f9] rounded-xl border border-[#d9e2f1] bg-white px-4 py-1">
            <DetailRow label="Mã khay" value={<span className="font-mono text-[#0047AB]">{tray.code}</span>} />
            <DetailRow label="Máy gắn kèm" value={tray.machine} />
            <DetailRow label="Vị trí" value={tray.location} />
            <DetailRow label="Sức chứa" value={tray.capacity} />
            <DetailRow label="Loại ray" value={tray.railTypes} />
            <DetailRow label="Người phụ trách" value={tray.assignedTo} />
            <DetailRow label="Bảo trì gần nhất" value={<span className="font-mono">{tray.lastMaintenance}</span>} />
            <DetailRow label="Bảo trì tiếp theo" value={<span className="font-mono">{tray.nextMaintenance}</span>} />
            <DetailRow label="Ghi chú" value={tray.note} />
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-[#e8eef8] px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0f172a] hover:border-[#cbd5e1] active:bg-[#f1f5f9] transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Đóng
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white shadow-xs hover:bg-[#00388a] active:bg-[#002d6e] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/25 transition-all duration-150 cursor-pointer"
          >
            Chỉnh sửa
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WeldingTrayList() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [activeId, setActiveId] = useState(weldingTrays[0]?.id ?? "");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<WeldingTray | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return weldingTrays.filter((t) => {
      const matchQ =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.machine.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q);
      const matchStatus = status === "Tất cả trạng thái" || t.status === status;
      return matchQ && matchStatus;
    });
  }, [query, status]);

  const active = filtered.find((t) => t.id === activeId) ?? filtered[0];

  function openDetail(t: WeldingTray) {
    setActiveId(t.id);
    setMenuOpen(null);
    setDetail(t);
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-[12.5px] sm:text-[13px] text-[#475569]">
        <span>
          <strong className="font-semibold text-[#0f172a]">{weldingTrays.length}</strong> khay hàn
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="font-semibold text-[#15803d]">
            {weldingTrays.filter((t) => t.status === "Sẵn sàng").length}
          </strong>{" "}
          sẵn sàng · <span className="font-medium text-[#0047AB]">{weldingTrays.filter((t) => t.status === "Đang dùng").length}</span> đang dùng
        </span>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
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
            placeholder="Tìm mã khay, tên, máy, vị trí..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
        >
          {["Tất cả trạng thái", "Sẵn sàng", "Đang dùng", "Bảo trì", "Hỏng"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-xs">
        <ul className="divide-y divide-[#f1f5f9]">
          {filtered.map((t) => {
            const selected = active?.id === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => openDetail(t)}
                  className={`group relative flex w-full cursor-pointer items-start gap-3.5 px-4 py-3.5 text-left transition-colors duration-150 ${
                    selected ? "bg-[#eff6ff]/70" : "hover:bg-[#f8fafc]"
                  }`}
                >
                  {selected && (
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[#0047AB]">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  )}

                  <div className="relative ml-2.5 h-[72px] w-[128px] flex-none overflow-hidden rounded-lg bg-[#e2e8f0] border border-[#d9e2f1] shadow-2xs">
                    <Image src={t.image} alt={t.name} fill className="object-cover" sizes="128px" />
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-[#071633]/85 px-1.5 py-0.5 text-[9.5px] font-bold font-mono text-white tracking-wide">
                      {t.code}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="line-clamp-2 text-[13.5px] sm:text-[14px] font-semibold leading-snug text-[#0f172a]">
                      {t.name}
                    </div>
                    <div className="mt-1 text-[12px] text-[#64748b]">
                      Máy <strong className="text-[#334155] font-semibold">{t.machine}</strong> · {t.location} · {t.capacity}
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${statusStyle[t.status]}`}
                      >
                        {t.status}
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
                      onClick={() => setMenuOpen(menuOpen === t.id ? null : t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setMenuOpen(menuOpen === t.id ? null : t.id);
                        }
                      }}
                      className={`rounded-lg p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors duration-150 cursor-pointer ${
                        selected || menuOpen === t.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      aria-label="Tùy chọn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </span>
                    {menuOpen === t.id && (
                      <div className="absolute right-0 top-8 z-30 w-40 rounded-xl border border-[#e2e8f0] bg-white py-1.5 shadow-[0_10px_25px_rgba(7,22,51,0.12)] animate-in fade-in-50 zoom-in-95 duration-100">
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2 text-left text-[12.5px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0047AB] cursor-pointer transition-colors"
                          onClick={() => openDetail(t)}
                        >
                          Xem chi tiết
                        </button>
                        <div className="px-3.5 py-2 text-[12.5px] font-medium text-[#334155] hover:bg-[#f8fafc] cursor-pointer transition-colors">Gán máy</div>
                        <div className="px-3.5 py-2 text-[12.5px] font-medium text-[#334155] hover:bg-[#f8fafc] cursor-pointer transition-colors">Bảo trì</div>
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-[13px] text-[#64748b]">Không tìm thấy khay hàn.</li>
          )}
        </ul>
      </div>

      {detail && <TrayDetailModal tray={detail} onClose={() => setDetail(null)} />}
    </main>
  );
}
