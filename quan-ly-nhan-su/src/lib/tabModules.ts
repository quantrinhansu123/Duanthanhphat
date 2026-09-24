/** Prefetch chunk JS của từng phân hệ khi hover menu — giảm chờ lần mở đầu. */
export const tabModuleImporters: Record<string, () => Promise<unknown>> = {
  "ho-so-tho-han": () => import("@/components/WelderManagement"),
  "lich-su-han": () => import("@/components/WeldingHistoryList"),
  "lich-su-moi-han-loi": () => import("@/components/FailedWeldHistoryList"),
  "khoa-dao-tao": () => import("@/components/TrainingList"),
  "chung-chi": () => import("@/components/CertificateManagement"),
  "chung-chi-cong-ty": () => import("@/components/CompanyCertificateManagement"),
  "tieu-chuan-tcvn": () => import("@/components/ComplianceStandardsList"),
  "tra-cuu-dao-tao": () => import("@/components/TrainingHistoryLookup"),
  "danh-sach-may": () => import("@/components/MachineList"),
  "quan-ly-phuong-tien": () => import("@/components/TransportVehicleList"),
  "quan-ly-khay-han": () => import("@/components/WeldingTrayList"),
  "lich-bao-tri": () => import("@/components/MaintenanceCalendar"),
  "thu-vien-loi": () => import("@/components/ErrorLibrary"),
  "phan-cong-may": () => import("@/components/MachineAssignmentList"),
  "phu-tung-thay-the": () => import("@/components/SparePartsList"),
  "bc-tong-quan": () => import("@/components/OverviewDashboard"),
  "bc-san-luong": () => import("@/components/OverviewDashboard"),
  "bc-chat-luong": () => import("@/components/QualityReportDashboard"),
  "bc-may-moc": () => import("@/components/MachineReportDashboard"),
  "bc-nhan-su": () => import("@/components/PersonnelReportDashboard"),
  "bc-bao-cao-ngay": () => import("@/components/DailyWorkReport"),
  "quan-ly-du-an": () => import("@/components/ProjectManagement"),
  "quan-ly-moi-han": () => import("@/components/WeldJointManagement"),
  "thu-vien-loi-moi-han": () => import("@/components/ErrorLibrary"),
  "nhat-ky-han": () => import("@/components/WeldingJournalList"),
  "bien-ban-moi-han": () => import("@/components/WeldAcceptanceReport"),
  "bc-moi-han-theo-nam": () => import("@/components/YearlyWeldReport"),
  "ban-do": () => import("@/components/MapView"),
  "tai-lieu": () => import("@/components/DocumentLibrary"),
  "trien-khai": () => import("@/components/DeploymentHandoverList"),
  "nhap-hang-loat": () => import("@/components/BulkImportList"),
  "cau-hinh": () => import("@/components/SystemConfiguration"),
};

const warmed = new Set<string>();

export function prefetchTabModule(id: string) {
  if (!id || warmed.has(id)) return;
  const load = tabModuleImporters[id];
  if (!load) return;
  warmed.add(id);
  void load().catch(() => {
    warmed.delete(id);
  });
}
