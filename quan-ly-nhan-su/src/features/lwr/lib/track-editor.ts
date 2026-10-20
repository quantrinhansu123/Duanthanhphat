import { RAIL_ROWS } from "./track-data";
import { DEFAULT_STRESS_INPUT, type StressInput } from "./stress-release";
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

export interface LongRail {
  id: string;
  code: string;
  label: string;
  rowKey: string;
  startCellId: string;
  endCellId: string;
  params: StressInput;
  updatedAt: string;
}

export interface TrackLayout {
  version: 1;
  rows: RailRow[];
  placements: TrackPlacement[];
  longRails: LongRail[];
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
    longRails: [],
  };
}

/** Default 60R2 params for a new long rail spanning the selected cells. */
export function defaultLongRailParams(rows: RailRow[], span: Pick<LongRail, "rowKey" | "startCellId" | "endCellId">): StressInput {
  const placement = getPlacementSpan(rows, span);
  if (!placement) return { ...DEFAULT_STRESS_INPUT };
  return {
    ...DEFAULT_STRESS_INPUT,
    leftLength: placement.endMetres - placement.startMetres,
    rightLength: 0,
    neutralTemp: placement.startCell.temp,
  };
}

/** True when two inclusive cell ranges on the same row share any cell. */
export function longRailsOverlap(
  rows: RailRow[],
  a: Pick<LongRail, "rowKey" | "startCellId" | "endCellId">,
  b: Pick<LongRail, "rowKey" | "startCellId" | "endCellId">,
): boolean {
  if (a.rowKey !== b.rowKey) return false;
  const spanA = getPlacementSpan(rows, a);
  const spanB = getPlacementSpan(rows, b);
  if (!spanA || !spanB) return false;
  return spanA.startIndex <= spanB.endIndex && spanB.startIndex <= spanA.endIndex;
}

export function nextLongRailCode(longRails: LongRail[], rowKey: string): string {
  const prefix = `TD-${rowKey}-`;
  const numbers = longRails
    .filter((item) => item.code.startsWith(prefix))
    .map((item) => Number(/-(\d+)$/.exec(item.code)?.[1]))
    .filter((n) => Number.isSafeInteger(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `${prefix}${String(next).padStart(2, "0")}`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type StressNumberKey = {
  [K in keyof StressInput]-?: StressInput[K] extends number ? K : never;
}[keyof StressInput];

const STRESS_NUMBER_KEYS: StressNumberKey[] = [
  "area", "modulus", "alpha", "resistance", "jointResistance",
  "leftLength", "rightLength", "radius", "neutralTemp", "leftTemp", "rightTemp",
  "maxTemp", "minTemp", "weldGap", "fbwAllowance", "currentGap", "structuralGap",
  "leftMovement", "rightMovement",
];

export function validateStressParams(value: unknown): StressInput | null {
  if (!isRecord(value)) return null;
  const params = { ...DEFAULT_STRESS_INPUT };
  for (const key of STRESS_NUMBER_KEYS) {
    const raw = value[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
    params[key] = raw;
  }
  if (typeof value.sideRollers !== "boolean") return null;
  if (value.method !== "ATW" && value.method !== "FBW" && value.method !== "SINGLE") return null;
  params.sideRollers = value.sideRollers;
  params.method = value.method;
  return params;
}

/** Parse a long-rail record without requiring it to match current track cells. */
export function parseLongRail(value: unknown): LongRail | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()
    || typeof value.code !== "string" || !value.code.trim()
    || typeof value.label !== "string"
    || typeof value.rowKey !== "string" || typeof value.startCellId !== "string"
    || typeof value.endCellId !== "string" || typeof value.updatedAt !== "string") return null;
  const params = validateStressParams(value.params);
  if (!params) return null;
  return {
    id: value.id, code: value.code, label: value.label, rowKey: value.rowKey,
    startCellId: value.startCellId, endCellId: value.endCellId, params, updatedAt: value.updatedAt,
  };
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

  // Missing longRails = legacy layouts saved before this field existed.
  // Span may be missing after sync from Supabase onto a shorter local schematic — keep the row.
  const rawLongRails = value.longRails === undefined ? [] : value.longRails;
  if (!Array.isArray(rawLongRails)) return null;
  const longRails: LongRail[] = [];
  const longRailIds = new Set<string>();
  for (const raw of rawLongRails) {
    const longRail = parseLongRail(raw);
    if (!longRail || longRailIds.has(longRail.id)) return null;
    if (
      getPlacementSpan(rows, longRail)
      && longRails.some((other) => longRailsOverlap(rows, longRail, other))
    ) return null;
    longRailIds.add(longRail.id);
    longRails.push(longRail);
  }
  return { version: 1, rows, placements, longRails };
}
