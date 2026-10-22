import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateBufferGaps } from "../src/features/lwr/lib/buffer-gap.ts";
import { DEFAULT_STRESS_INPUT } from "../src/features/lwr/lib/stress-release.ts";
import { validateStressParams } from "../src/features/lwr/lib/track-editor.ts";

// Synthetic deltas exercise the supplied inequalities; these are not app defaults.
const deltas = { longExpansion: 6, longContraction: 4.5, bufferExpansion: 3, bufferContraction: 2.5 };
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
