/** Domain types for the LWR/CWR rail-welding tracker.
 *  Kept UI-agnostic so data logic stays separate from presentation. */

export type TempBand = "lt30" | "t30_32" | "t33_36" | "t37_40" | "gt40";

export interface BandLabel {
  band: TempBand;
  label: string;
}

/** Một dòng báo cáo đo chuyển vị: M cho phép 5 mm; E tính từ thông số giải tỏa và nhiệt độ đo. */
export interface RailReportRow {
  /** Ngày giờ địa phương khi đo, định dạng datetime-local. */
  measuredAt?: string;
  /** Nhiệt độ không khí tại thời điểm đo (°C), chỉ ghi nhận. */
  airTemp?: string;
  /** Nhiệt độ đo (°C) tại thời điểm quan trắc. */
  temp: string;
  /** Điểm M — thực tế (mm). */
  mActual: string;
  /** Điểm E — thực tế (mm). */
  eActual: string;
  note: string;
}

export interface RailReport {
  rows: RailReportRow[];
}

export interface RailCell {
  id: string;
  from: string;
  to: string;
  /**
   * Nhiệt độ khóa đường trên sơ đồ = (leftTemp + rightTemp) / 2 khi có đo hai bên.
   * Dùng để tô màu thanh (xám / xanh T≥30 / cam T&lt;30 khi đã giải toả).
   */
  temp: number;
  /** Nhiệt độ ray trái đo tại hiện trường trước giải toả. */
  leftTemp?: number;
  /** Nhiệt độ ray phải đo tại hiện trường trước giải toả. */
  rightTemp?: number;
  /**
   * Lượng điều chỉnh chiều dài (m, +/−) so với chênh lý trình.
   * Chiều dài ray = lý trình cuối − lý trình đầu + lengthAdjust.
   */
  lengthAdjust?: number;
  /** True after the user adds this short rail on the schematic. */
  placed?: boolean;
  /** True after stress release on this segment has passed. */
  released?: boolean;
  /** Bảng báo cáo chuyển vị điểm M / E của đoạn ray. */
  report?: RailReport;
}

export interface RailRow {
  line: string;
  rail: string;
  cells: RailCell[];
}

export interface TrackEvent {
  kind: "turnout" | "bridge" | "tunnel";
  label: string;
  km: string;
  /** position as fraction of the 0–10 km line */
  at: number;
  span?: [number, number];
}

export interface StatItem {
  label: string;
  value: string;
  tone: string;
}

export interface ForcePoint {
  x: number;
  p: number;
  u: number;
}

export interface CellDetail {
  deltaT: number;
  force: number;
  title: string;
}
