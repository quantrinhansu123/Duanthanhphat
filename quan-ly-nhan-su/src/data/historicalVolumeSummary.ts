export type VolumeByMethod = {
  fbw: number | null;
  atw: number | null;
};

export type HistoricalVolumeSummary = {
  id: string;
  no: number;
  year: number;
  trialTraining: VolumeByMethod;
  production: VolumeByMethod;
  defective: VolumeByMethod;
  errorReason: string;
};

export const volumeSummaryTitle = "TỔNG HỢP KHỐI LƯỢNG MỐI HÀN RAY ĐÃ THỰC HIỆN";

/** Mẫu 3 – tổng hợp khối lượng theo năm (2017–2026). Ô trống = null. */
export const historicalVolumeSummary: HistoricalVolumeSummary[] = [
  { id: "1", no: 1, year: 2017, trialTraining: { fbw: null, atw: null }, production: { fbw: null, atw: null }, defective: { fbw: null, atw: null }, errorReason: "" },
  { id: "2", no: 2, year: 2018, trialTraining: { fbw: 12, atw: 4 }, production: { fbw: null, atw: null }, defective: { fbw: null, atw: null }, errorReason: "" },
  { id: "3", no: 3, year: 2019, trialTraining: { fbw: 18, atw: 8 }, production: { fbw: 320, atw: 52 }, defective: { fbw: 2, atw: 1 }, errorReason: "Lệch tim ray; Khuyết khí trong mối hàn" },
  { id: "4", no: 4, year: 2020, trialTraining: { fbw: 30, atw: 6 }, production: { fbw: 2020, atw: 88 }, defective: { fbw: 3, atw: 0 }, errorReason: "Lệch tim ray; Lệch mép ray sau hàn" },
  { id: "5", no: 5, year: 2021, trialTraining: { fbw: 45, atw: 20 }, production: { fbw: 1000, atw: 205 }, defective: { fbw: 1, atw: 0 }, errorReason: "Lệch mép ray sau hàn" },
  { id: "6", no: 6, year: 2022, trialTraining: { fbw: 22, atw: 14 }, production: { fbw: 630, atw: 120 }, defective: { fbw: 3, atw: 0 }, errorReason: "Lệch tim ray" },
  { id: "7", no: 7, year: 2023, trialTraining: { fbw: 15, atw: 10 }, production: { fbw: 890, atw: 165 }, defective: { fbw: 1, atw: 0 }, errorReason: "Lệch tim ray" },
  { id: "8", no: 8, year: 2024, trialTraining: { fbw: null, atw: null }, production: { fbw: null, atw: null }, defective: { fbw: null, atw: null }, errorReason: "" },
  { id: "9", no: 9, year: 2025, trialTraining: { fbw: null, atw: null }, production: { fbw: null, atw: null }, defective: { fbw: null, atw: null }, errorReason: "" },
  { id: "10", no: 10, year: 2026, trialTraining: { fbw: null, atw: null }, production: { fbw: null, atw: null }, defective: { fbw: null, atw: null }, errorReason: "" },
];

export function volumeTotal(v: VolumeByMethod): number | null {
  if (v.fbw == null && v.atw == null) return null;
  return (v.fbw ?? 0) + (v.atw ?? 0);
}

export function formatVolumeCell(value: number | null): string {
  if (value == null) return "";
  return value.toLocaleString("vi-VN");
}
