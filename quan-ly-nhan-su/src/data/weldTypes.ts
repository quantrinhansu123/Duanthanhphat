/** Loại mối hàn — đúng thứ tự hiển thị trên mọi màn hình. */
export const WELD_TYPE_OPTIONS = ["Đào tạo", "Thử nghiệm", "Chấp thuận", "Sản xuất", "Tần suất"] as const;

export type WeldType = (typeof WELD_TYPE_OPTIONS)[number];

/** Ký hiệu ngắn dùng trong mã mối hàn và danh mục hệ thống. */
export const WELD_TYPE_SHORT_CODES: Record<WeldType, string> = {
  "Đào tạo": "DT",
  "Thử nghiệm": "TN",
  "Chấp thuận": "CT",
  "Sản xuất": "SX",
  "Tần suất": "TS",
};

export function isWeldType(value: unknown): value is WeldType {
  return typeof value === "string" && (WELD_TYPE_OPTIONS as readonly string[]).includes(value);
}
