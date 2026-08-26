export type DefectCategory = {
  name: string;
  count: number;
  color: string;
};

export type PlantQuality = {
  plant: string;
  passRate: number;
  total: number;
  failed: number;
};

export type WelderQuality = {
  name: string;
  weldingId: string;
  passRate: number;
  total: number;
  failed: number;
};

export type RecentDefect = {
  id: string;
  date: string;
  weldJoint: string;
  defectType: string;
  welder: string;
  plant: string;
  severity: "Cao" | "Trung bình" | "Thấp";
  status: "Chờ xử lý" | "Đang sửa" | "Đã đóng";
};

export const qualityKpis = {
  passed: 28210,
  failed: 76,
  passRate: 98.5,
  rework: 54,
  totalInspected: 28340,
  ndtPassed: 28185,
  visualFailed: 31,
  avgFixHours: 4.2,
  firstPassRate: 97.8,
  criticalDefects: 12,
  openCases: 18,
  closedThisMonth: 58,
};

export const inspectionBreakdown = [
  { label: "Đạt chuẩn", count: 28210, color: "#22a94f" },
  { label: "Không đạt", count: 76, color: "#ef4444" },
  { label: "Sửa / hàn lại", count: 54, color: "#f0b323" },
];

export const defectCategories: DefectCategory[] = [
  { name: "Lỗi bề mặt", count: 22, color: "#ef4444" },
  { name: "Nứt bề mặt", count: 18, color: "#dc2626" },
  { name: "Rỗ khí", count: 13, color: "#f59e0b" },
  { name: "Cháy cạnh", count: 9, color: "#3b82f6" },
  { name: "Biến dạng nhiệt", count: 8, color: "#6366f1" },
  { name: "Khác", count: 6, color: "#a855f7" },
];

export const weeklyTrend = [
  { week: "T1", rate: 97.8 },
  { week: "T2", rate: 98.1 },
  { week: "T3", rate: 98.4 },
  { week: "T4", rate: 97.9 },
  { week: "T5", rate: 98.6 },
  { week: "T6", rate: 98.3 },
  { week: "T7", rate: 98.5 },
  { week: "T8", rate: 98.7 },
];

export const plantQuality: PlantQuality[] = [
  { plant: "Nhà máy Hà Nội", passRate: 98.9, total: 12450, failed: 28 },
  { plant: "Nhà máy Đà Nẵng", passRate: 98.2, total: 8920, failed: 31 },
  { plant: "Nhà máy TP.HCM", passRate: 97.8, total: 6970, failed: 17 },
];

export const welderQuality: WelderQuality[] = [
  { name: "Lê Thị Kim Anh", weldingId: "WH001", passRate: 99.4, total: 842, failed: 5 },
  { name: "Phạm Văn Minh", weldingId: "WH002", passRate: 99.1, total: 1205, failed: 11 },
  { name: "Nguyễn Văn Hùng", weldingId: "WH003", passRate: 98.6, total: 980, failed: 14 },
  { name: "Trần Quốc Bảo", weldingId: "WH004", passRate: 97.9, total: 756, failed: 16 },
];

export const recentDefects: RecentDefect[] = [
  {
    id: "1",
    date: "12/03/2026",
    weldJoint: "MH-HN-2026-0312-01",
    defectType: "Nứt bề mặt",
    welder: "Trần Quốc Bảo",
    plant: "Nhà máy Hà Nội",
    severity: "Cao",
    status: "Đang sửa",
  },
  {
    id: "2",
    date: "11/03/2026",
    weldJoint: "MH-DN-2026-0311-04",
    defectType: "Rỗ khí",
    welder: "Nguyễn Văn Hùng",
    plant: "Nhà máy Đà Nẵng",
    severity: "Trung bình",
    status: "Chờ xử lý",
  },
  {
    id: "3",
    date: "11/03/2026",
    weldJoint: "MH-HCM-2026-0311-02",
    defectType: "Lỗi bề mặt",
    welder: "Phạm Văn Minh",
    plant: "Nhà máy TP.HCM",
    severity: "Thấp",
    status: "Đã đóng",
  },
  {
    id: "4",
    date: "10/03/2026",
    weldJoint: "MH-HN-2026-0310-07",
    defectType: "Cháy cạnh",
    welder: "Lê Thị Kim Anh",
    plant: "Nhà máy Hà Nội",
    severity: "Trung bình",
    status: "Đã đóng",
  },
  {
    id: "5",
    date: "09/03/2026",
    weldJoint: "MH-DN-2026-0309-05",
    defectType: "Biến dạng nhiệt",
    welder: "Trần Quốc Bảo",
    plant: "Nhà máy Đà Nẵng",
    severity: "Cao",
    status: "Chờ xử lý",
  },
];

export const railTypeQuality = [
  { type: "UIC60", passRate: 98.8, total: 15200 },
  { type: "P50", passRate: 98.1, total: 8420 },
  { type: "P43", passRate: 97.6, total: 4720 },
];
