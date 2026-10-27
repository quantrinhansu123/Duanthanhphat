/** Reproduction of “Bảng tính mẫu 60R2”; units: m, kN, °C, mm. */
import type { BufferDeformations } from "./buffer-gap";

export type StressMethod = "ATW" | "FBW" | "SINGLE";
export type ReleaseMethod = "TENSOR" | "NATURAL";

export interface RailProfile {
  id: string;
  label: string;
  /** Tiết diện (m²). */
  area: number;
  /** Mô đun đàn hồi (kN/m²). */
  modulus: number;
  /** Hệ số giãn nở (/°C). */
  alpha: number;
}

export interface StressInput {
  bufferDeformations?: BufferDeformations;
  trackSide?: "LEFT" | "RIGHT";
  startChainage?: string;
  endChainage?: string;
  jointChainage?: string;
  /** Thời điểm bấm Bắt đầu / Kết thúc tại hiện trường (ISO). */
  startTime?: string;
  endTime?: string;
  leftOuterMovement: number;
  rightOuterMovement: number;
  railType: string;
  area: number;
  modulus: number;
  alpha: number;
  resistance: number;
  jointResistance: number;
  leftLength: number;
  rightLength: number;
  radius: number;
  neutralTemp: number;
  leftTemp: number;
  rightTemp: number;
  maxTemp: number;
  minTemp: number;
  weldGap: number;
  fbwAllowance: number;
  currentGap: number;
  structuralGap: number;
  leftMovement: number;
  rightMovement: number;
  /** Diện tích một xilanh Rail Tensor (mm²). Áp suất dầu = 1000 F / (2 A). */
  jackCylinderArea: number;
  /** Chiều dài neo tối thiểu (m). Neo áp dụng = max(thiết kế, tối thiểu). */
  minAnchorLength: number;
  /** Giá trị cho phép của khe hở ray khi kiểm tra vùng đệm (mm). */
  allowedGap: number;
  /** Biên độ khóa đường thiết kế (±°C), mặc định 5. */
  lockTempOffset: number;
  /** Nhiệt độ không khí đo tại hiện trường (°C); chỉ ghi nhận, không tham gia công thức. */
  airTemp: number;
  sideRollers: boolean;
  method: StressMethod;
}

export const RAIL_STEEL_MODULUS = 210_840_000;
export const RAIL_STEEL_ALPHA = 0.0000115;
export const USER_DEFINE_RAIL_ID = "USER";
export const BUFFER_RAIL_LENGTH = 25;
export const FBW_OVERLAP_MM = -35.5;
export const DEFAULT_MIN_ANCHOR_LENGTH = 20;
export const DEFAULT_ALLOWED_GAP = 70;
export const DEFAULT_LOCK_TEMP_OFFSET = 5;
/** Diện tích xilanh φ125 mm. */
export const DEFAULT_JACK_CYLINDER_AREA = 12272;
export const ALLOWED_GAP_RANGE = "8–11 mm";
export const SELECTABLE_GAP_RANGE = "6–13 mm";

/** 9 loại ray cố định + User Define. Diện tích lấy từ sheet Thông số ray / mẫu 60R2. */
export const RAIL_PROFILES: RailProfile[] = [
  { id: "PB43", label: "PB43", area: 0.0057, modulus: RAIL_STEEL_MODULUS, alpha: RAIL_STEEL_ALPHA },
  { id: "P50", label: "P50", area: 0.00658, modulus: RAIL_STEEL_MODULUS, alpha: RAIL_STEEL_ALPHA },
  { id: "P60", label: "P60", area: 0.007745, modulus: RAIL_STEEL_MODULUS, alpha: RAIL_STEEL_ALPHA },
  { id: "54E1", label: "54E1", area: 0.006977, modulus: RAIL_STEEL_MODULUS, alpha: RAIL_STEEL_ALPHA },
  { id: "60E1", label: "60E1", area: 0.00767, modulus: RAIL_STEEL_MODULUS, alpha: RAIL_STEEL_ALPHA },
  { id: "60E2", label: "60E2", area: 0.007648, modulus: RAIL_STEEL_MODULUS, alpha: RAIL_STEEL_ALPHA },
  { id: "50N", label: "50N", area: 0.00642, modulus: RAIL_STEEL_MODULUS, alpha: RAIL_STEEL_ALPHA },
  { id: "60N", label: "60N", area: 0.00775, modulus: RAIL_STEEL_MODULUS, alpha: RAIL_STEEL_ALPHA },
  { id: "60R2", label: "60R2", area: 0.007611, modulus: RAIL_STEEL_MODULUS, alpha: RAIL_STEEL_ALPHA },
];

export const RAIL_TYPE_OPTIONS = [
  ...RAIL_PROFILES,
  { id: USER_DEFINE_RAIL_ID, label: "User Define" },
] as const;

export function getRailProfile(id: string): RailProfile | null {
  return RAIL_PROFILES.find((item) => item.id === id) ?? null;
}

export function isUserDefineRail(id: string) {
  return id === USER_DEFINE_RAIL_ID;
}

export const RAIL_TYPE_COLORS: Record<string, string> = {
  PB43: "#2563eb",
  P50: "#7c3aed",
  P60: "#db2777",
  "54E1": "#ea580c",
  "60E1": "#0891b2",
  "60E2": "#65a30d",
  "50N": "#ca8a04",
  "60N": "#4f46e5",
  "60R2": "#0f766e",
  USER: "#475569",
};

export function railTypeColor(id: string) {
  return RAIL_TYPE_COLORS[id] ?? "#0f766e";
}

export function nextUnusedRailType(used: string[]): string {
  const taken = new Set(used.filter(Boolean));
  return RAIL_PROFILES.find((item) => !taken.has(item.id))?.id ?? RAIL_PROFILES[used.length % RAIL_PROFILES.length]?.id ?? "60R2";
}

export const DEFAULT_STRESS_INPUT: StressInput = {
  leftOuterMovement: 0, rightOuterMovement: 0,
  railType: "60R2",
  area: 0.007611, modulus: RAIL_STEEL_MODULUS, alpha: RAIL_STEEL_ALPHA,
  resistance: 14.4, jointResistance: 0, leftLength: 500, rightLength: 0,
  radius: 1000, neutralTemp: 35, leftTemp: 20, rightTemp: 20,
  maxTemp: 57, minTemp: 16, weldGap: 26, fbwAllowance: FBW_OVERLAP_MM,
  currentGap: 0, structuralGap: 18, leftMovement: 0, rightMovement: 0,
  jackCylinderArea: DEFAULT_JACK_CYLINDER_AREA,
  minAnchorLength: DEFAULT_MIN_ANCHOR_LENGTH,
  allowedGap: DEFAULT_ALLOWED_GAP,
  lockTempOffset: DEFAULT_LOCK_TEMP_OFFSET,
  airTemp: 30,
  sideRollers: false, method: "ATW",
};

/** Excel ROUND: ties away from zero, including negative FBW allowances. */
export function excelRound(value: number, digits = 0): number {
  const scale = 10 ** digits;
  return Math.sign(value) * Math.round(Math.abs(value) * scale + Number.EPSILON * Math.abs(value) * scale) / scale;
}

/** Làm tròn lên theo độ lớn (1,1 → 2; −35,5 → −36). */
export function ceilAbs(value: number, digits = 0): number {
  if (!Number.isFinite(value) || value === 0) return value === 0 ? 0 : value;
  const scale = 10 ** digits;
  return Math.sign(value) * Math.ceil(Math.abs(value) * scale - 1e-12) / scale;
}

export function formatStressNumber(value: number) {
  const abs = Math.abs(value);
  const digits = abs > 0 && abs < 0.001 ? 8 : abs < 0.01 ? 6 : 4;
  return value.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

export function releaseLengthLimit(radius: number, rollers: boolean): number | null {
  const bands = [
    [4000, Infinity, 500, 2000], [2000, 4000, 500, 1320],
    [1600, 2000, 500, 1000], [1200, 1600, 330, 800],
    [800, 1200, 330, 600], [600, 800, 330, 450], [400, 600, 330, 330],
  ];
  if (radius === 400) return null;
  if (radius < 400) return rollers ? 220 : 165;
  const band = bands.find(([lower, upper]) => radius > lower && radius <= upper);
  return band ? band[rollers ? 3 : 2] : null;
}

export function tensorThreshold(input: Pick<StressInput, "neutralTemp" | "lockTempOffset">) {
  return input.neutralTemp - input.lockTempOffset;
}

export function releaseMethodLabel(method: ReleaseMethod) {
  return method === "TENSOR" ? "Hàn có lực kéo" : "Giải toả tự nhiên";
}

export function validateStressInput(input: StressInput): string[] {
  const errors: string[] = [];
  if (Object.values(input).some((v) => typeof v === "number" && !Number.isFinite(v))) {
    return ["Vui lòng nhập đầy đủ các giá trị số hữu hạn."];
  }
  if (!input.railType.trim()) errors.push("Chưa chọn loại ray.");
  if ([input.area, input.modulus, input.alpha, input.resistance, input.radius].some((v) => v <= 0)) {
    errors.push("A, E, α, r và bán kính phải lớn hơn 0.");
  }
  if ([input.jackCylinderArea, input.minAnchorLength, input.lockTempOffset].some((v) => v <= 0)) {
    errors.push("Diện tích xilanh, chiều dài neo tối thiểu và biên độ khóa đường phải lớn hơn 0.");
  }
  if ([input.leftLength, input.rightLength, input.jointResistance, input.weldGap, input.currentGap].some((v) => v < 0)) {
    errors.push("Chiều dài, lực cản mối nối và khe hở không được âm.");
  }
  if (input.leftLength + input.rightLength <= 0) errors.push("Tổng chiều dài giải toả phải lớn hơn 0.");
  if (input.minTemp >= input.maxTemp) errors.push("Nhiệt độ ray nhỏ nhất phải thấp hơn nhiệt độ ray lớn nhất.");
  if (input.neutralTemp - input.lockTempOffset < input.minTemp || input.neutralTemp + input.lockTempOffset > input.maxTemp) {
    errors.push("Dải khóa đường T ± biên độ phải nằm trong khoảng nhiệt độ ray nhỏ nhất–lớn nhất.");
  }
  if (!["ATW", "FBW", "SINGLE"].includes(input.method)) errors.push("Phương pháp giải toả không hợp lệ.");
  return errors;
}

export function calculateStressRelease(input: StressInput) {
  const errors = validateStressInput(input);
  if (errors.length) throw new Error(errors.join(" "));
  const i = input;
  const length = i.leftLength + i.rightLength;
  const pullTemp = (i.leftTemp + i.rightTemp) / 2;
  const averageTemp = (i.leftTemp + i.rightTemp + pullTemp) / 3;
  const deltaTemp = i.neutralTemp - averageTemp;
  const ea = i.area * i.modulus;
  const forceRaw = excelRound(ea * i.alpha * deltaTemp, 2);
  const anchorLength = excelRound(forceRaw / i.resistance, 2);
  const actualAnchorLength = excelRound(anchorLength < i.minAnchorLength ? i.minAnchorLength : anchorLength, 2);
  const lockTempUpper = i.neutralTemp + i.lockTempOffset;
  const lockTempLower = i.neutralTemp - i.lockTempOffset;
  const compressionDelta = i.maxTemp - lockTempLower;
  const tensionDelta = lockTempUpper - i.minTemp;
  const compressionForceRaw = excelRound(ea * i.alpha * compressionDelta, 2);
  const tensionForceRaw = excelRound(ea * i.alpha * tensionDelta, 2);
  const endMovement = (p: number) => (p - i.jointResistance) ** 2 / (2 * ea * i.resistance) * 1000;
  const bufferMovement = (p: number) => ((p - i.jointResistance) * BUFFER_RAIL_LENGTH - i.resistance * BUFFER_RAIL_LENGTH ** 2 / 4) / (2 * ea) * 1000;
  const compressionEndRaw = endMovement(compressionForceRaw);
  const tensionEndRaw = endMovement(tensionForceRaw);
  const compressionBufferRaw = bufferMovement(compressionForceRaw);
  const tensionBufferRaw = bufferMovement(tensionForceRaw);
  const freeExtensionRaw = excelRound(deltaTemp * i.alpha * length * 1000, 2);
  const skipThreshold = lockTempLower;
  const skipPull = averageTemp >= skipThreshold;
  const releaseMethod: ReleaseMethod = skipPull ? "NATURAL" : "TENSOR";
  // Mốc M được phép dịch chuyển và được cộng bù; mốc F phải cố định.
  const movementCompensation = i.leftMovement + i.rightMovement;
  const fixedAnchorsStable = (i.leftOuterMovement ?? 0) === 0 && (i.rightOuterMovement ?? 0) === 0;
  const calculatedPullLength = skipPull ? 0 : ceilAbs(freeExtensionRaw);
  const rawPullLength = freeExtensionRaw + movementCompensation;
  const pullLength = skipPull ? 0 : ceilAbs(rawPullLength);
  const weldCut = i.method === "ATW" ? i.weldGap : i.fbwAllowance;
  const rawCutGap = i.method === "SINGLE" ? null : rawPullLength + weldCut;
  const cutGap = i.method === "SINGLE" ? null : ceilAbs(pullLength + weldCut);
  const lengthLimit = releaseLengthLimit(i.radius, i.sideRollers);
  const gapCheck = ea * (i.alpha * tensionDelta) ** 2 / i.resistance * 1000;
  const jackPressureRaw = (1000 * forceRaw) / (2 * i.jackCylinderArea);
  const appliedPullForce = skipPull ? 0 : ceilAbs(forceRaw);
  const jackPressure = skipPull ? 0 : ceilAbs(jackPressureRaw);
  const bufferContraction = ceilAbs(tensionDelta * i.alpha * BUFFER_RAIL_LENGTH * 1000);
  const bufferExpansion = ceilAbs(compressionDelta * i.alpha * BUFFER_RAIL_LENGTH * 1000);
  const warnings: string[] = [];
  if (!fixedAnchorsStable) warnings.push("Mốc ngoài F dịch chuyển khi kéo thử: neo chưa đạt. Phải tăng chiều dài neo hoặc áp dụng biện pháp tăng cường khác và kiểm tra lại; không cộng chuyển vị F vào khoảng cách kéo.");
  if (deltaTemp < 0) warnings.push("Nhiệt độ ray cao hơn nhiệt độ khóa đường: công thức cho lực/chiều dài kéo âm; không dùng làm lệnh căng kéo.");
  if (lengthLimit === null) warnings.push("Bảng tra không quy định rõ bán kính R = 400 m; cần xác nhận giới hạn chiều dài.");
  else if (length > lengthLimit) warnings.push(`Chiều dài ${length} m vượt giới hạn ${lengthLimit} m theo bảng tra đã chọn.`);
  if (compressionForceRaw < i.jointResistance || tensionForceRaw < i.jointResistance) warnings.push("Pmax nhỏ hơn Pj: chiều dài thở âm theo công thức Excel; cần kiểm tra phạm vi áp dụng.");
  if (cutGap !== null && cutGap >= 0 && cutGap < i.currentGap) {
    warnings.push("Khe hở mục tiêu nhỏ hơn khe hở hiện tại; không thể suy ra chiều dài cắt dương.");
  }
  if (skipPull) {
    warnings.push(
      `Nhiệt độ môi trường ≥ ${formatStressNumber(skipThreshold)}°C (T khóa − biên độ): giải toả tự nhiên, chiều dài kéo = 0, khe hở cắt mục tiêu = ${i.method === "FBW" ? "overlap" : "khe hở hàn"}.`,
    );
  }
  return {
    length, pullTemp, averageTemp, deltaTemp,
    forceRaw, force: ceilAbs(forceRaw),
    appliedPullForce, anchorLength, actualAnchorLength,
    jackPressureRaw, jackPressure, lockTempUpper, lockTempLower, skipPull, skipThreshold, releaseMethod,
    compressionForce: ceilAbs(compressionForceRaw),
    tensionForce: ceilAbs(tensionForceRaw),
    compressionEnd: ceilAbs(compressionEndRaw),
    tensionEnd: ceilAbs(tensionEndRaw),
    compressionExtension: ceilAbs(compressionDelta * i.alpha * length * 1000),
    tensionContraction: ceilAbs(tensionDelta * i.alpha * length * 1000),
    extensionChecks: [
      { label: "Đối chiếu 1", compression: compressionForceRaw * ((compressionForceRaw - i.jointResistance) / i.resistance) / (2 * ea) * 1000, tension: tensionForceRaw * ((tensionForceRaw - i.jointResistance) / i.resistance) / (2 * ea) * 1000 },
      { label: "Đối chiếu 2", compression: ((compressionForceRaw - i.jointResistance) / i.resistance) * i.alpha * compressionDelta / 2 * 1000, tension: ((tensionForceRaw - i.jointResistance) / i.resistance) * i.alpha * tensionDelta / 2 * 1000 },
      { label: "Đối chiếu 3 · bỏ qua lực cản mối nối", compression: ea * (i.alpha * compressionDelta) ** 2 / (2 * i.resistance) * 1000, tension: ea * (i.alpha * tensionDelta) ** 2 / (2 * i.resistance) * 1000 },
      { label: "TB 10015 · theo bảng tính", compression: compressionEndRaw, tension: tensionEndRaw },
    ],
    compressionDelta, tensionDelta,
    compressionForceRaw, tensionForceRaw,
    bufferDeformations: {
      longExpansion: compressionEndRaw,
      longContraction: tensionEndRaw,
      bufferExpansion: compressionBufferRaw,
      bufferContraction: tensionBufferRaw,
    } satisfies BufferDeformations,
    compressionBuffer: ceilAbs(compressionBufferRaw),
    tensionBuffer: ceilAbs(tensionBufferRaw),
    freeExtension: ceilAbs(freeExtensionRaw),
    freeExtensionRaw, movementCompensation, fixedAnchorsStable, calculatedPullLength, rawPullLength, pullLength, rawCutGap, cutGap,
    compressionBreathing: (compressionForceRaw - i.jointResistance) / i.resistance,
    tensionBreathing: (tensionForceRaw - i.jointResistance) / i.resistance,
    gapCheck, gapPass: gapCheck < i.allowedGap,
    bufferContraction, bufferExpansion,
    longGapUpper: i.structuralGap - (tensionEndRaw + tensionBufferRaw),
    longGapLower: compressionEndRaw + compressionBufferRaw,
    bufferGapUpper: i.structuralGap - 2 * tensionBufferRaw,
    bufferGapLower: 2 * compressionBufferRaw,
    lengthLimit, lengthPass: lengthLimit === null ? null : length <= lengthLimit,
    warnings,
  };
}

export type StressResult = ReturnType<typeof calculateStressRelease>;

export function lookupPullForce(weightKgPerM: number, neutralTemp: number, railTemp: number) {
  return excelRound(weightKgPerM * (neutralTemp - railTemp) * 0.03232);
}

export function lookupExtension(lengthM: number, neutralTemp: number, railTemp: number) {
  return excelRound((neutralTemp - railTemp) * 0.0115 * lengthM);
}
