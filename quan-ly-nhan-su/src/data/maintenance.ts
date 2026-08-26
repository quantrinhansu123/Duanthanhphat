export type MaintenanceAssignee = {
  name: string;
  photo: string;
};

export type MaintenanceEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMin: number;
  title: string;
  machine: string;
  type: "Bảo dưỡng" | "Sửa chữa" | "Kiểm định" | "Thay phụ tùng";
  status: "Đã xong" | "Đang làm" | "Chờ xác nhận";
  assignees: MaintenanceAssignee[];
};

export const maintenanceEvents: MaintenanceEvent[] = [
  {
    id: "1",
    date: "2026-08-05",
    time: "08:00",
    durationMin: 120,
    title: "Bảo dưỡng định kỳ 500h",
    machine: "K920-01",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: [
      { name: "Phạm Văn Minh", photo: "https://randomuser.me/api/portraits/men/52.jpg" },
      { name: "Nguyễn Văn Hùng", photo: "https://randomuser.me/api/portraits/men/36.jpg" },
    ],
  },
  {
    id: "2",
    date: "2026-08-12",
    time: "09:30",
    durationMin: 90,
    title: "Thay đầu hàn / khuôn",
    machine: "AMS60-03",
    type: "Thay phụ tùng",
    status: "Đã xong",
    assignees: [{ name: "Trần Quốc Bảo", photo: "https://randomuser.me/api/portraits/men/22.jpg" }],
  },
  {
    id: "3",
    date: "2026-08-18",
    time: "07:30",
    durationMin: 180,
    title: "Sửa hệ thống thủy lực",
    machine: "K355-02",
    type: "Sửa chữa",
    status: "Đã xong",
    assignees: [
      { name: "Nguyễn Văn Hùng", photo: "https://randomuser.me/api/portraits/men/36.jpg" },
      { name: "Lê Thị Kim Anh", photo: "https://randomuser.me/api/portraits/women/65.jpg" },
    ],
  },
  {
    id: "3b",
    date: "2026-08-18",
    time: "13:00",
    durationMin: 60,
    title: "Kiểm tra sau sửa chữa",
    machine: "K355-02",
    type: "Kiểm định",
    status: "Chờ xác nhận",
    assignees: [{ name: "Đỗ Thị Lan", photo: "https://randomuser.me/api/portraits/women/48.jpg" }],
  },
  {
    id: "4",
    date: "2026-08-22",
    time: "10:00",
    durationMin: 60,
    title: "Kiểm định an toàn điện",
    machine: "GEO-01",
    type: "Kiểm định",
    status: "Chờ xác nhận",
    assignees: [{ name: "Lê Thị Kim Anh", photo: "https://randomuser.me/api/portraits/women/65.jpg" }],
  },
  {
    id: "5",
    date: "2026-08-27",
    time: "07:00",
    durationMin: 150,
    title: "Bảo dưỡng toàn máy",
    machine: "K920-02",
    type: "Bảo dưỡng",
    status: "Đã xong",
    assignees: [
      { name: "Phạm Văn Minh", photo: "https://randomuser.me/api/portraits/men/52.jpg" },
      { name: "Trần Quốc Bảo", photo: "https://randomuser.me/api/portraits/men/22.jpg" },
    ],
  },
  {
    id: "6",
    date: "2026-08-27",
    time: "09:30",
    durationMin: 75,
    title: "Thay phụ tùng khay hàn",
    machine: "AMS60-01",
    type: "Thay phụ tùng",
    status: "Đang làm",
    assignees: [{ name: "Trần Quốc Bảo", photo: "https://randomuser.me/api/portraits/men/22.jpg" }],
  },
  {
    id: "6b",
    date: "2026-08-27",
    time: "14:00",
    durationMin: 45,
    title: "Kiểm tra chạy thử sau bảo trì",
    machine: "K920-02",
    type: "Kiểm định",
    status: "Chờ xác nhận",
    assignees: [
      { name: "Nguyễn Văn Hùng", photo: "https://randomuser.me/api/portraits/men/36.jpg" },
      { name: "Đỗ Thị Lan", photo: "https://randomuser.me/api/portraits/women/48.jpg" },
    ],
  },
  {
    id: "6c",
    date: "2026-08-27",
    time: "16:15",
    durationMin: 30,
    title: "Bàn giao ca & ghi nhật ký",
    machine: "AMS60-01",
    type: "Bảo dưỡng",
    status: "Chờ xác nhận",
    assignees: [{ name: "Đỗ Thị Lan", photo: "https://randomuser.me/api/portraits/women/48.jpg" }],
  },
  {
    id: "7",
    date: "2026-08-30",
    time: "08:30",
    durationMin: 60,
    title: "Kiểm tra sau bảo trì",
    machine: "K355-02",
    type: "Kiểm định",
    status: "Chờ xác nhận",
    assignees: [{ name: "Lê Thị Kim Anh", photo: "https://randomuser.me/api/portraits/women/65.jpg" }],
  },
  {
    id: "8",
    date: "2026-09-03",
    time: "08:00",
    durationMin: 120,
    title: "Bảo dưỡng đầu tháng",
    machine: "K920-01",
    type: "Bảo dưỡng",
    status: "Chờ xác nhận",
    assignees: [
      { name: "Phạm Văn Minh", photo: "https://randomuser.me/api/portraits/men/52.jpg" },
      { name: "Nguyễn Văn Hùng", photo: "https://randomuser.me/api/portraits/men/36.jpg" },
    ],
  },
];
