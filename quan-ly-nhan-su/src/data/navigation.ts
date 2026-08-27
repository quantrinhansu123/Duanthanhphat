export type NavChild = {
  id: string;
  label: string;
  description?: string;
};

export type NavItem = {
  id: string;
  code: string;
  label: string;
  labelEn: string;
  children: NavChild[];
};

export const navigation: NavItem[] = [
  {
    id: "nhan-su",
    code: "09",
    label: "Quản lý nhân sự / thợ hàn",
    labelEn: "Human Resources",
    children: [
      {
        id: "ho-so-nhan-su",
        label: "Hồ sơ nhân sự",
        description: "Mã NV, họ tên, chức vụ, đơn vị, kinh nghiệm, dự án tham gia",
      },
      {
        id: "ho-so-tho-han",
        label: "Hồ sơ thợ hàn",
        description: "Welding ID, hạng, loại ray được phép hàn, máy đã đào tạo, kinh nghiệm",
      },
      {
        id: "lich-su-han",
        label: "Lịch sử hàn theo thợ",
        description: "Lịch sử hàn theo từng thợ, tổng số thợ phục vụ thống kê",
      },
    ],
  },
  {
    id: "dao-tao",
    code: "10",
    label: "Đào tạo & chứng chỉ",
    labelEn: "Training & Certificates",
    children: [
      {
        id: "khoa-dao-tao",
        label: "Danh sách khóa đào tạo",
        description: "Ngày đào tạo, nội dung, người đào tạo, học viên, kết quả",
      },
      {
        id: "chung-chi",
        label: "Quản lý chứng chỉ",
        description: "Ngày cấp, ngày hết hạn, file đính kèm chứng chỉ",
      },
      {
        id: "tra-cuu-dao-tao",
        label: "Tra cứu lịch sử đào tạo",
        description: "Tra cứu lịch sử đào tạo theo nhân sự / thợ hàn",
      },
    ],
  },
  {
    id: "may-moc",
    code: "11",
    label: "Quản lý máy móc",
    labelEn: "Machine Management",
    children: [
      {
        id: "danh-sach-may",
        label: "Danh sách máy hàn",
        description: "Mã máy, model, nhà máy, trạng thái, khả dụng, số mối hàn",
      },
      {
        id: "quan-ly-khay-han",
        label: "Quản lý khay hàn",
        description: "Danh mục khay hàn, tình trạng, vị trí, máy gắn kèm",
      },
      {
        id: "lich-bao-tri",
        label: "Lịch bảo trì",
        description: "Kế hoạch bảo dưỡng, lịch sử sửa chữa, phụ tùng thay thế",
      },
      {
        id: "thu-vien-loi",
        label: "Thư viện lỗi",
        description: "Danh mục mã lỗi máy móc, mối hàn, cách xử lý và mức độ nghiêm trọng",
      },
      {
        id: "phan-cong-may",
        label: "Phân công máy",
        description: "Gán máy theo nhà máy, tổ đội, ca làm việc, thợ vận hành",
      },
    ],
  },
  {
    id: "du-an",
    code: "12",
    label: "Quản lý dự án",
    labelEn: "Project Management",
    children: [
      {
        id: "quan-ly-du-an",
        label: "Danh sách dự án",
        description: "Danh sách dự án, người phụ trách, nhân sự và máy gắn với từng dự án",
      },
    ],
  },
  {
    id: "ky-thuat",
    code: "13",
    label: "Quản lý kỹ thuật",
    labelEn: "Technical Management",
    children: [
      {
        id: "quan-ly-moi-han",
        label: "Quản lý mối hàn",
        description: "Danh sách mối hàn theo khay hàn và chứng chỉ liên quan",
      },
    ],
  },
  {
    id: "bao-cao",
    code: "15",
    label: "Báo cáo & thống kê",
    labelEn: "Reports & Statistics",
    children: [
      {
        id: "bc-tong-quan",
        label: "Tổng quan",
        description: "Tổng mối hàn, hôm nay, tháng này, tỷ lệ đạt, máy & thợ đang hoạt động",
      },
      {
        id: "bc-chat-luong",
        label: "Báo cáo chất lượng",
        description: "Tổng mối hàn, Đạt, Không đạt, Sửa chữa, Hàn lại, tỷ lệ đạt, phân loại lỗi",
      },
      {
        id: "bc-may-moc",
        label: "Báo cáo máy móc",
        description: "Giờ vận hành, số mối hàn/máy, thời gian dừng, bảo trì",
      },
      {
        id: "bc-nhan-su",
        label: "Báo cáo nhân sự",
        description: "Năng suất theo thợ, theo tổ đội, lịch sử dự án, trạng thái chứng chỉ",
      },
    ],
  },
  {
    id: "du-lieu-lich-su",
    code: "16",
    label: "Dữ liệu lịch sử",
    labelEn: "Historical Data / Data Import",
    children: [
      {
        id: "nhap-hang-loat",
        label: "Nhập hàng loạt",
        description: "Nhập số lượng lớn theo mẫu và cấu trúc thống nhất",
      },
    ],
  },
  {
    id: "quan-tri",
    code: "24",
    label: "Quản trị hệ thống",
    labelEn: "System Administration",
    children: [
      {
        id: "cau-hinh",
        label: "Cấu hình hệ thống",
        description: "Danh mục dùng chung, cấu hình hệ thống, tài khoản khởi tạo",
      },
      {
        id: "trien-khai",
        label: "Triển khai & bàn giao",
        description: "UAT, triển khai server, hướng dẫn sử dụng, bàn giao phiên bản 1.0",
      },
    ],
  },
];

export const DEFAULT_TAB = "ho-so-nhan-su";

export function allTabIds() {
  return navigation.flatMap((g) => g.children.map((c) => c.id));
}

export function isValidTab(id: string) {
  return allTabIds().includes(id);
}

export function findNavMeta(activeId?: string) {
  if (!activeId) return null;
  for (const group of navigation) {
    const child = group.children.find((c) => c.id === activeId);
    if (child) {
      return {
        parent: group.label,
        parentEn: group.labelEn,
        code: group.code,
        title: child.label,
        description: child.description ?? "",
      };
    }
  }
  return null;
}
