export type ErrorSeverity = "Nghiêm trọng" | "Trung bình" | "Nhẹ";
export type ErrorCategory = "Máy móc" | "Vận hành" | "An toàn" | "Mối hàn";

export type ErrorItem = {
  id: string;
  code: string;
  name: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  description: string;
  solution: string;
  image: string;
  occurrenceCount: number;
  active?: boolean;
};

// Danh sách mã lỗi cũ đã bị gạch trong ảnh 5 không còn được dùng.
export const errorLibrary: ErrorItem[] = [];

export type FaultCase = {
  probableCause: string;
  remedy: string;
};

export type MachineFaultSection = "Tổng thể" | "Cẩu" | "Bơm" | "Máy hàn";

export type MachineFault = {
  id: string;
  section: MachineFaultSection;
  order: number;
  symptom: string;
  cases: FaultCase[];
  sourceReference: string;
  active: boolean;
};

export const machineFaultSections: MachineFaultSection[] = ["Tổng thể", "Cẩu", "Bơm", "Máy hàn"];

// Chép đúng 28 hiện tượng sự cố trong các bảng ở ảnh 6–10. Không tự thêm mã,
// mức độ, nguyên nhân hoặc biện pháp ngoài tài liệu nguồn.
export const machineFaultLibrary: MachineFault[] = [
  {
    id: "mf-tt-01",
    section: "Tổng thể",
    order: 1,
    symptom: "Dầu thủy lực chảy từ máy bơm khẩn cấp",
    cases: [
      { probableCause: "Hỏng phớt tuyến", remedy: "Thay phớt tuyến" },
      { probableCause: "Hỏng gioăng", remedy: "Thay gioăng" },
    ],
    sourceReference: "Bảng 1: Tổng thể",
    active: true,
  },
  {
    id: "mf-tt-02",
    section: "Tổng thể",
    order: 2,
    symptom: "Máy bơm khẩn cấp không hoạt động",
    cases: [
      { probableCause: "Đứt dây", remedy: "Thay dây" },
      { probableCause: "Ắc-quy của DGU hết điện", remedy: "Sạc ắc-quy" },
    ],
    sourceReference: "Bảng 1: Tổng thể",
    active: true,
  },
  {
    id: "mf-tt-03",
    section: "Tổng thể",
    order: 3,
    symptom: "Hơi nước đọng trên đường ống làm mát",
    cases: [{
      probableCause: "Nhiệt độ làm mát quá thấp do ảnh hưởng của môi trường",
      remedy: "Tăng nhiệt độ trên bộ làm mát chất làm mát",
    }],
    sourceReference: "Bảng 1: Tổng thể",
    active: true,
  },
  {
    id: "mf-tt-04",
    section: "Tổng thể",
    order: 4,
    symptom: "Động cơ làm mát dầu thủy lực rung lắc mạnh và có tiếng ồn lớn",
    cases: [{
      probableCause: "Kiểm tra chiều quay của động cơ điện",
      remedy: "Thay đổi chiều quay của động cơ điện",
    }],
    sourceReference: "Bảng 1: Tổng thể",
    active: true,
  },
  {
    id: "mf-tt-05",
    section: "Tổng thể",
    order: 5,
    symptom: "Xuất hiện các giọt dầu thủy lực hoặc chất lỏng được làm mát trong các mối nối ren của đường ống",
    cases: [{ probableCause: "Đai ốc bị lỏng", remedy: "Siết lại đai ốc" }],
    sourceReference: "Bảng 1: Tổng thể",
    active: true,
  },
  {
    id: "mf-tt-06",
    section: "Tổng thể",
    order: 6,
    symptom: "Đèn chiếu sáng bên trong hoặc bên ngoài của tổ hợp không sáng",
    cases: [
      { probableCause: "Đứt dây", remedy: "Thay dây" },
      { probableCause: "Ắc-quy của DGU hết điện", remedy: "Sạc ắc-quy" },
    ],
    sourceReference: "Bảng 1: Tổng thể",
    active: true,
  },
  {
    id: "mf-cau-01",
    section: "Cẩu",
    order: 1,
    symptom: "Việc hạ và nâng dầm, mở phần kéo dài, xoay bộ điều khiển cần cẩu diễn ra với tốc độ và cử không đều.",
    cases: [{
      probableCause: "Có không khí trong hệ thống thủy lực. Một dấu hiệu là sự dao động áp suất trong hệ thống thủy lực khi không tiêu thụ dầu.",
      remedy: "Xả khí ra khỏi hệ thống thủy lực bằng cách đặt mức áp suất thấp trên áp kế của trạm bơm đến 10 MPa (100 kgf/cm2), thực hiện 5 lần nâng và hạ phần nâng dầm, sau đó lặp lại các thao tác này với phần dầm mở rộng được nối bởi một dầm khác. Thực hiện hoạt động này không cần tải.",
    }],
    sourceReference: "Bảng 2: Cẩu",
    active: true,
  },
  {
    id: "mf-cau-02",
    section: "Cẩu",
    order: 2,
    symptom: "Nâng hạ dầm phần nâng dầm và phần kéo dài dầm không đều khi được nối bằng thanh sắt.",
    cases: [{
      probableCause: "Tốc độ dòng chảy của dầu thủy lực không được điều chỉnh.",
      remedy: "Điều chỉnh tốc độ dòng chảy bằng các van điều khiển.",
    }],
    sourceReference: "Bảng 2: Cẩu",
    active: true,
  },
  {
    id: "mf-cau-03",
    section: "Cẩu",
    order: 3,
    symptom: "Việc hạ thấp dầm hoặc tải trọng của cần cẩu một cách tự phát chậm.",
    cases: [
      {
        probableCause: "Gioăng hoặc vòng đệm trong xi lanh dầm và xi lanh nâng bị hỏng.",
        remedy: "Thay thế gioăng, vòng đệm bị hư hỏng.",
      },
      {
        probableCause: "Tắc nghẽn van kiểm soát dòng chảy.",
        remedy: "Rửa sạch van kiểm soát dòng chảy.",
      },
    ],
    sourceReference: "Bảng 2: Cẩu",
    active: true,
  },
  {
    id: "mf-cau-04",
    section: "Cẩu",
    order: 4,
    symptom: "Nam châm điện của van phân phối thủy lực không hoạt động.",
    cases: [
      { probableCause: "Nam châm bị đứt mạch điện.", remedy: "Xử lý gián đoạn." },
      { probableCause: "Nam châm điện bị hỏng.", remedy: "Thay thế nam châm điện." },
    ],
    sourceReference: "Bảng 2: Cẩu",
    active: true,
  },
  {
    id: "mf-cau-05",
    section: "Cẩu",
    order: 5,
    symptom: "Rò rỉ dầu trong xi lanh thủy lực.",
    cases: [{
      probableCause: "Gioăng và vòng đệm bị hỏng.",
      remedy: "Thay thế gioăng và vòng đệm bị hỏng.",
    }],
    sourceReference: "Bảng 2: Cẩu",
    active: true,
  },
  {
    id: "mf-bom3-01",
    section: "Bơm",
    order: 1,
    symptom: "Bọt dầu thoát ra khỏi bề mặt tiếp xúc giữa nắp và động cơ điện",
    cases: [
      {
        probableCause: "Chất lỏng vận hành đi vào khớp nối qua khớp nối của bơm với nắp",
        remedy: "Kiểm tra miếng đệm giữa nắp ổ đĩa và máy bơm, thay thế nếu cần thiết",
      },
      {
        probableCause: "Chất lỏng vận hành đi vào nắp thông qua phốt trục bơm",
        remedy: "Xử lý sự cố theo hướng dẫn vận hành của máy bơm⁶",
      },
    ],
    sourceReference: "Bảng 3: Bơm",
    active: true,
  },
  {
    id: "mf-bom3-02",
    section: "Bơm",
    order: 2,
    symptom: "Trạm bơm không cung cấp áp suất cao",
    cases: [{ probableCause: "Lỗi bơm", remedy: "Xử lý sự cố theo hướng dẫn vận hành của máy bơm" }],
    sourceReference: "Bảng 3: Bơm",
    active: true,
  },
  {
    id: "mf-bom3-03",
    section: "Bơm",
    order: 3,
    symptom: "Nam châm điện của nhà phân phối không hoạt động",
    cases: [
      { probableCause: "Sự gián đoạn mạch điện của nam châm điện", remedy: "Loại bỏ sự gián đoạn" },
      { probableCause: "Nam châm điện bị lỗi", remedy: "Thay thế nam châm điện" },
    ],
    sourceReference: "Bảng 3: Bơm",
    active: true,
  },
  {
    id: "mf-bom3-04",
    section: "Bơm",
    order: 4,
    symptom: "Máy bơm không cung cấp dầu thủy lực",
    cases: [
      { probableCause: "Hướng quay trục bơm bị sai", remedy: "Thay đổi chiều quay của động cơ điện" },
      { probableCause: "Mức chất lỏng vận hành trong bể không đủ", remedy: "Rót thêm chất lỏng vận hành" },
      { probableCause: "Rò rỉ không khí", remedy: "Xử lý rò rỉ không khí" },
      { probableCause: "Chất lỏng có độ nhớt quá mức", remedy: "Thay thế chất lỏng vận hành" },
    ],
    sourceReference: "Bảng 3: Bơm",
    active: true,
  },
  {
    id: "mf-bom3-05",
    section: "Bơm",
    order: 5,
    symptom: "Xuất hiện nước trong chất lỏng vận hành",
    cases: [{
      probableCause: "Rò rỉ trong hệ thống làm mát",
      remedy: "Siết chặt các đai ốc cuộn dây, kiểm tra cuộn dây với áp suất 0,5MPa (≈ 5 kgf/cm2). Thay dầu thủy lực",
    }],
    sourceReference: "Bảng 3: Bơm",
    active: true,
  },
  {
    id: "mf-bom4-01",
    section: "Bơm",
    order: 1,
    symptom: "Rò rỉ chất lỏng vận hành trong các khớp nối của mạch thủy lực và thiết bị thủy lực",
    cases: [{ probableCause: "Các mối nối không kín khít", remedy: "Siết chặt các đai ốc" }],
    sourceReference: "Bảng 4: Bơm",
    active: true,
  },
  {
    id: "mf-bom4-02",
    section: "Bơm",
    order: 2,
    symptom: "Tiếng ồn gia tăng trong quá trình vận hành máy bơm",
    cases: [
      {
        probableCause: "Đường ống hút bị xâm thực (các khoang máy bơm không dầu)",
        remedy: "Kiểm tra ống hút bị tắc nghẽn (có vật lạ) của ống hút và rửa sạch",
      },
      {
        probableCause: "Kiểm tra xem các trục bơm có bị lệch (gãy) và kiểm tra động cơ truyền động",
        remedy: "Giảm tốc độ động cơ truyền động (khi tăng tốc độ quay)",
      },
      {
        probableCause: "Kiểm tra xem các trục bơm có bị lệch (gãy) và kiểm tra động cơ truyền động",
        remedy: "Kiểm tra và căn chỉnh lệch trục không quá 0,2 mm và góc gãy các trục không quá 30′",
      },
    ],
    sourceReference: "Bảng 4: Bơm",
    active: true,
  },
  {
    id: "mf-bom4-03",
    section: "Bơm",
    order: 3,
    symptom: "Máy bơm hút không khí, có tiếng ồn và rung khi máy bơm đang chạy",
    cases: [
      { probableCause: "Mức chất lỏng vận hành trong đường hút thấp", remedy: "Đổ đầy lượng chất lỏng vận hành cần thiết" },
      { probableCause: "Rò rỉ ở các khớp nối trên ống hút", remedy: "Kiểm tra đường hút, siết chặt tất cả các mối nối, khớp nối" },
      { probableCause: "Gioăng trục bơm bị hỏng", remedy: "Thay thế gioăng" },
      {
        probableCause: "Tạo bọt khí trong thùng dầu",
        remedy: "Loại bỏ nguồn tạo bọt hoặc thay thế dầu bằng loại dầu khác có phụ gia chống tạo bọt. Nhúng ống rút hoặc đường ống vào dầu",
      },
    ],
    sourceReference: "Bảng 4: Bơm",
    active: true,
  },
  {
    id: "mf-bom4-04",
    section: "Bơm",
    order: 4,
    symptom: "Máy bơm phát triển không đủ áp suất",
    cases: [{
      probableCause: "Tắc nghẽn van an toàn khiến van an toàn không thể đóng hoàn toàn",
      remedy: "Súc rửa van an toàn",
    }],
    sourceReference: "Bảng 4: Bơm",
    active: true,
  },
  {
    id: "mf-mh-01",
    section: "Máy hàn",
    order: 1,
    symptom: "Phần má hàn⁷ di động di chuyển với tốc độ không đều và bị giật cục",
    cases: [{
      probableCause: "Có bọt khí trong hệ thống thủy lực. Dấu hiệu có thể nhận biết là sự thay đổi áp suất trong hệ thống thủy lực mặc dù không có dầu",
      remedy: "Đặt áp suất trong hệ thống thủy lực thành 1,5...1,0MPa, nới lỏng đai ốc nắp vặn của các ống nối với các khoang bên trái của xi lanh trong vài lượt. Xả dầu cho đến khi nó ngừng xủi bọt.",
    }],
    sourceReference: "Bảng 5: Máy hàn",
    active: true,
  },
  {
    id: "mf-mh-02",
    section: "Máy hàn",
    order: 2,
    symptom: "Khi bật công tắc SA7 phần má hàn di động di chuyển với những cú giật theo chu kỳ theo một trình tự nhất định.",
    cases: [
      {
        probableCause: "Sự mất căn chỉnh của các thanh ép của máy hàn do việc kẹp các ray có độ dày khác nhau hoặc có các dấu ấn (vết lồi) nổi lên;",
        remedy: "Thay thế ray, loại bỏ các vết lồi hoặc mác nhà sản xuất trên bụng ray",
      },
      {
        probableCause: "Các đế và bàn hạn vị⁸ không thẳng, dẫn đến sự mất căn chỉnh của các phần đoạn trong quá trình kẹp.",
        remedy: "Căn chỉnh bàn đế và hạn vị bằng thước thẳng",
      },
    ],
    sourceReference: "Bảng 5: Máy hàn",
    active: true,
  },
  {
    id: "mf-mh-03",
    section: "Máy hàn",
    order: 3,
    symptom: "Khi nhả kẹp ray phần má hàn của máy không thể di chuyển tự động",
    cases: [{
      probableCause: "Công tắc giới hạn SQ4 bị lỗi hoặc có sự cố đứt mạch trong các mạch của nó.",
      remedy: "Kiểm tra các mạch điện của công tắc giới hạn SQ4 và khắc phục sự cố; thay thế công tắc giới hạn nếu cần.",
    }],
    sourceReference: "Bảng 5: Máy hàn",
    active: true,
  },
  {
    id: "mf-mh-04",
    section: "Máy hàn",
    order: 4,
    symptom: "Hàn xung không ổn định trong quá trình hàn.",
    cases: [
      { probableCause: "Độ nhạy cao trong mạch điều chỉnh tốc độ;", remedy: "Giảm độ nhạy bằng cách điều chỉnh các dòng điện I1, I2, I3;" },
      { probableCause: "Điện trở ngắn mạch quá mức;", remedy: "Làm sạch tất cả các bề mặt tiếp xúc của mạch phụ của máy hàn;" },
      { probableCause: "Tiếp xúc kém với ray.", remedy: "Làm sạch ray." },
    ],
    sourceReference: "Bảng 5: Máy hàn",
    active: true,
  },
  {
    id: "mf-mh-05",
    section: "Máy hàn",
    order: 5,
    symptom: "Tắt bơm dầu trong quá trình vận hành",
    cases: [{
      probableCause: "Khởi động lại động cơ điện của bộ truyền động bơm dầu, điều này dẫn đến việc kích hoạt rơle nhiệt của bộ khởi động từ.",
      remedy: "Kiểm tra nhiệt độ của động cơ bơm dầu và dòng điện trong mạch của nó. Loại bỏ nguyên nhân quá tải.",
    }],
    sourceReference: "Bảng 5: Máy hàn",
    active: true,
  },
  {
    id: "mf-mh-06",
    section: "Máy hàn",
    order: 6,
    symptom: "Thời gian tiếp xúc với ray quá lâu (làm nóng do điện trở).",
    cases: [
      { probableCause: "Độ nhạy thấp trong mạch điều chỉnh;", remedy: "Tăng độ nhạy bằng cách điều chỉnh các dòng điện I1, I2, I3;" },
      { probableCause: "Thời gian tiếp xúc lâu có thể do điện trở ngắn mạch tăng của máy hàn.", remedy: "Làm sạch các tiếp điểm đóng-mở trong mạch của máy hàn." },
    ],
    sourceReference: "Bảng 5: Máy hàn",
    active: true,
  },
  {
    id: "mf-mh-07",
    section: "Máy hàn",
    order: 7,
    symptom: "Giá trị ép nhỏ hơn giá trị cài đặt.",
    cases: [
      {
        probableCause: "Áp suất dầu trong hệ thống thủy lực thấp hơn giá trị cài đặt, gây trượt ray trong quá trình ép do lực kẹp không đủ;",
        remedy: "Kiểm tra áp suất dầu trong hệ thống thủy lực;",
      },
      { probableCause: "Đơn vị đo không được điều chỉnh.", remedy: "Cài đặt đơn vị đo đến giá trị mong muốn." },
    ],
    sourceReference: "Bảng 5: Máy hàn",
    active: true,
  },
  {
    id: "mf-mh-08",
    section: "Máy hàn",
    order: 8,
    symptom: "Dòng không tải tăng đột ngột khi các máy biến áp hàn được bật.",
    cases: [
      {
        probableCause: "Kết nối sai (đảo ngược) các cuộn dây sơ cấp của các máy biến áp;",
        remedy: "Kiểm tra lại kết nối của các cuộn dây sơ cấp. Dấu hiệu của kết nối đúng là không có điện áp giữa các đế của cặp phân đoạn bên trái;",
      },
      {
        probableCause: "Hỏng cách điện giữa mạch phụ và thân máy.",
        remedy: "Tháo dỡ mạch phụ, khắc phục sự cố hỏng cách điện.",
      },
    ],
    sourceReference: "Bảng 5: Máy hàn",
    active: true,
  },
];

export type NdtDefectCode = "LOF" | "LOP" | "C" | "S" | "Po" | "La";

export type NdtDefect = {
  code: NdtDefectCode;
  nameEn: string;
};

// Ảnh 11 chỉ cung cấp mã và tên tiếng Anh; không suy diễn thêm bản dịch/mức độ.
export const NDT_DEFECTS: NdtDefect[] = [
  { code: "LOF", nameEn: "Lack of fusion" },
  { code: "LOP", nameEn: "Lack of Penetration" },
  { code: "C", nameEn: "Crack" },
  { code: "S", nameEn: "Slag" },
  { code: "Po", nameEn: "Porosity" },
  { code: "La", nameEn: "Lamination" },
];

export function findNdtDefect(code: string): NdtDefect | undefined {
  return NDT_DEFECTS.find((item) => item.code === code);
}
