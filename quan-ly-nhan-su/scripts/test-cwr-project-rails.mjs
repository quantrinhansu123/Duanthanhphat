import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { calculateCwr, readCwrRail } from "../src/features/lwr/lib/cwr-rail.ts";

const file = new URL("../src/features/lwr/data/tb10015.json", import.meta.url);
const { sheets } = JSON.parse(readFileSync(file, "utf8"));
function D(sheet, number) {
  const cell = sheets.find((s) => s.name === sheet).rows.find((r) => r.number === number).cells.D;
  return typeof cell === "number" ? cell : cell.result;
}

const input = "Nhập liệu";
const lock = "4_Nhiệt độ khóa";
const buffer = "5_Co giãn-Đệm";
const gap = "3_Khe đứt ray";
const sample = {
  area: D(input, 66) / 1e6, modulus: D(input, 28) * 1000, alpha: D(input, 29),
  minTemp: D(lock, 7), maxTemp: D(lock, 6), neutralTemp: D(lock, 14), lockTempOffset: D(lock, 10),
  resistance: D(gap, 7), jointResistance: D(buffer, 9), allowedGap: D(gap, 11),
};

test("all ten live results reproduce the workbook with its original inputs", () => {
  const v = calculateCwr(sample);
  for (const [key, sheet, row] of [
    ["upper", lock, 15], ["lower", lock, 16], ["rise", lock, 18], ["drop", lock, 19],
    ["compression", buffer, 6], ["tension", buffer, 7], ["stress", "1_Độ bền ray", 45],
    ["gap", gap, 10], ["dropLimit", gap, 14], ["length", buffer, 11],
  ]) assert.ok(Math.abs(v[key] - D(sheet, row)) < 1e-9, key);
  assert.equal(v.withinGap, true);
  assert.equal(calculateCwr({ ...sample, allowedGap: v.gap }).withinGap, true);
  assert.equal(calculateCwr({ ...sample, allowedGap: v.gap - 0.00001 }).withinGap, false);
});

test("a sparse saved record uses only its own fields, with valid zeros retained", () => {
  const rail = readCwrRail({ id: "1", code: "p:HP1", params: { railType: "60R2", resistance: "14", area: NaN, neutralTemp: 0, lockTempOffset: 0, maxTemp: 28, minTemp: -10 } }, "p");
  assert.equal(rail.code, "HP1");
  assert.equal(rail.railType, "60R2");
  assert.deepEqual(rail.params, { neutralTemp: 0, lockTempOffset: 0, maxTemp: 28, minTemp: -10 });
  const v = calculateCwr(rail.params);
  assert.equal(v.drop, 10);
  assert.equal(v.rise, 28);
  assert.equal(v.withinGap, null);
  assert.equal(v.gap, null);
  assert.equal(calculateCwr({ ...sample, resistance: 0 }).gap, null);
  assert.equal(calculateCwr({ ...sample, minTemp: sample.maxTemp + 1 }).tension, null);
  assert.equal(calculateCwr({ ...sample, jointResistance: 1e5 }).length, 0);
  assert.equal(calculateCwr({ ...sample, allowedGap: undefined }).withinGap, null);
});
