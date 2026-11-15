"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DownloadSimple, FileText, TrashSimple, UploadSimple } from "@/components/icons";
import { useAccess } from "@/lib/useAccess";

type KnowledgeFileItem = {
  name: string;
  size: number;
  modifiedAt: string;
  ext: string;
};

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
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

export default function KnowledgeLibrary() {
  const { can } = useAccess();
  const canEdit = can("file-tri-thuc", "edit");
  const canDelete = can("file-tri-thuc", "delete");

  const [items, setItems] = useState<KnowledgeFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/knowledge", { cache: "no-store" });
      const data = (await res.json()) as { items?: KnowledgeFileItem[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Không tải được danh sách.");
      setItems(data.items ?? []);
      if (data.error) setErrorMsg(data.error);
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Không tải được danh sách.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, query]);

  async function handleUpload(list: FileList | null) {
    if (!list?.length || !canEdit || uploading) return;
    setUploading(true);
    setErrorMsg(null);
    setStatusMsg(null);

    let ok = 0;
    const errors: string[] = [];
    for (const file of Array.from(list)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/knowledge", { method: "POST", body: form });
        const data = (await res.json()) as { item?: KnowledgeFileItem; error?: string };
        if (!res.ok) throw new Error(data.error || `Không tải lên được ${file.name}`);
        ok += 1;
      } catch (error: unknown) {
        errors.push(error instanceof Error ? error.message : `Lỗi: ${file.name}`);
      }
    }

    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
    if (ok) setStatusMsg(`Đã thêm ${ok} tệp vào thư mục Tri thức.`);
    if (errors.length) setErrorMsg(errors.join(" · "));
    await reload();
  }

  async function handleDelete(item: KnowledgeFileItem) {
    if (!canDelete) return;
    if (!confirm(`Xóa tệp "${item.name}" khỏi thư mục Tri thức?`)) return;
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/knowledge/${encodeURIComponent(item.name)}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Không xóa được tệp.");
      setStatusMsg(`Đã xóa: ${item.name}`);
      setItems((current) => current.filter((row) => row.name !== item.name));
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Không xóa được tệp.");
    }
  }

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{items.length}</strong> tệp
          tri thức
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500">Lưu tại thư mục workspace <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">Tri thức</code></span>
      </div>

      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên tệp…"
          className="h-10 min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-800 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
        />

        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => void handleUpload(e.target.files)}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00388a] disabled:opacity-60"
            >
              <UploadSimple size={16} weight="bold" aria-hidden />
              {uploading ? "Đang tải lên…" : "Thêm tệp"}
            </button>
          </>
        )}
      </div>

      {errorMsg && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{errorMsg}</div>
      )}
      {statusMsg && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">{statusMsg}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Tên tệp</th>
                <th className="w-[100px] px-3.5 py-3">Loại</th>
                <th className="w-[110px] px-3.5 py-3">Dung lượng</th>
                <th className="w-[170px] px-3.5 py-3">Cập nhật</th>
                <th className="w-[140px] px-3.5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    Đang tải…
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((item) => (
                  <tr key={item.name} className="transition-colors duration-150 hover:bg-slate-50/80">
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <FileText size={16} aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900" title={item.name}>
                            {item.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-3.5 font-mono text-slate-600 uppercase">{item.ext || "—"}</td>
                    <td className="px-3.5 py-3.5 font-mono tabular-nums text-slate-700">{formatFileSize(item.size)}</td>
                    <td className="px-3.5 py-3.5 text-slate-600">{formatDate(item.modifiedAt)}</td>
                    <td className="px-3.5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/api/knowledge/download?path=${encodeURIComponent(item.name)}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-[#0047AB]/40 hover:bg-blue-50 hover:text-[#0047AB]"
                          title="Tải về"
                          aria-label={`Tải ${item.name}`}
                          download={item.name}
                        >
                          <DownloadSimple size={15} aria-hidden />
                        </a>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(item)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                            title="Xóa"
                            aria-label={`Xóa ${item.name}`}
                          >
                            <TrashSimple size={15} aria-hidden />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">
                      {items.length === 0 ? "Chưa có tệp tri thức" : "Không tìm thấy tệp phù hợp"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {canEdit ? "Bấm “Thêm tệp” để đưa file vào thư mục Tri thức." : "Bạn chỉ có quyền xem."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
