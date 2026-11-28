"use client";

import { useState } from "react";
import {
  ArrowRight,
  ChartBar,
  CheckCircle,
  DownloadSimple,
  Eye,
  FilePdf,
  FileText,
  Minus,
  Paperclip,
  ShieldCheck,
  Sparkle,
  WarningCircle,
  X,
} from "@/components/icons";
import CapBadge from "@/components/ai-report/CapBadge";
import {
  AI_CONTRACT_MODULES,
  DEFAULT_GENERATED_CONTRACT,
  exportBoqReconciliationCsv,
  exportExtractionsToCsv,
  formatVndCompact,
  INITIAL_WORD_EXTRACTIONS,
  renderTemplateBodyHtml,
  SYNTHETIC_ALERTS,
  SYNTHETIC_BOQ,
  SYNTHETIC_PORTFOLIO,
  type AiReportSectionId,
  type GeneratedContractDocData,
} from "@/lib/aiReportDemo";

export type ShowcaseScenarioId = "qa-ocr-risk" | "boq-cost" | "draft-addendum" | "dashboard-alerts";

type CitationItem = {
  id: string;
  badge: string;
  source: string;
  excerpt: string;
};

type ReturnedFileCard = {
  id: string;
  kind: "word" | "pdf" | "excel";
  fileName: string;
  meta: string;
  docData?: GeneratedContractDocData;
  csvType?: "boq" | "portfolio";
};

type ShowcaseScenario = {
  id: ShowcaseScenarioId;
  shortLabel: string;
  title: string;
  subtitle: string;
  moduleIds: number[];
  roleLabel: string;
  auditTag: string;
  userPrompt: string;
  assistantLead: string;
  assistantPoints: string[];
  citations: CitationItem[];
  files: ReturnedFileCard[];
};

const DOC_LEGAL_SUMMARY: GeneratedContractDocData = {
  ...DEFAULT_GENERATED_CONTRACT,
  loaiMau: "report",
  soHD: "HD-DEMO-2026-01",
  giaTri: "420.000.000 VNĐ (gồm PL01 +70.000.000 VNĐ)",
  thanhToan: "Tạm ứng 30%; thanh toán 70% trong 15 ngày sau nghiệm thu; bảo lãnh thực hiện 10%.",
};

const DOC_BOQ_REPORT: GeneratedContractDocData = {
  ...DEFAULT_GENERATED_CONTRACT,
  loaiMau: "report",
  soHD: "BOQ-HD-DEMO-2026-01",
  hangMuc: "Đối chiếu bảng khối lượng BOQ & dự toán Tuyến mẫu số 01 (5 hạng mục: 3 khớp, 1 chênh +20 tấm đệm, 1 thiếu 1 lần hiệu chuẩn).",
  giaTri: "Chênh lệch dự toán mẫu: +18.500.000 VNĐ (cần thương thảo trước khi chốt phụ lục)",
  thanhToan: "Đối chiếu theo định mức và hồ sơ dự toán được duyệt mẫu.",
};

const DOC_ADDENDUM_PL01: GeneratedContractDocData = {
  ...DEFAULT_GENERATED_CONTRACT,
  loaiMau: "addendum",
  soHD: "HD-DEMO-2026-01",
  soPhuLuc: "PL01/HD-DEMO-2026-01",
  giaTri: "420.000.000 VNĐ",
  giaTriGoc: "350.000.000 VNĐ",
  giaTriDieuChinh: "+70.000.000 VNĐ",
  lyDoDieuChinh: "Bổ sung 120 bộ bu-lông cường độ cao mẫu và gia hạn tiến độ thực hiện thêm 10 ngày.",
};

const DOC_BOARD_BRIEF: GeneratedContractDocData = {
  ...DEFAULT_GENERATED_CONTRACT,
  loaiMau: "report",
  soHD: "TONG-HOP-HD-2026",
  benA: "Tổng hợp 3 dự án mẫu (Tuyến mẫu 01, Tuyến mẫu 02, Xưởng kiểm thử mẫu)",
  benB: "5 hợp đồng mẫu · 4 đối tác minh họa",
  hangMuc: "Báo cáo giao ban tiến độ thi công (77%), giải ngân lũy kế (61%), bảo lãnh (141,5/210 triệu) và 6 cảnh báo hạn mức/công nợ.",
  giaTri: "1.555.000.000 VNĐ (đã giải ngân 950.000.000 VNĐ)",
  thoiHan: "Kỳ báo cáo tháng 11/2026",
  thanhToan: "Cảnh báo ưu tiên: 2 HĐ sắp hết hạn/bảo lãnh, 2 phụ lục phát sinh, 2 khoản công nợ tồn đọng.",
};

const SHORT_MODULE_TAG: Record<number, string> = {
  1: "Dashboard HĐ",
  2: "Contract Registry",
  3: "Smart OCR",
  4: "AI Hỏi đáp",
  5: "RBAC & 2FA",
  6: "Audit Log",
  7: "Vector DB RAG",
  8: "Bóc tách BOQ",
  9: "Rủi ro Pháp lý",
  10: "Đối chiếu BOQ",
  11: "Phụ lục & Biến động",
  12: "Tiến độ & Hạn mức",
  13: "Soạn Hợp đồng",
  14: "Cảnh báo Đa kênh",
  15: "Xuất Excel/PDF",
  16: "Web & Mobile PWA",
  17: "Song ngữ & API",
};

const COST_BREAKDOWN_BARS = [
  { label: "Vật tư chính", contractM: 215, estimateM: 205, note: "+10,0 tr" },
  { label: "Nhân công lắp đặt", contractM: 92, estimateM: 92, note: "Khớp" },
  { label: "Máy & vận chuyển", contractM: 68, estimateM: 64, note: "+4,0 tr" },
  { label: "Hiệu chuẩn & kiểm định", contractM: 45, estimateM: 40.5, note: "+4,5 tr" },
] as const;

const SHOWCASE_SCENARIOS: ShowcaseScenario[] = [
  {
    id: "qa-ocr-risk",
    shortLabel: "1. Hỏi đáp, OCR & Rủi ro",
    title: "Hỏi đáp Hợp đồng Tiếng Việt có Trích dẫn, OCR Scan & Rà soát Pháp lý",
    subtitle: "Minh họa truy vấn RAG có trích dẫn điều khoản/trang/tệp, bóc tách OCR, kiểm tra rủi ro pháp lý, RBAC 2FA, Audit Log & song ngữ VI-EN.",
    moduleIds: [2, 3, 4, 5, 6, 7, 9, 17],
    roleLabel: "RBAC: Pháp chế · 2FA bật · Song ngữ VI/EN",
    auditTag: "Audit #AU-2026-118 · RAG Vector DB",
    userPrompt:
      "Tóm tắt điều khoản thanh toán, bảo lãnh và quét rủi ro pháp lý của hợp đồng HD-DEMO-2026-01 kèm phụ lục PL01, gắn trích dẫn nguồn và xuất phiếu rà soát Word + PDF giúp tôi.",
    assistantLead:
      "Đã tổng hợp từ hồ sơ HD-DEMO-2026-01 (Contract Registry + OCR bản scan mẫu) và phụ lục PL01/HD-DEMO-2026-01 qua chỉ mục ngữ nghĩa RAG:",
    assistantPoints: [
      "Giá trị sau phụ lục PL01: 420.000.000 VNĐ (gốc 350.000.000 VNĐ + bổ sung 70.000.000 VNĐ).",
      "Thanh toán & bảo lãnh: Tạm ứng 30%, thanh toán 70% trong 15 ngày sau nghiệm thu; bảo lãnh thực hiện 10% giá trị hợp đồng.",
      "Cảnh báo rủi ro pháp lý (M9): Cần bổ sung điều khoản trần phạt vi phạm tối đa 8% và cập nhật thư bảo lãnh tương ứng phần tăng thêm +20% trước khi giải ngân đợt tiếp theo.",
    ],
    citations: [
      {
        id: "c1",
        badge: "Nguồn 1",
        source: "Điều 4 · Trang 3 · HD-DEMO-2026-01_Cung_cap_vat_tu_mau.docx",
        excerpt: "Tạm ứng 30% giá trị hợp đồng sau khi ký; thanh toán 70% còn lại trong vòng 15 ngày kể từ ngày ký biên bản nghiệm thu lô hàng mẫu. Bảo hành 12 tháng.",
      },
      {
        id: "c2",
        badge: "Nguồn 2",
        source: "Mục 2 · Trang 1 · PL-DEMO-2026-01_Phu_luc_bo_sung_mau.docx",
        excerpt: "Bổ sung 120 bộ bu-lông cường độ cao mẫu (+70.000.000 VNĐ), nâng tổng giá trị hợp đồng từ 350.000.000 VNĐ lên 420.000.000 VNĐ và gia hạn 10 ngày.",
      },
      {
        id: "c3",
        badge: "Nguồn 3 (OCR)",
        source: "Trang 4 (Scan PDF) · Bao_Lanh_Thuc_Hien_Mau.pdf",
        excerpt: "OCR nhận diện: Bảo lãnh thực hiện hợp đồng 10% giá trị gốc (35.000.000 VNĐ), hiệu lực đến 10/12/2026 — cần gia hạn kèm giá trị phụ lục.",
      },
    ],
    files: [
      {
        id: "f-legal-doc",
        kind: "word",
        fileName: "Bao-cao-HD-DEMO-2026-01.doc",
        meta: "Word (.doc) · Phiếu tóm tắt & rà soát pháp lý A4",
        docData: DOC_LEGAL_SUMMARY,
      },
      {
        id: "f-legal-pdf",
        kind: "pdf",
        fileName: "Phieu-Ra-Soat-Rui-Ro-HD-DEMO-2026-01.pdf",
        meta: "PDF (.pdf) · Bản in họp giao ban pháp chế",
        docData: DOC_LEGAL_SUMMARY,
      },
    ],
  },
  {
    id: "boq-cost",
    shortLabel: "2. BOQ & Bảng Chi Phí",
    title: "Bóc tách Dự toán BOQ, Đối chiếu Đơn giá/Khối lượng & Trả File Bảng Chi Phí",
    subtitle: "Minh họa đọc bảng khối lượng Excel/PDF, chuẩn hóa mã hiệu, phát hiện chênh lệch/bỏ sót và xuất bảng chi phí Excel + PDF.",
    moduleIds: [8, 10, 15],
    roleLabel: "RBAC: Kỹ sư QS · Dự án Tuyến mẫu số 01",
    auditTag: "Audit #AU-2026-119 · BOQ Reconciliation",
    userPrompt:
      "Đọc bảng khối lượng BOQ từ hồ sơ dự toán mẫu tuyến 01, đối chiếu với hợp đồng HD-DEMO-2026-01 để phát hiện sai lệch khối lượng/chi phí và trả file bảng chi phí Excel + báo cáo PDF.",
    assistantLead:
      "Đã bóc tách 5 mã hiệu định mức BOQ từ hồ sơ dự toán mẫu và đối chiếu chéo với bảng khối lượng hợp đồng HD-DEMO-2026-01:",
    assistantPoints: [
      "3/5 hạng mục khớp hoàn toàn (Bu-lông cường độ cao, Nhân công lắp đặt, Vận chuyển nội tuyến).",
      "Phát hiện 2 điểm chênh lệch cần thương thảo: BOQ-MAU-02 (Tấm đệm đàn hồi) hợp đồng ghi 320 tấm so với dự toán 300 tấm (+20 tấm); BOQ-MAU-04 (Hiệu chuẩn thiết bị) thiếu 1 lần so với dự toán.",
      "Tổng chênh lệch chi phí mô phỏng: +18.500.000 VNĐ (+4,6% so với dự toán được duyệt). Đã đính kèm file bảng đối chiếu chi phí và biểu đồ bên dưới:",
    ],
    citations: [
      {
        id: "b1",
        badge: "Nguồn 1",
        source: "Sheet BOQ_Tuyen01 · Dòng 14–22 · Du_Toan_Duoc_Duyet_Mau.xlsx",
        excerpt: "BOQ-MAU-02 Tấm đệm đàn hồi: khối lượng thiết kế duyệt 300 tấm; BOQ-MAU-04 Hiệu chuẩn thiết bị đo: 3 lần theo quy trình nghiệm thu.",
      },
      {
        id: "b2",
        badge: "Nguồn 2",
        source: "Phụ lục khối lượng · Trang 5 · HD-DEMO-2026-01_Mau.docx",
        excerpt: "Danh mục cung cấp đợt 1 ghi nhận 320 tấm đệm đàn hồi và 2 lần hiệu chuẩn — chênh +20 tấm và thiếu 1 lần so với hồ sơ dự toán duyệt.",
      },
    ],
    files: [
      {
        id: "f-boq-csv",
        kind: "excel",
        fileName: "Bang_Doi_Chieu_Chi_Phi_BOQ_Mau.csv",
        meta: "Excel / CSV · 5 mã hiệu BOQ & cột chênh lệch",
        csvType: "boq",
      },
      {
        id: "f-boq-pdf",
        kind: "pdf",
        fileName: "Bao-cao-BOQ-HD-DEMO-2026-01.pdf",
        meta: "PDF (.pdf) · Tóm tắt chênh lệch hợp đồng – dự toán",
        docData: DOC_BOQ_REPORT,
      },
    ],
  },
  {
    id: "draft-addendum",
    shortLabel: "3. Soạn Hợp đồng & Phụ lục",
    title: "Quản lý Biến động Phụ lục & Tự động Soạn Văn bản Hợp đồng (Word / PDF)",
    subtitle: "Minh họa tự động cập nhật tổng giá trị sau phụ lục, điền mẫu A4 chuẩn công ty không ghi đè tệp gốc và trả file Word (.doc) + PDF (.pdf).",
    moduleIds: [11, 13, 15],
    roleLabel: "RBAC: Đấu thầu / QS · Lưu bản mới (Save As)",
    auditTag: "Audit #AU-2026-120 · Contract Generator",
    userPrompt:
      "Từ dữ liệu HD-DEMO-2026-01 (350.000.000 VNĐ), lập phụ lục điều chỉnh PL01 bổ sung +70.000.000 VNĐ nâng tổng lên 420.000.000 VNĐ, bảo toàn tệp gốc và trả file Word + PDF.",
    assistantLead:
      "Đã tự động điền thông tin hai bên, bảng tính biến động giá trị và điều khoản hiệu lực vào mẫu Phụ lục chuẩn A4 (tệp hợp đồng gốc được giữ nguyên):",
    assistantPoints: [
      "Giá trị hợp đồng gốc: 350.000.000 VNĐ → Điều chỉnh PL01: +70.000.000 VNĐ (+20%) → Tổng giá trị mới: 420.000.000 VNĐ.",
      "Tự động ghi nhận lịch sử biến động (Module 11) và cập nhật thời hạn gia hạn thêm 10 ngày.",
      "Bản nháp đã sẵn sàng xem trước A4 và tải xuống định dạng Word (.doc) & PDF (.pdf) ngay dưới đây (không chèn ảnh chữ ký, chờ người có thẩm quyền rà soát và ký).",
    ],
    citations: [
      {
        id: "d1",
        badge: "Nguồn 1",
        source: "Điều 2 · Trang 2 · HD-DEMO-2026-01_Cung_cap_vat_tu_mau.docx",
        excerpt: "Giá trị hợp đồng gốc 350.000.000 VNĐ — các bên thống nhất lập phụ lục khi phát sinh khối lượng vật tư vượt phạm vi ban đầu.",
      },
      {
        id: "d2",
        badge: "Nguồn 2",
        source: "Biên bản thương thảo mẫu · Trang 1",
        excerpt: "Thống nhất bổ sung 120 bộ bu-lông cường độ cao (+70.000.000 VNĐ) và gia hạn thời gian giao hàng thêm 10 ngày.",
      },
    ],
    files: [
      {
        id: "f-add-doc",
        kind: "word",
        fileName: "Phu-luc-PL01-HD-DEMO-2026-01.doc",
        meta: "Word (.doc) · Phụ lục điều chỉnh khổ A4 chuẩn",
        docData: DOC_ADDENDUM_PL01,
      },
      {
        id: "f-add-pdf",
        kind: "pdf",
        fileName: "Phu-luc-PL01-HD-DEMO-2026-01.pdf",
        meta: "PDF (.pdf) · Bản trình duyệt & in ấn A4",
        docData: DOC_ADDENDUM_PL01,
      },
    ],
  },
  {
    id: "dashboard-alerts",
    shortLabel: "4. Dashboard, Tiến độ & Cảnh báo",
    title: "Tổng quan Dự án, Hạn mức Thanh toán, Cảnh báo Đa kênh & Giao diện Đa nền tảng",
    subtitle: "Minh họa trợ lý tổng hợp nhanh KPI theo dự án/đối tác, tiến độ giải ngân lũy kế so với trần, cảnh báo Email/App và tối ưu tra cứu Mobile PWA.",
    moduleIds: [1, 12, 14, 16],
    roleLabel: "RBAC: Ban Giám đốc · Web & Mobile PWA",
    auditTag: "Audit #AU-2026-121 · Executive Digest",
    userPrompt:
      "Tổng hợp toàn bộ hợp đồng theo dự án, tiến độ giải ngân lũy kế so với trần và liệt kê cảnh báo sắp hết hạn/công nợ để tôi xem nhanh trên di động và xuất file họp giao ban.",
    assistantLead:
      "Báo cáo tổng quan nhanh 5 hợp đồng mẫu thuộc 3 dự án (cập nhật đồng bộ trên Web & Mobile/Tablet PWA):",
    assistantPoints: [
      "Tổng giá trị danh mục: 1.555.000.000 VNĐ · Khối lượng thực hiện trung bình: 77% · Giải ngân lũy kế: 950.000.000 VNĐ (61% trần hợp đồng).",
      "Hạn mức bảo lãnh đang dùng: 141.500.000 / 210.000.000 VNĐ (67%) — an toàn dưới trần khối lượng.",
      "Cảnh báo đa kênh (App + Email mô phỏng): 1 HĐ còn 7 ngày hết hiệu lực (HD-DEMO-2026-02), 1 bảo lãnh còn 12 ngày, 2 phụ lục chờ duyệt và 140 triệu công nợ đối soát.",
    ],
    citations: [
      {
        id: "s1",
        badge: "Nguồn 1",
        source: "Contract Registry (Module 1 & 2) · 5 hợp đồng mẫu",
        excerpt: "Tuyến mẫu số 02: 760 triệu (2 HĐ, thanh toán 63%); Tuyến mẫu số 01: 535 triệu (2 HĐ, thanh toán 70%); Xưởng kiểm thử mẫu: 260 triệu (1 HĐ, 37%).",
      },
      {
        id: "s2",
        badge: "Nguồn 2",
        source: "Theo dõi mốc & cảnh báo (Module 12 & 14)",
        excerpt: "Mốc thi công 76% → Tạm ứng 100% → Hoàn thành 68% → Quyết toán 42%. Cảnh báo khẩn: HD-DEMO-2026-02 (hạn 05/12/2026) và công nợ đợt 2 HD-DEMO-2026-03.",
      },
    ],
    files: [
      {
        id: "f-dash-csv",
        kind: "excel",
        fileName: "Tong_Quan_Danh_Muc_Hop_Dong_Mau.csv",
        meta: "Excel / CSV · Dữ liệu hợp đồng & đối tác tổng hợp",
        csvType: "portfolio",
      },
      {
        id: "f-dash-pdf",
        kind: "pdf",
        fileName: "Ho-So-Hop-Giao-Ban-Hop-Dong.pdf",
        meta: "PDF (.pdf) · Báo cáo điều hành Ban Giám đốc",
        docData: DOC_BOARD_BRIEF,
      },
    ],
  },
];

export default function ChatbotShowcasePanel({
  onPreview,
  onDownloadWord,
  onDownloadPdf,
  pdfBusy,
  onAudit,
  onJumpSection,
}: {
  onPreview: (d: GeneratedContractDocData) => void;
  onDownloadWord: (d: GeneratedContractDocData) => string;
  onDownloadPdf: (d: GeneratedContractDocData) => Promise<void>;
  pdfBusy: boolean;
  onAudit: (action: string) => void;
  onJumpSection: (section: Exclude<AiReportSectionId, "all" | "modules" | "overview" | "showcase">) => void;
}) {
  const [activeId, setActiveId] = useState<ShowcaseScenarioId>("qa-ocr-risk");
  const [selectedCitationId, setSelectedCitationId] = useState<string>("c1");
  const [downloadNote, setDownloadNote] = useState("");
  const [chatMinimized, setChatMinimized] = useState(false);

  const scenario = SHOWCASE_SCENARIOS.find((s) => s.id === activeId) ?? SHOWCASE_SCENARIOS[0];
  const activeCitation =
    scenario.citations.find((c) => c.id === selectedCitationId) ?? scenario.citations[0];

  function selectScenario(id: ShowcaseScenarioId) {
    setActiveId(id);
    const next = SHOWCASE_SCENARIOS.find((s) => s.id === id);
    if (next?.citations[0]) setSelectedCitationId(next.citations[0].id);
    setDownloadNote("");
  }

  function triggerCsvDownload(file: ReturnedFileCard) {
    const csv =
      file.csvType === "boq"
        ? exportBoqReconciliationCsv()
        : exportExtractionsToCsv(INITIAL_WORD_EXTRACTIONS);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloadNote(`Đã tải bảng dữ liệu "${file.fileName}" (mở bằng Excel).`);
    onAudit(`Tải bảng chi phí/dữ liệu mẫu từ Chatbot Demo: ${file.fileName}`);
  }

  function handleFileDownload(file: ReturnedFileCard) {
    if (file.kind === "excel") {
      triggerCsvDownload(file);
      return;
    }
    if (file.kind === "word" && file.docData) {
      const name = onDownloadWord(file.docData);
      setDownloadNote(`Đã tải tệp Word "${name}" (bản mới, không ghi đè tệp gốc).`);
      return;
    }
    if (file.kind === "pdf" && file.docData) {
      setDownloadNote("Đang xuất PDF khổ A4…");
      void onDownloadPdf(file.docData).then(() => {
        setDownloadNote(`Đã tải tệp PDF "${file.fileName}".`);
      });
    }
  }

  return (
    <section
      id="bao-cao-ai-showcase"
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:p-4"
      aria-label="Màn hình minh họa Chatbot AI Hợp đồng theo đủ 17 hạng mục"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0047AB] px-2.5 py-0.5 text-[11px] font-bold text-white">
              <Sparkle size={12} weight="fill" aria-hidden />
              Trình diễn Chatbot AI Hợp đồng · Đủ 17 hạng mục F-Solution
            </span>
            <CapBadge capability="sim" compact />
          </div>
          <h2 className="mt-1 text-sm font-bold text-slate-900 sm:text-base">
            {scenario.title}
          </h2>
          <p className="text-[11.5px] text-slate-600">{scenario.subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Chọn màn hình demo Chatbot AI">
          {SHOWCASE_SCENARIOS.map((sc) => {
            const active = sc.id === scenario.id;
            return (
              <button
                key={sc.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectScenario(sc.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? "bg-[#0047AB] text-white shadow-2xs"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {sc.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Workspace with Floating Bottom-Left Chatbot Window */}
      <div className="relative rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-3.5 shadow-inner">
        {/* Top Full-Width Contract & Cost Context Strip (always unobstructed) */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Hồ sơ đang mở (mẫu)</p>
            <p className="mt-0.5 truncate text-xs font-bold text-slate-900">HD-DEMO-2026-01 + PL01</p>
            <p className="truncate text-[10px] text-slate-500">Vật Tư Mẫu Alpha ↔ Thiết Bị Beta</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2 shadow-2xs">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0047AB]">Giá trị hợp đồng sau PL01</p>
            <p className="mt-0.5 text-xs font-bold text-[#0047AB]">420.000.000 VNĐ</p>
            <p className="text-[10px] text-slate-600">Gốc 350 tr + Phụ lục +70 tr</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 shadow-2xs">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Điều khoản thanh toán</p>
            <p className="mt-0.5 text-xs font-bold text-emerald-900">Tạm ứng 30% · NT 70%</p>
            <p className="text-[10px] text-emerald-800">Thanh toán trong 15 ngày · BH 12 tháng</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 shadow-2xs">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">Bảo lãnh &amp; Rà soát pháp lý</p>
            <p className="mt-0.5 text-xs font-bold text-amber-950">Bảo lãnh 10% · Phạt ≤ 8%</p>
            <p className="text-[10px] text-amber-900">Hạn 10/12/2026 · 2 điểm cần bổ sung</p>
          </div>
        </div>

        {/* Workspace Canvas: Right Full-Height Contract/Cost Visuals + Floating Chatbot anchored at Bottom-Left */}
        <div className="relative mt-3 flex flex-col gap-3.5 lg:min-h-[760px] lg:block">
          {/* Right: Synchronized Contract / Cost / OCR / Dashboard Visual Panel (completely unobstructed) */}
          <div className="order-1 flex flex-col justify-between space-y-2.5 lg:min-h-[760px] lg:pl-[506px]">
            {/* Active Citation Callout */}
            <div className="rounded-xl border border-blue-200 bg-white p-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0047AB]">
                  <FileText size={14} weight="bold" aria-hidden />
                  Đối chiếu trích dẫn đang chọn · {activeCitation.badge}
                </span>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#0047AB]">
                  {activeCitation.source}
                </span>
              </div>
              <p
                className="mt-1.5 rounded-lg border-l-4 border-[#0047AB] bg-blue-50/50 px-3 py-2 text-xs leading-relaxed text-slate-800"
                style={{ fontFamily: "'Times New Roman', Times, serif" }}
              >
                “{activeCitation.excerpt}”
              </p>
            </div>

            {/* Visual Body per Scenario */}
            {scenario.id === "qa-ocr-risk" ? (
              <div className="space-y-2.5">
                {/* Contract OCR + Legal Risk */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">
                      Minh họa Hợp đồng Smart OCR &amp; Rà soát Pháp lý (Module 3 &amp; 9)
                    </span>
                    <CapBadge capability="sim" compact />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div
                      className="rounded-lg border border-amber-200 bg-amber-50/40 p-2.5 text-[11px] leading-relaxed text-slate-900"
                      style={{ fontFamily: "'Times New Roman', Times, serif" }}
                    >
                      <p className="font-sans text-[10px] font-bold uppercase text-amber-900">
                        Trường OCR bóc tách từ bản scan
                      </p>
                      <p className="mt-1">
                        <span className="rounded bg-blue-100 px-1 font-sans text-[9.5px] font-bold text-[#0047AB]">Các bên</span>{" "}
                        Cty Vật Tư Mẫu Alpha &amp; Cty Thiết Bị Beta
                      </p>
                      <p className="mt-1">
                        <span className="rounded bg-emerald-100 px-1 font-sans text-[9.5px] font-bold text-emerald-800">Giá trị</span>{" "}
                        350.000.000 VNĐ → 420.000.000 VNĐ (PL01)
                      </p>
                      <p className="mt-1">
                        <span className="rounded bg-violet-100 px-1 font-sans text-[9.5px] font-bold text-violet-800">Bảo lãnh</span>{" "}
                        10% · Hạn 10/12/2026
                      </p>
                      <p className="mt-1">
                        <span className="rounded bg-rose-100 px-1 font-sans text-[9.5px] font-bold text-rose-800">Phạt vi phạm</span>{" "}
                        Đề xuất giới hạn ≤ 8% luật định
                      </p>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-2">
                        <p className="flex items-center gap-1 font-bold text-rose-800">
                          <WarningCircle size={13} weight="fill" aria-hidden />
                          Rủi ro cao · Giới hạn phạt
                        </p>
                        <p className="mt-0.5 text-slate-700">Chưa chốt trần phạt tối đa 8–12% theo luật xây dựng.</p>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2">
                        <p className="flex items-center gap-1 font-bold text-amber-900">
                          <WarningCircle size={13} weight="fill" aria-hidden />
                          Lưu ý · Bảo lãnh phụ lục
                        </p>
                        <p className="mt-0.5 text-slate-700">Bổ sung thư bảo lãnh cho phần tăng +70.000.000 VNĐ.</p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2">
                        <p className="flex items-center gap-1 font-bold text-emerald-800">
                          <ShieldCheck size={13} weight="fill" aria-hidden />
                          Kiến trúc &amp; Bảo mật (M5, M6, M7, M17)
                        </p>
                        <p className="mt-0.5 text-slate-700">PostgreSQL + pgvector RAG · RBAC 2FA · Audit Log · Song ngữ VI-EN.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cost & Payment Breakdown Illustration right under OCR card */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <ChartBar size={14} weight="bold" className="text-[#0047AB]" aria-hidden />
                      Minh họa Cơ cấu Chi phí &amp; Thanh toán mẫu (420.000.000 VNĐ)
                    </span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#0047AB]">
                      Hợp đồng vs Dự toán
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {COST_BREAKDOWN_BARS.map((bar) => (
                      <div key={bar.label} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-[10.5px]">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-800">{bar.label}</span>
                          <span className="font-mono font-bold text-[#0047AB]">{bar.contractM} tr</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-[#0047AB]"
                            style={{ width: `${Math.min(100, (bar.contractM / 220) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          Dự toán: {bar.estimateM} tr · <span className="font-semibold text-emerald-700">{bar.note}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {scenario.id === "boq-cost" ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <ChartBar size={14} weight="bold" className="text-[#0047AB]" aria-hidden />
                      Bảng Đối chiếu BOQ Hợp đồng vs Dự toán (Module 8 &amp; 10)
                    </span>
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                      Chênh lệch mẫu: +18.500.000 VNĐ
                    </span>
                  </div>
                  <div className="mt-2.5 overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[440px] border-collapse text-left text-[11px]">
                      <thead className="bg-slate-100 text-[10px] text-slate-600">
                        <tr>
                          <th className="border-b px-2 py-1.5">Mã hiệu</th>
                          <th className="border-b px-2 py-1.5">Hạng mục (mẫu)</th>
                          <th className="border-b px-2 py-1.5 text-right">HĐ</th>
                          <th className="border-b px-2 py-1.5 text-right">Dự toán</th>
                          <th className="border-b px-2 py-1.5 text-center">Đối chiếu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SYNTHETIC_BOQ.map((row) => {
                          const ok = row.diff === "Khớp";
                          return (
                            <tr key={row.code} className="border-b border-slate-100 last:border-0">
                              <td className="px-2 py-1.5 font-mono font-bold text-[#0047AB]">{row.code}</td>
                              <td className="px-2 py-1.5 text-slate-800">{row.item}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{row.contractQty}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{row.boqQty}</td>
                              <td className="px-2 py-1.5 text-center">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {row.diff}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {scenario.id === "draft-addendum" ? (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-[11px]">
                  <span className="font-bold text-slate-800">Chuỗi biến động (Module 11):</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">Gốc: 350.000.000 VNĐ</span>
                  <span className="text-slate-400">→</span>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">PL01: +70.000.000 VNĐ</span>
                  <span className="text-slate-400">→</span>
                  <span className="rounded bg-[#0047AB] px-2 py-0.5 font-bold text-white">Tổng: 420.000.000 VNĐ</span>
                </div>
                <div className="max-h-[380px] overflow-y-auto rounded-xl border border-slate-300 bg-white p-4 shadow-2xs">
                  <div dangerouslySetInnerHTML={{ __html: renderTemplateBodyHtml(DOC_ADDENDUM_PL01) }} />
                </div>
              </div>
            ) : null}

            {scenario.id === "dashboard-alerts" ? (
              <div className="space-y-2.5">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">
                      Minh họa Tiến độ, Thanh toán &amp; Cảnh báo Đa kênh (Module 1, 12, 14, 16)
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Web + Mobile PWA
                    </span>
                  </div>
                  <div className="mt-2.5 space-y-2">
                    {SYNTHETIC_PORTFOLIO.slice(0, 3).map((row) => {
                      const paidPct = Math.round((row.daThanhToanVnd / row.giaTriVnd) * 100);
                      return (
                        <div key={row.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">
                              {row.soHD} · <span className="font-normal text-slate-600">{row.duAn}</span>
                            </span>
                            <span className="font-mono font-bold text-[#0047AB]">{formatVndCompact(row.giaTriVnd)}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${paidPct}%` }} />
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-700">
                              Giải ngân {paidPct}% · KL {row.khoiLuongPct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                    {SYNTHETIC_ALERTS.slice(0, 2).map((al) => (
                      <div key={al.id} className="rounded-lg border border-rose-200 bg-rose-50/60 p-2 text-[10.5px]">
                        <p className="font-bold text-rose-900">{al.contractCode} · {al.title}</p>
                        <p className="text-slate-600">{al.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Bottom quick jump bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px]">
              <span className="text-slate-600">
                <b>Đủ 17/17 hạng mục F-Solution</b> được phủ qua 4 màn hình Chatbot &amp; Bản đồ 17 module.
              </span>
              <button
                type="button"
                onClick={() =>
                  onJumpSection(
                    scenario.id === "draft-addendum"
                      ? "generate"
                      : scenario.id === "dashboard-alerts"
                        ? "stats"
                        : "extraction"
                  )
                }
                className="inline-flex items-center gap-1 font-bold text-[#0047AB] hover:underline cursor-pointer"
              >
                Thao tác trực tiếp
                <ArrowRight size={13} aria-hidden />
              </button>
            </div>
          </div>

          {/* FLOATING BOTTOM-LEFT CHATBOT WINDOW */}
          <div className="order-2 lg:absolute lg:bottom-0 lg:left-0 lg:z-20 lg:w-[488px]">
            {chatMinimized ? (
              <button
                type="button"
                onClick={() => setChatMinimized(false)}
                className="inline-flex items-center gap-2.5 rounded-full border-2 border-white bg-[#0047AB] px-4 py-2.5 text-xs font-bold text-white shadow-[0_14px_32px_-8px_rgba(0,71,171,0.55)] hover:bg-[#00388A] cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="" className="h-6 w-6 rounded-full bg-white object-contain p-0.5" />
                <span>Mở cửa sổ nổi Trợ lý AI Thành Phát</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </button>
            ) : (
              <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-[#0047AB]/35 bg-white shadow-[0_22px_50px_-14px_rgba(15,23,42,0.34)] ring-4 ring-[#0047AB]/10">
                {/* Floating Window Header */}
                <div className="flex items-center justify-between gap-2 bg-[#0047AB] px-3 py-2 text-white">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white p-0.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo.png" alt="" className="h-full w-full object-contain" />
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0047AB] bg-emerald-400" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-bold">Trợ lý AI Hợp đồng Thành Phát</p>
                        <span className="shrink-0 rounded-full border border-emerald-300/60 bg-emerald-400/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-100">
                          Cửa sổ nổi
                        </span>
                      </div>
                      <p className="truncate text-[9.5px] text-blue-100">{scenario.roleLabel} · {scenario.auditTag}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setChatMinimized(true)}
                      aria-label="Thu gọn cửa sổ Chatbot"
                      title="Thu gọn"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                    >
                      <Minus size={12} weight="bold" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatMinimized(true)}
                      aria-label="Đóng cửa sổ nổi Chatbot"
                      title="Đóng"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                    >
                      <X size={12} weight="bold" aria-hidden />
                    </button>
                  </div>
                </div>

                {/* Covered Module Chips */}
                <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-blue-50/70 px-2.5 py-1 text-[9.5px]">
                  <span className="font-bold text-[#0047AB]">Hạng mục:</span>
                  {scenario.moduleIds.map((mId) => {
                    const mod = AI_CONTRACT_MODULES.find((m) => m.id === mId);
                    return (
                      <span
                        key={mId}
                        title={mod?.title}
                        className="rounded border border-blue-200 bg-white px-1.5 py-0.5 font-semibold text-slate-700"
                      >
                        #{mId} {SHORT_MODULE_TAG[mId]}
                      </span>
                    );
                  })}
                </div>

                {/* Conversation Thread */}
                <div className="space-y-2 bg-[#f4f6fa] p-2.5">
                  {/* User Prompt Bubble */}
                  <div className="flex justify-end">
                    <div className="max-w-[94%] rounded-2xl rounded-tr-sm bg-[#0047AB] px-3 py-1.5 text-[11px] leading-snug text-white shadow-xs">
                      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-200">
                        Người dùng hỏi · Tiếng Việt
                      </p>
                      <p>{scenario.userPrompt}</p>
                    </div>
                  </div>

                  {/* Assistant Structured Reply */}
                  <div className="flex justify-start">
                    <div className="w-full space-y-1.5 rounded-2xl rounded-tl-sm border border-slate-200 bg-white p-2.5 text-[11px] leading-snug text-slate-800 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="inline-flex items-center gap-1 font-bold text-[#0047AB]">
                          <Sparkle size={12} weight="fill" aria-hidden />
                          Trợ lý AI trả lời kèm nguồn trích dẫn
                        </span>
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-800">
                          Tin cậy: 98% (mẫu)
                        </span>
                      </div>

                      <p className="font-medium text-slate-900">{scenario.assistantLead}</p>

                      <ul className="space-y-1 text-[10.5px] text-slate-700">
                        {scenario.assistantPoints.map((pt, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <CheckCircle size={12} weight="fill" className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Clickable Citations Row */}
                      <div className="space-y-1 rounded-lg border border-blue-100 bg-blue-50/50 p-1.5">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-[#0047AB]">
                          Trích dẫn nguồn gốc (bấm để đối chiếu bên phải)
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {scenario.citations.map((cit) => {
                            const active = cit.id === activeCitation.id;
                            return (
                              <button
                                key={cit.id}
                                type="button"
                                onClick={() => setSelectedCitationId(cit.id)}
                                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9.5px] font-semibold transition-all cursor-pointer ${
                                  active
                                    ? "border-[#0047AB] bg-[#0047AB] text-white"
                                    : "border-blue-200 bg-white text-slate-700 hover:border-[#0047AB]"
                                }`}
                              >
                                <FileText size={10} aria-hidden />
                                <span>{cit.badge}:</span>
                                <span className="max-w-[165px] truncate font-normal">{cit.source}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Embedded Visual Card inside Chat */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-2">
                        <div className="mb-1 flex items-center justify-between text-[10px]">
                          <span className="font-bold text-slate-800">
                            {scenario.id === "boq-cost"
                              ? "Ảnh minh họa biểu đồ chi phí (Hợp đồng vs Dự toán)"
                              : scenario.id === "dashboard-alerts"
                                ? "Ảnh minh họa chi phí & tiến độ giải ngân dự án"
                                : "Ảnh minh họa văn bản hợp đồng / phụ lục trích xuất"}
                          </span>
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900">
                            Dữ liệu mẫu
                          </span>
                        </div>

                        {scenario.id === "boq-cost" ? (
                          <div className="space-y-1 rounded border border-slate-200 bg-white p-2">
                            {COST_BREAKDOWN_BARS.map((bar) => (
                              <div key={bar.label} className="space-y-0.5 text-[9.5px]">
                                <div className="flex justify-between">
                                  <span className="font-semibold text-slate-700">{bar.label}</span>
                                  <span className="font-mono font-bold text-[#0047AB]">
                                    HĐ {bar.contractM} tr · DT {bar.estimateM} tr ({bar.note})
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-[#0047AB]" style={{ width: `${Math.min(100, (bar.contractM / 220) * 100)}%` }} />
                                  </div>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100">
                                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, (bar.estimateM / 220) * 100)}%` }} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : scenario.id === "dashboard-alerts" ? (
                          <div className="grid grid-cols-3 gap-1.5 rounded border border-slate-200 bg-white p-1.5 text-center text-[9.5px]">
                            <div className="rounded bg-blue-50 p-1">
                              <p className="text-slate-500">Tổng giá trị</p>
                              <p className="font-bold text-[#0047AB]">1,555 tỷ</p>
                            </div>
                            <div className="rounded bg-emerald-50 p-1">
                              <p className="text-slate-500">Giải ngân</p>
                              <p className="font-bold text-emerald-700">61% (950 tr)</p>
                            </div>
                            <div className="rounded bg-rose-50 p-1">
                              <p className="text-slate-500">Cảnh báo</p>
                              <p className="font-bold text-rose-700">6 mục ưu tiên</p>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[10.5px] leading-snug text-slate-900"
                            style={{ fontFamily: "'Times New Roman', Times, serif" }}
                          >
                            <p className="text-center text-[9.5px] font-bold">
                              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM — Độc lập - Tự do - Hạnh phúc
                            </p>
                            <p className="mt-0.5 text-center font-bold text-[#0047AB]">
                              {scenario.id === "draft-addendum"
                                ? "PHỤ LỤC ĐIỀU CHỈNH GIÁ TRỊ · PL01/HD-DEMO-2026-01"
                                : "HỢP ĐỒNG CUNG CẤP VẬT TƯ · HD-DEMO-2026-01 (BẢN MẪU)"}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1 font-sans text-[9px]">
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-[#0047AB]">
                                Bên A: Cty TNHH Vật Tư Mẫu Alpha
                              </span>
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">
                                Giá trị mới: 420.000.000 VNĐ
                              </span>
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
                                Thanh toán: 30% / 70%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Returned Downloadable File Cards */}
                      <div className="space-y-1">
                        <p className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500">
                          Tệp kết quả Chatbot trả về trực tiếp
                        </p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {scenario.files.map((file) => {
                            const badgeCls =
                              file.kind === "word"
                                ? "bg-[#185ABD]"
                                : file.kind === "pdf"
                                  ? "bg-rose-600"
                                  : "bg-emerald-700";
                            return (
                              <div
                                key={file.id}
                                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"
                              >
                                <span
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-black text-white ${badgeCls}`}
                                >
                                  {file.kind === "word" ? (
                                    "W"
                                  ) : file.kind === "pdf" ? (
                                    <FilePdf size={14} weight="bold" aria-hidden />
                                  ) : (
                                    "XL"
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[10px] font-bold text-slate-900">{file.fileName}</p>
                                  <p className="truncate text-[9px] text-slate-500">{file.meta}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  {file.docData ? (
                                    <button
                                      type="button"
                                      onClick={() => onPreview(file.docData!)}
                                      title="Xem bản A4"
                                      className="inline-flex h-6 items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 text-[9.5px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <Eye size={11} aria-hidden />
                                      Xem
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    disabled={file.kind === "pdf" && pdfBusy}
                                    onClick={() => handleFileDownload(file)}
                                    className={`inline-flex h-6 items-center gap-0.5 rounded px-1.5 text-[9.5px] font-semibold text-white cursor-pointer disabled:opacity-50 ${badgeCls}`}
                                  >
                                    <DownloadSimple size={11} weight="bold" aria-hidden />
                                    Tải
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {downloadNote ? (
                          <p className="text-[10px] font-semibold text-emerald-700">{downloadNote}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat Input Bar */}
                <div className="flex items-center gap-1.5 border-t border-slate-200 bg-white px-2.5 py-2 text-[10.5px] text-slate-400">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500">
                    <Paperclip size={13} aria-hidden />
                  </span>
                  <span className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                    Hỏi điều khoản hợp đồng, chi phí BOQ hoặc soạn phụ lục Word/PDF…
                  </span>
                  <span className="rounded-lg bg-[#0047AB] px-2.5 py-1 font-semibold text-white">Gửi</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compact 17-Module Coverage Strip */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-600">
          Ma trận bao phủ đủ 17 hạng mục theo Hợp đồng F-Solution (tô xanh: đang thể hiện trên màn hình hiện tại)
        </p>
        <div className="flex flex-wrap gap-1">
          {AI_CONTRACT_MODULES.map((m) => {
            const active = scenario.moduleIds.includes(m.id);
            return (
              <span
                key={m.id}
                title={m.title}
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                  active
                    ? "border-[#0047AB] bg-[#0047AB] text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {m.id}. {m.title.split("(")[0].trim()}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
