export type WeldingTray = {
  id: string;
  code: string;
  name: string;
  machine: string;
  location: string;
  status: "Sẵn sàng" | "Đang dùng" | "Bảo trì" | "Hỏng";
  capacity: string;
  image: string;
  railTypes: string;
  lastMaintenance: string;
  nextMaintenance: string;
  note: string;
  assignedTo: string;
};

export const weldingTrays: WeldingTray[] = [
  {
    id: "1",
    code: "KH-001",
    name: "Khay hàn aluminothermic tiêu chuẩn",
    machine: "K920-01",
    location: "Kho NM Hà Nội – A1",
    status: "Đang dùng",
    capacity: "12 khuôn",
    railTypes: "UIC60",
    lastMaintenance: "05/08/2026",
    nextMaintenance: "05/11/2026",
    note: "Đang gắn trên hiện trường đoạn Hà Nội – Ninh Bình.",
    assignedTo: "Phạm Văn Minh",
    image:
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=480&h=270&q=80",
  },
  {
    id: "2",
    code: "KH-002",
    name: "Khay hàn UIC60 – bộ dự phòng",
    machine: "AMS60-03",
    location: "Kho NM Đà Nẵng – B2",
    status: "Sẵn sàng",
    capacity: "8 khuôn",
    railTypes: "UIC60, P50",
    lastMaintenance: "12/07/2026",
    nextMaintenance: "12/10/2026",
    note: "Khay dự phòng đã kiểm tra, sẵn sàng xuất kho.",
    assignedTo: "—",
    image:
      "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=480&h=270&q=80",
  },
  {
    id: "3",
    code: "KH-003",
    name: "Khay hàn P50 / P43 đa năng",
    machine: "K355-02",
    location: "Xe tổ 3 – hiện trường",
    status: "Bảo trì",
    capacity: "10 khuôn",
    railTypes: "P50, P43",
    lastMaintenance: "18/08/2026",
    nextMaintenance: "18/09/2026",
    note: "Đang thay gioăng chịu nhiệt và làm sạch khuôn.",
    assignedTo: "Trần Quốc Bảo",
    image:
      "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=480&h=270&q=80",
  },
  {
    id: "4",
    code: "KH-004",
    name: "Khay hàn di động công trường",
    machine: "GEO-01",
    location: "Kho NM TP.HCM – C1",
    status: "Sẵn sàng",
    capacity: "6 khuôn",
    railTypes: "UIC60",
    lastMaintenance: "01/08/2026",
    nextMaintenance: "01/11/2026",
    note: "Phù hợp công trình ngắn hạn, dễ vận chuyển.",
    assignedTo: "—",
    image:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=480&h=270&q=80",
  },
  {
    id: "5",
    code: "KH-005",
    name: "Khay hàn nhiệt luyện cao",
    machine: "K920-02",
    location: "Xưởng sửa chữa HN",
    status: "Hỏng",
    capacity: "12 khuôn",
    railTypes: "UIC60, P50",
    lastMaintenance: "20/06/2026",
    nextMaintenance: "Chưa xác định",
    note: "Nứt thân khay bên trái — chờ phụ tùng thay thế.",
    assignedTo: "Nguyễn Văn Hùng",
    image:
      "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=480&h=270&q=80",
  },
];
