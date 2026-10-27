import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_STRESS_INPUT } from "../src/features/lwr/lib/stress-release.ts";
import { nextUnusedRailType } from "../src/features/lwr/lib/stress-release.ts";
import {
  addInstalledRange,
  removeInstalledRange,
  createInitialTrackLayout,
  ensureRowSpan,
  extendRailRows,
  nextLongRailCode,
  railDisplayLabel,
  renumberLongRails,
  patchTrackCell,
  placeShortRailSpan,
  updateRailCell,
  validateTrackLayout,
} from "../src/features/lwr/lib/track-editor.ts";

function seededLayout() {
  const layout = createInitialTrackLayout();
  return { ...layout, rows: extendRailRows(layout.rows, 3) };
}

test("shortening a cell slides later cells and keeps their length", () => {
  const layout = seededLayout();
  const rows = updateRailCell(layout.rows, "UT-01", { lengthMetres: 480 });
  assert.deepEqual(rows[0].cells[0], { id: "UT-01", from: "0+000", to: "0+480", temp: 35 });
  assert.equal(rows[0].cells[1].from, "0+480");
  assert.equal(rows[0].cells[1].to, "0+980");
  assert.equal(rows[0].cells[1].temp, 35);
  assert.equal(layout.rows[0].cells[0].to, "0+500", "must not mutate source");
  assert.ok(validateTrackLayout({ ...layout, rows, placements: [] }));
});

test("changing start of a middle cell shortens the previous cell", () => {
  const layout = seededLayout();
  const rows = updateRailCell(layout.rows, "UT-02", { from: "0+480" });
  assert.equal(rows[0].cells[0].to, "0+480");
  assert.equal(rows[0].cells[1].from, "0+480");
  assert.equal(rows[0].cells[1].to, "0+980");
});

test("temperature can change independently", () => {
  const layout = seededLayout();
  const rows = updateRailCell(layout.rows, "UT-01", { temp: 38 });
  assert.equal(rows[0].cells[0].temp, 38);
  assert.equal(rows[0].cells[0].to, "0+500");
});

test("invalid length and overlapping start are rejected", () => {
  const layout = seededLayout();
  assert.throws(() => updateRailCell(layout.rows, "UT-01", { lengthMetres: 0 }), /nguyên dương/);
  assert.throws(() => updateRailCell(layout.rows, "UT-02", { from: "0+000" }), /đoạn trước/);
});

test("patchTrackCell updates long-rail leftLength", () => {
  const layout = seededLayout();
  layout.longRails = [{
    id: "lr-1",
    code: "TD-UT-01",
    label: "",
    rowKey: "UT",
    startCellId: "UT-01",
    endCellId: "UT-02",
    params: { ...DEFAULT_STRESS_INPUT, leftLength: 1000 },
    updatedAt: "2026-01-01T00:00:00.000Z",
  }];
  const patched = patchTrackCell(layout, "UT-01", { lengthMetres: 400 });
  assert.equal(patched.longRails[0].params.leftLength, 900);
});

test("next long-rail code starts at LWR01", () => {
  assert.equal(nextLongRailCode([]), "LWR01");
  assert.equal(nextLongRailCode([{ code: "LWR01" }, { code: "LWR07" }]), "LWR08");
});

test("long-rail code uses TT/TP/HT/HP per rail row, running 1..n", () => {
  assert.equal(nextLongRailCode([], "UT"), "TT0001");
  assert.equal(nextLongRailCode([{ code: "TT0001" }, { code: "TT0002" }, { code: "TP0009" }, { code: "LWR05" }], "UT"), "TT0003");
  assert.equal(nextLongRailCode([{ code: "TT0001" }], "UP"), "TP0001");
  assert.equal(nextLongRailCode([], "DT"), "HT0001");
  assert.equal(nextLongRailCode([{ code: "HP0004" }], "DP"), "HP0005");
});

test("plus-button short rail uses exact chainage and proportional length", () => {
  const layout = seededLayout();
  const first = placeShortRailSpan(layout.rows, "UT", 0, 200);
  assert.equal(first.rows[0].cells[0].from, "0+000");
  assert.equal(first.rows[0].cells[0].to, "0+200");
  assert.equal(first.rows[0].cells[0].placed, true);
  assert.equal(first.rows[0].cells[1].from, "0+200");
  const second = placeShortRailSpan(first.rows, "UT", 200, 350);
  const placed = second.rows[0].cells.filter((cell) => cell.placed);
  assert.equal(placed[0].to, "0+200");
  assert.equal(placed[1].from, "0+200");
  assert.equal(placed[1].to, "0+350");
  assert.equal((200 - 0) / (350 - 200), 200 / 150);
  assert.throws(() => placeShortRailSpan(second.rows, "UT", 100, 250), /chồng lên/);
});

test("ensureRowSpan covers chainage and returns start/end cells", () => {
  const layout = createInitialTrackLayout();
  const placed = ensureRowSpan(layout.rows, "UT", 0, 800);
  assert.equal(placed.startCellId, "UT-01");
  assert.equal(placed.endCellId, "UT-01");
  assert.equal(placed.rows[0].cells[0].from, "0+000");
  assert.equal(placed.rows[0].cells[0].to, "0+800");
});

test("each new long rail gets a different unused rail type", () => {
  assert.equal(nextUnusedRailType([]), "PB43");
  assert.equal(nextUnusedRailType(["PB43", "P50"]), "P60");
  assert.notEqual(nextUnusedRailType(["PB43"]), nextUnusedRailType([]));
});

test("rail display label shows TT/TP/HT/HP code with name", () => {
  assert.equal(railDisplayLabel("TUYẾN THƯỢNG", "Ray trái"), "TT · Thượng trái");
  assert.equal(railDisplayLabel("TUYẾN THƯỢNG", "Ray phải"), "TP · Thượng phải");
  assert.equal(railDisplayLabel("TUYẾN HẠ", "Ray trái"), "HT · Hạ trái");
  assert.equal(railDisplayLabel("TUYẾN HẠ", "Ray phải"), "HP · Hạ phải");
  assert.equal(railDisplayLabel("X", "Y"), "Y");
});

test("renumberLongRails assigns TT/TP/HT/HP 1..n per row by construction order", () => {
  const layout = seededLayout();
  const mk = (id, code, rowKey, startMetres, endMetres, label = "") => ({
    id, code, label, rowKey, startCellId: "UT-01", endCellId: "UT-01", startMetres, endMetres,
    params: { ...DEFAULT_STRESS_INPUT }, updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const rails = [
    mk("b", "LWR02", "UT", 500, 1000, "LWR02"),
    mk("a", "LWR01", "UT", 0, 500, "Doan dau"),
    mk("c", "LW02", "DT", 0, 500, "LW02"),
    mk("d", "X", "ZZ", 0, 500),
  ];
  const out = renumberLongRails(layout.rows, rails, "2026-02-02T00:00:00.000Z");
  const byId = Object.fromEntries(out.map((r) => [r.id, r]));
  assert.equal(byId.a.code, "TT0001");
  assert.equal(byId.a.label, "Doan dau", "custom label is kept");
  assert.equal(byId.b.code, "TT0002");
  assert.equal(byId.b.label, "TT0002", "label equal to old code follows the new code");
  assert.equal(byId.c.code, "HT0001");
  assert.equal(byId.d.code, "X", "unknown row is untouched");
  assert.equal(renumberLongRails(layout.rows, out).every((r, i) => r.code === out[i].code), true, "idempotent");
});

test("installed ranges: add to both lines, merge on extension, remove, survive validation", () => {
  const lines = ["TUYẾN THƯỢNG", "TUYẾN HẠ"];
  let inst = addInstalledRange(undefined, lines, 0, 1000);
  assert.deepEqual(inst["TUYẾN HẠ"], [{ from: 0, to: 1000 }], "one entry adds the other line too");
  inst = addInstalledRange(inst, ["TUYẾN THƯỢNG"], 1000, 3500);
  assert.deepEqual(inst["TUYẾN THƯỢNG"], [{ from: 0, to: 3500 }], "touching ranges merge (daily extension)");
  assert.deepEqual(inst["TUYẾN HẠ"], [{ from: 0, to: 1000 }], "other line untouched");
  inst = addInstalledRange(inst, ["TUYẾN HẠ"], 2000, 2500);
  assert.equal(inst["TUYẾN HẠ"].length, 2, "gap keeps separate segments");
  inst = removeInstalledRange(inst, "TUYẾN HẠ", 0);
  assert.deepEqual(inst["TUYẾN HẠ"], [{ from: 2000, to: 2500 }]);
  assert.throws(() => addInstalledRange(inst, lines, 500, 500), RangeError);
  const layout = { ...seededLayout(), installed: inst };
  assert.deepEqual(validateTrackLayout(JSON.parse(JSON.stringify(layout))).installed, inst);
  assert.equal(validateTrackLayout({ ...layout, installed: { "TUYẾN HẠ": [{ from: 5, to: 1 }] } }), null);
});
