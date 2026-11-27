import type { GroundCheckInput } from "./tb15-ground";
import type { GroundCheckResult, Step10Origin } from "./tb15-step10";

/** Một ô trong bảng thông số đầu vào đã lưu cùng lần tính. */
export type Tb15TrialParameter = { label: string; value: string };

/** Giá trị từng ô trên form, để Xem lại điền lại chứ không chỉ hiện chữ. */
export type Tb15TrialForm = {
  ballast: "co" | "khong";
  place: "nen" | "cau";
  alignment: "thang" | "cong";
  radius: string;
  gauge: 1000 | 1435;
  vehicle: "dau_may" | "toa_xe";
  railCenterMm: string;
  cgLocomotiveMm: string;
  cgWagonMm: string;
  climateMonth: number;
  khi_hau: string;
  loai_ray: string;
  mac_thep: string;
  ket_cau_duong: string;
  do_cung_goi: string;
  so_do_tai: string;
  mo_men_can: string;
  he_so_tai: string;
  on_dinh_nen: string;
  traction: string;
  riseMethod: string;
  speed: string;
  cant: string;
  tolerance: string;
  adjustment: string;
  gap: string;
  extra: string;
  braking: string;
};

/** Một lần tính thử nền có ba lát, giữ nguyên số đã tính để mở lại. */
export type Tb15Trial = {
  id: string;
  title: string;
  createdAt: string;
  passed: boolean;
  lockTemperature: number | null;
  climate: string;
  sourceLines: string[];
  parameters: Tb15TrialParameter[];
  form: Tb15TrialForm | null;
  input: GroundCheckInput;
  result: GroundCheckResult;
  origin: Step10Origin;
};

export type Tb15TrialSummary = Pick<Tb15Trial, "id" | "title" | "createdAt" | "passed" | "lockTemperature" | "climate">;
