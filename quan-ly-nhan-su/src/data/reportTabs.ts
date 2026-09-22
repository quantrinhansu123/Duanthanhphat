export type ReportTab = {
  id: string;
  label: string;
};

export const REPORT_TABS: ReportTab[] = [
  { id: "bc-tong-quan", label: "Tổng quan" },
  { id: "bc-chat-luong", label: "Báo cáo Chất lượng" },
  { id: "bc-may-moc", label: "Báo cáo Máy móc" },
  { id: "bc-nhan-su", label: "Báo cáo Nhân sự" },
  { id: "bc-bao-cao-ngay", label: "Báo cáo ngày" },
];

export function isReportTab(id: string) {
  return REPORT_TABS.some((t) => t.id === id);
}
