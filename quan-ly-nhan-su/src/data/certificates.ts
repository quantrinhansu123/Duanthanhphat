export type CertificateImageKey =
  | "welding-1"
  | "welding-2"
  | "machine"
  | "ndt"
  | "safety"
  | "iso"
  | "default";

export type Certificate = {
  id: string;
  title: string;
  holder: string;
  employeeId?: string;
  employeeCode?: string;
  issuedAt: string;
  expiresAt: string;
  status: "Còn hiệu lực" | "Sắp hết hạn" | "Hết hạn" | "Thu hồi" | "Chưa cập nhật";
  imageKey: CertificateImageKey;
  /** Ảnh chứng chỉ đã lưu bền vững. */
  imageUrl?: string;
  cloudinaryPublicId?: string;
  groupId?: string;
  organization?: string;
  machine?: string;
  certificateNumber?: string;
  notes?: string;
  fileSize?: number;
  sourceUrl?: string;
  license?: string;
  /** Bản ghi suy ra từ nhan_su.chung_chi khi chưa có hồ sơ trong bảng chung_chi. */
  inferred?: boolean;
};

export const certificates: Certificate[] = [
  {
    id: "1",
    title: "Chứng chỉ thợ hàn ray hạng 1 – UIC60",
    holder: "Lê Thị Kim Anh",
    issuedAt: "15/06/2024",
    expiresAt: "15/06/2027",
    status: "Còn hiệu lực",
    imageKey: "welding-1",
  },
  {
    id: "2",
    title: "Chứng chỉ vận hành máy hàn K920",
    holder: "Phạm Văn Minh",
    issuedAt: "01/03/2025",
    expiresAt: "01/03/2028",
    status: "Còn hiệu lực",
    imageKey: "machine",
  },
  {
    id: "3",
    title: "Chứng chỉ NDT – kiểm tra siêu âm mối hàn",
    holder: "Trần Quốc Bảo",
    issuedAt: "20/11/2023",
    expiresAt: "20/11/2026",
    status: "Còn hiệu lực",
    imageKey: "ndt",
  },
  {
    id: "4",
    title: "Chứng chỉ an toàn lao động nhóm 3",
    holder: "Nguyễn Văn Hùng",
    issuedAt: "08/09/2024",
    expiresAt: "08/09/2026",
    status: "Sắp hết hạn",
    imageKey: "safety",
  },
  {
    id: "5",
    title: "Chứng chỉ thợ hàn ray hạng 2 – P50/P43",
    holder: "Đỗ Thị Lan",
    issuedAt: "12/01/2022",
    expiresAt: "12/01/2025",
    status: "Hết hạn",
    imageKey: "welding-2",
  },
  {
    id: "6",
    title: "Chứng chỉ ISO 9606 – Welding Qualification",
    holder: "Vũ Đức Thắng",
    issuedAt: "30/04/2025",
    expiresAt: "30/04/2028",
    status: "Còn hiệu lực",
    imageKey: "iso",
  },
];
