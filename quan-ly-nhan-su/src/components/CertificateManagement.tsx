"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CertificateFormModal, {
  type CertificateFormValues,
} from "@/components/CertificateFormModal";
import CertificateThumbnail, { resolveCertificateImageUrl } from "@/components/CertificateThumbnail";
import type { Certificate } from "@/data/certificates";
import DateField from "@/components/DateField";
import { ArrowSquareOut, Check, DotsThree, DownloadSimple, MagnifyingGlass, PencilSimple, Plus, X } from "@/components/icons";
import {
  createPersonnelCertificates,
  deleteCertificateRecord,
  isCertificateAssetReferenced,
  loadCertificateRegistry,
  revokeCertificateRecord,
  syncGroupCertificates,
  updateCertificateRecord,
  updateGroupExpiry,
  type CertificatePersonnelOption,
} from "@/lib/certificatesDb";
import { deleteCloudinaryAsset } from "@/lib/cloudinaryClient";

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const statusStyle: Record<Certificate["status"], string> = {
  "Còn hiệu lực": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Sắp hết hạn": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  "Hết hạn": "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  "Thu hồi": "bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs",
  "Chưa cập nhật": "bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs",
};

function BatchExpiryModal({
  cert,
  allCount,
  onClose,
  onSubmit,
}: {
  cert: Certificate;
  allCount: number;
  onClose: () => void;
  onSubmit: (expiresAt: string, updateAll: boolean) => void;
}) {
  const [newExpiry, setNewExpiry] = useState("");
  const [updateAll, setUpdateAll] = useState(true);
  const [error, setError] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <button type="button" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl animate-in fade-in-50 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900">Gia hạn / Cập nhật ngày hết hạn</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-3.5 text-xs sm:text-sm">
          <div>
            <div className="text-slate-500">Chứng chỉ:</div>
            <div className="font-semibold text-slate-900">{cert.title}</div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Ngày hết hạn mới *</label>
            <DateField value={newExpiry} onChange={setNewExpiry} />
          </div>

          {allCount > 1 && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateAll}
                  onChange={(e) => setUpdateAll(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-[#0047AB]"
                />
                <span className="text-xs text-slate-700 leading-relaxed">
                  Áp dụng ngày hết hạn này cho <strong>toàn bộ {allCount} nhân sự</strong> đang sở hữu chứng chỉ &quot;{cert.title}&quot;
                </span>
              </label>
            </div>
          )}

          {error && <div className="text-xs text-rose-600 font-semibold">{error}</div>}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => {
              if (!newExpiry) {
                setError("Vui lòng chọn ngày hết hạn mới.");
                return;
              }
              onSubmit(newExpiry, updateAll);
            }}
            className="rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 py-1.5 text-xs font-semibold text-white shadow-xs"
          >
            Lưu hạn mới
          </button>
        </div>
      </div>
    </div>
  );
}

function CertificateDetailModal({
  cert,
  sameTitleCount,
  onClose,
  onEdit,
  onExtend,
  onRevoke,
  onDelete,
}: {
  cert: Certificate;
  sameTitleCount: number;
  onClose: () => void;
  onEdit: () => void;
  onExtend: () => void;
  onRevoke: () => void;
  onDelete: () => void;
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
                <DotsThree size={16} weight="bold" aria-hidden />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100 text-left">
                  {cert.imageUrl && (
                    <div
                      onClick={() => {
                        window.open(cert.imageUrl, "_blank", "noopener,noreferrer");
                        setMenuOpen(false);
                      }}
                      className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                    >
                      Xem ảnh gốc
                    </div>
                  )}
                  <div
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit();
                    }}
                    className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                  >
                    Chỉnh sửa thông tin
                  </div>
                  <div
                    onClick={() => {
                      setMenuOpen(false);
                      onExtend();
                    }}
                    className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0047AB] cursor-pointer transition-colors"
                  >
                    Gia hạn / Cập nhật hạn
                  </div>
                  <div
                    onClick={() => {
                      setMenuOpen(false);
                      onRevoke();
                    }}
                    className="px-3.5 py-2 text-xs sm:text-sm font-medium text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors"
                  >
                    Thu hồi chứng chỉ
                  </div>
                  <div
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="px-3.5 py-2 text-xs sm:text-sm font-medium text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors"
                  >
                    Xóa chứng chỉ
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 cursor-pointer"
              aria-label="Đóng"
            >
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          <div className="relative mb-5 aspect-[16/10] overflow-hidden rounded-xl bg-slate-50 border border-slate-200 shadow-2xs group">
            <CertificateThumbnail cert={cert} />
            <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/25 transition-colors flex items-end justify-end gap-2 p-3">
              <a
                href={resolveCertificateImageUrl(cert)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-800 px-3 py-1.5 text-xs font-semibold shadow-md border border-slate-200/80 transition-all cursor-pointer backdrop-blur-xs"
                title="Mở ảnh kích thước đầy đủ trong tab mới"
              >
                <ArrowSquareOut size={14} weight="bold" />
                Xem ảnh gốc
              </a>
              <a
                href={resolveCertificateImageUrl(cert)}
                download={`Chung_chi_${cert.title.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0047AB]/90 hover:bg-[#0047AB] text-white px-3 py-1.5 text-xs font-semibold shadow-md transition-all cursor-pointer backdrop-blur-xs"
                title="Tải ảnh chứng chỉ về máy"
              >
                <DownloadSimple size={14} weight="bold" />
                Tải ảnh
              </a>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[cert.status]}`}
            >
              {cert.status}
            </span>
            {sameTitleCount > 1 && (
              <span className="text-xs text-slate-500">
                Có <strong>{sameTitleCount}</strong> người sở hữu loại chứng chỉ này
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4 py-1">
            <div className="flex items-center justify-between py-2.5 text-xs sm:text-sm">
              <span className="text-slate-500">Người sở hữu</span>
              <span className="text-right font-semibold text-slate-900">
                <Link href="/ho-so-tho-han" className="hover:text-[#0047AB] hover:underline">
                  {cert.holder}
                </Link>
                {cert.employeeCode && <span className="ml-1.5 font-mono text-xs text-[#0047AB]">{cert.employeeCode}</span>}
              </span>
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
            {cert.organization && (
              <div className="flex items-center justify-between gap-4 py-2.5 text-xs sm:text-sm">
                <span className="text-slate-500">Đơn vị cấp</span>
                <span className="text-right font-semibold text-slate-800">{cert.organization}</span>
              </div>
            )}
            {cert.certificateNumber && (
              <div className="flex items-center justify-between gap-4 py-2.5 text-xs sm:text-sm">
                <span className="text-slate-500">Số chứng chỉ</span>
                <span className="text-right font-mono font-semibold text-slate-800">{cert.certificateNumber}</span>
              </div>
            )}
            {cert.machine && (
              <div className="flex items-center justify-between gap-4 py-2.5 text-xs sm:text-sm">
                <span className="text-slate-500">Máy / phạm vi áp dụng</span>
                <span className="text-right font-semibold text-slate-800">{cert.machine}</span>
              </div>
            )}
            {cert.fileSize && (
              <div className="flex items-center justify-between gap-4 py-2.5 text-xs sm:text-sm">
                <span className="text-slate-500">Dung lượng ảnh</span>
                <span className="text-right font-mono text-slate-800">{formatFileSize(cert.fileSize)}</span>
              </div>
            )}
            {cert.sourceUrl && (
              <div className="flex items-center justify-between gap-4 py-2.5 text-xs sm:text-sm">
                <span className="text-slate-500">Nguồn ảnh</span>
                <a
                  href={cert.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-right text-[#0047AB] hover:underline truncate max-w-[280px]"
                >
                  {cert.sourceUrl}
                </a>
              </div>
            )}
            {cert.license && (
              <div className="flex items-center justify-between gap-4 py-2.5 text-xs sm:text-sm">
                <span className="text-slate-500">Bản quyền / Giấy phép</span>
                <span className="text-right font-medium text-slate-800">{cert.license}</span>
              </div>
            )}
            {cert.notes && (
              <div className="flex items-start justify-between gap-4 py-2.5 text-xs sm:text-sm">
                <span className="shrink-0 text-slate-500">Ghi chú</span>
                <span className="text-right text-slate-800">{cert.notes}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-between items-center border-t border-slate-200 px-5 sm:px-6 py-3.5 bg-white">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
          >
            <PencilSimple size={15} weight="bold" />
            Chỉnh sửa
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CertificateManagement() {
  const [items, setItems] = useState<Certificate[]>([]);
  const [personnel, setPersonnel] = useState<CertificatePersonnelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [detail, setDetail] = useState<Certificate | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<Certificate | null>(null);
  const [extendingCert, setExtendingCert] = useState<Certificate | null>(null);
  const [toast, setToast] = useState("");

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function reloadRegistry() {
    setLoading(true);
    setLoadError("");
    try {
      const registry = await loadCertificateRegistry();
      setItems(registry.certificates);
      setPersonnel(registry.personnel);

      // Kiểm tra URL search params: nếu có certificateId thì tự mở
      const params = new URLSearchParams(window.location.search);
      const targetCertId = params.get("certificateId");
      const targetEmpId = params.get("employeeId");

      if (targetCertId) {
        const found = registry.certificates.find((c) => c.id === targetCertId);
        if (found) setDetail(found);
      } else if (targetEmpId) {
        const found = registry.certificates.find((c) => c.employeeId === targetEmpId);
        if (found) setDetail(found);
      }
    } catch (error) {
      setItems([]);
      setPersonnel([]);
      setLoadError(error instanceof Error ? error.message : "Không tải được chứng chỉ từ Supabase");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadRegistry();
  }, []);

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

  async function handleFormSubmit(values: CertificateFormValues) {
    setSaving(true);
    const previousPublicId = editingCert?.cloudinaryPublicId;
    try {
      if (editingCert?.groupId) {
        // Cập nhật nhóm chứng chỉ: hỗ trợ thêm/bớt người sở hữu và đồng bộ metadata
        await syncGroupCertificates({
          groupId: editingCert.groupId,
          title: values.title,
          employeeIds: values.holderIds,
          issuedAt: values.issuedAt,
          expiresAt: values.expiresAt,
          status: values.status,
          imageUrl: values.imageUrl,
          cloudinaryPublicId: values.cloudinaryPublicId,
          organization: values.organization,
          machine: values.machine,
          certificateNumber: values.certificateNumber,
          notes: values.notes,
          fileSize: values.fileSize,
          sourceUrl: values.sourceUrl,
          license: values.license,
        });
        if (previousPublicId && previousPublicId !== values.cloudinaryPublicId) {
          const stillReferenced = await isCertificateAssetReferenced(previousPublicId);
          if (!stillReferenced) await deleteCloudinaryAsset(previousPublicId);
        }
        showToast("Đã đồng bộ nhóm chứng chỉ và người sở hữu thành công.");
      } else if (values.id) {
        // Cập nhật chứng chỉ hiện có
        await updateCertificateRecord({
          id: values.id,
          title: values.title,
          issuedAt: values.issuedAt,
          expiresAt: values.expiresAt,
          status: values.status,
          imageUrl: values.imageUrl,
          cloudinaryPublicId: values.cloudinaryPublicId,
          organization: values.organization,
          machine: values.machine,
          certificateNumber: values.certificateNumber,
          notes: values.notes,
          fileSize: values.fileSize,
          sourceUrl: values.sourceUrl,
          license: values.license,
        });
        if (previousPublicId && previousPublicId !== values.cloudinaryPublicId) {
          const stillReferenced = await isCertificateAssetReferenced(previousPublicId);
          if (!stillReferenced) await deleteCloudinaryAsset(previousPublicId);
        }
        showToast("Đã cập nhật chứng chỉ thành công.");
      } else {
        // Tạo mới cho 1 hoặc nhiều người
        await createPersonnelCertificates({
          title: values.title,
          employeeIds: values.holderIds,
          issuedAt: values.issuedAt,
          expiresAt: values.expiresAt,
          status: values.status,
          imageUrl: values.imageUrl,
          cloudinaryPublicId: values.cloudinaryPublicId,
          organization: values.organization,
          machine: values.machine,
          certificateNumber: values.certificateNumber,
          notes: values.notes,
          fileSize: values.fileSize,
          sourceUrl: values.sourceUrl,
          license: values.license,
        });
        showToast(`Đã thêm chứng chỉ cho ${values.holderIds.length} nhân sự.`);
      }
      setFormOpen(false);
      setEditingCert(null);
      setDetail(null);
      await reloadRegistry();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi lưu chứng chỉ");
    } finally {
      setSaving(false);
    }
  }

  async function handleBatchExpiry(newDate: string, updateAll: boolean) {
    if (!extendingCert) return;
    try {
      if (updateAll) {
        await updateGroupExpiry(extendingCert.groupId, extendingCert.title, newDate);
        showToast(`Đã cập nhật ngày hết hạn cho toàn bộ nhân sự có chứng chỉ "${extendingCert.title}".`);
      } else {
        await updateCertificateRecord({
          id: extendingCert.id,
          title: extendingCert.title,
          expiresAt: newDate,
          status: extendingCert.status,
        });
        showToast(`Đã cập nhật ngày hết hạn cho ${extendingCert.holder}.`);
      }
      setExtendingCert(null);
      setDetail(null);
      await reloadRegistry();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi cập nhật hạn");
    }
  }

  async function handleRevoke(cert: Certificate) {
    if (!confirm(`Xác nhận thu hồi chứng chỉ "${cert.title}" của ${cert.holder}?`)) return;
    try {
      await revokeCertificateRecord(cert.id);
      showToast(`Đã thu hồi chứng chỉ của ${cert.holder}.`);
      setDetail(null);
      await reloadRegistry();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi thu hồi chứng chỉ");
    }
  }

  async function handleDelete(cert: Certificate) {
    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn chứng chỉ "${cert.title}" của ${cert.holder}?`)) return;
    try {
      await deleteCertificateRecord(cert.id);
      if (cert.cloudinaryPublicId) {
        const stillReferenced = await isCertificateAssetReferenced(cert.cloudinaryPublicId);
        if (!stillReferenced) await deleteCloudinaryAsset(cert.cloudinaryPublicId);
      }
      showToast("Đã xóa chứng chỉ thành công.");
      setDetail(null);
      await reloadRegistry();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi xóa chứng chỉ");
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 pb-8">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-medium text-white shadow-xl">
          <Check size={16} weight="bold" className="text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Thống kê nhanh */}
      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng chứng chỉ</div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-slate-900">{items.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Còn hiệu lực</div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-emerald-700">{validCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-600">Sắp hết hạn (≤ 90 ngày)</div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-amber-700">{expiring}</div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-rose-600">Hết hạn / Thu hồi</div>
          <div className="mt-1.5 text-2xl font-bold font-mono text-rose-700">{expired}</div>
        </div>
      </div>

      {/* Bộ lọc và nút Thêm */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-xs">
        <div className="relative min-w-[220px] flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên chứng chỉ, người sở hữu..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300/90 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-400 focus:outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border border-slate-300/90 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700"
        >
          <option value="Tất cả trạng thái">Tất cả trạng thái</option>
          <option value="Còn hiệu lực">Còn hiệu lực</option>
          <option value="Sắp hết hạn">Sắp hết hạn</option>
          <option value="Hết hạn">Hết hạn</option>
          <option value="Thu hồi">Thu hồi</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setEditingCert(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer"
        >
          <Plus size={16} weight="bold" />
          Thêm chứng chỉ
        </button>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      {/* Grid danh sách chứng chỉ */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Đang tải danh mục chứng chỉ...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
          Không tìm thấy chứng chỉ nào phù hợp.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-md transition-all duration-150"
            >
              <div
                className="relative aspect-[16/10] w-full overflow-hidden bg-slate-50 cursor-pointer"
                onClick={() => setDetail(c)}
              >
                <CertificateThumbnail cert={c} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle[c.status]}`}>
                    {c.status}
                  </span>
                  <span className="font-mono text-xs text-slate-400">{c.expiresAt}</span>
                </div>
                <h4
                  onClick={() => setDetail(c)}
                  className="font-bold text-slate-900 text-sm hover:text-[#0047AB] cursor-pointer line-clamp-2"
                >
                  {c.title}
                </h4>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Sở hữu:</span>
                  <strong className="text-slate-800">{c.holder}</strong>
                </div>

                <div className="mt-3 flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setDetail(c)}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 py-1.5 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                  >
                    Chi tiết
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCert(c);
                      setFormOpen(true);
                    }}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0047AB] cursor-pointer"
                    title="Chỉnh sửa"
                  >
                    <PencilSimple size={15} weight="bold" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal chi tiết chứng chỉ */}
      {detail && (
        <CertificateDetailModal
          cert={detail}
          sameTitleCount={items.filter((x) => detail.groupId
            ? x.groupId === detail.groupId
            : x.title.toLowerCase() === detail.title.toLowerCase()).length}
          onClose={() => setDetail(null)}
          onEdit={() => {
            const cur = detail;
            setDetail(null);
            setEditingCert(cur);
            setFormOpen(true);
          }}
          onExtend={() => {
            const cur = detail;
            setDetail(null);
            setExtendingCert(cur);
          }}
          onRevoke={() => handleRevoke(detail)}
          onDelete={() => handleDelete(detail)}
        />
      )}

      {/* Modal thêm mới / sửa chứng chỉ */}
      {formOpen && (
        <CertificateFormModal
          open={formOpen}
          initial={editingCert}
          initialHolderIds={
            editingCert?.groupId
              ? items
                  .filter((x) => x.groupId === editingCert.groupId && x.employeeId)
                  .map((x) => x.employeeId!)
              : editingCert?.employeeId
                ? [editingCert.employeeId]
                : []
          }
          personnel={personnel}
          saving={saving}
          onClose={() => {
            setFormOpen(false);
            setEditingCert(null);
          }}
          onSubmit={handleFormSubmit}
        />
      )}

      {/* Modal gia hạn hàng loạt */}
      {extendingCert && (
        <BatchExpiryModal
          cert={extendingCert}
          allCount={items.filter((x) => extendingCert.groupId
            ? x.groupId === extendingCert.groupId
            : x.title.toLowerCase() === extendingCert.title.toLowerCase()).length}
          onClose={() => setExtendingCert(null)}
          onSubmit={handleBatchExpiry}
        />
      )}
    </main>
  );
}
