export type CatalogItem = {
  id: string;
  code: string;
  name: string;
  group: string;
  active: boolean;
};

export type SystemSettings = {
  companyName: string;
  systemEmail: string;
  certWarningDays: number;
  defaultProductionTarget: number;
  timezone: string;
  sessionTimeoutMinutes: number;
};

export type InitialAccount = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: "Quản trị" | "Nhân viên";
  status: "Hoạt động" | "Khóa";
  createdAt: string;
  note: string;
};

export const catalogGroups = [
  "Loại ray",
  "Phương pháp hàn",
  "Loại mối hàn",
  "Phòng ban",
  "Nhà máy",
  "Ca làm việc",
  "Hạng thợ hàn",
] as const;

export type CatalogGroup = (typeof catalogGroups)[number];

export const sharedCatalogs: CatalogItem[] = [
  { id: "1", code: "UIC60", name: "UIC60", group: "Loại ray", active: true },
  { id: "2", code: "P50", name: "P50", group: "Loại ray", active: true },
  { id: "3", code: "P43", name: "P43", group: "Loại ray", active: true },
  { id: "4", code: "50N", name: "50N", group: "Loại ray", active: true },
  { id: "5", code: "FBW", name: "Flash Butt Welding (hàn điểm)", group: "Phương pháp hàn", active: true },
  { id: "6", code: "ATW", name: "Aluminothermic Welding (hàn nhiệt)", group: "Phương pháp hàn", active: true },
  { id: "7", code: "TN", name: "Thử nghiệm", group: "Loại mối hàn", active: true },
  { id: "8", code: "DT", name: "Đào tạo", group: "Loại mối hàn", active: true },
  { id: "9", code: "SX", name: "Sản xuất", group: "Loại mối hàn", active: true },
  { id: "10", code: "CNTT", name: "Phòng Công nghệ thông tin", group: "Phòng ban", active: true },
  { id: "11", code: "SXU", name: "Phòng Sản xuất", group: "Phòng ban", active: true },
  { id: "12", code: "HN", name: "Nhà máy Hà Nội", group: "Nhà máy", active: true },
  { id: "13", code: "DN", name: "Nhà máy Đà Nẵng", group: "Nhà máy", active: true },
  { id: "14", code: "HCM", name: "Nhà máy TP.HCM", group: "Nhà máy", active: true },
  { id: "15", code: "C1", name: "Ca 1", group: "Ca làm việc", active: true },
  { id: "16", code: "C2", name: "Ca 2", group: "Ca làm việc", active: true },
  { id: "17", code: "C3", name: "Ca 3", group: "Ca làm việc", active: true },
  { id: "18", code: "H1", name: "Hạng 1", group: "Hạng thợ hàn", active: true },
  { id: "19", code: "H2", name: "Hạng 2", group: "Hạng thợ hàn", active: true },
  { id: "20", code: "H3", name: "Hạng 3", group: "Hạng thợ hàn", active: true },
];

export const defaultSystemSettings: SystemSettings = {
  companyName: "Công ty CP Thành Phát",
  systemEmail: "hethong@thanhphat.vn",
  certWarningDays: 30,
  defaultProductionTarget: 22500,
  timezone: "Asia/Ho_Chi_Minh (UTC+7)",
  sessionTimeoutMinutes: 480,
};

export const initialAccounts: InitialAccount[] = [
  {
    id: "1",
    username: "cong",
    fullName: "Nguyễn Đắc Công",
    email: "congnd@thanhphat.vn",
    role: "Quản trị",
    status: "Hoạt động",
    createdAt: "2024-01-02",
    note: "Tài khoản admin khởi tạo hệ thống",
  },
  {
    id: "2",
    username: "tiep",
    fullName: "Đặng Ngọc Tiếp",
    email: "tiepdn@thanhphat.vn",
    role: "Quản trị",
    status: "Hoạt động",
    createdAt: "2024-01-02",
    note: "Quản trị kỹ thuật",
  },
  {
    id: "3",
    username: "kimanh",
    fullName: "Lê Thị Kim Anh",
    email: "anhltk@thanhphat.vn",
    role: "Nhân viên",
    status: "Hoạt động",
    createdAt: "2024-02-15",
    note: "Tổ trưởng sản xuất – quyền vận hành",
  },
  {
    id: "4",
    username: "minh",
    fullName: "Phạm Văn Minh",
    email: "minhpv@thanhphat.vn",
    role: "Nhân viên",
    status: "Hoạt động",
    createdAt: "2024-03-01",
    note: "Thợ hàn – tài khoản mẫu",
  },
];
