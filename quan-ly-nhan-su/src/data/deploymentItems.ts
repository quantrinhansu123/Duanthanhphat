export type DeploymentStatus = "Đã bàn giao" | "Chưa bàn giao";

export type DeploymentItem = {
  id: string;
  category: string;
  content: string;
  videoUrl: string;
  status: DeploymentStatus;
};

export const deploymentItems: DeploymentItem[] = [
  {
    id: "1",
    category: "UAT – Quản lý nhân sự",
    content: "Kiểm thử hồ sơ nhân sự, thợ hàn, lọc và tìm kiếm",
    videoUrl: "",
    status: "Đã bàn giao",
  },
  {
    id: "2",
    category: "UAT – Đào tạo & chứng chỉ",
    content: "Kiểm thử khóa đào tạo, quản lý chứng chỉ, tra cứu lịch sử",
    videoUrl: "",
    status: "Đã bàn giao",
  },
  {
    id: "3",
    category: "UAT – Quản lý máy móc",
    content: "Kiểm thử danh sách máy, khay hàn, lịch bảo trì, phân công máy",
    videoUrl: "",
    status: "Chưa bàn giao",
  },
  {
    id: "4",
    category: "UAT – Báo cáo & thống kê",
    content: "Kiểm thử báo cáo tổng quan, sản lượng, chất lượng, máy móc, nhân sự",
    videoUrl: "",
    status: "Chưa bàn giao",
  },
  {
    id: "5",
    category: "Triển khai server",
    content: "Cài đặt Next.js, Supabase, cấu hình domain và SSL production",
    videoUrl: "",
    status: "Chưa bàn giao",
  },
  {
    id: "6",
    category: "Hướng dẫn sử dụng – Admin",
    content: "Video hướng dẫn quản trị hệ thống, phân quyền, cấu hình danh mục",
    videoUrl: "",
    status: "Đã bàn giao",
  },
  {
    id: "7",
    category: "Hướng dẫn sử dụng – Thợ hàn",
    content: "Video hướng dẫn tra cứu lịch sử hàn, chứng chỉ và phân công ca",
    videoUrl: "",
    status: "Chưa bàn giao",
  },
  {
    id: "8",
    category: "Bàn giao phiên bản 1.0",
    content: "Biên bản nghiệm thu, tài liệu kỹ thuật và bàn giao source code",
    videoUrl: "",
    status: "Chưa bàn giao",
  },
  {
    id: "9",
    category: "UAT – Quản lý hàn ray LWR",
    content: "Kiểm thử sơ đồ ray hàn dài, giải tỏa ứng suất và công thức TB10015",
    videoUrl: "",
    status: "Đã bàn giao",
  },
  {
    id: "10",
    category: "UAT – Quản lý chất lượng & NDT",
    content: "Kiểm thử biên bản nghiệm thu BBNTCV, phát phiếu RFI và thư viện lỗi",
    videoUrl: "",
    status: "Đã bàn giao",
  },
  {
    id: "11",
    category: "UAT – Quản lý dự án & Tọa độ",
    content: "Kiểm thử chuỗi đứt lý trình, tọa độ mối hàn tuyến thượng/tuyến hạ",
    videoUrl: "",
    status: "Chưa bàn giao",
  },
  {
    id: "12",
    category: "Hướng dẫn sử dụng – Giám sát",
    content: "Tài liệu hướng dẫn nghiệm thu mối hàn và ký duyệt biên bản",
    videoUrl: "",
    status: "Chưa bàn giao",
  },
];
