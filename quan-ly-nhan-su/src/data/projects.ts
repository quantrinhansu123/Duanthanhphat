export type Project = {
  id: string;
  name: string;
  manager: string;
  plant: string;
  staffCount: number;
  machineCount: number;
  status: "Đang triển khai" | "Hoàn thành" | "Tạm dừng";
  startDate: string;
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
  },
];
