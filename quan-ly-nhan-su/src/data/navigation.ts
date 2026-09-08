export type NavChild = {
  id: string;
  label: string;
  labelEn: string;
  description?: string;
  descriptionEn?: string;
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
    label: "Quản lý thợ hàn",
    labelEn: "Welder Management",
    children: [
      {
        id: "ho-so-tho-han",
        label: "Hồ sơ thợ hàn",
        labelEn: "Welder Profiles",
        description: "Welding ID, tổ hàn, hạng, loại ray được phép hàn, máy đã đào tạo, kinh nghiệm",
        descriptionEn: "Welding ID, team, rank, approved rail types, trained machines, experience",
      },
      {
        id: "lich-su-han",
        label: "Lịch sử hàn theo thợ",
        labelEn: "Welding History by Welder",
        description: "Lịch sử hàn theo từng thợ, tổng số thợ phục vụ thống kê",
        descriptionEn: "Welding history per welder, total welders for analytics and reporting",
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
        labelEn: "Training Courses",
        description: "Ngày đào tạo, nội dung, người đào tạo, học viên, kết quả",
        descriptionEn: "Training date, curriculum, trainer, attendees, evaluation results",
      },
      {
        id: "chung-chi",
        label: "Quản lý chứng chỉ",
        labelEn: "Certificate Management",
        description: "Ngày cấp, ngày hết hạn, file đính kèm chứng chỉ theo thợ hàn",
        descriptionEn: "Issue date, expiry date, and attached certificate files by welder",
      },
      {
        id: "tra-cuu-dao-tao",
        label: "Tra cứu lịch sử đào tạo",
        labelEn: "Training History Lookup",
        description: "Tra cứu khóa học, giờ đào tạo và chứng chỉ theo nhân sự",
        descriptionEn: "Look up training and competency qualification records by welder",
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
        labelEn: "Welding Machines",
        description: "Mã máy, model, vị trí hiện tại, trạng thái và số mối hàn",
        descriptionEn: "Machine code, model, current location, operating status, and weld count",
      },
      {
        id: "lich-bao-tri",
        label: "Lịch bảo trì",
        labelEn: "Maintenance Schedule",
        description: "Kế hoạch bảo dưỡng, lịch sử sửa chữa, phụ tùng thay thế",
        descriptionEn: "Preventive maintenance plan, repair history, and spare parts",
      },
      {
        id: "thu-vien-loi",
        label: "Thư viện lỗi máy",
        labelEn: "Machine Fault Library",
        description: "Danh mục mã lỗi máy móc, vận hành, an toàn — cách xử lý và mức độ nghiêm trọng",
        descriptionEn: "Catalogue of equipment faults: overall, crane, hydraulic pump, and welding unit",
      },
      {
        id: "phan-cong-may",
        label: "Lịch chạy máy",
        labelEn: "Machine Run Schedule",
        description: "Ngày, máy, lý trình, số giờ hoạt động, dự án và người phụ trách",
        descriptionEn: "Date, machine, chainage, running hours, project, and engineer in charge",
      },
    ],
  },
  {
    id: "moi-han",
    code: "14",
    label: "Quản lý mối hàn",
    labelEn: "Weld Management",
    children: [
      {
        id: "quan-ly-moi-han",
        label: "Quản lý mối hàn",
        labelEn: "Weld Joint Management",
        description: "Danh sách mối hàn theo ray hàn và chứng chỉ liên quan",
        descriptionEn: "List of welds categorized by rail section and corresponding qualifications",
      },
      {
        id: "thu-vien-loi-moi-han",
        label: "Thư viện lỗi mối hàn",
        labelEn: "Weld Defect Library",
        description: "Danh mục mã lỗi mối hàn, cách xử lý và mức độ nghiêm trọng",
        descriptionEn: "Catalogue of weld defects, non-destructive testing (NDT), and rectification",
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
        labelEn: "Project List",
        description: "Danh sách dự án, người phụ trách, nhân sự và máy gắn với từng dự án",
        descriptionEn: "Projects, project directors, deployed personnel, and allocated machinery",
      },
    ],
  },
  {
    id: "ky-thuat",
    code: "13",
    label: "Quản lý chất lượng",
    labelEn: "Quality Management",
    children: [
      {
        id: "chung-chi-cong-ty",
        label: "Chứng chỉ quản lý chất lượng (ISO)",
        labelEn: "Quality Management Certificates (ISO)",
        description: "Chứng chỉ quản lý chất lượng (ISO) và hồ sơ của Công ty Thành Phát.",
        descriptionEn: "ISO quality management certificates and records of Thanh Phat Company.",
      },
      {
        id: "tieu-chuan-tcvn",
        label: "Yêu cầu về quản lý chất lượng",
        labelEn: "Quality Management Requirements",
        description: "Yêu cầu về quản lý chất lượng và minh chứng đáp ứng",
        descriptionEn: "Quality management requirements and verification evidence",
      },
      {
        id: "nhat-ky-han",
        label: "Nhật ký hàn",
        labelEn: "Welding Journal",
        description: "Theo dõi nhật ký hàn theo thời gian, nhân sự, vị trí GPS và tình trạng",
        descriptionEn: "Track daily weld records by timestamp, welder, GPS coordinates, and status",
      },
      {
        id: "bc-moi-han-theo-nam",
        label: "Báo cáo mối hàn theo năm",
        labelEn: "Yearly Weld Report",
        description: "Bảng tổng hợp mối hàn, đạt/lỗi, FBW/ATW và loại mối theo từng năm",
        descriptionEn: "Annual consolidated weld report, pass/defect stats, FBW/ATW methods",
      },
      {
        id: "ban-do",
        label: "Quản lý mối hàn theo GPS",
        labelEn: "Weld Map (GPS)",
        description: "Bản đồ đánh dấu mối hàn theo tọa độ GPS / lý trình Km",
        descriptionEn: "Interactive map marking weld locations by GPS coordinates and Km chainage",
      },
      {
        id: "tai-lieu",
        label: "Quản lý tài liệu",
        labelEn: "Document Library",
        description: "Tải lên, xem và tải về tài liệu PDF",
        descriptionEn: "Upload, preview, and download technical and operational PDF documents",
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
        labelEn: "Overview Dashboard",
        description: "Tổng mối hàn, hôm nay, tháng này, tỷ lệ đạt, máy & thợ đang hoạt động",
        descriptionEn: "Total welds, today, monthly output, pass rate, active machines and welders",
      },
      {
        id: "bc-chat-luong",
        label: "Báo cáo chất lượng",
        labelEn: "Quality Report",
        description: "Tổng mối hàn, Đạt, Không đạt, Sửa chữa, Hàn lại, tỷ lệ đạt, phân loại lỗi",
        descriptionEn: "Quality metrics: Pass, Fail, Rework, defect classification by NDT codes",
      },
      {
        id: "bc-may-moc",
        label: "Báo cáo máy móc",
        labelEn: "Machine Report",
        description: "Giờ vận hành, số mối hàn/máy, thời gian dừng, bảo trì",
        descriptionEn: "Operational hours, welds per machine, downtime analysis, maintenance logs",
      },
      {
        id: "bc-nhan-su",
        label: "Báo cáo nhân sự",
        labelEn: "Personnel Report",
        description: "Năng suất theo thợ, theo tổ đội, lịch sử dự án, trạng thái chứng chỉ",
        descriptionEn: "Productivity by welder and crew, project assignments, certificate validity",
      },
    ],
  },
  {
    id: "du-lieu-lich-su",
    code: "16",
    label: "Dữ liệu lịch sử",
    labelEn: "Historical Data",
    children: [
      {
        id: "nhap-hang-loat",
        label: "Nhập hàng loạt",
        labelEn: "Bulk Import",
        description: "Nhập số lượng lớn theo mẫu và cấu trúc thống nhất",
        descriptionEn: "Batch import bulk welding data from standardized Excel templates",
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
        labelEn: "System Configuration",
        description: "Danh mục dùng chung, cấu hình hệ thống, tài khoản khởi tạo",
        descriptionEn: "Master lookups, system parameters, and initial user account management",
      },
      {
        id: "trien-khai",
        label: "Triển khai & bàn giao",
        labelEn: "Deployment & Handover",
        description: "UAT, triển khai server, hướng dẫn sử dụng, bàn giao phiên bản 1.0",
        descriptionEn: "UAT criteria, server rollout, user manuals, and version 1.0 acceptance",
      },
    ],
  },
];

export const DEFAULT_TAB = "ho-so-tho-han";

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
        titleEn: child.labelEn,
        description: child.description ?? "",
        descriptionEn: child.descriptionEn ?? "",
      };
    }
  }
  return null;
}
