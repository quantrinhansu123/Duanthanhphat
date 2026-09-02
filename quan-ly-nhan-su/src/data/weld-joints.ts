import { WELDING_CERTIFICATES } from "@/lib/weldingCertificates";

export type WeldMethod = "FBW" | "ATW";
export type WeldPurpose = "Thử nghiệm" | "Đào tạo" | "Sản xuất";

export type WeldJoint = {
  id: string;
  trayName: string;
  jointName: string;
  method: WeldMethod;
  weldType: WeldPurpose;
  certificate: string;
};

export const weldJoints: WeldJoint[] = [
  {
    id: "1",
    trayName: "Khay hàn aluminothermic tiêu chuẩn",
    jointName: "MH-HN-001 – Km 12+450 UIC60",
    method: "ATW",
    weldType: "Thử nghiệm",
    certificate: WELDING_CERTIFICATES.railClass1Uic60,
  },
  {
    id: "2",
    trayName: "Khay hàn aluminothermic tiêu chuẩn",
    jointName: "MH-HN-002 – Km 12+680 UIC60",
    method: "ATW",
    weldType: "Đào tạo",
    certificate: WELDING_CERTIFICATES.railClass1Uic60,
  },
  {
    id: "3",
    trayName: "Khay hàn UIC60 – bộ dự phòng",
    jointName: "MH-DN-015 – Ga Đà Nẵng P50",
    method: "FBW",
    weldType: "Sản xuất",
    certificate: WELDING_CERTIFICATES.railClass2P50P43,
  },
  {
    id: "4",
    trayName: "Khay hàn P50 / P43 đa năng",
    jointName: "MH-NB-008 – Km 45+120 P50",
    method: "FBW",
    weldType: "Sản xuất",
    certificate: WELDING_CERTIFICATES.railClass2P50P43,
  },
  {
    id: "5",
    trayName: "Khay hàn di động công trường",
    jointName: "MH-HCM-021 – Km 3+900 UIC60",
    method: "FBW",
    weldType: "Sản xuất",
    certificate: WELDING_CERTIFICATES.iso9606,
  },
  {
    id: "6",
    trayName: "Khay hàn di động công trường",
    jointName: "MH-HCM-022 – Km 4+150 UIC60",
    method: "ATW",
    weldType: "Sản xuất",
    certificate: WELDING_CERTIFICATES.ndt,
  },
  {
    id: "7",
    trayName: "Khay hàn nhiệt luyện cao",
    jointName: "MH-HN-045 – Km 88+300 UIC60",
    method: "ATW",
    weldType: "Sản xuất",
    certificate: WELDING_CERTIFICATES.railClass1Uic60,
  },
  {
    id: "8",
    trayName: "Khay hàn P50 / P43 đa năng",
    jointName: "MH-NB-012 – Km 52+800 P43",
    method: "FBW",
    weldType: "Thử nghiệm",
    certificate: WELDING_CERTIFICATES.railClass2P50P43,
  },
];
