import { compareLongRailDisplay, formatChainage, getPlacementSpan, parseChainage, railRowKey, visibleLongRailSpan, type LongRail } from "@lwr/lib/track-editor";
import type { RailRow } from "@lwr/types/track";
import type { JournalWeld, RailJoint } from "@lwr/types/weld";

function cellHasPlacedWork(cell: { placed?: boolean; released?: boolean }) {
  return Boolean(cell.placed || cell.released);
}

/** Mối hàn: biên hai thanh ngắn đã rải, hai đầu thanh dài, và mối đã liên kết nhật ký. */
export function buildRailJoints(rows: RailRow[], welds: JournalWeld[], snapMetres = 0, links: Record<string, string[]> = {}, longRails: LongRail[] = []): {
  joints: RailJoint[];
  unmatched: JournalWeld[];
} {
  const joints: RailJoint[] = [];

  for (const row of rows) {
    const key = railRowKey(row);
    for (let index = 0; index < row.cells.length - 1; index += 1) {
      const left = row.cells[index];
      const right = row.cells[index + 1];
      const metres = parseChainage(left.to) ?? parseChainage(right.from);
      if (metres == null) continue;
      const id = `${key}:${left.id}:${right.id}`;
      const linked = Boolean(links[id]?.length);
      const betweenWork = cellHasPlacedWork(left) && cellHasPlacedWork(right);
      if (!linked && !betweenWork) continue;
      joints.push({
        id,
        rowKey: key,
        leftCellId: left.id,
        rightCellId: right.id,
        chainage: formatChainage(metres),
        metres,
        welds: [],
      });
    }
  }

  for (const rail of longRails) {
    const span = getPlacementSpan(rows, rail);
    if (!span) continue;
    for (const metres of [span.startMetres, span.endMetres]) {
      if (joints.some(joint => joint.rowKey === rail.rowKey && joint.metres === metres)) continue;
      const left = span.row.cells.find(cell => (parseChainage(cell.from) ?? Infinity) < metres && metres <= (parseChainage(cell.to) ?? -Infinity));
      const right = span.row.cells.find(cell => (parseChainage(cell.from) ?? Infinity) <= metres && metres < (parseChainage(cell.to) ?? -Infinity));
      joints.push({ id: `${rail.rowKey}:km:${metres}`, rowKey: rail.rowKey, metres, chainage: formatChainage(metres), leftCellId: left?.id ?? span.startCell.id, rightCellId: right?.id ?? span.endCell.id, welds: [] });
    }
  }
  const unmatched: JournalWeld[] = [];
  for (const weld of welds) {
    const linked = joints.find(joint => links[joint.id]?.includes(weld.id));
    if (linked) { linked.welds.push(weld); continue; }
    if (weld.metres == null) {
      unmatched.push(weld);
      continue;
    }
    let best: RailJoint | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    let ambiguous = false;
    for (const joint of joints) {
      const dist = Math.abs(joint.metres - weld.metres);
      if (dist < bestDist) {
        bestDist = dist;
        best = joint;
        ambiguous = false;
      } else if (dist === bestDist) {
        ambiguous = true;
      }
    }
    if (best && !ambiguous && bestDist <= snapMetres) {
      best.welds.push(weld);
    } else {
      unmatched.push(weld);
    }
  }

  return { joints, unmatched };
}

export function jointsForRow(joints: RailJoint[], row: RailRow): RailJoint[] {
  const key = railRowKey(row);
  return joints.filter((joint) => joint.rowKey === key);
}

function cellHasWork(cell: { placed?: boolean; released?: boolean }) {
  return Boolean(cell.placed || cell.released);
}

function rowCoverItems(longRails: LongRail[], rows: RailRow[], rowKey: string) {
  return longRails.flatMap((rail) => {
    if (rail.rowKey !== rowKey || !rail.params.method) return [];
    const span = visibleLongRailSpan(rows, rail) ?? getPlacementSpan(rows, rail);
    return span ? [{ rail, span }] : [];
  });
}

function jointOnPlacedWork(joint: RailJoint, rows: RailRow[]): boolean {
  const row = rows.find((item) => railRowKey(item) === joint.rowKey);
  if (!row?.cells.length) return false;
  return row.cells.some((cell) => {
    if (!cellHasWork(cell)) return false;
    const from = parseChainage(cell.from);
    const to = parseChainage(cell.to);
    if (from === null || to === null) return false;
    return joint.metres >= from && joint.metres <= to;
  });
}

/** Màu mối hàn theo Mục tính toán / nhật ký của thanh dài phủ đoạn đã rải (kể cả mối giữa hai thanh ngắn). */
export function jointDisplayMethod(
  joint: RailJoint,
  longRails: LongRail[] = [],
  rows: RailRow[] = [],
  preferredRailId?: string | null,
  _selectedCellId?: string | null,
): string | undefined {
  const linked = joint.welds[0]?.method?.trim();
  if (linked && linked !== "—") return linked;
  if (!jointOnPlacedWork(joint, rows)) return undefined;

  const items = rowCoverItems(longRails, rows, joint.rowKey);
  const hits = items
    .filter(({ span }) => joint.metres >= span.startMetres && joint.metres <= span.endMetres)
    .map(({ rail, span }) => ({ rail, length: span.endMetres - span.startMetres }))
    .sort((a, b) => compareLongRailDisplay(a.rail, b.rail, preferredRailId, a.length, b.length));
  return hits[0]?.rail.params.method;
}

export function weldMethodTone(method?: string): string {
  const value = (method ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (/FBW|FLASH|GIAP MEP|HAN CHAY/.test(value)) return "bg-blue-600 border-blue-800 text-white";
  if (/ATW|THERMIT|NHIET NHOM|ALUMIN/.test(value)) return "bg-red-600 border-red-800 text-white";
  if (/SINGLE|RAY DON/.test(value)) return "bg-amber-500 border-amber-700 text-white";
  if (/BUFFER|VUNG DEM/.test(value)) return "bg-purple-600 border-purple-800 text-white";
  return "bg-white border-slate-400 text-slate-700";
}

export function weldStatusTone(status: string, failed: boolean): string {
  if (failed || status === "Không đạt") return "bg-rose-600 text-white border-rose-700";
  if (status === "Đạt") return "bg-emerald-600 text-white border-emerald-700";
  if (status === "Không thí nghiệm") return "bg-slate-500 text-white border-slate-600";
  return "bg-amber-500 text-white border-amber-600";
}
