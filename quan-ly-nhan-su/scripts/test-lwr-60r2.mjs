import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { calculateStressRelease, DEFAULT_STRESS_INPUT } from "../src/features/lwr/lib/stress-release.ts";

const sheet = JSON.parse(readFileSync(new URL("./fixtures/lwr-60r2.json", import.meta.url), "utf8")).cells;
test("60R2 results and all eight cross-check cells match workbook (2)", () => {
  const result = calculateStressRelease(DEFAULT_STRESS_INPUT);
  const mapping = {
    length: "K26", averageTemp: "K31", deltaTemp: "V31",
    force: "K40", anchorLength: "V40", compressionForce: "K41", tensionForce: "K42",
    compressionEnd: "V41", tensionEnd: "V42", freeExtension: "K43",
    compressionBuffer: "V43", tensionBuffer: "V44",
    compressionBreathing: "K44", tensionBreathing: "K45", gapCheck: "K46",
    longGapUpper: "K49", longGapLower: "V49", bufferGapUpper: "K50", bufferGapLower: "V50",
    pullLength: "K59", cutGap: "K60",
  };
  for (const [key, cell] of Object.entries(mapping))
    assert.ok(Math.abs(result[key] - sheet[cell].v) < 1e-9, key + " / " + cell);
  result.extensionChecks.forEach((row, index) => {
    for (const [key, column] of [["compression", "R"], ["tension", "T"]]) {
      const cell = column + (75 + index);
      assert.ok(Math.abs(row[key] - sheet[cell].v) < 1e-9, cell);
    }
  });
});
test("joint resistance changes checks 1, 2 and TB row but not check 3", () => {
  const original = calculateStressRelease(DEFAULT_STRESS_INPUT);
  const changed = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, jointResistance: 0 });
  for (const key of ["compression", "tension"]) {
    for (const index of [0, 1, 3]) assert.notEqual(original.extensionChecks[index][key], changed.extensionChecks[index][key]);
    assert.equal(original.extensionChecks[2][key], changed.extensionChecks[2][key]);
  }
  assert.equal(original.compressionDelta, 27);
  assert.equal(original.tensionDelta, 24);
});
