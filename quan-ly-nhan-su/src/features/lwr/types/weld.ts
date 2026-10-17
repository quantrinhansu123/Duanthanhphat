/** Mối hàn lấy từ nhật ký (Supabase) để gắn lên sơ đồ ray. */

export type WeldTestStatus = "Chờ thí nghiệm" | "Đạt" | "Không đạt" | "Không thí nghiệm";

export interface JournalWeld {
  id: string;
  code: string;
  date: string | null;
  project: string;
  method: string;
  weldType: string;
  welder: string;
  status: WeldTestStatus | string;
  chainage: string | null;
  metres: number | null;
  failed: boolean;
}

/** Khớp mối hàn tại ranh giới giữa hai thanh ray. */
export interface RailJoint {
  id: string;
  rowKey: string;
  leftCellId: string;
  rightCellId: string;
  chainage: string;
  metres: number;
  welds: JournalWeld[];
}
