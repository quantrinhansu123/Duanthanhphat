"use client";

import { useRef, useState } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  FileArrowUp,
  Files,
  ShieldCheck,
  WarningCircle,
} from "@/components/icons";
import CapBadge from "@/components/ai-report/CapBadge";
import {
  readAuthorizedFilesBatch,
  type ExtractedWordContract,
  type FolderReadItemStatus,
} from "@/lib/aiReportDemo";

type DirEntryLike = {
  kind: "file" | "directory";
  name: string;
  getFile?: () => Promise<File>;
  values?: () => AsyncIterable<DirEntryLike>;
};

type DirHandleLike = {
  name: string;
  values: () => AsyncIterable<DirEntryLike>;
  queryPermission?: (opts: { mode: "read" }) => Promise<string>;
  requestPermission?: (opts: { mode: "read" }) => Promise<string>;
};

async function collectFromDirectoryHandle(handle: DirHandleLike, maxDepth = 1): Promise<File[]> {
  const out: File[] = [];
  async function walk(dir: DirHandleLike, depth: number) {
    for await (const entry of dir.values()) {
      if (out.length >= 60) break;
      if (entry.kind === "file" && entry.getFile) {
        try {
          out.push(await entry.getFile());
        } catch {
          // Bỏ qua tệp không cấp quyền đọc
        }
      } else if (entry.kind === "directory" && depth < maxDepth && entry.values) {
        await walk(entry as unknown as DirHandleLike, depth + 1);
      }
    }
  }
  await walk(handle, 0);
  return out;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FolderReaderPanel({
  onDocsAdded,
  onAudit,
}: {
  onDocsAdded: (newDocs: ExtractedWordContract[]) => void;
  onAudit: (action: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<FolderReadItemStatus[]>([]);
  const [truncatedCount, setTruncatedCount] = useState(0);
  const [folderLabel, setFolderLabel] = useState("");
  const [error, setError] = useState("");
  const [hasDirHandle, setHasDirHandle] = useState(false);
  const dirHandleRef = useRef<DirHandleLike | null>(null);
  const fallbackDirInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processFiles(files: File[], label: string) {
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      const result = await readAuthorizedFilesBatch(files);
      setItems(result.items);
      setTruncatedCount(result.truncatedCount);
      setFolderLabel(label);
      if (result.docs.length > 0) {
        onDocsAdded(result.docs);
      }
      const skipped = result.items.filter((i) => i.status !== "read").length;
      onAudit(`Đọc cục bộ ${result.docs.length} tệp hợp đồng (bỏ qua ${skipped} tệp không hỗ trợ/quá cỡ)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đọc các tệp đã chọn.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePickFolder() {
    setError("");
    const picker =
      typeof window !== "undefined"
        ? (window as unknown as { showDirectoryPicker?: (opts?: { mode?: "read" }) => Promise<DirHandleLike> })
            .showDirectoryPicker
        : undefined;

    if (typeof picker === "function") {
      try {
        const handle = await picker({ mode: "read" });
        dirHandleRef.current = handle;
        setHasDirHandle(true);
        const collected = await collectFromDirectoryHandle(handle, 1);
        await processFiles(collected, `Thư mục đã cấp quyền (chỉ đọc · ${collected.length} tệp phát hiện)`);
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Fallback sang input webkitdirectory nếu trình duyệt chặn File System Access API
      }
    }
    fallbackDirInputRef.current?.click();
  }

  async function handleRescan() {
    const handle = dirHandleRef.current;
    if (!handle) {
      fallbackDirInputRef.current?.click();
      return;
    }
    setError("");
    try {
      if (handle.queryPermission && handle.requestPermission) {
        const state = await handle.queryPermission({ mode: "read" });
        if (state !== "granted") {
          const next = await handle.requestPermission({ mode: "read" });
          if (next !== "granted") {
            setError("Chưa được cấp lại quyền đọc thư mục.");
            return;
          }
        }
      }
      const collected = await collectFromDirectoryHandle(handle, 1);
      await processFiles(collected, `Quét lại thư mục đã cấp quyền (${collected.length} tệp)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không quét lại được thư mục.");
    }
  }

  const summary = {
    read: items.filter((i) => i.status === "read").length,
    skipped: items.filter((i) => i.status === "skipped-ocr" || i.status === "skipped-unsupported" || i.status === "rejected-oversize").length,
    errors: items.filter((i) => i.status === "error").length,
  };

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5" aria-label="Tự động đọc thư mục hợp đồng được cấp quyền">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0047AB]/10 px-3 py-1 text-xs font-bold text-[#0047AB]">
              <Files size={14} weight="bold" aria-hidden />
              Tự động đọc thư mục cục bộ được cấp quyền
            </span>
            <CapBadge capability="real" compact />
            <CapBadge capability="sim" compact />
          </div>
          <h2 className="mt-1.5 text-base font-bold text-slate-900">
            Đọc hàng loạt tệp hợp đồng (.docx, .txt, .md) trực tiếp trong bộ nhớ trình duyệt
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            Trình duyệt yêu cầu bạn chọn rõ thư mục hoặc tệp (chỉ đọc, tối đa 50 tệp · 10 MB/tệp, quét tối đa 1 cấp thư mục con). Không tải tệp lên máy chủ, không ghi đè tệp gốc, không lưu đường dẫn ổ đĩa hay lưu quyền truy cập sau khi tải lại trang. Các tệp <b>.pdf / .doc cũ / ảnh scan</b> được gắn nhãn <b>cần OCR — Mô phỏng</b>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fallbackDirInputRef}
            type="file"
            multiple
            // @ts-expect-error webkitdirectory supported by Chromium/Firefox/Safari fallback
            webkitdirectory=""
            className="hidden"
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              e.target.value = "";
              void processFiles(list, `Thư mục đã chọn cục bộ (${list.length} tệp)`);
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".docx,.txt,.md,.pdf,.doc"
            className="hidden"
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              e.target.value = "";
              void processFiles(list, `Tệp đã chọn cục bộ (${list.length} tệp)`);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePickFolder()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#0047AB] px-3.5 text-xs font-semibold text-white hover:bg-[#00388A] disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/40"
          >
            <Files size={15} aria-hidden />
            {busy ? "Đang đọc thư mục…" : "Chọn thư mục được phép"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#0047AB] bg-white px-3 text-xs font-semibold text-[#0047AB] hover:bg-blue-50 disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/40"
          >
            <FileArrowUp size={15} aria-hidden />
            Chọn tệp (.docx / .txt / .md)
          </button>
          {hasDirHandle ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRescan()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <ArrowClockwise size={14} aria-hidden />
              Quét lại
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <WarningCircle size={15} weight="fill" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
              <ShieldCheck size={15} className="text-emerald-700" aria-hidden />
              {folderLabel}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-900">Đã đọc: {summary.read}</span>
              <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-950">Bỏ qua / Cần OCR: {summary.skipped}</span>
              {summary.errors > 0 ? (
                <span className="rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-800">Lỗi: {summary.errors}</span>
              ) : null}
              {truncatedCount > 0 ? (
                <span className="rounded bg-slate-200 px-2 py-0.5 font-semibold text-slate-700">
                  +{truncatedCount} tệp vượt ngưỡng 50 tệp/lần
                </span>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-100 text-[11px] text-slate-600">
                <tr>
                  <th className="border-b px-2.5 py-2 font-bold">Tên tệp (ẩn đường dẫn ổ đĩa)</th>
                  <th className="border-b px-2.5 py-2 text-right font-bold">Dung lượng</th>
                  <th className="border-b px-2.5 py-2 font-bold">Trạng thái</th>
                  <th className="border-b px-2.5 py-2 font-bold">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={`${item.name}-${idx}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-2.5 py-2 font-semibold text-slate-900">{item.name}</td>
                    <td className="px-2.5 py-2 text-right font-mono text-[11px] text-slate-500">{formatSize(item.sizeBytes)}</td>
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      {item.status === "read" ? (
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800">
                          <CheckCircle size={12} weight="fill" aria-hidden />
                          Đã đọc ({item.avgConfidence ?? 0}%)
                        </span>
                      ) : item.status === "skipped-ocr" ? (
                        <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-950">
                          OCR · Mô phỏng
                        </span>
                      ) : item.status === "rejected-oversize" ? (
                        <span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10.5px] font-bold text-rose-800">
                          Quá 10 MB
                        </span>
                      ) : (
                        <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-700">
                          Bỏ qua
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-[11px] text-slate-600">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 text-xs text-slate-600">
          Chưa chọn thư mục nào trong phiên này. Bấm <b>«Chọn thư mục được phép»</b> hoặc <b>«Chọn tệp (.docx / .txt / .md)»</b> để tự động tách trường và đẩy vào kho trích xuất, trình soạn hợp đồng mới và bảng thống kê bên dưới.
        </div>
      )}
    </section>
  );
}
