"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DownloadSimple, FileText, Paperclip, X } from "@/components/icons";
import ContractForm, { CONTRACT_FIELDS, type ContractData } from "@/components/ContractForm";
import ContractDocument, { downloadContractDoc } from "@/components/ContractDocument";
import type { ChatModel } from "@/lib/chatModels";

type Citation = { documentId: string; page: number; title: string; revision: number };
type ChatMessage = { role: "user" | "model"; text: string; kind?: "contract-form" | "contract-done"; data?: ContractData; modelLabel?: string; elapsedMs?: number; citations?: Citation[] };

type Attached = { name: string; path: string; image: boolean; previewUrl?: string };

const contractComplete = (d: ContractData) => CONTRACT_FIELDS.every((f) => f.optional || d[f.key]?.trim());

const FILE_EXT = String.raw`(?:pdf|docx?|xlsx?|pptx?|txt|md|csv|zip|png|jpe?g|gif|webp|json)`;
/** [nhãn](path) hoặc [nhãn](<path>) — path Windows/Unix có đuôi tệp. */
const MD_FILE_LINK = new RegExp(
  String.raw`\[([^\]]+)\]\(\s*<?((?:[A-Za-z]:[\\/]|\\\\|\/)[^>\n]*?\.${FILE_EXT})>?\s*\)`,
  "gi",
);
/** Đường dẫn tuyệt đối tới tệp (không nằm trong markdown link). */
const BARE_FILE_PATH = new RegExp(
  String.raw`(?<![\w:])((?:[A-Za-z]:[\\/]|\\\\)[^\n<>"|?*]+?\.${FILE_EXT})\b`,
  "gi",
);

function fileBaseName(path: string) {
  const cleaned = path.replace(/^<|>$/g, "").trim();
  const parts = cleaned.split(/[\\/]/);
  return parts[parts.length - 1] || cleaned;
}

function knowledgeDownloadUrl(path: string) {
  return `/api/knowledge/download?path=${encodeURIComponent(path.replace(/^<|>$/g, "").trim())}`;
}

function FileDownloadChip({ path, label }: { path: string; label?: string }) {
  const name = fileBaseName(path);
  const title = label && label !== name ? label : name;
  return (
    <a
      href={knowledgeDownloadUrl(path)}
      download={name}
      title={path}
      className="my-1.5 flex max-w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-slate-800 no-underline shadow-2xs transition hover:border-[#0047AB]/40 hover:bg-blue-50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0047AB] text-white">
        <FileText size={18} weight="bold" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-500">{name}</span>
      </span>
      <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#0047AB] px-2.5 text-xs font-semibold text-white">
        <DownloadSimple size={14} weight="bold" aria-hidden />
        Tải về
      </span>
    </a>
  );
}

/** Hiện icon/nút tải khi tin nhắn có đường dẫn tệp hoặc markdown link tới file. */
function ChatRichText({ text, asUser }: { text: string; asUser?: boolean }) {
  const parts: ReactNode[] = [];
  const consumed = new Set<string>();
  type Hit = { start: number; end: number; path: string; label?: string };
  const hits: Hit[] = [];

  for (const re of [MD_FILE_LINK, BARE_FILE_PATH]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const path = (m[2] || m[1] || "").trim();
      if (!path) continue;
      const key = `${m.index}:${path.toLowerCase()}`;
      if (consumed.has(key)) continue;
      // Bỏ bare path trùng vùng đã khớp markdown link.
      if (hits.some((h) => m!.index >= h.start && m!.index < h.end)) continue;
      consumed.add(key);
      hits.push({
        start: m.index,
        end: m.index + m[0].length,
        path,
        label: m[2] ? m[1] : undefined,
      });
    }
  }

  hits.sort((a, b) => a.start - b.start);
  let cursor = 0;
  hits.forEach((hit, i) => {
    if (hit.start > cursor) {
      parts.push(<span key={`t-${i}`}>{text.slice(cursor, hit.start)}</span>);
    }
    parts.push(
      <FileDownloadChip
        key={`f-${i}-${hit.path}`}
        path={hit.path}
        label={asUser ? undefined : hit.label}
      />,
    );
    cursor = hit.end;
  });
  if (cursor < text.length) parts.push(<span key="t-end">{text.slice(cursor)}</span>);
  return <>{parts.length ? parts : text}</>;
}

/** Chatbot nổi góc phải dưới, dùng CLI/model được chọn qua /api/chat. */
export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ContractData | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<Attached[]>([]);
  const previewUrls = useRef(new Set<string>());
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sessionId = useRef(crypto.randomUUID()); // phiên CLI riêng cho mỗi cuộc chat/model
  const [models, setModels] = useState<ChatModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [knowledgeProjects, setKnowledgeProjects] = useState<{id:string;name:string}[]>([]);
  const [knowledgeProjectId, setKnowledgeProjectId] = useState('');

  useEffect(() => {
    if (!open) return;
    let active = true;
    void fetch('/api/document-knowledge').then(r => r.json()).then(data => {
      if (active && Array.isArray(data.projects)) setKnowledgeProjects(data.projects);
    }).catch(() => {});
    return () => { active = false; };
  }, [open]);

  function releasePreviews(attachments: Attached[]) {
    for (const file of attachments) {
      if (!file.previewUrl) continue;
      URL.revokeObjectURL(file.previewUrl);
      previewUrls.current.delete(file.previewUrl);
    }
  }

  function removeFile(file: Attached) {
    releasePreviews([file]);
    setFiles((current) => current.filter((item) => item.path !== file.path));
  }

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
    previewUrls.current.clear();
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setModelsLoading(true);
    void fetch("/api/chat/models").then(async (response) => {
      const data = await response.json() as { models?: ChatModel[]; defaultId?: string; antiError?: string; error?: string };
      if (!response.ok || !data.models?.length) throw new Error(data.error || "Không tải được danh sách model.");
      if (!active) return;
      setModels(data.models);
      setModelId((current) => data.models!.some((m) => m.id === current) ? current : data.defaultId || "");
      if (data.antiError) setError(data.antiError);
    }).catch((e: unknown) => {
      if (active) setError(e instanceof Error ? e.message : "Không tải được danh sách model.");
    }).finally(() => { if (active) setModelsLoading(false); });
    return () => { active = false; };
  }, [open]);

  function finishContract(index: number, data: ContractData) {
    setMessages((ms) => ms.map((m, i) => (i === index
      ? { ...m, role: "model", kind: "contract-done", data, text: "Đã tạo hợp đồng thành công. Tải file Word hoặc mở bản in bên dưới." }
      : m)));
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, loading, open]);

  async function upload(list: FileList | File[] | null) {
    if (!list?.length || loading || uploading) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(list).slice(0, 5 - files.length)) {
        const form = new FormData();
        form.append("file", file);
        form.append("sessionId", sessionId.current);
        const provider = knowledgeProjectId ? 'codex' : models.find((m) => m.id === modelId)?.provider;
        if (provider) form.append("provider", provider);
        const res = await fetch("/api/chat/upload", { method: "POST", body: form });
        const data = (await res.json().catch(() => null)) as (Attached & { error?: string }) | null;
        if (!res.ok || !data?.path) throw new Error(data?.error || `Không tải được ${file.name}.`);
        const previewUrl = data.image ? URL.createObjectURL(file) : undefined;
        if (previewUrl) previewUrls.current.add(previewUrl);
        setFiles((fs) => [...fs, { name: data.name, path: data.path, image: data.image, previewUrl }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được tệp.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function send() {
    const text = input.trim() || (files.length ? "Hãy đọc tệp đính kèm và tóm tắt nội dung chính." : "");
    if (!text || loading || uploading) return;
    const attachments = files;
    const shown = attachments.length ? `${text}\n${attachments.map((f) => `📎 ${f.name}`).join("\n")}` : text;
    const next: ChatMessage[] = [...messages, { role: "user", text: shown }];
    setMessages(next);
    setFiles([]);
    setInput("");
    setError("");
    setLoading(true);
    // eslint-disable-next-line react-hooks/purity -- Timing runs only in the submit event handler.
    const started = performance.now();
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, modelId: modelId || undefined, knowledgeProjectId: knowledgeProjectId || undefined, attachments, messages: next.map(({ role, text }) => ({ role, text })) }),
        signal: AbortSignal.timeout(120_000),
      });
      const data = (await response.json().catch(() => null)) as { text?: string; error?: string; action?: string; data?: ContractData; modelLabel?: string; citations?: Citation[] } | null;
      if (!response.ok || !data?.text) throw new Error(data?.error || "Không nhận được phản hồi.");
      // eslint-disable-next-line react-hooks/purity -- Timing runs only after the submitted request finishes.
      const meta = { modelLabel: data.modelLabel || models.find((m) => m.id === modelId)?.label || "Mặc định hệ thống", elapsedMs: Math.round(performance.now() - started) };
      const form = data.action === "contract_form";
      // Đủ thông tin từ hồ sơ → tạo luôn; thiếu → hiện form đã điền sẵn để bổ sung.
      if (form && data.data && contractComplete(data.data)) {
        setMessages([...next, { ...meta, role: "model", kind: "contract-done", data: data.data, text: "Đã tạo hợp đồng thành công. Tải file Word hoặc mở bản in bên dưới." }]);
      } else {
        setMessages([...next, { ...meta, role: "model", text: data.text, kind: form ? "contract-form" : undefined, data: data.data, citations: data.citations }]);
      }
      releasePreviews(attachments);
    } catch (e) {
      setMessages(messages);
      setFiles(attachments);
      setInput(input);
      setError(e instanceof Error && e.name === "TimeoutError" ? "Chưa nhận được kết quả sau 2 phút. Kiểm tra trạng thái tác vụ trước khi gửi lại." : e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    // Mobile: nằm trên thanh Back · Home · Load ở đáy màn hình.
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3 print:hidden lg:bottom-5 lg:right-5">
      {open && (
        <section
          role="dialog"
          aria-label="Trợ lý AI Thành Phát"
          className="flex h-[min(32rem,calc(100dvh-10rem))] w-[min(32rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <header className="flex shrink-0 items-center gap-2 bg-[#0047AB] px-4 py-3 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-9 w-9 shrink-0 rounded-full bg-white object-contain" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">Trợ lý AI Thành Phát</div>
              <div className="truncate text-xs text-blue-100">Hỏi đáp nhanh về hệ thống</div>
            </div>
            <select
              aria-label="Chọn CLI và model"
              title={knowledgeProjectId ? 'Codex Standard · Kho hồ sơ' : models.find((m) => m.id === modelId)?.label || "Chọn CLI và model"}
              value={knowledgeProjectId ? 'knowledge' : modelId}
              disabled={loading || uploading || modelsLoading || Boolean(knowledgeProjectId)}
              onChange={(e) => {
                setModelId(e.target.value);
                sessionId.current = crypto.randomUUID();
                setError("");
              }}
              className="h-9 w-24 shrink-0 truncate rounded-lg border border-white/40 bg-[#0047AB] px-2 text-xs text-white outline-hidden focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-50 sm:w-28"
            >
              <option value="" className="bg-white text-slate-800">{modelsLoading ? "Đang tải…" : "Mặc định"}</option>
              {knowledgeProjectId && <option value="knowledge" className="bg-white text-slate-800">Codex · Kho hồ sơ</option>}
              {(["codex", "anti", "gemini"] as const).map((provider) => models.some((m) => m.provider === provider) && (
                <optgroup key={provider} label={provider === "anti" ? "Anti CLI" : provider === "codex" ? "Codex CLI" : "Gemini API"} className="bg-white text-slate-800">
                  {models.filter((m) => m.provider === provider).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { sessionId.current = crypto.randomUUID(); releasePreviews(files); setFiles([]); setMessages([]); setInput(""); setError(""); setPreview(null); }}
              disabled={loading || uploading || (messages.length === 0 && files.length === 0 && !input.trim())}
              className="h-9 shrink-0 rounded-lg border border-white/40 px-3 text-xs font-semibold hover:bg-white/15 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/60 cursor-pointer disabled:cursor-default disabled:opacity-40"
            >
              Chat mới
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng cửa sổ chat"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/15 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/60 cursor-pointer"
            >
              <X size={18} weight="bold" aria-hidden />
            </button>
          </header>

          {knowledgeProjects.length > 0 && <label className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            Kho hồ sơ
            <select aria-label="Chọn kho hồ sơ để tra cứu" value={knowledgeProjectId} disabled={loading || uploading}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-[#0047AB]"
              onChange={e => { setKnowledgeProjectId(e.target.value); setMessages([]); releasePreviews(files); setFiles([]); setError(''); setInput(''); setPreview(null); sessionId.current = crypto.randomUUID(); }}>
              <option value="">Hệ thống chung</option>
              {knowledgeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>}

          <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-[#f4f6fa] p-4">
            {messages.length === 0 && (
              <p className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-slate-600 shadow-2xs">
                Xin chào! Tôi là trợ lý AI của Thành Phát. Bạn cần hỗ trợ gì?
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                {m.kind === "contract-form" ? (
                  <div className="w-full space-y-2">
                    <p className="text-sm text-slate-700">{m.text}</p>
                    <ContractForm initial={m.data} onSubmit={(d) => finishContract(i, d)} />
                  </div>
                ) : (
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3.5 py-2.5 text-sm leading-relaxed shadow-2xs ${
                      m.role === "user" ? "bg-[#0047AB] text-white" : "bg-white text-slate-800"
                    }`}
                  >
                    <ChatRichText text={m.text} asUser={m.role === "user"} />
                    {m.citations?.length ? <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs">
                      {m.citations.map(c => <li key={`${c.documentId}:${c.page}`}>
                        <a className="text-[#0047AB] underline underline-offset-2 focus-visible:outline-2" target="_blank" rel="noopener noreferrer"
                          href={`/api/document-knowledge/source?id=${encodeURIComponent(c.documentId)}&revision=${c.revision}#page=${c.page}`}>
                          {c.title} · trang {c.page}
                        </a>
                      </li>)}
                    </ul> : null}
                    {m.kind === "contract-done" && m.data && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => downloadContractDoc(m.data!)} className="h-9 rounded-lg bg-[#0047AB] text-sm font-semibold text-white hover:bg-[#003d94] cursor-pointer">
                          Tải file Word
                        </button>
                        <button type="button" onClick={() => setPreview(m.data!)} className="h-9 rounded-lg border border-[#0047AB] text-sm font-semibold text-[#0047AB] hover:bg-blue-50 cursor-pointer">
                          Xem / In
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {m.elapsedMs !== undefined && <p className="mt-1 text-[10px] text-slate-500">{m.modelLabel?.replace(/^(Anti CLI|Codex|Gemini API) · /, "")} · {(m.elapsedMs / 1000).toFixed(1)} giây</p>}
              </div>
            ))}
            {loading && <p className="text-xs text-slate-500">Đang trả lời…</p>}
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex shrink-0 flex-wrap items-end gap-2 border-t border-slate-200 bg-white p-3"
          >
            {files.length > 0 && (
              <ul className="flex w-full flex-wrap gap-1.5">
                {files.map((f) => (
                  f.image && f.previewUrl ? (
                    <li key={f.path} className="relative h-36 w-36 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.previewUrl} alt={f.name} className="h-full w-full object-contain" />
                      <button type="button" onClick={() => removeFile(f)} aria-label={`Bỏ tệp ${f.name}`} className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-white hover:bg-slate-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white cursor-pointer">
                        <X size={12} weight="bold" aria-hidden />
                      </button>
                    </li>
                  ) : (
                    <li key={f.path} className="flex max-w-full items-center gap-1 rounded-lg bg-slate-100 py-1 pl-2.5 pr-1 text-xs text-slate-700">
                      <span className="truncate">{f.name}</span>
                      <button type="button" onClick={() => removeFile(f)} aria-label={`Bỏ tệp ${f.name}`} className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-slate-200 cursor-pointer">
                        <X size={12} weight="bold" aria-hidden />
                      </button>
                    </li>
                  )
                ))}
              </ul>
            )}
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={loading || uploading || files.length >= 5}
              aria-label="Đính kèm tệp"
              title="Đính kèm tệp (tối đa 5 tệp, 25 MB mỗi tệp)"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer disabled:cursor-default disabled:opacity-40"
            >
              <Paperclip size={20} aria-hidden />
            </button>
            <textarea
              value={input}
              onPaste={(e) => {
                const imageItems = Array.from(e.clipboardData.items).filter((item) => item.type.startsWith("image/"));
                if (!imageItems.length) return;
                e.preventDefault();
                if (files.length >= 5) { setError("Chat chỉ nhận tối đa 5 tệp."); return; }
                const items = imageItems.filter((item) => /^image\/(png|jpe?g|gif|webp)$/i.test(item.type));
                if (!items.length) { setError("Ảnh dán chỉ hỗ trợ PNG, JPG, GIF hoặc WebP."); return; }
                const images = items.map((item, i) => {
                  const file = item.getAsFile();
                  return file && (file.name ? file : new File([file], `clipboard-${Date.now()}-${i + 1}.${file.type.split("/")[1] || "png"}`, { type: file.type }));
                }).filter((file): file is File => Boolean(file));
                if (images.length) void upload(images);
                else setError("Không đọc được ảnh trong clipboard.");
              }}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={uploading ? "Đang tải tệp…" : "Nhập câu hỏi…"}
              aria-label="Nội dung câu hỏi"
              aria-keyshortcuts="Enter"
              title="Enter để gửi; Shift+Enter để xuống dòng"
              maxLength={4000}
              rows={1}
              autoFocus
              className="h-11 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm leading-5 outline-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
            />
            <button
              type="submit"
              disabled={loading || uploading || (!input.trim() && !files.length)}
              className="h-11 rounded-xl bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#003d94] cursor-pointer disabled:cursor-default disabled:opacity-40"
            >
              Gửi
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Đóng trợ lý AI" : "Mở trợ lý AI"}
        title="Trợ lý AI Thành Phát"
        className="h-14 w-14 overflow-hidden rounded-full bg-white shadow-xl ring-2 ring-[#0047AB] transition-transform hover:scale-105 focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-[#0047AB]/40 cursor-pointer"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-full w-full object-contain" />
      </button>
      {preview && <ContractDocument data={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
