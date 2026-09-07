"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  INITIAL_COMPANY_CERTIFICATES,
  type CompanyCertificate,
} from "@/data/companyCertificates";
import { Plus } from "@/components/icons";
import {
  deleteCompanyCertificate,
  loadQualityMetadata,
  saveCompanyCertificate,
} from "@/lib/qualityMetadataClient";
import {
  deleteDriveDocument,
  fetchDriveDocuments,
  uploadDocumentToDrive,
} from "@/lib/driveDocumentsClient";

const STORAGE_KEY = "thanhphat_company_certificates_v2";

const statusStyle: Record<CompanyCertificate["status"], string> = {
  "Chưa cập nhật": "bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs",
  "Còn hiệu lực": "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  "Sắp hết hạn": "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  "Hết hạn": "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
};

export default function CompanyCertificateManagement() {
  const { lang } = useLanguage();
  const isEn = lang === "en";

  const [items, setItems] = useState<CompanyCertificate[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return INITIAL_COMPANY_CERTIFICATES;
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingCert, setEditingCert] = useState<CompanyCertificate | null>(null);
  const [detailCert, setDetailCert] = useState<CompanyCertificate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [persistenceError, setPersistenceError] = useState("");
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  useEffect(() => {
    let active = true;
    loadQualityMetadata()
      .then((result) => {
        if (!active) return;
        setItems(result.certificates);
        setPersistenceError("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPersistenceError(error instanceof Error ? error.message : "Không tải được chứng chỉ công ty từ Supabase.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setPendingPdf(null);
    setUploadProgress(null);
  }, [editingCert?.id]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((cert) => {
      if (statusFilter !== "all" && cert.status !== statusFilter) return false;
      if (q) {
        const text = `${cert.title} ${cert.standardCode} ${cert.organization} ${cert.certificateNumber} ${cert.scope} ${cert.notes || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, statusFilter]);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((c) => c.status === "Còn hiệu lực").length;
    const expiring = items.filter((c) => c.status === "Sắp hết hạn").length;
    const expired = items.filter((c) => c.status === "Hết hạn").length;
    return { total, active, expiring, expired };
  }, [items]);

  async function handleSaveCert(cert: CompanyCertificate) {
    let newlyUploadedFileId: string | undefined;
    try {
      const previous = items.find((item) => item.id === cert.id);
      let certificateToSave = cert;
      if (pendingPdf) {
        setUploadProgress(0);
        const upload = await uploadDocumentToDrive(
          pendingPdf,
          pendingPdf.name,
          cert.title,
          setUploadProgress,
          {
            entityType: "company_certificate",
            documentType: "certificate",
            source: cert.id,
            category: "quality",
          },
        );
        if (!upload.success) throw new Error(upload.error || "Không tải được PDF lên Google Drive.");
        const uploaded = upload.item ?? (
          await fetchDriveDocuments()
        ).items.find((item) => item.appProperties?.source === cert.id);
        if (!uploaded?.id) {
          throw new Error("PDF đã tải lên nhưng Google Drive chưa trả về mã tệp để liên kết.");
        }
        newlyUploadedFileId = uploaded.id;
        certificateToSave = {
          ...cert,
          documentName: pendingPdf.name,
          driveFileId: uploaded?.id,
          documentUrl: uploaded?.webViewLink,
        };
      }
      const saved = await saveCompanyCertificate(certificateToSave);
      setPersistenceError("");
      setItems((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        return exists ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev];
      });
      setEditingCert(null);
      setIsCreating(false);
      setPendingPdf(null);
      setUploadProgress(null);
      if (
        previous?.driveFileId &&
        previous.driveFileId !== saved.driveFileId &&
        !items.some((item) => item.id !== previous.id && item.driveFileId === previous.driveFileId)
      ) {
        const cleanup = await deleteDriveDocument(previous.driveFileId);
        if (!cleanup.success) {
          setPersistenceError("Đã lưu chứng chỉ nhưng chưa dọn được PDF cũ trên Google Drive.");
        }
      }
    } catch (error) {
      if (newlyUploadedFileId) {
        await deleteDriveDocument(newlyUploadedFileId);
      }
      const message = error instanceof Error ? error.message : "Không lưu được chứng chỉ công ty.";
      setPersistenceError(message);
      setUploadProgress(null);
      window.alert(message);
    }
  }

  async function handleDeleteCert(id: string) {
    if (!window.confirm(isEn ? "Are you sure you want to delete this company certificate?" : "Bạn có chắc chắn muốn xóa chứng chỉ công ty này?")) {
      return;
    }
    try {
      const removed = items.find((cert) => cert.id === id);
      await deleteCompanyCertificate(id);
      const remaining = items.filter((cert) => cert.id !== id);
      setItems(remaining);
      setDetailCert(null);
      setPersistenceError("");
      if (
        removed?.driveFileId &&
        !remaining.some((cert) => cert.driveFileId === removed.driveFileId)
      ) {
        const cleanup = await deleteDriveDocument(removed.driveFileId);
        if (!cleanup.success) {
          setPersistenceError("Đã xóa metadata chứng chỉ nhưng chưa dọn được PDF trên Google Drive.");
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không xóa được chứng chỉ công ty.";
      setPersistenceError(message);
      window.alert(message);
    }
  }

  return (
    <div className="w-full px-4 sm:px-6 pb-12">
      {/* Header */}
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
          {isEn ? "QUALITY MANAGEMENT" : "QUẢN LÝ CHẤT LƯỢNG"}
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">
          {isEn
            ? "Quality Management Certificates (ISO)"
            : "Chứng chỉ quản lý chất lượng (ISO)"}
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-4xl">
          {isEn
            ? "ISO quality management certificates and records of Thanh Phat Joint Stock Company."
            : "Chứng chỉ quản lý chất lượng (ISO) và hồ sơ của Công ty Cổ phần Thành Phát."}
        </p>
      </div>

      {persistenceError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Chưa đồng bộ được metadata QLCL với Supabase: {persistenceError}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {isEn ? "Total Company Certs" : "Tổng chứng chỉ công ty"}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-slate-900">
            {stats.total}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {isEn ? "ISO 9001 & TCVN accreditations" : "Hồ sơ pháp lý & tiêu chuẩn"}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            {isEn ? "Active / Valid" : "Còn hiệu lực"}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-emerald-700">
            {stats.active}
          </div>
          <div className="mt-1 text-xs text-emerald-600">
            {isEn ? "Certificates currently marked valid" : "Hồ sơ đang được ghi nhận còn hiệu lực"}
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
            {isEn ? "Expiring Soon" : "Sắp hết hạn (≤ 90 ngày)"}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-amber-700">
            {stats.expiring}
          </div>
          <div className="mt-1 text-xs text-amber-600">
            {isEn ? "Needs renewal audit" : "Cần giám sát gia hạn"}
          </div>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-rose-800">
            {isEn ? "Expired" : "Hết hạn / Cần gia hạn"}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold font-mono text-rose-700">
            {stats.expired}
          </div>
          <div className="mt-1 text-xs text-rose-600">
            {isEn ? "Action required" : "Cần cấp mới"}
          </div>
        </div>
      </div>

      {/* Filter bar & Actions */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-1 w-full sm:w-auto gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isEn ? "Search certificate, organization, number, scope..." : "Tìm theo tên chứng chỉ, đơn vị cấp, số chứng chỉ, phạm vi..."}
            className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={isEn ? "Filter by status" : "Lọc theo trạng thái"}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs outline-hidden focus:border-[#0047AB] cursor-pointer"
          >
            <option value="all">{isEn ? "All Statuses" : "Tất cả trạng thái"}</option>
            <option value="Chưa cập nhật">{isEn ? "Not verified" : "Chưa cập nhật"}</option>
            <option value="Còn hiệu lực">{isEn ? "Active" : "Còn hiệu lực"}</option>
            <option value="Sắp hết hạn">{isEn ? "Expiring Soon" : "Sắp hết hạn"}</option>
            <option value="Hết hạn">{isEn ? "Expired" : "Hết hạn"}</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingCert({
              id: `COMP-CERT-${Date.now()}`,
              title: "",
              standardCode: "ISO 9001:2015",
              organization: "",
              certificateNumber: "",
              scope: "",
              issuedAt: new Date().toLocaleDateString("vi-VN"),
              expiresAt: "",
              status: "Chưa cập nhật",
            });
            setIsCreating(true);
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition-colors cursor-pointer"
        >
          <Plus size={16} weight="bold" />
          {isEn ? "Add Company Certificate" : "Thêm chứng chỉ công ty"}
        </button>
      </div>

      {/* Grid of Company Certificates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((cert) => (
          <div
            key={cert.id}
            className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md transition-all duration-200"
          >
            {/* Visual Header Card */}
            <div className="relative border-b border-slate-100 bg-gradient-to-br from-[#102d55] to-[#0047AB] p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 backdrop-blur-xs border border-white/20 text-white font-bold text-xs">
                    ISO
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                      CÔNG TY CP THÀNH PHÁT
                    </div>
                    <div className="text-[10px] text-blue-100/80 font-mono">
                      THANH PHAT JSC
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusStyle[cert.status]}`}>
                  {cert.status}
                </span>
              </div>

              <div className="mt-4">
                <div className="text-xs font-mono font-semibold text-amber-300">
                  {cert.standardCode}
                </div>
                <h3 className="mt-1 text-base font-bold text-white leading-snug line-clamp-2">
                  {cert.title}
                </h3>
              </div>
            </div>

            {/* Certificate Details */}
            <div className="flex-1 p-5 space-y-3.5 text-xs sm:text-sm">
              <div>
                <span className="text-xs font-medium text-slate-500 block">
                  {isEn ? "Certificate Number:" : "Số chứng chỉ:"}
                </span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {cert.certificateNumber || "—"}
                </span>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-500 block">
                  {isEn ? "Issuing Authority:" : "Đơn vị cấp:"}
                </span>
                <span className="font-semibold text-slate-800">
                  {cert.organization || "—"}
                </span>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-500 block">
                  {isEn ? "Certification Scope:" : "Phạm vi chứng nhận:"}
                </span>
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mt-0.5">
                  {cert.scope || "Chưa cập nhật phạm vi"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block">{isEn ? "Issued date" : "Ngày cấp"}</span>
                  <span className="font-mono font-semibold text-slate-700">{cert.issuedAt || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isEn ? "Valid until" : "Hiệu lực đến"}</span>
                  <span className="font-mono font-semibold text-slate-700">{cert.expiresAt || "—"}</span>
                </div>
              </div>

              {cert.documentName && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#0047AB] truncate">
                    <span>📄</span>
                    <span className="truncate max-w-[180px]">{cert.documentName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (cert.documentUrl) {
                        window.open(cert.documentUrl, "_blank", "noopener,noreferrer");
                      } else {
                        window.alert(`Tài liệu: ${cert.documentName}`);
                      }
                    }}
                    className="text-xs font-bold text-[#0047AB] hover:underline cursor-pointer"
                  >
                    {isEn ? "Preview" : "Xem trước"}
                  </button>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="border-t border-slate-100 bg-slate-50/70 p-3.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDetailCert(cert)}
                className="text-xs font-bold text-slate-700 hover:text-[#0047AB] transition-colors cursor-pointer"
              >
                {isEn ? "View Details" : "Chi tiết"}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCert(cert);
                    setIsCreating(false);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {isEn ? "Edit" : "Sửa"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCert(cert.id)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  {isEn ? "Delete" : "Xóa"}
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            {isEn ? "No company certificates found." : "Không tìm thấy chứng chỉ công ty nào phù hợp."}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                  CÔNG TY CỔ PHẦN THÀNH PHÁT
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {detailCert.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailCert(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{isEn ? "Status" : "Trạng thái"}:</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusStyle[detailCert.status]}`}>
                  {detailCert.status}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">{isEn ? "Standard / Code:" : "Tiêu chuẩn áp dụng:"}</span>
                <span className="font-mono font-bold text-slate-900">{detailCert.standardCode}</span>
              </div>

              <div>
                <span className="text-slate-500 block">{isEn ? "Certificate Number:" : "Số chứng chỉ:"}</span>
                <span className="font-mono font-semibold text-slate-900">{detailCert.certificateNumber}</span>
              </div>

              <div>
                <span className="text-slate-500 block">{isEn ? "Issuing Body:" : "Đơn vị cấp:"}</span>
                <span className="font-semibold text-slate-900">{detailCert.organization}</span>
              </div>

              <div>
                <span className="text-slate-500 block">{isEn ? "Scope of Certification:" : "Phạm vi chứng nhận:"}</span>
                <p className="mt-1 text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {detailCert.scope}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-slate-400 block">{isEn ? "Issued Date" : "Ngày cấp"}</span>
                  <span className="font-mono font-bold text-slate-900">{detailCert.issuedAt || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isEn ? "Expires Date" : "Ngày hết hạn"}</span>
                  <span className="font-mono font-bold text-slate-900">{detailCert.expiresAt || "—"}</span>
                </div>
              </div>

              {detailCert.notes && (
                <div>
                  <span className="text-slate-500 block">{isEn ? "Notes:" : "Ghi chú:"}</span>
                  <p className="mt-0.5 text-xs text-slate-600 italic">{detailCert.notes}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setDetailCert(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {isEn ? "Close" : "Đóng"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCert(detailCert);
                  setDetailCert(null);
                  setIsCreating(false);
                }}
                className="rounded-lg bg-[#0047AB] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                {isEn ? "Edit" : "Chỉnh sửa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Form Modal */}
      {editingCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
                  {isEn ? "Company Certification" : "Chứng chỉ Quản lý Chất lượng Công ty"}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {isCreating
                    ? isEn ? "Add New Company Certificate" : "Thêm chứng chỉ công ty mới"
                    : isEn ? "Edit Company Certificate" : "Chỉnh sửa chứng chỉ công ty"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCert(null);
                  setIsCreating(false);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingCert.title.trim()) {
                  window.alert("Vui lòng nhập tên chứng chỉ.");
                  return;
                }
                void handleSaveCert(editingCert);
              }}
              className="mt-4 space-y-3.5 text-xs sm:text-sm"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isEn ? "Certificate Title *" : "Tên chứng chỉ *"}
                </label>
                <input
                  type="text"
                  required
                  value={editingCert.title}
                  onChange={(e) => setEditingCert({ ...editingCert, title: e.target.value })}
                  placeholder="Chứng chỉ Hệ thống Quản lý Chất lượng ISO 9001:2015"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isEn ? "Standard Code" : "Tiêu chuẩn áp dụng"}
                  </label>
                  <input
                    type="text"
                    value={editingCert.standardCode}
                    onChange={(e) => setEditingCert({ ...editingCert, standardCode: e.target.value })}
                    placeholder="ISO 9001:2015 / TCVN 13965"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isEn ? "Certificate Number" : "Số chứng chỉ"}
                  </label>
                  <input
                    type="text"
                    value={editingCert.certificateNumber}
                    onChange={(e) => setEditingCert({ ...editingCert, certificateNumber: e.target.value })}
                    placeholder="TQC.02.2489"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isEn ? "Issuing Authority / Organization" : "Đơn vị cấp"}
                </label>
                <input
                  type="text"
                  value={editingCert.organization}
                  onChange={(e) => setEditingCert({ ...editingCert, organization: e.target.value })}
                  placeholder="Tổ chức Chứng nhận Quốc tế TQC / Cục Đường sắt"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isEn ? "Scope of Certification" : "Phạm vi chứng nhận"}
                </label>
                <textarea
                  rows={2}
                  value={editingCert.scope}
                  onChange={(e) => setEditingCert({ ...editingCert, scope: e.target.value })}
                  placeholder="Thi công hàn ray đường sắt (Flash-Butt Welding & Thermit Welding)..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isEn ? "Issued Date" : "Ngày cấp"}
                  </label>
                  <input
                    type="text"
                    value={editingCert.issuedAt}
                    onChange={(e) => setEditingCert({ ...editingCert, issuedAt: e.target.value })}
                    placeholder="15/06/2024"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isEn ? "Expiry Date" : "Ngày hết hạn"}
                  </label>
                  <input
                    type="text"
                    value={editingCert.expiresAt}
                    onChange={(e) => setEditingCert({ ...editingCert, expiresAt: e.target.value })}
                    placeholder="14/06/2027"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isEn ? "Status" : "Trạng thái"}
                  </label>
                  <select
                    value={editingCert.status}
                    onChange={(e) => setEditingCert({ ...editingCert, status: e.target.value as CompanyCertificate["status"] })}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-800 shadow-2xs outline-hidden focus:border-[#0047AB]"
                  >
                    <option value="Chưa cập nhật">{isEn ? "Not verified" : "Chưa cập nhật"}</option>
                    <option value="Còn hiệu lực">{isEn ? "Active" : "Còn hiệu lực"}</option>
                    <option value="Sắp hết hạn">{isEn ? "Expiring Soon" : "Sắp hết hạn"}</option>
                    <option value="Hết hạn">{isEn ? "Expired" : "Hết hạn"}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isEn ? "Evidence Document File Name" : "Tên file tài liệu minh chứng"}
                </label>
                <input
                  type="text"
                  value={editingCert.documentName || ""}
                  onChange={(e) => setEditingCert({ ...editingCert, documentName: e.target.value })}
                  placeholder="Chung_chi_ISO_9001_Thanh_Phat.pdf"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 shadow-2xs outline-hidden focus:border-[#0047AB]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isEn ? "Upload company certificate PDF to Google Drive" : "Tải PDF chứng chỉ công ty lên Google Drive"}
                </label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => setPendingPdf(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700"
                />
                {uploadProgress !== null && (
                  <div className="mt-1.5 text-xs font-medium text-[#0047AB]">
                    Đang tải lên Google Drive: {uploadProgress}%
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCert(null);
                    setIsCreating(false);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {isEn ? "Cancel" : "Hủy"}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#0047AB] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                >
                  {isEn ? "Save Certificate" : "Lưu chứng chỉ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
