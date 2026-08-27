"use client";

import { useMemo, useState } from "react";
import CertificateFormModal, { formatViDate, type CertificateFormValues } from "@/components/CertificateFormModal";
import CertificateThumbnail from "@/components/CertificateThumbnail";
import { certificates as seedCertificates, type Certificate } from "@/data/certificates";

const statusStyle: Record<Certificate["status"], string> = {
  "Còn hiệu lực": "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
  "Sắp hết hạn": "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]",
  "Hết hạn": "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]",
};

export default function CertificateManagement() {
  const [items, setItems] = useState<Certificate[]>(seedCertificates);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [activeId, setActiveId] = useState(seedCertificates[0]?.id ?? "");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      const matchQ =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.holder.toLowerCase().includes(q);
      const matchStatus = status === "Tất cả trạng thái" || c.status === status;
      return matchQ && matchStatus;
    });
  }, [query, status, items]);

  const active = filtered.find((c) => c.id === activeId) ?? filtered[0];
  const validCount = items.filter((c) => c.status === "Còn hiệu lực").length;
  const expiring = items.filter((c) => c.status === "Sắp hết hạn").length;
  const expired = items.filter((c) => c.status === "Hết hạn").length;

  function handleAdd(values: CertificateFormValues) {
    const cert: Certificate = {
      id: String(Date.now()),
      title: values.title.trim(),
      holder: values.holder.trim(),
      issuedAt: formatViDate(values.issuedAt),
      expiresAt: formatViDate(values.expiresAt),
      status: values.status,
      imageKey: values.imageUrl ? "default" : values.imageKey,
      imageUrl: values.imageUrl || undefined,
    };
    setItems((prev) => [cert, ...prev]);
    setActiveId(cert.id);
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-[12.5px] sm:text-[13px] text-[#475569]">
        <span>
          <strong className="font-semibold text-[#0f172a]">{items.length}</strong> chứng chỉ
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          <strong className="font-semibold text-[#15803d]">{validCount}</strong> còn hiệu lực · <span className="font-medium text-[#b45309]">{expiring}</span> sắp hết hạn · <span className="font-medium text-[#b91c1c]">{expired}</span> hết hạn
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
            placeholder="Tìm chứng chỉ, người sở hữu..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white pl-9 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-all duration-150"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] text-[#334155] shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15 hover:border-[#cbd5e1] transition-colors duration-150 cursor-pointer"
          >
            {["Tất cả trạng thái", "Còn hiệu lực", "Sắp hết hạn", "Hết hạn"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white shadow-xs hover:bg-[#00388a] active:bg-[#002d6e] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/25 transition-all duration-150 cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Thêm mới
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-xs">
        <ul className="divide-y divide-[#f1f5f9]">
          {filtered.map((cert) => {
            const selected = active?.id === cert.id;
            return (
              <li key={cert.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(cert.id);
                    setMenuOpen(null);
                  }}
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

                  <div className="relative ml-2.5 h-[80px] w-[130px] sm:h-[88px] sm:w-[140px] flex-none overflow-hidden rounded-lg border border-[#d9e2f1] bg-[#f8fafc] shadow-2xs">
                    <CertificateThumbnail cert={cert} />
                    <span className="absolute bottom-1 right-1 rounded bg-[#071633]/85 px-1.5 py-0.5 text-[9px] font-bold font-mono text-white tracking-wide">
                      {cert.expiresAt}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="line-clamp-2 text-[13.5px] sm:text-[14px] font-semibold leading-snug text-[#0f172a]">
                      {cert.title}
                    </div>
                    <div className="mt-1 text-[12px] text-[#64748b]">
                      <strong className="text-[#334155] font-semibold">{cert.holder}</strong> · Cấp {cert.issuedAt} · Hết hạn {cert.expiresAt}
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${statusStyle[cert.status]}`}
                      >
                        {cert.status}
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
                      onClick={() => setMenuOpen(menuOpen === cert.id ? null : cert.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setMenuOpen(menuOpen === cert.id ? null : cert.id);
                        }
                      }}
                      className={`rounded-lg p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors duration-150 cursor-pointer ${
                        selected || menuOpen === cert.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      aria-label="Tùy chọn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </span>
                    {menuOpen === cert.id && (
                      <div className="absolute right-0 top-8 z-30 w-40 rounded-xl border border-[#e2e8f0] bg-white py-1.5 shadow-[0_10px_25px_rgba(7,22,51,0.12)] animate-in fade-in-50 zoom-in-95 duration-100">
                        <div className="px-3.5 py-2 text-[12.5px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0047AB] cursor-pointer transition-colors">Xem chứng chỉ</div>
                        <div className="px-3.5 py-2 text-[12.5px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0047AB] cursor-pointer transition-colors">Tải file</div>
                        <div className="px-3.5 py-2 text-[12.5px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:text-[#0047AB] cursor-pointer transition-colors">Gia hạn</div>
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-[13px] text-[#64748b]">Không tìm thấy chứng chỉ phù hợp.</li>
          )}
        </ul>
      </div>

      <CertificateFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleAdd} />
    </main>
  );
}
