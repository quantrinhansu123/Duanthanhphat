export const GEOMETRY_CRITERIA = ["doc_mat_lan", "ngang_nam_ray", "ngang_chan_ray", "phang_mat_lan"] as const;
export type GeometryCriterion = (typeof GEOMETRY_CRITERIA)[number];
export type QualityResult = "Đạt" | "Không đạt" | null;
export type NdtMethod = "Siêu âm" | "Từ tính" | "Thẩm thấu";
export type GeometryMeasurements = Partial<Record<GeometryCriterion, number | null>>;
export type GeometryLimit = { min: number | null; max: number | null; minInclusive: boolean; maxInclusive: boolean };
export type GeometryLimits = Record<GeometryCriterion, GeometryLimit>;

export type WeldQualityRule = {
  dung_sai: GeometryLimits;
  yeu_cau_ndt: boolean;
  ndt_truoc_rfi: boolean;
  can_cu_mien_ndt: string | null;
};

export type WeldQualityInspection = {
  ngay_mai: string | null;
  truc_quan: QualityResult;
  gia_tri_do: GeometryMeasurements;
  phuong_phap_ndt: NdtMethod;
  ket_qua_ndt: QualityResult;
  ngay_ndt: string | null;
  ly_do_loai_nghiem_thu?: string | null;
};

export type WeldQualityStatus = "Chưa có dữ liệu chất lượng" | "Chờ mài" | "Chờ thí nghiệm" |
  "Chờ nghiệm thu" | "Không thí nghiệm" | "Không đạt" | "Nghiệm thu đạt";

export const WELD_QUALITY_STATUSES: WeldQualityStatus[] = ["Chưa có dữ liệu chất lượng", "Chờ mài", "Chờ thí nghiệm", "Chờ nghiệm thu", "Không thí nghiệm", "Không đạt", "Nghiệm thu đạt"];
export const GEOMETRY_LABELS: Record<GeometryCriterion, string> = {
  doc_mat_lan: "Dọc trên mặt lăn",
  ngang_nam_ray: "Ngang trên nấm ray",
  ngang_chan_ray: "Ngang trên các đầu chân ray",
  phang_mat_lan: "Độ phẳng mặt lăn trong khu vực mài",
};

export type SavedWeldInspection = WeldQualityInspection & {
  moi_han_id: string;
  tieu_chuan_id: string | null;
  phien_ban: number;
  nguoi_ghi_nhan: string | null;
  ghi_chu: string | null;
  updated_at: string;
};

export type SavedWeldQualityRule = WeldQualityRule & {
  id: string;
  du_an_id: string;
  cong_nghe_han: "FBW" | "ATW";
  loai_moi_han: string;
  phien_ban: number;
  ten: string;
  nguoi_xac_nhan: string;
  dang_ap_dung: boolean;
};

export type WeldQualitySelection = { id: string; phien_ban: number; ma_lich_su: string };

export function emptyWeldInspection(weldId: string): SavedWeldInspection {
  return { moi_han_id: weldId, tieu_chuan_id: null, ngay_mai: null, truc_quan: null, gia_tri_do: {},
    phuong_phap_ndt: "Siêu âm", ket_qua_ndt: null, ngay_ndt: null, ly_do_loai_nghiem_thu: null,
    phien_ban: 0, nguoi_ghi_nhan: null, ghi_chu: null, updated_at: "" };
}

/** Giữ ô trống khác số 0; không nhận số mũ, dấu phân nhóm hoặc đơn vị lẫn trong số đo. */
export function parseWeldMeasurement(value: unknown): number | null {
  if (value == null || (typeof value === "string" && !value.trim())) return null;
  if (typeof value === "string") {
    const text = value.trim();
    if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text)) throw new Error("Số đo mm không hợp lệ.");
    value = Number(text.replace(",", "."));
  }
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Số đo mm phải là số hữu hạn.");
  return value;
}

export function validateGeometryMeasurements(value: unknown): asserts value is GeometryMeasurements {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Danh sách số đo không hợp lệ.");
  for (const [key, number] of Object.entries(value)) {
    if (!GEOMETRY_CRITERIA.includes(key as GeometryCriterion) ||
      (number !== null && (typeof number !== "number" || !Number.isFinite(number)))) {
      throw new Error(`Số đo ${key} không hợp lệ.`);
    }
  }
}

export function validateGeometryLimits(value: unknown): asserts value is GeometryLimits {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 4) {
    throw new Error("Cần đủ bốn dung sai hình học.");
  }
  for (const key of GEOMETRY_CRITERIA) {
    const limit = (value as Record<string, unknown>)[key];
    if (!limit || typeof limit !== "object" || Array.isArray(limit)) throw new Error(`Thiếu dung sai ${key}.`);
    const bound = limit as Record<string, unknown>;
    if (Object.keys(bound).length !== 4 || typeof bound.minInclusive !== "boolean" || typeof bound.maxInclusive !== "boolean" ||
      ![bound.min, bound.max].every((n) => n === null || (typeof n === "number" && Number.isFinite(n))) ||
      (bound.min === null && bound.max === null)) throw new Error(`Giới hạn ${key} không hợp lệ.`);
    if (typeof bound.min === "number" && typeof bound.max === "number" &&
      (bound.min > bound.max || (bound.min === bound.max && (!bound.minInclusive || !bound.maxInclusive)))) {
      throw new Error(`Khoảng dung sai ${key} rỗng.`);
    }
  }
}

export function evaluateGeometry(measurements: GeometryMeasurements, limits: GeometryLimits | null): QualityResult {
  validateGeometryMeasurements(measurements);
  if (!limits) return null;
  validateGeometryLimits(limits);
  let missing = false;
  for (const key of GEOMETRY_CRITERIA) {
    const number = measurements[key];
    if (number == null) { missing = true; continue; }
    if (evaluateGeometryCriterion(number, limits[key]) === "Không đạt") return "Không đạt";
  }
  return missing ? null : "Đạt";
}

export function evaluateGeometryCriterion(value: number | null, limit: GeometryLimit | null): QualityResult {
  if (value === null || !limit) return null;
  if (!Number.isFinite(value)) throw new Error("Số đo mm phải là số hữu hạn.");
  return (limit.min !== null && (value < limit.min || (!limit.minInclusive && value === limit.min))) ||
    (limit.max !== null && (value > limit.max || (!limit.maxInclusive && value === limit.max))) ? "Không đạt" : "Đạt";
}

export function evaluateWeldQuality(
  inspection: WeldQualityInspection | null,
  rule: WeldQualityRule | null,
  weldType: string,
  accepted = false,
) {
  const geometry = inspection ? evaluateGeometry(inspection.gia_tri_do, rule?.dung_sai ?? null) : null;
  const internalPass = Boolean(inspection?.ngay_mai && inspection.truc_quan === "Đạt" && geometry === "Đạt");
  const ndtPass = Boolean(rule && (!rule.yeu_cau_ndt || (inspection?.ket_qua_ndt === "Đạt" && inspection.ngay_ndt)));
  const failed = Boolean(inspection?.ly_do_loai_nghiem_thu) || inspection?.truc_quan === "Không đạt" ||
    geometry === "Không đạt" || inspection?.ket_qua_ndt === "Không đạt";
  const rfiEligible = Boolean(rule && internalPass && !failed && (!rule.ndt_truoc_rfi || ndtPass));
  const acceptanceEligible = Boolean(rule && internalPass && ndtPass && !failed);
  let status: WeldQualityStatus;
  if (accepted) status = "Nghiệm thu đạt";
  else if (!inspection) status = "Chưa có dữ liệu chất lượng";
  else if (failed) status = "Không đạt";
  else if (rule && !rule.yeu_cau_ndt) status = "Không thí nghiệm";
  else if (internalPass && ndtPass) status = "Chờ nghiệm thu";
  else if (internalPass || weldType === "Thử nghiệm" || weldType === "Chấp thuận") status = "Chờ thí nghiệm";
  else status = "Chờ mài";
  return { geometry, internalPass, ndtPass, rfiEligible, acceptanceEligible, status };
}
