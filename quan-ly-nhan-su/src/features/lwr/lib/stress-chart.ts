import { calculateStressRelease, type StressInput } from "./stress-release";

export interface StressChartPoint {
  x: number;
  p: number;
  extension: number;
}

export interface StressChartMeta {
  length: number;
  force: number;
  freeExtension: number;
  /** Display breathing length at each end (m) — exaggerated for visibility. */
  breathLeft: number;
  breathRight: number;
  /** True breathing length from (P − Pj)/r, may be <= 0. */
  rawBreath: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Smoothstep for rounded engineering corners (0 → 1). */
const smooth = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

/** Breathing-zone model shared by the chart and its shading. */
export function stressChartMeta(input: StressInput): StressChartMeta {
  const result = calculateStressRelease(input);
  const L = result.length;
  const raw = (Math.abs(result.force) - input.jointResistance) / input.resistance;
  // Real breathing zones are only a few metres on a 500 m rail → invisible.
  // Enforce a minimum visual width so the trapezoid reads on screen, cap so
  // a locked centre always remains. Caption in the chart discloses this.
  const visual = Math.max(raw, L * 0.14);
  const lb = Math.min(visual, L * 0.3);
  return {
    length: L,
    force: result.force,
    freeExtension: result.freeExtension,
    breathLeft: lb,
    breathRight: lb,
    rawBreath: raw,
  };
}

/** Visualize K40 and K43 with breathing zones at both rail ends.
 *
 *  Physics: in the locked centre the longitudinal force holds the K40
 *  target; inside each breathing zone the force ramps 0 → P following
 *  the longitudinal resistance (smoothstep for rounded corners).
 *  Cumulative extension is the integral of P(x)/EA, scaled so the end
 *  ordinate lands exactly on the rounded K43 total — parabolic near the
 *  ends, linear in the centre, instead of a ruler-straight diagonal.
 */
export function buildStressChartData(input: StressInput): StressChartPoint[] {
  const result = calculateStressRelease(input);
  const meta = stressChartMeta(input);
  const { length: L, force: P, freeExtension } = meta;
  const lb = meta.breathLeft;
  const N = 121;
  const ea = input.area * input.modulus; // kN

  const raw: StressChartPoint[] = [];
  for (let i = 0; i < N; i++) {
    const x = (L * i) / (N - 1);
    let factor = 1;
    if (lb > 0 && L > 0) {
      factor = Math.min(smooth(x / lb), smooth((L - x) / lb));
    }
    raw.push({ x, p: P * factor, extension: 0 });
  }

  // Cumulative extension = ∫ P(x)/EA dx, trapezoidal integration.
  let acc = 0;
  for (let i = 1; i < N; i++) {
    const dx = raw[i].x - raw[i - 1].x;
    const pAvg = (raw[i].p + raw[i - 1].p) / 2;
    acc += (ea !== 0 ? (pAvg / ea) * dx * 1000 : 0);
    raw[i].extension = acc;
  }

  // Scale so the curve ends exactly on K43 (preserves the Excel total).
  const total = raw[N - 1].extension;
  if (Math.abs(total) > 1e-9 && Math.abs(freeExtension) > 1e-9) {
    const k = freeExtension / total;
    for (const pt of raw) pt.extension *= k;
  } else {
    // P ≈ 0: fall back to the linear K43 shape (flat zero or tiny slope).
    for (let i = 0; i < N; i++) raw[i].extension = (freeExtension * i) / (N - 1);
  }

  // Round for clean tooltips (keep full resolution for x).
  return raw.map((pt) => ({
    x: Math.round(pt.x * 100) / 100,
    p: Math.round(pt.p * 100) / 100,
    extension: Math.round(pt.extension * 100) / 100,
  }));
}
