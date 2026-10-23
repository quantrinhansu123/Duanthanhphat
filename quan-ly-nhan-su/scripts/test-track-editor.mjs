import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_STRESS_INPUT } from "../src/features/lwr/lib/stress-release.ts";
import { nextUnusedRailType } from "../src/features/lwr/lib/stress-release.ts";
import {
  createInitialTrackLayout,
  ensureRowSpan,
  extendRailRows,
  nextLongRailCode,
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
