import { initialAccounts, type InitialAccount } from "@/data/systemConfig";

/** Người đang đăng nhập trên giao diện. Tài khoản seed Quản trị là admin hệ thống. */
export const currentViewer: Pick<InitialAccount, "fullName" | "role" | "note"> = initialAccounts[0];

const LEADERSHIP_TITLES = ["lãnh đạo", "giám đốc", "chỉ huy trưởng"];

/** Đơn giá phụ tùng: chỉ Admin (Quản trị) và lãnh đạo được xem. */
export function canViewUnitPrice(
  viewer: Pick<InitialAccount, "role" | "note" | "fullName"> = currentViewer,
) {
  if (viewer.role === "Quản trị") return true;
  const text = `${viewer.note} ${viewer.fullName}`.toLocaleLowerCase("vi");
  return LEADERSHIP_TITLES.some((title) => text.includes(title));
}
