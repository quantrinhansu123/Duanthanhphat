import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { calculateStressRelease, DEFAULT_STRESS_INPUT, type StressInput } from "../src/lib/stress-release";

interface Cell { cell: string; value: string; formula: string; formulaXml: string }
interface Sheet { name: string; cells: Cell[] }
const workbook: Sheet[] = JSON.parse(readFileSync("docs/research/stress-release/workbook.json", "utf8").replace(/^\uFEFF/, ""));

/** Audit-only interpreter for this workbook's arithmetic, references and ROUND.
 * Reads actual formula strings; does not call the production rounding helper.
 * Not a general Excel calculation engine (shared formulas are checked separately).
 */
function workbookEvaluator(sheet: Sheet, overrides: Record<string, number> = {}) {
  const cells = new Map(sheet.cells.map((cell) => [cell.cell, cell]));
  const cache = new Map<string, number>(Object.entries(overrides));
  function read(address: string): number {
    address = address.replaceAll("$", "");
    if (cache.has(address)) return cache.get(address)!;
    const cell = cells.get(address);
    assert.ok(cell, `Missing cell ${address}`);
    const result = cell.formula ? evaluate(cell.formula) : Number(cell.value);
    assert.ok(Number.isFinite(result), `${sheet.name}!${address} is not numeric`);
    cache.set(address, result);
    return result;
  }
  function evaluate(formula: string): number {
    const tokens = formula.match(/ROUND|\$?[A-Z]+\$?\d+|\d+(?:\.\d+)?|[()+\-*/^,]/g) ?? [];
    assert.equal(tokens.join(""), formula.replaceAll(" ", ""), `Unsupported formula ${formula}`);
    let index = 0;
    const take = (expected: string) => assert.equal(tokens[index++], expected);
    function atom(): number {
      if (tokens[index] === "-") { index++; return -atom(); }
      if (tokens[index] === "+") { index++; return atom(); }
      if (tokens[index] === "(") { index++; const result = sum(); take(")"); return result; }
      if (tokens[index] === "ROUND") {
        index++; take("("); const value = sum(); take(","); const digits = sum(); take(")");
        const magnitude = Math.abs(value) * 10 ** digits;
        return Math.sign(value) * Math.floor(magnitude + 0.5 + Math.abs(magnitude) * 1e-15) / 10 ** digits;
      }
      const token = tokens[index++];
      return /[A-Z]/.test(token) ? read(token) : Number(token);
    }
    function power(): number {
      const left = atom();
      if (tokens[index] === "^") { index++; return left ** power(); }
      return left;
    }
    function product(): number {
      let result = power();
      while (tokens[index] === "*" || tokens[index] === "/") {
        const op = tokens[index++]; const value = power();
        result = op === "*" ? result * value : result / value;
      }
      return result;
    }
    function sum(): number {
      let result = product();
      while (tokens[index] === "+" || tokens[index] === "-") {
        const op = tokens[index++]; const value = product();
        result = op === "+" ? result + value : result - value;
      }
      return result;
    }
    const result = sum(); assert.equal(index, tokens.length); return result;
  }
  return read;
}

function close(actual: number, expected: number, label: string) {
  assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${label}: ${actual} != ${expected}`);
}

test("recalculate every explicit formula in six calculation sheets against Excel cache", () => {
  let count = 0;
  for (const sheet of workbook.slice(2, 8)) {
    const read = workbookEvaluator(sheet);
    for (const cell of sheet.cells.filter((cell) => cell.formula)) {
      close(read(cell.cell), Number(cell.value), `${sheet.name}!${cell.cell}`); count++;
    }
  }
  assert.equal(count, 152);
});

test("22 software outputs vs source formulas across 240 input scenarios", () => {
  const sheet = workbook[7];
  const mapping = {
    length: "K26", pullTemp: "V30", averageTemp: "K31", deltaTemp: "V31",
    force: "K40", anchorLength: "V40", compressionForce: "K41", tensionForce: "K42",
    compressionEnd: "V41", tensionEnd: "V42", freeExtension: "K43",
    compressionBuffer: "V43", tensionBuffer: "V44", compressionBreathing: "K44",
    tensionBreathing: "K45", gapCheck: "K46", longGapUpper: "K49", longGapLower: "V49",
    bufferGapUpper: "K50", bufferGapLower: "V50", pullLength: "K59", cutGap: "K60",
  } as const;
  for (let n = 0; n < 240; n++) {
    const i: StressInput = {
      ...DEFAULT_STRESS_INPUT,
      area: [0.007611, 0.00642, 0.006977][n % 3],
      modulus: n % 2 ? 210840000 : 211000000,
      alpha: n % 2 ? 0.0000115 : 0.000012,
      resistance: [12, 24, 30][n % 3], jointResistance: [0, 100, 400][n % 3],
      leftLength: 50 + n * 2.5, rightLength: n % 3 ? 100 : 0,
      neutralTemp: 30 + n % 11, leftTemp: -5 + n % 51, rightTemp: -4.5 + n % 49,
      minTemp: 5, maxTemp: 65, weldGap: n % 2 ? 26 : 28,
      structuralGap: n % 2 ? 18 : 20,
      leftMovement: (n % 5) / 2, rightMovement: -(n % 3) / 4,
    };
    const source = workbookEvaluator(sheet, {
      K21: i.area, V21: i.modulus, K22: i.alpha, V22: i.resistance, V23: i.jointResistance,
      K25: i.leftLength, V25: i.rightLength, K28: i.neutralTemp, V29: i.rightTemp,
      K30: i.leftTemp, K32: i.maxTemp, V32: i.minTemp, V35: i.weldGap,
      V38: i.structuralGap, K58: i.leftMovement, V58: i.rightMovement,
    });
    const result = calculateStressRelease(i);
    for (const [key, cell] of Object.entries(mapping)) close(result[key as keyof typeof mapping]!, source(cell), `case ${n}, ${cell}`);
  }
});

test("FBW branch matches source K49/K50 at both example temperatures", () => {
  for (const index of [3, 4]) {
    const sheet = workbook[index];
    const source = workbookEvaluator(sheet);
    const i = { ...DEFAULT_STRESS_INPUT, method: "FBW" as const, leftTemp: source("K33"), rightTemp: source("V32"), fbwAllowance: source("V37") };
    const result = calculateStressRelease(i);
    close(result.pullLength, source("K49"), `${sheet.name} pull`);
    close(result.cutGap!, source("K50"), `${sheet.name} cut`);
  }
});
