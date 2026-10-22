import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  calculateStressRelease,
  ceilAbs,
  DEFAULT_STRESS_INPUT,
  formatStressNumber,
  getRailProfile,
  RAIL_PROFILES,
  USER_DEFINE_RAIL_ID,
} from "../src/features/lwr/lib/stress-release.ts";

const sheet = JSON.parse(readFileSync(new URL("./fixtures/lwr-60r2.json", import.meta.url), "utf8")).cells;
test("60R2 intermediates still match workbook (2)", () => {
  const result = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, resistance: 24, jointResistance: 400 });
  assert.equal(result.length, sheet.K26.v);
  assert.equal(result.averageTemp, sheet.K31.v);
  assert.equal(result.deltaTemp, sheet.V31.v);
  assert.equal(result.forceRaw, sheet.K40.v);
  assert.equal(result.anchorLength, sheet.V40.v);
  assert.equal(result.compressionDelta, 27);
  assert.equal(result.tensionDelta, 24);
  assert.ok(Math.abs(result.compressionBreathing - sheet.K44.v) < 1e-9);
  assert.ok(Math.abs(result.tensionBreathing - sheet.K45.v) < 1e-9);
  assert.ok(Math.abs(result.gapCheck - sheet.K46.v) < 1e-9);
  assert.ok(Math.abs(result.longGapUpper - sheet.K49.v) < 1e-9);
  assert.ok(Math.abs(result.longGapLower - sheet.V49.v) < 1e-9);
  result.extensionChecks.forEach((row, index) => {
    for (const [key, column] of [["compression", "R"], ["tension", "T"]]) {
      const cell = column + (75 + index);
      assert.ok(Math.abs(row[key] - sheet[cell].v) < 1e-9, cell);
    }
  });
});
test("joint resistance changes checks 1, 2 and TB row but not check 3", () => {
  const original = calculateStressRelease(DEFAULT_STRESS_INPUT);
  const changed = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, jointResistance: 100 });
  for (const key of ["compression", "tension"]) {
    for (const index of [0, 1, 3]) assert.notEqual(original.extensionChecks[index][key], changed.extensionChecks[index][key]);
    assert.equal(original.extensionChecks[2][key], changed.extensionChecks[2][key]);
  }
});
test("applied anchor length uses 20 m when design is shorter", () => {
  const result = calculateStressRelease(DEFAULT_STRESS_INPUT);
  assert.equal(result.anchorLength, 19.22);
  assert.equal(result.actualAnchorLength, 20);
  const long = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, resistance: 10 });
  assert.ok(long.anchorLength > 20);
  assert.equal(long.actualAnchorLength, long.anchorLength);
});
test("ambient below lock minus offset uses Rail Tensor", () => {
  const result = calculateStressRelease(DEFAULT_STRESS_INPUT);
  assert.equal(result.averageTemp, 20);
  assert.equal(result.skipThreshold, 30);
  assert.equal(result.releaseMethod, "TENSOR");
  assert.equal(result.skipPull, false);
  assert.equal(result.pullLength, 87);
  assert.equal(result.cutGap, 113);
  assert.equal(result.appliedPullForce, 277);
});
test("ambient at or above lock minus offset is natural release", () => {
  const atw = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, leftTemp: 30, rightTemp: 30, method: "ATW" });
  assert.equal(atw.averageTemp, 30);
  assert.equal(atw.releaseMethod, "NATURAL");
  assert.equal(atw.pullLength, 0);
  assert.equal(atw.appliedPullForce, 0);
  assert.equal(atw.jackPressure, 0);
  assert.equal(atw.cutGap, DEFAULT_STRESS_INPUT.weldGap);
  const fbw = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, leftTemp: 32, rightTemp: 32, method: "FBW" });
  assert.equal(fbw.releaseMethod, "NATURAL");
  assert.equal(fbw.pullLength, 0);
  assert.equal(fbw.cutGap, -36);
});
test("FBW tensor gap is pull length minus 35.5 mm, ceiled", () => {
  const fbw = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, method: "FBW" });
  assert.equal(fbw.releaseMethod, "TENSOR");
  assert.equal(fbw.pullLength, 87);
  assert.equal(fbw.cutGap, 52);
});
test("oil pressure rounds up to an integer from 1000 F / 2 A", () => {
  const result = calculateStressRelease(DEFAULT_STRESS_INPUT);
  const raw = (1000 * result.forceRaw) / (2 * DEFAULT_STRESS_INPUT.jackCylinderArea);
  assert.equal(result.jackPressure, ceilAbs(raw));
  assert.equal(result.jackPressure, 12);
});
test("length and force results round up to whole millimetres or kN", () => {
  const result = calculateStressRelease(DEFAULT_STRESS_INPUT);
  assert.equal(result.freeExtension, 87);
  assert.equal(result.force, 277);
  assert.equal(result.bufferContraction, 7);
  assert.equal(result.bufferExpansion, 8);
});
test("catalog has nine fixed rails plus User Define", () => {
  assert.equal(RAIL_PROFILES.length, 9);
  assert.equal(getRailProfile("60R2")?.area, 0.007611);
  assert.equal(getRailProfile(USER_DEFINE_RAIL_ID), null);
});
test("changing lock temperature moves the tensor threshold", () => {
  const result = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, leftTemp: 32, rightTemp: 32, neutralTemp: 40 });
  assert.equal(result.skipThreshold, 35);
  assert.equal(result.releaseMethod, "TENSOR");
});
test("alpha prints with enough digits instead of rounding to 0", () => {
  assert.match(formatStressNumber(0.0000115), /0[,.]0000115/);
});
test("legacy params keep sample defaults for new keys", () => {
  const { jackCylinderArea, minAnchorLength, allowedGap, lockTempOffset, railType, ...legacy } = DEFAULT_STRESS_INPUT;
  const merged = { ...DEFAULT_STRESS_INPUT, ...legacy };
  const result = calculateStressRelease(merged);
  assert.equal(merged.jackCylinderArea, jackCylinderArea);
  assert.equal(merged.minAnchorLength, minAnchorLength);
  assert.equal(merged.allowedGap, allowedGap);
  assert.equal(merged.lockTempOffset, lockTempOffset);
  assert.equal(merged.railType, railType);
  assert.equal(result.actualAnchorLength, 20);
});
