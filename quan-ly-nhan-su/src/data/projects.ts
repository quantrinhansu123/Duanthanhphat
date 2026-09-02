import type { ProjectPersonnel } from "./projectPersonnel";
import type { ProjectWeld } from "./projectWelds";

export type TheoreticalProgressRow = {
  ngay: string;
  so_moi_han: number;
};

export type Project = {
  id: string;
  name: string;
  manager: string;
  plant: string;
  staffCount: number;
  machineCount: number;
  status: "Đang triển khai" | "Hoàn thành" | "Tạm dừng";
  startDate: string;
  personnelIds: string[];
  machineTypes: string[];
  weldTypes: string[];
  /** Tiến độ lý thuyết theo ngày — lưu JSONB trên Supabase (du_an.tien_do_ly_thuyet). */
  theoreticalProgress?: TheoreticalProgressRow[];
  /** Nhân sự gán cho dự án (tab con). */
  projectPersonnel?: ProjectPersonnel[];
  /** Mối hàn / công việc trong dự án (tab con). */
  projectWelds?: ProjectWeld[];
  maDuAn?: string;
};

export const projects: Project[] = [
  {
    id: "1",
    name: "ĐSCT Bắc – Nam",
    manager: "Nguyễn Văn Minh",
    plant: "Nhà máy Hà Nội",
    staffCount: 48,
    machineCount: 6,
    status: "Đang triển khai",
    startDate: "2024-01-15",
    personnelIds: [],
    machineTypes: [],
    weldTypes: [],
  },
  {
    id: "2",
    name: "Dự án ga Đà Nẵng",
    manager: "Trần Thị Mai Anh",
    plant: "Nhà máy Đà Nẵng",
    staffCount: 32,
    machineCount: 4,
    status: "Đang triển khai",
    startDate: "2024-02-01",
    personnelIds: [],
    machineTypes: [],
    weldTypes: [],
  },
  {
    id: "3",
    name: "Dự án đường sắt Bắc Nam",
    manager: "Phạm Văn B",
    plant: "Nhà máy Hà Nội",
    staffCount: 56,
    machineCount: 8,
    status: "Đang triển khai",
    startDate: "2023-11-20",
    personnelIds: [],
    machineTypes: [],
    weldTypes: [],
  },
  {
    id: "4",
    name: "Khu vực depot Hà Nội",
    manager: "Lê Thị Kim Anh",
    plant: "Nhà máy Hà Nội",
    staffCount: 24,
    machineCount: 3,
    status: "Đang triển khai",
    startDate: "2024-03-10",
    personnelIds: [],
    machineTypes: [],
    weldTypes: [],
  },
  {
    id: "5",
    name: "Tuyến metro số 1",
    manager: "Trần Quốc Bảo",
    plant: "Nhà máy TP.HCM",
    staffCount: 40,
    machineCount: 5,
    status: "Tạm dừng",
    startDate: "2023-09-05",
    personnelIds: [],
    machineTypes: [],
    weldTypes: [],
  },
];
