export type MachineOperationImageAsset = {
  publicId: string;
  secureUrl: string;
  name: string;
  bytes?: number;
};

export const MACHINE_CONDITION_SUGGESTIONS = [
  "Bình thường",
  "Máy chảy dầu",
  "Máy hết ắc quy",
  "Cần bảo trì",
  "Máy hỏng",
] as const;

export type MachineRunSchedule = {
  id: string;
  createdAt?: string;
  date: string; // YYYY-MM-DD
  machineId: string;
  machineCode: string;
  machineName: string;
  location: string;
  operatingHours: number;
  projectId: string;
  projectName: string;
  personInChargeId: string;
  personInChargeName: string;
  fuelAddedLiters: number;
  pumpOpened: boolean;
  machineCondition: string;
  conditionDescription: string;
  recommendation: string;
  imageAssets: MachineOperationImageAsset[];
};

export type MachineOption = {
  id: string;
  code: string;
  name: string;
};

export type LookupOption = {
  id: string;
  label: string;
};

export const machineRunSchedules: MachineRunSchedule[] = [
  {
    id: "seed-1",
    date: "2026-08-25",
    machineId: "kcm007-01",
    machineCode: "KCM007-01",
    machineName: "Tổ hợp máy hàn KCM007 Rail Welding Complex",
    location: "Hà Nội",
    operatingHours: 8,
    projectId: "seed-project-1",
    projectName: "ĐSCT Bắc – Nam",
    personInChargeId: "seed-person-2",
    personInChargeName: "Phạm Văn Minh",
    fuelAddedLiters: 25,
    pumpOpened: true,
    machineCondition: "Bình thường",
    conditionDescription: "Máy vận hành ổn định, không phát hiện rò rỉ.",
    recommendation: "Tiếp tục theo dõi mức dầu đầu ca.",
    imageAssets: [],
  },
  {
    id: "seed-2",
    date: "2026-08-25",
    machineId: "un5-150zc2-01",
    machineCode: "UN5-150ZC2-01",
    machineName: "Máy hàn ray lưu động UN5-150ZC2-C6",
    location: "Đà Nẵng",
    operatingHours: 7.5,
    projectId: "seed-project-2",
    projectName: "Dự án ga Đà Nẵng",
    personInChargeId: "seed-person-3",
    personInChargeName: "Nguyễn Văn Hùng",
    fuelAddedLiters: 15,
    pumpOpened: true,
    machineCondition: "Máy chảy dầu",
    conditionDescription: "Có vệt dầu nhỏ tại đầu nối ống thủy lực.",
    recommendation: "Kiểm tra và siết lại đầu nối trước ca tiếp theo.",
    imageAssets: [],
  },
  {
    id: "seed-3",
    date: "2026-08-24",
    machineId: "kcm007-02",
    machineCode: "KCM007-02",
    machineName: "Tổ hợp máy hàn KCM007 Rail Welding Complex (Tổ 2)",
    location: "TP. Hồ Chí Minh",
    operatingHours: 6,
    projectId: "seed-project-5",
    projectName: "Tuyến metro số 1",
    personInChargeId: "seed-person-1",
    personInChargeName: "Lê Thị Kim Anh",
    fuelAddedLiters: 0,
    pumpOpened: false,
    machineCondition: "Máy hết ắc quy",
    conditionDescription: "Không khởi động được sau thời gian dừng dài.",
    recommendation: "Sạc và kiểm tra khả năng giữ điện của ắc quy.",
    imageAssets: [],
  },
  {
    id: "seed-4",
    date: "2026-08-24",
    machineId: "kcm007-01",
    machineCode: "KCM007-01",
    machineName: "Tổ hợp máy hàn KCM007 Rail Welding Complex",
    location: "Hà Nội",
    operatingHours: 8.5,
    projectId: "seed-project-1",
    projectName: "ĐSCT Bắc – Nam",
    personInChargeId: "seed-person-4",
    personInChargeName: "Trần Quốc Bảo",
    fuelAddedLiters: 20,
    pumpOpened: true,
    machineCondition: "Bình thường",
    conditionDescription: "Không ghi nhận bất thường.",
    recommendation: "",
    imageAssets: [],
  },
  {
    id: "seed-5",
    date: "2026-08-23",
    machineId: "un5-150zc2-02",
    machineCode: "UN5-150ZC2-02",
    machineName: "Máy hàn tiếp xúc đối đầu UN5-150ZC2-C6",
    location: "Hà Nội",
    operatingHours: 6.5,
    projectId: "seed-project-4",
    projectName: "Khu vực depot Hà Nội",
    personInChargeId: "seed-person-2",
    personInChargeName: "Phạm Văn Minh",
    fuelAddedLiters: 10,
    pumpOpened: true,
    machineCondition: "Cần bảo trì",
    conditionDescription: "Tiếng bơm lớn hơn bình thường khi tăng tải.",
    recommendation: "Đề nghị kiểm tra bơm và lọc dầu.",
    imageAssets: [],
  },
  {
    id: "seed-6",
    date: "2026-08-22",
    machineId: "un5-150zc2-01",
    machineCode: "UN5-150ZC2-01",
    machineName: "Máy hàn ray lưu động UN5-150ZC2-C6",
    location: "Hà Nội",
    operatingHours: 5,
    projectId: "seed-project-1",
    projectName: "ĐSCT Bắc – Nam",
    personInChargeId: "seed-person-4",
    personInChargeName: "Trần Quốc Bảo",
    fuelAddedLiters: 0,
    pumpOpened: true,
    machineCondition: "Bình thường",
    conditionDescription: "Máy vận hành bình thường.",
    recommendation: "",
    imageAssets: [],
  },
];

export function formatScheduleDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("vi-VN");
}

export function formatOperatingHours(hours: number) {
  return `${hours.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} giờ`;
}
