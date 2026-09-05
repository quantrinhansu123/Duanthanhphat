"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, X } from "@/components/icons";
import {
  deleteDriveDocument,
  fetchDriveDocuments,
  migrateDocumentsFromSupabase,
  replaceDocumentContentInDrive,
  updateDriveDocumentMeta,
  uploadDocumentToDrive,
  type DriveDocumentItem,
  type MigrationItemResult,
  type MigrationSummary,
} from "@/lib/driveDocumentsClient";

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function DocumentLibrary() {
  const [items, setItems] = useState<DriveDocumentItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [configNotice, setConfigNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewer, setViewer] = useState<DriveDocumentItem | null>(null);
  const [editing, setEditing] = useState<DriveDocumentItem | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Thay thế nội dung file (Drive media patch)
  const [replacingDoc, setReplacingDoc] = useState<DriveDocumentItem | null>(null);
  const [replaceProgress, setReplaceProgress] = useState<number | null>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);

  // Di chuyển tài liệu từ Supabase sang Google Drive
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    summary?: MigrationSummary;
    items?: MigrationItemResult[];
  } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await fetchDriveDocuments();
    setConfigured(res.configured);
    if (res.message) setConfigNotice(res.message);
    setItems(res.items);
    if (res.error) setErrorMsg(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        (d.md5Checksum && d.md5Checksum.toLowerCase().includes(q)),
    );
  }, [items, query]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErrorMsg("Vui lòng chọn file PDF để tải lên.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);
    setUploadProgress(0);

    const res = await uploadDocumentToDrive(
      file,
      title.trim() || file.name,
      description.trim(),
      (percent) => setUploadProgress(percent),
    );

    setSaving(false);
    setUploadProgress(null);

    if (!res.success) {
      setErrorMsg(res.error || "Tải lên tài liệu thất bại.");
      return;
    }

    setTitle("");
    setDescription("");
    if (fileRef.current) fileRef.current.value = "";
    setShowForm(false);
    setStatusMsg(`Tải lên Google Drive thành công: ${title || file.name}`);
    await reload();
  }

  async function handleReplaceFile(e: React.FormEvent) {
    e.preventDefault();
    if (!replacingDoc) return;
    const file = replaceFileRef.current?.files?.[0];
    if (!file) {
      setErrorMsg("Vui lòng chọn file PDF mới để thay thế.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);
    setReplaceProgress(0);

    const res = await replaceDocumentContentInDrive(
      replacingDoc.id,
      file,
      replacingDoc.name,
      replacingDoc.description,
      (percent) => setReplaceProgress(percent),
    );

    setSaving(false);
    setReplaceProgress(null);

    if (!res.success) {
      setErrorMsg(res.error || "Thay thế file trên Google Drive thất bại.");
      return;
    }

    if (replaceFileRef.current) replaceFileRef.current.value = "";
    const docName = replacingDoc.name;
    setReplacingDoc(null);
    setStatusMsg(`Đã thay thế nội dung file thành công cho: ${docName}`);
    await reload();
  }

  async function handleMigrate() {
    if (
      !confirm(
        "Bắt đầu di chuyển tất cả tài liệu từ Supabase Storage sang Google Drive và đối chiếu MD5 checksum?",
      )
    ) {
      return;
    }

    setMigrating(true);
    setErrorMsg(null);
    setStatusMsg(null);

    const res = await migrateDocumentsFromSupabase();
    setMigrating(false);

    if (!res.success) {
      setErrorMsg(res.error || "Di chuyển tài liệu thất bại.");
      return;
    }

    setMigrationResult({
      summary: res.summary,
      items: res.items,
    });
    setStatusMsg(
      `Di chuyển hoàn tất: ${res.summary?.migrated || 0} tệp mới, ${res.summary?.alreadyExists || 0} đã có, ${res.summary?.failed || 0} lỗi.`,
    );
    await reload();
  }

  async function handleDelete(doc: DriveDocumentItem) {
    if (!confirm(`Chuyển tài liệu "${doc.name}" vào thùng rác Google Drive?`)) return;
    setSaving(true);
    setErrorMsg(null);
    const res = await deleteDriveDocument(doc.id);
    setSaving(false);
    if (!res.success) {
      setErrorMsg(res.error || "Không thể xóa tài liệu.");
      return;
    }
    if (viewer?.id === doc.id) setViewer(null);
    if (editing?.id === doc.id) setEditing(null);
    if (replacingDoc?.id === doc.id) setReplacingDoc(null);
    setStatusMsg(`Đã chuyển vào thùng rác: ${doc.name}`);
    await reload();
  }

  function openEdit(doc: DriveDocumentItem) {
    setEditing(doc);
    setTitle(doc.name);
    setDescription(doc.description || "");
    setShowForm(false);
    setErrorMsg(null);
    setStatusMsg(null);
  }

  function closeEdit() {
    setEditing(null);
    setTitle("");
    setDescription("");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;

    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);

    const res = await updateDriveDocumentMeta(
      editing.id,
      title,
      description,
    );
    setSaving(false);

    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    closeEdit();
    setStatusMsg(`Đã cập nhật: ${res.item?.name ?? title}`);
    if (viewer?.id === editing.id && res.item) setViewer(res.item);
    await reload();
  }

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-lg border border-slate-300/90 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-400 focus:outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100";
  const labelClass = "block text-xs font-semibold text-slate-700 mb-1.5";
  const fileInputClass =
    "mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-[#0047AB] hover:file:bg-blue-100 file:transition-colors";

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 pb-8">
      {!configured && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-[#0047AB] shadow-xs">
          <strong>Lưu ý cấu hình Google Drive:</strong> {configNotice || "Cần cấu hình GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID trên máy chủ để đồng bộ trực tiếp với Google Drive."}
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-xs">
          {errorMsg}
        </div>
      )}
      {statusMsg && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-xs">
          {statusMsg}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-sm text-slate-500">
        <div>
          <strong className="font-mono tabular-nums text-slate-900">{filtered.length}</strong> tài liệu PDF (Google Drive)
          {loading ? " · đang tải…" : ""}
        </div>
        <div className="text-xs text-slate-400">
          Resumable Upload & Patch trực tiếp lên Google Drive · Ghi appProperties & Checksum MD5
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-xs">
        <div className="relative min-w-[220px] flex-1">
          <MagnifyingGlass
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tên tài liệu, mô tả, MD5..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300/90 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-400 focus:outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            closeEdit();
            setReplacingDoc(null);
            setErrorMsg(null);
            setStatusMsg(null);
          }}
          className="rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer"
        >
          {showForm ? "Đóng form" : "Tải PDF lên"}
        </button>
        <button
          type="button"
          onClick={() => void handleMigrate()}
          disabled={migrating || loading}
          className="rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 px-3.5 py-2 text-xs sm:text-sm font-semibold text-sky-800 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          {migrating ? "Đang di chuyển…" : "Di chuyển từ Supabase"}
        </button>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          Tải lại
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleUpload}
          className="mb-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs animate-in fade-in-50 duration-150"
        >
          <div className="text-sm sm:text-base font-bold text-slate-900 mb-3">
            Tải tài liệu PDF mới lên Google Drive
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Tên tài liệu *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Quy trình hàn nhôm nhiệt 2026"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>File PDF *</label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className={fileInputClass}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Mô tả</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Ghi chú thêm về tài liệu..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300/90 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-400 focus:outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {uploadProgress !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-xs font-semibold text-[#0047AB] mb-1">
                <span>Đang tải lên Drive...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-[#0047AB] transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? "Đang xử lý…" : "Tải lên"}
            </button>
          </div>
        </form>
      )}

      {editing && (
        <form
          onSubmit={handleEdit}
          className="mb-5 rounded-xl border border-blue-200 bg-blue-50/40 p-4 sm:p-5 shadow-xs animate-in fade-in-50 duration-150"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm sm:text-base font-bold text-slate-900">
              Chỉnh sửa thông tin tài liệu trên Google Drive
            </div>
            <button
              type="button"
              onClick={closeEdit}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Tên tài liệu *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Dung lượng hiện tại</label>
              <div className="px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg font-mono">
                {formatFileSize(editing.size)}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Mô tả</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300/90 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-400 focus:outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeEdit}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      )}

      {/* Modal thay thế nội dung file */}
      {replacingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => {
              if (!saving) setReplacingDoc(null);
            }}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="font-bold text-slate-900">
                Thay thế tệp tài liệu trên Google Drive
              </div>
              <button
                type="button"
                onClick={() => setReplacingDoc(null)}
                disabled={saving}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReplaceFile}>
              <div className="mb-3">
                <div className="text-xs text-slate-500 mb-1">Tài liệu mục tiêu:</div>
                <div className="font-semibold text-slate-900">{replacingDoc.name}</div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  Dung lượng hiện tại: {formatFileSize(replacingDoc.size)}
                  {replacingDoc.md5Checksum && ` · MD5 cũ: ${replacingDoc.md5Checksum}`}
                </div>
              </div>

              <div className="mb-4">
                <label className={labelClass}>Chọn file PDF mới để thay thế *</label>
                <input
                  ref={replaceFileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className={fileInputClass}
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Nội dung file mới sẽ được cập nhật trực tiếp vào ID tài liệu hiện tại trên Google Drive mà không đổi link chia sẻ. Checksum MD5 sẽ được tự động tính toán lại.
                </p>
              </div>

              {replaceProgress !== null && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs font-semibold text-amber-700 mb-1">
                    <span>Đang cập nhật nội dung file lên Drive...</span>
                    <span>{replaceProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-amber-600 transition-all duration-150"
                      style={{ width: `${replaceProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setReplacingDoc(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {saving ? "Đang thay tệp…" : "Xác nhận thay thế"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal kết quả di chuyển từ Supabase */}
      {migrationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMigrationResult(null)}
          />
          <div className="relative z-10 flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-3.5 bg-slate-50">
              <div>
                <div className="font-bold text-slate-900">
                  Báo cáo di chuyển tài liệu Supabase → Google Drive
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Đã đối chiếu mã băm MD5 và lưu vết appProperties
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMigrationResult(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Thống kê nhanh */}
            <div className="grid grid-cols-4 gap-3 p-4 bg-white border-b border-slate-200 text-center">
              <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                <div className="text-xs text-slate-500">Tổng tài liệu</div>
                <div className="text-lg font-bold text-slate-900 font-mono">
                  {migrationResult.summary?.total ?? 0}
                </div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2.5 border border-emerald-200">
                <div className="text-xs text-emerald-700">Mới chuyển</div>
                <div className="text-lg font-bold text-emerald-700 font-mono">
                  {migrationResult.summary?.migrated ?? 0}
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 p-2.5 border border-blue-200">
                <div className="text-xs text-[#0047AB]">Đã có sẵn</div>
                <div className="text-lg font-bold text-[#0047AB] font-mono">
                  {migrationResult.summary?.alreadyExists ?? 0}
                </div>
              </div>
              <div className="rounded-lg bg-rose-50 p-2.5 border border-rose-200">
                <div className="text-xs text-rose-700">Thất bại</div>
                <div className="text-lg font-bold text-rose-700 font-mono">
                  {migrationResult.summary?.failed ?? 0}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 uppercase font-semibold">
                    <th className="py-2 px-3">Tên tài liệu</th>
                    <th className="py-2 px-3">Supabase MD5</th>
                    <th className="py-2 px-3">Drive MD5</th>
                    <th className="py-2 px-3 w-32 text-center">Khớp Checksum</th>
                    <th className="py-2 px-3 w-28 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {migrationResult.items?.map((it, idx) => (
                    <tr key={it.supabaseId || idx} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900">{it.name}</div>
                        {it.message && (
                          <div className="text-[11px] text-slate-400">{it.message}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-500">
                        {it.localMd5 ? it.localMd5.slice(0, 10) + "…" : "—"}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-500">
                        {it.driveMd5 ? it.driveMd5.slice(0, 10) + "…" : "—"}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {it.checksumMatched ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                            ✓ Khớp MD5
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            Chưa khớp / N/A
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {it.status === "migrated" && (
                          <span className="font-semibold text-emerald-600">Đã chuyển</span>
                        )}
                        {it.status === "already_exists" && (
                          <span className="font-semibold text-[#0047AB]">Đã có sẵn</span>
                        )}
                        {it.status === "failed" && (
                          <span className="font-semibold text-rose-600">Lỗi</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end p-3 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setMigrationResult(null)}
                className="rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm px-4 py-2 font-semibold cursor-pointer"
              >
                Đóng báo cáo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bảng danh sách tài liệu */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[750px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Tên tài liệu & Định danh</th>
                <th className="px-4 py-3 w-32">Dung lượng</th>
                <th className="px-4 py-3 w-40">Ngày tải</th>
                <th className="px-4 py-3 w-64 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    {loading ? "Đang tải dữ liệu từ Google Drive…" : "Chưa có tài liệu nào trong thư mục Google Drive"}
                  </td>
                </tr>
              ) : (
                filtered.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                        <span>{doc.name}</span>
                        {doc.appProperties?.source === "supabase_migration" && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                            Supabase → Drive
                          </span>
                        )}
                        {doc.appProperties?.last_replaced_at && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            Đã thay tệp
                          </span>
                        )}
                      </div>
                      {doc.description ? (
                        <div className="text-xs text-slate-500 mt-0.5">{doc.description}</div>
                      ) : null}
                      {doc.md5Checksum && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                          <span>MD5: {doc.md5Checksum}</span>
                          {doc.appProperties?.checksum_verified === "true" && (
                            <span className="text-emerald-600 font-bold" title="Checksum đối chiếu khớp">
                              ✓ Khớp
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-600">
                      {formatFileSize(doc.size)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-500 text-xs">
                      {formatDate(doc.createdTime)}
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(doc)}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplacingDoc(doc);
                          setErrorMsg(null);
                          setStatusMsg(null);
                        }}
                        className="rounded px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 cursor-pointer"
                      >
                        Thay tệp
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (doc.webViewLink) {
                            window.open(doc.webViewLink, "_blank", "noopener,noreferrer");
                          } else {
                            setViewer(doc);
                          }
                        }}
                        className="rounded px-2.5 py-1 text-xs font-semibold text-[#0047AB] bg-blue-50 hover:bg-blue-100 cursor-pointer border border-blue-200"
                      >
                        Xem
                      </button>
                      <a
                        href={doc.webContentLink || doc.webViewLink || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer border border-emerald-200"
                      >
                        Tải về
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleDelete(doc)}
                        className="rounded px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal viewer nội bộ dự phòng nếu cần */}
      {viewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          <button
            type="button"
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setViewer(null)}
          />
          <div className="relative z-10 flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-3">
              <div className="font-bold text-slate-900 truncate pr-4">{viewer.name}</div>
              <button
                type="button"
                onClick={() => setViewer(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 bg-slate-100">
              {viewer.webViewLink ? (
                <iframe
                  src={viewer.webViewLink.replace("/view", "/preview")}
                  className="h-full w-full border-0"
                  title={viewer.name}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                  Không có liên kết xem trước từ Google Drive.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
