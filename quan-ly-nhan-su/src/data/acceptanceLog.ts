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
  /** Đường dẫn ảnh trước khi sửa (trong /public); để trống nếu không có baseline UI trước thật. */
  before?: string;
  /** Ghi chú khi không có ảnh trước thật (không dựng giả). */
  beforeNote?: string;
  /** Đường dẫn ảnh sau khi sửa (trong /public). */
  after: string;
  /** Các phần đã thay đổi, vẽ khoanh đỏ lên ảnh sau. */
  marks: AcceptanceMark[];
};

export type AcceptanceRequirementRow = {
  /** Mã yêu cầu trong tài liệu (B-01..B-07, D-01..D-03). */
  id: string;
  /** Nội dung yêu cầu / tiêu chí nghiệm thu. */
  requirement: string;
  /** Trạng thái đạt / chưa đạt / chờ xác nhận. */
  status: AcceptanceResult;
  /** Nhãn chi tiết phân biệt: Đạt theo mã, Đạt UI/fixture, Chờ đối chiếu ảnh/PDF. */
  statusDetail?: string;
  /** Đường dẫn ảnh trước (hoặc ghi chú không có baseline ảnh trước thật). */
  beforeImage?: string;
  /** Nhãn hiển thị cho cột ảnh trước khi không có ảnh trước thật. */
  beforeImageNote?: string;
  /** Đường dẫn ảnh sau từ UI thật. */
  afterImage: string;
  /** Nhãn mô tả nguồn ảnh sau (ví dụ: Ảnh chụp UI thật). */
  afterImageLabel?: string;
  /** Đường dẫn file & dòng code liên quan. */
  codePath: string;
  /** Ghi chú đối chiếu & phần còn tồn. */
  note: string;
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
  /** Bảng nghiệm thu chi tiết theo từng ID yêu cầu (B-01..B-07, D-01..D-03). */
  requirementRows?: AcceptanceRequirementRow[];
};

/** Thêm bản ghi mới lên đầu mảng sau mỗi lần sửa được nghiệm thu. */
export const acceptanceLog: AcceptanceEntry[] = [
  {
    id: "2026-11-28-nhat-ky-thi-cong-phan-b",
    href: "/bien-ban-moi-han",
    date: "2026-11-28",
    item: "Nhật ký thi công / Phần B. Tình hình thi công hàng ngày (B-01..B-07, D-01..D-03)",
    requirement:
      "Đối chiếu và hoàn thiện mẫu B. TÌNH HÌNH THI CÔNG HÀNG NGÀY theo bảng yêu cầu docs/yeu-cau-bao-cao-thi-cong-theo-anh.md (B-01..B-07, D-01..D-03): tiêu đề & ngày 05/11, thời tiết Mưa 28.3°C (26/31/28°C), nhân lực 4/3/12, thiết bị 2.2 & vật tư, 12 mã mối hàn có FBW-0511260009, phân trang thiết bị dài (D-01) và đánh số trang liên tục khi in ghép (D-02).",
    solution:
      "Gộp mục 2.2 Thiết bị vào mảng chia dòng chung (useWrapped + Rows) cùng mục 3 để tự động ngắt qua trang giữa khi danh sách dài (D-01, B-07); bổ sung callback onPages(key, 2 + midCount) cộng dồn số trang thực tế khi in ghép nhiều ngày (D-02); thêm cảnh báo số mối chưa có mã hiện trường ở diaryWorkText (B-06).",
    before:
      "Không có ảnh chụp UI bản cũ trước khi sửa (Worker 3 xác nhận chưa chụp baseline UI trước thực tế; đã gỡ bỏ hoàn toàn các file HTML mô phỏng nktc-b06-d01-d02-before/after để không nhầm với ảnh UI thật). Theo mã baseline commit 89e5277: mục 2.2 dùng <Ruled> cố định ở trang 1 bên ngoài vùng chia trang (D-01); in ghép nhiều ngày dùng pageOf = printStart + index * 2 cố định 2 trang/ngày (D-02); mối hàn thiếu mã hiện trường bị bỏ lặng lẽ không báo số mối thiếu (B-06).",
    after:
      "Đạt trên UI thật / theo mã cho 8/10 ID (B-01, B-02, B-03, B-04 đạt trên UI thật & fixture ngày 05/11; B-06, B-07, D-01, D-02 đạt theo mã và kiểm tra khung xem trước A4 trên UI thật nhưng giữ trạng thái pending chờ kiểm thử xuất PDF thật / dữ liệu tràn nhiều trang thực tế và đối chiếu phần ảnh bị cắt). Riêng B-05 giữ nguyên hậu tố '1 bộ' cho các vật tư theo đúng ảnh người dùng & yêu cầu coordinator (pending chỉ do chưa đối chiếu đầy đủ mã/quy cách ở phần ảnh bị cắt và nguồn đơn vị); D-03 pending chờ xác nhận quy trình lối vào.",
    result: "pending",
    images: {
      beforeNote:
        "Không có ảnh chụp UI trước khi sửa: Worker 3 xác nhận chưa chụp baseline UI trước thực tế và không có file ảnh gốc trong repo. Không dùng HTML mô phỏng giải thích code làm ảnh chứng minh UI trước.",
      after: "/nghiem-thu/nktc-b01-b07-preview-after.png",
      marks: [
        { x: 18.0, y: 12.5, w: 63.0, h: 14.5, label: "B-01 & B-02 (Ảnh UI thật): Tiêu đề phần B, ngày 05/11 và thời tiết Mưa ☑, trung bình 28.3 °C (26/31/28°C)" },
        { x: 18.0, y: 27.5, w: 63.0, h: 46.5, label: "B-03, B-04, B-05 & D-01 (Ảnh UI thật): Nhân lực 4/3/12; mục 2.2 Thiết bị & Vật tư (giữ nguyên hậu tố '1 bộ' theo ảnh) đưa vào mảng chia dòng chung useWrapped + Rows" },
        { x: 18.0, y: 74.5, w: 63.0, h: 24.0, label: "B-06 & B-07 (Ảnh UI thật): Mục 3.1 hiển thị mã FBW-0511260009 (dải ..0020 là dữ liệu app/fixture, không chứng minh phần ảnh khuất)" },
      ],
    },
    requirementRows: [
      {
        id: "B-01",
        requirement: "Tiêu đề 'B. TÌNH HÌNH THI CÔNG HÀNG NGÀY' và ngày tương ứng (05 tháng 11; năm lấy từ ngày chọn).",
        status: "pass",
        statusDetail: "Đạt (UI thật / fixture)",
        beforeImageNote: "Không có ảnh UI trước thật (baseline đã có sẵn)",
        afterImage: "/nghiem-thu/nktc-b01-b07-preview-after.png",
        afterImageLabel: "nktc-b01-b07-preview-after.png (Ảnh UI thật)",
        codePath: "src/components/ConstructionDiary.tsx:682,712-713",
        note: "Đạt trên ảnh chụp UI thật (khung xem trước ngày 05/11/2026). Năm 2026 lấy từ ngày đang chọn trong app, không tự suy ra từ ảnh mô tả.",
      },
      {
        id: "B-02",
        requirement: "Thời tiết Bình thường/Mưa/Nắng (chọn Mưa ☑); trung bình 26°C, 31°C, 28°C ra 28.3 °C; in đủ chi tiết Sáng/Chiều/Tối.",
        status: "pass",
        statusDetail: "Đạt (UI thật / fixture)",
        beforeImageNote: "Không có ảnh UI trước thật (baseline đã có sẵn)",
        afterImage: "/nghiem-thu/nktc-b01-b07-preview-after.png",
        afterImageLabel: "nktc-b01-b07-preview-after.png (Ảnh UI thật)",
        codePath: "src/components/ConstructionDiary.tsx:38-47,716-722; src/lib/constructionDiaryDb.ts:33-38",
        note: "Đạt trên ảnh chụp UI thật: hiển thị Mưa ☑, Nhiệt độ 28.3 °C, Sáng Nhiều mây 26°C, Chiều Mưa 31°C, Tối Nhiều mây 28°C.",
      },
      {
        id: "B-03",
        requirement: "Ba trường nhân lực mặc định 4 / 3 / 12 người (Ban chỉ huy 4, Cán bộ kỹ thuật 3, Công nhân 12), sửa được và phản ánh lên bản in mục 2.1.",
        status: "pass",
        statusDetail: "Đạt (UI thật / fixture)",
        beforeImageNote: "Không có ảnh UI trước thật (baseline đã có sẵn)",
        afterImage: "/nghiem-thu/nktc-b01-b06-form-after.png",
        afterImageLabel: "nktc-b01-b06-form-after.png (Ảnh UI thật)",
        codePath: "src/lib/constructionDiaryAuto.ts:126-133; src/lib/constructionDiaryDb.ts:30; src/components/ConstructionDiary.tsx:480-483,725-726",
        note: "Đạt trên ảnh chụp UI thật (form và bản xem trước A4): 3 trường nhân lực 4 / 3 / 12 khớp mẫu và sửa được.",
      },
      {
        id: "B-04",
        requirement: "Mục 2.2 thể hiện 'Máy hàn chảy giáp mép di động UN5-150ZC2-C6: 1 bộ' (nhóm 1) và danh sách máy/thiết bị khác ngăn bằng dấu chấm phẩy (nhóm 2).",
        status: "pass",
        statusDetail: "Đạt (UI thật / fixture)",
        beforeImageNote: "Không có ảnh UI trước thật (baseline đã có sẵn)",
        afterImage: "/nghiem-thu/nktc-b01-b07-preview-after.png",
        afterImageLabel: "nktc-b01-b07-preview-after.png (Ảnh UI thật)",
        codePath: "src/lib/constructionDiaryAuto.ts:20-27,180-191",
        note: "Đạt trên UI thật với dữ liệu hiện có: diaryMachineName chuẩn hóa tên máy UN5-150ZC2-C6: 1 bộ, nhóm 2 ghép '; '. Các dòng ngoài vùng ảnh thấy chỉ là dữ liệu app/fixture.",
      },
      {
        id: "B-05",
        requirement: "Vật tư thuộc nhóm 3 trong mục 2.2: hiển thị đá cắt/đá mài theo mã, quy cách, số lượng nhìn thấy (hậu tố '1 bộ' như ảnh).",
        status: "pending",
        statusDetail: "Đạt theo mã / Chờ đối chiếu ảnh",
        beforeImageNote: "Không có ảnh UI trước thật",
        afterImage: "/nghiem-thu/nktc-b01-b07-preview-after.png",
        afterImageLabel: "nktc-b01-b07-preview-after.png (Ảnh UI thật)",
        codePath: "src/lib/constructionDiaryAuto.ts:183-191",
        note: "Ảnh người dùng thấy các vật tư có hậu tố '1 bộ' và coordinator đã yêu cầu giữ nguyên (không bỏ 'bộ'). Giữ trạng thái pending chỉ vì chưa đối chiếu đầy đủ mã/quy cách ở phần ảnh bị cắt mép phải và nguồn đơn vị trong bảng bao_cao_ngay_thiet_bi.",
      },
      {
        id: "B-06",
        requirement: "Mục 3.1 Hàn chảy giáp mép tuyến hạ, khối lượng 12 mối hàn, danh sách có FBW-0511260009 và các ID nhìn thấy; cảnh báo nếu thiếu mã.",
        status: "pending",
        statusDetail: "Đạt theo mã & fixture / Chờ đối chiếu ảnh",
        beforeImageNote: "Không có ảnh UI trước thật",
        afterImage: "/nghiem-thu/nktc-b01-b07-preview-after.png",
        afterImageLabel: "nktc-b01-b07-preview-after.png (Ảnh UI thật)",
        codePath: "src/lib/constructionDiaryAuto.ts:76-108",
        note: "Đạt theo mã và dữ liệu app/fixture: hiển thị đúng chính tả FBW-0511260009 và bổ sung ghi chú '(còn N mối chưa có mã hiện trường)' khi thiếu mã. Lưu ý: ảnh mô tả bị cắt nên chỉ thấy FBW-0511260009 và một phần chuỗi; dải ..FBW-0511260020 trên UI là dữ liệu app/fixture, không dùng để chứng minh phần ảnh bị cắt.",
      },
      {
        id: "B-07",
        requirement: "Trang in A4 cố định (210×296mm), nội dung thiết bị, vật tư và mã mối đọc được, không chồng lấn hoặc bị cắt khi in.",
        status: "pending",
        statusDetail: "Đạt theo mã & xem trước UI / Chờ xuất PDF thật",
        beforeImageNote: "Không có ảnh UI trước thật",
        afterImage: "/nghiem-thu/nktc-b01-b07-preview-after.png",
        afterImageLabel: "nktc-b01-b07-preview-after.png (Ảnh UI thật)",
        codePath: "src/components/ConstructionDiary.tsx:60,660-762",
        note: "Đã kiểm tra trên khung xem trước UI thật (nktc-b01-b07-preview-after.png): 28 dòng mục 2.2 + 3.1 căn khớp dòng chấm 27px trên Trang 1. Giữ pending vì mới kiểm trên khung xem trước trình duyệt, chưa trích xuất file PDF in thực tế và chưa đối chiếu trực tiếp với file ảnh gốc.",
      },
      {
        id: "D-01",
        requirement: "Xử lý danh sách thiết bị (2.2) dài an toàn, tự động tiếp tục sang trang sau thay vì bị overflow:hidden cắt mất.",
        status: "pending",
        statusDetail: "Đạt theo mã (code review) / Chờ test UI danh sách tràn trang",
        beforeImageNote: "Không có ảnh UI trước thật",
        afterImage: "/nghiem-thu/nktc-b01-b07-preview-after.png",
        afterImageLabel: "nktc-b01-b07-preview-after.png (Ảnh UI thật - ca 1 trang)",
        codePath: "src/components/ConstructionDiary.tsx:697-700,727-730,825",
        note: "Đạt theo mã (code review): Worker 3 đã đưa '2.2 Thiết bị:' và equipmentLines (đệm tối thiểu 5 dòng) vào mảng all chia dòng chung với mục 3 qua cap[0], midCount và cap[1]. Giữ pending vì trên UI mới chụp ca ngày 05/11 (vừa trong 1 trang), chưa chạy test UI/PDF với dữ liệu thiết bị dài vượt 1 trang.",
      },
      {
        id: "D-02",
        requirement: "Đánh số trang liên tục theo số trang thực tế (2 + midCount) khi in ghép nhiều ngày.",
        status: "pending",
        statusDetail: "Đạt theo mã (code review) / Chờ test UI in ghép nhiều trang",
        beforeImageNote: "Không có ảnh UI trước thật",
        afterImage: "/nghiem-thu/nktc-b01-b07-preview-after.png",
        afterImageLabel: "nktc-b01-b07-preview-after.png (Ảnh UI thật - ca 1 ngày)",
        codePath: "src/components/ConstructionDiary.tsx:144-148,621,700-703",
        note: "Đạt theo mã (code review): DiaryPages báo onPages(pageKey, 2 + midCount) lên state pageCounts và pageOf(index) cộng dồn số trang thực tế. Giữ pending vì chưa chụp test UI/PDF ca in ghép 2 ngày có ngày đầu ≥ 3 trang (ngoài ra thông báo ở dòng 630 vẫn còn chữ 'theo ước lượng 2 trang/ngày').",
      },
      {
        id: "D-03",
        requirement: "Làm rõ lối vào và nhãn chức năng giữa Báo cáo ngày (/bc-bao-cao-ngay) và Nhật ký thi công phần B (/bien-ban-moi-han → Nhật ký dự án).",
        status: "pending",
        statusDetail: "Chờ xác nhận quy trình",
        beforeImageNote: "Không có ảnh UI trước thật (không sửa code)",
        afterImage: "/nghiem-thu/nktc-b01-b06-form-after.png",
        afterImageLabel: "nktc-b01-b06-form-after.png (Ảnh UI thật)",
        codePath: "src/components/AppShell.tsx:121,133; src/components/WeldAcceptanceReport.tsx:13-20",
        note: "Chờ xác nhận: Giữ nguyên hai luồng riêng theo plan mục 2 & 9.4 cho đến khi người dùng chốt quy trình lối vào.",
      },
    ],
  },
  {
    id: "2026-11-27-nguoi-ky-nghiem-thu",
    href: "/bien-ban-moi-han",
    date: "2026-11-27",
    item: "Nghiệm thu / Người ký BBNT, RFI và Thư báo",
    requirement:
      "Nguyễn Minh Đức ký BBNTCV, BBNT hoàn thành và BBNT-GTUS với chức vụ Cán bộ kỹ thuật. Nguyễn Tất Đạt ký RFI lẻ, RFI hàng loạt và đủ 5 mẫu Thư báo với chức vụ Chỉ huy trưởng.",
    solution:
      "Phân tách và cố định tên cùng chức vụ nhà thầu chính trên từng loại tài liệu, bỏ qua dữ liệu cũ in_ntc_ten/in_ntc_chuc_vu và localStorage ghi đè trên RFI, đồng thời khóa chỉnh sửa ô ký tương ứng.",
    before:
      "Dữ liệu cũ trong DB/localStorage có thể ghi đè người ký trên BBNTCV, BBNT hoàn thành và RFI lẻ/hàng loạt; BBNT-GTUS thiếu chức vụ Cán bộ kỹ thuật; cả 5 mẫu Thư báo mặc định in Nguyễn Minh Đức và cho phép sửa người ký.",
    after:
      "BBNTCV, BBNT hoàn thành và BBNT-GTUS cố định Nguyễn Minh Đức — Cán bộ kỹ thuật. RFI lẻ, RFI hàng loạt (kể cả phiếu có dữ liệu cũ) và đủ 5 mẫu Thư báo (Siêu âm, BT Phú Thành, LAS-XD845, Thép dẹt 50×5, Thép tròn) cố định Nguyễn Tất Đạt — Chỉ huy trưởng trên bản xem trước ký tay (không chèn ảnh chữ ký). Còn chờ đối chiếu ảnh chữ ký trong cấu hình.",
    result: "pending",
    images: {
      before: "/nghiem-thu/signer-separation-before.png",
      after: "/nghiem-thu/signer-separation-after.png",
      marks: [
        { x: 2.1, y: 15.0, w: 31.3, h: 32.2, label: "BBNTCV cố định Nguyễn Minh Đức — Cán bộ kỹ thuật" },
        { x: 34.4, y: 15.0, w: 31.3, h: 32.2, label: "BBNT hoàn thành cố định Nguyễn Minh Đức — Cán bộ kỹ thuật" },
        { x: 66.7, y: 15.0, w: 31.3, h: 32.2, label: "BBNT-GTUS hiển thị Nguyễn Minh Đức và chức vụ Cán bộ kỹ thuật" },
        { x: 2.1, y: 52.4, w: 42.2, h: 40.0, label: "RFI lẻ & hàng loạt (kể cả dữ liệu cũ) cố định Nguyễn Tất Đạt — Chỉ huy trưởng" },
        { x: 45.2, y: 52.4, w: 52.7, h: 40.0, label: "Đủ 5 mẫu Thư báo cố định Nguyễn Tất Đạt — Chỉ huy trưởng" },
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
    images: {
      before: "/nghiem-thu/bbntcv-before.png",
      after: "/nghiem-thu/bbntcv-after.png",
      marks: [
        { x: 40.6, y: 42.8, w: 18.8, h: 5.0, label: "Số BBNTCV đổi sang 020-FBW/BBNTCV theo số PYC" },
        { x: 43.8, y: 48.2, w: 12.4, h: 4.7, label: "PYC số: 020-SA đối chiếu nguồn số" },
      ],
    },
  },
];
