import assert from "node:assert/strict";
import {
  createInitialTrackLayout,
  extendRailRows,
  formatChainage,
  getPlacementSpan,
  parseChainage,
  railRowKey,
  trackExtent,
  updateRailCell,
  validateTrackLayout,
  type TrackPlacement,
} from "../src/lib/track-editor";

const layout = createInitialTrackLayout();
assert.deepEqual(layout.rows.map(railRowKey), ["UT", "UP", "DT", "DP"]);
assert.deepEqual(trackExtent(layout.rows), { startMetres: 0, endMetres: 3500 });
assert.equal(parseChainage("Km 12+050"), 12050);
assert.equal(formatChainage(10500), "10+500");
for (const invalid of ["1+1000", "-1+500", "1+500garbage", "invalid"]) {
  assert.equal(parseChainage(invalid), null);
}

const placement: TrackPlacement = {
  id: "bridge-1", symbolId: "symbol-1", rowKey: "UT",
  startCellId: "UT-02", endCellId: "UT-04", label: "Cầu C1",
};
const span = getPlacementSpan(layout.rows, placement);
assert.equal(span?.startMetres, 500);
assert.equal(span?.endMetres, 2000);
assert.equal(span?.startIndex, 1);
assert.equal(span?.endIndex, 3);
assert.equal(getPlacementSpan(layout.rows, { ...placement, endCellId: "UP-04" }), null);
assert.equal(getPlacementSpan(layout.rows, { ...placement, endCellId: "UT-01" }), null);
assert.equal(getPlacementSpan(layout.rows, { ...placement, rowKey: "unknown" }), null);

const rows = extendRailRows(layout.rows, 14);
assert.deepEqual(rows.map((row) => row.cells.length), [21, 21, 21, 21]);
assert.deepEqual(trackExtent(rows), { startMetres: 0, endMetres: 10500 });
assert.deepEqual(rows[0].cells[20], { id: "UT-21", from: "10+000", to: "10+500", temp: 35 });
assert.equal(layout.rows[0].cells.length, 7, "Extending must not mutate source rows");
assert.equal(rows[0].cells[1].temp, 36, "Existing measurements must survive extension");
assert.equal(extendRailRows(rows, 100)[0].cells.at(-1)?.id, "UT-121");
for (const count of [0, -1, 1.5, 101, Number.NaN]) {
  assert.throws(() => extendRailRows(rows, count), RangeError);
}

const saved = { ...layout, rows, placements: [placement] };
assert.deepEqual(validateTrackLayout(JSON.parse(JSON.stringify(saved))), saved);
assert.equal(validateTrackLayout({ ...saved, version: 2 }), null);
assert.equal(validateTrackLayout({ ...saved, placements: [{ ...placement, endCellId: "DP-04" }] }), null);
assert.equal(validateTrackLayout({ ...saved, placements: [placement, placement] }), null);
const gap = structuredClone(saved);
gap.rows[0].cells[1].from = "0+600";
assert.equal(validateTrackLayout(gap), null);
const duplicate = structuredClone(saved);
duplicate.rows[1].cells[0].id = "UT-01";
assert.equal(validateTrackLayout(duplicate), null);
const wrongPrefix = structuredClone(saved);
wrongPrefix.rows[0].cells[1].id = "OTHER-02";
assert.equal(validateTrackLayout(wrongPrefix), null);
const independent = createInitialTrackLayout();
independent.rows[0].cells[0].temp = 99;
assert.equal(createInitialTrackLayout().rows[0].cells[0].temp, 35);

const shortened = updateRailCell(layout.rows, "UT-01", { lengthMetres: 480 });
assert.deepEqual(shortened[0].cells[0], { id: "UT-01", from: "0+000", to: "0+480", temp: 35 });
assert.equal(shortened[0].cells[1].from, "0+480");
assert.equal(shortened[0].cells[1].to, "0+980");
assert.equal(layout.rows[0].cells[0].to, "0+500", "Updating must not mutate source rows");
const moved = updateRailCell(layout.rows, "UT-02", { from: "0+480" });
assert.equal(moved[0].cells[0].to, "0+480");
assert.equal(moved[0].cells[1].to, "0+980");
const warmed = updateRailCell(layout.rows, "UT-01", { temp: 38 });
assert.equal(warmed[0].cells[0].temp, 38);
assert.equal(warmed[0].cells[0].to, "0+500");
assert.throws(() => updateRailCell(layout.rows, "UT-01", { lengthMetres: 0 }), RangeError);
assert.throws(() => updateRailCell(layout.rows, "UT-02", { from: "0+000" }), RangeError);

console.log("Track editor: chainage, inclusive spans, synchronized extension and persisted data validation passed.");
