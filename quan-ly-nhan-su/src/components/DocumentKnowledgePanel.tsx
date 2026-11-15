"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FACT_KINDS,
  FACT_LABELS,
  KNOWLEDGE_METRICS,
  formatVnd,
  type FactKind,
} from "@/lib/documentKnowledge";
import { useAccess } from "@/lib/useAccess";

type Project = {
  id: string;
  name: string;
  owner_id: string;
  role: "owner" | "editor" | "viewer";
};
type Doc = {
  id: string;
  name: string;
  revision: number;
  state: string;
  review_state: string;
  page_count: number | null;
  error_code: string | null;
};
type Fact = {
  id: string;
  contract_code: string;
  kind: FactKind;
  amount: string | null;
  event_date: string | null;
  period_index: number | null;
  business_key: string;
  source_page: number;
  quote: string;
  status: string;
  review_version: number;
};
type Detail = { document: Doc; facts: Fact[]; facts_total: number };
type Summary = {
  total_vnd: string | null;
  complete: boolean;
  documents_total: number;
  documents_ready: number;
  documents_verified: number;
  facts_pending: number;
  conflicts: number;
};
const input =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-[#0047AB] disabled:bg-slate-100";
const button =
  "cursor-pointer rounded-lg bg-[#0047AB] px-3 py-2 text-sm font-semibold text-white hover:bg-[#00388A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0047AB] disabled:cursor-default disabled:opacity-50";
const secondary =
  "cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#0047AB] disabled:cursor-default disabled:opacity-50";
const states: Record<string, string> = {
  queued: "Chờ xử lý",
  running: "Đang xử lý",
  ready: "Đã trích xuất",
  failed: "Cần xử lý lại",
  removed: "Ngừng sử dụng",
  pending: "Chờ kiểm tra",
  approved: "Đã duyệt",
  rejected: "Đã loại",
  verified: "Đã kiểm tra",
};

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Không xử lý được yêu cầu.");
  return data;
}
function sourceUrl(doc: Doc, page = 1) {
  return `/api/document-knowledge/source?id=${doc.id}&revision=${doc.revision}#page=${page}`;
}

function FactReview({
  fact,
  doc,
  disabled,
  review,
  onPage,
}: {
  fact: Fact;
  doc: Doc;
  disabled: boolean;
  review: (
    fields: Record<string, unknown>,
    decision: string,
    note: string,
  ) => Promise<void>;
  onPage: (page: number) => void;
}) {
  const [code, setCode] = useState(fact.contract_code),
    [amount, setAmount] = useState(fact.amount || ""),
    [date, setDate] = useState(fact.event_date || "");
  const [period, setPeriod] = useState(fact.period_index?.toString() || ""),
    [kind, setKind] = useState(fact.kind),
    [key, setKey] = useState(fact.business_key),
    [note, setNote] = useState("");
  const fields = {
    contract_code: code,
    amount,
    event_date: date,
    period_index: period,
    kind,
    business_key: key,
  };
  return (
    <form
      className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void review(fields, "approved", note);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="rounded-full bg-white px-2 py-1 font-medium text-slate-700">
          {states[fact.status] || fact.status}
        </span>
        <div className="flex gap-3">
          <button
            className="cursor-pointer text-[#0047AB] underline"
            type="button"
            onClick={() => onPage(fact.source_page)}
          >
            Chữ trích xuất · trang {fact.source_page}
          </button>
          <a
            className="text-[#0047AB] underline"
            href={sourceUrl(doc, fact.source_page)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Mở bản gốc
          </a>
        </div>
      </div>
      <blockquote className="max-h-32 overflow-auto whitespace-pre-wrap border-l-2 border-blue-300 pl-3 text-sm text-slate-700">
        {fact.quote}
      </blockquote>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-slate-700">
          Số hợp đồng
          <input
            className={input}
            required
            value={code}
            maxLength={200}
            disabled={disabled}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-700">
          Loại số tiền
          <select
            className={input}
            value={kind}
            disabled={disabled}
            onChange={(e) => setKind(e.target.value as FactKind)}
          >
            {FACT_KINDS.map((k) => (
              <option key={k} value={k}>
                {FACT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-700">
          Số tiền (đồng)
          <input
            className={input}
            required
            inputMode="numeric"
            pattern="-?[0-9]{1,24}"
            value={amount}
            disabled={disabled}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-700">
          Ngày nghiệp vụ
          <input
            className={input}
            required
            type="date"
            value={date}
            disabled={disabled}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-700">
          Đợt nghiệm thu
          <input
            className={input}
            type="number"
            min={1}
            required={kind.startsWith("accepted_")}
            value={period}
            disabled={disabled}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-700">
          Mã nghiệp vụ
          <input
            className={input}
            required
            minLength={3}
            maxLength={200}
            placeholder="Số giao dịch / số biên bản"
            value={key}
            disabled={disabled}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
      </div>
      <p className="text-xs text-slate-600">
        Một nghiệp vụ xuất hiện ở nhiều chứng từ phải dùng cùng mã để tránh tính
        trùng. Phụ lục chỉ ghi phần tăng/giảm, không ghi lại tổng mới.
      </p>
      <label className="block text-xs text-slate-700">
        Căn cứ hoặc lý do
        <textarea
          className={input}
          required
          minLength={3}
          value={note}
          disabled={disabled}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={disabled} type="submit">
          Xác minh số liệu
        </button>
        <button
          className={secondary}
          disabled={disabled || note.trim().length < 3}
          type="button"
          onClick={() => void review({}, "rejected", note)}
        >
          Loại khỏi tính toán
        </button>
      </div>
    </form>
  );
}

export default function DocumentKnowledgePanel() {
  const { can } = useAccess();
  const canManage = can("hoso-ai-qs", "edit");
  const [enabled, setEnabled] = useState(false),
    [projects, setProjects] = useState<Project[]>([]),
    [project, setProject] = useState(""),
    [userId, setUserId] = useState("");
  const [canScan, setCanScan] = useState(false),
    [folder, setFolder] = useState(""),
    [name, setName] = useState(""),
    [email, setEmail] = useState("");
  const [documents, setDocuments] = useState<Doc[]>([]),
    [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0),
    [factOffset, setFactOffset] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null),
    [page, setPage] = useState(1),
    [pageText, setPageText] = useState(""),
    [pageNext, setPageNext] = useState<number | null>(null),
    [textOpen, setTextOpen] = useState(false);
  const [pageOcr, setPageOcr] = useState<{
    method: string;
    warnings: string[];
    confidence: number | null;
    fallback: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [metric, setMetric] = useState("accepted_total"),
    [summary, setSummary] = useState<Summary | null>(null);
  const [reviewNote, setReviewNote] = useState(""),
    [checked, setChecked] = useState(false),
    [manualQuote, setManualQuote] = useState("");
  const currentProject = useRef("");
  const detailRequest = useRef(0);
  const pageRequest = useRef(0),
    documentsRequest = useRef(0);
  const canEdit =
    canManage && projects.some((p) => p.id === project && p.role !== "viewer");
  function chooseProject(id: string) {
    currentProject.current = id;
    detailRequest.current++;
    pageRequest.current++;
    documentsRequest.current++;
    setProject(id);
    setDocuments([]);
    setDetail(null);
    setSummary(null);
    setOffset(0);
    setError("");
    setNotice("");
  }
  const loadProjects = useCallback(async () => {
    const data = await api("/api/document-knowledge");
    setEnabled(Boolean(data.enabled));
    setProjects(data.projects || []);
    setCanScan(Boolean(data.canScan));
    setUserId(data.currentUserId || "");
  }, []);
  useEffect(() => {
    void loadProjects().catch((e) => setError(e.message));
  }, [loadProjects]);
  const loadDocuments = useCallback(async () => {
    if (!project || currentProject.current !== project) return;
    const sequence = ++documentsRequest.current;
    const data = await api(
      `/api/document-knowledge?project=${project}&offset=${offset}`,
    );
    if (
      currentProject.current === project &&
      documentsRequest.current === sequence
    ) {
      setDocuments(data.documents);
      setTotal(data.total);
    }
  }, [project, offset]);
  useEffect(() => {
    void loadDocuments().catch((e) => setError(e.message));
  }, [loadDocuments]);
  useEffect(() => {
    if (
      !project ||
      !documents.some((d) => d.state === "queued" || d.state === "running")
    )
      return;
    const timer = setInterval(() => {
      void loadDocuments().catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [project, documents, loadDocuments]);
  useEffect(() => {
    if (!detail) return;
    let active = true;
    pageRequest.current++;
    setPageText("Đang tải trang…");
    setPageOcr(null);
    setPageNext(null);
    void api(
      `/api/document-knowledge/evidence?id=${detail.document.id}&page=${page}`,
    )
      .then((d) => {
        if (active) {
          setPageText(d.text);
          setPageOcr({
            method: d.method,
            warnings: d.ocr?.warnings || [],
            confidence: d.ocr?.mean_confidence ?? null,
            fallback: Boolean(d.ocr?.fallback_used),
          });
          setPageNext(d.nextOffset);
        }
      })
      .catch((e) => {
        if (active) setPageText(e.message);
      });
    return () => {
      active = false;
    };
  }, [detail, page]);
  async function loadDetail(id: string, start = 0) {
    const scope = currentProject.current,
      sequence = ++detailRequest.current;
    const result = await api(
      `/api/document-knowledge?document=${id}&offset=${start}`,
    );
    if (
      currentProject.current === scope &&
      sequence === detailRequest.current
    ) {
      setDetail(result);
      setFactOffset(start);
    }
  }
  async function readMorePage() {
    if (!detail || pageNext === null) return;
    const sequence = pageRequest.current;
    setBusy(true);
    try {
      const data = await api(
        `/api/document-knowledge/evidence?id=${detail.document.id}&page=${page}&offset=${pageNext}`,
      );
      if (pageRequest.current === sequence) {
        setPageText((t) => t + data.text);
        setPageNext(data.nextOffset);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được trang.");
    } finally {
      setBusy(false);
    }
  }
  async function action(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    setSummary(null);
    try {
      const result = await api("/api/document-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project, ...payload }),
      });
      await loadDocuments();
      if (detail && payload.action !== "create_project")
        await loadDetail(detail.document.id, factOffset);
      setNotice("Đã cập nhật.");
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được dữ liệu.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  if (!enabled && !error) return null;
  return (
    <section
      className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-label="Kho hồ sơ đã xử lý"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Kho hồ sơ hỏi đáp
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Xử lý tài liệu một lần. Số tiền chỉ được tính sau khi xác minh.
          </p>
        </div>
        <button
          className={secondary}
          disabled={busy || !project}
          onClick={() => void loadDocuments().catch((e) => setError(e.message))}
        >
          Làm mới
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {enabled && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-700">
              Chọn kho hồ sơ
              <select
                className={input}
                disabled={busy}
                value={project}
                onChange={(e) => chooseProject(e.target.value)}
              >
                <option value="">Chọn kho để nhập và kiểm tra</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {canManage && (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action({ action: "create_project", name }).then(
                    async (r) => {
                      if (r) {
                        await loadProjects();
                        chooseProject(r.id);
                        setName("");
                      }
                    },
                  );
                }}
              >
                <label className="min-w-0 flex-1 text-xs text-slate-700">
                  Kho mới
                  <input
                    className={input}
                    required
                    maxLength={200}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ví dụ: Hợp đồng bên A"
                  />
                </label>
                <button className={button} disabled={busy}>
                  Tạo kho
                </button>
              </form>
            )}
          </div>
          {project && (
            <>
              {canEdit && (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="min-w-0 flex-1 text-xs text-slate-700">
                    Thêm tài liệu
                    <input
                      className={input}
                      type="file"
                      multiple
                      disabled={busy}
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.xlsx,.xls"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        const target = e.target;
                        setBusy(true);
                        setError("");
                        let count = 0;
                        try {
                          for (const file of files) {
                            const form = new FormData();
                            form.set("projectId", project);
                            form.set("file", file);
                            await api("/api/document-knowledge", {
                              method: "POST",
                              body: form,
                            });
                            count++;
                          }
                          setNotice(
                            `Đã đưa ${count} tệp vào kho. Theo dõi tiến độ bên dưới.`,
                          );
                          await loadDocuments();
                        } catch (err) {
                          setError(
                            `Đã nhận ${count} tệp. ${err instanceof Error ? err.message : "Không tải được tệp tiếp theo."}`,
                          );
                        } finally {
                          setBusy(false);
                          target.value = "";
                          setSummary(null);
                        }
                      }}
                    />
                  </label>
                  {canScan && (
                    <form
                      className="flex flex-1 items-end gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void action({ action: "scan", folder });
                      }}
                    >
                      <label className="min-w-0 flex-1 text-xs text-slate-700">
                        Thư mục trên máy chủ
                        <input
                          className={input}
                          value={folder}
                          onChange={(e) => setFolder(e.target.value)}
                          placeholder="Đường dẫn tương đối trong thư mục hồ sơ"
                        />
                      </label>
                      <button className={secondary} disabled={busy}>
                        Nhập thư mục
                      </button>
                    </form>
                  )}
                </div>
              )}
              <form
                className="mt-4 flex flex-wrap items-end gap-2 rounded-xl bg-blue-50 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  void api(
                    `/api/document-knowledge/summary?project=${project}&metric=${metric}`,
                  )
                    .then(setSummary)
                    .catch((e) => setError(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                <label className="min-w-0 flex-1 text-xs text-slate-700">
                  Số liệu đã xác minh
                  <select
                    className={input}
                    value={metric}
                    onChange={(e) => {
                      setMetric(e.target.value);
                      setSummary(null);
                    }}
                  >
                    {Object.entries(KNOWLEDGE_METRICS).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className={button} disabled={busy}>
                  Xem tổng
                </button>
                {summary && (
                  <div className="w-full text-sm text-slate-800" role="status">
                    <p className="text-xl font-bold tabular-nums">
                      {formatVnd(summary.total_vnd)}
                    </p>
                    <p
                      className={
                        summary.complete ? "text-emerald-800" : "text-amber-900"
                      }
                    >
                      {summary.complete
                        ? "Đã kiểm tra đủ hồ sơ hiện có."
                        : "Số liệu chưa đầy đủ."}{" "}
                      Đã xử lý {summary.documents_ready}/
                      {summary.documents_total} tệp; đã kiểm tra{" "}
                      {summary.documents_verified} tệp; {summary.facts_pending}{" "}
                      dữ kiện chờ duyệt.
                      {summary.conflicts > 0
                        ? " Có mâu thuẫn kỳ/ngày, cần đối soát."
                        : ""}
                    </p>
                  </div>
                )}
              </form>
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(15rem,1fr)_minmax(0,2fr)]">
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-600">
                    {total} tài liệu · trạng thái cập nhật mỗi 10 giây khi đang
                    xử lý
                  </p>
                  {!documents.length && (
                    <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                      Kho chưa có tài liệu trong trang này.
                    </p>
                  )}
                  <ul className="max-h-[38rem] space-y-2 overflow-auto">
                    {documents.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          className={`w-full cursor-pointer rounded-xl border p-3 text-left focus-visible:outline-2 focus-visible:outline-[#0047AB] ${detail?.document.id === d.id ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
                          onClick={() => {
                            setPage(1);
                            setReviewNote("");
                            setChecked(false);
                            void loadDetail(d.id).catch((e) =>
                              setError(e.message),
                            );
                          }}
                        >
                          <span className="block break-words text-sm font-semibold text-slate-900">
                            {d.name}
                          </span>
                          <span className="mt-1 block text-xs text-slate-600">
                            Bản {d.revision} · {states[d.state]} ·{" "}
                            {states[d.review_state]}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <button
                      className={secondary}
                      disabled={offset === 0 || busy}
                      onClick={() => setOffset(Math.max(0, offset - 50))}
                    >
                      Trước
                    </button>
                    <span>
                      {offset + 1}–{Math.min(offset + 50, total)}
                    </span>
                    <button
                      className={secondary}
                      disabled={offset + 50 >= total || busy}
                      onClick={() => setOffset(offset + 50)}
                    >
                      Sau
                    </button>
                  </div>
                </div>
                <div className="min-w-0">
                  {detail ? (
                    <>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="break-words text-sm font-semibold text-slate-900">
                          {detail.document.name} · bản{" "}
                          {detail.document.revision}
                        </h3>
                        <a
                          className="text-sm text-[#0047AB] underline"
                          href={sourceUrl(detail.document)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Mở bản gốc
                        </a>
                      </div>
                      {detail.document.state === "failed" && (
                        <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                          <p>
                            Chưa xử lý xong tài liệu. Kiểm tra dịch vụ xử lý
                            trên máy chủ rồi thử lại.
                          </p>
                          {canEdit && (
                            <button
                              className={secondary}
                              disabled={busy}
                              onClick={() =>
                                void action({
                                  action: "retry",
                                  documentId: detail.document.id,
                                  revision: detail.document.revision,
                                  note: "Thử xử lý lại sau khi kiểm tra dịch vụ",
                                })
                              }
                            >
                              Thử lại
                            </button>
                          )}
                        </div>
                      )}
                      {detail.document.state === "ready" && (
                        <>
                          <details
                            open={textOpen}
                            onToggle={(e) => setTextOpen(e.currentTarget.open)}
                            className="mb-3 rounded-lg border border-slate-200 p-3"
                          >
                            <summary className="cursor-pointer text-sm font-medium text-slate-800">
                              Nội dung đã trích xuất · trang {page}
                            </summary>
                            <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                              Trang
                              <input
                                className="w-20 rounded border border-slate-300 p-1.5"
                                type="number"
                                min={1}
                                max={detail.document.page_count || 1}
                                value={page}
                                onChange={(e) =>
                                  setPage(
                                    Math.max(
                                      1,
                                      Math.min(
                                        detail.document.page_count || 1,
                                        Number(e.target.value) || 1,
                                      ),
                                    ),
                                  )
                                }
                              />
                            </label>
                            {pageOcr && (
                              <p className="mt-2 text-xs text-slate-600">
                                Nguồn chữ:{" "}
                                {pageOcr.method === "paddle"
                                  ? "PaddleOCR"
                                  : pageOcr.method === "gemini"
                                    ? "Gemini API"
                                    : "Lớp chữ trong tệp"}
                                .
                                {pageOcr.fallback
                                  ? " Đã dùng OCR dự phòng."
                                  : ""}
                                {pageOcr.confidence !== null
                                  ? ` Điểm nhận dạng Paddle: ${Math.round(pageOcr.confidence * 100)}%.`
                                  : ""}
                              </p>
                            )}
                            {Boolean(pageOcr?.warnings.length) && (
                              <p
                                role="status"
                                className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900"
                              >
                                Trang có tín hiệu chất lượng nhận dạng thấp hoặc
                                đã cần xử lý dự phòng. Đối chiếu số tiền, mã và
                                ngày với bản gốc; điểm nhận dạng không chứng
                                minh dữ liệu đúng.
                              </p>
                            )}
                            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-sm text-slate-700">
                              {pageText}
                            </pre>
                            {pageNext !== null && (
                              <button
                                className={secondary}
                                disabled={busy}
                                onClick={() => void readMorePage()}
                              >
                                Đọc tiếp trang này
                              </button>
                            )}
                          </details>
                          <div className="space-y-3">
                            {detail.facts.map((f) => (
                              <FactReview
                                key={`${f.id}:${f.review_version}`}
                                fact={f}
                                doc={detail.document}
                                disabled={busy || !canEdit}
                                onPage={(p) => {
                                  setPage(p);
                                  setTextOpen(true);
                                }}
                                review={async (fields, decision, note) => {
                                  await action({
                                    action: "review_fact",
                                    factId: f.id,
                                    version: f.review_version,
                                    decision,
                                    fields,
                                    note,
                                  });
                                }}
                              />
                            ))}
                          </div>
                          {detail.facts_total > 100 && (
                            <div className="my-2 flex gap-2">
                              <button
                                className={secondary}
                                disabled={factOffset === 0 || busy}
                                onClick={() =>
                                  void loadDetail(
                                    detail.document.id,
                                    Math.max(0, factOffset - 100),
                                  ).catch((e) => setError(e.message))
                                }
                              >
                                Dữ kiện trước
                              </button>
                              <button
                                className={secondary}
                                disabled={
                                  factOffset + 100 >= detail.facts_total || busy
                                }
                                onClick={() =>
                                  void loadDetail(
                                    detail.document.id,
                                    factOffset + 100,
                                  ).catch((e) => setError(e.message))
                                }
                              >
                                Dữ kiện sau
                              </button>
                            </div>
                          )}
                          {canEdit && (
                            <>
                              <details className="my-3 rounded-lg border border-slate-200 p-3">
                                <summary className="cursor-pointer text-sm font-medium text-slate-800">
                                  Bổ sung dữ kiện bị thiếu
                                </summary>
                                <form
                                  className="mt-2 space-y-2"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    void action({
                                      action: "add_fact",
                                      documentId: detail.document.id,
                                      revision: detail.document.revision,
                                      page,
                                      quote: manualQuote,
                                      kind: "contract_base",
                                    }).then((r) => {
                                      if (r) setManualQuote("");
                                    });
                                  }}
                                >
                                  <label className="block text-xs text-slate-700">
                                    Chép đoạn chứng minh trên trang {page}
                                    <textarea
                                      className={input}
                                      required
                                      maxLength={2000}
                                      value={manualQuote}
                                      onChange={(e) =>
                                        setManualQuote(e.target.value)
                                      }
                                    />
                                  </label>
                                  <button className={secondary} disabled={busy}>
                                    Thêm vào danh sách kiểm tra
                                  </button>
                                </form>
                              </details>
                              <form
                                className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  void action({
                                    action: "verify",
                                    documentId: detail.document.id,
                                    revision: detail.document.revision,
                                    note: reviewNote,
                                  });
                                }}
                              >
                                <label className="flex items-start gap-2 text-sm text-slate-800">
                                  <input
                                    className="mt-1"
                                    type="checkbox"
                                    required
                                    checked={checked}
                                    onChange={(e) =>
                                      setChecked(e.target.checked)
                                    }
                                  />
                                  Đã đối chiếu toàn bộ trang và kiểm tra đủ dữ
                                  kiện tài chính, hoặc xác nhận tài liệu không
                                  có dữ kiện tiền cần ghi nhận.
                                </label>
                                <label className="block text-xs text-slate-700">
                                  Ghi nhận kiểm tra
                                  <input
                                    className={input}
                                    required
                                    minLength={3}
                                    value={reviewNote}
                                    onChange={(e) =>
                                      setReviewNote(e.target.value)
                                    }
                                  />
                                </label>
                                <button
                                  className={button}
                                  disabled={
                                    busy ||
                                    !checked ||
                                    detail.facts.some(
                                      (f) => f.status === "pending",
                                    )
                                  }
                                >
                                  Hoàn tất kiểm tra tài liệu
                                </button>
                              </form>
                            </>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                      Chọn tài liệu để đối chiếu số liệu với trang nguồn.
                    </p>
                  )}
                </div>
              </div>
              {canEdit &&
                projects.find((p) => p.id === project)?.owner_id === userId && (
                  <details className="mt-4 border-t border-slate-200 pt-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-800">
                      Chia sẻ quyền xem kho hồ sơ
                    </summary>
                    <form
                      className="mt-2 flex flex-wrap gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void action({
                          action: "grant_member",
                          email,
                          role: "viewer",
                        }).then((r) => {
                          if (r) setEmail("");
                        });
                      }}
                    >
                      <label className="min-w-0 flex-1 text-xs text-slate-700">
                        Email tài khoản đã có trên hệ thống
                        <input
                          className={input}
                          required
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </label>
                      <button className={secondary} disabled={busy}>
                        Cấp quyền xem
                      </button>
                    </form>
                  </details>
                )}
            </>
          )}
        </>
      )}
    </section>
  );
}
