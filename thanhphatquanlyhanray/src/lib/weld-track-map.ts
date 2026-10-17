import { formatChainage, parseChainage, railRowKey } from "@/lib/track-editor";
import type { RailRow } from "@/types/track";
import type { JournalWeld, RailJoint } from "@/types/weld";

/** Gán mối hàn vào ranh giới giữa các thanh (theo lý trình gần nhất). */
export function buildRailJoints(rows: RailRow[], welds: JournalWeld[], snapMetres = 250): {
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

  const unmatched: JournalWeld[] = [];
  for (const weld of welds) {
    if (weld.metres == null) {
      unmatched.push(weld);
      continue;
    }
    let best: RailJoint | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const joint of joints) {
      const dist = Math.abs(joint.metres - weld.metres);
      if (dist < bestDist) {
        bestDist = dist;
        best = joint;
      }
    }
    if (best && bestDist <= snapMetres) {
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

export function weldStatusTone(status: string, failed: boolean): string {
  if (failed || status === "Không đạt") return "bg-rose-600 text-white border-rose-700";
  if (status === "Đạt") return "bg-emerald-600 text-white border-emerald-700";
  if (status === "Không thí nghiệm") return "bg-slate-500 text-white border-slate-600";
  return "bg-amber-500 text-white border-amber-600";
}
