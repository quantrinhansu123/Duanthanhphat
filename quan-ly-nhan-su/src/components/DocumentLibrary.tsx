"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "@/components/icons";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  createDocumentFolder,
  deleteDocumentFolder,
  deleteDriveDocument,
  fetchDocumentFolders,
  renameDocumentFolder,
  fetchDriveDocuments,
  replaceDocumentContentInDrive,
  updateDriveDocumentMeta,
  uploadDocumentToDrive,
  type DriveDocumentItem,
} from "@/lib/driveDocumentsClient";

const ALL = "__all";
const NONE = "__none";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewer, setViewer] = useState<DriveDocumentItem | null>(null);
  const { lang, t } = useLanguage();
  const [editing, setEditing] = useState<DriveDocumentItem | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Thư mục tự tạo: ALL = tất cả, NONE = chưa phân loại, còn lại là tên thư mục.
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState(ALL);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadFolder, setUploadFolder] = useState("");
  const [editFolder, setEditFolder] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [replacementFileName, setReplacementFileName] = useState("");
  const [replacingDoc, setReplacingDoc] = useState<DriveDocumentItem | null>(null);
  const [replaceProgress, setReplaceProgress] = useState<number | null>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);

  const navigateFolder = useCallback((folder: string) => {
    const url = new URL(window.location.href);
    if ((url.searchParams.get("thu-muc") || ALL) === folder) return;
    if (folder === ALL) url.searchParams.delete("thu-muc");
    else url.searchParams.set("thu-muc", folder);
    window.history.pushState({ documentLibraryFolder: true }, "", url);
    setActiveFolder(folder);
    setNewFolderOpen(false);
    setRenameOpen(false);
    setShowForm(false);
    setSelectedFileName("");
  }, []);

  useEffect(() => {
    const syncFolder = () => {
      setActiveFolder(new URL(window.location.href).searchParams.get("thu-muc") || "__all");
      setNewFolderOpen(false);
      setRenameOpen(false);
      setShowForm(false);
      setViewer(null);
      setEditing(null);
      setReplacingDoc(null);
    };
    syncFolder();
    window.addEventListener("popstate", syncFolder);
    const onBackspace = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable]")) return;
      const folder = new URL(window.location.href).searchParams.get("thu-muc");
      if (folder) {
        event.preventDefault();
        if (window.history.state?.documentLibraryFolder) window.history.back();
        else navigateFolder(folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : ALL);
      }
    };
    window.addEventListener("keydown", onBackspace);
    return () => {
      window.removeEventListener("popstate", syncFolder);
      window.removeEventListener("keydown", onBackspace);
    };
  }, [navigateFolder]);

  // Thư mục lưu dạng đường dẫn "Cha/Con"; hiển thị bằng " › ".
  const folderLabel = (path: string) => path.split("/").join(" › ");
  const inTree = (path: string, root: string) => path === root || path.startsWith(`${root}/`);
  const isRealFolder = activeFolder !== ALL && activeFolder !== NONE;
  const lastName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
  const subfolders = folders.filter((f) =>
    isRealFolder ? f.startsWith(`${activeFolder}/`) && !f.slice(activeFolder.length + 1).includes("/") : !f.includes("/"),
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await fetchDriveDocuments();
    setConfigured(res.configured);
    setItems(res.items);
    if (res.error) setErrorMsg(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    void fetchDocumentFolders().then((res) => {
      setFolders(res.folders);
      if (res.error) setErrorMsg(res.error);
    });
  }, [reload]);

  // Tài liệu gắn thư mục đã bị xóa khỏi danh sách coi như chưa phân loại.
  const folderOf = useCallback(
    (doc: DriveDocumentItem) => {
      const name = doc.appProperties?.thu_muc ?? "";
      return folders.includes(name) ? name : "";
    },
    [folders],
  );

  const filtered = useMemo(
    () =>
      [...items]
        .filter((d) =>
          activeFolder === ALL
            ? false
            : activeFolder === NONE
              ? folderOf(d) === ""
              : folderOf(d) === activeFolder,
        )
        .sort((a, b) => b.createdTime.localeCompare(a.createdTime)),
    [items, activeFolder, folderOf],
  );

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    const res = await createDocumentFolder(newFolderName, isRealFolder ? activeFolder : "");
    if (res.error) {
      setErrorMsg(res.error);
      setStatusMsg(null);
      return;
    }
    setFolders(res.folders);
    setNewFolderName("");
    setNewFolderOpen(false);
    setErrorMsg(null);
    setStatusMsg(`Đã tạo thư mục: ${folderLabel(res.created ?? "")}`);
  }

  async function handleRenameFolder(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await renameDocumentFolder(activeFolder, renameValue);
    setSaving(false);
    if (res.error) {
      setErrorMsg(res.error);
      setStatusMsg(null);
      return;
    }
    setFolders(res.folders);
    if (res.created) navigateFolder(res.created);
    setRenameOpen(false);
    setErrorMsg(null);
    setStatusMsg(`Đã đổi tên thư mục: ${folderLabel(res.created ?? "")}`);
    await reload();
  }

  async function handleDeleteFolder(path: string) {
    const count = items.filter((doc) => inTree(folderOf(doc), path)).length;
    if (!confirm(`Xóa thư mục "${folderLabel(path)}", toàn bộ thư mục con và ${count} tài liệu bên trong? Không thể hoàn tác.`)) return;
    setSaving(true);
    const res = await deleteDocumentFolder(path);
    setSaving(false);
    if (res.error) {
      await reload();
      setErrorMsg(res.error);
      setStatusMsg(null);
      return;
    }
    setFolders(res.folders);
    // Lùi về thư mục cha.
    navigateFolder(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ALL);
    setErrorMsg(null);
    setStatusMsg(`Đã xóa thư mục: ${folderLabel(path)}`);
    await reload();
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErrorMsg("Vui lòng chọn tệp PDF để tải lên.");
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
      uploadFolder ? { thu_muc: uploadFolder } : undefined,
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
    setSelectedFileName("");
    setShowForm(false);
    if (activeFolder === ALL) navigateFolder(uploadFolder || NONE);
    setStatusMsg(`Đã tải lên: ${title || file.name}`);
    await reload();
  }

  async function handleReplaceFile(e: React.FormEvent) {
    e.preventDefault();
    if (!replacingDoc) return;
    const file = replaceFileRef.current?.files?.[0];
    if (!file) {
      setErrorMsg("Vui lòng chọn tệp PDF mới để thay thế.");
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
      setErrorMsg(res.error || "Thay thế tệp thất bại.");
      return;
    }

    if (replaceFileRef.current) replaceFileRef.current.value = "";
    const docName = replacingDoc.name;
    setReplacingDoc(null);
    setStatusMsg(`Đã thay thế nội dung tệp thành công cho: ${docName}`);
    await reload();
  }

  async function handleDelete(doc: DriveDocumentItem) {
    if (!confirm(`Xóa tài liệu "${doc.name}"?`)) return;
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
    setStatusMsg(`Đã xóa tài liệu: ${doc.name}`);
    await reload();
  }

  function openEdit(doc: DriveDocumentItem) {
    setEditing(doc);
    // EN: ô tên hiển thị bản dịch; không sửa thì khi lưu vẫn giữ tên gốc.
    setTitle(lang === "en" ? t(doc.name) : doc.name);
    setDescription(doc.description || "");
    setEditFolder(folderOf(doc));
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
    if (!title.trim()) {
      setErrorMsg("Vui lòng nhập tên tài liệu.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);

    const savedTitle = lang === "en" && title === t(editing.name) ? editing.name : title;
    const res = await updateDriveDocumentMeta(
      editing.id,
      savedTitle,
      description,
      editFolder,
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
    "sr-only";

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
      {!configured && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-[#0047AB] shadow-xs">
          <strong>Lưu ý:</strong> Kho tài liệu chưa được thiết lập. Vui lòng liên hệ quản trị viên.
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
          <strong className="font-mono tabular-nums text-slate-900">{activeFolder === ALL ? items.length : filtered.length}</strong> tài liệu PDF
          {loading ? " · đang tải…" : ""}
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-xs">
        {/* Đường dẫn: Tất cả › Cha › Con */}
        <nav aria-label="Đường dẫn thư mục" className="mb-3 flex flex-wrap items-center gap-1 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => navigateFolder(ALL)}
            className={`rounded-md px-2 py-1 font-semibold cursor-pointer ${activeFolder === ALL ? "text-slate-900" : "text-[#0047AB] hover:bg-blue-50"}`}
          >
            Tất cả <span className="font-mono text-[11px] opacity-70">{items.length}</span>
          </button>
          {activeFolder === NONE && <span className="px-1 text-slate-400">›</span>}
          {activeFolder === NONE && <span className="px-2 py-1 font-semibold text-slate-900">Chưa phân loại</span>}
          {isRealFolder &&
            activeFolder.split("/").map((part, i, parts) => {
              const path = parts.slice(0, i + 1).join("/");
              const last = i === parts.length - 1;
              return (
                <span key={path} className="flex items-center gap-1">
                  <span className="px-1 text-slate-400">›</span>
                  <button
                    type="button"
                    onClick={() => navigateFolder(path)}
                    className={`rounded-md px-2 py-1 font-semibold cursor-pointer ${last ? "text-slate-900" : "text-[#0047AB] hover:bg-blue-50"}`}
                  >
                    {part}
                  </button>
                </span>
              );
            })}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          {activeFolder !== ALL && (
            <button
              type="button"
              onClick={() => navigateFolder(isRealFolder && activeFolder.includes("/") ? activeFolder.slice(0, activeFolder.lastIndexOf("/")) : ALL)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              ← Thư mục cha
            </button>
          )}

          {newFolderOpen ? (
            <form onSubmit={handleCreateFolder} className="flex items-center gap-1.5">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={isRealFolder ? "Tên thư mục con" : "Tên thư mục"}
                maxLength={80}
                className="h-9 w-44 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100"
              />
              <button type="submit" className="h-9 rounded-lg bg-[#0047AB] px-3 text-xs sm:text-sm font-semibold text-white hover:bg-[#00388A] cursor-pointer">
                Tạo
              </button>
              <button
                type="button"
                onClick={() => { setNewFolderOpen(false); setNewFolderName(""); }}
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
            </form>
          ) : (
            activeFolder !== NONE && (
              <button
                type="button"
                onClick={() => { setNewFolderOpen(true); setRenameOpen(false); }}
                className="rounded-lg border border-dashed border-[#0047AB]/50 bg-blue-50/50 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#0047AB] hover:bg-blue-50 cursor-pointer"
              >
                {isRealFolder ? "+ Tạo thư mục con" : "+ Tạo thư mục"}
              </button>
            )
          )}

          {isRealFolder && (
            renameOpen ? (
              <form onSubmit={handleRenameFolder} className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  maxLength={80}
                  className="h-9 w-44 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100"
                />
                <button type="submit" disabled={saving} className="h-9 rounded-lg bg-[#0047AB] px-3 text-xs sm:text-sm font-semibold text-white hover:bg-[#00388A] disabled:opacity-60 cursor-pointer">
                  Lưu tên
                </button>
                <button
                  type="button"
                  onClick={() => setRenameOpen(false)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => { setRenameValue(lastName(activeFolder)); setRenameOpen(true); setNewFolderOpen(false); }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Đổi tên
              </button>
            )
          )}
          {isRealFolder && (
            <button
              type="button"
              onClick={() => void handleDeleteFolder(activeFolder)}
              disabled={saving}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs sm:text-sm font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
            >
              Xóa thư mục này
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-xs">
        <button
          type="button"
          onClick={() => {
            setUploadFolder(isRealFolder ? activeFolder : "");
            setShowForm((v) => !v);
            setSelectedFileName("");
            closeEdit();
            setReplacingDoc(null);
            setErrorMsg(null);
            setStatusMsg(null);
          }}
          className="rounded-lg bg-[#0047AB] hover:bg-[#00388A] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer"
        >
          {showForm ? "Đóng biểu mẫu" : "Tải PDF lên"}
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
            Tải tài liệu PDF mới
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Tên tài liệu (không bắt buộc)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Để trống để dùng tên tệp PDF"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="document-pdf" className={labelClass}>Tệp PDF *</label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 p-2 text-sm focus-within:ring-2 focus-within:ring-blue-100">
                <span className="shrink-0 rounded bg-blue-50 px-3 py-1 font-semibold text-[#0047AB]">Chọn tệp</span>
                <span className="truncate">{selectedFileName || "Chưa chọn tệp"}</span>
              <input
                id="document-pdf"
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className={fileInputClass}
                onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name || "")}
              />
              </label>
            </div>
            <div>
              <label className={labelClass}>Thư mục</label>
              <select
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                className={inputClass}
              >
                <option value="">Chưa phân loại</option>
                {folders.map((f) => (
                  <option key={f} value={f}>{folderLabel(f)}</option>
                ))}
              </select>
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
                <span>Đang tải tài liệu lên...</span>
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
              Chỉnh sửa thông tin tài liệu
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
              />
            </div>
            <div>
              <label className={labelClass}>Dung lượng hiện tại</label>
              <div className="px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg font-mono">
                {formatFileSize(editing.size)}
              </div>
            </div>
            <div>
              <label className={labelClass}>Thư mục</label>
              <select
                value={editFolder}
                onChange={(e) => setEditFolder(e.target.value)}
                className={inputClass}
              >
                <option value="">Chưa phân loại</option>
                {folders.map((f) => (
                  <option key={f} value={f}>{folderLabel(f)}</option>
                ))}
              </select>
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
                Thay thế tệp tài liệu
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
                <label htmlFor="replacement-pdf" className={labelClass}>Chọn tệp PDF mới để thay thế *</label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 p-2 text-sm focus-within:ring-2 focus-within:ring-blue-100">
                  <span className="shrink-0 rounded bg-blue-50 px-3 py-1 font-semibold text-[#0047AB]">Chọn tệp</span>
                  <span className="truncate">{replacementFileName || "Chưa chọn tệp"}</span>
                <input
                  id="replacement-pdf"
                  ref={replaceFileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className={fileInputClass}
                  onChange={(event) => setReplacementFileName(event.target.files?.[0]?.name || "")}
                />
                </label>
                <p className="text-[11px] text-slate-500 mt-1">
                  Nội dung tệp mới thay thế tệp hiện tại, liên kết xem tài liệu không đổi.
                </p>
              </div>

              {replaceProgress !== null && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs font-semibold text-amber-700 mb-1">
                    <span>Đang cập nhật nội dung tệp...</span>
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

      {/* Bảng danh sách tài liệu */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[750px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Tên tài liệu & Định danh</th>
                <th className="px-4 py-3 w-32">Dung lượng</th>
                <th className="px-4 py-3 w-40">Ngày tải</th>
                <th className="px-4 py-3 w-px whitespace-nowrap text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(activeFolder === NONE ? [] : subfolders).map((folder) => (
                <tr key={folder} className="hover:bg-blue-50/50">
                  <td className="px-4 py-3.5">
                    <button type="button" onClick={() => navigateFolder(folder)} className="cursor-pointer font-semibold text-[#0047AB] hover:underline">
                      📁 {lastName(folder)}
                    </button>
                  </td>
                  <td colSpan={2} className="px-4 py-3.5 text-slate-500">
                    {items.filter((doc) => inTree(folderOf(doc), folder)).length} tài liệu
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-500">Thư mục</td>
                </tr>
              ))}
              {activeFolder === ALL && (
                <tr className="hover:bg-blue-50/50">
                  <td className="px-4 py-3.5">
                    <button type="button" onClick={() => navigateFolder(NONE)} className="cursor-pointer font-semibold text-[#0047AB] hover:underline">📁 Chưa phân loại</button>
                  </td>
                  <td colSpan={2} className="px-4 py-3.5 text-slate-500">{items.filter((doc) => !folderOf(doc)).length} tài liệu</td>
                  <td className="px-4 py-3.5 text-right text-slate-500">Thư mục</td>
                </tr>
              )}
              {filtered.length === 0 && activeFolder !== ALL && (activeFolder === NONE || subfolders.length === 0) ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    {loading ? "Đang tải tài liệu…" : "Thư mục chưa có tài liệu"}
                  </td>
                </tr>
              ) : (
                filtered.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                        <span>{doc.name}</span>
                        {folderOf(doc) && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#0047AB]">
                            {folderLabel(folderOf(doc))}
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
                    <td className="px-4 py-3.5">
                      <div className="flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap [&>a]:shrink-0 [&>button]:shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(doc)}
                          className="inline-flex h-8 min-w-12 items-center justify-center rounded-md border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplacingDoc(doc);
                            setReplacementFileName("");
                            setErrorMsg(null);
                            setStatusMsg(null);
                          }}
                          className="inline-flex h-8 min-w-12 items-center justify-center rounded-md border border-amber-200 px-2.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 cursor-pointer"
                        >
                          Thay tệp
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewer(doc)}
                          className="inline-flex h-8 min-w-12 items-center justify-center rounded-md border border-transparent px-2.5 text-xs font-semibold text-white bg-[#0047AB] hover:bg-[#00388A] cursor-pointer"
                        >
                          Xem
                        </button>
                        <a
                          href={`/api/documents/${doc.id}?download=1`}
                          className="inline-flex h-8 min-w-12 items-center justify-center rounded-md border border-emerald-200 px-2.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                        >
                          Tải về
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleDelete(doc)}
                          className="inline-flex h-8 min-w-12 items-center justify-center rounded-md border border-rose-200 px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal viewer — full màn hình */}
      {viewer && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white animate-in fade-in duration-150">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-3 bg-slate-50">
            <div className="font-bold text-slate-900 truncate pr-4 min-w-0">{viewer.name}</div>
            <button
              type="button"
              onClick={() => setViewer(null)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer shrink-0"
            >
              <X size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1 bg-slate-100">
            <iframe
              src={`/api/documents/${viewer.id}`}
              className="h-full w-full border-0"
              title={viewer.name}
            />
          </div>
        </div>
      )}
    </main>
  );
}
