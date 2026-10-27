import assert from "node:assert/strict";
import { test } from "node:test";
import { extendRailRows, createInitialTrackLayout } from "../src/features/lwr/lib/track-editor.ts";
import {
  chooseTrackLayout,
  readStoredTrackLayout,
  serializeTrackLayout,
  trackLayoutHasEdits,
} from "../src/features/lwr/lib/track-layout-storage.ts";

test("starter schematic is not an edit, an extended row is", () => {
  const initial = createInitialTrackLayout();
  assert.equal(trackLayoutHasEdits(initial), false);
  assert.equal(trackLayoutHasEdits({ ...initial, rows: extendRailRows(initial.rows, 1) }), true);
});

test("browser cache round-trips savedAt without failing validation", () => {
  const layout = createInitialTrackLayout();
  const savedAt = "2026-10-27T13:00:00.000Z";
  const stored = readStoredTrackLayout(serializeTrackLayout(layout, savedAt));
  assert.equal(stored.invalid, false);
  assert.equal(stored.savedAt, savedAt);
  assert.equal(stored.layout.rows.length, layout.rows.length);
  assert.equal(readStoredTrackLayout("not-json").invalid, true);
  assert.equal(readStoredTrackLayout(null).layout, null);
});

test("local schematic is uploaded when the server has none", () => {
  const local = createInitialTrackLayout();
  local.placements = [];
  const edited = { ...local, rows: extendRailRows(local.rows, 2) };
  const chosen = chooseTrackLayout({
    local: edited,
    localSavedAt: null,
    remote: null,
    remoteUpdatedAt: null,
  });
  assert.equal(chosen.from, "local");
  assert.equal(chosen.upload, true);
  assert.equal(chooseTrackLayout({
    local: null,
    localSavedAt: null,
    remote: null,
    remoteUpdatedAt: null,
  }).from, "initial");
});

test("newer timestamp wins, legacy cache yields once the server has a schematic", () => {
  const initial = createInitialTrackLayout();
  const local = { ...initial, rows: extendRailRows(initial.rows, 1) };
  const remote = { ...initial, rows: extendRailRows(initial.rows, 4) };
  const newerLocal = chooseTrackLayout({
    local,
    localSavedAt: "2026-10-27T15:00:00.000Z",
    remote,
    remoteUpdatedAt: "2026-10-27T14:00:00.000Z",
  });
  assert.equal(newerLocal.from, "local");
  assert.equal(newerLocal.upload, true);
  const newerRemote = chooseTrackLayout({
    local,
    localSavedAt: "2026-10-27T13:00:00.000Z",
    remote,
    remoteUpdatedAt: "2026-10-27T14:00:00.000Z",
  });
  assert.equal(newerRemote.from, "remote");
  assert.equal(newerRemote.upload, false);
  const legacy = chooseTrackLayout({
    local,
    localSavedAt: null,
    remote,
    remoteUpdatedAt: "2026-10-27T14:00:00.000Z",
  });
  assert.equal(legacy.from, "remote");
  assert.equal(legacy.upload, false);
  const legacyAgainstEmpty = chooseTrackLayout({
    local,
    localSavedAt: null,
    remote: initial,
    remoteUpdatedAt: "2026-10-27T14:00:00.000Z",
  });
  assert.equal(legacyAgainstEmpty.from, "local");
  assert.equal(legacyAgainstEmpty.upload, true);
  const richerLocal = chooseTrackLayout({
    local: { ...initial, rows: extendRailRows(initial.rows, 4) },
    localSavedAt: null,
    remote: { ...initial, longRails: [{ id: "only-rail" }] },
    remoteUpdatedAt: "2026-10-27T14:00:00.000Z",
  });
  assert.equal(richerLocal.from, "local");
  assert.equal(richerLocal.upload, true);
});
