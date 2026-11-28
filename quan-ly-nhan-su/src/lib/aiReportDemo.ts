/**
 * Dữ liệu kịch bản mô phỏng hình ảnh Chatbot điều khiển máy tính & Quản lý trích xuất file Word hợp đồng.
 * 100% dữ liệu mẫu tổng hợp; không gọi AI ngoài, không ghi database.
 */

export type DemoScenarioId = "explorer" | "word" | "sheets";

export type DemoFileAttachment = {
  kind: "word" | "pdf";
  title: string;
  fileName: string;
  meta: string;
  docData: GeneratedContractDocData;
};

export type GeneratedContractDocData = {
  soHD: string;
  ngayKy: string;
  diaDiemKy: string;
  benA: string;
  daiDienA: string;
  benB: string;
  daiDienB: string;
  hangMuc: string;
  giaTri: string;
  thoiHan: string;
  thanhToan: string;
  /** Mở rộng tuỳ chọn cho mẫu phụ lục / báo cáo. */
  loaiMau?: "contract" | "addendum" | "report";
  soPhuLuc?: string;
  giaTriGoc?: string;
  giaTriDieuChinh?: string;
  lyDoDieuChinh?: string;
};

export type DemoChatBubble = {
  role: "user" | "model";
  text: string;
  fileChip?: { title: string; fileName: string; meta: string };
  attachments?: DemoFileAttachment[];
  stepVisibleFrom: number;
};

export type DemoStep = {
  index: number;
  shortTitle: string;
  actionLog: string;
  cursorLabel: string;
  /** Tọa độ con trỏ AI (%) trên màn hình máy tính mô phỏng. */
  cursorX: number;
  cursorY: number;
  clicking?: boolean;
};

export type DemoScenario = {
  id: DemoScenarioId;
  badge: string;
  title: string;
  subtitle: string;
  appWindowTitle: string;
  appKind: "explorer" | "word" | "sheets";
  summaryPoints: string[];
  steps: DemoStep[];
  chat: DemoChatBubble[];
};

export const COMPUTER_USE_SCENARIOS: DemoScenario[] = [
  {
    id: "explorer",
    badge: "Kịch bản 1 · Đọc tệp được cấp quyền",
    title: "Đọc hợp đồng mẫu & trích xuất điều khoản có nguồn",
    subtitle: "Minh họa chọn tệp mẫu được cấp quyền, đánh dấu trường dữ liệu và trích dẫn đoạn nguồn trong tài liệu.",
    appWindowTitle: "File Explorer — D:\\HoSo_HopDong_Mau (đường dẫn minh họa)",
    appKind: "explorer",
    summaryPoints: [
      "Chỉ xử lý tệp mẫu được người dùng cấp quyền; không tự quét ổ đĩa ngoài phạm vi cho phép",
      "Trích xuất Số hợp đồng, hai bên, giá trị, thời hạn và gắn trích dẫn đoạn nguồn",
      "Trả kết quả có cấu trúc cùng thẻ tệp ngay trong khung Trợ lý AI Thành Phát",
    ],
    steps: [
      {
        index: 0,
        shortTitle: "Nhận yêu cầu",
        actionLog: "Nhận yêu cầu đọc hợp đồng mẫu đã chọn và tóm tắt thông tin chính",
        cursorLabel: "AI nhận yêu cầu",
        cursorX: 74,
        cursorY: 66,
      },
      {
        index: 1,
        shortTitle: "Chọn tệp mẫu được cấp quyền",
        actionLog: "Chọn HD-DEMO-2026-01_Mau.docx trong danh sách tệp mẫu được cấp quyền",
        cursorLabel: "AI chọn tệp mẫu",
        cursorX: 35,
        cursorY: 42,
        clicking: true,
      },
      {
        index: 2,
        shortTitle: "Đọc và đánh dấu trường",
        actionLog: "Đọc nội dung và đánh dấu các trường số hợp đồng, hai bên, giá trị, thời hạn kèm đoạn nguồn",
        cursorLabel: "AI đánh dấu trường",
        cursorX: 46,
        cursorY: 64,
        clicking: true,
      },
      {
        index: 3,
        shortTitle: "Trả kết quả, trích dẫn và thẻ tệp",
        actionLog: "Hiển thị tóm tắt trích xuất, trích dẫn đoạn nguồn và thẻ tệp trong khung trợ lý",
        cursorLabel: "AI trả kết quả",
        cursorX: 76,
        cursorY: 50,
      },
    ],
    chat: [
      {
        role: "user",
        text: "Đọc hợp đồng mẫu tôi đã chọn và tóm tắt các thông tin chính.",
        stepVisibleFrom: 0,
      },
      {
        role: "model",
        text: "Tôi đang đọc tệp đã chọn.",
        stepVisibleFrom: 1,
      },
      {
        role: "model",
        text: "Đã trích xuất số hợp đồng, hai bên, giá trị và thời hạn. Chọn một trường để xem đoạn nguồn.\n• Số HĐ: HD-DEMO-2026-01 (Trang 1 · Đầu trang)\n• Bên A: Công ty TNHH Vật Tư Mẫu Alpha\n• Bên B: Công ty CP Thiết Bị Minh Họa Beta\n• Giá trị: 350.000.000 VNĐ (Điều 2)\n• Thời hạn: 30 ngày kể từ ngày ký (Điều 3)",
        fileChip: {
          title: "HD-DEMO-2026-01_Mau.docx",
          fileName: "HD-DEMO-2026-01_Mau.docx",
          meta: "Mô phỏng · đã đọc 42 KB",
        },
        stepVisibleFrom: 3,
      },
    ],
  },
  {
    id: "word",
    badge: "Kịch bản 2 · Soạn thảo & Save As",
    title: "Điền mẫu, cập nhật giá trị & tạo bản hợp đồng mới",
    subtitle: "Minh họa ánh xạ trường đã đọc vào mẫu Word A4, cập nhật giá trị mới và tải xuống tệp riêng bảo toàn bản gốc.",
    appWindowTitle: "Bản xem trước mẫu A4 — HD-DEMO-2026-01-MOI.doc",
    appKind: "word",
    summaryPoints: [
      "Ánh xạ tự động dữ liệu đã đọc vào mẫu văn bản hợp đồng chuẩn khổ A4",
      "Cập nhật giá trị mới, cho phép xem trước bản nháp ngay trước khi xuất tệp",
      "Lưu sang tên tệp riêng (Save As .doc / .pdf) để bảo toàn nguyên vẹn tệp gốc",
    ],
    steps: [
      {
        index: 0,
        shortTitle: "Nhận lệnh",
        actionLog: "Nhận yêu cầu dùng dữ liệu đã đọc để điền mẫu, cập nhật giá trị và tạo bản mới",
        cursorLabel: "AI nhận lệnh",
        cursorX: 74,
        cursorY: 66,
      },
      {
        index: 1,
        shortTitle: "Nạp mẫu và ánh xạ trường",
        actionLog: "Nạp biểu mẫu chuẩn và ánh xạ Số HĐ HD-DEMO-2026-01-MOI, Bên A, Bên B, Hạng mục",
        cursorLabel: "AI ánh xạ trường",
        cursorX: 34,
        cursorY: 46,
        clicking: true,
      },
      {
        index: 2,
        shortTitle: "Cập nhật, xem trước bản nháp",
        actionLog: "Cập nhật giá trị 350.000.000 → 420.000.000 VNĐ và hiển thị bản nháp A4",
        cursorLabel: "AI cập nhật 420.000.000 VNĐ",
        cursorX: 40,
        cursorY: 64,
        clicking: true,
      },
      {
        index: 3,
        shortTitle: "Save As tệp riêng để bảo toàn bản gốc",
        actionLog: "Bản nháp sẵn sàng tải xuống với tên tệp mới (.doc / .pdf), không ghi đè bản gốc",
        cursorLabel: "AI Save As tệp riêng",
        cursorX: 16,
        cursorY: 22,
        clicking: true,
      },
    ],
    chat: [
      {
        role: "user",
        text: "Dùng dữ liệu đã đọc để điền mẫu, cập nhật giá trị và tạo bản hợp đồng mới.",
        stepVisibleFrom: 0,
      },
      {
        role: "model",
        text: "Tôi đã điền mẫu và cập nhật giá trị. Bạn có thể xem trước bản nháp.",
        stepVisibleFrom: 2,
      },
      {
        role: "model",
        text: "Bản nháp đã sẵn sàng để tải xuống với tên mới.",
        fileChip: {
          title: "Hợp đồng mới · HD-DEMO-2026-01-MOI.doc",
          fileName: "HD-DEMO-2026-01-MOI.doc",
          meta: "Tệp riêng · không ghi đè bản gốc",
        },
        stepVisibleFrom: 3,
      },
    ],
  },
  {
    id: "sheets",
    badge: "Kịch bản bổ sung · Google Sheets",
    title: "Minh họa bổ sung: Làm sạch bảng theo dõi (ngoài 17 module)",
    subtitle: "Kịch bản mở rộng minh họa cắt khoảng trắng thừa, bỏ dòng trống và lọc dòng trùng lặp trên bảng dữ liệu mẫu.",
    appWindowTitle: "Bảng tính mẫu — Bang_Theo_Doi_Hop_Dong_Mau (mô phỏng)",
    appKind: "sheets",
    summaryPoints: [
      "Kịch bản bổ sung ngoài 17 module chính trong đề cương hợp đồng",
      "Minh họa đánh dấu 20 ô thừa khoảng trắng, 2 dòng trống và 2 dòng trùng khớp chính xác",
      "Chuẩn hóa bảng dữ liệu mẫu hoàn toàn cục bộ, không kết nối Google Sheet thật",
    ],
    steps: [
      {
        index: 0,
        shortTitle: "Nhận lệnh làm sạch bảng",
        actionLog: "Nhận yêu cầu rà soát bảng mẫu: cắt khoảng trắng, bỏ dòng trống và trùng lặp",
        cursorLabel: "AI nhận lệnh",
        cursorX: 74,
        cursorY: 66,
      },
      {
        index: 1,
        shortTitle: "Mở bảng tính mẫu",
        actionLog: "Quét toàn bộ 8 dòng dữ liệu mẫu tổng hợp trong khung xem trước",
        cursorLabel: "AI quét bảng mẫu",
        cursorX: 33,
        cursorY: 40,
        clicking: true,
      },
      {
        index: 2,
        shortTitle: "Đánh dấu lỗi dữ liệu",
        actionLog: "Phát hiện 20 ô thừa khoảng trắng, 2 dòng trống (dòng 3, 6) và 2 dòng trùng lặp (dòng 4, 8)",
        cursorLabel: "AI khoanh lỗi trùng & trống",
        cursorX: 38,
        cursorY: 58,
        clicking: true,
      },
      {
        index: 3,
        shortTitle: "Hoàn tất bảng sạch",
        actionLog: "Chuẩn hóa còn 4 dòng sạch (1 tiêu đề + 3 hợp đồng duy nhất) và hiển thị kết quả",
        cursorLabel: "AI hoàn tất làm sạch",
        cursorX: 52,
        cursorY: 46,
      },
    ],
    chat: [
      {
        role: "user",
        text: "Làm sạch bảng theo dõi mẫu: cắt khoảng trắng thừa, xóa dòng trống và lọc dòng trùng lặp.",
        stepVisibleFrom: 0,
      },
      {
        role: "model",
        text: "Đang quét lỗi khoảng trắng, dòng trống và dòng trùng lặp trên bảng dữ liệu mẫu…",
        stepVisibleFrom: 1,
      },
      {
        role: "model",
        text: "Đã làm sạch bảng dữ liệu mẫu hoàn tất:\n• Cắt khoảng trắng thừa: 20 ô\n• Đã loại bỏ dòng trống: 2 dòng\n• Đã loại bỏ dòng trùng lặp chính xác: 2 dòng\n• Kết quả sạch còn lại: 3 bản ghi hợp lệ",
        fileChip: {
          title: "Bang_Theo_Doi_Hop_Dong_Sach.csv",
          fileName: "Bang_Theo_Doi_Hop_Dong_Sach.csv",
          meta: "Mô phỏng · 4 dòng (gồm tiêu đề)",
        },
        stepVisibleFrom: 3,
      },
    ],
  },
];

export const EXPLORER_DEMO_FILES = [
  { name: "HD-DEMO-2026-01_Mau.docx", type: "Microsoft Word", size: "42 KB", date: "15/11/2026", active: true },
  { name: "HD-DEMO-2026-02_BaoTri_Mau.docx", type: "Microsoft Word", size: "38 KB", date: "20/11/2026", active: false },
  { name: "Phu_Luc_Vat_Tu_Mau.xlsx", type: "Excel Worksheet", size: "29 KB", date: "21/11/2026", active: false },
  { name: "Mau_Hop_Dong_Chuan_2026.docx", type: "Microsoft Word", size: "51 KB", date: "01/11/2026", active: false },
];

export const SHEETS_DEMO_ROWS_RAW = [
  { row: 2, code: "  HD-DEMO-2026-01 ", partner: "  Công ty TNHH   Mẫu Alpha ", item: "Cung cấp vật tư mẫu", value: "350.000.000", status: "Đang xử lý", kind: "trim" as const },
  { row: 3, code: "", partner: "", item: "", value: "", status: "", kind: "blank" as const },
  { row: 4, code: "  HD-DEMO-2026-01 ", partner: "  Công ty TNHH   Mẫu Alpha ", item: "Cung cấp vật tư mẫu", value: "350.000.000", status: "Đang xử lý", kind: "duplicate" as const },
  { row: 5, code: "  HD-DEMO-2026-02", partner: "Công ty CP Minh Họa Beta  ", item: "Bảo trì thiết bị mẫu", value: "185.000.000", status: "Hoàn tất", kind: "trim" as const },
  { row: 6, code: "", partner: "", item: "", value: "", status: "", kind: "blank" as const },
  { row: 7, code: "  HD-DEMO-2026-03 ", partner: "Công ty TNHH Kiểm Thử Gamma", item: "Hiệu chuẩn máy đo mẫu", value: "92.500.000", status: "Chờ duyệt", kind: "trim" as const },
  { row: 8, code: "  HD-DEMO-2026-02", partner: "Công ty CP Minh Họa Beta  ", item: "Bảo trì thiết bị mẫu", value: "185.000.000", status: "Hoàn tất", kind: "duplicate" as const },
];

export const SHEETS_DEMO_ROWS_CLEAN = [
  { row: 2, code: "HD-DEMO-2026-01", partner: "Công ty TNHH Mẫu Alpha", item: "Cung cấp vật tư mẫu", value: "350.000.000", status: "Đang xử lý" },
  { row: 3, code: "HD-DEMO-2026-02", partner: "Công ty CP Minh Họa Beta", item: "Bảo trì thiết bị mẫu", value: "185.000.000", status: "Hoàn tất" },
  { row: 4, code: "HD-DEMO-2026-03", partner: "Công ty TNHH Kiểm Thử Gamma", item: "Hiệu chuẩn máy đo mẫu", value: "92.500.000", status: "Chờ duyệt" },
];

/* ==================== Quản lý trích xuất dữ liệu đọc file Word hợp đồng ==================== */

export type ExtractedFieldStatus = "approved" | "pending" | "review";

export type ExtractedContractField = {
  id: string;
  key: string;
  label: string;
  value: string;
  sectionRef: string;
  quote: string;
  confidence: number;
  status: ExtractedFieldStatus;
};

export type ExtractedWordContract = {
  id: string;
  fileName: string;
  folderPath: string;
  docType: "Hợp đồng" | "Phụ lục";
  fileSizeLabel: string;
  pageCount: number;
  extractedAt: string;
  source: "synthetic-demo" | "local-docx";
  contractCode: string;
  valueVnd: number;
  reviewState: "approved" | "pending" | "review";
  rawParagraphs: string[];
  fields: ExtractedContractField[];
};

export const INITIAL_WORD_EXTRACTIONS: ExtractedWordContract[] = [
  {
    id: "word-ext-1",
    fileName: "HD-DEMO-2026-01_Cung_cap_vat_tu_mau.docx",
    folderPath: "D:\\HoSo_HopDong_Mau\\HD-DEMO-2026-01_Cung_cap_vat_tu_mau.docx",
    docType: "Hợp đồng",
    fileSizeLabel: "42 KB",
    pageCount: 4,
    extractedAt: "27/11/2026 21:40",
    source: "synthetic-demo",
    contractCode: "HD-DEMO-2026-01",
    valueVnd: 350_000_000,
    reviewState: "approved",
    rawParagraphs: [
      "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM — Độc lập - Tự do - Hạnh phúc",
      "HỢP ĐỒNG CUNG CẤP VẬT TƯ (DỮ LIỆU MẪU TỔNG HỢP)",
      "Số hợp đồng: HD-DEMO-2026-01 · Ngày ký: 15/11/2026",
      "Bên A (Bên mua): Công ty TNHH Vật Tư Mẫu Alpha — Đại diện: Ông Nguyễn Văn Mẫu A (Giám đốc dự án)",
      "Bên B (Bên bán): Công ty CP Thiết Bị Minh Họa Beta — Đại diện: Bà Trần Thị Mẫu B (Phó Giám đốc)",
      "Điều 1. Nội dung công việc: Cung cấp bu-lông, tấm đệm và vật tư kiểm thử tuyến mẫu số 01.",
      "Điều 2. Giá trị hợp đồng: 350.000.000 VNĐ (Ba trăm năm mươi triệu đồng, đã bao gồm thuế VAT 8%).",
      "Điều 3. Thời hạn thực hiện: 30 ngày kể từ ngày ký hợp đồng và nhận tạm ứng đợt 1.",
      "Điều 4. Thanh toán & bảo hành: Tạm ứng 30%; thanh toán 70% sau nghiệm thu lô hàng mẫu trong vòng 15 ngày; bảo hành 12 tháng.",
    ],
    fields: [
      { id: "f1-1", key: "so_hd", label: "Số hợp đồng", value: "HD-DEMO-2026-01", sectionRef: "Trang 1 · Đầu trang", quote: "Số hợp đồng: HD-DEMO-2026-01", confidence: 99, status: "approved" },
      { id: "f1-2", key: "ngay_ky", label: "Ngày ký", value: "15/11/2026", sectionRef: "Trang 1 · Đầu trang", quote: "Ngày ký: 15/11/2026", confidence: 99, status: "approved" },
      { id: "f1-3", key: "ben_a", label: "Bên A (Bên giao/mua)", value: "Công ty TNHH Vật Tư Mẫu Alpha", sectionRef: "Trang 1 · Thông tin các bên", quote: "Bên A (Bên mua): Công ty TNHH Vật Tư Mẫu Alpha", confidence: 98, status: "approved" },
      { id: "f1-4", key: "ben_b", label: "Bên B (Nhà thầu/bán)", value: "Công ty CP Thiết Bị Minh Họa Beta", sectionRef: "Trang 1 · Thông tin các bên", quote: "Bên B (Bên bán): Công ty CP Thiết Bị Minh Họa Beta", confidence: 98, status: "approved" },
      { id: "f1-5", key: "hang_muc", label: "Nội dung / Hạng mục", value: "Cung cấp bu-lông, tấm đệm và vật tư kiểm thử tuyến mẫu số 01", sectionRef: "Trang 1 · Điều 1", quote: "Điều 1. Nội dung công việc: Cung cấp bu-lông, tấm đệm...", confidence: 97, status: "approved" },
      { id: "f1-6", key: "gia_tri", label: "Giá trị hợp đồng", value: "350.000.000 VNĐ (đã gồm VAT 8%)", sectionRef: "Trang 2 · Điều 2", quote: "Điều 2. Giá trị hợp đồng: 350.000.000 VNĐ", confidence: 99, status: "approved" },
      { id: "f1-7", key: "thoi_han", label: "Thời hạn thực hiện", value: "30 ngày kể từ ngày ký", sectionRef: "Trang 2 · Điều 3", quote: "Điều 3. Thời hạn thực hiện: 30 ngày kể từ ngày ký", confidence: 96, status: "approved" },
      { id: "f1-8", key: "thanh_toan", label: "Điều khoản thanh toán", value: "Tạm ứng 30%; thanh toán 70% trong 15 ngày sau nghiệm thu", sectionRef: "Trang 3 · Điều 4", quote: "Tạm ứng 30%; thanh toán 70% sau nghiệm thu lô hàng mẫu", confidence: 95, status: "approved" },
    ],
  },
  {
    id: "word-ext-2",
    fileName: "HD-DEMO-2026-02_Bao_tri_thiet_bi_mau.docx",
    folderPath: "D:\\HoSo_HopDong_Mau\\HD-DEMO-2026-02_Bao_tri_thiet_bi_mau.docx",
    docType: "Hợp đồng",
    fileSizeLabel: "38 KB",
    pageCount: 5,
    extractedAt: "27/11/2026 21:44",
    source: "synthetic-demo",
    contractCode: "HD-DEMO-2026-02",
    valueVnd: 185_000_000,
    reviewState: "pending",
    rawParagraphs: [
      "HỢP ĐỒNG DỊCH VỤ BẢO TRÌ THIẾT BỊ (DỮ LIỆU MẪU TỔNG HỢP)",
      "Số hợp đồng: HD-DEMO-2026-02 · Ngày ký: 20/11/2026",
      "Bên A: Công ty TNHH Vận Hành Mẫu Gamma — Đại diện: Ông Lê Văn Mẫu C (Trưởng phòng Kỹ thuật)",
      "Bên B: Công ty TNHH Bảo Trì Minh Họa Delta — Đại diện: Ông Phạm Văn Mẫu D (Giám đốc kỹ thuật)",
      "Điều 1. Phạm vi: Bảo dưỡng định kỳ 02 tổ máy mô phỏng và hiệu chuẩn thiết bị đo hình học.",
      "Điều 2. Giá trị hợp đồng: 185.000.000 VNĐ (đã bao gồm VAT).",
      "Điều 3. Tiến độ: 60 ngày kể từ ngày bàn giao mặt bằng xưởng kiểm thử số 02.",
      "Điều 4. Bảo hành: Bảo hành dịch vụ 06 tháng kể từ ngày ký biên bản nghiệm thu bàn giao.",
    ],
    fields: [
      { id: "f2-1", key: "so_hd", label: "Số hợp đồng", value: "HD-DEMO-2026-02", sectionRef: "Trang 1 · Đầu trang", quote: "Số hợp đồng: HD-DEMO-2026-02", confidence: 99, status: "approved" },
      { id: "f2-2", key: "ngay_ky", label: "Ngày ký", value: "20/11/2026", sectionRef: "Trang 1 · Đầu trang", quote: "Ngày ký: 20/11/2026", confidence: 99, status: "approved" },
      { id: "f2-3", key: "ben_a", label: "Bên A (Bên giao/mua)", value: "Công ty TNHH Vận Hành Mẫu Gamma", sectionRef: "Trang 1 · Thông tin các bên", quote: "Bên A: Công ty TNHH Vận Hành Mẫu Gamma", confidence: 97, status: "approved" },
      { id: "f2-4", key: "ben_b", label: "Bên B (Nhà thầu/bán)", value: "Công ty TNHH Bảo Trì Minh Họa Delta", sectionRef: "Trang 1 · Thông tin các bên", quote: "Bên B: Công ty TNHH Bảo Trì Minh Họa Delta", confidence: 97, status: "approved" },
      { id: "f2-5", key: "hang_muc", label: "Nội dung / Hạng mục", value: "Bảo dưỡng định kỳ 02 tổ máy mô phỏng và hiệu chuẩn thiết bị đo", sectionRef: "Trang 1 · Điều 1", quote: "Điều 1. Phạm vi: Bảo dưỡng định kỳ 02 tổ máy mô phỏng...", confidence: 94, status: "pending" },
      { id: "f2-6", key: "gia_tri", label: "Giá trị hợp đồng", value: "185.000.000 VNĐ (đã gồm VAT)", sectionRef: "Trang 2 · Điều 2", quote: "Điều 2. Giá trị hợp đồng: 185.000.000 VNĐ", confidence: 98, status: "approved" },
      { id: "f2-7", key: "thoi_han", label: "Thời hạn thực hiện", value: "60 ngày kể từ ngày bàn giao mặt bằng", sectionRef: "Trang 2 · Điều 3", quote: "Điều 3. Tiến độ: 60 ngày kể từ ngày bàn giao mặt bằng", confidence: 91, status: "pending" },
      { id: "f2-8", key: "bao_hanh", label: "Bảo hành", value: "06 tháng kể từ ngày nghiệm thu bàn giao", sectionRef: "Trang 3 · Điều 4", quote: "Điều 4. Bảo hành: Bảo hành dịch vụ 06 tháng...", confidence: 93, status: "pending" },
    ],
  },
  {
    id: "word-ext-3",
    fileName: "PL-DEMO-2026-01_Phu_luc_bo_sung_mau.docx",
    folderPath: "D:\\HoSo_HopDong_Mau\\PL-DEMO-2026-01_Phu_luc_bo_sung_mau.docx",
    docType: "Phụ lục",
    fileSizeLabel: "27 KB",
    pageCount: 2,
    extractedAt: "27/11/2026 21:50",
    source: "synthetic-demo",
    contractCode: "PL01/HD-DEMO-2026-01",
    valueVnd: 70_000_000,
    reviewState: "review",
    rawParagraphs: [
      "PHỤ LỤC HỢP ĐỒNG SỐ 01 (DỮ LIỆU MẪU TỔNG HỢP)",
      "Số phụ lục: PL01/HD-DEMO-2026-01 · Ngày ký: 25/11/2026",
      "Căn cứ Hợp đồng gốc số HD-DEMO-2026-01 ký giữa Công ty TNHH Vật Tư Mẫu Alpha và Công ty CP Thiết Bị Minh Họa Beta.",
      "Nội dung điều chỉnh: Bổ sung 120 bộ bu-lông cường độ cao mẫu và gia hạn thêm 10 ngày giao hàng.",
      "Giá trị bổ sung: 70.000.000 VNĐ (tổng giá trị sau điều chỉnh: 420.000.000 VNĐ).",
    ],
    fields: [
      { id: "f3-1", key: "so_hd", label: "Số phụ lục", value: "PL01/HD-DEMO-2026-01", sectionRef: "Trang 1 · Đầu trang", quote: "Số phụ lục: PL01/HD-DEMO-2026-01", confidence: 99, status: "approved" },
      { id: "f3-2", key: "ngay_ky", label: "Ngày ký", value: "25/11/2026", sectionRef: "Trang 1 · Đầu trang", quote: "Ngày ký: 25/11/2026", confidence: 98, status: "approved" },
      { id: "f3-3", key: "ben_a", label: "Bên A (Bên giao/mua)", value: "Công ty TNHH Vật Tư Mẫu Alpha", sectionRef: "Trang 1 · Căn cứ", quote: "ký giữa Công ty TNHH Vật Tư Mẫu Alpha", confidence: 96, status: "approved" },
      { id: "f3-4", key: "ben_b", label: "Bên B (Nhà thầu/bán)", value: "Công ty CP Thiết Bị Minh Họa Beta", sectionRef: "Trang 1 · Căn cứ", quote: "và Công ty CP Thiết Bị Minh Họa Beta", confidence: 96, status: "approved" },
      { id: "f3-5", key: "hang_muc", label: "Nội dung điều chỉnh", value: "Bổ sung 120 bộ bu-lông cường độ cao mẫu, gia hạn thêm 10 ngày", sectionRef: "Trang 1 · Nội dung", quote: "Bổ sung 120 bộ bu-lông cường độ cao mẫu...", confidence: 89, status: "review" },
      { id: "f3-6", key: "gia_tri", label: "Giá trị bổ sung", value: "70.000.000 VNĐ (tổng sau điều chỉnh: 420.000.000 VNĐ)", sectionRef: "Trang 2 · Giá trị", quote: "Giá trị bổ sung: 70.000.000 VNĐ", confidence: 92, status: "review" },
    ],
  },
];

export function formatVndCompact(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")} VNĐ`;
}

export function parseVndAmount(raw: string): number {
  const match = /([0-9][0-9.,]{4,})/.exec(raw);
  if (!match) return 0;
  const digits = match[1].replace(/[.,]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Đọc trực tiếp nội dung văn bản từ tệp Word .docx (ZIP chứa word/document.xml) trên trình duyệt
 * không cần thư viện ngoài (dùng Web DecompressionStream deflate-raw).
 */
export async function readDocxTextInBrowser(file: File): Promise<string[]> {
  if (/\.txt$|\.md$/i.test(file.name)) {
    const text = await file.text();
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  const buf = await file.arrayBuffer();
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const decoder = new TextDecoder("utf-8");

  // Tìm End of Central Directory (0x06054b50)
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Tệp không đúng cấu trúc .docx (ZIP).");

  const cdOffset = view.getUint32(eocd + 16, true);
  const cdEntries = view.getUint16(eocd + 10, true);
  let pos = cdOffset;

  for (let idx = 0; idx < cdEntries; idx++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const method = view.getUint16(pos + 10, true);
    const compSize = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    pos += 46 + nameLen + extraLen + commentLen;

    if (name !== "word/document.xml") continue;

    const lhNameLen = view.getUint16(localHeaderOffset + 26, true);
    const lhExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + lhNameLen + lhExtraLen;
    const compressed = bytes.subarray(dataStart, dataStart + compSize);

    let xmlText = "";
    if (method === 0) {
      xmlText = decoder.decode(compressed);
    } else if (method === 8 && typeof DecompressionStream !== "undefined") {
      const ds = new DecompressionStream("deflate-raw");
      const stream = new Blob([compressed]).stream().pipeThrough(ds);
      xmlText = await new Response(stream).text();
    } else {
      throw new Error("Trình duyệt không hỗ trợ giải nén deflate-raw của tệp .docx.");
    }

    const parsed = new DOMParser().parseFromString(xmlText, "application/xml");
    const paragraphs = Array.from(parsed.getElementsByTagName("w:p"))
      .map((p) =>
        Array.from(p.getElementsByTagName("w:t"))
          .map((t) => t.textContent ?? "")
          .join("")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);
    return paragraphs;
  }

  throw new Error("Không tìm thấy word/document.xml bên trong tệp .docx.");
}

function findMatch(paragraphs: string[], patterns: RegExp[]): { value: string; quote: string; idx: number } {
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    for (const re of patterns) {
      const m = re.exec(p);
      if (m?.[1]?.trim()) {
        return { value: m[1].trim(), quote: p.slice(0, 140), idx: i + 1 };
      }
    }
  }
  return { value: "", quote: "", idx: 0 };
}

/** Trích xuất dữ liệu có cấu trúc từ các đoạn văn bản đọc được từ file Word (.docx / .txt). */
export function buildExtractionFromParagraphs(file: File, paragraphs: string[]): ExtractedWordContract {
  const defs: { key: string; label: string; patterns: RegExp[] }[] = [
    { key: "so_hd", label: "Số hợp đồng", patterns: [/Số(?:\s*(?:hợp\s*đồng|HĐ|phụ\s*lục))?\s*[:：]\s*([^·\n]+)/i] },
    { key: "ngay_ky", label: "Ngày ký", patterns: [/Ngày(?:\s*ký)?\s*[:：]\s*([^·\n]+)/i, /ngày\s+(\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4})/i] },
    { key: "ben_a", label: "Bên A (Bên giao/mua)", patterns: [/Bên\s*A(?:\s*\([^)]*\))?\s*[:：]\s*(.+)/i] },
    { key: "ben_b", label: "Bên B (Nhà thầu/bán)", patterns: [/Bên\s*B(?:\s*\([^)]*\))?\s*[:：]\s*(.+)/i] },
    { key: "hang_muc", label: "Nội dung / Hạng mục", patterns: [/(?:Hạng\s*mục|Nội\s*dung(?:\s*công\s*việc)?|Phạm\s*vi)\s*[:：]\s*(.+)/i] },
    { key: "gia_tri", label: "Giá trị hợp đồng", patterns: [/Giá\s*trị(?:\s*(?:hợp\s*đồng|bổ\s*sung))?\s*[:：]\s*(.+)/i] },
    { key: "thoi_han", label: "Thời hạn thực hiện", patterns: [/(?:Thời\s*hạn|Tiến\s*độ)(?:\s*thực\s*hiện)?\s*[:：]\s*(.+)/i] },
  ];

  const fields: ExtractedContractField[] = defs.map((d, i) => {
    const found = findMatch(paragraphs, d.patterns);
    return {
      id: `local-f-${Date.now()}-${i}`,
      key: d.key,
      label: d.label,
      value: found.value || "(chưa nhận diện — nhập bổ sung)",
      sectionRef: found.idx ? `Đoạn #${found.idx} trong Word` : "Chưa khớp tự động",
      quote: found.quote || "Không tìm thấy câu khớp mẫu trong tài liệu.",
      confidence: found.value ? 94 : 40,
      status: found.value ? "pending" : "review",
    };
  });

  const codeField = fields.find((f) => f.key === "so_hd")?.value ?? "";
  const valueField = fields.find((f) => f.key === "gia_tri")?.value ?? "";
  const isAnnex = /phụ\s*lục|pl\d+/i.test(file.name) || /phụ\s*lục/i.test(paragraphs.slice(0, 3).join(" "));

  return {
    id: `local-word-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fileName: file.name,
    folderPath: "Tệp đã chọn cục bộ (chỉ xử lý trong bộ nhớ trình duyệt)",
    docType: isAnnex ? "Phụ lục" : "Hợp đồng",
    fileSizeLabel: file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`,
    pageCount: Math.max(1, Math.ceil(paragraphs.length / 18)),
    extractedAt: new Date().toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }),
    source: "local-docx",
    contractCode: codeField && !codeField.startsWith("(") ? codeField : file.name.replace(/\.[^.]+$/, ""),
    valueVnd: parseVndAmount(valueField),
    reviewState: "pending",
    rawParagraphs: paragraphs.slice(0, 80),
    fields,
  };
}

export const DEFAULT_GENERATED_CONTRACT: GeneratedContractDocData = {
  soHD: "HD-DEMO-2026-01-MOI",
  ngayKy: "27/11/2026",
  diaDiemKy: "Hà Nội",
  benA: "Công ty TNHH Vật Tư Mẫu Alpha",
  daiDienA: "Ông Nguyễn Văn Mẫu A — Giám đốc dự án",
  benB: "Công ty CP Thiết Bị Minh Họa Beta",
  daiDienB: "Bà Trần Thị Mẫu B — Phó Giám đốc",
  hangMuc: "Cung cấp bu-lông, tấm đệm và vật tư kiểm thử tuyến mẫu số 01",
  giaTri: "420.000.000 VNĐ (đã bao gồm VAT 8%)",
  thoiHan: "30 ngày kể từ ngày ký hợp đồng",
  thanhToan: "Tạm ứng 30%; thanh toán 70% trong vòng 15 ngày sau nghiệm thu lô hàng mẫu.",
};

function escHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Nội dung HTML nội tuyến A4 chuẩn (dùng chung cho xem trước, tải Word .doc và xuất PDF). */
export function buildContractDocumentBodyHtml(d: GeneratedContractDocData): string {
  const s = (v: string) => escHtml(v.trim() || "……………………");
  return `
    <div style="font-family:'Times New Roman',Times,serif;font-size:13pt;line-height:1.45;color:#000;background:#fff;">
      <div style="text-align:center;font-weight:bold;">
        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>
        <span style="display:inline-block;border-bottom:1px solid #000;padding-bottom:1px;">Độc lập - Tự do - Hạnh phúc</span>
      </div>
      <p style="text-align:right;font-style:italic;margin:10px 0 8px;">${s(d.diaDiemKy)}, ngày ${s(d.ngayKy)}</p>
      <h1 style="text-align:center;font-size:15.5pt;font-weight:bold;text-transform:uppercase;margin:12px 0 4px;">HỢP ĐỒNG CUNG CẤP &amp; THI CÔNG (MẪU TẠO TỰ ĐỘNG)</h1>
      <p style="text-align:center;margin:0 0 14px;"><b>Số:</b> ${s(d.soHD)}</p>
      <p style="margin:6px 0;"><b>BÊN A (Bên giao / Chủ đầu tư):</b> ${s(d.benA)}<br/>Đại diện: ${s(d.daiDienA)}</p>
      <p style="margin:6px 0;"><b>BÊN B (Bên nhận / Nhà thầu):</b> ${s(d.benB)}<br/>Đại diện: ${s(d.daiDienB)}</p>
      <p style="margin:10px 0 4px;text-align:justify;"><b>Điều 1. Nội dung công việc:</b> Bên A giao và Bên B nhận thực hiện hạng mục <b>${s(d.hangMuc)}</b>.</p>
      <p style="margin:6px 0;text-align:justify;"><b>Điều 2. Giá trị hợp đồng:</b> <b>${s(d.giaTri)}</b>.</p>
      <p style="margin:6px 0;text-align:justify;"><b>Điều 3. Thời hạn thực hiện:</b> ${s(d.thoiHan)}.</p>
      <p style="margin:6px 0;text-align:justify;"><b>Điều 4. Thanh toán:</b> ${s(d.thanhToan)}</p>
      <p style="margin:6px 0;text-align:justify;"><b>Điều 5. Hiệu lực:</b> Hợp đồng lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>
      <table style="width:100%;margin-top:28px;text-align:center;font-weight:bold;border-collapse:collapse;">
        <tbody>
          <tr>
            <td style="width:50%;vertical-align:top;border:0;">
              ĐẠI DIỆN BÊN A<br/>
              <span style="font-size:11pt;font-weight:normal;font-style:italic;">(Ký, đóng dấu và ghi rõ họ tên)</span>
              <div style="height:64px;"></div>
              <span style="font-weight:bold;">${s(d.daiDienA.split("—")[0] ?? d.daiDienA)}</span>
            </td>
            <td style="width:50%;vertical-align:top;border:0;">
              ĐẠI DIỆN BÊN B<br/>
              <span style="font-size:11pt;font-weight:normal;font-style:italic;">(Ký, đóng dấu và ghi rõ họ tên)</span>
              <div style="height:64px;"></div>
              <span style="font-weight:bold;">${s(d.daiDienB.split("—")[0] ?? d.daiDienB)}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p style="margin-top:26px;padding-top:8px;border-top:1px dashed #94a3b8;font-family:system-ui,sans-serif;font-size:9.5pt;color:#475569;">
        Tệp tạo mới từ khung Trợ lý AI Thành Phát (dữ liệu mẫu tổng hợp — không ghi đè tệp gốc).
      </p>
    </div>`;
}

/** Tải hợp đồng thành tệp Word (.doc) chuẩn khổ A4 (lề trái 2cm, trên 1.5cm, phải/dưới 1cm). */
export function downloadGeneratedWordDoc(d: GeneratedContractDocData, customName?: string): string {
  const safeCode = (d.soHD || "HD-MOI").replace(/[^\w.-]+/g, "-");
  const fileName = customName || `${safeCode}.doc`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escHtml(d.soHD)}</title><style>@page Section1 { size: 21cm 29.7cm; margin: 1.5cm 1cm 1cm 2cm; } div.Section1 { page: Section1; }</style></head><body><div class="Section1">${buildContractDocumentBodyHtml(d)}</div></body></html>`;
  const blob = new Blob(["\uFEFF", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  return fileName;
}

export function makeWordPdfAttachments(docData: GeneratedContractDocData, formats: ("word" | "pdf")[]): DemoFileAttachment[] {
  const slug = (docData.soHD || "HD-MOI").replace(/[^\w.-]+/g, "-");
  const out: DemoFileAttachment[] = [];
  if (formats.includes("word")) {
    out.push({
      kind: "word",
      title: `Hợp đồng Word · ${docData.soHD}`,
      fileName: `${slug}.doc`,
      meta: "Microsoft Word (.doc) · A4 chuẩn",
      docData,
    });
  }
  if (formats.includes("pdf")) {
    out.push({
      kind: "pdf",
      title: `Hợp đồng PDF · ${docData.soHD}`,
      fileName: `${slug}.pdf`,
      meta: "PDF A4 · sẵn sàng in/gửi",
      docData,
    });
  }
  return out;
}

export function exportExtractionsToCsv(docs: ExtractedWordContract[]): string {
  const headers = ["Tên file Word", "Loại", "Mã hợp đồng", "Trạng thái duyệt", "Trường dữ liệu", "Giá trị trích xuất", "Vị trí nguồn", "Độ tin cậy (%)"];
  const rows: string[][] = [headers];
  for (const doc of docs) {
    for (const f of doc.fields) {
      rows.push([
        doc.fileName,
        doc.docType,
        doc.contractCode,
        f.status === "approved" ? "Đã duyệt" : f.status === "review" ? "Cần rà soát" : "Chờ kiểm tra",
        f.label,
        f.value,
        f.sectionRef,
        String(f.confidence),
      ]);
    }
  }
  const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}


/* ==================== Bản đồ 17 Module & Dữ liệu Giới thiệu Sản phẩm ==================== */

export type ModuleCapability = "real" | "sim" | "plan";

export type AiReportSectionId = "overview" | "all" | "showcase" | "modules" | "desktop" | "extraction" | "generate" | "stats";

export function exportBoqReconciliationCsv(): string {
  const headers = ["Mã hiệu BOQ", "Hạng mục công việc (mẫu)", "Đơn vị", "KL Hợp đồng", "KL Dự toán", "Đơn giá", "Kết quả đối chiếu"];
  const rows: string[][] = [headers];
  for (const r of SYNTHETIC_BOQ) {
    rows.push([r.code, r.item, r.unit, String(r.contractQty), String(r.boqQty), r.unitPriceLabel, r.diff]);
  }
  const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

export type ContractModule = {
  id: number;
  title: string;
  details: readonly string[];
  capability: ModuleCapability;
  focus?: boolean;
  demoRef?: Exclude<AiReportSectionId, "all" | "modules" | "overview" | "showcase">;
};

/**
 * 17 module chính từ đề cương hợp đồng (giữ nguyên tên và nội dung chi tiết từ tài liệu đặc tả).
 */
export const AI_CONTRACT_MODULES: readonly ContractModule[] = [
  {
    id: 1,
    title: "Dashboard & Tổng quan Hợp đồng",
    details: [
      "Tổng quan toàn bộ hợp đồng theo dự án, đối tác, trạng thái thực hiện.",
      "Biểu đồ thống kê giá trị hợp đồng, khối lượng thực hiện, tiến độ thanh toán, hạn mức bảo lãnh.",
      "Widget cảnh báo hợp đồng sắp hết hạn, phụ lục phát sinh, công nợ tồn đọng.",
    ],
    capability: "real",
    focus: true,
    demoRef: "stats",
  },
  {
    id: 2,
    title: "Quản lý Danh mục & Cơ sở dữ liệu Hợp đồng (Contract Registry)",
    details: [
      "Quản lý thông tin hợp đồng: Số HĐ, tên HĐ, đối tác, chủ đầu tư, giá trị, ngày ký, tiến độ.",
      "Phân loại hợp đồng: Mua bán, thi công xây lắp, dịch vụ, thầu phụ, bảo trì...",
      "Đính kèm tệp tin tài liệu scan gốc, phụ lục, biên bản nghiệm thu, hóa đơn chứng từ liên quan.",
    ],
    capability: "real",
    focus: true,
    demoRef: "extraction",
  },
  {
    id: 3,
    title: "Hệ thống OCR & Xử lý Văn bản Hợp đồng (Smart OCR & Text Extraction)",
    details: [
      "Nhận diện ký tự quang học (OCR) tự động từ file PDF scan, hình ảnh chất lượng cao.",
      "Tự động bóc tách các trường dữ liệu quan trọng: Các bên tham gia, giá trị hợp đồng, thời hạn thực hiện, điều khoản thanh toán, bảo lãnh, phạt vi phạm.",
      "Chuẩn hóa dữ liệu văn bản phục vụ nạp vào Vector Database cho AI phân tích.",
    ],
    capability: "sim",
    focus: true,
    demoRef: "extraction",
  },
  {
    id: 4,
    title: "Trợ lý AI Hỏi đáp Hợp đồng (AI Legal & Contract Q&A Chatbot)",
    details: [
      "Hỏi đáp tự nhiên bằng tiếng Việt về toàn bộ nội dung hợp đồng và phụ lục đính kèm.",
      "Trích dẫn nguồn chính xác theo từng điều khoản, trang, file văn bản gốc (Citations & Reference).",
      "Hỗ trợ tóm tắt điều khoản cốt lõi, so sánh sự khác biệt giữa hợp đồng gốc và các phụ lục.",
    ],
    capability: "sim",
    demoRef: "desktop",
  },
  {
    id: 5,
    title: "Quản lý Người dùng & Phân quyền Truy cập (User & Permission Management)",
    details: [
      "Phân quyền theo vai trò (RBAC): Ban giám đốc, Bộ phận Pháp chế/Đấu thầu, Kỹ sư QS, Kế toán, Khách hàng/Đối tác.",
      "Phân quyền xem dữ liệu theo dự án hoặc từng gói thầu cụ thể.",
      "Xác thực bảo mật tài khoản 2 lớp (2FA), mã hóa bảo mật thông tin tài liệu nhạy cảm.",
    ],
    capability: "sim",
  },
  {
    id: 6,
    title: "Nhật ký Hệ thống & Lịch sử Truy vấn (Audit Trail & Activity Log)",
    details: [
      "Ghi log chi tiết toàn bộ thao tác: Ai tải lên, ai chỉnh sửa, ai truy vấn tài liệu nào, thời gian nào.",
      "Lưu vết lịch sử các câu hỏi đáp với AI để kiểm soát an toàn thông tin nội bộ.",
    ],
    capability: "sim",
  },
  {
    id: 7,
    title: "Thiết kế Kiến trúc Hệ thống & Cơ sở dữ liệu Vector (Database & Vector DB Design)",
    details: [
      "Thiết kế kiến trúc Hybrid: CSDL Quan hệ (PostgreSQL) kết hợp CSDL Vector (Chroma/pgvector) tối ưu RAG.",
      "Tích hợp Embedding Models đa ngữ và Google Gemini LLM API tối ưu hóa xử lý ngôn ngữ pháp lý Việt Nam.",
      "Tối ưu hiệu năng tìm kiếm ngữ nghĩa cực nhanh và chính xác.",
    ],
    capability: "plan",
  },
  {
    id: 8,
    title: "Bóc tách Dự toán & Định mức Tự động (AI BOQ & Cost Breakdown Extraction)",
    details: [
      "AI tự động đọc bảng khối lượng (BOQ), dự toán chi phí từ file Excel/PDF phức tạp.",
      "Phân tích danh mục công việc, khối lượng thiết kế, đơn giá vật tư/nhân công/máy thi công.",
      "Chuẩn hóa cấu trúc mã hiệu định mức công việc phục vụ đối chiếu tự động.",
    ],
    capability: "sim",
  },
  {
    id: 9,
    title: "Kiểm tra Tuân thủ & Cảnh báo Rủi ro Pháp lý (Compliance & Risk Assessment)",
    details: [
      "AI quét tự động các điều khoản rủi ro: phạt vi phạm vượt quá luật định, điều khoản thanh toán bất lợi, rủi ro trượt giá vật liệu, trách nhiệm bảo hiểm.",
      "Đánh giá mức độ tuân thủ quy chuẩn pháp luật xây dựng và quy chế nội bộ của Thành Phát.",
      "Đề xuất phương án sửa đổi, bổ sung điều khoản an toàn cho doanh nghiệp.",
    ],
    capability: "sim",
  },
  {
    id: 10,
    title: "Đối chiếu Đơn giá & Khối lượng Hợp đồng - Dự toán (Contract vs BOQ Reconciliation)",
    details: [
      "Tự động so sánh chéo giữa Bảng khối lượng hợp đồng và Hồ sơ dự toán được duyệt.",
      "Phát hiện sai lệch về khối lượng, đơn giá, mã hiệu công việc hoặc các hạng mục bị tính trùng/bỏ sót.",
      "Xuất bảng đối chiếu chi tiết kèm chênh lệch giá trị phục vụ thương thảo hợp đồng.",
    ],
    capability: "sim",
  },
  {
    id: 11,
    title: "Quản lý Phụ lục & Biến động Khối lượng (Variation & Addendum Tracker)",
    details: [
      "Quản lý danh sách các phụ lục hợp đồng, thay đổi thiết kế, khối lượng phát sinh ngoài hợp đồng.",
      "Tự động cập nhật tổng giá trị hợp đồng mới sau khi có phụ lục được phê duyệt.",
      "Truy vết lịch sử các lần điều chỉnh giá trị, khối lượng và tiến độ.",
    ],
    capability: "sim",
    demoRef: "generate",
  },
  {
    id: 12,
    title: "Theo dõi Tiến độ & Cảnh báo Hạn mức Hợp đồng (Milestone & Payment Tracking)",
    details: [
      "Thiết lập các mốc tiến độ thi công, mốc thanh toán tạm ứng, hoàn thành, quyết toán theo hợp đồng.",
      "Theo dõi giá trị lũy kế giải ngân so với giá trị trần hợp đồng.",
      "Tự động cảnh báo khi sắp đến hạn thanh toán, hạn bảo lãnh ngân hàng hoặc vượt trần khối lượng.",
    ],
    capability: "sim",
    demoRef: "stats",
  },
  {
    id: 13,
    title: "Tự động Soạn thảo & Tạo Biên bản Báo cáo (Automated Report & Contract Generator)",
    details: [
      "Tạo biên bản thương thảo, tờ trình phê duyệt, phụ lục hợp đồng mẫu dựa trên dữ liệu đối chiếu.",
      "Tự động điền các thông tin đối tác, giá trị, điều khoản đã thống nhất vào mẫu văn bản chuẩn của công ty.",
    ],
    capability: "real",
    focus: true,
    demoRef: "generate",
  },
  {
    id: 14,
    title: "Hệ thống Thông báo & Cảnh báo Đa kênh (Notification & Alert System)",
    details: [
      "Cảnh báo tự động qua Email và thông báo trên phần mềm khi có sự kiện quan trọng.",
      "Cảnh báo hợp đồng sắp hết hiệu lực, bảo lãnh hợp đồng/bảo hành sắp hết hạn.",
      "Cảnh báo chênh lệch khối lượng/giá trị bất thường cần lãnh đạo kiểm tra.",
    ],
    capability: "sim",
    demoRef: "stats",
  },
  {
    id: 15,
    title: "Xuất Báo cáo Đa định dạng (Data Export - Excel, PDF, BI Dashboard)",
    details: [
      "Xuất toàn bộ báo cáo phân tích, bảng đối chiếu hợp đồng - dự toán sang định dạng Excel chuẩn xác định dạng.",
      "Xuất hồ sơ tóm tắt hợp đồng và phiếu rà soát rủi ro pháp lý sang định dạng PDF phục vụ họp giao ban.",
    ],
    capability: "real",
    demoRef: "generate",
  },
  {
    id: 16,
    title: "Tối ưu Giao diện Đa nền tảng (Responsive Web + Mobile/Tablet PWA)",
    details: [
      "Giao diện Web tối ưu trên máy tính cho chuyên viên và kỹ sư QS thao tác xử lý dữ liệu chi tiết.",
      "Giao diện Mobile App / Tablet (PWA Responsive) tối ưu cho Ban Giám đốc và Chỉ huy trưởng tra cứu thông tin và duyệt nhanh trên công trường.",
    ],
    capability: "real",
  },
  {
    id: 17,
    title: "Tích hợp Hệ sinh thái & Đa ngôn ngữ Anh - Việt (Bilingual & API Integration)",
    details: [
      "Sẵn sàng cổng kết nối API mở để liên thông dữ liệu với phần mềm kế toán, ERP hoặc quản lý dự án nội bộ.",
      "Hỗ trợ giao diện và khả năng hỏi đáp AI song ngữ Việt - Anh phục vụ các dự án hợp tác quốc tế.",
    ],
    capability: "plan",
  },
];

export const PRODUCT_WORKFLOWS: readonly { id: string; title: string; steps: readonly string[] }[] = [
  {
    id: "wf-a",
    title: "Luồng A · Số hóa, OCR & Hỏi đáp hợp đồng có trích dẫn",
    steps: [
      "Nhập hợp đồng/phụ lục",
      "OCR PDF scan/ảnh",
      "Bóc tách và chuẩn hóa",
      "Lập chỉ mục RAG",
      "Hỏi đáp tiếng Việt với điều khoản/trang/tệp; tóm tắt và so sánh phụ lục",
    ],
  },
  {
    id: "wf-b",
    title: "Luồng B · Bóc tách BOQ, đối chiếu dự toán & tạo văn bản",
    steps: [
      "Đọc BOQ/dự toán Excel/PDF",
      "Chuẩn hóa mã hiệu",
      "Đối chiếu hồ sơ dự toán được duyệt",
      "Phát hiện chênh lệch/trùng/bỏ sót",
      "Xuất so sánh hoặc tạo văn bản từ mẫu",
    ],
  },
  {
    id: "wf-c",
    title: "Luồng C · Biến động phụ lục, hạn mức thanh toán & cảnh báo",
    steps: [
      "Ghi nhận thay đổi và phụ lục",
      "Duyệt",
      "Cập nhật tổng giá trị",
      "Theo dõi tiến độ/thanh toán/hạn mức",
      "Cảnh báo trong phần mềm/email",
    ],
  },
];

export type ContractRegistryRow = {
  id: string;
  soHD: string;
  tenHD: string;
  duAn: string;
  doiTac: string;
  chuDauTu: string;
  loai: "Mua bán" | "Thi công xây lắp" | "Dịch vụ" | "Thầu phụ" | "Bảo trì";
  trangThai: "Đang thực hiện" | "Chờ duyệt phụ lục" | "Sắp hết hạn" | "Đã nghiệm thu";
  ngayKy: string;
  hanHieuLuc: string;
  giaTriVnd: number;
  khoiLuongPct: number;
  daThanhToanVnd: number;
  baoLanhDungVnd: number;
  baoLanhTranVnd: number;
  attachments: ("Scan gốc" | "Phụ lục" | "Biên bản nghiệm thu" | "Hóa đơn/chứng từ")[];
};

/** Danh mục tổng hợp 100% giả lập (không dùng tên người thật, không dùng giá nhà cung cấp thật). */
export const SYNTHETIC_PORTFOLIO: readonly ContractRegistryRow[] = [
  {
    id: "sp-1",
    soHD: "HD-DEMO-2026-01",
    tenHD: "Cung cấp vật tư ray & phụ kiện mẫu đợt 1",
    duAn: "Tuyến mẫu số 01",
    doiTac: "Công ty CP Thiết Bị Minh Họa Beta",
    chuDauTu: "Công ty TNHH Vật Tư Mẫu Alpha",
    loai: "Mua bán",
    trangThai: "Đang thực hiện",
    ngayKy: "2026-10-15",
    hanHieuLuc: "2026-12-10",
    giaTriVnd: 350_000_000,
    khoiLuongPct: 78,
    daThanhToanVnd: 245_000_000,
    baoLanhDungVnd: 35_000_000,
    baoLanhTranVnd: 50_000_000,
    attachments: ["Scan gốc", "Phụ lục", "Biên bản nghiệm thu", "Hóa đơn/chứng từ"],
  },
  {
    id: "sp-2",
    soHD: "HD-DEMO-2026-02",
    tenHD: "Bảo trì định kỳ 02 tổ máy mô phỏng",
    duAn: "Tuyến mẫu số 01",
    doiTac: "Công ty TNHH Bảo Trì Minh Họa Delta",
    chuDauTu: "Công ty TNHH Vận Hành Mẫu Gamma",
    loai: "Bảo trì",
    trangThai: "Sắp hết hạn",
    ngayKy: "2026-09-20",
    hanHieuLuc: "2026-12-05",
    giaTriVnd: 185_000_000,
    khoiLuongPct: 92,
    daThanhToanVnd: 130_000_000,
    baoLanhDungVnd: 18_500_000,
    baoLanhTranVnd: 25_000_000,
    attachments: ["Scan gốc", "Biên bản nghiệm thu"],
  },
  {
    id: "sp-3",
    soHD: "HD-DEMO-2026-03",
    tenHD: "Thi công lắp đặt phân đoạn kiểm thử 02",
    duAn: "Tuyến mẫu số 02",
    doiTac: "Công ty CP Xây Lắp Mẫu Epsilon",
    chuDauTu: "Công ty TNHH Hạ Tầng Mẫu Omega",
    loai: "Thi công xây lắp",
    trangThai: "Chờ duyệt phụ lục",
    ngayKy: "2026-08-12",
    hanHieuLuc: "2027-01-30",
    giaTriVnd: 620_000_000,
    khoiLuongPct: 65,
    daThanhToanVnd: 340_000_000,
    baoLanhDungVnd: 62_000_000,
    baoLanhTranVnd: 75_000_000,
    attachments: ["Scan gốc", "Phụ lục", "Hóa đơn/chứng từ"],
  },
  {
    id: "sp-4",
    soHD: "HD-DEMO-2026-04",
    tenHD: "Dịch vụ thí nghiệm & hiệu chuẩn mẫu",
    duAn: "Tuyến mẫu số 02",
    doiTac: "Trung tâm Kiểm Định Mẫu Zeta",
    chuDauTu: "Công ty TNHH Hạ Tầng Mẫu Omega",
    loai: "Dịch vụ",
    trangThai: "Đã nghiệm thu",
    ngayKy: "2026-07-05",
    hanHieuLuc: "2026-11-20",
    giaTriVnd: 140_000_000,
    khoiLuongPct: 100,
    daThanhToanVnd: 140_000_000,
    baoLanhDungVnd: 0,
    baoLanhTranVnd: 20_000_000,
    attachments: ["Scan gốc", "Biên bản nghiệm thu", "Hóa đơn/chứng từ"],
  },
  {
    id: "sp-5",
    soHD: "HD-DEMO-2026-05",
    tenHD: "Thầu phụ vận chuyển vật tư nội tuyến mẫu",
    duAn: "Xưởng kiểm thử mẫu",
    doiTac: "Công ty CP Thiết Bị Minh Họa Beta",
    chuDauTu: "Công ty TNHH Vật Tư Mẫu Alpha",
    loai: "Thầu phụ",
    trangThai: "Đang thực hiện",
    ngayKy: "2026-11-02",
    hanHieuLuc: "2027-02-15",
    giaTriVnd: 260_000_000,
    khoiLuongPct: 48,
    daThanhToanVnd: 95_000_000,
    baoLanhDungVnd: 26_000_000,
    baoLanhTranVnd: 40_000_000,
    attachments: ["Scan gốc", "Hóa đơn/chứng từ"],
  },
];

export type AlertItem = {
  id: string;
  category: "expiring" | "addendum" | "debt";
  contractCode: string;
  title: string;
  detail: string;
  severity: "high" | "medium";
};

export const SYNTHETIC_ALERTS: readonly AlertItem[] = [
  { id: "al-1", category: "expiring", contractCode: "HD-DEMO-2026-02", title: "Còn 7 ngày hết hiệu lực", detail: "Hạn 05/12/2026 · cần hoàn tất biên bản bàn giao mẫu.", severity: "high" },
  { id: "al-2", category: "expiring", contractCode: "HD-DEMO-2026-01", title: "Còn 12 ngày hết hạn bảo lãnh", detail: "Bảo lãnh thực hiện đến 10/12/2026.", severity: "medium" },
  { id: "al-3", category: "addendum", contractCode: "PL01/HD-DEMO-2026-01", title: "Phụ lục bổ sung +70.000.000 VNĐ", detail: "Đang chờ rà soát đơn giá và gia hạn 10 ngày.", severity: "medium" },
  { id: "al-4", category: "addendum", contractCode: "PL01/HD-DEMO-2026-03", title: "Biến động khối lượng +8,5%", detail: "Phát sinh phân đoạn kiểm thử 02, cần phê duyệt.", severity: "high" },
  { id: "al-5", category: "debt", contractCode: "HD-DEMO-2026-03", title: "Công nợ tồn đọng 85.000.000 VNĐ", detail: "Quá hạn đối soát hồ sơ thanh toán đợt 2 (14 ngày).", severity: "high" },
  { id: "al-6", category: "debt", contractCode: "HD-DEMO-2026-02", title: "Chưa giải ngân đợt cuối 55.000.000 VNĐ", detail: "Chờ đủ bộ hóa đơn/chứng từ nghiệm thu.", severity: "medium" },
];

export const SYNTHETIC_BOQ = [
  { code: "BOQ-MAU-01", item: "Bu-lông cường độ cao (mẫu)", unit: "Bộ", contractQty: 500, boqQty: 500, unitPriceLabel: "Đơn giá mẫu", diff: "Khớp" },
  { code: "BOQ-MAU-02", item: "Tấm đệm đàn hồi (mẫu)", unit: "Tấm", contractQty: 320, boqQty: 300, unitPriceLabel: "Đơn giá mẫu", diff: "Chênh +20 tấm" },
  { code: "BOQ-MAU-03", item: "Nhân công lắp đặt phân đoạn mẫu", unit: "Công", contractQty: 120, boqQty: 120, unitPriceLabel: "Đơn giá mẫu", diff: "Khớp" },
  { code: "BOQ-MAU-04", item: "Hiệu chuẩn thiết bị đo mẫu", unit: "Lần", contractQty: 2, boqQty: 3, unitPriceLabel: "Đơn giá mẫu", diff: "Thiếu 1 lần so dự toán" },
  { code: "BOQ-MAU-05", item: "Vận chuyển nội tuyến mẫu", unit: "Chuyến", contractQty: 15, boqQty: 15, unitPriceLabel: "Đơn giá mẫu", diff: "Khớp" },
] as const;

export const SYNTHETIC_QA = [
  {
    q: "Điều khoản thanh toán và bảo hành của HD-DEMO-2026-01 quy định thế nào?",
    a: "Tạm ứng 30% sau khi ký hợp đồng; thanh toán 70% trong vòng 15 ngày kể từ khi nghiệm thu lô hàng mẫu; thời gian bảo hành 12 tháng.",
    citation: "Điều 4 · Trang 3 · HD-DEMO-2026-01_Cung_cap_vat_tu_mau.docx",
  },
  {
    q: "Phụ lục PL01/HD-DEMO-2026-01 thay đổi gì so với hợp đồng gốc?",
    a: "Bổ sung 120 bộ bu-lông cường độ cao mẫu (+70.000.000 VNĐ), nâng tổng giá trị từ 350.000.000 VNĐ lên 420.000.000 VNĐ và gia hạn tiến độ thêm 10 ngày.",
    citation: "Nội dung điều chỉnh · Trang 1–2 · PL-DEMO-2026-01_Phu_luc_bo_sung_mau.docx",
  },
  {
    q: "Hợp đồng HD-DEMO-2026-02 có rủi ro nào cần lưu ý trước khi ký phụ lục?",
    a: "Mục bảo lãnh thực hiện và mức phạt chậm tiến độ chưa được nêu rõ trong bản mẫu — khuyến nghị bổ sung giới hạn phạt tối đa theo quy định.",
    citation: "Điều 3–4 · Trang 2–3 · HD-DEMO-2026-02_Bao_tri_thiet_bi_mau.docx",
  },
] as const;

export type AuditEntry = {
  id: string;
  time: string;
  actor: string;
  action: string;
  scope: "real-session" | "sim";
};

export const SYNTHETIC_AUDIT: readonly AuditEntry[] = [
  { id: "au-1", time: "21:40", actor: "Kỹ sư QS (mẫu)", action: "Đọc & trích xuất 8 trường từ HD-DEMO-2026-01_Cung_cap_vat_tu_mau.docx", scope: "sim" },
  { id: "au-2", time: "21:45", actor: "Pháp chế (mẫu)", action: "Rà soát rủi ro điều khoản phạt & bảo hành trên HD-DEMO-2026-02", scope: "sim" },
  { id: "au-3", time: "21:52", actor: "Kế toán dự án (mẫu)", action: "Đối chiếu phụ lục PL01/HD-DEMO-2026-01 (+70.000.000 VNĐ)", scope: "sim" },
];

export type ContractTemplateId = "contract" | "addendum" | "report";

export const CONTRACT_TEMPLATES: readonly { id: ContractTemplateId; label: string; description: string }[] = [
  { id: "contract", label: "Hợp đồng cung cấp vật tư", description: "Mẫu hợp đồng kinh tế A4 chuẩn, ánh xạ đủ 11 trường thông tin." },
  { id: "addendum", label: "Phụ lục điều chỉnh giá trị", description: "Tính tổng giá trị mới = Giá trị gốc + Điều chỉnh (+/-), không sửa hợp đồng gốc." },
  { id: "report", label: "Báo cáo tóm tắt hợp đồng", description: "Phiếu tóm tắt hợp đồng & điều khoản trọng yếu phục vụ họp giao ban." },
];

/**
 * Hỗ trợ đọc cả chuỗi số đầy đủ ("420.000.000 VNĐ") lẫn cách viết rút gọn ("420 triệu", "1.5 tỷ").
 * Trả `amount` (0 nếu không phân tích được) và `warning` nếu đầu vào có chữ nhưng chưa có số rõ.
 */
export function parseVndAmountSmart(raw: string): { amount: number; warning?: string } {
  const cleaned = raw.trim();
  if (!cleaned) return { amount: 0, warning: "Chưa có giá trị hợp đồng." };
  const lower = cleaned.toLocaleLowerCase("vi");
  const shortMatch = /(-?\d+(?:[.,]\d+)?)\s*(tỷ|ty|triệu|trieu)(?=$|[\s.,;)/])/i.exec(lower);
  if (shortMatch) {
    const num = Number(shortMatch[1].replace(",", "."));
    const mult = /tỷ|ty/i.test(shortMatch[2]) ? 1_000_000_000 : 1_000_000;
    if (Number.isFinite(num)) return { amount: Math.round(num * mult) };
  }
  const signedMatch = /(-?\s*[0-9][0-9.,]{3,})/.exec(cleaned);
  if (signedMatch) {
    const normalized = signedMatch[1].replace(/\s+/g, "").replace(/[.,]/g, "");
    const n = Number(normalized);
    if (Number.isFinite(n)) return { amount: n };
  }
  return { amount: 0, warning: "Không nhận diện được số tiền VNĐ (ví dụ: 420.000.000 VNĐ hoặc 420 triệu)." };
}

export function buildAddendumBodyHtml(d: GeneratedContractDocData): string {
  const s = (v: string | undefined) => escHtml((v ?? "").trim() || "……………………");
  const baseVal = parseVndAmountSmart(d.giaTriGoc || d.giaTri).amount;
  const deltaVal = parseVndAmountSmart(d.giaTriDieuChinh || "0").amount;
  const totalVal = baseVal + deltaVal;
  return `
    <div style="font-family:'Times New Roman',Times,serif;font-size:13pt;line-height:1.45;color:#000;background:#fff;">
      <div style="text-align:center;font-weight:bold;">
        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>
        <span style="display:inline-block;border-bottom:1px solid #000;padding-bottom:1px;">Độc lập - Tự do - Hạnh phúc</span>
      </div>
      <p style="text-align:right;font-style:italic;margin:10px 0 8px;">${s(d.diaDiemKy)}, ngày ${s(d.ngayKy)}</p>
      <h1 style="text-align:center;font-size:15.5pt;font-weight:bold;text-transform:uppercase;margin:12px 0 4px;">PHỤ LỤC ĐIỀU CHỈNH GIÁ TRỊ HỢP ĐỒNG</h1>
      <p style="text-align:center;margin:0 0 12px;"><b>Số phụ lục:</b> ${s(d.soPhuLuc || `PL01/${d.soHD}`)} &nbsp;·&nbsp; <b>Hợp đồng gốc:</b> ${s(d.soHD)}</p>
      <p style="margin:6px 0;"><b>BÊN A:</b> ${s(d.benA)} — Đại diện: ${s(d.daiDienA)}</p>
      <p style="margin:6px 0;"><b>BÊN B:</b> ${s(d.benB)} — Đại diện: ${s(d.daiDienB)}</p>
      <p style="margin:10px 0 4px;text-align:justify;"><b>Điều 1. Nội dung điều chỉnh:</b> ${s(d.lyDoDieuChinh || d.hangMuc)}</p>
      <table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:12pt;">
        <tbody>
          <tr><td style="border:1px solid #000;padding:5px 8px;">Giá trị hợp đồng gốc</td><td style="border:1px solid #000;padding:5px 8px;text-align:right;font-weight:bold;">${baseVal ? formatVndCompact(baseVal) : s(d.giaTriGoc || d.giaTri)}</td></tr>
          <tr><td style="border:1px solid #000;padding:5px 8px;">Giá trị điều chỉnh theo phụ lục</td><td style="border:1px solid #000;padding:5px 8px;text-align:right;font-weight:bold;">${deltaVal ? `${deltaVal >= 0 ? "+" : ""}${formatVndCompact(deltaVal)}` : s(d.giaTriDieuChinh)}</td></tr>
          <tr style="background:#f1f5f9;"><td style="border:1px solid #000;padding:5px 8px;font-weight:bold;">Tổng giá trị sau điều chỉnh</td><td style="border:1px solid #000;padding:5px 8px;text-align:right;font-weight:bold;">${totalVal ? formatVndCompact(totalVal) : "Chưa tính được (kiểm tra số tiền)"}</td></tr>
        </tbody>
      </table>
      <p style="margin:6px 0;"><b>Điều 2. Thời hạn &amp; thanh toán:</b> ${s(d.thoiHan)} · ${s(d.thanhToan)}</p>
      <p style="margin:6px 0;"><b>Điều 3. Hiệu lực:</b> Phụ lục là bộ phận không tách rời của hợp đồng gốc số ${s(d.soHD)}; các điều khoản khác giữ nguyên hiệu lực.</p>
      <table style="width:100%;margin-top:26px;text-align:center;font-weight:bold;border-collapse:collapse;">
        <tbody><tr>
          <td style="width:50%;border:0;">ĐẠI DIỆN BÊN A<div style="font-size:11pt;font-weight:normal;font-style:italic;margin-bottom:58px;">(Ký, đóng dấu và ghi rõ họ tên)</div>${s(d.daiDienA.split("—")[0])}</td>
          <td style="width:50%;border:0;">ĐẠI DIỆN BÊN B<div style="font-size:11pt;font-weight:normal;font-style:italic;margin-bottom:58px;">(Ký, đóng dấu và ghi rõ họ tên)</div>${s(d.daiDienB.split("—")[0])}</td>
        </tr></tbody>
      </table>
      <p style="margin-top:24px;padding-top:8px;border-top:1px dashed #94a3b8;font-family:system-ui,sans-serif;font-size:9.5pt;color:#475569;">
        Bản nháp do hệ thống soạn — cần người có thẩm quyền rà soát và ký. Không ghi đè tệp gốc.
      </p>
    </div>`;
}

export function buildSummaryReportBodyHtml(d: GeneratedContractDocData): string {
  const s = (v: string | undefined) => escHtml((v ?? "").trim() || "……………………");
  return `
    <div style="font-family:'Times New Roman',Times,serif;font-size:13pt;line-height:1.45;color:#000;background:#fff;">
      <div style="text-align:center;font-weight:bold;">
        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>
        <span style="display:inline-block;border-bottom:1px solid #000;padding-bottom:1px;">Độc lập - Tự do - Hạnh phúc</span>
      </div>
      <p style="text-align:right;font-style:italic;margin:10px 0 8px;">${s(d.diaDiemKy)}, ngày ${s(d.ngayKy)}</p>
      <h1 style="text-align:center;font-size:15pt;font-weight:bold;text-transform:uppercase;margin:12px 0 4px;">BÁO CÁO TÓM TẮT &amp; RÀ SOÁT HỢP ĐỒNG</h1>
      <p style="text-align:center;margin:0 0 12px;"><b>Hồ sơ tham chiếu:</b> ${s(d.soHD)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:12pt;">
        <tbody>
          <tr><td style="width:32%;border:1px solid #000;padding:5px 8px;font-weight:bold;">Số hợp đồng</td><td style="border:1px solid #000;padding:5px 8px;">${s(d.soHD)}</td></tr>
          <tr><td style="border:1px solid #000;padding:5px 8px;font-weight:bold;">Bên A (Bên giao)</td><td style="border:1px solid #000;padding:5px 8px;">${s(d.benA)} (${s(d.daiDienA)})</td></tr>
          <tr><td style="border:1px solid #000;padding:5px 8px;font-weight:bold;">Bên B (Bên nhận)</td><td style="border:1px solid #000;padding:5px 8px;">${s(d.benB)} (${s(d.daiDienB)})</td></tr>
          <tr><td style="border:1px solid #000;padding:5px 8px;font-weight:bold;">Phạm vi / Hạng mục</td><td style="border:1px solid #000;padding:5px 8px;">${s(d.hangMuc)}</td></tr>
          <tr><td style="border:1px solid #000;padding:5px 8px;font-weight:bold;">Giá trị hợp đồng</td><td style="border:1px solid #000;padding:5px 8px;font-weight:bold;">${s(d.giaTri)}</td></tr>
          <tr><td style="border:1px solid #000;padding:5px 8px;font-weight:bold;">Thời hạn thực hiện</td><td style="border:1px solid #000;padding:5px 8px;">${s(d.thoiHan)}</td></tr>
          <tr><td style="border:1px solid #000;padding:5px 8px;font-weight:bold;">Điều khoản thanh toán</td><td style="border:1px solid #000;padding:5px 8px;">${s(d.thanhToan)}</td></tr>
        </tbody>
      </table>
      <p style="margin-top:16px;"><b>Kiến nghị rà soát:</b> Kiểm tra đầy đủ điều khoản bảo lãnh thực hiện, hạn thanh toán và bảng khối lượng trước khi trình ký chính thức.</p>
      <p style="margin-top:24px;padding-top:8px;border-top:1px dashed #94a3b8;font-family:system-ui,sans-serif;font-size:9.5pt;color:#475569;">
        Bản nháp do hệ thống soạn — cần người có thẩm quyền rà soát và ký.
      </p>
    </div>`;
}

export function renderTemplateBodyHtml(d: GeneratedContractDocData): string {
  if (d.loaiMau === "addendum") return buildAddendumBodyHtml(d);
  if (d.loaiMau === "report") return buildSummaryReportBodyHtml(d);
  return buildContractDocumentBodyHtml(d);
}

/** Tải văn bản theo đúng mẫu (hợp đồng / phụ lục / báo cáo) thành tệp Word (.doc) chuẩn A4. */
export function downloadTemplateWordDoc(d: GeneratedContractDocData): string {
  const prefix = d.loaiMau === "addendum" ? "Phu-luc-" : d.loaiMau === "report" ? "Bao-cao-" : "";
  const safeCode = (d.loaiMau === "addendum" && d.soPhuLuc ? d.soPhuLuc : d.soHD || "HD-MOI").replace(/[^\w.-]+/g, "-");
  const fileName = `${prefix}${safeCode}.doc`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escHtml(d.soHD)}</title><style>@page Section1 { size: 21cm 29.7cm; margin: 1.5cm 1cm 1cm 2cm; } div.Section1 { page: Section1; }</style></head><body><div class="Section1">${renderTemplateBodyHtml(d)}</div></body></html>`;
  const blob = new Blob(["\uFEFF", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  return fileName;
}

export type ContractStatsSummary = {
  count: number;
  contractsCount: number;
  addendaCount: number;
  totalValue: number;
  avgValue: number;
  missingValueCount: number;
  totalFields: number;
  approvedFields: number;
  fieldCoveragePct: number;
  approvedDocsCount: number;
  approvedDocsPct: number;
  byReviewState: { approved: number; pending: number; review: number };
  topPartners: { name: string; count: number; totalValue: number }[];
  hasRealDocs: boolean;
};

export function computeContractStats(docs: ExtractedWordContract[]): ContractStatsSummary {
  const count = docs.length;
  const contractsCount = docs.filter((d) => d.docType === "Hợp đồng").length;
  const addendaCount = docs.filter((d) => d.docType === "Phụ lục").length;
  let totalValue = 0;
  let valuedCount = 0;
  let missingValueCount = 0;
  const partnerMap = new Map<string, { count: number; totalValue: number }>();

  for (const d of docs) {
    const giaTriField = d.fields.find((f) => f.key === "gia_tri")?.value ?? "";
    const parsed = d.valueVnd > 0 ? d.valueVnd : parseVndAmountSmart(giaTriField).amount;
    if (parsed > 0) {
      totalValue += parsed;
      valuedCount++;
    } else {
      missingValueCount++;
    }
    const partnerRaw = d.fields.find((f) => f.key === "ben_b")?.value?.trim() || "Chưa xác định đối tác";
    const partner = partnerRaw.startsWith("(") ? "Chưa xác định đối tác" : partnerRaw;
    const prev = partnerMap.get(partner) ?? { count: 0, totalValue: 0 };
    partnerMap.set(partner, { count: prev.count + 1, totalValue: prev.totalValue + parsed });
  }

  const totalFields = docs.reduce((s, d) => s + d.fields.length, 0);
  const validFields = docs.reduce(
    (s, d) => s + d.fields.filter((f) => f.value.trim() && !f.value.startsWith("(")).length,
    0
  );
  const approvedFields = docs.reduce((s, d) => s + d.fields.filter((f) => f.status === "approved").length, 0);
  const approved = docs.filter((d) => d.reviewState === "approved").length;
  const pending = docs.filter((d) => d.reviewState === "pending").length;
  const review = docs.filter((d) => d.reviewState === "review").length;

  const topPartners = Array.from(partnerMap.entries())
    .map(([name, info]) => ({ name, ...info }))
    .sort((a, b) => b.totalValue - a.totalValue || b.count - a.count)
    .slice(0, 5);

  return {
    count,
    contractsCount,
    addendaCount,
    totalValue,
    avgValue: valuedCount > 0 ? Math.round(totalValue / valuedCount) : 0,
    missingValueCount,
    totalFields,
    approvedFields,
    fieldCoveragePct: totalFields > 0 ? Math.round((validFields / totalFields) * 100) : 0,
    approvedDocsCount: approved,
    approvedDocsPct: count > 0 ? Math.round((approved / count) * 100) : 0,
    byReviewState: { approved, pending, review },
    topPartners,
    hasRealDocs: docs.some((d) => d.source === "local-docx"),
  };
}

export function nextContractCode(docs: ExtractedWordContract[]): string {
  const year = new Date().getFullYear();
  let maxNum = 0;
  for (const d of docs) {
    const m = /(\d{2,3})$/.exec(d.contractCode.trim());
    if (m) maxNum = Math.max(maxNum, Number(m[1]));
  }
  return `HD-DEMO-${year}-${String(maxNum + 1).padStart(2, "0")}-MOI`;
}

export function extractionToGeneratedDoc(
  doc: ExtractedWordContract,
  docs: ExtractedWordContract[],
  template: ContractTemplateId = "contract"
): GeneratedContractDocData {
  const get = (key: string) => {
    const val = doc.fields.find((f) => f.key === key)?.value?.trim() ?? "";
    return val.startsWith("(") ? "" : val;
  };
  const baseCode = get("so_hd") || doc.contractCode || "HD-DEMO-2026-01";
  const baseVal = get("gia_tri") || (doc.valueVnd > 0 ? formatVndCompact(doc.valueVnd) : "");
  return {
    soHD: template === "contract" ? nextContractCode(docs) : baseCode,
    ngayKy: get("ngay_ky") || new Date().toLocaleDateString("vi-VN"),
    diaDiemKy: "Hà Nội",
    benA: get("ben_a") || DEFAULT_GENERATED_CONTRACT.benA,
    daiDienA: DEFAULT_GENERATED_CONTRACT.daiDienA,
    benB: get("ben_b") || DEFAULT_GENERATED_CONTRACT.benB,
    daiDienB: DEFAULT_GENERATED_CONTRACT.daiDienB,
    hangMuc: get("hang_muc") || DEFAULT_GENERATED_CONTRACT.hangMuc,
    giaTri: baseVal || DEFAULT_GENERATED_CONTRACT.giaTri,
    thoiHan: get("thoi_han") || DEFAULT_GENERATED_CONTRACT.thoiHan,
    thanhToan: get("thanh_toan") || DEFAULT_GENERATED_CONTRACT.thanhToan,
    loaiMau: template,
    soPhuLuc: template === "addendum" ? `PL01/${baseCode}` : undefined,
    giaTriGoc: baseVal || DEFAULT_GENERATED_CONTRACT.giaTri,
    giaTriDieuChinh: template === "addendum" ? "+70.000.000 VNĐ" : undefined,
    lyDoDieuChinh: template === "addendum" ? "Điều chỉnh bổ sung khối lượng vật tư và gia hạn tiến độ." : undefined,
  };
}

export type FolderReadItemStatus = {
  name: string;
  sizeBytes: number;
  status: "read" | "skipped-ocr" | "skipped-unsupported" | "rejected-oversize" | "error";
  reason: string;
  fieldCount?: number;
  avgConfidence?: number;
};

export type FolderReadBatchResult = {
  docs: ExtractedWordContract[];
  items: FolderReadItemStatus[];
  truncatedCount: number;
};

const MAX_FOLDER_FILES = 50;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Đọc an toàn tối đa 50 tệp (.docx/.txt/.md ≤ 10MB) trong bộ nhớ trình duyệt; bỏ qua tệp khác mà không dừng batch. */
export async function readAuthorizedFilesBatch(files: File[]): Promise<FolderReadBatchResult> {
  const limited = files.slice(0, MAX_FOLDER_FILES);
  const truncatedCount = Math.max(0, files.length - MAX_FOLDER_FILES);
  const docs: ExtractedWordContract[] = [];
  const items: FolderReadItemStatus[] = [];

  for (const file of limited) {
    const name = file.name;
    if (file.size > MAX_FILE_BYTES) {
      items.push({
        name,
        sizeBytes: file.size,
        status: "rejected-oversize",
        reason: "Vượt giới hạn 10 MB/tệp — đã bỏ qua an toàn.",
      });
      continue;
    }
    if (/\.(pdf|png|jpe?g|tiff?|bmp|doc)$/i.test(name)) {
      items.push({
        name,
        sizeBytes: file.size,
        status: "skipped-ocr",
        reason: "Định dạng scan/.pdf/.doc cũ — cần OCR (Mô phỏng · chưa xử lý trên trình duyệt).",
      });
      continue;
    }
    if (!/\.(docx|txt|md)$/i.test(name)) {
      items.push({
        name,
        sizeBytes: file.size,
        status: "skipped-unsupported",
        reason: "Định dạng chưa hỗ trợ đọc tự động (hỗ trợ .docx, .txt, .md).",
      });
      continue;
    }
    try {
      const paragraphs = await readDocxTextInBrowser(file);
      if (!paragraphs.length) {
        items.push({
          name,
          sizeBytes: file.size,
          status: "error",
          reason: "Không tìm thấy đoạn văn bản trong tệp.",
        });
        continue;
      }
      const extracted = buildExtractionFromParagraphs(file, paragraphs);
      const matched = extracted.fields.filter((f) => f.value && !f.value.startsWith("(")).length;
      const avgConfidence = Math.round(
        extracted.fields.reduce((s, f) => s + f.confidence, 0) / Math.max(1, extracted.fields.length)
      );
      docs.push(extracted);
      items.push({
        name,
        sizeBytes: file.size,
        status: "read",
        reason: `Đã đọc ${paragraphs.length} đoạn · khớp ${matched}/${extracted.fields.length} trường.`,
        fieldCount: extracted.fields.length,
        avgConfidence,
      });
    } catch (err) {
      items.push({
        name,
        sizeBytes: file.size,
        status: "error",
        reason: err instanceof Error ? err.message : "Lỗi đọc tệp.",
      });
    }
  }

  return { docs, items, truncatedCount };
}
