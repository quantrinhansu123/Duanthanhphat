/** Bảng B.0.4-1 (q₀, B, Z, C, N) và B.0.4-2 (H, μ) theo loại tà vẹt / phụ kiện đàn hồi. */
export type IrregularInput = {
  q0: number; // N/cm — B.0.4-1
  B: number; Z: number; C: number; N: number; // B.0.4-1
  H: number; // N·cm/cm — B.0.4-2
  mu: number; // B.0.4-2
  l0: number; // cm — B.0.4-3 (theo loại ray)
  i0Permil: number; // ‰ — B.0.4-3
  dpKn: number; // kN — B.0.4-3
};

export type RiseMethod = "uniform" | "irregular" | "min";

export type GroundCheckInput = {
  area: number;
  ix: number;
  iy: number;
  headModulus: number;
  baseModulus: number;
  steelModulus: number;
  expansion: number;
  yieldStress: number;
  safety: number;
  seatStiffness: number;
  spacing: number;
  resistance: number;
  lateralResistance: number;
  speed: number;
  speedCoefficient: number;
  lateralFactor: number;
  radius: number;
  cantDeficiency: number;
  minRailTemperature: number;
  maxRailTemperature: number;
  lockTolerance: number;
  lockAdjustment: number;
  gapLimit: number;
  additionalStress: number;
  brakingStress: number;
  wheels: { position: number; load: number }[];
  /**
   * Chiều cao trọng tâm H và khoảng cách tim hai ray S, mm.
   * Bỏ trống: β = 0,002·Δh. Cặp H = 2.300, S = 1.500 cũng dùng 0,002·Δh (A.0.2-3).
   * Cặp khác dùng β = 2·Δh·H/S².
   */
  cgHeightMm?: number;
  railCenterMm?: number;
  /** Phương pháp ổn định dùng cho [ΔT_u]; mặc định "irregular" như sheet Nhập liệu của Excel. */
  riseMethod?: RiseMethod;
  /** Bắt buộc khi riseMethod là "irregular" hoặc "min". */
  irregular?: IrregularInput;
};

/** Gamma log (Lanczos, g = 7) — tương đương GAMMALN của Excel. */
function lnGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61503916999385, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  const z = x - 1;
  let a = c[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Phương pháp B.0.4 (bước sóng không đều) — đúng sheet 2_Ổn định của bảng tính Excel.
 * Đơn vị trong công thức: N, cm. Quét l từ 100 đến 1 500 cm, bước 5 cm.
 */
function irregularRise(input: GroundCheckInput, p: IrregularInput) {
  const f = 0.02; // cm — B.0.4-2 (độ võng uốn)
  const d = 0.5833; // tỷ lệ uốn đàn hồi trong tổng uốn ban đầu (B.0.4)
  const { Z, N, mu, B, C, q0, H, l0, i0Permil } = p;
  if ([Z, N, mu, B, C, q0, H, l0, i0Permil].some((v) => !Number.isFinite(v) || v <= 0) || !Number.isFinite(p.dpKn)) {
    throw new Error("Thiếu thông số phương pháp B.0.4 (B.0.4-1 đến B.0.4-3).");
  }
  const E = input.steelModulus * 100; // N/cm²
  const Iy = input.iy / 1e4; // cm⁴
  const i0 = i0Permil / 1000;
  const G = Math.exp(lnGamma((2 * (1 + Z) + 1) / 2) - lnGamma((2 * (1 + Z)) / 2 + 1)) / Math.sqrt(Math.PI);
  const a = (2 * (1 + N)) / N;
  const K = Math.exp(lnGamma((a + 1) / 2) - lnGamma(a / 2 + 1)) / Math.sqrt(Math.PI);
  const psi = Math.PI ** ((1 + mu) / mu)
    * Math.exp(lnGamma(((mu + 1) / mu + 1) / 2) - lnGamma(((mu + 1) / mu) / 2 + 1)) / Math.sqrt(Math.PI);
  const R = input.radius;
  let pMin = Infinity;
  let lMin = 0;
  for (let l = 100; l <= 1500; l += 5) {
    const phi = l < l0
      ? (2 * l0 * l) / (Math.PI * (l0 * l0 - l * l)) * Math.sin((Math.PI * l) / l0)
      : l === l0
        ? 1
        : (2 * l0 * l0) / (Math.PI * (l * l - l0 * l0)) * Math.sin((Math.PI * l0) / l);
    const eta = l < l0 ? (phi * l0) / l : l === l0 ? 1 : (phi * l) / l0;
    const tauI = 8 * E * Iy * Math.PI ** 2 * (f / (l * l) + (d * i0) / l0 * phi);
    const tauQM = ((l * l) / Math.PI ** 2) * (q0 - 2 * B * G * f ** Z + 2 * C * K * f ** (1 / N))
      + (2 * psi * H) / Math.PI ** 2 * f ** (1 / mu) * l ** ((mu - 1) / mu);
    const curve = R === 0 ? 0 : (l * l) / (R * 100 * Math.PI ** 2);
    const P = (tauI + tauQM) / (f + l * i0 * eta + curve);
    if (P < pMin) {
      pMin = P;
      lMin = l;
    }
  }
  const dropN = p.dpKn * 1000;
  const deltaT = (pMin / 2 - dropN) / (input.steelModulus * input.expansion * input.area);
  const riseLimit = R === 0 || R >= 2000 ? deltaT - 8 : deltaT;
  return { pMin, lMin, deltaT, riseLimit, psi, G, K };
}

/** β lệch tải. Cặp chuẩn H = 2.300 mm, S = 1.500 mm khớp β = 0,002·Δh của Excel (A.0.2-3). */
export function cantBeta(cantDeficiencyMm: number, cgHeightMm?: number, railCenterMm?: number) {
  const dh = Math.abs(cantDeficiencyMm);
  const named = cgHeightMm !== undefined || railCenterMm !== undefined;
  if (!named) return { beta: 0.002 * dh, standard: true };
  if (!(typeof cgHeightMm === "number" && cgHeightMm > 0) || !(typeof railCenterMm === "number" && railCenterMm > 0)) {
    throw new Error("Chiều cao trọng tâm H và khoảng cách tim ray S phải lớn hơn 0.");
  }
  const standard = cgHeightMm === 2300 && railCenterMm === 1500;
  return {
    beta: standard ? 0.002 * dh : (2 * dh * cgHeightMm) / (railCenterMm * railCenterMm),
    standard,
  };
}

/** TB 10015 Appendix A and B.0.3, for standard-gauge ballasted track on formation. */
export function checkTb15Ground(input: GroundCheckInput) {
  const { wheels, area, ix, iy, steelModulus: E, expansion, minRailTemperature, maxRailTemperature } = input;
  const method: RiseMethod = input.riseMethod ?? "irregular";
  const positive = [area, ix, iy, input.headModulus, input.baseModulus, E, expansion, input.yieldStress,
    input.seatStiffness, input.spacing, input.resistance, input.lateralResistance, input.lateralFactor,
    input.gapLimit];
  const nonnegative = [input.speed, input.speedCoefficient, input.radius, input.lockTolerance,
    input.additionalStress, input.brakingStress];
  if (positive.some((n) => !Number.isFinite(n) || n <= 0) ||
    nonnegative.some((n) => !Number.isFinite(n) || n < 0) ||
    !Number.isFinite(input.safety) || input.safety < 1.3 ||
    !Number.isFinite(input.cantDeficiency) ||
    !Number.isFinite(input.lockAdjustment) || Math.abs(input.lockAdjustment) > 5 ||
    ![3, 5].includes(input.lockTolerance) ||
    !Number.isFinite(minRailTemperature) || !Number.isFinite(maxRailTemperature) ||
    minRailTemperature >= maxRailTemperature || !wheels.length ||
    wheels.some(({ position, load }) => !Number.isFinite(position) || !Number.isFinite(load) || load <= 0) ||
    new Set(wheels.map(({ position }) => position)).size !== wheels.length) {
    throw new Error("Thông số đầu vào thiếu hoặc nằm ngoài miền tính.");
  }
  if (method !== "uniform" && !input.irregular) {
    throw new Error("Thiếu thông số phương pháp B.0.4 (B.0.4-1 đến B.0.4-3).");
  }

  const spacingMm = input.spacing * 1000;
  const foundation = input.seatStiffness * 1000 / spacingMm;
  const k = (foundation / (4 * E * ix)) ** 0.25;
  const { beta: betaLoad, standard: betaStandard } = cantBeta(input.cantDeficiency, input.cgHeightMm, input.railCenterMm);
  const alphaSpeed = input.speed > 160 ? 1 : input.speedCoefficient * input.speed / 100;
  const sections = wheels.map((wheel) => {
    let settlementLoad = 0;
    let bendingLoad = 0;
    for (const other of wheels) {
      const z = k * Math.abs(wheel.position - other.position) * 1000;
      const scaled = other.load * 1000 * Math.exp(-z);
      settlementLoad += scaled * (Math.cos(z) + Math.sin(z));
      bendingLoad += scaled * (Math.cos(z) - Math.sin(z));
    }
    return {
      ...wheel,
      dynamicLoad: wheel.load * (1 + alphaSpeed),
      moment: bendingLoad / (4 * k),
      settlement: k * settlementLoad / (2 * foundation),
      seatLoad: k * spacingMm * settlementLoad / 2000,
    };
  });
  const staticMoment = Math.max(...sections.map(({ moment }) => moment));
  const dynamicMoment = staticMoment * (1 + alphaSpeed + betaLoad);
  const headStress = dynamicMoment * input.lateralFactor / input.headModulus;
  const baseStress = dynamicMoment * input.lateralFactor / input.baseModulus;
  const stressLimit = input.yieldStress / input.safety;
  const dropStrength = (stressLimit - baseStress - input.additionalStress - input.brakingStress) / (E * expansion);

  // Appendix B uses N and cm. The critical force refers to both rails.
  const f = 0.2;
  const t = 0.17 * 2.103e-6;
  const curvature = (input.radius === 0 ? 0 : 1 / (100 * input.radius)) + 8 * 0.83 * 2.103e-6;
  const rigidity = 2 * (E * 100) * (iy / 1e4) * Math.PI ** 2;
  const curvatureTerm = 4 * curvature / Math.PI ** 3;
  const omega = rigidity * (t + curvatureTerm);
  const ballastTerm = 4 * input.lateralResistance * 10 / Math.PI ** 3;
  const denominator = ballastTerm - omega * t / f;
  if (!(denominator > 0)) throw new Error("Không xác định được nửa bước sóng dương theo B.0.3-5.");
  const halfWaveSquared = (omega + Math.sqrt(omega ** 2 + denominator * f * rigidity)) / denominator;
  const initialDeflection = t * halfWaveSquared;
  const criticalForce = (rigidity * (f + initialDeflection) / halfWaveSquared + ballastTerm * halfWaveSquared)
    / (f + initialDeflection + curvatureTerm * halfWaveSquared);
  const allowedForce = criticalForce / input.safety;
  // B.0.3 (phương pháp A) — Excel: [ΔT_u] = [P]/(2EαF) khi P_f = 0 (nền đường).
  const riseUniform = allowedForce / (2 * E * expansion * area);

  // Phương pháp B.0.4 chỉ chạy khi được chọn; "min" lấy giá trị nhỏ hơn của A và B.
  const irregular = method !== "uniform" && input.irregular ? irregularRise(input, input.irregular) : null;
  const riseIrregular = irregular ? irregular.riseLimit : null;
  const riseLimit = method === "uniform"
    ? riseUniform
    : method === "irregular"
      ? (riseIrregular as number)
      : Math.min(riseUniform, riseIrregular as number);

  const dropGap = Math.sqrt(input.gapLimit * input.resistance / (E * area)) / expansion;
  const lockMin = Math.max(minRailTemperature, maxRailTemperature - riseLimit) + input.lockTolerance;
  const lockMax = Math.min(maxRailTemperature, minRailTemperature + Math.min(dropStrength, dropGap)) - input.lockTolerance;
  const candidate = (maxRailTemperature + minRailTemperature + dropStrength - riseLimit) / 2 + input.lockAdjustment;
  const lockTemperature = candidate >= lockMin && candidate <= lockMax ? candidate : null;
  const drop = lockTemperature === null ? null : lockTemperature + input.lockTolerance - minRailTemperature;
  const rise = lockTemperature === null ? null : maxRailTemperature - lockTemperature + input.lockTolerance;
  const gap = drop === null ? null : E * area * (expansion * drop) ** 2 / input.resistance;
  const totalStress = drop === null ? null : baseStress + E * expansion * drop + input.additionalStress + input.brakingStress;
  if (![foundation, k, baseStress, dropStrength, riseLimit, dropGap, lockMin, lockMax].every(Number.isFinite)) {
    throw new Error("Kết quả vượt miền số của phép tính. Kiểm tra đơn vị và đầu vào.");
  }
  return {
    sections, foundation, k, alphaSpeed, betaLoad, betaStandard, staticMoment, dynamicMoment, headStress, baseStress,
    stressLimit, dropStrength, halfWave: Math.sqrt(halfWaveSquared), criticalForce, allowedForce, riseLimit,
    riseUniform, riseIrregular, irregularHalfWave: irregular?.lMin ?? null, irregularMinP: irregular?.pMin ?? null,
    riseMethod: method, dropGap, lockMin, lockMax, candidate, lockTemperature, drop, rise, gap, totalStress,
  };
}
