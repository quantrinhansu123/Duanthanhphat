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
  centerHeight: number;
  railCenters: number;
  minRailTemperature: number;
  maxRailTemperature: number;
  lockTolerance: number;
  lockAdjustment: number;
  gapLimit: number;
  additionalStress: number;
  brakingStress: number;
  wheels: { position: number; load: number }[];
};

/** TB 10015 Appendix A and B.0.3, for standard-gauge ballasted track on formation. */
export function checkTb15Ground(input: GroundCheckInput) {
  const { wheels, area, ix, iy, steelModulus: E, expansion, minRailTemperature, maxRailTemperature } = input;
  const positive = [area, ix, iy, input.headModulus, input.baseModulus, E, expansion, input.yieldStress,
    input.seatStiffness, input.spacing, input.resistance, input.lateralResistance, input.lateralFactor,
    input.centerHeight, input.railCenters, input.gapLimit];
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

  const spacingMm = input.spacing * 1000;
  const foundation = input.seatStiffness * 1000 / spacingMm;
  const k = (foundation / (4 * E * ix)) ** 0.25;
  const alphaSpeed = input.speed > 160 ? 1 : input.speedCoefficient * input.speed / 100;
  const betaLoad = 2 * Math.abs(input.cantDeficiency) * input.centerHeight / input.railCenters ** 2;
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
  const riseLimit = allowedForce / (2 * E * expansion * area);
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
  return { sections, foundation, k, alphaSpeed, betaLoad, staticMoment, dynamicMoment, headStress, baseStress,
    stressLimit, dropStrength, halfWave: Math.sqrt(halfWaveSquared), criticalForce, allowedForce, riseLimit,
    dropGap, lockMin, lockMax, candidate, lockTemperature, drop, rise, gap, totalStress };
}
