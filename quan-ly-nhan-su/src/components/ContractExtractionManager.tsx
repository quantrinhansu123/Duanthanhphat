"use client";

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle,
  DownloadSimple,
  Eye,
  FileArrowUp,
  FileText,
  MagnifyingGlass,
  Sparkle,
  WarningCircle,
} from "@/components/icons";
import {
  buildExtractionFromParagraphs,
  exportExtractionsToCsv,
  formatVndCompact,
  INITIAL_WORD_EXTRACTIONS,
  parseVndAmount,
  readDocxTextInBrowser,
  type ExtractedFieldStatus,
  type ExtractedWordContract,
} from "@/lib/aiReportDemo";

const STATUS_BADGE: Record<ExtractedFieldStatus, { label: string; cls: string }> = {
  approved: { label: "Đã duyệt", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  pending: { label: "Chờ kiểm tra", cls: "bg-amber-100 text-amber-900 border-amber-200" },
  review: { label: "Cần rà soát", cls: "bg-rose-100 text-rose-800 border-rose-200" },
};

function computeDocState(doc: ExtractedWordContract): ExtractedFieldStatus {
  if (doc.fields.some((f) => f.status === "review")) return "review";
  if (doc.fields.every((f) => f.status === "approved")) return "approved";
  return "pending";
}

type ContractExtractionManagerProps = {
  docs?: ExtractedWordContract[];
  onDocsChange?: React.Dispatch<React.SetStateAction<ExtractedWordContract[]>>;
  onUseForGenerator?: (doc: ExtractedWordContract) => void;
  onAudit?: (action: string) => void;
};

export default function ContractExtractionManager({
  docs: controlledDocs,
  onDocsChange,
  onUseForGenerator,
  onAudit,
}: ContractExtractionManagerProps = {}) {
  const [internalDocs, setInternalDocs] = useState<ExtractedWordContract[]>(INITIAL_WORD_EXTRACTIONS);
  const docs = controlledDocs ?? internalDocs;
  const setDocs = onDocsChange ?? setInternalDocs;
  const [selectedId, setSelectedId] = useState<string>(docs[0]?.id ?? INITIAL_WORD_EXTRACTIONS[0].id);
  const [statusFilter, setStatusFilter] = useState<"all" | ExtractedFieldStatus>("all");
  const [search, setSearch] = useState("");
  const [detailTab, setDetailTab] = useState<"fields" | "source">("fields");
  const [uploadError, setUploadError] = useState("");
  const [uploadNotice, setUploadNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return docs.filter((doc) => {
      if (statusFilter !== "all" && doc.reviewState !== statusFilter) return false;
      if (!q) return true;
      return (
        doc.fileName.toLocaleLowerCase("vi").includes(q) ||
        doc.contractCode.toLocaleLowerCase("vi").includes(q) ||
        doc.fields.some((f) => f.value.toLocaleLowerCase("vi").includes(q))
      );
    });
  }, [docs, statusFilter, search]);

  const selectedDoc = useMemo(
    () => docs.find((d) => d.id === selectedId) ?? filteredDocs[0] ?? docs[0] ?? null,
    [docs, filteredDocs, selectedId]
  );

  const stats = useMemo(() => {
    const totalFields = docs.reduce((s, d) => s + d.fields.length, 0);
    const approvedFields = docs.reduce((s, d) => s + d.fields.filter((f) => f.status === "approved").length, 0);
    const approvedDocs = docs.filter((d) => d.reviewState === "approved").length;
    const totalValue = docs.reduce((s, d) => s + d.valueVnd, 0);
    return { totalDocs: docs.length, approvedDocs, totalFields, approvedFields, totalValue };
  }, [docs]);

  async function handleWordUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploadError("");
    setUploadNotice("");
    setBusy(true);
    try {
      const added: ExtractedWordContract[] = [];
      for (const file of Array.from(fileList)) {
        const paragraphs = await readDocxTextInBrowser(file);
        if (paragraphs.length === 0) {
          throw new Error(`Không đọc được đoạn văn bản nào trong "${file.name}".`);
        }
        added.push(buildExtractionFromParagraphs(file, paragraphs));
      }
      setDocs((prev) => [...added, ...prev]);
      setSelectedId(added[0].id);
      setStatusFilter("all");
      setUploadNotice(
        `Đã đọc thật ${added.length} tệp Word trên trình duyệt (${added.map((d) => d.fileName).join(", ")}) — chỉ xử lý cục bộ, không lưu máy chủ.`
      );
      onAudit?.(`Đọc tệp Word cục bộ: ${added.map((d) => d.fileName).join(", ")}`);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Không đọc được tệp Word (.docx).");
    } finally {
      setBusy(false);
    }
  }

  function updateField(docId: string, fieldId: string, patch: Partial<{ value: string; status: ExtractedFieldStatus }>) {
    setDocs((prev) =>
      prev.map((doc) => {
        if (doc.id !== docId) return doc;
        const fields = doc.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f));
        const priceField = fields.find((f) => f.key === "gia_tri");
        const codeField = fields.find((f) => f.key === "so_hd");
        const nextDoc: ExtractedWordContract = {
          ...doc,
          fields,
          contractCode: codeField?.value.trim() || doc.contractCode,
          valueVnd: priceField ? parseVndAmount(priceField.value) : doc.valueVnd,
        };
        return { ...nextDoc, reviewState: computeDocState(nextDoc) };
      })
    );
  }

  function approveAllFields(docId: string) {
    const target = docs.find((d) => d.id === docId);
    setDocs((prev) =>
      prev.map((doc) => {
        if (doc.id !== docId) return doc;
        return {
          ...doc,
          reviewState: "approved",
          fields: doc.fields.map((f) => ({ ...f, status: "approved" })),
        };
      })
    );
    if (target) onAudit?.(`Duyệt tất cả trường trích xuất của ${target.fileName}`);
  }

  function handleExportCsv() {
    const csv = exportExtractionsToCsv(docs);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `du-lieu-trich-xuat-hop-dong-word_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setUploadNotice("Đã xuất bảng dữ liệu trích xuất hợp đồng Word ra tệp CSV mới (không ghi đè tệp gốc).");
    onAudit?.(`Xuất bảng trích xuất CSV (${docs.length} hồ sơ)`);
  }

  return (
    <section
      id="bao-cao-ai-extraction"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5"
      aria-label="Quản lý trích xuất dữ liệu đọc file Word hợp đồng"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0047AB]/10 px-2.5 py-0.5 text-xs font-bold text-[#0047AB]">
              <FileText size={14} weight="bold" aria-hidden />
              Quản lý trích xuất dữ liệu · File Word hợp đồng (.docx)
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              Hỗ trợ đọc file .docx thật cục bộ trên trình duyệt
            </span>
          </div>
          <h2 className="mt-1.5 text-base font-bold text-slate-900">
            Kho dữ liệu trích xuất từ file Word hợp đồng &amp; đối chiếu nguồn
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Quản lý danh sách tệp Word hợp đồng đã đọc, kiểm tra từng trường trích xuất (Số HĐ, Bên A/B, Giá trị, Thời hạn, Thanh toán), đối chiếu đoạn gốc và duyệt dữ liệu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".docx,.txt,.md"
            className="hidden"
            onChange={(e) => {
              void handleWordUpload(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0047AB] px-3.5 text-xs font-semibold text-white hover:bg-[#00388A] disabled:opacity-50 cursor-pointer"
          >
            <FileArrowUp size={15} aria-hidden />
            {busy ? "Đang đọc file Word…" : "Đọc file Word (.docx)"}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-700 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 cursor-pointer"
          >
            <DownloadSimple size={15} aria-hidden />
            Xuất bảng trích xuất (.csv)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">File Word đã đọc</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{stats.totalDocs} <span className="text-xs font-medium text-slate-500">tệp .docx</span></p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Hồ sơ đã duyệt</p>
          <p className="mt-1 text-xl font-bold text-emerald-900">
            {stats.approvedDocs}/{stats.totalDocs}
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0047AB]">Trường dữ liệu trích xuất</p>
          <p className="mt-1 text-xl font-bold text-[#0047AB]">
            {stats.approvedFields}/{stats.totalFields} <span className="text-xs font-medium text-blue-700">đã duyệt</span>
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Tổng giá trị trích xuất</p>
          <p className="mt-1 text-lg font-bold text-amber-950">{formatVndCompact(stats.totalValue)}</p>
        </div>
      </div>

      {uploadNotice ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <CheckCircle size={15} weight="fill" aria-hidden />
          <span>{uploadNotice}</span>
        </div>
      ) : null}
      {uploadError ? (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <WarningCircle size={15} weight="fill" aria-hidden />
          <span>{uploadError}</span>
        </div>
      ) : null}

      {/* Main Master-Detail Split View */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: Word Contract File List */}
        <div className="space-y-2.5 lg:col-span-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên file Word, mã HĐ..."
                aria-label="Tìm tệp Word hợp đồng"
                className="h-9 w-full rounded-lg border border-slate-300 pl-8 pr-2.5 text-xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
              />
            </div>
            <select
              aria-label="Lọc trạng thái duyệt"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | ExtractedFieldStatus)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-hidden focus:border-[#0047AB]"
            >
              <option value="all">Tất cả</option>
              <option value="approved">Đã duyệt</option>
              <option value="pending">Chờ kiểm tra</option>
              <option value="review">Cần rà soát</option>
            </select>
          </div>

          <div className="space-y-2">
            {filteredDocs.map((doc) => {
              const active = doc.id === selectedDoc?.id;
              const badge = STATUS_BADGE[doc.reviewState];
              const approvedCount = doc.fields.filter((f) => f.status === "approved").length;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedId(doc.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    active
                      ? "border-[#0047AB] bg-blue-50/75 ring-2 ring-[#0047AB]/15"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#185ABD] text-[11px] font-black text-white">
                        W
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900">{doc.fileName}</p>
                        <p className="truncate text-[10.5px] text-slate-500">
                          {doc.contractCode} · {doc.pageCount} trang · {doc.fileSizeLabel}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-slate-600">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">
                      {doc.docType} · {approvedCount}/{doc.fields.length} trường
                    </span>
                    <span className="font-mono font-semibold text-[#0047AB]">
                      {doc.valueVnd > 0 ? formatVndCompact(doc.valueVnd) : "Chưa rõ giá trị"}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredDocs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                Không có tệp Word hợp đồng phù hợp bộ lọc.
              </p>
            ) : null}
          </div>
        </div>

        {/* Right: Selected Word Contract Extraction Table + Source Document Highlight */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 lg:col-span-8">
          {selectedDoc ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-slate-900">{selectedDoc.fileName}</h3>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                      {selectedDoc.source === "local-docx" ? "Đọc từ tệp thật" : "Mẫu tổng hợp (Demo)"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {selectedDoc.source === "local-docx"
                      ? `Tệp đã chọn cục bộ (${selectedDoc.fileSizeLabel}) · Trích xuất lúc ${selectedDoc.extractedAt}`
                      : `${selectedDoc.folderPath} · Trích xuất lúc ${selectedDoc.extractedAt}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setDetailTab("fields")}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold cursor-pointer ${
                        detailTab === "fields" ? "bg-[#0047AB] text-white" : "text-slate-600"
                      }`}
                    >
                      <Sparkle size={12} weight="fill" aria-hidden />
                      Dữ liệu trích xuất ({selectedDoc.fields.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailTab("source")}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold cursor-pointer ${
                        detailTab === "source" ? "bg-[#0047AB] text-white" : "text-slate-600"
                      }`}
                    >
                      <Eye size={12} aria-hidden />
                      Nội dung file Word ({selectedDoc.rawParagraphs.length} đoạn)
                    </button>
                  </div>
                  {onUseForGenerator ? (
                    <button
                      type="button"
                      onClick={() => onUseForGenerator(selectedDoc)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#0047AB] bg-white px-2.5 text-xs font-semibold text-[#0047AB] hover:bg-blue-50 cursor-pointer"
                    >
                      <Sparkle size={13} weight="fill" aria-hidden />
                      Dùng tạo hợp đồng mới
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => approveAllFields(selectedDoc.id)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-700 px-2.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                  >
                    <CheckCircle size={13} weight="fill" aria-hidden />
                    Duyệt tất cả
                  </button>
                </div>
              </div>

              {detailTab === "fields" ? (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-slate-100 text-[11px] text-slate-600">
                      <tr>
                        <th className="w-[18%] border-b border-slate-200 px-2.5 py-2 font-bold">Trường dữ liệu</th>
                        <th className="w-[34%] border-b border-slate-200 px-2.5 py-2 font-bold">Giá trị trích xuất (sửa được)</th>
                        <th className="w-[26%] border-b border-slate-200 px-2.5 py-2 font-bold">Trích dẫn nguồn Word</th>
                        <th className="w-[8%] border-b border-slate-200 px-2 py-2 text-center font-bold">Độ tin cậy</th>
                        <th className="w-[14%] border-b border-slate-200 px-2 py-2 text-center font-bold">Duyệt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDoc.fields.map((field) => {
                        const b = STATUS_BADGE[field.status];
                        return (
                          <tr key={field.id} className="border-b border-slate-100 last:border-0 align-top hover:bg-slate-50/70">
                            <td className="px-2.5 py-2 font-semibold text-slate-800">
                              {field.label}
                              <div className="mt-0.5 text-[10px] font-normal text-slate-400">{field.sectionRef}</div>
                            </td>
                            <td className="px-2.5 py-2">
                              <input
                                type="text"
                                aria-label={`Giá trị ${field.label}`}
                                value={field.value}
                                onChange={(e) => updateField(selectedDoc.id, field.id, { value: e.target.value })}
                                className="h-8 w-full rounded border border-slate-200 px-2 text-xs text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
                              />
                            </td>
                            <td className="px-2.5 py-2 text-[11px] italic text-slate-600">
                              “{field.quote}”
                            </td>
                            <td className="px-2 py-2 text-center font-mono text-[11px] font-bold text-[#0047AB]">
                              {field.confidence}%
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  updateField(selectedDoc.id, field.id, {
                                    status: field.status === "approved" ? "pending" : "approved",
                                  })
                                }
                                className={`inline-flex items-center rounded border px-2 py-1 text-[10.5px] font-bold cursor-pointer ${b.cls}`}
                                title="Bấm để chuyển trạng thái duyệt"
                              >
                                {b.label}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  className="max-h-[420px] space-y-2 overflow-y-auto rounded-lg border border-slate-300 bg-white p-4 text-[13px] leading-relaxed text-black"
                  style={{ fontFamily: "'Times New Roman', Times, serif" }}
                >
                  {selectedDoc.rawParagraphs.map((para, idx) => {
                    const matchedField = selectedDoc.fields.find(
                      (f) => f.value && !f.value.startsWith("(") && para.includes(f.value.slice(0, Math.min(18, f.value.length)))
                    );
                    return (
                      <div
                        key={idx}
                        className={`rounded px-2.5 py-1.5 ${
                          matchedField ? "border-l-4 border-[#0047AB] bg-blue-50/70" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="m-0">{para}</p>
                          {matchedField ? (
                            <span className="shrink-0 rounded bg-[#0047AB] px-1.5 py-0.5 font-sans text-[10px] font-bold text-white">
                              {matchedField.label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
