"use client";

import { useEffect, useMemo, useState } from "react";
import CertificateFormModal, {
  type CertificateFormValues,
} from "@/components/CertificateFormModal";
import CertificateThumbnail from "@/components/CertificateThumbnail";
import { certificates as seedCertificates, type Certificate } from "@/data/certificates";

const statusStyle: Record<Certificate["status"], string> = {
  "Còn hiệu lực": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Sắp hết hạn": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  "Hết hạn": "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
};

function CertificateDetailModal({
  cert,
  onClose,
}: {
  cert: Certificate;
  onClose: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

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
        aria-labelledby="cert-detail-title"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 sm:px-6 py-4 bg-white">
          <div className="min-w-0 pr-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">Chứng chỉ · Hạn {cert.expiresAt}</div>
            <h2 id="cert-detail-title" className="mt-0.5 text-base sm:text-lg font-bold leading-snug text-slate-900">
              {cert.title}
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
                  <div className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors">Xem ảnh gốc</div>
                  <div className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors">Chỉnh sửa</div>
                  <div className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors">Gia hạn</div>
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

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          <div className="relative mb-5 aspect-[16/10] overflow-hidden rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
            <CertificateThumbnail cert={cert} />
          </div>

          <div className="mb-4">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[cert.status]}`}
            >
              {cert.status}
            </span>
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4 py-1">
            <div className="flex items-center justify-between py-2.5 text-xs sm:text-sm">
              <span className="text-slate-500">Người sở hữu</span>
              <span className="font-semibold text-slate-900">{cert.holder}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 text-xs sm:text-sm">
              <span className="text-slate-500">Tên chứng chỉ</span>
              <span className="font-semibold text-slate-900">{cert.title}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 text-xs sm:text-sm">
              <span className="text-slate-500">Ngày cấp</span>
              <span className="font-mono font-semibold text-slate-800">{cert.issuedAt}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 text-xs sm:text-sm">
              <span className="text-slate-500">Ngày hết hạn</span>
              <span className="font-mono font-semibold text-slate-800">{cert.expiresAt}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 text-xs sm:text-sm">
              <span className="text-slate-500">Trạng thái</span>
              <span className="font-semibold text-slate-800">{cert.status}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CertificateManagement() {
  const [items, setItems] = useState<Certificate[]>(seedCertificates);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Certificate | null>(null);
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

  function openDetail(cert: Certificate) {
    setActiveId(cert.id);
    setDetail(cert);
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{items.length}</strong> chứng chỉ
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-emerald-700 font-mono tabular-nums">{validCount}</strong> hiệu lực · <span className="font-medium text-amber-700 font-mono tabular-nums">{expiring}</span> sắp hết hạn · <span className="font-medium text-rose-700 font-mono tabular-nums">{expired}</span> hết hạn
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
            placeholder="Tìm theo tên chứng chỉ, nhân viên..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 hover:text-slate-900 transition-all duration-150 cursor-pointer"
          >
            {["Tất cả trạng thái", "Còn hiệu lực", "Sắp hết hạn", "Hết hạn"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Thêm mới
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <ul className="divide-y divide-slate-100">
          {filtered.map((cert) => {
            const selected = activeId === cert.id;
            return (
              <li key={cert.id}>
                <button
                  type="button"
                  onClick={() => openDetail(cert)}
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

                  <div className="relative h-[80px] w-[130px] sm:h-[88px] sm:w-[140px] flex-none overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-2xs">
                    <CertificateThumbnail cert={cert} />
                    <span className="absolute bottom-1 right-1 rounded bg-slate-900/85 px-1.5 py-0.5 text-[9px] font-bold font-mono text-white tracking-wide">
                      {cert.expiresAt}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="line-clamp-2 text-xs sm:text-sm font-semibold leading-snug text-slate-900">
                      {cert.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      <strong className="text-slate-700 font-semibold">{cert.holder}</strong> · Cấp {cert.issuedAt} · Hết hạn {cert.expiresAt}
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[cert.status]}`}
                      >
                        {cert.status}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-xs sm:text-sm text-slate-500">Không tìm thấy chứng chỉ phù hợp.</li>
          )}
        </ul>
      </div>

      {detail && (
        <CertificateDetailModal
          cert={detail}
          onClose={() => {
            setDetail(null);
            setActiveId(null);
          }}
        />
      )}

      <CertificateFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleAdd}
      />
    </main>
  );
}

function formatViDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
