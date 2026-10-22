import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateBufferGaps } from "../src/features/lwr/lib/buffer-gap.ts";
import { calculateStressRelease, DEFAULT_STRESS_INPUT } from "../src/features/lwr/lib/stress-release.ts";
import { validateStressParams } from "../src/features/lwr/lib/track-editor.ts";

// Synthetic deltas exercise the supplied inequalities; these are not app defaults.
const deltas = { longExpansion: 6, longContraction: 4.5, bufferExpansion: 3, bufferContraction: 2.5 };
test("provided 60R2 sample automatically derives movements and safe integer gaps", () => {
  const result = calculateStressRelease(DEFAULT_STRESS_INPUT);
  assert.equal(result.compressionDelta, 27);
  assert.equal(result.tensionDelta, 24);
  assert.equal(result.compressionForceRaw, 498.26);
  assert.equal(result.tensionForceRaw, 442.9);
  const expected = [5.3719, 4.2445, 3.1802, 2.7490];
  Object.values(result.bufferDeformations).forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 0.0001));
  const [a1, a2] = calculateBufferGaps(18, result.bufferDeformations);
  assert.deepEqual([a1.lower, a1.upper, a2.lower, a2.upper], [9, 11, 7, 12]);
});
test("automatic movements respond to r and Pj and ignore stale manually saved deltas", () => {
  const original = calculateStressRelease(DEFAULT_STRESS_INPUT).bufferDeformations;
  const legacy = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, bufferDeformations: deltas });
  assert.deepEqual(legacy.bufferDeformations, original);
  for (const change of [{ resistance: 20 }, { jointResistance: 100 }]) {
    const changed = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, ...change }).bufferDeformations;
    for (const key of Object.keys(original)) assert.notEqual(changed[key], original[key]);
  }
});
test("gap bounds use expansion for lower limits and contraction for upper limits", () => {
  const [a1, a2] = calculateBufferGaps(18, deltas);
  assert.deepEqual([a1.lower, a1.upper, a2.lower, a2.upper], [9, 11, 6, 13]);
  assert.equal(a1.feasible, true);
  assert.equal(a2.feasible, true);
  assert.equal(calculateBufferGaps(20, deltas)[0].upper, 13);
});
test("sum unrounded deltas then round inward to whole-mm limits", () => {
  const [a1] = calculateBufferGaps(18, { ...deltas, longExpansion: 6.1, bufferExpansion: 3.1, longContraction: 4.1, bufferContraction: 2.1 });
  assert.deepEqual([a1.lower, a1.upper], [10, 11]);
});
test("missing deltas stay pending; impossible ranges are reported", () => {
  assert.equal(calculateBufferGaps(18)[0].lower, null);
  assert.equal(calculateBufferGaps(18)[0].feasible, null);
  assert.equal(calculateBufferGaps(8, deltas)[0].feasible, false);
  assert.throws(() => calculateBufferGaps(0, deltas), RangeError);
  assert.throws(() => calculateBufferGaps(18, { ...deltas, longExpansion: -1 }), RangeError);
  assert.throws(() => calculateBufferGaps(18, {}), RangeError);
});
test("saved verified deformations survive parameter reload and legacy saves remain supported", () => {
  assert.deepEqual(validateStressParams({ ...DEFAULT_STRESS_INPUT, bufferDeformations: deltas }).bufferDeformations, deltas);
  assert.equal(validateStressParams(DEFAULT_STRESS_INPUT).bufferDeformations, undefined);
  assert.equal(validateStressParams({ ...DEFAULT_STRESS_INPUT, bufferDeformations: {} }), null);
});
