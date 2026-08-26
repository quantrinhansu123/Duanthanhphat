"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { weldingTrays, type WeldingTray } from "@/data/welding-trays";

const statusStyle: Record<WeldingTray["status"], string> = {
  "Sẵn sàng": "bg-[#22a94f] text-white",
  "Đang dùng": "bg-[#0047AB] text-white",
  "Bảo trì": "bg-[#f59e0b] text-white",
  Hỏng: "bg-[#ef4444] text-white",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-b border-[#f1f5f9] py-2.5 text-[13px] last:border-b-0">
      <div className="font-medium text-[#64748b]">{label}</div>
      <div className="text-[#0f172a]">{value}</div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-[#0f172a]/45" aria-label="Đóng" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tray-detail-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e8eef8] px-5 py-4">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-[#0047AB]">{tray.code}</div>
            <h2 id="tray-detail-title" className="mt-0.5 text-[18px] font-bold text-[#0f172a]">
              {tray.name}
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

        <div className="overflow-y-auto px-5 py-4">
          <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-xl bg-[#e2e8f0]">
            <Image src={tray.image} alt={tray.name} fill className="object-cover" sizes="680px" />
          </div>

          <div className="mb-3">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[tray.status]}`}>
              {tray.status}
            </span>
          </div>

          <DetailRow label="Mã khay" value={tray.code} />
          <DetailRow label="Máy gắn kèm" value={tray.machine} />
          <DetailRow label="Vị trí" value={tray.location} />
          <DetailRow label="Sức chứa" value={tray.capacity} />
          <DetailRow label="Loại ray" value={tray.railTypes} />
          <DetailRow label="Người phụ trách" value={tray.assignedTo} />
          <DetailRow label="Bảo trì gần nhất" value={tray.lastMaintenance} />
          <DetailRow label="Bảo trì tiếp theo" value={tray.nextMaintenance} />
          <DetailRow label="Ghi chú" value={tray.note} />
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
    <main className="mx-auto max-w-[1400px] px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#475569]">
        <span>
          <strong className="text-[#0f172a]">{weldingTrays.length}</strong> khay hàn
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="text-[#0f172a]">
            {weldingTrays.filter((t) => t.status === "Sẵn sàng").length}
          </strong>{" "}
          sẵn sàng · {weldingTrays.filter((t) => t.status === "Đang dùng").length} đang dùng
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
            placeholder="Tìm mã khay, tên, máy, vị trí..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155]"
        >
          {["Tất cả trạng thái", "Sẵn sàng", "Đang dùng", "Bảo trì", "Hỏng"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <ul className="divide-y divide-[#f1f5f9]">
          {filtered.map((t) => {
            const selected = active?.id === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => openDetail(t)}
                  className={`group relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition ${
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

                  <div className="relative ml-3 h-[72px] w-[128px] flex-none overflow-hidden rounded-lg bg-[#e2e8f0]">
                    <Image src={t.image} alt={t.name} fill className="object-cover" sizes="128px" />
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {t.code}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="line-clamp-2 text-[14px] font-semibold leading-snug text-[#0f172a]">
                      {t.name}
                    </div>
                    <div className="mt-1 text-[12px] text-[#64748b]">
                      Máy {t.machine} · {t.location} · {t.capacity}
                    </div>
                    <div className="mt-1.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyle[t.status]}`}
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
                      className={`rounded-full p-1.5 text-[#64748b] hover:bg-[#e2e8f0] ${
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
                      <div className="absolute right-0 top-8 z-10 w-40 rounded-lg border border-[#e2e8f0] bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#f8fafc]"
                          onClick={() => openDetail(t)}
                        >
                          Xem chi tiết
                        </button>
                        <div className="px-3 py-2 text-[12px] text-[#334155] hover:bg-[#f8fafc]">Gán máy</div>
                        <div className="px-3 py-2 text-[12px] text-[#334155] hover:bg-[#f8fafc]">Bảo trì</div>
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-[13px] text-[#64748b]">Không tìm thấy khay hàn.</li>
          )}
        </ul>
      </div>

      {detail && <TrayDetailModal tray={detail} onClose={() => setDetail(null)} />}
    </main>
  );
}
