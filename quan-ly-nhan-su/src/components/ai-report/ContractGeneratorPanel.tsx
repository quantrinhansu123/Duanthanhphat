"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  DownloadSimple,
  Eye,
  FilePdf,
  FileText,
  Sparkle,
  WarningCircle,
} from "@/components/icons";
import CapBadge from "@/components/ai-report/CapBadge";
import {
  CONTRACT_TEMPLATES,
  DEFAULT_GENERATED_CONTRACT,
  downloadTemplateWordDoc,
  extractionToGeneratedDoc,
  formatVndCompact,
  nextContractCode,
  parseVndAmountSmart,
  renderTemplateBodyHtml,
  type ContractTemplateId,
  type ExtractedWordContract,
  type GeneratedContractDocData,
} from "@/lib/aiReportDemo";

type GeneratorProps = {
  docs: ExtractedWordContract[];
  selectedSourceDocId?: string;
  onPreview: (d: GeneratedContractDocData) => void;
  onAudit: (action: string) => void;
  onDownloadPdf: (d: GeneratedContractDocData) => Promise<void>;
  pdfBusy: boolean;
};

export default function ContractGeneratorPanel({
  docs,
  selectedSourceDocId,
  onPreview,
  onAudit,
  onDownloadPdf,
  pdfBusy,
}: GeneratorProps) {
  const [template, setTemplate] = useState<ContractTemplateId>("contract");
  const [sourceId, setSourceId] = useState<string>(docs[0]?.id ?? "manual");
  const [form, setForm] = useState<GeneratedContractDocData>(() =>
    docs[0]
      ? extractionToGeneratedDoc(docs[0], docs, "contract")
      : { ...DEFAULT_GENERATED_CONTRACT, loaiMau: "contract" }
  );
  const [validationError, setValidationError] = useState("");
  const [notice, setNotice] = useState("");

  // Đồng bộ khi người dùng bấm "Dùng tạo hợp đồng mới" từ Kho trích xuất
  useEffect(() => {
    if (!selectedSourceDocId) return;
    const found = docs.find((d) => d.id === selectedSourceDocId);
    if (!found) return;
    setSourceId(found.id);
    setForm(extractionToGeneratedDoc(found, docs, template));
    setValidationError("");
    setNotice(`Đã điền sẵn dữ liệu từ "${found.fileName}" vào biểu mẫu (không sửa tệp gốc).`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSourceDocId]);

  function applySourceAndTemplate(nextSource: string, nextTpl: ContractTemplateId) {
    setSourceId(nextSource);
    setTemplate(nextTpl);
    setValidationError("");
    setNotice("");
    if (nextSource === "manual") {
      setForm((prev) => ({
        ...prev,
        loaiMau: nextTpl,
        soHD: nextTpl === "contract" ? nextContractCode(docs) : prev.soHD || DEFAULT_GENERATED_CONTRACT.soHD,
        soPhuLuc: nextTpl === "addendum" ? prev.soPhuLuc || `PL01/${prev.soHD || "HD-DEMO-2026-01"}` : undefined,
        giaTriGoc: nextTpl === "addendum" ? prev.giaTriGoc || prev.giaTri : prev.giaTriGoc,
        giaTriDieuChinh: nextTpl === "addendum" ? prev.giaTriDieuChinh || "+70.000.000 VNĐ" : prev.giaTriDieuChinh,
        lyDoDieuChinh:
          nextTpl === "addendum"
            ? prev.lyDoDieuChinh || "Điều chỉnh bổ sung khối lượng vật tư và gia hạn tiến độ."
            : prev.lyDoDieuChinh,
      }));
      return;
    }
    const found = docs.find((d) => d.id === nextSource);
    if (found) {
      setForm(extractionToGeneratedDoc(found, docs, nextTpl));
    }
  }

  function updateField<K extends keyof GeneratedContractDocData>(key: K, value: GeneratedContractDocData[K]) {
    setValidationError("");
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const priceCheck = useMemo(() => {
    if (template === "addendum") {
      const base = parseVndAmountSmart(form.giaTriGoc || form.giaTri);
      const delta = parseVndAmountSmart(form.giaTriDieuChinh || "");
      return {
        base,
        delta,
        total: base.amount + delta.amount,
        warning: base.warning || delta.warning,
      };
    }
    const main = parseVndAmountSmart(form.giaTri);
    return {
      base: main,
      delta: { amount: 0 },
      total: main.amount,
      warning: main.warning,
    };
  }, [form.giaTri, form.giaTriDieuChinh, form.giaTriGoc, template]);

  const previewHtml = useMemo(() => renderTemplateBodyHtml({ ...form, loaiMau: template }), [form, template]);

  function validateForm(): boolean {
    const missing: string[] = [];
    if (!form.soHD.trim()) missing.push("Số hợp đồng");
    if (!form.benA.trim()) missing.push("Bên A");
    if (!form.benB.trim()) missing.push("Bên B");
    if (template === "addendum") {
      if (!(form.giaTriGoc || form.giaTri).trim()) missing.push("Giá trị gốc");
      if (!(form.giaTriDieuChinh || "").trim()) missing.push("Giá trị điều chỉnh");
    } else if (!form.giaTri.trim()) {
      missing.push("Giá trị hợp đồng");
    }
    if (missing.length > 0) {
      setValidationError(`Vui lòng điền đủ các trường bắt buộc trước khi xuất tệp: ${missing.join(", ")}.`);
      return false;
    }
    setValidationError("");
    return true;
  }

  function handleDownloadWord() {
    if (!validateForm()) return;
    const payload: GeneratedContractDocData = { ...form, loaiMau: template };
    const fileName = downloadTemplateWordDoc(payload);
    setNotice(`Đã tải tệp Word mới "${fileName}" về máy (tệp gốc giữ nguyên).`);
    onAudit(`Tạo & tải Word (.doc): ${fileName}`);
  }

  async function handleDownloadPdfClick() {
    if (!validateForm()) return;
    const payload: GeneratedContractDocData = { ...form, loaiMau: template };
    setNotice("Đang dựng tệp PDF khổ A4…");
    await onDownloadPdf(payload);
    setNotice(`Đã xuất PDF (.pdf) cho hồ sơ ${payload.soHD} (không ghi đè tệp gốc).`);
    onAudit(`Tạo & tải PDF (.pdf): ${payload.soHD}`);
  }

  return (
    <section
      id="bao-cao-ai-generate"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5"
      aria-label="Soạn thảo hợp đồng, phụ lục và báo cáo mới"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0047AB]/10 px-2.5 py-0.5 text-xs font-bold text-[#0047AB]">
              <Sparkle size={13} weight="fill" aria-hidden />
              Module 13 &amp; 15 · Tự động soạn thảo &amp; xuất tệp mới
            </span>
            <CapBadge capability="real" compact />
          </div>
          <h2 className="mt-1.5 text-base font-bold text-slate-900">
            Tạo hợp đồng mới, phụ lục điều chỉnh &amp; báo cáo tóm tắt từ dữ liệu đã đọc
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Chọn hồ sơ vừa đọc cục bộ hoặc nhập tay, chỉnh sửa trực tiếp các trường, xem trước trang A4 và tải tệp Word (.doc) hoặc PDF (.pdf) mới hoàn toàn — không bao giờ ghi đè tệp gốc.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadWord}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#185ABD] px-3.5 text-xs font-semibold text-white hover:bg-[#134899] cursor-pointer"
          >
            <DownloadSimple size={15} weight="bold" aria-hidden />
            Tải Word (.doc)
          </button>
          <button
            type="button"
            disabled={pdfBusy}
            onClick={() => void handleDownloadPdfClick()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
          >
            <FilePdf size={15} weight="bold" aria-hidden />
            {pdfBusy ? "Đang xuất PDF…" : "Tải PDF (.pdf)"}
          </button>
          <button
            type="button"
            onClick={() => onPreview({ ...form, loaiMau: template })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Eye size={15} aria-hidden />
            Xem toàn màn
          </button>
        </div>
      </div>

      {/* Template Selector */}
      <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Chọn mẫu văn bản cần tạo">
        {CONTRACT_TEMPLATES.map((tpl) => {
          const active = tpl.id === template;
          return (
            <button
              key={tpl.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => applySourceAndTemplate(sourceId, tpl.id)}
              className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                active
                  ? "border-[#0047AB] bg-blue-50/75 ring-2 ring-[#0047AB]/15"
                  : "border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <FileText size={14} className={active ? "text-[#0047AB]" : "text-slate-500"} aria-hidden />
                  {tpl.label}
                </span>
                {active ? <CheckCircle size={15} weight="fill" className="text-[#0047AB]" aria-hidden /> : null}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-600">{tpl.description}</p>
            </button>
          );
        })}
      </div>

      {validationError ? (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800" role="alert">
          <WarningCircle size={15} weight="fill" className="shrink-0" aria-hidden />
          <span>{validationError}</span>
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
          <CheckCircle size={15} weight="fill" className="shrink-0" aria-hidden />
          <span>{notice}</span>
        </div>
      ) : null}

      {/* Split Form + Live A4 Preview */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: Form */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 lg:col-span-5">
          <div>
            <label htmlFor="gen-source-select" className="block text-[11px] font-bold uppercase tracking-wide text-slate-600">
              Nguồn dữ liệu điền sẵn
            </label>
            <select
              id="gen-source-select"
              value={sourceId}
              onChange={(e) => applySourceAndTemplate(e.target.value, template)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/15"
            >
              <optgroup label="Từ hợp đồng đã đọc">
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.contractCode} — {d.fileName} ({d.source === "local-docx" ? "Tệp cục bộ" : "Mẫu"})
                  </option>
                ))}
              </optgroup>
              <option value="manual">Nhập tay từ đầu</option>
            </select>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <label htmlFor="gen-sohd" className="block text-[11px] font-semibold text-slate-700">
                Số hợp đồng <span className="text-rose-600">*</span>
              </label>
              <input
                id="gen-sohd"
                type="text"
                value={form.soHD}
                onChange={(e) => updateField("soHD", e.target.value)}
                className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
              />
            </div>
            <div>
              <label htmlFor="gen-ngayky" className="block text-[11px] font-semibold text-slate-700">
                Ngày ký
              </label>
              <input
                id="gen-ngayky"
                type="text"
                value={form.ngayKy}
                onChange={(e) => updateField("ngayKy", e.target.value)}
                className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
              />
            </div>
          </div>

          {template === "addendum" ? (
            <div className="space-y-2.5 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#0047AB]">
                Thông số phụ lục điều chỉnh (Gốc + Điều chỉnh = Tổng mới)
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="gen-sopl" className="block text-[11px] font-semibold text-slate-700">
                    Số phụ lục
                  </label>
                  <input
                    id="gen-sopl"
                    type="text"
                    value={form.soPhuLuc ?? ""}
                    onChange={(e) => updateField("soPhuLuc", e.target.value)}
                    className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                  />
                </div>
                <div>
                  <label htmlFor="gen-giatrigoc" className="block text-[11px] font-semibold text-slate-700">
                    Giá trị gốc <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="gen-giatrigoc"
                    type="text"
                    value={form.giaTriGoc ?? ""}
                    onChange={(e) => updateField("giaTriGoc", e.target.value)}
                    className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                  />
                </div>
                <div>
                  <label htmlFor="gen-dieuchinh" className="block text-[11px] font-semibold text-slate-700">
                    Giá trị điều chỉnh (+/-) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="gen-dieuchinh"
                    type="text"
                    value={form.giaTriDieuChinh ?? ""}
                    onChange={(e) => updateField("giaTriDieuChinh", e.target.value)}
                    placeholder="VD: +70.000.000 VNĐ hoặc +70 triệu"
                    className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                  />
                </div>
                <div>
                  <label htmlFor="gen-diadiem" className="block text-[11px] font-semibold text-slate-700">
                    Địa điểm ký
                  </label>
                  <input
                    id="gen-diadiem"
                    type="text"
                    value={form.diaDiemKy}
                    onChange={(e) => updateField("diaDiemKy", e.target.value)}
                    className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="gen-lydo" className="block text-[11px] font-semibold text-slate-700">
                  Lý do / Nội dung điều chỉnh
                </label>
                <input
                  id="gen-lydo"
                  type="text"
                  value={form.lyDoDieuChinh ?? ""}
                  onChange={(e) => updateField("lyDoDieuChinh", e.target.value)}
                  className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-[11px]">
                <span className="text-slate-600">
                  Gốc: <b>{priceCheck.base.amount ? formatVndCompact(priceCheck.base.amount) : "—"}</b>
                </span>
                <span className="text-slate-600">
                  Điều chỉnh:{" "}
                  <b className={priceCheck.delta.amount >= 0 ? "text-emerald-700" : "text-rose-700"}>
                    {priceCheck.delta.amount
                      ? `${priceCheck.delta.amount >= 0 ? "+" : ""}${formatVndCompact(priceCheck.delta.amount)}`
                      : "—"}
                  </b>
                </span>
                <span className="font-bold text-[#0047AB]">
                  Tổng mới: {priceCheck.total ? formatVndCompact(priceCheck.total) : "Chưa tính được"}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                <label htmlFor="gen-giatri" className="block text-[11px] font-semibold text-slate-700">
                  Giá trị hợp đồng <span className="text-rose-600">*</span>
                </label>
                <input
                  id="gen-giatri"
                  type="text"
                  value={form.giaTri}
                  onChange={(e) => updateField("giaTri", e.target.value)}
                  placeholder="VD: 420.000.000 VNĐ hoặc 420 triệu"
                  className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                />
              </div>
              <div>
                <label htmlFor="gen-diadiem2" className="block text-[11px] font-semibold text-slate-700">
                  Địa điểm ký
                </label>
                <input
                  id="gen-diadiem2"
                  type="text"
                  value={form.diaDiemKy}
                  onChange={(e) => updateField("diaDiemKy", e.target.value)}
                  className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
                />
              </div>
            </div>
          )}

          {priceCheck.warning ? (
            <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
              <WarningCircle size={14} className="shrink-0 text-amber-600" aria-hidden />
              <span>{priceCheck.warning}</span>
            </p>
          ) : null}

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <label htmlFor="gen-bena" className="block text-[11px] font-semibold text-slate-700">
                Bên A (Bên giao) <span className="text-rose-600">*</span>
              </label>
              <input
                id="gen-bena"
                type="text"
                value={form.benA}
                onChange={(e) => updateField("benA", e.target.value)}
                className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
              />
            </div>
            <div>
              <label htmlFor="gen-daidiena" className="block text-[11px] font-semibold text-slate-700">
                Đại diện Bên A
              </label>
              <input
                id="gen-daidiena"
                type="text"
                value={form.daiDienA}
                onChange={(e) => updateField("daiDienA", e.target.value)}
                className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
              />
            </div>
            <div>
              <label htmlFor="gen-benb" className="block text-[11px] font-semibold text-slate-700">
                Bên B (Bên nhận) <span className="text-rose-600">*</span>
              </label>
              <input
                id="gen-benb"
                type="text"
                value={form.benB}
                onChange={(e) => updateField("benB", e.target.value)}
                className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
              />
            </div>
            <div>
              <label htmlFor="gen-daidienb" className="block text-[11px] font-semibold text-slate-700">
                Đại diện Bên B
              </label>
              <input
                id="gen-daidienb"
                type="text"
                value={form.daiDienB}
                onChange={(e) => updateField("daiDienB", e.target.value)}
                className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="gen-hangmuc" className="block text-[11px] font-semibold text-slate-700">
              Hạng mục / Phạm vi công việc
            </label>
            <textarea
              id="gen-hangmuc"
              rows={2}
              value={form.hangMuc}
              onChange={(e) => updateField("hangMuc", e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
            />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <label htmlFor="gen-thoihan" className="block text-[11px] font-semibold text-slate-700">
                Thời hạn thực hiện
              </label>
              <input
                id="gen-thoihan"
                type="text"
                value={form.thoiHan}
                onChange={(e) => updateField("thoiHan", e.target.value)}
                className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
              />
            </div>
            <div>
              <label htmlFor="gen-thanhtoan" className="block text-[11px] font-semibold text-slate-700">
                Điều khoản thanh toán
              </label>
              <input
                id="gen-thanhtoan"
                type="text"
                value={form.thanhToan}
                onChange={(e) => updateField("thanhToan", e.target.value)}
                className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-hidden focus:border-[#0047AB]"
              />
            </div>
          </div>

          <p className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-600">
            <b>Lưu ý pháp lý:</b> Bản nháp do hệ thống soạn — cần người có thẩm quyền rà soát và ký. Không có ảnh chữ ký và không ghi đè tệp gốc.
          </p>
        </div>

        {/* Right: Live A4 Preview */}
        <div className="flex flex-col rounded-xl border border-slate-300 bg-slate-100 p-3 lg:col-span-7">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <span className="font-bold text-slate-800">Xem trước trực tiếp khổ A4 · {form.soHD || "(chưa có số HĐ)"}</span>
            <span>Định dạng xuất: .doc (Word) &amp; .pdf (PDF A4)</span>
          </div>
          <div className="max-h-[560px] flex-1 overflow-y-auto rounded-lg border border-slate-300 bg-white p-5 shadow-sm sm:p-7">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      </div>
    </section>
  );
}
