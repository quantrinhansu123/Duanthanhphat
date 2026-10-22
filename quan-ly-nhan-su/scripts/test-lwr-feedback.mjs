import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateStressRelease, DEFAULT_STRESS_INPUT } from "../src/features/lwr/lib/stress-release.ts";
import { createInitialTrackLayout, generateRailRows, getPlacementSpan, longRailsOverlap, validateTrackLayout, validateStressParams, formatChainage } from "../src/features/lwr/lib/track-editor.ts";
import { buildRailJoints, weldMethodTone } from "../src/features/lwr/lib/weld-track-map.ts";

const rows = generateRailRows(createInitialTrackLayout().rows, 123, 17584);
const rail = (from, to, id = "one") => ({ id, code: id, label: id, rowKey: "UT", startCellId: "UT-01", endCellId: "UT-02", startMetres: from, endMetres: to, releaseDate: "2026-10-22", completedAt: "2026-10-22T04:00:00Z", params: { ...DEFAULT_STRESS_INPUT, startChainage: formatChainage(from), endChainage: formatChainage(to), trackSide: "LEFT", leftOuterMovement: 4 }, updatedAt: "2026-10-22T04:00:00Z" });

test("auto plan stops at Km17+584 and keeps non-even starting chainage", () => {
  for (const row of rows) {
    assert.equal(row.cells[0].from, "0+123");
    assert.equal(row.cells[0].to, "0+500");
    assert.equal(row.cells.at(-1).from, "17+500");
    assert.equal(row.cells.at(-1).to, "17+584");
  }
});
test("work spans are exact and adjacent jobs in the same planned cell do not overlap", () => {
  const a = rail(200, 300), b = rail(300, 450, "two");
  assert.equal(getPlacementSpan(rows, a).endMetres - getPlacementSpan(rows, a).startMetres, 100);
  assert.equal(longRailsOverlap(rows, a, b), false);
  assert.equal(longRailsOverlap(rows, a, rail(299, 400)), true);
  assert.equal(getPlacementSpan(rows, rail(100, 200)), null);
});
test("reload preserves exact work and structure ranges, dates and movement fields", () => {
  const layout = { ...createInitialTrackLayout(), rows, longRails: [rail(200, 300)], placements: [{ ...rail(234, 345), symbolId: "bridge" }], jointWeldLinks: { joint: ["weld"] } };
  const restored = validateTrackLayout(JSON.parse(JSON.stringify(layout)));
  assert.equal(restored.longRails[0].startMetres, 200);
  assert.equal(restored.longRails[0].completedAt, layout.longRails[0].completedAt);
  assert.equal(restored.longRails[0].params.leftOuterMovement, 4);
  assert.equal(restored.placements[0].startMetres, 234);
  assert.deepEqual(restored.jointWeldLinks, layout.jointWeldLinks);
  assert.equal(validateStressParams({ ...DEFAULT_STRESS_INPUT, leftOuterMovement: undefined }).leftOuterMovement, 0);
});
test("only Mt and Mp compensate pulling; any F movement fails the anchor check", () => {
  for (const method of ["ATW", "FBW", "SINGLE"]) {
    const base = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, method });
    const changed = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, method, leftMovement: 2, rightMovement: 3, leftOuterMovement: 4, rightOuterMovement: 5 });
    assert.equal(changed.movementCompensation, 5);
    assert.equal(changed.pullLength, base.pullLength + 5);
    assert.equal(changed.fixedAnchorsStable, false);
    assert.ok(changed.warnings.some(warning => warning.includes("Phải tăng chiều dài neo")));
    if (base.cutGap !== null) assert.equal(changed.cutGap, base.cutGap + 5);
    assert.equal(base.fixedAnchorsStable, true);
    for (const [mt, mp] of [[0, 0], [3, 0], [0, 3], [1, 2]]) {
      const result = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, method, leftMovement: mt, rightMovement: mp });
      assert.equal(result.pullLength, base.pullLength + mt + mp);
      assert.equal(result.calculatedPullLength, base.pullLength);
    }
    for (const [ft, fp] of [[3, 0], [0, 3], [-3, 3]]) {
      const result = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, method, leftOuterMovement: ft, rightOuterMovement: fp });
      assert.equal(result.pullLength, base.pullLength);
      assert.equal(result.fixedAnchorsStable, false);
    }
  }
});
test("single rail uses pulling below 30 including 29.99 and natural release at 30", () => {
  for (const t of [29, 29.99, 30, 31]) {
    const result = calculateStressRelease({ ...DEFAULT_STRESS_INPUT, method: "SINGLE", leftTemp: t, rightTemp: t });
    assert.equal(result.releaseMethod, t < 30 ? "TENSOR" : "NATURAL");
    if (t >= 30) assert.equal(result.pullLength, 0);
  }
});
test("ambiguous chainage never assigns a weld to the wrong one of four rails", () => {
  const weld = { id: "w1", code: "FBW-1", metres: 500, method: "FBW" };
  const initial = buildRailJoints(rows, [weld]);
  assert.equal(initial.unmatched.length, 1);
  const target = initial.joints.find(j => j.rowKey === "DP" && j.metres === 500);
  const linked = buildRailJoints(rows, [weld], 0, { [target.id]: ["w1"] });
  assert.equal(linked.unmatched.length, 0);
  assert.equal(linked.joints.filter(j => j.welds.length)[0].rowKey, "DP");
  assert.match(weldMethodTone("FBW"), /blue/);
  assert.match(weldMethodTone("Hàn nhiệt nhôm"), /red/);
  assert.match(weldMethodTone(), /white/);
});

test("actual work endpoints create weld points without moving planned boundaries", () => {
  const work = rail(234, 789);
  const joints = buildRailJoints(rows, [], 0, {}, [work]).joints;
  assert.ok(joints.some(j => j.rowKey === "UT" && j.metres === 234));
  assert.ok(joints.some(j => j.rowKey === "UT" && j.metres === 789));
  assert.ok(joints.some(j => j.rowKey === "UT" && j.metres === 500));
  assert.equal(rows[0].cells[0].to, "0+500");
});
