export type AcceptanceResult = "pass" | "fail" | "pending";

/** Vùng khoanh đỏ trên ảnh "sau", tính theo % kích thước ảnh. */
export type AcceptanceMark = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

export type AcceptanceImages = {
  /** Đường dẫn ảnh trước khi sửa (trong /public). */
  before: string;
  /** Đường dẫn ảnh sau khi sửa (trong /public). */
  after: string;
  /** Các phần đã thay đổi, vẽ khoanh đỏ lên ảnh sau. */
  marks: AcceptanceMark[];
};

export type AcceptanceEntry = {
  id: string;
  /** Ngày nghiệm thu, YYYY-MM-DD. */
  date: string;
  /** Hạng mục thay đổi. */
  item: string;
  /** Yêu cầu ban đầu. */
  requirement: string;
  /** Phương án xử lý. */
  solution: string;
  /** Hiện trạng trước khi sửa. */
  before: string;
  /** Kết quả sau khi sửa. */
  after: string;
  result: AcceptanceResult;
  /** Trang đích trong app để mở khi bấm vào dòng. */
  href: string;
  /** Ảnh trước/sau; bỏ trống nếu bản ghi chưa có ảnh. */
  images?: AcceptanceImages;
};

/** Thêm bản ghi mới lên đầu mảng sau mỗi lần sửa được nghiệm thu. */
export const acceptanceLog: AcceptanceEntry[] = [
  {
    id: "2026-11-27-nguoi-ky-nghiem-thu",
    href: "/bien-ban-moi-han",
    date: "2026-11-27",
    item: "Nghiệm thu / Người ký BBNT, RFI và Thư báo",
    requirement:
      "Nguyễn Minh Đức ký BBNT với chức vụ Cán bộ kỹ thuật. Nguyễn Tất Đạt ký RFI và Thư báo với chức vụ Chỉ huy trưởng.",
    solution:
      "Cố định tên và chức vụ tại ô ký của từng loại tài liệu. Kiểm tra bản in lẻ, bản in hàng loạt và các mẫu Thư báo tại trang Biên bản mối hàn.",
    before:
      "Tên và chức vụ đã lưu có thể ghi đè trên RFI. Thư báo cho phép đổi người ký khi xem trước. BBNT hoàn thành có thể để trống tên nhà thầu chính.",
    after:
      "BBNT in Nguyễn Minh Đức — Cán bộ kỹ thuật. RFI và Thư báo in Nguyễn Tất Đạt — Chỉ huy trưởng. Đã chụp bản demo ký tay. Còn chờ đối chiếu ảnh chữ ký trong cấu hình.",
    result: "pending",
    images: {
      before: "/nghiem-thu/signer-before.png",
      after: "/nghiem-thu/signer-after.png",
      marks: [
        { x: 5.3, y: 25.8, w: 52, h: 9.1, label: "BBNTCV in Nguyễn Minh Đức — Cán bộ kỹ thuật" },
        { x: 24.8, y: 56.3, w: 48, h: 5.4, label: "RFI in Nguyễn Tất Đạt — Chỉ huy trưởng" },
        { x: 38.8, y: 78.5, w: 20, h: 10.5, label: "Thư báo in Nguyễn Tất Đạt — Chỉ huy trưởng" },
      ],
    },
  },
  {
    id: "2026-11-27-dau-dong-co",
    href: "/phan-cong-may",
    date: "2026-11-27",
    item: "Máy / Dầu động cơ",
    requirement:
      "Cảnh báo đỏ khi đạt 656 mối. Đổ dầu khi đạt ~275 giờ. Đổ xong thì loại bỏ cảnh báo.",
    solution:
      "Tính số mối hàn và giờ chạy phát sinh sau lần đổ dầu động cơ gần nhất. Chỉ hiện cảnh báo khi máy chạm ngưỡng quy định.",
    before: "Chưa có cảnh báo dầu động cơ theo quy tắc này.",
    after:
      "Tính từ sau lần đổ dầu động cơ gần nhất, cảnh báo đỏ khi đạt ít nhất 656 mối hoặc 275 giờ, cảnh báo vàng khi đạt ít nhất 600 mối hoặc 250 giờ mà chưa chạm ngưỡng đỏ.",
    result: "pass",
    images: {
      before: "/nghiem-thu/before.png",
      after: "/nghiem-thu/after.png",
      marks: [
        { x: 24.22, y: 55.75, w: 50.97, h: 3.22, label: "Tiêu đề cảnh báo" },
        { x: 24.22, y: 58.19, w: 50.97, h: 2.83, label: "Quy tắc 250h / 275h / 656 mối" },
        { x: 22.83, y: 63.58, w: 25.53, h: 9.11, label: "Máy KCM-01 chạm mốc đỏ và thanh tiến độ" },
        { x: 48.2, y: 65.64, w: 10.6, h: 5, label: "Nút Đổ dầu động cơ cho KCM-01" },
        { x: 60.23, y: 63.58, w: 25.53, h: 9.11, label: "Máy KCM-02 sắp đến hạn và thanh tiến độ" },
        { x: 85.59, y: 65.64, w: 10.6, h: 5, label: "Nút Đổ dầu động cơ cho KCM-02" },
        { x: 26.86, y: 95.83, w: 9.26, h: 3.06, label: "Nhãn ĐỔ DẦU ĐC trên dòng lịch" },
      ],
    },
  },
  {
    id: "2026-11-27-bbntcv-so-pyc",
    href: "/bien-ban-moi-han",
    date: "2026-11-27",
    item: "Nghiệm thu / Biên bản BBNTCV",
    requirement: "Đánh số biên bản nghiệm thu công việc theo số PYC.",
    solution: "Xem tại tờ (2) BBNTCV trong \"In biên bản\" của tab Nghiệm thu Hình Học/Siêu âm trên /bien-ban-moi-han.",
    before: "Số BBNTCV tự đánh số tăng dần theo lần in (dạng FBW/23/BBNTCV), không liên quan đến số PYC của phiếu.",
    after: "Số BBNTCV lấy từ số PYC, đệm 3 chữ số, kèm công nghệ hàn (PYC 020-SA ra 020-FBW/BBNTCV). Số cũ dạng FBW/23/BBNTCV tự đổi sang kiểu mới; số gõ tay khác vẫn giữ; không có số PYC thì dùng lại số tăng dần.",
    result: "pass",
  },
];
