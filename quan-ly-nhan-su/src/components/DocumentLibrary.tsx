"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, X } from "@/components/icons";
import {
  deleteDocument,
  fetchDocuments,
  formatFileSize,
  hasSupabaseEnv,
  updateDocument,
  uploadDocument,
  type DocumentItem,
} from "@/lib/documentsDb";

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
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewer, setViewer] = useState<DocumentItem | null>(null);
  const [editing, setEditing] = useState<DocumentItem | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const supabaseReady = hasSupabaseEnv();

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await fetchDocuments();
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
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q),
    );
  }, [items, query]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErrorMsg("Chọn file PDF để tải lên");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);

    const res = await uploadDocument(file, title, description);
    setSaving(false);

    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    setTitle("");
    setDescription("");
    if (fileRef.current) fileRef.current.value = "";
    setShowForm(false);
    setStatusMsg(`Đã tải lên: ${res.item?.title}`);
    await reload();
  }

  async function handleDelete(doc: DocumentItem) {
    if (!confirm(`Xóa tài liệu "${doc.title}"?`)) return;
    setSaving(true);
    setErrorMsg(null);
    const res = await deleteDocument(doc.id, doc.filePath);
    setSaving(false);
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }
    if (viewer?.id === doc.id) setViewer(null);
    if (editing?.id === doc.id) setEditing(null);
    setStatusMsg(`Đã xóa: ${doc.title}`);
    await reload();
  }

  function openEdit(doc: DocumentItem) {
    setEditing(doc);
    setTitle(doc.title);
    setDescription(doc.description);
    setShowForm(false);
    setErrorMsg(null);
    setStatusMsg(null);
    if (editFileRef.current) editFileRef.current.value = "";
  }

  function closeEdit() {
    setEditing(null);
    setTitle("");
    setDescription("");
    if (editFileRef.current) editFileRef.current.value = "";
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;

    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);

    const newFile = editFileRef.current?.files?.[0] ?? null;
    const res = await updateDocument(
      editing.id,
      editing.filePath,
      title,
      description,
      newFile,
    );
    setSaving(false);

    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    closeEdit();
    setStatusMsg(`Đã cập nhật: ${res.item?.title ?? title}`);
    if (viewer?.id === editing.id && res.item) setViewer(res.item);
    await reload();
  }

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-lg border border-slate-300/90 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-400 focus:outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100";
  const labelClass = "block text-xs font-semibold text-slate-700 mb-1.5";
  const fileInputClass =
    "mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-[#0047AB] hover:file:bg-blue-100 file:transition-colors";

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 pb-8">
      {!supabaseReady && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 shadow-xs">
          Chưa có Supabase. Thêm env và chạy SQL{" "}
          <code className="rounded border border-amber-200 bg-white px-1 font-mono">supabase/tai_lieu.sql</code>.
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

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
        <span>
          <strong className="font-mono tabular-nums text-slate-900">{filtered.length}</strong> tài liệu PDF
          {loading ? " · đang tải…" : ""}
        </span>
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
            placeholder="Tìm tên tài liệu, mô tả..."
            className="w-full rounded-lg border border-slate-300/90 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-400 focus:outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          type="button"
          disabled={!supabaseReady || saving}
          onClick={() => {
            setShowForm((v) => !v);
            closeEdit();
          }}
          className="btn-primary disabled:opacity-50 disabled:pointer-events-none"
        >
          {showForm ? "Đóng form" : "Tải PDF lên"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void reload()}
          className="btn-secondary disabled:opacity-50 disabled:pointer-events-none"
        >
          Tải lại
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => void handleUpload(e)}
          className="mb-4 grid gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs sm:grid-cols-2"
        >
          <label className="sm:col-span-2">
            <span className={labelClass}>Tên tài liệu</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Hướng dẫn vận hành máy hàn..."
              className={inputClass}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Mô tả (tuỳ chọn)</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Phiên bản, dự án, ghi chú..."
              className={inputClass}
            />
          </label>
          <label>
            <span className={labelClass}>File PDF</span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              required
              className={fileInputClass}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving || !supabaseReady}
              className="btn-primary w-full disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? "Đang tải lên…" : "Lưu tài liệu"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 typo-table-th">
                <th className="px-4 py-3">Tên tài liệu</th>
                <th className="px-3 py-3">Dung lượng</th>
                <th className="px-3 py-3">Ngày tải</th>
                <th className="px-3 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500">
                    {loading
                      ? "Đang tải danh sách…"
                      : "Chưa có tài liệu. Bấm Tải PDF lên để thêm."}
                  </td>
                </tr>
              )}
              {filtered.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-b border-slate-100 transition-colors duration-100 last:border-b-0 hover:bg-slate-50/80"
                >
                  <td className="px-4 py-3.5">
                    <div className="text-sm font-semibold text-slate-900">{doc.title}</div>
                    {doc.description ? (
                      <div className="mt-0.5 text-xs text-slate-500">{doc.description}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3.5 font-mono text-xs tabular-nums text-slate-700">
                    {formatFileSize(doc.fileSize)}
                  </td>
                  <td className="px-3 py-3.5 font-mono text-xs tabular-nums text-slate-500">
                    {formatDate(doc.createdAt)}
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(doc)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewer(doc)}
                        className="rounded-lg border border-[#0047AB] px-3 py-1.5 text-xs font-semibold text-[#0047AB] shadow-xs transition-colors duration-150 hover:bg-blue-50"
                      >
                        Xem
                      </button>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900"
                      >
                        Tải về
                      </a>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleDelete(doc)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors duration-150 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            aria-label="Đóng"
            onClick={closeEdit}
          />
          <form
            onSubmit={(e) => void handleEdit(e)}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-6 py-4">
              <div>
                <h2 className="typo-modal-title">Sửa tài liệu</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Cập nhật tên, mô tả hoặc thay file PDF
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
              >
                <X size={16} weight="bold" aria-hidden />
              </button>
            </div>

            <div className="space-y-3.5 p-6">
              <label className="block">
                <span className={labelClass}>Tên tài liệu</span>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Mô tả</span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Thay file PDF (tuỳ chọn)</span>
                <input
                  ref={editFileRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className={fileInputClass}
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4">
              <button type="button" onClick={closeEdit} className="btn-secondary">
                Huỷ
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </div>
      )}

      {viewer && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-[#0f172a]/70 p-1 sm:p-1.5">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Đóng xem PDF"
            onClick={() => setViewer(null)}
          />
          <div className="relative z-10 mx-auto flex h-[calc(100vh-0.75rem)] w-[96vw] max-w-[1650px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e8eef8] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate typo-section-title">{viewer.title}</div>
                <div className="font-mono text-xs tabular-nums text-slate-500">
                  {formatFileSize(viewer.fileSize)} · {formatDate(viewer.createdAt)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={viewer.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900"
                >
                  Mở tab mới
                </a>
                <button
                  type="button"
                  onClick={() => setViewer(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Đóng"
                >
                  <X size={16} weight="bold" aria-hidden />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-slate-100">
              <iframe
                title={viewer.title}
                src={`${viewer.fileUrl}#toolbar=1`}
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
