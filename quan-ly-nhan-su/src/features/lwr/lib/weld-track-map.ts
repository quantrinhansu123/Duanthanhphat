import { compareLongRailDisplay, coveringLongRail, formatChainage, getPlacementSpan, parseChainage, railRowKey, visibleLongRailSpan, type LongRail } from "@lwr/lib/track-editor";
import type { RailRow } from "@lwr/types/track";
import type { JournalWeld, RailJoint } from "@lwr/types/weld";

/** Mối hàn nằm ở hai đầu thanh dài (và các mối đã liên kết nhật ký từ trước); vạch 500 m không phải mối hàn. */
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
      // Lý trình chẵn 500 m chỉ là vạch chia, không phải mối hàn; chỉ giữ nếu đã có nhật ký liên kết từ trước.
      if (!links[`${key}:${left.id}:${right.id}`]?.length) continue;
      joints.push({
        id: `${key}:${left.id}:${right.id}`,
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

function longRailSpanMetres(rail: LongRail, rows: RailRow[]): { start: number; end: number } | null {
  if (
    Number.isFinite(rail.startMetres)
    && Number.isFinite(rail.endMetres)
    && (rail.endMetres as number) > (rail.startMetres as number)
  ) {
    return { start: rail.startMetres as number, end: rail.endMetres as number };
  }
  const span = getPlacementSpan(rows, rail);
  return span ? { start: span.startMetres, end: span.endMetres } : null;
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

function placedWorkEnds(
  rail: LongRail,
  longRails: LongRail[],
  rows: RailRow[],
  preferredRailId?: string | null,
): { start: number; end: number } | null {
  const row = rows.find((item) => railRowKey(item) === rail.rowKey);
  if (!row) return longRailSpanMetres(rail, rows);
  const items = rowCoverItems(longRails, rows, rail.rowKey);
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const cell of row.cells) {
    if (!cellHasWork(cell)) continue;
    const from = parseChainage(cell.from);
    const to = parseChainage(cell.to);
    if (from === null || to === null) continue;
    const cover = coveringLongRail(items, from, to, preferredRailId);
    if (cover?.rail.id !== rail.id) continue;
    start = Math.min(start, from);
    end = Math.max(end, to);
  }
  if (Number.isFinite(start) && end > start) return { start, end };
  return longRailSpanMetres(rail, rows);
}

/** Màu mối hàn theo Mục tính toán / nhật ký — chỉ đầu/cuối thanh đang chọn, không tô mối giữa các ô ngắn. */
export function jointDisplayMethod(
  joint: RailJoint,
  longRails: LongRail[] = [],
  rows: RailRow[] = [],
  preferredRailId?: string | null,
  selectedCellId?: string | null,
): string | undefined {
  const linked = joint.welds[0]?.method?.trim();
  if (linked && linked !== "—") return linked;
  if (!jointOnPlacedWork(joint, rows)) return undefined;

  if (selectedCellId) {
    const row = rows.find((item) => railRowKey(item) === joint.rowKey);
    const cell = row?.cells.find((item) => item.id === selectedCellId);
    if (cell) {
      const from = parseChainage(cell.from);
      const to = parseChainage(cell.to);
      if (from !== null && to !== null && joint.metres !== from && joint.metres !== to) return undefined;
    }
  }

  const items = rowCoverItems(longRails, rows, joint.rowKey);
  const hits = items
    .filter(({ span }) => joint.metres >= span.startMetres && joint.metres <= span.endMetres)
    .map(({ rail, span }) => ({ rail, length: span.endMetres - span.startMetres }))
    .sort((a, b) => compareLongRailDisplay(a.rail, b.rail, preferredRailId, a.length, b.length));
  const owner = hits[0]?.rail;
  if (!owner) return undefined;
  const ends = placedWorkEnds(owner, longRails, rows, preferredRailId);
  if (!ends || (joint.metres !== ends.start && joint.metres !== ends.end)) return undefined;
  return owner.params.method;
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
