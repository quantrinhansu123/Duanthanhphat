"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle, FileText, ShieldCheck, Sparkle } from "@/components/icons";
import { AI_CONTRACT_MODULES, type AiReportSectionId, type ModuleCapability } from "@/lib/aiReportDemo";

const GROUPS = [
  { title: "01 · Nền tảng & kho hồ sơ", ids: [1, 2, 3, 7], description: "Một nơi cho hợp đồng, phụ lục, dự toán và tài liệu gốc." },
  { title: "02 · Trợ lý AI & kiểm soát", ids: [4, 5, 6, 9], description: "Hỏi đáp có nguồn, phân quyền và theo dõi rủi ro." },
  { title: "03 · Khối lượng & thực hiện", ids: [8, 10, 11, 12], description: "Đối chiếu BOQ, phụ lục, tiến độ và thanh toán." },
  { title: "04 · Báo cáo & kết nối", ids: [13, 14, 15, 16, 17], description: "Soạn văn bản, cảnh báo, xuất báo cáo và tích hợp." },
] as const;

const STATUS: Record<ModuleCapability, { label: string; className: string }> = {
  real: { label: "Có phần dùng thử", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  sim: { label: "Minh họa", className: "bg-amber-50 text-amber-800 border-amber-200" },
  plan: { label: "Theo kế hoạch", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

const WAREHOUSE_CHECKLIST = [
  "Danh mục vật tư, mã hàng, đơn vị tính, vị trí kho và tồn đầu kỳ",
  "Phiếu nhập / xuất / chuyển kho gắn dự án, nhà cung cấp và hợp đồng",
  "Đối chiếu vật tư thực nhận với BOQ, khối lượng hợp đồng và phụ lục",
  "Theo dõi tồn khả dụng, vật tư đã cấp phát, lô hàng và chứng từ",
  "Cảnh báo thiếu hàng, vượt định mức hoặc xuất vượt khối lượng được duyệt",
];

export default function ProductOverview({
  onJumpSection,
}: {
  onJumpSection: (section: Exclude<AiReportSectionId, "all" | "modules" | "overview">) => void;
}) {
  const [openGroup, setOpenGroup] = useState<number | null>(0);

  return (
    <div className="space-y-5" id="bao-cao-ai-overview">
      <section className="relative overflow-hidden rounded-[28px] bg-[#082a54] text-white shadow-lg">
        <div className="absolute -right-28 -top-36 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl" aria-hidden />
        <div className="relative grid gap-8 p-6 sm:p-9 xl:grid-cols-[0.9fr_1.1fr] xl:items-center xl:gap-10">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wide text-blue-100">
              <Sparkle size={15} weight="fill" aria-hidden /> THÀNH PHÁT · CONTRACT INTELLIGENCE
            </span>
            <h2 className="mt-5 max-w-xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              Từ hợp đồng đến công trường, mọi thông tin trong một luồng.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-blue-100/90">
              Giới thiệu hệ thống AI quản lý và hỏi đáp hợp đồng theo đề cương 17 module: tập trung kho hồ sơ,
              số hóa tài liệu, đối chiếu dự toán, theo dõi thực hiện và cảnh báo. Bổ sung góc nhìn kho vật tư
              để thấy luồng kết nối từ cam kết hợp đồng đến nhập – xuất – tồn.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <button type="button" onClick={() => onJumpSection("extraction")} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#0b3771] transition-colors hover:bg-blue-50">
                Xem kho hồ sơ dùng thử <ArrowRight size={15} aria-hidden />
              </button>
              <button type="button" onClick={() => onJumpSection("stats")} className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-white/10">
                Xem dashboard minh họa
              </button>
            </div>
            <p className="mt-5 text-[11px] leading-relaxed text-blue-200">
              Hình minh họa dùng dữ liệu giả lập. Trang giới thiệu không phải hệ thống AI/OCR hoặc kho vật tư đã triển khai đầy đủ.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/20 bg-white p-2 shadow-2xl shadow-black/20">
            {/* Static product illustration: no autoplay, video or external media. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ai-contract/overview.svg" alt="Ảnh minh họa giao diện tổng quan hợp đồng, kho hồ sơ và đối chiếu vật tư với dữ liệu mẫu" className="block h-auto w-full rounded-xl" />
          </div>
        </div>
        <div className="relative grid border-t border-white/15 bg-white/5 text-center sm:grid-cols-3">
          {[
            ["17", "module trong đề cương hợp đồng"],
            ["04", "nhóm chức năng dễ theo dõi"],
            ["01", "phần mở rộng kho vật tư đề xuất"],
          ].map(([value, label]) => (
            <div key={label} className="border-b border-white/10 px-5 py-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
              <span className="text-2xl font-black text-white">{value}</span>
              <span className="ml-2 text-xs text-blue-100">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3" aria-label="Luồng quản lý hợp đồng">
        {[
          { number: "01", title: "Kho hồ sơ tập trung", text: "Phân loại theo dự án, đối tác và loại hợp đồng; liên kết bản gốc, phụ lục, nghiệm thu, hóa đơn.", action: "Mở kho hồ sơ", target: "extraction" as const },
          { number: "02", title: "AI đọc & đối chiếu", text: "Bóc tách điều khoản, hỏi đáp có trích dẫn; so sánh hợp đồng với BOQ và ghi nhận điểm cần rà soát.", action: "Xem mô phỏng", target: "desktop" as const },
          { number: "03", title: "Theo dõi đến quyết toán", text: "Quản lý biến động, mốc thanh toán, bảo lãnh, công nợ và xuất văn bản hoặc báo cáo.", action: "Xem thống kê", target: "stats" as const },
        ].map((item) => (
          <article key={item.number} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <span className="text-xs font-black tracking-widest text-[#0047AB]">{item.number} / QUY TRÌNH</span>
            <h3 className="mt-3 text-lg font-bold text-slate-900">{item.title}</h3>
            <p className="mt-2 flex-1 text-xs leading-6 text-slate-600">{item.text}</p>
            <button type="button" onClick={() => onJumpSection(item.target)} className="mt-4 inline-flex w-fit items-center gap-1.5 text-xs font-bold text-[#0047AB] hover:underline">
              {item.action} <ArrowRight size={14} aria-hidden />
            </button>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6" aria-labelledby="contract-checklist-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#0047AB]">Checklist theo hợp đồng · Điều 2 & Phụ lục III</span>
            <h3 id="contract-checklist-title" className="mt-1 text-xl font-bold text-slate-900">Đủ 17 hạng mục, rõ trạng thái từng phần</h3>
            <p className="mt-1 text-xs text-slate-600">Mở từng nhóm để xem nội dung và phạm vi bản giới thiệu. “Có phần dùng thử” không có nghĩa module đã hoàn tất.</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#0047AB]">17 / 17 hạng mục được liệt kê</span>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {GROUPS.map((group, index) => (
            <div key={group.title} className="overflow-hidden rounded-xl border border-slate-200">
              <button type="button" aria-expanded={openGroup === index} onClick={() => setOpenGroup(openGroup === index ? null : index)} className="flex w-full items-start justify-between gap-3 bg-slate-50 p-4 text-left hover:bg-blue-50/60">
                <span>
                  <span className="block text-sm font-bold text-slate-900">{group.title}</span>
                  <span className="mt-1 block text-xs text-slate-600">{group.description}</span>
                </span>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">{group.ids.length} mục {openGroup === index ? "−" : "+"}</span>
              </button>
              {openGroup === index && (
                <ol className="divide-y divide-slate-100 p-2">
                  {group.ids.map((id) => {
                    const mod = AI_CONTRACT_MODULES.find((item) => item.id === id)!;
                    return (
                      <li key={id} className="rounded-lg px-2 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <span className="flex min-w-0 flex-1 gap-2 text-xs font-bold text-slate-800">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] text-[#0047AB]">{id}</span>
                            {mod.title}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS[mod.capability].className}`}>{STATUS[mod.capability].label}</span>
                        </div>
                        <ul className="mt-1.5 space-y-1 pl-7">
                          {mod.details.map((detail) => (
                            <li key={detail} className="flex items-start gap-1.5 text-[11px] leading-5 text-slate-600">
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#0047AB]" aria-hidden />
                              {detail}
                            </li>
                          ))}
                        </ul>
                        {mod.demoRef && (
                          <button type="button" onClick={() => onJumpSection(mod.demoRef!)} className="mt-1.5 pl-7 text-[11px] font-bold text-[#0047AB] hover:underline">Xem phần liên quan →</button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]" aria-label="Kho vật tư và ranh giới phạm vi">
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 sm:p-6">
          <div className="flex items-center gap-2 text-teal-800"><FileText size={20} aria-hidden /><span className="text-xs font-black uppercase tracking-widest">Phần mở rộng đề xuất · Kho vật tư</span></div>
          <h3 className="mt-3 text-xl font-bold text-slate-900">Nối hợp đồng với vật tư thực tế</h3>
          <p className="mt-2 text-xs leading-6 text-slate-600">Đề xuất nghiệp vụ bổ sung ngoài 17 module của hợp đồng; không thể hiện như tính năng kho đã vận hành.</p>
          <ul className="mt-4 space-y-2.5">
            {WAREHOUSE_CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs leading-5 text-slate-700"><CheckCircle size={16} className="mt-0.5 shrink-0 text-teal-700" aria-hidden />{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2 text-[#0047AB]"><ShieldCheck size={20} aria-hidden /><span className="text-xs font-black uppercase tracking-widest">Ranh giới triển khai</span></div>
          <h3 className="mt-3 text-xl font-bold text-slate-900">Minh bạch giữa ý tưởng và sản phẩm</h3>
          <div className="mt-4 space-y-3 text-xs leading-6 text-slate-700">
            <p><b>Đang dùng thử trên trang:</b> đọc tệp .docx/.txt/.md do người dùng chọn trong trình duyệt, kiểm tra trường trích xuất, thống kê từ dữ liệu đã đọc và tạo bản nháp.</p>
            <p><b>Đang minh họa:</b> OCR PDF scan/ảnh, chatbot AI có trích dẫn, đối chiếu BOQ, cảnh báo và các số liệu dashboard mẫu.</p>
            <p><b>Chưa tích hợp đầy đủ:</b> Vector DB/RAG, Gemini API, phân quyền 2FA, thông báo Email, ERP và quy trình kho vật tư thực tế.</p>
          </div>
          <button type="button" onClick={() => onJumpSection("generate")} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0047AB] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#00388A]">
            Xem bản nháp hợp đồng <ArrowRight size={14} aria-hidden />
          </button>
        </div>
      </section>
    </div>
  );
}
