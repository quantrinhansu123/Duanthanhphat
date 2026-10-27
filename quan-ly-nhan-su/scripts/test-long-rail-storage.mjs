import assert from "node:assert/strict";
import { test } from "node:test";
import {
  duplicateLongRailCodes,
  preferNewerLongRails,
  storageCode,
} from "../src/features/lwr/lib/long-rail-storage.ts";
import { DEFAULT_STRESS_INPUT } from "../src/features/lwr/lib/stress-release.ts";

function rail(partial) {
  return {
    id: partial.id,
    code: partial.code,
    label: partial.code,
    rowKey: "UT",
    startCellId: "UT-01",
    endCellId: "UT-01",
    params: DEFAULT_STRESS_INPUT,
    updatedAt: partial.updatedAt ?? "2026-10-27T12:00:00.000Z",
    projectId: partial.projectId,
    startMetres: 0,
    endMetres: 500,
  };
}

test("storageCode prefixes project id", () => {
  assert.equal(storageCode({ code: "LWR01" }), "LWR01");
  assert.equal(storageCode({ code: "LWR01", projectId: "proj-1" }), "proj-1:LWR01");
});

test("duplicateLongRailCodes finds same storage code", () => {
  assert.deepEqual(duplicateLongRailCodes([
    rail({ id: "a", code: "lw01" }),
    rail({ id: "b", code: "lw01" }),
    rail({ id: "c", code: "LWR02" }),
  ]), ["lw01"]);
  assert.deepEqual(duplicateLongRailCodes([
    rail({ id: "a", code: "lw01", projectId: "p1" }),
    rail({ id: "b", code: "lw01", projectId: "p2" }),
  ]), []);
});

test("preferNewerLongRails reuses remote id when code matches", () => {
  const local = rail({ id: "local-uuid", code: "LWR01", updatedAt: "2026-10-27T15:00:00.000Z" });
  const remote = rail({ id: "remote-uuid", code: "LWR01", updatedAt: "2026-10-27T10:00:00.000Z" });
  const merged = preferNewerLongRails([local], [remote]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "remote-uuid");
  assert.equal(merged[0].code, "LWR01");
  assert.equal(merged[0].updatedAt, local.updatedAt);
});
