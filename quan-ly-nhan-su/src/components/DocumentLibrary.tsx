"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
      {!supabaseReady && (
        <div className="mb-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#991b1b]">
          Chưa có Supabase. Thêm env và chạy SQL{" "}
          <code className="rounded bg-white px-1">supabase/tai_lieu.sql</code>.
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#991b1b]">
          {errorMsg}
        </div>
      )}
      {statusMsg && (
        <div className="mb-4 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[13px] text-[#166534]">
          {statusMsg}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#475569]">
        <span>
          <strong className="text-[#0f172a]">{filtered.length}</strong> tài liệu PDF
          {loading ? " · đang tải…" : ""}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tên tài liệu, mô tả..."
            className="h-10 w-full rounded-lg border border-[#d9e2f1] bg-white px-3 text-[13px] outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
          />
        </div>
        <button
          type="button"
          disabled={!supabaseReady || saving}
          onClick={() => {
            setShowForm((v) => !v);
            closeEdit();
          }}
          className="inline-flex h-10 items-center rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987] disabled:opacity-50"
        >
          {showForm ? "Đóng form" : "+ Tải PDF lên"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void reload()}
          className="inline-flex h-10 items-center rounded-lg border border-[#d9e2f1] bg-white px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]"
        >
          Tải lại
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => void handleUpload(e)}
          className="mb-4 grid gap-3 rounded-xl border border-[#d9e2f1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:grid-cols-2"
        >
          <label className="text-[12px] font-semibold text-[#64748b] sm:col-span-2">
            Tên tài liệu
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Hướng dẫn vận hành máy hàn..."
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] text-[#0f172a] outline-none focus:border-[#0047AB]"
            />
          </label>
          <label className="text-[12px] font-semibold text-[#64748b] sm:col-span-2">
            Mô tả (tuỳ chọn)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Phiên bản, dự án, ghi chú..."
              className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] text-[#0f172a] outline-none focus:border-[#0047AB]"
            />
          </label>
          <label className="text-[12px] font-semibold text-[#64748b]">
            File PDF
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              required
              className="mt-1 block w-full text-[13px] text-[#334155] file:mr-3 file:rounded-md file:border-0 file:bg-[#eef4ff] file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-[#0047AB]"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving || !supabaseReady}
              className="h-10 w-full rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987] disabled:opacity-50"
            >
              {saving ? "Đang tải lên…" : "Lưu tài liệu"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-[#d9e2f1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e8eef8] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
                <th className="px-4 py-3">Tên tài liệu</th>
                <th className="px-3 py-3">Dung lượng</th>
                <th className="px-3 py-3">Ngày tải</th>
                <th className="px-3 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-[#64748b]">
                    {loading
                      ? "Đang tải danh sách…"
                      : "Chưa có tài liệu. Bấm + Tải PDF lên để thêm."}
                  </td>
                </tr>
              )}
              {filtered.map((doc) => (
                <tr key={doc.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-[#0f172a]">{doc.title}</div>
                    {doc.description ? (
                      <div className="mt-0.5 text-[12px] text-[#64748b]">{doc.description}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3.5 text-[#334155]">{formatFileSize(doc.fileSize)}</td>
                  <td className="px-3 py-3.5 text-[12px] text-[#64748b]">{formatDate(doc.createdAt)}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(doc)}
                        className="rounded-lg border border-[#d9e2f1] px-3 py-1.5 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewer(doc)}
                        className="rounded-lg border border-[#0047AB] px-3 py-1.5 text-[12px] font-semibold text-[#0047AB] hover:bg-[#eef4ff]"
                      >
                        Xem
                      </button>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="rounded-lg border border-[#d9e2f1] px-3 py-1.5 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                      >
                        Tải về
                      </a>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleDelete(doc)}
                        className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#dc2626] hover:bg-[#fef2f2]"
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
            className="absolute inset-0 bg-[#071633]/55 backdrop-blur-[2px]"
            aria-label="Đóng"
            onClick={closeEdit}
          />
          <form
            onSubmit={(e) => void handleEdit(e)}
            className="relative z-10 w-full max-w-[520px] rounded-2xl border border-[#d9e2f1] bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-bold text-[#0f172a]">Sửa tài liệu</h2>
                <p className="mt-0.5 text-[12px] text-[#64748b]">
                  Cập nhật tên, mô tả hoặc thay file PDF
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9]"
                aria-label="Đóng"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <label className="mb-3 block text-[12px] font-semibold text-[#64748b]">
              Tên tài liệu
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] text-[#0f172a] outline-none focus:border-[#0047AB]"
              />
            </label>
            <label className="mb-3 block text-[12px] font-semibold text-[#64748b]">
              Mô tả
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#d9e2f1] px-3 text-[13px] text-[#0f172a] outline-none focus:border-[#0047AB]"
              />
            </label>
            <label className="mb-4 block text-[12px] font-semibold text-[#64748b]">
              Thay file PDF (tuỳ chọn)
              <input
                ref={editFileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="mt-1 block w-full text-[13px] text-[#334155] file:mr-3 file:rounded-md file:border-0 file:bg-[#eef4ff] file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-[#0047AB]"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="h-10 rounded-lg border border-[#d9e2f1] px-4 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-lg bg-[#0047AB] px-4 text-[13px] font-semibold text-white hover:bg-[#003987] disabled:opacity-50"
              >
                {saving ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </div>
      )}

      {viewer && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-[#0f172a]/70 p-3 sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Đóng xem PDF"
            onClick={() => setViewer(null)}
          />
          <div className="relative z-10 mx-auto flex h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e8eef8] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold text-[#0f172a]">{viewer.title}</div>
                <div className="text-[12px] text-[#64748b]">
                  {formatFileSize(viewer.fileSize)} · {formatDate(viewer.createdAt)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={viewer.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-[#d9e2f1] px-3 py-1.5 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                >
                  Mở tab mới
                </a>
                <button
                  type="button"
                  onClick={() => setViewer(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9]"
                  aria-label="Đóng"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-[#f1f5f9]">
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
