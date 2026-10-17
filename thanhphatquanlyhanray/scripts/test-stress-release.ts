import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { calculateStressRelease, DEFAULT_STRESS_INPUT, excelRound, lookupExtension, lookupPullForce, releaseLengthLimit, validateStressInput } from "../src/lib/stress-release";

const workbook = JSON.parse(readFileSync("docs/research/stress-release/workbook.json", "utf8").replace(/^\uFEFF/, "")) as { name: string; cells: { cell: string; value: string }[] }[];
test("60R2 outputs match 22 cached Excel cells", () => {
  const result = calculateStressRelease(DEFAULT_STRESS_INPUT);
  const sheet = workbook.find((s) => s.name === "Bảng tính mẫu 60R2")!;
  const mapping = {
    length: "K26", pullTemp: "V30", averageTemp: "K31", deltaTemp: "V31",
    force: "K40", anchorLength: "V40", compressionForce: "K41", tensionForce: "K42",
    compressionEnd: "V41", tensionEnd: "V42", freeExtension: "K43",
    compressionBuffer: "V43", tensionBuffer: "V44", compressionBreathing: "K44",
    tensionBreathing: "K45", gapCheck: "K46", longGapUpper: "K49", longGapLower: "V49",
    bufferGapUpper: "K50", bufferGapLower: "V50", pullLength: "K59", cutGap: "K60",
  } as const;
  for (const [key, cell] of Object.entries(mapping)) {
    const expected = Number(sheet.cells.find((c) => c.cell === cell)!.value);
    const actual = result[key as keyof typeof mapping];
    assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${key}: ${actual} != ${expected}`);
  }
});
test("lookup tables reproduce every populated numeric row", () => {
  const gap = workbook[0];
  const values = new Map(gap.cells.map((c) => [c.cell, Number(c.value)]));
  for (let row = 7; row <= 37; row++) {
    for (const column of [..."DEFGHIJKLMNOPQRSTUVWXYZ".split(""), "AA"]) {
      assert.equal(lookupExtension(values.get(`${column}6`)!, 35, values.get(`C${row}`)!), values.get(`${column}${row}`));
    }
  }
  const force = new Map(workbook[1].cells.map((c) => [c.cell, Number(c.value)]));
  for (let row = 7; row <= 37; row++) {
    for (const [column, weight] of [["D", 43], ["F", 50], ["H", 50.4], ["J", 54.77], ["L", 59.75]] as const) {
      assert.equal(lookupPullForce(weight, 35, force.get(`C${row}`)!), force.get(`${column}${row}`));
    }
  }
});
test("FBW signed allowance and measured compensation", () => {
  const result = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, method: "FBW", leftTemp: 25, rightTemp: 25 });
  assert.equal(result.cutGap, 22);
  assert.equal(calculateStressRelease({ ...DEFAULT_STRESS_INPUT, method: "FBW", leftTemp: 32, rightTemp: 32 }).cutGap, -18.25);
  assert.equal(calculateStressRelease({ ...DEFAULT_STRESS_INPUT, leftMovement: 2, rightMovement: 3 }).pullLength, 91.25);
  assert.equal(calculateStressRelease({ ...DEFAULT_STRESS_INPUT, method: "SINGLE" }).cutGap, null);
});
test("rounding, temperature sign, length checks, invalid input", () => {
  assert.equal(excelRound(-1.5), -2);
  assert.equal(excelRound(1.005, 2), 1.01);
  assert.equal(releaseLengthLimit(1000, false), 330);
  assert.equal(releaseLengthLimit(1000, true), 600);
  assert.equal(releaseLengthLimit(400, true), null);
  assert.equal(releaseLengthLimit(4000, true), 1320);
  assert.equal(releaseLengthLimit(4001, true), 2000);
  assert.equal(calculateStressRelease(DEFAULT_STRESS_INPUT).lengthPass, false);
  assert.equal(calculateStressRelease({ ...DEFAULT_STRESS_INPUT, sideRollers: true }).lengthPass, true);
  assert.equal(calculateStressRelease({ ...DEFAULT_STRESS_INPUT, leftTemp: 35, rightTemp: 35 }).force, 0);
  assert.ok(calculateStressRelease({ ...DEFAULT_STRESS_INPUT, leftTemp: 40, rightTemp: 40 }).warnings.some((w) => w.includes("âm")));
  for (const patch of [{ resistance: 0 }, { area: NaN }, { leftLength: -1 }, { minTemp: 60 }]) {
    assert.ok(validateStressInput({ ...DEFAULT_STRESS_INPUT, ...patch }).length > 0);
    assert.throws(() => calculateStressRelease({ ...DEFAULT_STRESS_INPUT, ...patch }));
  }
});
