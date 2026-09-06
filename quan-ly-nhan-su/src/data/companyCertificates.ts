export type CompanyCertificate = {
  id: string;
  title: string;
  standardCode: string;
  organization: string;
  certificateNumber: string;
  scope: string;
  issuedAt: string;
  expiresAt: string;
  status: "Chưa cập nhật" | "Còn hiệu lực" | "Sắp hết hạn" | "Hết hạn";
  documentName?: string;
  documentUrl?: string;
  driveFileId?: string;
  notes?: string;
};

// Không tạo chứng chỉ mẫu vì các số chứng chỉ, đơn vị cấp, ngày hiệu lực và
// phạm vi phải lấy từ hồ sơ doanh nghiệp thực tế.
export const INITIAL_COMPANY_CERTIFICATES: CompanyCertificate[] = [];
