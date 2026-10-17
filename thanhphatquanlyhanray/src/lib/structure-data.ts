import type { StructureStatus } from "@/types/structure";

export const STATUS_OPTIONS: { value: StructureStatus; label: string; tone: string }[] = [
  { value: "active", label: "Đang dùng", tone: "bg-emerald-50 text-emerald-700" },
  { value: "maintenance", label: "Sửa chữa", tone: "bg-amber-50 text-amber-700" },
  { value: "inactive", label: "Ngừng", tone: "bg-slate-100 text-slate-600" },
];
