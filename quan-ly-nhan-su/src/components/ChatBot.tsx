"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "@/components/icons";
import ContractForm, { type ContractData } from "@/components/ContractForm";
import ContractDocument from "@/components/ContractDocument";

type ChatMessage = { role: "user" | "model"; text: string; kind?: "contract-form" | "contract-done"; data?: ContractData };

/** Chatbot nổi góc phải dưới: bấm logo Thành Phát để mở cửa sổ chat (Gemini qua /api/chat). */
export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ContractData | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  function finishContract(index: number, data: ContractData) {
    setMessages((ms) => ms.map((m, i) => (i === index
      ? { role: "model", kind: "contract-done", data, text: "Đã tạo hợp đồng thành công. Bạn có muốn in không?" }
      : m)));
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, loading, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, text }) => ({ role, text })) }),
      });
      const data = (await response.json().catch(() => null)) as { text?: string; error?: string; action?: string } | null;
      if (!response.ok || !data?.text) throw new Error(data?.error || "Không nhận được phản hồi.");
      setMessages([...next, { role: "model", text: data.text, kind: data.action === "contract_form" ? "contract-form" : undefined }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
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
          <header className="flex items-center gap-3 bg-[#0047AB] px-4 py-3 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-9 w-9 rounded-full bg-white object-contain" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">Trợ lý AI Thành Phát</div>
              <div className="text-xs text-blue-100">Hỏi đáp nhanh về hệ thống</div>
            </div>
            <button
              type="button"
              onClick={() => { setMessages([]); setInput(""); setError(""); setPreview(null); }}
              disabled={loading || messages.length === 0}
              className="h-9 rounded-lg border border-white/40 px-3 text-xs font-semibold hover:bg-white/15 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/60 cursor-pointer disabled:cursor-default disabled:opacity-40"
            >
              Chat mới
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng cửa sổ chat"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/60 cursor-pointer"
            >
              <X size={18} weight="bold" aria-hidden />
            </button>
          </header>

          <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-[#f4f6fa] p-4">
            {messages.length === 0 && (
              <p className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-slate-600 shadow-2xs">
                Xin chào! Tôi là trợ lý AI của Thành Phát. Bạn cần hỗ trợ gì?
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.kind === "contract-form" ? (
                  <div className="w-full space-y-2">
                    <p className="text-sm text-slate-700">{m.text}</p>
                    <ContractForm onSubmit={(d) => finishContract(i, d)} />
                  </div>
                ) : (
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3.5 py-2.5 text-sm leading-relaxed shadow-2xs ${
                      m.role === "user" ? "bg-[#0047AB] text-white" : "bg-white text-slate-800"
                    }`}
                  >
                    {m.text}
                    {m.kind === "contract-done" && m.data && (
                      <button type="button" onClick={() => setPreview(m.data!)} className="mt-2 block h-9 w-full rounded-lg bg-[#0047AB] text-sm font-semibold text-white hover:bg-[#003d94] cursor-pointer">
                        In / Lưu PDF
                      </button>
                    )}
                  </div>
                )}
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
            className="flex gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi…"
              aria-label="Nội dung câu hỏi"
              maxLength={4000}
              autoFocus
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 text-sm outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
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
