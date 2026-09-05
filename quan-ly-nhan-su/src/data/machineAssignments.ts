export type MachineRunSchedule = {
  id: string;
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
  },
];

export function formatScheduleDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("vi-VN");
}

export function formatOperatingHours(hours: number) {
  return `${hours.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} giờ`;
}
