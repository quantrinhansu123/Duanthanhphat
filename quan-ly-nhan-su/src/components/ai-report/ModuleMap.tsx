"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CheckCircle,
  FileText,
  Lightning,
  ShieldCheck,
  Sparkle,
  WarningCircle,
  X,
} from "@/components/icons";
import CapBadge from "@/components/ai-report/CapBadge";
import {
  AI_CONTRACT_MODULES,
  PRODUCT_WORKFLOWS,
  SYNTHETIC_ALERTS,
  SYNTHETIC_AUDIT,
  SYNTHETIC_BOQ,
  SYNTHETIC_QA,
  type AiReportSectionId,
  type AuditEntry,
  type ContractModule,
  type ModuleCapability,
} from "@/lib/aiReportDemo";

function ModuleSimPreview({ mod, sessionAudit }: { mod: ContractModule; sessionAudit: AuditEntry[] }) {
  if (mod.id === 3) {
    return (
      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-amber-950">Minh họa OCR trang hợp đồng scan</span>
          <CapBadge capability="sim" compact />
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-3 font-serif text-[12px] leading-relaxed text-slate-900">
          <p className="font-bold text-center">HỢP ĐỒNG MẪU (TRANG SCAN MÔ PHỎNG)</p>
          <p className="mt-2">
            <span className="rounded bg-blue-100 px-1 font-semibold">Các bên tham gia:</span> Công ty TNHH Vật Tư Mẫu Alpha &amp; Công ty CP Thiết Bị Minh Họa Beta
          </p>
          <p className="mt-1">
            <span className="rounded bg-emerald-100 px-1 font-semibold">Giá trị:</span> 350.000.000 VNĐ ·{" "}
            <span className="rounded bg-amber-100 px-1 font-semibold">Thời hạn:</span> 30 ngày
          </p>
          <p className="mt-1">
            <span className="rounded bg-violet-100 px-1 font-semibold">Thanh toán:</span> Tạm ứng 30%, 70% sau nghiệm thu ·{" "}
            <span className="rounded bg-cyan-100 px-1 font-semibold">Bảo lãnh:</span> 10% giá trị ·{" "}
            <span className="rounded bg-rose-100 px-1 font-semibold">Phạt vi phạm:</span> 0,05%/ngày (tối đa 8%)
          </p>
        </div>
      </div>
    );
  }

  if (mod.id === 4) {
    return (
      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-amber-950">Hỏi đáp tiếng Việt có trích dẫn điều khoản</span>
          <CapBadge capability="sim" compact />
        </div>
        <div className="space-y-2">
          {SYNTHETIC_QA.map((item, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-2.5">
              <p className="font-bold text-[#0047AB]">Hỏi: {item.q}</p>
              <p className="mt-1 text-slate-700">{item.a}</p>
              <p className="mt-1 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600">
                <FileText size={11} aria-hidden />
                Trích dẫn: {item.citation}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mod.id === 5) {
    return (
      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-amber-950">Ma trận phân quyền RBAC &amp; bảo mật 2FA</span>
          <CapBadge capability="sim" compact />
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-[11px]">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="border-b px-2 py-1.5 text-left">Vai trò</th>
                <th className="border-b px-2 py-1.5 text-center">Xem dự án</th>
                <th className="border-b px-2 py-1.5 text-center">Sửa / Duyệt</th>
                <th className="border-b px-2 py-1.5 text-center">2FA</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Ban giám đốc", "Toàn bộ", "Duyệt", "Bắt buộc"],
                ["Pháp chế / Đấu thầu", "Theo gói thầu", "Sửa + Rà soát", "Bắt buộc"],
                ["Kỹ sư QS", "Dự án được gán", "Trích xuất + BOQ", "Khuyến nghị"],
                ["Kế toán", "Theo công nợ", "Chỉ xem + Xuất", "Bắt buộc"],
                ["Đối tác / Khách hàng", "HĐ liên quan", "Chỉ xem", "OTP"],
              ].map(([role, scope, perm, twofa]) => (
                <tr key={role} className="border-b last:border-0">
                  <td className="px-2 py-1.5 font-semibold">{role}</td>
                  <td className="px-2 py-1.5 text-center">{scope}</td>
                  <td className="px-2 py-1.5 text-center">{perm}</td>
                  <td className="px-2 py-1.5 text-center font-semibold text-emerald-700">{twofa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (mod.id === 6) {
    const merged = [...sessionAudit, ...SYNTHETIC_AUDIT];
    return (
      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-amber-950">Nhật ký thao tác phiên hiện tại &amp; mẫu</span>
          <CapBadge capability="sim" compact />
        </div>
        <div className="space-y-1.5">
          {merged.slice(0, 6).map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]">
              <div>
                <span className="font-bold text-slate-900">{item.actor}</span>{" "}
                <span className="text-slate-600">— {item.action}</span>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-slate-400">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mod.id === 7) {
    return (
      <div className="space-y-2 rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800">Sơ đồ kiến trúc Hybrid (PostgreSQL + Vector DB + RAG)</span>
          <CapBadge capability="plan" compact />
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          {[
            ["1. Tiếp nhận & OCR", "PDF scan / DOCX / Excel"],
            ["2. CSDL Quan hệ", "PostgreSQL (Danh mục HĐ, Tiến độ)"],
            ["3. CSDL Vector", "Chroma / pgvector + Embedding đa ngữ"],
            ["4. LLM Hỏi đáp", "Google Gemini API (trích dẫn điều khoản)"],
          ].map(([head, sub]) => (
            <div key={head} className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
              <p className="font-bold text-[#0047AB]">{head}</p>
              <p className="mt-1 text-[10.5px] text-slate-600">{sub}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-600">
          Trạng thái hiện tại: thiết kế kiến trúc mục tiêu; bản giới thiệu trên trang này chưa kết nối Vector DB hay gọi API LLM ngoài.
        </p>
      </div>
    );
  }

  if (mod.id === 8 || mod.id === 10) {
    return (
      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-amber-950">Bảng đối chiếu Hợp đồng — Dự toán BOQ (dữ liệu mẫu)</span>
          <CapBadge capability="sim" compact />
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-[11px]">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="border-b px-2 py-1.5 text-left">Mã hiệu</th>
                <th className="border-b px-2 py-1.5 text-left">Hạng mục</th>
                <th className="border-b px-2 py-1.5 text-right">KL HĐ</th>
                <th className="border-b px-2 py-1.5 text-right">KL Dự toán</th>
                <th className="border-b px-2 py-1.5 text-center">Đơn giá</th>
                <th className="border-b px-2 py-1.5 text-center">Đối chiếu</th>
              </tr>
            </thead>
            <tbody>
              {SYNTHETIC_BOQ.map((r) => (
                <tr key={r.code} className="border-b last:border-0">
                  <td className="px-2 py-1.5 font-mono font-semibold">{r.code}</td>
                  <td className="px-2 py-1.5">{r.item}</td>
                  <td className="px-2 py-1.5 text-right">{r.contractQty} {r.unit}</td>
                  <td className="px-2 py-1.5 text-right">{r.boqQty} {r.unit}</td>
                  <td className="px-2 py-1.5 text-center text-slate-500">{r.unitPriceLabel}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${r.diff === "Khớp" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {r.diff}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (mod.id === 9) {
    return (
      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-amber-950">Bộ quy tắc kiểm tra rủi ro pháp lý (mô phỏng)</span>
          <CapBadge capability="sim" compact />
        </div>
        <div className="space-y-1.5">
          {[
            { level: "Cao", text: "HD-DEMO-2026-02 thiếu điều khoản giới hạn trần phạt vi phạm (theo luật xây dựng tối đa 8–12%).", suggest: "Bổ sung trần phạt và điều kiện miễn trừ bất khả kháng." },
            { level: "Trung bình", text: "PL01/HD-DEMO-2026-01 tăng giá trị +20% nhưng chưa cập nhật hạn mức bảo lãnh thực hiện tương ứng.", suggest: "Yêu cầu bổ sung thư bảo lãnh trước khi giải ngân đợt kế tiếp." },
            { level: "Đạt", text: "HD-DEMO-2026-01 đầy đủ điều khoản nghiệm thu, thanh toán 15 ngày và bảo hành 12 tháng.", suggest: "Đáp ứng quy chế nội bộ." },
          ].map((item, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 bg-white p-2.5">
              <div className="flex items-center gap-1.5">
                <WarningCircle size={14} className={item.level === "Cao" ? "text-rose-600" : item.level === "Trung bình" ? "text-amber-600" : "text-emerald-600"} aria-hidden />
                <span className="font-bold text-slate-900">Mức {item.level}:</span>
                <span className="text-slate-700">{item.text}</span>
              </div>
              <p className="mt-1 pl-5 text-[11px] text-[#0047AB]">Đề xuất: {item.suggest}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mod.id === 14) {
    return (
      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-amber-950">Cảnh báo trong phần mềm / Email (mô phỏng — không gửi email thật)</span>
          <CapBadge capability="sim" compact />
        </div>
        <div className="space-y-1.5">
          {SYNTHETIC_ALERTS.slice(0, 4).map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
              <div>
                <p className="font-bold text-slate-900">{a.contractCode} · {a.title}</p>
                <p className="text-[11px] text-slate-600">{a.detail}</p>
              </div>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${a.severity === "high" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-900"}`}>
                {a.severity === "high" ? "Khẩn" : "Lưu ý"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
          <ShieldCheck size={15} className="text-[#0047AB]" aria-hidden />
          Phạm vi triển khai trên bản giới thiệu hiện tại
        </span>
        <CapBadge capability={mod.capability} compact />
      </div>
      <p className="mt-1.5 leading-relaxed">
        {mod.capability === "real"
          ? "Chức năng cốt lõi đang hoạt động cục bộ ngay trên trang này (không gửi dữ liệu ra máy chủ ngoài)."
          : mod.capability === "sim"
            ? "Đang trình bày ở chế độ mô phỏng bằng dữ liệu mẫu tổng hợp để minh họa luồng nghiệp vụ."
            : "Hạng mục thuộc giai đoạn tích hợp hạ tầng/API ở lộ trình tiếp theo (chưa kết nối dịch vụ ngoài trên bản này)."}
      </p>
    </div>
  );
}

export default function ModuleMap({
  onJumpSection,
  sessionAudit,
}: {
  onJumpSection: (section: Exclude<AiReportSectionId, "all" | "modules" | "overview" | "showcase">) => void;
  sessionAudit: AuditEntry[];
}) {
  const [filter, setFilter] = useState<"all" | ModuleCapability>("all");
  const [activeMod, setActiveMod] = useState<ContractModule | null>(null);

  const counts = useMemo(() => {
    const real = AI_CONTRACT_MODULES.filter((m) => m.capability === "real").length;
    const sim = AI_CONTRACT_MODULES.filter((m) => m.capability === "sim").length;
    const plan = AI_CONTRACT_MODULES.filter((m) => m.capability === "plan").length;
    return { total: AI_CONTRACT_MODULES.length, real, sim, plan };
  }, []);

  const visibleModules = useMemo(
    () => (filter === "all" ? AI_CONTRACT_MODULES : AI_CONTRACT_MODULES.filter((m) => m.capability === filter)),
    [filter]
  );

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5" aria-label="Bản đồ 17 module hệ thống AI quản lý hợp đồng">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0047AB]/10 px-3 py-1 text-xs font-bold text-[#0047AB]">
              <Sparkle size={13} weight="fill" aria-hidden />
              Bản đồ 17 module
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              {counts.total} module · {counts.real} có thật · {counts.sim} mô phỏng · {counts.plan} kế hoạch
            </span>
          </div>
          <h2 className="mt-1.5 text-base font-bold text-slate-900">
            Toàn cảnh 17 module Chatbot AI quản lý &amp; hỏi đáp hợp đồng
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Nhấn vào từng thẻ để xem đủ nội dung chi tiết, minh họa mô phỏng hoặc đi thẳng tới phân hệ đang chạy cục bộ trên trang.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc 17 module theo trạng thái sẵn sàng">
          {([
            ["all", `Tất cả (${counts.total})`],
            ["real", `Có thật (${counts.real})`],
            ["sim", `Mô phỏng (${counts.sim})`],
            ["plan", `Kế hoạch (${counts.plan})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/40 ${
                filter === key
                  ? "bg-[#0047AB] text-white"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 17 Compact Scannable Cards */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {visibleModules.map((mod) => (
          <button
            key={mod.id}
            type="button"
            onClick={() => setActiveMod(mod)}
            className={`group flex flex-col justify-between rounded-xl border p-3 text-left transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0047AB]/40 ${
              mod.focus
                ? "border-[#0047AB]/40 bg-blue-50/35 ring-2 ring-[#0047AB]/20 hover:bg-blue-50/70"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0047AB] text-[11px] font-bold text-white">
                  {mod.id}
                </span>
                <CapBadge capability={mod.capability} compact />
              </div>
              <h3 className="mt-2 text-sm font-bold leading-snug text-slate-900 group-hover:text-[#0047AB]">
                {mod.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
                {mod.details[0]}
              </p>
            </div>
            <div className="mt-2 flex items-center justify-between pt-1.5 text-[10.5px] font-semibold text-[#0047AB]">
              <span>{mod.details.length} đầu mục chi tiết</span>
              <span className="inline-flex items-center gap-0.5">
                {mod.demoRef ? "Xem chi tiết / Mở khu vực" : "Xem chi tiết"}
                <ArrowRight size={11} aria-hidden />
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Three Product Workflow Ribbons (A, B, C) */}
      <div className="space-y-2.5 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">3 luồng nghiệp vụ trọng tâm của hệ thống</h3>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-amber-950">
            <Lightning size={11} aria-hidden />
            Mô phỏng · dữ liệu mẫu (luồng mục tiêu)
          </span>
        </div>
        <div className="grid gap-2.5 lg:grid-cols-3">
          {PRODUCT_WORKFLOWS.map((wf) => (
            <div key={wf.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs font-bold text-[#0047AB]">{wf.title}</p>
              <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-700">
                {wf.steps.map((step, i) => (
                  <li key={i} className="inline-flex items-center gap-1">
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-800">
                      <b className="text-[#0047AB]">{i + 1}.</b> {step}
                    </span>
                    {i < wf.steps.length - 1 ? <ArrowRight size={11} className="text-slate-400" aria-hidden /> : null}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {/* Module Detail & Sim Drawer */}
      {activeMod && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex justify-end bg-slate-900/60"
              role="dialog"
              aria-modal="true"
              aria-label={`Chi tiết module ${activeMod.id}: ${activeMod.title}`}
              onClick={() => setActiveMod(null)}
            >
              <div
                className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-6 items-center rounded-full bg-[#0047AB] px-2.5 text-xs font-bold text-white">
                        Module #{activeMod.id}
                      </span>
                      <CapBadge capability={activeMod.capability} />
                    </div>
                    <h3 className="mt-2 text-base font-bold text-slate-900">{activeMod.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMod(null)}
                    aria-label="Đóng chi tiết module"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <X size={16} weight="bold" aria-hidden />
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Nội dung chi tiết theo đề cương</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-800">
                      {activeMod.details.map((d, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-[#0047AB]" aria-hidden />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <ModuleSimPreview mod={activeMod} sessionAudit={sessionAudit} />

                  {activeMod.demoRef ? (
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          const target = activeMod.demoRef!;
                          setActiveMod(null);
                          onJumpSection(target);
                        }}
                        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0047AB] px-4 text-xs font-semibold text-white hover:bg-[#00388A] cursor-pointer"
                      >
                        Mở khu vực trình diễn trực tiếp
                        <ArrowRight size={14} aria-hidden />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
