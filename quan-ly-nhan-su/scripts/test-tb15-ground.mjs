import assert from "node:assert/strict";
import { checkTb15Ground } from "../src/features/lwr/lib/tb15-ground.ts";

// Cached workbook reference: 1_Độ bền ray and 2_Ổn định, method A (B.0.3).
const input = {
  area: 7745, ix: 32170000, iy: 5240000, headModulus: 339400, baseModulus: 396000,
  steelModulus: 210000, expansion: 1.18e-5, yieldStress: 472, safety: 1.3,
  seatStiffness: 33, spacing: 0.6, resistance: 15, lateralResistance: 11.5,
  speed: 200, speedCoefficient: 0.6, lateralFactor: 1.25, radius: 0, cantDeficiency: 0,
  centerHeight: 2300, railCenters: 1500, minRailTemperature: -27.4, maxRailTemperature: 61.9,
  lockTolerance: 5, lockAdjustment: 0, gapLimit: 70, additionalStress: 0, brakingStress: 0,
  wheels: [-17.5, -15, 0, 2.5, 7.5, 10, 25, 27.5].map((position) => ({ position, load: 83.4 })),
};
const result = checkTb15Ground(input);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);
close(result.foundation, 55);
close(result.staticMoment, 16501915.416280324);
close(result.sections[3].settlement, 0.8689435396051871);
close(result.sections[3].seatLoad, 28.675136806971178);
close(result.baseStress, 104.17875894116365);
close(result.dropStrength, 104.47867802088756);
close(result.halfWave, 313.86228758362535);
close(result.riseLimit, 96.15745848362717);
close(result.dropGap, 68.09140316539735);
assert.ok(result.lockTemperature !== null && result.gap <= input.gapLimit);
assert.equal(checkTb15Ground({ ...input, gapLimit: 0.01 }).lockTemperature, null);
assert.throws(() => checkTb15Ground({ ...input, wheels: [] }));
assert.throws(() => checkTb15Ground({ ...input, additionalStress: NaN }));
assert.throws(() => checkTb15Ground({ ...input, lockAdjustment: 6 }));
console.log("TB 10015: workbook reference and invalid inputs passed");
