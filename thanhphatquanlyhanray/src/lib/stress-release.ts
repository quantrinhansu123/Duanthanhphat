/** Reproduction of “Bảng tính mẫu 60R2”; units: m, kN, °C, mm. */
export interface StressInput {
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
  sideRollers: boolean;
  method: "ATW" | "FBW" | "SINGLE";
}

export const DEFAULT_STRESS_INPUT: StressInput = {
  area: 0.007611, modulus: 210840000, alpha: 0.0000115,
  resistance: 24, jointResistance: 400, leftLength: 500, rightLength: 0,
  radius: 1000, neutralTemp: 35, leftTemp: 20, rightTemp: 20,
  maxTemp: 57, minTemp: 16, weldGap: 26, fbwAllowance: -35.5,
  currentGap: 0, structuralGap: 18, leftMovement: 0, rightMovement: 0,
  sideRollers: false, method: "ATW",
};

/** Excel ROUND: ties away from zero, including negative FBW allowances. */
export function excelRound(value: number, digits = 0): number {
  const scale = 10 ** digits;
  return Math.sign(value) * Math.round(Math.abs(value) * scale + Number.EPSILON * Math.abs(value) * scale) / scale;
}

export function releaseLengthLimit(radius: number, rollers: boolean): number | null {
  // The workbook leaves R=400 and fractional gaps between labelled ranges undefined.
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

export function validateStressInput(input: StressInput): string[] {
  const errors: string[] = [];
  if (Object.values(input).some((v) => typeof v === "number" && !Number.isFinite(v))) {
    return ["Vui lòng nhập đầy đủ các giá trị số hữu hạn."];
  }
  if ([input.area, input.modulus, input.alpha, input.resistance, input.radius, input.structuralGap].some((v) => v <= 0)) errors.push("A, E, α, r, bán kính và khe hở cấu tạo phải lớn hơn 0.");
  if ([input.leftLength, input.rightLength, input.jointResistance, input.weldGap, input.currentGap].some((v) => v < 0)) errors.push("Chiều dài, lực cản mối nối và khe hở không được âm.");
  if (input.leftLength + input.rightLength <= 0) errors.push("Tổng chiều dài giải toả phải lớn hơn 0.");
  if (input.minTemp >= input.maxTemp) errors.push("Nhiệt độ ray nhỏ nhất phải thấp hơn nhiệt độ ray lớn nhất.");
  if (input.neutralTemp - 5 < input.minTemp || input.neutralTemp + 5 > input.maxTemp) errors.push("Dải khóa đường T ± 5°C phải nằm trong khoảng nhiệt độ ray nhỏ nhất–lớn nhất.");
  if (!["ATW", "FBW", "SINGLE"].includes(input.method)) errors.push("Phương pháp giải toả không hợp lệ.");
  return errors;
}

export function calculateStressRelease(input: StressInput) {
  const errors = validateStressInput(input);
  if (errors.length) throw new Error(errors.join(" "));
  const i = input;
  const length = i.leftLength + i.rightLength;
  const pullTemp = (i.leftTemp + i.rightTemp) / 2;
  const averageTemp = excelRound((i.leftTemp + i.rightTemp + pullTemp) / 3);
  const deltaTemp = i.neutralTemp - averageTemp;
  const ea = i.area * i.modulus;
  const force = excelRound(ea * i.alpha * deltaTemp, 2);
  const anchorLength = excelRound(force / i.resistance, 2);
  const compressionDelta = i.maxTemp - (i.neutralTemp - 5);
  const tensionDelta = i.neutralTemp + 5 - i.minTemp;
  const compressionForce = excelRound(ea * i.alpha * compressionDelta, 2);
  const tensionForce = excelRound(ea * i.alpha * tensionDelta, 2);
  const endMovement = (p: number) => (p - i.jointResistance) ** 2 / (2 * ea * i.resistance) * 1000;
  const bufferMovement = (p: number) => ((p - i.jointResistance) * 25 - i.resistance * 25 ** 2 / 4) / (2 * ea) * 1000;
  const compressionEnd = endMovement(compressionForce);
  const tensionEnd = endMovement(tensionForce);
  const compressionBuffer = bufferMovement(compressionForce);
  const tensionBuffer = bufferMovement(tensionForce);
  const freeExtension = excelRound(deltaTemp * i.alpha * length * 1000, 2);
  const pullLength = freeExtension + i.leftMovement + i.rightMovement;
  const cutGap = i.method === "SINGLE" ? null : pullLength + (i.method === "ATW" ? i.weldGap : i.fbwAllowance);
  const lengthLimit = releaseLengthLimit(i.radius, i.sideRollers);
  const gapCheck = ea * (i.alpha * tensionDelta) ** 2 / i.resistance * 1000;
  const warnings: string[] = [];
  if (deltaTemp < 0) warnings.push("Nhiệt độ ray cao hơn nhiệt độ khóa đường: công thức cho lực/chiều dài kéo âm; không dùng làm lệnh căng kéo.");
  if (lengthLimit === null) warnings.push("Bảng tra không quy định rõ bán kính R = 400 m; cần xác nhận giới hạn chiều dài.");
  else if (length > lengthLimit) warnings.push(`Chiều dài ${length} m vượt giới hạn ${lengthLimit} m theo bảng tra đã chọn.`);
  if (compressionForce < i.jointResistance || tensionForce < i.jointResistance) warnings.push("Pmax nhỏ hơn Pj: chiều dài thở âm theo công thức Excel; cần kiểm tra phạm vi áp dụng.");
  if (compressionBuffer < 0 || tensionBuffer < 0) warnings.push("Công thức ray đệm 25 m cho chuyển vị âm. Giữ nguyên để đối chiếu Excel; chưa xác nhận khoảng khe hở thi công.");
  if (cutGap !== null && cutGap < i.currentGap) warnings.push("Khe hở mục tiêu nhỏ hơn khe hở hiện tại; không thể suy ra chiều dài cắt dương.");
  return {
    length, pullTemp, averageTemp, deltaTemp, force, anchorLength,
    compressionForce, tensionForce, compressionEnd, tensionEnd,
    compressionBuffer, tensionBuffer, freeExtension, pullLength, cutGap,
    compressionBreathing: (compressionForce - i.jointResistance) / i.resistance,
    tensionBreathing: (tensionForce - i.jointResistance) / i.resistance,
    gapCheck, gapPass: gapCheck <= i.structuralGap,
    longGapUpper: i.structuralGap - (tensionEnd + tensionBuffer),
    longGapLower: compressionEnd + compressionBuffer,
    bufferGapUpper: i.structuralGap - 2 * tensionBuffer,
    bufferGapLower: 2 * compressionBuffer,
    lengthLimit, lengthPass: lengthLimit === null ? null : length <= lengthLimit,
    warnings,
  };
}

export function lookupPullForce(weightKgPerM: number, neutralTemp: number, railTemp: number) {
  return excelRound(weightKgPerM * (neutralTemp - railTemp) * 0.03232);
}

export function lookupExtension(lengthM: number, neutralTemp: number, railTemp: number) {
  return excelRound((neutralTemp - railTemp) * 0.0115 * lengthM);
}
