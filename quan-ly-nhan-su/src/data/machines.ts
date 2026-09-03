export type MachineSpecs = {
  applicationWork?: string;
  emissionStandard?: string;
  axes?: number;
  clampingGradient?: string;
  speedRoad?: string;
  speedRail?: string;
  gauge?: string;
  weight?: string;
  dimensions?: string;
  upsettingForce?: string;
  clampingForce?: string;
  weldingStroke?: string;
  efficiency?: string;
};

export type Machine = {
  id: string;
  code: string;
  name: string;
  model: string;
  type: string;
  nameEn?: string;
  nameVi?: string;
  brand: string;
  manufacturer: string;
  plant: string;
  location: string;
  currentProject: string;
  status: "Đang làm việc" | "Sẵn sàng" | "Bảo trì" | "Hỏng";
  available: boolean;
  weldCount: number;
  image: string;
  gallery?: string[];
  serialNumber: string;
  yearInstalled: number;
  weldingTechnology: string;
  supportedRails: string;
  weldingCapacity: string;
  operator: string;
  personInCharge: string;
  team: string;
  lastMaintenance: string;
  nextMaintenance: string;
  operatingHours: number;
  errorRate: string;
  note: string;
  specs?: MachineSpecs;
};

export const MACHINE_MODELS = ["KCM-007 (K922-1)", "UN5-150ZC2-C6"] as const;

export const machineModelImages: Record<string, string> = {
  "KCM-007 (K922-1)": "/may-han/kcm007.jpg",
  KCM007: "/may-han/kcm007.jpg",
  "UN5-150ZC2-C6": "/may-han/un5-150zc2-c6-main.jpg",
};

export function imageForModel(model: string) {
  return machineModelImages[model] ?? "/may-han/kcm007.jpg";
}

export const machines: Machine[] = [
  {
    id: "1",
    code: "KCM007-01",
    name: "Tổ hợp máy hàn ray lưu động KCM-007 (K922-1)",
    model: "KCM-007 (K922-1)",
    type: "Tổ hợp máy hàn ray lưu động gắn trên xe tải (Road-Rail)",
    nameEn: "Rail Welding Complex / Rail Mobile Flash Butt Welding Machine",
    nameVi: "Tổ hợp máy hàn ray lưu động gắn trên xe tải",
    brand: "TCW",
    manufacturer: "Chengdu Aigre Technology / TCW",
    plant: "Trung tâm Cơ giới TCW",
    location: "Km 15+200 · Ga Hà Nội",
    currentProject: "Dự án ĐSCT Bắc – Nam",
    status: "Đang làm việc",
    available: false,
    weldCount: 2450,
    image: "/may-han/kcm007.jpg",
    gallery: ["/may-han/kcm007.jpg"],
    serialNumber: "Chờ cập nhật theo hồ sơ bàn giao thiết bị",
    yearInstalled: 2021,
    weldingTechnology: "Flash Butt Welding – FBW (Hàn tiếp xúc đối đầu)",
    supportedRails: "43 – 75 kg/m · Khổ ray 1.000 mm & 1.435 mm",
    weldingCapacity: "12 mối/giờ",
    operator: "Phạm Văn Minh",
    personInCharge: "Kỹ sư trưởng TCW",
    team: "Tổ hàn cơ giới 1",
    lastMaintenance: "15/02/2026",
    nextMaintenance: "15/05/2026",
    operatingHours: 3850,
    errorRate: "0,15%",
    note: "Thông số kỹ thuật chuẩn Catalogue chính thức (Trang 6-7). Các thông số vận hành (vị trí, dự án, giờ chạy) là số liệu theo dõi công trường.",
    specs: {
      applicationWork: "On rail / road / stationary",
      emissionStandard: "Euro V",
      axes: 4,
      clampingGradient: "3.5%",
      speedRoad: "80 km/h",
      speedRail: "25 km/h",
      gauge: "1.000 mm, 1.435 mm",
      weight: "35 tấn (ton)",
      dimensions: "10.000 × 3.200 × 2.500 mm",
      upsettingForce: "90 ~ 120 kN",
      clampingForce: "280 kN",
      weldingStroke: "100 – 120 mm",
      efficiency: "12 mối/giờ",
    },
  },
  {
    id: "2",
    code: "UN5-150ZC2-01",
    name: "Máy hàn tiếp xúc đối đầu ray lưu động UN5-150ZC2-C6",
    model: "UN5-150ZC2-C6",
    type: "Máy hàn tiếp xúc đối đầu ray lưu động (On rail / stationary)",
    nameEn: "Mobile Rail Flash Butt Welding Machine",
    nameVi: "Máy hàn tiếp xúc đối đầu ray lưu động",
    brand: "TCW",
    manufacturer: "Chengdu Aigre Technology",
    plant: "Nhà máy Hà Nội",
    location: "Km 0+500 · Depot ga Hà Nội",
    currentProject: "Tuyến đường sắt đô thị",
    status: "Sẵn sàng",
    available: true,
    weldCount: 1820,
    image: "/may-han/un5-150zc2-c6-main.jpg",
    gallery: [
      "/may-han/un5-150zc2-c6-main.jpg",
      "/may-han/un5-150zc2-c6-detail.jpg",
      "/may-han/un5-150zc2-c6-action.jpg",
    ],
    serialNumber: "Chờ cập nhật theo hồ sơ bàn giao thiết bị",
    yearInstalled: 2022,
    weldingTechnology: "Flash Butt Welding – FBW (Hàn tiếp xúc đối đầu)",
    supportedRails: "43 – 75 kg/m · Khổ ray 1.435 mm",
    weldingCapacity: "12 mối/giờ",
    operator: "Nguyễn Văn Hùng",
    personInCharge: "Kỹ sư TCW - Aigre",
    team: "Tổ hàn đường sắt 2",
    lastMaintenance: "20/02/2026",
    nextMaintenance: "20/05/2026",
    operatingHours: 2740,
    errorRate: "0,11%",
    note: "Thông số kỹ thuật chuẩn Catalogue chính thức (Trang 6-7). Các thông số vận hành (vị trí, dự án, giờ chạy) là số liệu theo dõi công trường.",
    specs: {
      applicationWork: "On rail / stationary",
      emissionStandard: "Euro V",
      axes: 4,
      clampingGradient: "5.0%",
      speedRoad: "— (Không tự hành đường bộ)",
      speedRail: "20 km/h",
      gauge: "1.435 mm",
      weight: "32 tấn (ton)",
      dimensions: "8.300 × 2.500 × 950 mm",
      upsettingForce: "90 ~ 120 kN",
      clampingForce: "280 kN",
      weldingStroke: "100 – 120 mm",
      efficiency: "12 mối/giờ",
    },
  },
  {
    id: "3",
    code: "KCM007-02",
    name: "Tổ hợp máy hàn ray lưu động KCM-007 (K922-1) (Tổ 2)",
    model: "KCM-007 (K922-1)",
    type: "Tổ hợp máy hàn ray lưu động gắn trên xe tải (Road-Rail)",
    nameEn: "Rail Welding Complex / Rail Mobile Flash Butt Welding Machine",
    nameVi: "Tổ hợp máy hàn ray lưu động gắn trên xe tải",
    brand: "TCW",
    manufacturer: "Chengdu Aigre Technology / TCW",
    plant: "Xưởng bảo trì Đà Nẵng",
    location: "Bãi máy ga Đà Nẵng",
    currentProject: "Dự án đường sắt Bắc – Nam",
    status: "Sẵn sàng",
    available: true,
    weldCount: 1210,
    image: "/may-han/kcm007.jpg",
    gallery: ["/may-han/kcm007.jpg"],
    serialNumber: "Chờ cập nhật theo hồ sơ bàn giao thiết bị",
    yearInstalled: 2021,
    weldingTechnology: "Flash Butt Welding – FBW (Hàn tiếp xúc đối đầu)",
    supportedRails: "43 – 75 kg/m · Khổ ray 1.000 mm & 1.435 mm",
    weldingCapacity: "12 mối/giờ",
    operator: "Trần Quốc Bảo",
    personInCharge: "Đội trưởng kỹ thuật máy",
    team: "Tổ hàn cơ giới 2",
    lastMaintenance: "02/03/2026",
    nextMaintenance: "02/06/2026",
    operatingHours: 1950,
    errorRate: "0,08%",
    note: "Thông số kỹ thuật chuẩn Catalogue chính thức (Trang 6-7). Các thông số vận hành (vị trí, dự án, giờ chạy) là số liệu theo dõi công trường.",
    specs: {
      applicationWork: "On rail / road / stationary",
      emissionStandard: "Euro V",
      axes: 4,
      clampingGradient: "3.5%",
      speedRoad: "80 km/h",
      speedRail: "25 km/h",
      gauge: "1.000 mm, 1.435 mm",
      weight: "35 tấn (ton)",
      dimensions: "10.000 × 3.200 × 2.500 mm",
      upsettingForce: "90 ~ 120 kN",
      clampingForce: "280 kN",
      weldingStroke: "100 – 120 mm",
      efficiency: "12 mối/giờ",
    },
  },
  {
    id: "4",
    code: "UN5-150ZC2-02",
    name: "Máy hàn tiếp xúc đối đầu ray lưu động UN5-150ZC2-C6 (Dự phòng)",
    model: "UN5-150ZC2-C6",
    type: "Máy hàn tiếp xúc đối đầu ray lưu động (On rail / stationary)",
    nameEn: "Mobile Rail Flash Butt Welding Machine",
    nameVi: "Máy hàn tiếp xúc đối đầu ray lưu động",
    brand: "TCW",
    manufacturer: "Chengdu Aigre Technology",
    plant: "Xưởng bảo trì Hà Nội",
    location: "Khu tập kết thiết bị ga Giáp Bát",
    currentProject: "Dự phòng khẩn cấp & bảo trì",
    status: "Bảo trì",
    available: false,
    weldCount: 940,
    image: "/may-han/un5-150zc2-c6-main.jpg",
    gallery: [
      "/may-han/un5-150zc2-c6-main.jpg",
      "/may-han/un5-150zc2-c6-detail.jpg",
      "/may-han/un5-150zc2-c6-action.jpg",
    ],
    serialNumber: "Chờ cập nhật theo hồ sơ bàn giao thiết bị",
    yearInstalled: 2022,
    weldingTechnology: "Flash Butt Welding – FBW (Hàn tiếp xúc đối đầu)",
    supportedRails: "43 – 75 kg/m · Khổ ray 1.435 mm",
    weldingCapacity: "12 mối/giờ",
    operator: "Vũ Đức Thắng",
    personInCharge: "Kỹ sư cơ điện TCW",
    team: "Tổ bảo trì & đại tu thiết bị",
    lastMaintenance: "10/01/2026",
    nextMaintenance: "10/04/2026",
    operatingHours: 1420,
    errorRate: "0,20%",
    note: "Thông số kỹ thuật chuẩn Catalogue chính thức (Trang 6-7). Đang trong kỳ kiểm định hệ thống kẹp thủy lực và mạch đo điện áp đối đầu.",
    specs: {
      applicationWork: "On rail / stationary",
      emissionStandard: "Euro V",
      axes: 4,
      clampingGradient: "5.0%",
      speedRoad: "— (Không tự hành đường bộ)",
      speedRail: "20 km/h",
      gauge: "1.435 mm",
      weight: "32 tấn (ton)",
      dimensions: "8.300 × 2.500 × 950 mm",
      upsettingForce: "90 ~ 120 kN",
      clampingForce: "280 kN",
      weldingStroke: "100 – 120 mm",
      efficiency: "12 mối/giờ",
    },
  },
];
