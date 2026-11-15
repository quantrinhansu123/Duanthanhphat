"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowsClockwise,
  Buildings,
  CaretRight,
  Check,
  CopySimple,
  DownloadSimple,
  Eye,
  FileText,
  Files,
  X,
} from "@/components/icons";
import { useAccess } from "@/lib/useAccess";
import DocumentKnowledgePanel from './DocumentKnowledgePanel';

type AiQsDocKind =
  | "Hợp đồng"
  | "HSTT / IPC"
  | "Phụ lục"
  | "Tạm ứng"
  | "Bản vẽ"
  | "Quyết toán"
  | "Bảng theo dõi"
  | "Khác";

type AiQsNode = {
  id: string;
  name: string;
  kind: "folder" | "file";
  path?: string;
  relative: string;
  depth: number;
  children?: AiQsNode[];
  size?: number;
  modifiedAt?: string;
  ext?: string;
  docKind?: AiQsDocKind;
  side?: "A" | "B" | null;
  files?: number;
  folders?: number;
};

type TreeResponse = {
  legacyRestricted?: boolean;
  rootName?: string;
  root?: string;
  knowledgeRelative?: string;
  totalFiles?: number;
  totalFolders?: number;
  byKind?: Record<string, number>;
  tree?: AiQsNode[];
  error?: string;
};

const DOC_COLORS: Record<AiQsDocKind, string> = {
  "Hợp đồng": "bg-blue-50 text-blue-800",
  "HSTT / IPC": "bg-emerald-50 text-emerald-800",
  "Phụ lục": "bg-amber-50 text-amber-900",
  "Tạm ứng": "bg-violet-50 text-violet-800",
  "Bản vẽ": "bg-cyan-50 text-cyan-800",
  "Quyết toán": "bg-rose-50 text-rose-800",
  "Bảng theo dõi": "bg-slate-100 text-slate-700",
  "Khác": "bg-slate-50 text-slate-600",
};

const PREVIEWABLE = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp", "txt", "md", "csv"]);

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
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

function fileUrl(relative: string, inline = false) {
  const q = new URLSearchParams({ path: relative });
  if (inline) q.set("inline", "1");
  return `/api/ai-qs/download?${q.toString()}`;
}

function filterNodes(nodes: AiQsNode[], q: string, kindFilter: string): AiQsNode[] {
  if (!q && !kindFilter) return nodes;
  const out: AiQsNode[] = [];
  for (const node of nodes) {
    if (node.kind === "file") {
      const hay = `${node.name} ${node.docKind ?? ""}`.toLowerCase();
      if (kindFilter && node.docKind !== kindFilter) continue;
      if (q && !hay.includes(q)) continue;
      out.push(node);
      continue;
    }
    const children = filterNodes(node.children ?? [], q, kindFilter);
    const selfHit = !kindFilter && (!q || node.name.toLowerCase().includes(q));
    if (children.length || selfHit) out.push({ ...node, children: q || kindFilter ? children : node.children });
  }
  return out;
}

export default function AiQsLibrary() {
  const { can } = useAccess();
  const canView = can("hoso-ai-qs", "view");

  const [data, setData] = useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  /** Đường dẫn drill-down: [] = gốc cây */
  const [pathIds, setPathIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<AiQsNode | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ai-qs", { cache: "no-store" });
      const json = (await res.json()) as TreeResponse;
      if (!res.ok) throw new Error(json.error || "Không tải được cây hồ sơ.");
      setData(json);
      if (json.error) setErrorMsg(json.error);
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Không tải được cây hồ sơ.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) void reload();
    else setLoading(false);
  }, [canView, reload]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const crumbs = useMemo(() => {
    const tree = data?.tree ?? [];
    const items: { id: string; name: string; node: AiQsNode }[] = [];
    let level = tree;
    for (const id of pathIds) {
      const node = level.find((n) => n.id === id);
      if (!node) break;
      items.push({ id: node.id, name: node.name, node });
      level = node.children ?? [];
    }
    return items;
  }, [data, pathIds]);

  const currentNodes = useMemo(() => {
    const tree = data?.tree ?? [];
    if (!pathIds.length) return tree;
    const last = crumbs[crumbs.length - 1]?.node;
    return last?.children ?? [];
  }, [data, pathIds, crumbs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return filterNodes(currentNodes, q, kindFilter);
  }, [currentNodes, query, kindFilter]);

  const currentFolder = crumbs[crumbs.length - 1]?.node ?? null;

  function enterFolder(node: AiQsNode) {
    if (node.kind !== "folder") return;
    setPathIds((prev) => [...prev, node.id]);
    setQuery("");
  }

  function goCrumb(index: number) {
    if (index < 0) setPathIds([]);
    else setPathIds((prev) => prev.slice(0, index + 1));
  }

  function openPreview(node: AiQsNode) {
    if (node.kind !== "file") return;
    setPreview(node);
  }

  function canPreview(node: AiQsNode) {
    return PREVIEWABLE.has((node.ext || "").toLowerCase());
  }

  function fullPath(node: AiQsNode) {
    if (node.path) return node.path.replace(/\//g, "\\");
    const root = (data?.root || "").replace(/[/\\]+$/, "");
    const rel = node.relative.replace(/\//g, "\\");
    return root ? `${root}\\${rel}` : rel;
  }

  async function copyPath(node: AiQsNode) {
    const text = fullPath(node);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopiedId(node.id);
    setStatusMsg(`Đã copy đường dẫn: ${text}`);
    window.setTimeout(() => {
      setCopiedId((cur) => (cur === node.id ? null : cur));
      setStatusMsg((cur) => (cur?.includes(text) ? null : cur));
    }, 2500);
  }

  if (!canView) {
    return (
      <main className="w-full px-4 sm:px-6 pb-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
          Bạn chưa có quyền xem hồ sơ AI_QS.
        </div>
      </main>
    );
  }

  const byKind = data?.byKind ?? {};
  if(data?.legacyRestricted) return <main className="w-full px-4 sm:px-6 pb-8"><DocumentKnowledgePanel /></main>;
  const previewExt = (preview?.ext || "").toLowerCase();
  const previewIsImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(previewExt);
  const previewIsPdf = previewExt === "pdf";
  const previewIsText = ["txt", "md", "csv"].includes(previewExt);

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
      <DocumentKnowledgePanel />
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{data?.totalFolders ?? 0}</strong> thư mục
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="font-semibold text-slate-900 font-mono tabular-nums">{data?.totalFiles ?? 0}</strong> tệp
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500 truncate" title={data?.root}>
          Cây hồ sơ <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">{data?.rootName || "20. Hồ sơ phục vụ AI_QS"}</code>
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {Object.entries(byKind)
          .sort((a, b) => b[1] - a[1])
          .map(([kind, count]) => (
            <button
              key={kind}
              type="button"
              onClick={() => setKindFilter((cur) => (cur === kind ? "" : kind))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                kindFilter === kind
                  ? "border-[#0047AB] bg-[#0047AB] text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {kind}
              <span className={`font-mono tabular-nums ${kindFilter === kind ? "text-white/80" : "text-slate-500"}`}>{count}</span>
            </button>
          ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
        <button
          type="button"
          onClick={() => goCrumb(-1)}
          className={`rounded-md px-2 py-1 font-medium transition ${pathIds.length === 0 ? "bg-slate-100 text-slate-900" : "text-[#0047AB] hover:bg-blue-50"}`}
        >
          Gốc
        </button>
        {crumbs.map((c, i) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 min-w-0">
            <CaretRight size={12} className="shrink-0 text-slate-400" aria-hidden />
            <button
              type="button"
              onClick={() => goCrumb(i)}
              className={`truncate rounded-md px-2 py-1 font-medium transition max-w-[220px] ${
                i === crumbs.length - 1 ? "bg-slate-100 text-slate-900" : "text-[#0047AB] hover:bg-blue-50"
              }`}
              title={c.name}
            >
              {c.name}
            </button>
          </span>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        {pathIds.length > 0 && (
          <button
            type="button"
            onClick={() => goCrumb(pathIds.length - 2)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={15} aria-hidden />
            Quay lại
          </button>
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={currentFolder ? `Tìm trong «${currentFolder.name}»…` : "Tìm trong thư mục hiện tại…"}
          className="h-10 min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-800 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
        />
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <ArrowsClockwise size={15} aria-hidden />
          Làm mới
        </button>
      </div>

      {errorMsg && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{errorMsg}</div>
      )}
      {statusMsg && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800 break-all">{statusMsg}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3">Sơ đồ cây hồ sơ</th>
                <th className="w-[130px] px-3.5 py-3">Phân loại</th>
                <th className="w-[72px] px-3.5 py-3">Bên</th>
                <th className="w-[80px] px-3.5 py-3">Định dạng</th>
                <th className="w-[100px] px-3.5 py-3">Dung lượng</th>
                <th className="w-[160px] px-3.5 py-3">Cập nhật</th>
                <th className="w-[150px] px-3.5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">Đang đọc cây thư mục…</td>
                </tr>
              )}
              {!loading &&
                filtered.map((node) => {
                  const isFolder = node.kind === "folder";
                  return (
                    <tr
                      key={node.id}
                      className="transition-colors duration-150 hover:bg-slate-50/80 cursor-pointer"
                      onClick={() => (isFolder ? enterFolder(node) : openPreview(node))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (isFolder) enterFolder(node);
                          else openPreview(node);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={isFolder ? `Vào thư mục ${node.name}` : `Xem ${node.name}`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          {isFolder ? (
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500">
                              <CaretRight size={14} weight="bold" aria-hidden />
                            </span>
                          ) : (
                            <span className="inline-block h-7 w-7 shrink-0" />
                          )}
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              isFolder
                                ? node.side === "A"
                                  ? "bg-sky-100 text-sky-700"
                                  : node.side === "B"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-slate-100 text-slate-600"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {isFolder ? (pathIds.length === 0 ? <Buildings size={16} /> : <Files size={16} />) : <FileText size={16} />}
                          </span>
                          <div className="min-w-0">
                            <div
                              className={`truncate ${isFolder ? "font-semibold text-slate-900" : "font-medium text-[#0047AB] hover:underline"}`}
                              title={node.relative || node.name}
                            >
                              {node.name}
                            </div>
                            {isFolder && (
                              <div className="text-[11px] text-slate-500">
                                {node.folders ?? 0} thư mục · {node.files ?? 0} tệp · bấm để vào sâu
                              </div>
                            )}
                            {!isFolder && (
                              <div className="text-[11px] text-slate-500">
                                {canPreview(node) ? "Bấm để xem demo" : "Bấm để mở / tải về"}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        {node.docKind ? (
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${DOC_COLORS[node.docKind]}`}>
                            {node.docKind}
                          </span>
                        ) : isFolder ? (
                          <span className="text-slate-400">Thư mục</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        {node.side ? (
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${node.side === "A" ? "bg-sky-50 text-sky-800" : "bg-orange-50 text-orange-800"}`}>
                            Bên {node.side}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono uppercase text-slate-600">{node.ext || "—"}</td>
                      <td className="px-3.5 py-2.5 font-mono tabular-nums text-slate-700">{isFolder ? "—" : formatFileSize(node.size)}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{isFolder ? "—" : formatDate(node.modifiedAt)}</td>
                      <td className="px-3.5 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => void copyPath(node)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                              copiedId === node.id
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 text-slate-600 hover:border-[#0047AB]/40 hover:bg-blue-50 hover:text-[#0047AB]"
                            }`}
                            title={`Copy đường dẫn\n${fullPath(node)}`}
                            aria-label={`Copy đường dẫn ${node.name}`}
                          >
                            {copiedId === node.id ? <Check size={15} weight="bold" aria-hidden /> : <CopySimple size={15} aria-hidden />}
                          </button>
                          {isFolder ? (
                            <button
                              type="button"
                              onClick={() => enterFolder(node)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:border-[#0047AB]/40 hover:bg-blue-50 hover:text-[#0047AB]"
                            >
                              Vào
                              <CaretRight size={12} weight="bold" aria-hidden />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => openPreview(node)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-[#0047AB]/40 hover:bg-blue-50 hover:text-[#0047AB]"
                                title="Xem demo"
                                aria-label={`Xem ${node.name}`}
                              >
                                <Eye size={15} aria-hidden />
                              </button>
                              <a
                                href={fileUrl(node.relative)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-[#0047AB]/40 hover:bg-blue-50 hover:text-[#0047AB]"
                                title="Tải về"
                                aria-label={`Tải ${node.name}`}
                                download={node.name}
                              >
                                <DownloadSimple size={15} aria-hidden />
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <div className="text-sm font-semibold text-slate-800">Thư mục trống hoặc không có mục phù hợp</div>
                    <div className="mt-1 text-xs text-slate-500">Bấm «Quay lại» hoặc đổi bộ lọc.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white animate-in fade-in duration-150">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 sm:px-6 py-3">
            <div className="min-w-0">
              <div className="truncate font-bold text-slate-900" title={preview.name}>{preview.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {preview.docKind && (
                  <span className={`rounded-md px-2 py-0.5 font-semibold ${DOC_COLORS[preview.docKind]}`}>{preview.docKind}</span>
                )}
                <span className="font-mono uppercase">{preview.ext || "file"}</span>
                <span>·</span>
                <span className="font-mono tabular-nums">{formatFileSize(preview.size)}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={fileUrl(preview.relative)}
                download={preview.name}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <DownloadSimple size={15} aria-hidden />
                Tải về
              </a>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                aria-label="Đóng xem demo"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 bg-slate-100">
            {previewIsPdf || previewIsText ? (
              <iframe
                src={fileUrl(preview.relative, true)}
                className="h-full w-full border-0 bg-white"
                title={preview.name}
              />
            ) : previewIsImage ? (
              <div className="flex h-full items-center justify-center overflow-auto p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(preview.relative, true)}
                  alt={preview.name}
                  className="max-h-full max-w-full object-contain shadow-lg"
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <FileText size={40} className="text-slate-400" aria-hidden />
                <div className="text-base font-semibold text-slate-800">Không xem demo trực tiếp được định dạng này</div>
                <div className="max-w-md text-sm text-slate-500">
                  File Word/Excel cần mở bằng ứng dụng. Anh có thể tải về để xem.
                </div>
                <a
                  href={fileUrl(preview.relative)}
                  download={preview.name}
                  className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388a]"
                >
                  <DownloadSimple size={16} aria-hidden />
                  Tải {preview.name}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
