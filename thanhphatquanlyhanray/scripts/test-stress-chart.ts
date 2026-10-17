import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStressChartData } from "../src/lib/stress-chart";
import { DEFAULT_STRESS_INPUT } from "../src/lib/stress-release";

test("chart shows the actual Excel force and extension over the selected length", () => {
  const points = buildStressChartData(DEFAULT_STRESS_INPUT);
  assert.equal(points.length, 41);
  assert.deepEqual(points[0], { x: 0, p: 276.81, extension: 0 });
  assert.deepEqual(points[20], { x: 250, p: 276.81, extension: 43.125 });
  assert.deepEqual(points[40], { x: 500, p: 276.81, extension: 86.25 });
  const longer = buildStressChartData({ ...DEFAULT_STRESS_INPUT, leftLength: 1000 });
  assert.deepEqual(longer[40], { x: 1000, p: 276.81, extension: 172.5 });
});
test("chart retains zero/negative values and rejects invalid inputs", () => {
  for (const [temperature, force, extension] of [[35, 0, 0], [40, -92.27, -28.75]]) {
    const points = buildStressChartData({ ...DEFAULT_STRESS_INPUT, leftTemp: temperature, rightTemp: temperature });
    assert.equal(points[40].p, force);
    assert.equal(points[40].extension, extension);
    assert.ok(points.every((point) => Object.values(point).every(Number.isFinite)));
  }
  assert.throws(() => buildStressChartData({ ...DEFAULT_STRESS_INPUT, leftLength: NaN }));
});
