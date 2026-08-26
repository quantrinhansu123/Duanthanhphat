export type Machine = {
  id: string;
  code: string;
  name: string;
  model: string;
  plant: string;
  status: "Hoạt động" | "Bảo trì" | "Ngừng" | "Hỏng";
  available: boolean;
  weldCount: number;
  image: string;
  serialNumber: string;
  yearInstalled: number;
  operator: string;
  team: string;
  lastMaintenance: string;
  nextMaintenance: string;
  operatingHours: number;
  errorRate: string;
  note: string;
};

const machineImages: Record<string, string> = {
  K920:
    "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=480&h=270&q=80",
  AMS60:
    "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=480&h=270&q=80",
  K355:
    "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=480&h=270&q=80",
  "GEO Pro":
    "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=480&h=270&q=80",
};

function imageForModel(model: string) {
  return machineImages[model] ?? machineImages.K920;
}

export const machines: Machine[] = [
  {
    id: "1",
    code: "K920-01",
    name: "Máy hàn aluminothermic K920",
    model: "K920",
    plant: "Nhà máy Hà Nội",
    status: "Hoạt động",
    available: true,
    weldCount: 1842,
    image: imageForModel("K920"),
    serialNumber: "SN-K920-2019-0041",
    yearInstalled: 2019,
    operator: "Phạm Văn Minh",
    team: "Tổ 1 – Hà Nội",
    lastMaintenance: "15/03/2026",
    nextMaintenance: "15/06/2026",
    operatingHours: 4280,
    errorRate: "0,18%",
    note: "Máy chính tuyến Cổ Loa, hoạt động 2 ca/ngày.",
  },
  {
    id: "2",
    code: "AMS60-03",
    name: "Máy hàn đường ray AMS60",
    model: "AMS60",
    plant: "Nhà máy Đà Nẵng",
    status: "Hoạt động",
    available: true,
    weldCount: 1560,
    image: imageForModel("AMS60"),
    serialNumber: "SN-AMS60-2020-0018",
    yearInstalled: 2020,
    operator: "Nguyễn Văn Minh",
    team: "Tổ 2 – Đà Nẵng",
    lastMaintenance: "02/03/2026",
    nextMaintenance: "02/05/2026",
    operatingHours: 3910,
    errorRate: "0,25%",
    note: "Đang phục vụ dự án ga Đà Nẵng.",
  },
  {
    id: "3",
    code: "K355-02",
    name: "Máy hàn di động K355",
    model: "K355",
    plant: "Nhà máy Hà Nội",
    status: "Bảo trì",
    available: false,
    weldCount: 980,
    image: imageForModel("K355"),
    serialNumber: "SN-K355-2018-0007",
    yearInstalled: 2018,
    operator: "Trần Văn C",
    team: "Tổ 1 – Hà Nội",
    lastMaintenance: "20/03/2026",
    nextMaintenance: "—",
    operatingHours: 2650,
    errorRate: "0,31%",
    note: "Đang thay phớt thủy lực và kiểm tra cảm biến nhiệt.",
  },
  {
    id: "4",
    code: "GEO-01",
    name: "Máy định vị & hàn GEO",
    model: "GEO Pro",
    plant: "Nhà máy TP.HCM",
    status: "Hoạt động",
    available: true,
    weldCount: 720,
    image: imageForModel("GEO Pro"),
    serialNumber: "SN-GEO-2021-0003",
    yearInstalled: 2021,
    operator: "Lê Thị Kim Anh",
    team: "Tổ 4 – TP.HCM",
    lastMaintenance: "10/02/2026",
    nextMaintenance: "10/05/2026",
    operatingHours: 1880,
    errorRate: "0,12%",
    note: "Máy định vị tích hợp, dùng cho ray cong và ga.",
  },
  {
    id: "5",
    code: "K920-02",
    name: "Máy hàn aluminothermic K920 (dự phòng)",
    model: "K920",
    plant: "Nhà máy Đà Nẵng",
    status: "Ngừng",
    available: false,
    weldCount: 430,
    image: imageForModel("K920"),
    serialNumber: "SN-K920-2019-0042",
    yearInstalled: 2019,
    operator: "—",
    team: "Tổ 2 – Đà Nẵng",
    lastMaintenance: "05/01/2026",
    nextMaintenance: "Chờ kích hoạt",
    operatingHours: 980,
    errorRate: "—",
    note: "Máy dự phòng, tạm ngừng chờ phân công ca.",
  },
  {
    id: "6",
    code: "AMS60-01",
    name: "Máy hàn đường ray AMS60 – tổ 1",
    model: "AMS60",
    plant: "Nhà máy Hà Nội",
    status: "Hỏng",
    available: false,
    weldCount: 2105,
    image: imageForModel("AMS60"),
    serialNumber: "SN-AMS60-2017-0011",
    yearInstalled: 2017,
    operator: "Đỗ Thị Lan",
    team: "Tổ 1 – Hà Nội",
    lastMaintenance: "18/03/2026",
    nextMaintenance: "Chờ linh kiện",
    operatingHours: 5120,
    errorRate: "1,2%",
    note: "Lỗi van an toàn khí, chờ thay thế từ nhà cung cấp.",
  },
];
