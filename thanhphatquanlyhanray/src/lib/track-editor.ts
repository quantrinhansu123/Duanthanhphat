import { RAIL_ROWS } from "./track-data";
import type { RailCell, RailRow } from "../types/track";

export const TRACK_LAYOUT_STORAGE_KEY = "tp-track-layout-v1";
export const RAIL_SEGMENT_LENGTH_METRES = 500;
export const DEFAULT_NEW_RAIL_TEMPERATURE = 35;
export const MAX_EXTENSION_SEGMENTS = 100;

export interface TrackPlacement {
  id: string;
  symbolId: string;
  rowKey: string;
  startCellId: string;
  endCellId: string;
  label: string;
}

export interface TrackLayout {
  version: 1;
  rows: RailRow[];
  placements: TrackPlacement[];
}

export interface PlacementSpan {
  row: RailRow;
  startIndex: number;
  endIndex: number;
  startCell: RailCell;
  endCell: RailCell;
  startMetres: number;
  endMetres: number;
}

/** A rail's cell prefix stays stable as its extent grows. */
export function railRowKey(row: RailRow): string {
  return row.cells[0]?.id.replace(/-\d+$/, "") ?? "";
}

/** Parse kilometre + metre chainage without accepting ambiguous invalid values. */
export function parseChainage(value: string): number | null {
  const match = /^(?:Km\s*)?(\d+)\+(\d{1,3}(?:[.,]\d+)?)$/i.exec(value.trim());
  if (!match) return null;
  const kilometres = Number(match[1]);
  const metres = Number(match[2].replace(",", "."));
  const total = kilometres * 1000 + metres;
  return metres < 1000 && Number.isFinite(total) && total <= Number.MAX_SAFE_INTEGER
    ? total
    : null;
}

export function formatChainage(metres: number): string {
  if (!Number.isSafeInteger(metres) || metres < 0) {
    throw new RangeError("Lý trình phải là số mét nguyên không âm.");
  }
  return `${Math.floor(metres / 1000)}+${String(metres % 1000).padStart(3, "0")}`;
}

export function createInitialTrackLayout(): TrackLayout {
  return {
    version: 1,
    rows: RAIL_ROWS.map((row) => ({ ...row, cells: row.cells.map((cell) => ({ ...cell })) })),
    placements: [],
  };
}

/** Inclusive cell selection: the span ends at the end of the last selected cell. */
export function getPlacementSpan(
  rows: RailRow[],
  placement: Pick<TrackPlacement, "rowKey" | "startCellId" | "endCellId">,
): PlacementSpan | null {
  const row = rows.find((item) => railRowKey(item) === placement.rowKey);
  if (!row) return null;
  const startIndex = row.cells.findIndex((cell) => cell.id === placement.startCellId);
  const endIndex = row.cells.findIndex((cell) => cell.id === placement.endCellId);
  if (startIndex < 0 || endIndex < startIndex) return null;
  const startCell = row.cells[startIndex];
  const endCell = row.cells[endIndex];
  const startMetres = parseChainage(startCell.from);
  const endMetres = parseChainage(endCell.to);
  if (startMetres === null || endMetres === null || endMetres <= startMetres) return null;
  return { row, startIndex, endIndex, startCell, endCell, startMetres, endMetres };
}

export function trackExtent(rows: RailRow[]): { startMetres: number; endMetres: number } {
  const starts = rows.flatMap((row) => {
    const value = row.cells[0] ? parseChainage(row.cells[0].from) : null;
    return value === null ? [] : [value];
  });
  const ends = rows.flatMap((row) => {
    const last = row.cells[row.cells.length - 1];
    const value = last ? parseChainage(last.to) : null;
    return value === null ? [] : [value];
  });
  return {
    startMetres: starts.length ? Math.min(...starts) : 0,
    endMetres: ends.length ? Math.max(...ends) : 0,
  };
}

/** Extend all rails together; original rows and existing cell values are preserved. */
export function extendRailRows(rows: RailRow[], count: number): RailRow[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_EXTENSION_SEGMENTS) {
    throw new RangeError(`Số thanh ghép thêm phải từ 1 đến ${MAX_EXTENSION_SEGMENTS}.`);
  }
  return rows.map((row) => {
    const last = row.cells[row.cells.length - 1];
    const lastMetres = last ? parseChainage(last.to) : null;
    const prefix = railRowKey(row);
    const numbers = row.cells.map((cell) => Number(/-(\d+)$/.exec(cell.id)?.[1]));
    if (!last || lastMetres === null || !prefix || numbers.some((number) => !Number.isSafeInteger(number))) {
      throw new RangeError("Dữ liệu thanh ray không hợp lệ để ghép thêm.");
    }
    const lastNumber = Math.max(...numbers);
    if (!Number.isSafeInteger(lastNumber + count)
      || !Number.isSafeInteger(lastMetres + count * RAIL_SEGMENT_LENGTH_METRES)) {
      throw new RangeError("Lý trình hoặc mã thanh ray vượt giới hạn số.");
    }
    const additions = Array.from({ length: count }, (_, index): RailCell => {
      const from = lastMetres + index * RAIL_SEGMENT_LENGTH_METRES;
      return {
        id: `${prefix}-${String(lastNumber + index + 1).padStart(2, "0")}`,
        from: formatChainage(from),
        to: formatChainage(from + RAIL_SEGMENT_LENGTH_METRES),
        temp: DEFAULT_NEW_RAIL_TEMPERATURE,
      };
    });
    return { ...row, cells: [...row.cells, ...additions] };
  });
}

export type RailCellPatch = {
  from?: string;
  to?: string;
  lengthMetres?: number;
  temp?: number;
};

export function railCellLengthMetres(cell: RailCell): number | null {
  const from = parseChainage(cell.from);
  const to = parseChainage(cell.to);
  if (from === null || to === null) return null;
  return to - from;
}

/** Update one cell's chainage/length/temp. Later cells keep their length and slide. */
export function updateRailCell(rows: RailRow[], cellId: string, patch: RailCellPatch): RailRow[] {
  const next = rows.map((row) => ({ ...row, cells: row.cells.map((cell) => ({ ...cell })) }));
  const row = next.find((item) => item.cells.some((cell) => cell.id === cellId));
  if (!row) throw new RangeError("Không tìm thấy thanh ray.");
  const index = row.cells.findIndex((cell) => cell.id === cellId);
  const cell = row.cells[index];

  if (patch.temp !== undefined) {
    if (!Number.isFinite(patch.temp)) throw new RangeError("Nhiệt độ khóa phải là số hữu hạn.");
    cell.temp = patch.temp;
  }

  const hasGeometry = patch.from !== undefined || patch.to !== undefined || patch.lengthMetres !== undefined;
  if (!hasGeometry) {
    if (patch.temp === undefined) throw new RangeError("Không có thông số để cập nhật.");
    return next;
  }

  const currentFrom = parseChainage(cell.from);
  const currentTo = parseChainage(cell.to);
  if (currentFrom === null || currentTo === null) {
    throw new RangeError("Lý trình hiện tại không hợp lệ.");
  }

  let newFrom = currentFrom;
  if (patch.from !== undefined) {
    const parsed = parseChainage(patch.from);
    if (parsed === null || !Number.isSafeInteger(parsed)) {
      throw new RangeError("Lý trình đầu không hợp lệ. Dùng dạng 0+000.");
    }
    newFrom = parsed;
  }

  let newTo: number;
  if (patch.lengthMetres !== undefined) {
    if (!Number.isSafeInteger(patch.lengthMetres) || patch.lengthMetres < 1) {
      throw new RangeError("Chiều dài đoạn phải là số mét nguyên dương.");
    }
    newTo = newFrom + patch.lengthMetres;
  } else if (patch.to !== undefined) {
    const parsed = parseChainage(patch.to);
    if (parsed === null || !Number.isSafeInteger(parsed)) {
      throw new RangeError("Lý trình cuối không hợp lệ. Dùng dạng 0+000.");
    }
    newTo = parsed;
  } else {
    newTo = newFrom + (currentTo - currentFrom);
  }

  if (newTo <= newFrom) throw new RangeError("Lý trình cuối phải lớn hơn lý trình đầu.");
  if (!Number.isSafeInteger(newTo) || newFrom < 0) throw new RangeError("Lý trình vượt giới hạn số.");

  if (index > 0) {
    const previous = row.cells[index - 1];
    const prevFrom = parseChainage(previous.from);
    if (prevFrom === null || newFrom <= prevFrom) {
      throw new RangeError("Lý trình đầu phải lớn hơn lý trình đầu của đoạn trước.");
    }
    previous.to = formatChainage(newFrom);
  }

  cell.from = formatChainage(newFrom);
  cell.to = formatChainage(newTo);

  for (let i = index + 1; i < row.cells.length; i += 1) {
    const length = railCellLengthMetres(row.cells[i]);
    const start = parseChainage(row.cells[i - 1].to);
    if (length === null || length < 1 || start === null) {
      throw new RangeError("Không dồn được các thanh phía sau.");
    }
    const end = start + length;
    if (!Number.isSafeInteger(end)) throw new RangeError("Lý trình vượt giới hạn số.");
    row.cells[i].from = formatChainage(start);
    row.cells[i].to = formatChainage(end);
  }

  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate browser storage before using any stored selection or geometry. */
export function validateTrackLayout(value: unknown): TrackLayout | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.rows)
    || !value.rows.length || !Array.isArray(value.placements)) return null;

  const rows: RailRow[] = [];
  const rowKeys = new Set<string>();
  const cellIds = new Set<string>();
  for (const rawRow of value.rows) {
    if (!isRecord(rawRow) || typeof rawRow.line !== "string" || !rawRow.line.trim()
      || typeof rawRow.rail !== "string" || !rawRow.rail.trim()
      || !Array.isArray(rawRow.cells) || !rawRow.cells.length) return null;
    const cells: RailCell[] = [];
    let previousEnd: number | null = null;
    for (const rawCell of rawRow.cells) {
      if (!isRecord(rawCell) || typeof rawCell.id !== "string" || !/^.+-\d+$/.test(rawCell.id)
        || typeof rawCell.from !== "string" || typeof rawCell.to !== "string"
        || typeof rawCell.temp !== "number" || !Number.isFinite(rawCell.temp)
        || cellIds.has(rawCell.id)) return null;
      const start = parseChainage(rawCell.from);
      const end = parseChainage(rawCell.to);
      if (start === null || end === null || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
        || end <= start || (previousEnd !== null && previousEnd !== start)) return null;
      cells.push({ id: rawCell.id, from: rawCell.from, to: rawCell.to, temp: rawCell.temp });
      cellIds.add(rawCell.id);
      previousEnd = end;
    }
    const row = { line: rawRow.line, rail: rawRow.rail, cells };
    const key = railRowKey(row);
    if (!key || rowKeys.has(key) || cells.some((cell) => cell.id.replace(/-\d+$/, "") !== key)) return null;
    rowKeys.add(key);
    rows.push(row);
  }

  const placements: TrackPlacement[] = [];
  const placementIds = new Set<string>();
  for (const raw of value.placements) {
    if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id.trim() || placementIds.has(raw.id)
      || typeof raw.symbolId !== "string" || !raw.symbolId.trim()
      || typeof raw.rowKey !== "string" || typeof raw.startCellId !== "string"
      || typeof raw.endCellId !== "string" || typeof raw.label !== "string") return null;
    const placement: TrackPlacement = {
      id: raw.id, symbolId: raw.symbolId, rowKey: raw.rowKey,
      startCellId: raw.startCellId, endCellId: raw.endCellId, label: raw.label,
    };
    if (!getPlacementSpan(rows, placement)) return null;
    placementIds.add(placement.id);
    placements.push(placement);
  }
  return { version: 1, rows, placements };
}
