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
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    status: "Đã bàn giao",
  },
  {
    id: "2",
    category: "UAT – Đào tạo & chứng chỉ",
    content: "Kiểm thử khóa đào tạo, quản lý chứng chỉ, tra cứu lịch sử",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
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
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
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
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
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
];
