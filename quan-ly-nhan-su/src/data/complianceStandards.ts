export type ComplianceScope = "Công ty" | "Quy trình hàn" | "Thợ hàn";

export type ComplianceStatus =
  | "Chưa đánh giá"
  | "Thiếu minh chứng"
  | "Đáp ứng một phần"
  | "Đạt";

export type ComplianceStandardItem = {
  id: string;
  standardCode: string;
  clause: string;
  title: string;
  requirement: string;
  scope: ComplianceScope;
  relatedStandard: string;
  evidenceRequired: string;
  evidenceDoc?: string;
  evidenceUrl?: string;
  status: ComplianceStatus;
  verifier?: string;
  verifiedAt?: string;
  notes?: string;
};

// Nội dung dưới đây chỉ chép từ ảnh 12–14. Trạng thái ban đầu luôn là
// “Chưa đánh giá”; chỉ người có thẩm quyền và có minh chứng mới được đánh dấu Đạt.
export const INITIAL_COMPLIANCE_STANDARDS: ComplianceStandardItem[] = [
  {
    id: "TCVN-13965-2-4.1",
    standardCode: "TCVN 13965-2:2024",
    clause: "4.1",
    title: "Yêu cầu đối với ray để hàn",
    requirement:
      "Ray dùng để hàn là các thanh ray theo tiêu chuẩn EN 13674-1 và TB/T 2344.1 có cùng biên dạng và mác thép.",
    scope: "Quy trình hàn",
    relatedStandard: "EN 13674-1; TB/T 2344.1",
    evidenceRequired: "Hồ sơ chứng minh biên dạng, mác thép và tiêu chuẩn của ray dùng để hàn.",
    status: "Chưa đánh giá",
  },
  {
    id: "TCVN-13965-2-4.2.1.1",
    standardCode: "TCVN 13965-2:2024",
    clause: "4.2.1.1",
    title: "Hàn trong xưởng — Tổng quan",
    requirement:
      "Nhà thầu phải đáp ứng các yêu cầu phê duyệt như trong 4.2.1.2 đến 4.2.1.6. Bên mua có quyền kiểm tra nhà thầu bất kỳ khi nào. Nhà thầu phải áp dụng hệ thống chất lượng đã được bên mua chấp thuận. Hệ thống chất lượng phải bao gồm một hệ thống xác định nguồn gốc đối với tất cả các mối hàn được thực hiện.",
    scope: "Công ty",
    relatedStandard: "EN 14587;EN 14730;TB/T 1632",
    evidenceRequired: "Hồ sơ phê duyệt của bên mua và minh chứng truy xuất nguồn gốc mối hàn.",
    status: "Chưa đánh giá",
  },
  {
    id: "TCVN-13965-2-4.2.2.2-a",
    standardCode: "TCVN 13965-2:2024",
    clause: "4.2.2.2 a)",
    title: "Yêu cầu để được phê duyệt ban đầu — Quy trình hàn",
    requirement:
      "Nhà thầu hàn phải sử dụng các quy trình hàn và MFBW đã được phê duyệt phù hợp với các yêu cầu của Điều 5 tiêu chuẩn này.",
    scope: "Quy trình hàn",
    relatedStandard: "Điều 5 TCVN 13965-2:2024",
    evidenceRequired: "Quy trình hàn và MFBW đã được phê duyệt.",
    status: "Chưa đánh giá",
  },
  {
    id: "TCVN-13965-2-4.2.2.2-b",
    standardCode: "TCVN 13965-2:2024",
    clause: "4.2.2.2 b)",
    title: "Yêu cầu để được phê duyệt ban đầu — Hệ thống chất lượng",
    requirement:
      "Nhà thầu phải áp dụng một hệ thống quản lý và giám sát hàn chảy giáp mép phù hợp với các yêu cầu của Chủ đầu tư. Nhà thầu phải vận hành một hệ thống quản lý chất lượng đã được phê duyệt và kiểm toán một cách độc lập. Kế hoạch chất lượng sản phẩm phải được Chủ đầu tư xác nhận. Hệ thống chất lượng phải xác định được nguồn gốc đối với tất cả các mối hàn được tạo ra.",
    scope: "Công ty",
    relatedStandard: "TCVN ISO 9001",
    evidenceRequired: "Hồ sơ phê duyệt, kiểm toán độc lập, kế hoạch chất lượng và truy xuất nguồn gốc mối hàn.",
    status: "Chưa đánh giá",
    notes: "Theo chú thích trong tài liệu: hệ thống quản lý chất lượng phù hợp TCVN ISO 9001 được coi là đáp ứng các yêu cầu.",
  },
  {
    id: "TCVN-13965-1-A.2",
    standardCode: "TCVN 13965-1:2024",
    clause: "A.2",
    title: "Xác định thợ hàn",
    requirement:
      "Để xác định thợ hàn, mỗi mối hàn phải được đánh dấu bằng số tem được cấp trong Giấy phép hàn.",
    scope: "Thợ hàn",
    relatedStandard: "",
    evidenceRequired: "Giấy phép hàn, số tem thợ hàn và bản ghi liên kết số tem với từng mối hàn.",
    status: "Chưa đánh giá",
  },
  {
    id: "TCVN-13965-1-A.3",
    standardCode: "TCVN 13965-1:2024",
    clause: "A.3",
    title: "Hồ sơ thợ hàn",
    requirement:
      "Nhà thầu phải lưu giữ hồ sơ thợ hàn; hồ sơ là một phần của hệ thống quản lý chất lượng và bao gồm: đào tạo và nâng cao năng lực thợ hàn; hồ sơ hàn; số lượng mối hàn được thực hiện trong một thời kỳ nhất định; số lượng mối hàn bị từ chối; số lượng mối hàn được ghi nhận lỗi trong quá trình sử dụng.",
    scope: "Thợ hàn",
    relatedStandard: "",
    evidenceRequired: "Hồ sơ đào tạo, hồ sơ hàn và các thống kê mối hàn theo đúng năm nội dung của điều A.3.",
    status: "Chưa đánh giá",
  },
];
