import assert from "node:assert/strict";
import { checkTb15Ground } from "../src/features/lwr/lib/tb15-ground.ts";

// Cached workbook reference: 1_Độ bền ray and 2_Ổn định (ray 60 kg/m, tà vẹt III, D=33, R=0).
const irregular = {
  q0: 27.4, B: 92, Z: 1.2, C: 179, N: 2.5, // B.0.4-1 (tà vẹt III, D=33)
  H: 22000, mu: 2, // B.0.4-2 (đàn hồi loại II)
  l0: 720, i0Permil: 1, dpKn: 154, // B.0.4-3 (ray 60 kg/m)
};
const input = {
  area: 7745, ix: 32170000, iy: 5240000, headModulus: 339400, baseModulus: 396000,
  steelModulus: 210000, expansion: 1.18e-5, yieldStress: 472, safety: 1.3,
  seatStiffness: 33, spacing: 0.6, resistance: 15, lateralResistance: 11.5,
  speed: 200, speedCoefficient: 0.6, lateralFactor: 1.25, radius: 0, cantDeficiency: 0,
  minRailTemperature: -27.4, maxRailTemperature: 61.9,
  lockTolerance: 5, lockAdjustment: 0, gapLimit: 70, additionalStress: 0, brakingStress: 0,
  wheels: [-17.5, -15, 0, 2.5, 7.5, 10, 25, 27.5].map((position) => ({ position, load: 83.4 })),
  riseMethod: "irregular",
  irregular,
};
const result = checkTb15Ground(input);
const close = (actual, expected, tol = 1e-7) =>
  assert.ok(Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)), `${actual} vs ${expected}`);

// Method A (B.0.3, uniform) — unchanged reference.
close(result.foundation, 55);
close(result.staticMoment, 16501915.416280324);
close(result.sections[3].settlement, 0.8689435396051871);
close(result.sections[3].seatLoad, 28.675136806971178);
close(result.baseStress, 104.17875894116365);
close(result.dropStrength, 104.47867802088756);
close(result.halfWave, 313.86228758362535);
close(result.dropGap, 68.09140316539735);
close(result.riseUniform, 96.15745848362717);

// β = 0.002·Δh (A.0.2-3): Δh = 100 mm → β = 0,2.
close(checkTb15Ground({ ...input, cantDeficiency: 100, riseMethod: "uniform" }).betaLoad, 0.2);
const standardGauge = checkTb15Ground({ ...input, cantDeficiency: 100, riseMethod: "uniform", cgHeightMm: 2300, railCenterMm: 1500 });
close(standardGauge.betaLoad, 0.2);
assert.equal(standardGauge.betaStandard, true);
const meter = checkTb15Ground({ ...input, cantDeficiency: 100, riseMethod: "uniform", cgHeightMm: 2000, railCenterMm: 1100 });
close(meter.betaLoad, (2 * 100 * 2000) / (1100 * 1100));
assert.equal(meter.betaStandard, false);
close(result.betaLoad, 0);
assert.throws(() => checkTb15Ground({ ...input, cgHeightMm: 2300, riseMethod: "uniform" }));

// Method B (B.0.4 irregular) — Excel 2_Ổn định: P_min 3.82809e6 N at l = 385 cm, ΔT 91.7066, [ΔT_u](B) 83.7066.
close(result.irregularMinP, 3828090, 1e-5);
assert.equal(result.irregularHalfWave, 385);
close(result.riseIrregular, 83.7066, 1e-5);
close(result.riseLimit, result.riseIrregular);
assert.equal(result.riseMethod, "irregular");
close(checkTb15Ground({ ...input, riseMethod: "uniform" }).riseLimit, 96.15745848362717);
close(checkTb15Ground({ ...input, riseMethod: "min" }).riseLimit, Math.min(96.15745848362717, 83.7066), 1e-5);

// Lock temperature and gap checks use the chosen riseLimit.
assert.ok(result.lockTemperature !== null && result.gap <= input.gapLimit);
assert.equal(checkTb15Ground({ ...input, gapLimit: 0.01 }).lockTemperature, null);

// Invalid inputs.
assert.throws(() => checkTb15Ground({ ...input, irregular: undefined }));
assert.throws(() => checkTb15Ground({ ...input, wheels: [] }));
assert.throws(() => checkTb15Ground({ ...input, additionalStress: NaN }));
assert.throws(() => checkTb15Ground({ ...input, lockAdjustment: 6 }));

console.log("TB 10015: workbook reference (method A + B) and invalid inputs passed");
