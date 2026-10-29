import { navigation } from "@/data/navigation";

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
  fullName: string;
  email: string;
  birthDate?: string;
  /** Một trong permissionRoles (hoặc "Nhân viên" của dữ liệu cũ). */
  role: string;
  status: "Hoạt động" | "Khóa";
  createdAt: string;
  note: string;
};

export const permissionActions = ["view", "edit", "delete"] as const;
export type PermissionAction = (typeof permissionActions)[number];
export type Permission = Record<PermissionAction, boolean>;
/** vai trò → mã chức năng (id tab trong navigation) → quyền */
export type RolePermissions = Record<string, Record<string, Permission>>;

/** Vai trò theo "TCW_Bang_phan_quyen_ung_dung.docx". */
export const permissionRoles = [
  "Quản trị",
  "Lãnh đạo",
  "Chỉ huy trưởng dự án",
  "Kỹ sư hiện trường",
  "Thợ hàn / thợ vận hành",
  "Quản lý máy",
  "Bộ phận khác",
] as const;

const perm = (view: boolean, edit: boolean, del = false): Permission => ({ view, edit, delete: del });
const NONE = perm(false, false);
const WELDER_TABS = ["kiem-tra-may-truoc-ca", "lich-su-cap-nhien-lieu"];

/** Mặc định theo phạm vi áp dụng trong file Word. */
export function defaultPermission(role: string, groupId: string, tabId: string): Permission {
  switch (role) {
    case "Quản trị": return perm(true, true, true);
    case "Chỉ huy trưởng dự án":
    case "Kỹ sư hiện trường": return perm(true, true);
    case "Thợ hàn / thợ vận hành": return WELDER_TABS.includes(tabId) ? perm(true, true) : NONE;
    case "Quản lý máy": return groupId === "may-moc" ? perm(true, true) : NONE;
    default: return perm(true, false); // Lãnh đạo, Bộ phận khác: chỉ xem
  }
}

export const defaultPermissions: RolePermissions = Object.fromEntries(
  permissionRoles.map((role) => [
    role,
    Object.fromEntries(
      navigation.flatMap((g) => g.children.map((c) => [c.id, defaultPermission(role, g.id, c.id)])),
    ),
  ]),
);

export type StoredSystemConfiguration = {
  catalogs: CatalogItem[];
  settings: SystemSettings;
  accounts: InitialAccount[];
  permissions?: RolePermissions;
  updatedAt?: string;
  /** Chỉ có khi lưu: quyền chưa đồng bộ được sang database. */
  syncWarning?: string | null;
};

export const catalogGroups = [
  "Loại ray",
  "Phương pháp hàn",
  "Loại mối hàn",
  "Phòng ban",
  "Ca làm việc",
  "Hạng thợ hàn",
] as const;

export type CatalogGroup = (typeof catalogGroups)[number];

export const sharedCatalogs: CatalogItem[] = [
  { id: "rail-p50", code: "P50", name: "P50", group: "Loại ray", active: true },
  { id: "rail-50n", code: "50N", name: "50N", group: "Loại ray", active: true },
  { id: "rail-60e1", code: "60E1", name: "60E1", group: "Loại ray", active: true },
  { id: "rail-60n", code: "60N", name: "60N", group: "Loại ray", active: true },
  { id: "rail-60r2", code: "60R2", name: "60R2", group: "Loại ray", active: true },
  { id: "rail-cr100", code: "CR100", name: "CR100", group: "Loại ray", active: true },
  { id: "5", code: "FBW", name: "Flash Butt Welding (hàn điểm)", group: "Phương pháp hàn", active: true },
  { id: "6", code: "ATW", name: "Aluminothermic Welding (hàn nhiệt)", group: "Phương pháp hàn", active: true },
  { id: "8", code: "DT", name: "Đào tạo", group: "Loại mối hàn", active: true },
  { id: "7", code: "TN", name: "Thử nghiệm", group: "Loại mối hàn", active: true },
  { id: "weld-type-ct", code: "CT", name: "Chấp thuận", group: "Loại mối hàn", active: true },
  { id: "9", code: "SX", name: "Sản xuất", group: "Loại mối hàn", active: true },
  { id: "weld-type-ts", code: "TS", name: "Tần suất", group: "Loại mối hàn", active: true },
  { id: "department-welding", code: "WD", name: "Bộ phận hàn ray (Welding Department)", group: "Phòng ban", active: true },
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
    fullName: "Nguyễn Đắc Công",
    email: "congnd@thanhphat.vn",
    role: "Quản trị",
    status: "Hoạt động",
    createdAt: "2024-01-02",
    note: "Tài khoản admin khởi tạo hệ thống",
  },
  {
    id: "2",
    fullName: "Đặng Ngọc Tiếp",
    email: "tiepdn@thanhphat.vn",
    role: "Quản trị",
    status: "Hoạt động",
    createdAt: "2024-01-02",
    note: "Quản trị kỹ thuật",
  },
  {
    id: "3",
    fullName: "Lê Thị Kim Anh",
    email: "anhltk@thanhphat.vn",
    role: "Nhân viên",
    status: "Hoạt động",
    createdAt: "2024-02-15",
    note: "Tổ trưởng sản xuất – quyền vận hành",
  },
  {
    id: "4",
    fullName: "Phạm Văn Minh",
    email: "minhpv@thanhphat.vn",
    role: "Nhân viên",
    status: "Hoạt động",
    createdAt: "2024-03-01",
    note: "Thợ hàn – tài khoản mẫu",
  },
];

/**
 * Quyền của email trên một chức năng — dùng chung cho giao diện và máy chủ.
 * Email chưa có trong danh sách tài khoản → không hạn chế; tài khoản Khóa → không có quyền nào.
 */
export function checkPermission(
  config: Pick<StoredSystemConfiguration, "accounts" | "permissions">,
  email: string | undefined,
  tabId: string,
  action: PermissionAction,
): boolean {
  const account = email ? config.accounts.find((a) => a.email.toLowerCase() === email.toLowerCase()) : undefined;
  if (!account) return true;
  if (account.status === "Khóa") return false;
  const stored = config.permissions?.[account.role]?.[tabId];
  const groupId = navigation.find((g) => g.children.some((c) => c.id === tabId))?.id ?? "";
  return (stored ?? defaultPermission(account.role, groupId, tabId))[action];
}
