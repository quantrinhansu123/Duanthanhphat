"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowClockwise,
  CheckCircle,
  DownloadSimple,
  Eye,
  FilePdf,
  FileText,
  Files,
  Paperclip,
  Play,
  ShieldCheck,
  Sparkle,
  X,
} from "@/components/icons";
import ContractExtractionManager from "@/components/ContractExtractionManager";
import ProductOverview from "@/components/ai-report/ProductOverview";
import CapBadge from "@/components/ai-report/CapBadge";
import ChatbotShowcasePanel from "@/components/ai-report/ChatbotShowcasePanel";
import ContractDashboardPanel from "@/components/ai-report/ContractDashboardPanel";
import ContractGeneratorPanel from "@/components/ai-report/ContractGeneratorPanel";
import FolderReaderPanel from "@/components/ai-report/FolderReaderPanel";
import ModuleMap from "@/components/ai-report/ModuleMap";
import { exportPagesPdf } from "@/lib/pdfExport";
import {
  COMPUTER_USE_SCENARIOS,
  DEFAULT_GENERATED_CONTRACT,
  downloadTemplateWordDoc,
  EXPLORER_DEMO_FILES,
  INITIAL_WORD_EXTRACTIONS,
  makeWordPdfAttachments,
  renderTemplateBodyHtml,
  SHEETS_DEMO_ROWS_CLEAN,
  SHEETS_DEMO_ROWS_RAW,
  type AiReportSectionId,
  type AuditEntry,
  type DemoChatBubble,
  type DemoFileAttachment,
  type DemoScenario,
  type DemoScenarioId,
  type ExtractedWordContract,
  type GeneratedContractDocData,
} from "@/lib/aiReportDemo";

const EXPLORER_FIELD_SOURCES = [
  {
    key: "so_hd",
    label: "Số HĐ",
    value: "HD-DEMO-2026-01",
    valueCls: "text-slate-900",
    sectionRef: "Phần tiêu đề · Trang 1",
    quote: "HỢP ĐỒNG CUNG CẤP VẬT TƯ · Số: HD-DEMO-2026-01 · Ngày ký 15/10/2026.",
  },
  {
    key: "gia_tri",
    label: "Giá trị",
    value: "350.000.000 VNĐ",
    valueCls: "text-[#0047AB]",
    sectionRef: "Điều 2 · Giá trị hợp đồng (Trang 2)",
    quote: "Tổng giá trị hợp đồng mẫu: 350.000.000 VNĐ (đã bao gồm thuế GTGT 10%).",
  },
  {
    key: "ben_a",
    label: "Bên A",
    value: "Cty TNHH Vật Tư Mẫu Alpha",
    valueCls: "text-slate-900",
    sectionRef: "Mục 1 · Các bên tham gia (Trang 1)",
    quote: "BÊN A (Bên mua): Công ty TNHH Vật Tư Mẫu Alpha — Đại diện: Ông Nguyễn Văn Mẫu A.",
  },
  {
    key: "ben_b",
    label: "Bên B",
    value: "Cty CP Thiết Bị Minh Họa Beta",
    valueCls: "text-slate-900",
    sectionRef: "Mục 2 · Các bên tham gia (Trang 1)",
    quote: "BÊN B (Bên bán): Công ty CP Thiết Bị Minh Họa Beta — Đại diện: Bà Trần Thị Mẫu B.",
  },
] as const;

/** Con trỏ AI di chuyển trực tiếp trên màn hình máy tính mô phỏng. */
function AiDesktopCursor({ x, y, label, clicking }: { x: number; y: number; label: string; clicking?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute z-30 transition-all duration-700 ease-in-out"
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-hidden
    >
      {clicking ? (
        <span className="absolute -left-3 -top-3 h-7 w-7 animate-ping rounded-full bg-[#0047AB]/45" />
      ) : null}
      <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]">
        <path
          d="M4 2L20 11.2L12.6 13.1L9.6 20.5L4 2Z"
          fill="#0047AB"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      <span className="ml-4 -mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-white/80 bg-[#0047AB] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-lg">
        <Sparkle size={10} weight="fill" />
        {label}
      </span>
    </div>
  );
}

/** Cửa sổ File Explorer mô phỏng cho Kịch bản 1 (READ) có chip nguồn bấm đối chiếu từng trường. */
function ExplorerWindowMock({ step }: { step: number }) {
  const [activeFieldKey, setActiveFieldKey] = useState<string>("gia_tri");
  const fileSelected = step >= 1;
  const scanning = step >= 2;
  const activeSource =
    EXPLORER_FIELD_SOURCES.find((f) => f.key === activeFieldKey) ?? EXPLORER_FIELD_SOURCES[0];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-300/90 bg-white text-slate-800 shadow-xl">
      {/* Window Title Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-slate-700">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-amber-400 text-[9px] font-black text-amber-950">
            F
          </span>
          <span className="truncate">File Explorer — D:\HoSo_HopDong_Mau (đường dẫn minh họa)</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        </div>
      </div>

      {/* Address bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1 text-[10px] text-slate-600">
        <span className="truncate rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-slate-700">
          D:\HoSo_HopDong_Mau (đường dẫn minh họa)
        </span>
        <span className="ml-auto hidden shrink-0 text-slate-400 sm:inline">4 mục · dữ liệu mẫu tổng hợp</span>
      </div>

      {/* Body */}
      <div className="grid flex-1 grid-cols-12 overflow-hidden">
        {/* Left folder tree */}
        <div className="hidden border-r border-slate-200 bg-slate-50/70 p-2 text-[10px] text-slate-600 sm:col-span-3 sm:block">
          <p className="mb-1 font-bold uppercase tracking-wide text-slate-400">Thư mục mẫu</p>
          <ul className="space-y-1">
            <li className="rounded px-1.5 py-1 text-slate-500">Desktop</li>
            <li className="rounded px-1.5 py-1 text-slate-500">Documents</li>
            <li className="rounded bg-blue-100 px-1.5 py-1 font-bold text-[#0047AB]">HoSo_HopDong_Mau</li>
            <li className="rounded px-1.5 py-1 text-slate-500">Bieu_Mau_2026</li>
          </ul>
        </div>

        {/* File list + live extraction preview */}
        <div className="col-span-12 flex flex-col justify-between p-2.5 sm:col-span-9">
          <div className="space-y-1">
            <div className="grid grid-cols-12 border-b border-slate-200 pb-1 text-[10px] font-bold text-slate-400">
              <span className="col-span-7">Tên tệp</span>
              <span className="col-span-3">Ngày sửa</span>
              <span className="col-span-2 text-right">Cỡ</span>
            </div>
            {EXPLORER_DEMO_FILES.map((file) => {
              const highlighted = file.active && fileSelected;
              return (
                <div
                  key={file.name}
                  className={`grid grid-cols-12 items-center rounded px-2 py-1 text-[11px] transition-all ${
                    highlighted
                      ? "bg-[#0047AB]/12 font-semibold text-[#0047AB] ring-1 ring-[#0047AB]/50"
                      : "text-slate-700"
                  }`}
                >
                  <span className="col-span-7 flex items-center gap-1.5 truncate">
                    <FileText size={13} className={highlighted ? "text-[#0047AB]" : "text-slate-400"} />
                    <span className="truncate">{file.name}</span>
                  </span>
                  <span className="col-span-3 text-[10px] text-slate-500">{file.date}</span>
                  <span className="col-span-2 text-right text-[10px] text-slate-500">{file.size}</span>
                </div>
              );
            })}
          </div>

          {/* Live AI Extraction Box with clickable source chips */}
          <div
            className={`mt-2.5 rounded-lg border p-2.5 transition-all duration-500 ${
              scanning
                ? "border-emerald-300 bg-emerald-50/90 opacity-100"
                : "border-dashed border-slate-200 bg-slate-50 opacity-60"
            }`}
          >
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-800">
                <Sparkle size={12} weight="fill" />
                {scanning ? "AI trích xuất & gắn nguồn điều khoản (bấm chip để xem nguồn)" : "Chờ AI chọn tệp hợp đồng…"}
              </span>
              {step >= 3 ? (
                <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">5/5 trường</span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
              {EXPLORER_FIELD_SOURCES.map((item) => {
                const selected = scanning && activeFieldKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={!scanning}
                    onClick={() => setActiveFieldKey(item.key)}
                    className={`rounded border px-2 py-1 text-left transition-all ${
                      selected
                        ? "border-[#0047AB] bg-blue-50/90 ring-1 ring-[#0047AB]/40 cursor-pointer"
                        : scanning
                          ? "border-emerald-200/80 bg-white hover:border-[#0047AB]/50 cursor-pointer"
                          : "border-emerald-200/60 bg-white/80 cursor-default"
                    }`}
                  >
                    <span className="text-slate-400">{item.label}: </span>
                    <b className={item.valueCls}>{scanning ? item.value : "—"}</b>
                  </button>
                );
              })}
            </div>
            {scanning ? (
              <div className="mt-1.5 rounded border border-blue-200 bg-white px-2 py-1 text-[10px] text-slate-700">
                <span className="font-bold text-[#0047AB]">Nguồn ({activeSource.sectionRef}):</span>{" "}
                <span className="italic">“{activeSource.quote}”</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Cửa sổ Microsoft Word mô phỏng cho Kịch bản 2 (CREATE). */
function WordWindowMock({ step }: { step: number }) {
  const filledBasic = step >= 1;
  const updatedPrice = step >= 2;
  const savedNew = step >= 3;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-300/90 bg-slate-200 text-slate-800 shadow-xl">
      {/* Word blue title bar */}
      <div className="flex items-center justify-between bg-[#185ABD] px-3 py-1.5 text-white">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-white text-[10px] font-black text-[#185ABD]">
            W
          </span>
          <span className="truncate">
            {savedNew ? "HD-DEMO-2026-01-MOI.doc — Đã lưu bản mới" : "Microsoft Word — Bản thảo hợp đồng mới"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        </div>
      </div>

      {/* Word mini ribbon */}
      <div className="flex items-center gap-2 border-b border-slate-300 bg-white px-3 py-1 text-[10px] text-slate-600">
        <span
          className={`rounded px-2 py-0.5 font-bold transition-all ${
            savedNew ? "bg-emerald-600 text-white ring-2 ring-emerald-300" : "bg-[#185ABD]/10 text-[#185ABD]"
          }`}
        >
          {savedNew ? "✓ Đã xuất tệp mới (.doc / .pdf)" : "Tệp · Lưu bản mới"}
        </span>
        <span>Trang đầu</span>
        <span>Chèn</span>
        <span>Bố cục</span>
        <span className="ml-auto text-[9.5px] font-semibold text-emerald-700">Tệp gốc không bị ghi đè</span>
      </div>

      {/* Word A4 document canvas */}
      <div className="flex-1 overflow-hidden p-3">
        <div
          className="mx-auto h-full max-w-[440px] rounded border border-slate-300 bg-white px-5 py-3.5 text-[11.5px] leading-relaxed text-black shadow-sm"
          style={{ fontFamily: "'Times New Roman', Times, serif" }}
        >
          <div className="text-center font-bold leading-tight">
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            <div className="text-[10.5px] underline">Độc lập - Tự do - Hạnh phúc</div>
          </div>
          <p className="mt-2 text-center text-[13px] font-bold">HỢP ĐỒNG CUNG CẤP VẬT TƯ (MẪU DEMO)</p>
          <p className="text-center text-[11px]">
            Số:{" "}
            <span
              className={`rounded px-1 font-bold transition-all ${
                filledBasic ? "bg-blue-100 text-[#0047AB]" : "text-slate-400"
              }`}
            >
              {filledBasic ? "HD-DEMO-2026-01-MOI" : "……………"}
            </span>
          </p>

          <div className="mt-2.5 space-y-1.5 text-[11px]">
            <p>
              <b>1. Bên A:</b>{" "}
              <span className={filledBasic ? "rounded bg-blue-50 px-1 font-semibold" : "text-slate-400"}>
                {filledBasic ? "Công ty TNHH Vật Tư Mẫu Alpha" : "…………………………………"}
              </span>
            </p>
            <p>
              <b>2. Bên B:</b>{" "}
              <span className={filledBasic ? "rounded bg-blue-50 px-1 font-semibold" : "text-slate-400"}>
                {filledBasic ? "Công ty CP Thiết Bị Minh Họa Beta" : "…………………………………"}
              </span>
            </p>
            <p>
              <b>3. Hạng mục:</b>{" "}
              <span>{filledBasic ? "Cung cấp vật tư kiểm thử tuyến mẫu số 01" : "…………………………………"}</span>
            </p>
            <p>
              <b>4. Giá trị hợp đồng:</b>{" "}
              <span
                className={`rounded px-1.5 py-0.5 font-bold transition-all ${
                  updatedPrice
                    ? "bg-amber-200 text-amber-950 ring-1 ring-amber-400"
                    : filledBasic
                      ? "bg-slate-100 text-slate-700"
                      : "text-slate-400"
                }`}
              >
                {updatedPrice ? "420.000.000 VNĐ (đã cập nhật)" : filledBasic ? "350.000.000 VNĐ" : "…………………"}
              </span>
            </p>
            <p>
              <b>5. Thời hạn:</b> <span>{filledBasic ? "30 ngày kể từ ngày ký" : "……………"}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Cửa sổ Chrome · Google Sheets mô phỏng cho Kịch bản bổ sung. */
function SheetsWindowMock({ step }: { step: number }) {
  const marking = step === 2;
  const cleaned = step >= 3;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-300/90 bg-white text-slate-800 shadow-xl">
      <div className="flex items-center justify-between bg-[#137333] px-3 py-1.5 text-white">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-white text-[10px] font-black text-[#137333]">
            S
          </span>
          <span className="truncate">Google Sheets — Bang_Theo_Doi_Hop_Dong_Mau</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[9.5px]">
          <span className="rounded bg-white/20 px-1.5 py-0.5 font-semibold">
            {cleaned ? "✓ Đã làm sạch (3 dòng hợp lệ)" : marking ? "Phát hiện: 2 trống · 2 trùng · 20 ô thừa cách" : "8 dòng dữ liệu mẫu"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1 text-[10px] text-slate-600">
        <span className="font-mono font-bold italic text-slate-400">fx</span>
        <span className="truncate font-mono text-slate-700">
          {cleaned
            ? "=CLEAN_TRIM_DEDUPE(A2:E8) → 3 bản ghi sạch"
            : marking
              ? "Đang đánh dấu khoảng trắng thừa, dòng trống (#3, #6) và dòng trùng lặp (#4, #8)"
              : "A1:E8 — Dữ liệu bảng mẫu tổng hợp"}
        </span>
      </div>

      <div className="flex-1 overflow-x-auto p-2">
        <table className="w-full min-w-[440px] border-collapse text-[10px]">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="w-6 border border-slate-200 py-1 text-center">#</th>
              <th className="border border-slate-200 px-1.5 py-1 text-left">A · Mã HĐ</th>
              <th className="border border-slate-200 px-1.5 py-1 text-left">B · Đối tác</th>
              <th className="border border-slate-200 px-1.5 py-1 text-right">C · Giá trị</th>
              <th className="border border-slate-200 px-1.5 py-1 text-center">D · Xử lý</th>
            </tr>
          </thead>
          <tbody>
            {cleaned
              ? SHEETS_DEMO_ROWS_CLEAN.map((r) => (
                  <tr key={r.row} className="bg-emerald-50/40 text-slate-800">
                    <td className="border border-slate-200 py-1.5 text-center font-mono text-slate-400">{r.row}</td>
                    <td className="border border-slate-200 px-1.5 py-1.5 font-semibold text-emerald-900">{r.code}</td>
                    <td className="border border-slate-200 px-1.5 py-1.5">{r.partner}</td>
                    <td className="border border-slate-200 px-1.5 py-1.5 text-right font-mono">{r.value}</td>
                    <td className="border border-slate-200 px-1.5 py-1.5 text-center">
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                        Chuẩn sạch
                      </span>
                    </td>
                  </tr>
                ))
              : SHEETS_DEMO_ROWS_RAW.map((r) => {
                  const rowBg =
                    marking && r.kind === "blank"
                      ? "bg-amber-100/90 text-amber-900"
                      : marking && r.kind === "duplicate"
                        ? "bg-rose-100/90 text-rose-800 line-through"
                        : marking && r.kind === "trim"
                          ? "bg-blue-50/70 text-slate-800"
                          : "bg-white text-slate-700";
                  return (
                    <tr key={r.row} className={`transition-colors duration-300 ${rowBg}`}>
                      <td className="border border-slate-200 py-1 text-center font-mono text-slate-400">{r.row}</td>
                      <td className="border border-slate-200 px-1.5 py-1 font-mono whitespace-pre">
                        {r.code || <span className="italic text-amber-700">(trống)</span>}
                      </td>
                      <td className="max-w-[130px] truncate border border-slate-200 px-1.5 py-1">
                        {r.partner || <span className="italic text-amber-700">(dòng trống)</span>}
                      </td>
                      <td className="border border-slate-200 px-1.5 py-1 text-right font-mono">{r.value}</td>
                      <td className="border border-slate-200 px-1.5 py-1 text-center">
                        {marking ? (
                          r.kind === "blank" ? (
                            <span className="rounded bg-amber-600 px-1 py-0.5 text-[8.5px] font-bold text-white">Xóa trống</span>
                          ) : r.kind === "duplicate" ? (
                            <span className="rounded bg-rose-600 px-1 py-0.5 text-[8.5px] font-bold text-white">Xóa trùng</span>
                          ) : (
                            <span className="rounded bg-[#0047AB] px-1 py-0.5 text-[8.5px] font-bold text-white">Trim ô</span>
                          )
                        ) : (
                          <span className="text-[9px] text-slate-400">{r.status || "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function downloadGeneratedPdfDoc(docData: GeneratedContractDocData): Promise<string> {
  const prefix = docData.loaiMau === "addendum" ? "Phu-luc-" : docData.loaiMau === "report" ? "Bao-cao-" : "";
  const safeCode = (
    docData.loaiMau === "addendum" && docData.soPhuLuc ? docData.soPhuLuc : docData.soHD || "HD-MOI"
  ).replace(/[^\w.-]+/g, "-");
  const fileBase = `${prefix}${safeCode}`;
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "width:794px;box-sizing:border-box;padding:56px 42px 42px 72px;background:#fff;color:#000;";
  wrapper.innerHTML = renderTemplateBodyHtml(docData);
  await exportPagesPdf([wrapper], fileBase);
  return `${fileBase}.pdf`;
}

/** Modal xem trước A4 văn bản được tạo — hỗ trợ hợp đồng, phụ lục và báo cáo tóm tắt. */
function GeneratedDocPreviewModal({
  docData,
  onClose,
  onDownloadWord,
  onDownloadPdf,
  pdfBusy,
}: {
  docData: GeneratedContractDocData;
  onClose: () => void;
  onDownloadWord: (d: GeneratedContractDocData) => void;
  onDownloadPdf: (d: GeneratedContractDocData) => void;
  pdfBusy: boolean;
}) {
  if (typeof document === "undefined") return null;
  const titleCode = docData.loaiMau === "addendum" && docData.soPhuLuc ? docData.soPhuLuc : docData.soHD;
  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-900/70 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Xem trước văn bản ${titleCode}`}
      onClick={onClose}
    >
      <div className="w-full max-w-[820px] space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-lg">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">Bản xem trước A4 · {titleCode}</p>
            <p className="text-[11px] text-slate-500">
              Bản nháp do hệ thống soạn — cần người có thẩm quyền rà soát và ký (không ghi đè tệp gốc)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onDownloadWord(docData)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#185ABD] px-3 text-xs font-semibold text-white hover:bg-[#134899] cursor-pointer"
            >
              <DownloadSimple size={14} weight="bold" aria-hidden />
              Tải Word (.doc)
            </button>
            <button
              type="button"
              disabled={pdfBusy}
              onClick={() => onDownloadPdf(docData)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
            >
              <FilePdf size={14} weight="bold" aria-hidden />
              {pdfBusy ? "Đang xuất PDF…" : "Tải PDF (.pdf)"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
        <div
          className="rounded-xl border border-slate-300 bg-white p-6 shadow-2xl sm:p-10"
          dangerouslySetInnerHTML={{ __html: renderTemplateBodyHtml(docData) }}
        />
      </div>
    </div>,
    document.body
  );
}

/** Khung trợ lý mô phỏng tái hiện giao diện ChatBot + tự tạo & trả tệp Word (.doc) / PDF (.pdf) trực tiếp. */
function ChatbotOverlayMock({
  scenario,
  step,
  onPauseAutoPlay,
  onPreview,
  onDownloadWord,
  onDownloadPdf,
  pdfBusy,
  onAudit,
}: {
  scenario: DemoScenario;
  step: number;
  onPauseAutoPlay: () => void;
  onPreview: (d: GeneratedContractDocData) => void;
  onDownloadWord: (d: GeneratedContractDocData) => string;
  onDownloadPdf: (d: GeneratedContractDocData) => Promise<void>;
  pdfBusy: boolean;
  onAudit: (action: string) => void;
}) {
  const [customMessages, setCustomMessages] = useState<DemoChatBubble[]>([]);
  const [input, setInput] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scenarioChat: DemoChatBubble[] = scenario.chat
    .filter((m) => step >= m.stepVisibleFrom)
    .map((m) => {
      if (scenario.id === "word" && m.fileChip) {
        return {
          ...m,
          fileChip: undefined,
          attachments: makeWordPdfAttachments(DEFAULT_GENERATED_CONTRACT, ["word", "pdf"]),
        };
      }
      return m;
    });

  const allMessages = [...scenarioChat, ...customMessages];

  function scrollToBottom() {
    window.setTimeout(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  }

  function triggerWordDownload(docData: GeneratedContractDocData) {
    const fileName = onDownloadWord(docData);
    setStatusNote(`Đã tải tệp Word "${fileName}" về máy.`);
  }

  async function triggerPdfDownload(docData: GeneratedContractDocData) {
    setStatusNote("Đang dựng tệp PDF khổ A4…");
    await onDownloadPdf(docData);
    setStatusNote(`Đã tải tệp PDF (.pdf) cho ${docData.soHD}.`);
  }

  function generateFilesInChat(promptText: string, requestedFormats?: ("word" | "pdf")[]) {
    onPauseAutoPlay();
    const lower = promptText.toLocaleLowerCase("vi");
    const formats: ("word" | "pdf")[] = requestedFormats ?? (() => {
      const wantWord = /word|\.doc/.test(lower);
      const wantPdf = /pdf/.test(lower);
      if (wantWord && !wantPdf) return ["word"];
      if (wantPdf && !wantWord) return ["pdf"];
      return ["word", "pdf"];
    })();

    const isAddendum = /phụ lục|phu luc|bổ sung|dieu chinh|điều chỉnh/i.test(lower);
    const codeMatch = /\b((?:HD|PL)[A-Z0-9/_-]{3,})\b/i.exec(promptText);
    const moneyMatch = /([+-]?\s*[0-9][0-9.,]*(?:\s*(?:vnđ|vnd|đồng|triệu|trieu|tỷ|ty))?)/i.exec(promptText);

    const parsedMoney = moneyMatch?.[1]?.trim();
    const docData: GeneratedContractDocData = isAddendum
      ? {
          ...DEFAULT_GENERATED_CONTRACT,
          loaiMau: "addendum",
          soHD: "HD-DEMO-2026-01",
          soPhuLuc: codeMatch?.[1]?.toUpperCase() || "PL01/HD-DEMO-2026-01",
          giaTriGoc: "350.000.000 VNĐ",
          giaTriDieuChinh: parsedMoney && parsedMoney.length >= 2 ? parsedMoney : "+70.000.000 VNĐ",
          lyDoDieuChinh: "Điều chỉnh bổ sung khối lượng vật tư và gia hạn tiến độ theo yêu cầu trên khung chat.",
        }
      : {
          ...DEFAULT_GENERATED_CONTRACT,
          loaiMau: "contract",
          soHD: codeMatch?.[1]?.toUpperCase() || DEFAULT_GENERATED_CONTRACT.soHD,
          giaTri:
            parsedMoney && parsedMoney.length >= 4
              ? /vnđ|vnd|đồng|triệu|tỷ/i.test(parsedMoney)
                ? parsedMoney
                : `${parsedMoney} VNĐ (đã bao gồm VAT)`
              : DEFAULT_GENERATED_CONTRACT.giaTri,
        };

    const attachments = makeWordPdfAttachments(docData, formats);
    const labelStr = formats.length === 2 ? "Word (.doc) và PDF (.pdf)" : formats[0] === "word" ? "Word (.doc)" : "PDF (.pdf)";
    const heading = isAddendum
      ? `phụ lục ${docData.soPhuLuc} (điều chỉnh ${docData.giaTriDieuChinh})`
      : `hợp đồng ${docData.soHD} (${docData.giaTri})`;

    setCustomMessages((prev) => [
      ...prev,
      { role: "user", text: promptText, stepVisibleFrom: 0 },
      {
        role: "model",
        text: `Đã tự tạo ${heading} định dạng ${labelStr} (không ghi đè tệp gốc). Bấm «Xem» hoặc «Tải về» bên dưới:`,
        attachments,
        stepVisibleFrom: 0,
      },
    ]);
    setStatusNote(`Đã tạo ${attachments.length} tệp mới trên khung chat (${attachments.map((a) => a.fileName).join(", ")}).`);
    onAudit(`Tạo tệp trên khung trợ lý mô phỏng: ${attachments.map((a) => a.fileName).join(", ")}`);
    scrollToBottom();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    generateFilesInChat(text);
  }

  function renderAttachment(att: DemoFileAttachment) {
    const isWord = att.kind === "word";
    return (
      <div
        key={`${att.kind}-${att.fileName}`}
        className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-800"
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-black text-white ${
            isWord ? "bg-[#185ABD]" : "bg-rose-600"
          }`}
        >
          {isWord ? "W" : <FilePdf size={15} weight="bold" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10.5px] font-bold">{att.fileName}</div>
          <div className="truncate text-[9px] text-slate-500">{att.meta}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onPreview(att.docData)}
            title="Xem trước bản A4"
            className="inline-flex h-6 items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 text-[9.5px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <Eye size={11} aria-hidden />
            Xem
          </button>
          <button
            type="button"
            disabled={!isWord && pdfBusy}
            onClick={() => (isWord ? triggerWordDownload(att.docData) : void triggerPdfDownload(att.docData))}
            className={`inline-flex h-6 items-center gap-0.5 rounded px-1.5 text-[9.5px] font-semibold text-white cursor-pointer disabled:opacity-50 ${
              isWord ? "bg-[#185ABD] hover:bg-[#134899]" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            <DownloadSimple size={11} weight="bold" aria-hidden />
            {isWord ? ".doc" : pdfBusy ? "…" : ".pdf"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex shrink-0 items-center gap-2 bg-[#0047AB] px-3 py-2.5 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-7 w-7 shrink-0 rounded-full bg-white object-contain" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold">Trợ lý AI Thành Phát</div>
          <div className="truncate text-[10px] text-blue-100">Khung trợ lý mô phỏng · Tạo &amp; trả .doc / .pdf</div>
        </div>
        {customMessages.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setCustomMessages([]);
              setStatusNote("");
            }}
            className="rounded border border-white/35 bg-white/10 px-1.5 py-0.5 text-[9.5px] font-semibold hover:bg-white/20 cursor-pointer"
          >
            Chat mới
          </button>
        ) : (
          <span className="rounded border border-white/35 bg-white/10 px-1.5 py-0.5 text-[9.5px] font-semibold">
            Mô phỏng
          </span>
        )}
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-white/90" aria-hidden>
          <X size={12} weight="bold" />
        </span>
      </header>

      <div ref={scrollRef} className="max-h-[295px] flex-1 space-y-2 overflow-y-auto bg-[#f4f6fa] p-2.5">
        {allMessages.map((m, idx) => (
          <div key={idx} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[94%] whitespace-pre-line rounded-xl px-2.5 py-2 text-[11px] leading-relaxed shadow-2xs ${
                m.role === "user" ? "bg-[#0047AB] text-white" : "border border-slate-200/80 bg-white text-slate-800"
              }`}
            >
              {m.text}
              {m.attachments?.map((att) => renderAttachment(att))}
              {m.fileChip ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-800">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0047AB] text-white">
                    <FileText size={14} weight="bold" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[10.5px] font-bold">{m.fileChip.title}</div>
                    <div className="truncate text-[9px] text-slate-500">{m.fileChip.meta}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerWordDownload(DEFAULT_GENERATED_CONTRACT)}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[#0047AB] px-1.5 py-1 text-[9.5px] font-semibold text-white hover:bg-[#00388A] cursor-pointer"
                  >
                    <DownloadSimple size={11} weight="bold" />
                    Tải
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Quick generate Word / PDF / Addendum bar */}
      <div className="flex flex-wrap items-center gap-1 border-t border-slate-200 bg-slate-50 px-2 py-1.5">
        <button
          type="button"
          onClick={() => generateFilesInChat("Tạo hợp đồng mẫu xuất file Word (.doc)", ["word"])}
          className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-[#185ABD] hover:bg-blue-50 cursor-pointer"
        >
          <FileText size={11} weight="bold" aria-hidden />
          Tạo .doc
        </button>
        <button
          type="button"
          onClick={() => generateFilesInChat("Tạo hợp đồng mẫu xuất file PDF (.pdf)", ["pdf"])}
          className="inline-flex items-center gap-1 rounded border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
        >
          <FilePdf size={11} weight="bold" aria-hidden />
          Tạo .pdf
        </button>
        <button
          type="button"
          onClick={() => generateFilesInChat("Tạo phụ lục điều chỉnh +70.000.000 VNĐ xuất Word & PDF", ["word", "pdf"])}
          className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50 cursor-pointer"
        >
          <Sparkle size={10} weight="fill" aria-hidden />
          Tạo Phụ lục
        </button>
        <button
          type="button"
          onClick={() =>
            generateFilesInChat("Tạo hợp đồng mới HD-DEMO-2026-01-MOI giá trị 420.000.000 VNĐ trả cả file Word và PDF", [
              "word",
              "pdf",
            ])
          }
          className="inline-flex items-center gap-1 rounded bg-[#0047AB] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#00388A] cursor-pointer"
        >
          <Sparkle size={10} weight="fill" aria-hidden />
          Word + PDF
        </button>
        {statusNote ? <span className="w-full truncate pt-0.5 text-[9.5px] font-medium text-emerald-700">{statusNote}</span> : null}
      </div>

      <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-1.5 border-t border-slate-200 bg-white p-2">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500" aria-hidden>
          <Paperclip size={14} />
        </span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="VD: Tạo phụ lục +70 triệu hoặc HĐ-2026-09..."
          aria-label="Nhập lệnh tạo hợp đồng hoặc phụ lục Word/PDF trong khung trợ lý"
          className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] text-slate-800 outline-hidden focus:border-[#0047AB] focus:bg-white focus:ring-2 focus:ring-[#0047AB]/15"
        />
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-lg bg-[#0047AB] px-2.5 text-[10.5px] font-semibold text-white hover:bg-[#00388A] cursor-pointer"
        >
          Gửi
        </button>
      </form>
    </div>
  );
}

export default function AiReportPage() {
  const [sectionView, setSectionView] = useState<AiReportSectionId>("overview");
  const [scenarioId, setScenarioId] = useState<DemoScenarioId>("explorer");
  const [stepIndex, setStepIndex] = useState<number>(2);
  const [autoPlay, setAutoPlay] = useState<boolean>(true);

  const [docs, setDocs] = useState<ExtractedWordContract[]>(INITIAL_WORD_EXTRACTIONS);
  const [generatorSourceId, setGeneratorSourceId] = useState<string | undefined>(undefined);
  const [sessionAudit, setSessionAudit] = useState<AuditEntry[]>([]);
  const [previewDoc, setPreviewDoc] = useState<GeneratedContractDocData | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const scenario = COMPUTER_USE_SCENARIOS.find((s) => s.id === scenarioId) ?? COMPUTER_USE_SCENARIOS[0];
  const currentStep = scenario.steps[stepIndex] ?? scenario.steps[0];

  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setInterval(() => {
      setStepIndex((prev) => (prev + 1) % scenario.steps.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [autoPlay, scenario.steps.length, scenarioId]);

  function pushAudit(action: string) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setSessionAudit((prev) => [
      { id: `sa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time, actor: "Phiên hiện tại", action, scope: "real-session" },
      ...prev.slice(0, 29),
    ]);
  }

  function selectScenario(id: DemoScenarioId) {
    setScenarioId(id);
    setStepIndex(1);
    setAutoPlay(true);
  }

  function jumpToSection(target: Exclude<AiReportSectionId, "all" | "modules" | "overview">) {
    if (sectionView === "all") {
      const el = document.getElementById(`bao-cao-ai-${target}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    setSectionView(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleWordDownload(docData: GeneratedContractDocData): string {
    const fileName = downloadTemplateWordDoc(docData);
    pushAudit(`Tải Word (.doc): ${fileName}`);
    return fileName;
  }

  async function handlePdfDownload(docData: GeneratedContractDocData): Promise<void> {
    setPdfBusy(true);
    try {
      const fileName = await downloadGeneratedPdfDoc(docData);
      pushAudit(`Tải PDF (.pdf): ${fileName}`);
    } finally {
      setPdfBusy(false);
    }
  }

  function handleDocsAdded(newDocs: ExtractedWordContract[]) {
    setDocs((prev) => [...newDocs, ...prev]);
  }

  function handleUseForGenerator(doc: ExtractedWordContract) {
    setGeneratorSourceId(doc.id);
    pushAudit(`Chuyển dữ liệu "${doc.fileName}" sang khu vực tạo hợp đồng mới`);
    jumpToSection("generate");
  }

  const show = (id: Exclude<AiReportSectionId, "all" | "overview">) => sectionView === "all" || sectionView === id;

  return (
    <div className="space-y-4">
      {/* Top View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-2xs">
        <span className="text-xs font-bold text-slate-700">Khu vực hiển thị:</span>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Chọn khu vực Báo cáo AI">
          {(
            [
              ["overview", "Giới thiệu"],
              ["all", "Tất cả"],
              ["showcase", "Ảnh demo Chatbot"],
              ["modules", "Bản đồ 17 module"],
              ["desktop", "Demo Chatbot"],
              ["stats", "Dashboard & Thống kê"],
              ["extraction", "Đọc thư mục & Trích xuất"],
              ["generate", "Tạo hợp đồng mới"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={sectionView === id}
              onClick={() => setSectionView(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                sectionView === id
                  ? "bg-[#0047AB] text-white shadow-2xs"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {sectionView === "overview" ? <ProductOverview onJumpSection={jumpToSection} /> : null}

      {/* Hero Intro */}
      {sectionView !== "overview" ? <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0047AB]/10 px-3 py-1 text-xs font-bold text-[#0047AB]">
                <Sparkle size={14} weight="fill" aria-hidden />
                Giới thiệu sản phẩm
              </span>
              <CapBadge capability="sim" />
              <CapBadge capability="real" compact />
            </div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              Trợ lý AI Hợp đồng Thành Phát — Đọc thư mục cục bộ, Trích xuất, Soạn thảo &amp; Thống kê
            </h2>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              Trang giới thiệu toàn diện <b>17 module</b> của nền tảng AI quản lý hợp đồng cùng <b>khung trợ lý mô phỏng</b>: đọc tệp hợp đồng trong thư mục bạn cấp quyền trực tiếp trên trình duyệt (<code>.docx/.txt/.md</code>), đối chiếu trích dẫn từng điều khoản, soạn hợp đồng/phụ lục mới xuất Word (<code>.doc</code>) &amp; PDF (<code>.pdf</code>) không ghi đè tệp gốc, và tổng hợp thống kê danh mục hợp đồng.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
            <button
              type="button"
              onClick={() => jumpToSection("extraction")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0047AB] px-3.5 text-xs font-semibold text-white hover:bg-[#00388A] cursor-pointer"
            >
              <Files size={14} aria-hidden />
              Chọn thư mục đọc thử
            </button>
            <button
              type="button"
              onClick={() => jumpToSection("generate")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#0047AB] bg-white px-3.5 text-xs font-semibold text-[#0047AB] hover:bg-blue-50 cursor-pointer"
            >
              <FileText size={14} aria-hidden />
              Tạo hợp đồng / phụ lục
            </button>
          </div>
        </div>
      </section> : null}

      {/* 0. Chatbot AI Showcase covering all 17 F-Solution items */}
      {show("showcase") ? (
        <ChatbotShowcasePanel
          onPreview={setPreviewDoc}
          onDownloadWord={handleWordDownload}
          onDownloadPdf={handlePdfDownload}
          pdfBusy={pdfBusy}
          onAudit={pushAudit}
          onJumpSection={jumpToSection}
        />
      ) : null}

      {/* 1. 17-Module Map & 3 Workflow Ribbons */}
      {show("modules") ? <ModuleMap onJumpSection={jumpToSection} sessionAudit={sessionAudit} /> : null}

      {/* 2. Desktop Computer-Control Demo + Chatbot Overlay */}
      {show("desktop") ? (
        <div id="bao-cao-ai-desktop" className="space-y-4">
          {/* Scenario Switcher & Controls */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0047AB]/10 px-2.5 py-0.5 text-xs font-bold text-[#0047AB]">
                    <Sparkle size={13} weight="fill" aria-hidden />
                    Minh họa trực quan · Khung trợ lý mô phỏng
                  </span>
                  <CapBadge capability="sim" compact />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Kịch bản READ &amp; CREATE hợp đồng cùng kịch bản bổ sung Google Sheets
                </h3>
                <p className="text-xs text-slate-600">
                  Theo dõi từng bước trợ lý AI đọc hợp đồng, gắn trích dẫn nguồn từng trường và soạn hợp đồng/phụ lục mới xuất tệp <code>.doc</code> &amp; <code>.pdf</code> ngay trên khung chat.
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoPlay((v) => !v)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold cursor-pointer transition-colors ${
                    autoPlay
                      ? "bg-[#0047AB] text-white hover:bg-[#00388A]"
                      : "border border-[#0047AB] bg-white text-[#0047AB] hover:bg-blue-50"
                  }`}
                >
                  <Play size={14} weight="fill" aria-hidden />
                  {autoPlay ? "Đang chạy mô phỏng (Tạm dừng)" : "Chạy mô phỏng tự động"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStepIndex(0);
                    setAutoPlay(true);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <ArrowClockwise size={14} aria-hidden />
                  Xem lại từ đầu
                </button>
              </div>
            </div>

            <div
              className="mt-4 grid gap-2 sm:grid-cols-3"
              role="tablist"
              aria-label="Chọn kịch bản mô phỏng Chatbot điều khiển máy tính"
            >
              {COMPUTER_USE_SCENARIOS.map((item) => {
                const active = item.id === scenario.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectScenario(item.id)}
                    className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      active
                        ? "border-[#0047AB] bg-blue-50/80 ring-2 ring-[#0047AB]/15"
                        : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          active ? "bg-[#0047AB] text-white" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {item.badge}
                      </span>
                      {active ? <CheckCircle size={16} weight="fill" className="text-[#0047AB]" aria-hidden /> : null}
                    </div>
                    <p className="mt-1.5 text-xs font-bold text-slate-900 sm:text-sm">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{item.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Main Visual Stage: Simulated Windows Computer Screen controlled by Chatbot AI */}
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="ml-1 font-semibold text-white">Màn hình mô phỏng</span>
                <span className="hidden text-slate-400 sm:inline">· {scenario.appWindowTitle}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Bước {stepIndex + 1}/4: {currentStep.shortTitle}
              </span>
            </div>

            <div
              className="relative min-h-[450px] p-3 sm:p-4"
              style={{
                background: "linear-gradient(135deg, #0b234d 0%, #103775 48%, #0a1d3e 100%)",
              }}
            >
              <AiDesktopCursor
                x={currentStep.cursorX}
                y={currentStep.cursorY}
                label={currentStep.cursorLabel}
                clicking={currentStep.clicking}
              />

              <div className="grid h-full gap-3 lg:grid-cols-12">
                <div className="min-h-[370px] lg:col-span-8">
                  {scenario.appKind === "explorer" ? (
                    <ExplorerWindowMock step={stepIndex} />
                  ) : scenario.appKind === "word" ? (
                    <WordWindowMock step={stepIndex} />
                  ) : (
                    <SheetsWindowMock step={stepIndex} />
                  )}
                </div>

                <div className="min-h-[370px] lg:col-span-4">
                  <ChatbotOverlayMock
                    scenario={scenario}
                    step={stepIndex}
                    onPauseAutoPlay={() => setAutoPlay(false)}
                    onPreview={setPreviewDoc}
                    onDownloadWord={handleWordDownload}
                    onDownloadPdf={handlePdfDownload}
                    pdfBusy={pdfBusy}
                    onAudit={pushAudit}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-900/95 px-4 py-2 text-[11px] text-slate-300">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-[#0047AB]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Trợ lý AI Thành Phát" className="h-full w-full object-contain" />
                </span>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#0047AB] text-xs font-black text-white">
                  ⊞
                </span>
                <button
                  type="button"
                  onClick={() => selectScenario("explorer")}
                  className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[11px] font-semibold cursor-pointer ${
                    scenario.appKind === "explorer"
                      ? "bg-white/15 text-white ring-1 ring-amber-400/70"
                      : "text-slate-400 hover:bg-white/10"
                  }`}
                >
                  <Files size={13} className="text-amber-400" aria-hidden />
                  File Explorer (READ)
                </button>
                <button
                  type="button"
                  onClick={() => selectScenario("word")}
                  className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[11px] font-semibold cursor-pointer ${
                    scenario.appKind === "word"
                      ? "bg-white/15 text-white ring-1 ring-blue-400/70"
                      : "text-slate-400 hover:bg-white/10"
                  }`}
                >
                  <FileText size={13} className="text-blue-400" aria-hidden />
                  Word (CREATE)
                </button>
                <button
                  type="button"
                  onClick={() => selectScenario("sheets")}
                  className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[11px] font-semibold cursor-pointer ${
                    scenario.appKind === "sheets"
                      ? "bg-white/15 text-white ring-1 ring-emerald-400/70"
                      : "text-slate-400 hover:bg-white/10"
                  }`}
                >
                  <Sparkle size={13} className="text-emerald-400" aria-hidden />
                  Google Sheets (Bổ sung)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden text-[10.5px] text-slate-400 md:inline">{currentStep.actionLog}</span>
              </div>
            </div>
          </section>

          {/* Boundary note directly under desktop monitor stage */}
          <div className="flex flex-wrap items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-950">
            <ShieldCheck size={16} weight="fill" className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
            <p className="leading-relaxed">
              <b>Ranh giới Mô phỏng vs Thao tác thật:</b> Cửa sổ File Explorer, Word, Google Sheets và đường dẫn <code>D:\HoSo_HopDong_Mau</code> ở sân khấu trên là <b>Mô phỏng · dữ liệu mẫu</b> nhằm minh họa luồng AI. Chức năng đọc thư mục/tệp thật nằm ở khu vực <b>Đọc thư mục &amp; Trích xuất</b> bên dưới — chỉ mở những tệp bạn chủ động chọn trên trình duyệt, không tự quét ổ đĩa, không gửi dữ liệu ra máy chủ và không ghi đè tệp gốc.
            </p>
          </div>

          {/* Interactive Step Timeline + Capability Summary */}
          <section className="grid gap-4 lg:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs lg:col-span-8">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">Chuỗi 4 bước minh họa ({scenario.badge})</h3>
                <span className="text-[11px] text-slate-500">Bấm từng bước để tạm dừng &amp; xem trạng thái màn hình</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {scenario.steps.map((s) => {
                  const active = s.index === stepIndex;
                  const done = s.index < stepIndex;
                  return (
                    <button
                      key={s.index}
                      type="button"
                      onClick={() => {
                        setAutoPlay(false);
                        setStepIndex(s.index);
                      }}
                      className={`rounded-lg border p-2.5 text-left transition-all cursor-pointer ${
                        active
                          ? "border-[#0047AB] bg-blue-50 ring-2 ring-[#0047AB]/20"
                          : done
                            ? "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                            active
                              ? "bg-[#0047AB] text-white"
                              : done
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {s.index + 1}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {active ? "Đang xem" : done ? "Xong" : ""}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs font-bold text-slate-900">{s.shortTitle}</p>
                      <p className="mt-0.5 text-[10.5px] leading-snug text-slate-600">{s.actionLog}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs lg:col-span-4">
              <h3 className="text-sm font-bold text-slate-900">Điểm nổi bật kịch bản này</h3>
              <ul className="mt-2.5 space-y-2 text-xs text-slate-700">
                {scenario.summaryPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle size={15} weight="fill" className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      ) : null}

      {/* 3. Contract Dashboard & Statistics (Module 1, 2, 3, 12, 14) */}
      {show("stats") ? <ContractDashboardPanel docs={docs} onAudit={pushAudit} /> : null}

      {/* 4. Authorized Local Folder Reader + Word Extraction Manager */}
      {show("extraction") ? (
        <div className="space-y-4">
          <FolderReaderPanel onDocsAdded={handleDocsAdded} onAudit={pushAudit} />
          <ContractExtractionManager
            docs={docs}
            onDocsChange={setDocs}
            onUseForGenerator={handleUseForGenerator}
            onAudit={pushAudit}
          />
        </div>
      ) : null}

      {/* 5. New Contract / Addendum / Summary Report Generator */}
      {show("generate") ? (
        <ContractGeneratorPanel
          docs={docs}
          selectedSourceDocId={generatorSourceId}
          onPreview={setPreviewDoc}
          onAudit={pushAudit}
          onDownloadPdf={handlePdfDownload}
          pdfBusy={pdfBusy}
        />
      ) : null}

      {/* Shared Fullscreen A4 Preview Modal */}
      {previewDoc ? (
        <GeneratedDocPreviewModal
          docData={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onDownloadWord={handleWordDownload}
          onDownloadPdf={(d) => void handlePdfDownload(d)}
          pdfBusy={pdfBusy}
        />
      ) : null}
    </div>
  );
}
