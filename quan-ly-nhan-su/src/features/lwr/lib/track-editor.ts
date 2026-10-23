import { RAIL_ROWS } from "./track-data";
import {
  DEFAULT_STRESS_INPUT,
  getRailProfile,
  nextUnusedRailType,
  type StressInput,
} from "./stress-release";
import type { RailCell, RailRow } from "../types/track";

export const TRACK_LAYOUT_STORAGE_KEY = "tp-track-layout-v2";
export const RAIL_SEGMENT_LENGTH_METRES = 500;
export const DEFAULT_NEW_RAIL_TEMPERATURE = 35;
export const MAX_EXTENSION_SEGMENTS = 100;

export interface TrackPlacement {
  startMetres?: number;
  endMetres?: number;
  id: string;
  symbolId: string;
  rowKey: string;
  startCellId: string;
  endCellId: string;
  label: string;
}

export interface LongRail {
  projectId?: string;
  startMetres?: number;
  endMetres?: number;
  releaseDate?: string;
  completedAt?: string;
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
  jointWeldLinks?: Record<string, string[]>;
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

const LINE_RAIL_PREFIX: Array<[line: string, rail: string, prefix: string]> = [
  ["TUYẾN THƯỢNG", "Ray trái", "UT"],
  ["TUYẾN THƯỢNG", "Ray phải", "UP"],
  ["TUYẾN HẠ", "Ray trái", "DT"],
  ["TUYẾN HẠ", "Ray phải", "DP"],
];

export function railPrefixFromLabels(line: string, rail: string): string {
  return LINE_RAIL_PREFIX.find((item) => item[0] === line && item[1] === rail)?.[2] ?? "";
}

/** A rail's cell prefix stays stable as its extent grows. Empty rows use line/rail labels. */
export function railRowKey(row: RailRow): string {
  return row.cells[0]?.id.replace(/-\d+$/, "") || railPrefixFromLabels(row.line, row.rail);
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
  if (!Number.isFinite(metres) || metres < 0 || metres > Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Lý trình phải là số mét nguyên không âm.");
  }
  const [whole, fraction] = String(Number((metres % 1000).toFixed(3))).split(".");
  return `${Math.floor(metres / 1000)}+${whole.padStart(3, "0")}${fraction ? `.${fraction}` : ""}`;
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
export function defaultLongRailParams(
  rows: RailRow[],
  span: Pick<LongRail, "rowKey" | "startCellId" | "endCellId" | "startMetres" | "endMetres">,
  railType?: string,
): StressInput {
  const placement = getPlacementSpan(rows, span);
  const type = railType || DEFAULT_STRESS_INPUT.railType;
  const base = paramsForRailType(type);
  if (!placement) return base;
  return {
    ...base,
    leftLength: placement.endMetres - placement.startMetres,
    rightLength: 0,
    neutralTemp: placement.startCell.temp,
  };
}

/** True when two inclusive cell ranges on the same row share any cell. */
export function longRailsOverlap(
  rows: RailRow[],
  a: Pick<LongRail, "rowKey" | "startCellId" | "endCellId" | "startMetres" | "endMetres">,
  b: Pick<LongRail, "rowKey" | "startCellId" | "endCellId" | "startMetres" | "endMetres">,
): boolean {
  if (a.rowKey !== b.rowKey) return false;
  const spanA = getPlacementSpan(rows, a);
  const spanB = getPlacementSpan(rows, b);
  if (!spanA || !spanB) return false;
  return spanA.startMetres < spanB.endMetres && spanB.startMetres < spanA.endMetres;
}

export function nextLongRailCode(longRails: LongRail[], _rowKey?: string): string {
  const numbers = longRails
    .map((item) => Number(/^LWR(\d+)$/i.exec(item.code.trim())?.[1]))
    .filter((n) => Number.isSafeInteger(n) && n > 0);
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `LWR${String(next).padStart(2, "0")}`;
}

function cellRange(cell: RailCell): { from: number; to: number } | null {
  const from = parseChainage(cell.from);
  const to = parseChainage(cell.to);
  return from !== null && to !== null && to > from ? { from, to } : null;
}

function nextCellNumber(row: RailRow): number {
  const numbers = row.cells.map((cell) => Number(/-(\d+)$/.exec(cell.id)?.[1]));
  return (numbers.filter((n) => Number.isSafeInteger(n)).length ? Math.max(...numbers.filter((n) => Number.isSafeInteger(n))) : 0) + 1;
}

/** Bảo đảm dải ray phủ lý trình đầu–cuối; trả về ô bắt đầu/kết thúc để đánh dấu sơ đồ. */
export function ensureRowSpan(
  rows: RailRow[],
  rowKey: string,
  startMetres: number,
  endMetres: number,
): { rows: RailRow[]; startCellId: string; endCellId: string } {
  if (!Number.isSafeInteger(startMetres) || !Number.isSafeInteger(endMetres) || endMetres <= startMetres) {
    throw new RangeError("Lý trình cuối phải lớn hơn lý trình đầu.");
  }
  const next = rows.map((row) => ({ ...row, cells: row.cells.map((cell) => ({ ...cell })) }));
  const row = next.find((item) => railRowKey(item) === rowKey);
  if (!row) throw new RangeError("Không tìm thấy dải ray.");
  const prefix = railRowKey(row);

  if (row.cells.length === 0) {
    const cell: RailCell = {
      id: `${prefix}-01`,
      from: formatChainage(startMetres),
      to: formatChainage(endMetres),
      temp: DEFAULT_NEW_RAIL_TEMPERATURE,
    };
    row.cells.push(cell);
    return { rows: next, startCellId: cell.id, endCellId: cell.id };
  }

  const first = cellRange(row.cells[0]);
  if (first && startMetres < first.from) {
    row.cells[0].from = formatChainage(startMetres);
  }
  const last = row.cells[row.cells.length - 1];
  const lastRange = cellRange(last);
  if (lastRange && endMetres > lastRange.to) {
    row.cells.push({
      id: `${prefix}-${String(nextCellNumber(row)).padStart(2, "0")}`,
      from: formatChainage(lastRange.to),
      to: formatChainage(endMetres),
      temp: DEFAULT_NEW_RAIL_TEMPERATURE,
    });
  }

  const startIndex = row.cells.findIndex((cell) => {
    const range = cellRange(cell);
    return range !== null && range.from <= startMetres && startMetres < range.to;
  });
  const endIndex = row.cells.findIndex((cell) => {
    const range = cellRange(cell);
    return range !== null && range.from < endMetres && endMetres <= range.to;
  });
  if (startIndex < 0 || endIndex < startIndex) {
    throw new RangeError("Không phủ được đoạn lý trình đã nhập trên dải ray này.");
  }
  return { rows: next, startCellId: row.cells[startIndex].id, endCellId: row.cells[endIndex].id };
}

export function paramsForRailType(railType: string, base: StressInput = DEFAULT_STRESS_INPUT): StressInput {
  const profile = getRailProfile(railType);
  if (!profile) return { ...base, railType };
  return { ...base, railType: profile.id, area: profile.area, modulus: profile.modulus, alpha: profile.alpha };
}

export function defaultRailTypeForNewLongRail(longRails: LongRail[]): string {
  return nextUnusedRailType(longRails.map((item) => item.params.railType));
}

/** Inclusive cell selection: the span ends at the end of the last selected cell. */
export function getPlacementSpan(
  rows: RailRow[],
  placement: Pick<TrackPlacement, "rowKey" | "startCellId" | "endCellId" | "startMetres" | "endMetres">,
): PlacementSpan | null {
  const row = rows.find((item) => railRowKey(item) === placement.rowKey);
  if (!row) return null;
  const exact = placement.startMetres !== undefined || placement.endMetres !== undefined;
  if (exact && (!Number.isFinite(placement.startMetres) || !Number.isFinite(placement.endMetres)
    || placement.startMetres! < 0 || placement.endMetres! <= placement.startMetres!)) return null;
  const startIndex = row.cells.findIndex((cell) => exact
    ? (parseChainage(cell.from) ?? Infinity) <= placement.startMetres! && placement.startMetres! < (parseChainage(cell.to) ?? -Infinity)
    : cell.id === placement.startCellId);
  const endIndex = row.cells.findIndex((cell) => exact
    ? (parseChainage(cell.from) ?? Infinity) < placement.endMetres! && placement.endMetres! <= (parseChainage(cell.to) ?? -Infinity)
    : cell.id === placement.endCellId);
  if (startIndex < 0 || endIndex < startIndex) return null;
  const startCell = row.cells[startIndex];
  const endCell = row.cells[endIndex];
  const startMetres = placement.startMetres ?? parseChainage(startCell.from);
  const endMetres = placement.endMetres ?? parseChainage(endCell.to);
  if (startMetres === null || endMetres === null || endMetres <= startMetres) return null;
  return { row, startIndex, endIndex, startCell, endCell, startMetres, endMetres };
}

export function compareLongRailDisplay(a: LongRail, b: LongRail, selectedId?: string | null, spanA = 0, spanB = 0) {
  if (selectedId) {
    if (a.id === selectedId) return -1;
    if (b.id === selectedId) return 1;
  }
  if (spanA !== spanB) return spanB - spanA;
  return (b.updatedAt ? Date.parse(b.updatedAt) : 0) - (a.updatedAt ? Date.parse(a.updatedAt) : 0);
}

export function coveringLongRail<T extends { rail: LongRail; span: PlacementSpan }>(
  items: T[],
  from: number,
  to: number,
  selectedId?: string | null,
): T | undefined {
  const hits = items.filter(({ span }) => from < span.endMetres && to > span.startMetres);
  if (!hits.length) return undefined;
  return [...hits].sort((a, b) => compareLongRailDisplay(
    a.rail,
    b.rail,
    selectedId,
    a.span.endMetres - a.span.startMetres,
    b.span.endMetres - b.span.startMetres,
  ))[0];
}

export function visibleLongRailSpan(rows: RailRow[], rail: Pick<LongRail, "rowKey" | "startCellId" | "endCellId" | "startMetres" | "endMetres">): PlacementSpan | null {
  const exact = getPlacementSpan(rows, rail);
  if (exact) return exact;
  const row = rows.find((item) => railRowKey(item) === rail.rowKey);
  if (!row?.cells.length) return null;
  const rowStart = parseChainage(row.cells[0].from) ?? 0;
  const rowEnd = parseChainage(row.cells[row.cells.length - 1].to);
  if (rowEnd === null) return null;
  const start = Number.isFinite(rail.startMetres) ? Math.max(rowStart, rail.startMetres as number) : rowStart;
  const end = Number.isFinite(rail.endMetres) ? Math.min(rowEnd, rail.endMetres as number) : rowEnd;
  if (!(end > start)) return null;
  return getPlacementSpan(rows, { ...rail, startMetres: start, endMetres: end });
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

/** Extend all rails together; original rows and existing cell values are preserved.
 *  Empty rows start at Km 0+000. */
export function extendRailRows(rows: RailRow[], count: number): RailRow[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_EXTENSION_SEGMENTS) {
    throw new RangeError(`Số thanh ghép thêm phải từ 1 đến ${MAX_EXTENSION_SEGMENTS}.`);
  }
  return rows.map((row) => {
    const last = row.cells[row.cells.length - 1];
    const lastMetres = last ? parseChainage(last.to) : 0;
    const prefix = railRowKey(row);
    const numbers = row.cells.map((cell) => Number(/-(\d+)$/.exec(cell.id)?.[1]));
    if (lastMetres === null || !prefix || numbers.some((number) => !Number.isSafeInteger(number))) {
      throw new RangeError("Dữ liệu thanh ray không hợp lệ để ghép thêm.");
    }
    const lastNumber = numbers.length ? Math.max(...numbers) : 0;
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

/** Place a short rail at an exact chainage span. Width on the map follows metres. */
export function placeShortRailSpan(rows: RailRow[], rowKey: string, startMetres: number, endMetres: number): { rows: RailRow[]; cellId: string } {
  if (!Number.isSafeInteger(startMetres) || !Number.isSafeInteger(endMetres) || startMetres < 0 || endMetres <= startMetres) {
    throw new RangeError("Nhập lý trình đầu/cuối hợp lệ, cuối lớn hơn đầu.");
  }
  const next = rows.map((row) => ({ ...row, cells: row.cells.map((cell) => ({ ...cell })) }));
  const row = next.find((item) => railRowKey(item) === rowKey);
  if (!row) throw new RangeError("Không tìm thấy dải ray.");
  const prefix = railRowKey(row);
  let nextNum = nextCellNumber(row);
  const allocId = () => {
    const id = `${prefix}-${String(nextNum).padStart(2, "0")}`;
    nextNum += 1;
    return id;
  };

  for (const cell of row.cells) {
    if (!cell.placed && !cell.released) continue;
    const range = cellRange(cell);
    if (range && startMetres < range.to && endMetres > range.from) {
      throw new RangeError(`Đoạn Km ${formatChainage(startMetres)} – ${formatChainage(endMetres)} chồng lên thanh ${cell.id} đã rải.`);
    }
  }

  if (row.cells.length === 0) {
    const cell: RailCell = {
      id: `${prefix}-01`,
      from: formatChainage(startMetres),
      to: formatChainage(endMetres),
      temp: DEFAULT_NEW_RAIL_TEMPERATURE,
      placed: true,
    };
    row.cells.push(cell);
    return { rows: next, cellId: cell.id };
  }

  const first = cellRange(row.cells[0]);
  if (first && startMetres < first.from) {
    if (row.cells[0].placed || row.cells[0].released) {
      throw new RangeError("Không đặt trước thanh đã rải trên dải này.");
    }
    row.cells[0].from = formatChainage(startMetres);
  }
  const last = row.cells[row.cells.length - 1];
  const lastRange = cellRange(last);
  if (lastRange && endMetres > lastRange.to) {
    if (!last.placed && !last.released) {
      last.to = formatChainage(endMetres);
    } else {
      row.cells.push({
        id: allocId(),
        from: formatChainage(lastRange.to),
        to: formatChainage(endMetres),
        temp: DEFAULT_NEW_RAIL_TEMPERATURE,
      });
    }
  }

  const rebuilt: RailCell[] = [];
  for (const cell of row.cells) {
    const range = cellRange(cell);
    if (!range) continue;
    const work = Boolean(cell.placed || cell.released);
    if (work || range.to <= startMetres || range.from >= endMetres) {
      rebuilt.push(cell);
      continue;
    }
    if (range.from < startMetres) {
      rebuilt.push({ ...cell, to: formatChainage(startMetres) });
    }
    if (range.to > endMetres) {
      rebuilt.push({
        ...cell,
        id: range.from < startMetres ? allocId() : cell.id,
        from: formatChainage(endMetres),
      });
    }
  }
  const placed: RailCell = {
    id: allocId(),
    from: formatChainage(startMetres),
    to: formatChainage(endMetres),
    temp: DEFAULT_NEW_RAIL_TEMPERATURE,
    placed: true,
  };
  const insertAt = rebuilt.findIndex((cell) => (cellRange(cell)?.from ?? Infinity) >= endMetres);
  if (insertAt < 0) rebuilt.push(placed);
  else rebuilt.splice(insertAt, 0, placed);
  row.cells = rebuilt;
  return { rows: next, cellId: placed.id };
}

/** Place the next hidden short rail on one row. Does not lengthen the planned line. */
export function placeNextShortRail(rows: RailRow[], rowKey: string): RailRow[] {
  const target = rows.find((row) => railRowKey(row) === rowKey);
  if (!target) {
    throw new RangeError("Không tìm thấy dải ray.");
  }
  const nextIndex = target.cells.findIndex((cell) => !cell.released && !cell.placed);
  if (nextIndex >= 0) {
    return rows.map((row) => {
      if (railRowKey(row) !== rowKey) return row;
      return {
        ...row,
        cells: row.cells.map((cell, index) => (index === nextIndex ? { ...cell, placed: true } : cell)),
      };
    });
  }
  const extent = trackExtent(rows);
  const last = target.cells[target.cells.length - 1];
  const lastEnd = last ? parseChainage(last.to) : extent.startMetres;
  if (lastEnd === null || lastEnd >= extent.endMetres) {
    throw new RangeError("Hết thanh trên dải này. Dùng Rải tuyến hoặc Ghép thêm thanh nếu cần kéo dài tuyến.");
  }
  const numbers = target.cells.map((cell) => Number(/-(\d+)$/.exec(cell.id)?.[1]));
  const lastNumber = numbers.length ? Math.max(...numbers.filter((n) => Number.isSafeInteger(n))) : 0;
  const addition: RailCell = {
    id: `${rowKey}-${String(lastNumber + 1).padStart(2, "0")}`,
    from: formatChainage(lastEnd),
    to: formatChainage(Math.min(extent.endMetres, lastEnd + RAIL_SEGMENT_LENGTH_METRES)),
    temp: DEFAULT_NEW_RAIL_TEMPERATURE,
    placed: true,
  };
  return rows.map((row) => {
    if (railRowKey(row) !== rowKey) return row;
    return { ...row, cells: [...row.cells, addition] };
  });
}

/** Hide a placed short rail. Never clears Đạt. */
export function removeShortRail(rows: RailRow[], cellId: string): RailRow[] {
  const row = rows.find((item) => item.cells.some((cell) => cell.id === cellId));
  if (!row) throw new RangeError("Không tìm thấy thanh ray.");
  const cell = row.cells.find((item) => item.id === cellId);
  if (!cell) throw new RangeError("Không tìm thấy thanh ray.");
  if (cell.released) {
    throw new RangeError("Thanh đã Đạt. Không xóa trạng thái Đạt. Bấm Chưa giải tỏa trên panel nếu muốn gỡ thanh này.");
  }
  if (!cell.placed) {
    throw new RangeError("Thanh này chưa rải trên sơ đồ.");
  }
  return rows.map((item) => {
    if (!item.cells.some((entry) => entry.id === cellId)) return item;
    return {
      ...item,
      cells: item.cells.map((entry) => {
        if (entry.id !== cellId) return entry;
        const { placed: _placed, ...rest } = entry;
        return rest;
      }),
    };
  });
}

export type RailCellPatch = {
  from?: string;
  to?: string;
  lengthMetres?: number;
  temp?: number;
  released?: boolean;
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
  if (patch.released !== undefined) {
    if (patch.released) cell.released = true;
    else delete cell.released;
  }

  const hasGeometry = patch.from !== undefined || patch.to !== undefined || patch.lengthMetres !== undefined;
  if (!hasGeometry) {
    if (patch.temp === undefined && patch.released === undefined) throw new RangeError("Không có thông số để cập nhật.");
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

/** Apply a cell edit and keep long-rail lengths in sync with the new span. */
export function patchTrackCell(layout: TrackLayout, cellId: string, patch: RailCellPatch): TrackLayout {
  const rows = updateRailCell(layout.rows, cellId, patch);
  const hasGeometry = patch.from !== undefined || patch.to !== undefined || patch.lengthMetres !== undefined;
  if (hasGeometry) {
    const lostSpan = [...layout.placements, ...layout.longRails].some((item) => (
      item.startMetres !== undefined
      && Boolean(getPlacementSpan(layout.rows, item))
      && !getPlacementSpan(rows, item)
    ));
    if (lostSpan) {
      throw new RangeError("Thay đổi này làm công trình hoặc đoạn thi công nằm ngoài phạm vi tuyến.");
    }
  }
  const longRails = layout.longRails.map((item) => {
    const span = getPlacementSpan(rows, item);
    if (!span) return item;
    const length = span.endMetres - span.startMetres;
    const rightLength = Math.min(item.params.rightLength, length);
    const nextParams = { ...item.params, leftLength: length - rightLength, rightLength };
    if (patch.temp !== undefined && span.startCell.id === cellId) {
      nextParams.neutralTemp = patch.temp;
    }
    if (
      nextParams.leftLength === item.params.leftLength
      && nextParams.neutralTemp === item.params.neutralTemp
    ) {
      return item;
    }
    return { ...item, params: nextParams, updatedAt: new Date().toISOString() };
  });
  return { ...layout, rows, longRails };
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

/** Added after the first 60R2 save format; missing keys keep sample defaults. */
const OPTIONAL_STRESS_NUMBER_KEYS: StressNumberKey[] = [
  "leftOuterMovement", "rightOuterMovement",
  "jackCylinderArea", "minAnchorLength", "allowedGap", "lockTempOffset",
];

export function validateStressParams(value: unknown): StressInput | null {
  if (!isRecord(value)) return null;
  const params = { ...DEFAULT_STRESS_INPUT };
  if (value.bufferDeformations !== undefined) {
    const deltas = value.bufferDeformations;
    if (!isRecord(deltas)) return null;
    const keys = ["longExpansion", "longContraction", "bufferExpansion", "bufferContraction"] as const;
    if (keys.some(key => typeof deltas[key] !== "number" || !Number.isFinite(deltas[key]) || (deltas[key] as number) < 0)) return null;
    params.bufferDeformations = { longExpansion: deltas.longExpansion as number, longContraction: deltas.longContraction as number, bufferExpansion: deltas.bufferExpansion as number, bufferContraction: deltas.bufferContraction as number };
  }
  if (value.trackSide !== undefined) {
    if (value.trackSide !== "LEFT" && value.trackSide !== "RIGHT") return null;
    params.trackSide = value.trackSide;
  }
  for (const key of ["startChainage", "endChainage", "jointChainage"] as const) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== "string") return null;
    params[key] = value[key];
  }
  for (const key of STRESS_NUMBER_KEYS) {
    const raw = value[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
    params[key] = raw;
  }
  for (const key of OPTIONAL_STRESS_NUMBER_KEYS) {
    const raw = value[key];
    if (raw === undefined) continue;
    if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
    params[key] = raw;
  }
  if (typeof value.sideRollers !== "boolean") return null;
  if (value.method !== "ATW" && value.method !== "FBW" && value.method !== "SINGLE") return null;
  params.sideRollers = value.sideRollers;
  params.method = value.method;
  if (value.railType !== undefined) {
    if (typeof value.railType !== "string" || !value.railType.trim()) return null;
    params.railType = value.railType.trim();
  }
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
  if ((value.startMetres !== undefined || value.endMetres !== undefined)
    && (typeof value.startMetres !== "number" || typeof value.endMetres !== "number"
      || !Number.isFinite(value.startMetres) || !Number.isFinite(value.endMetres)
      || value.startMetres < 0 || value.endMetres <= value.startMetres)) return null;
  if (value.releaseDate !== undefined && (typeof value.releaseDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.releaseDate))) return null;
  if (value.completedAt !== undefined && (typeof value.completedAt !== "string" || !Number.isFinite(Date.parse(value.completedAt)))) return null;
  return {
    projectId: typeof value.projectId === "string" ? value.projectId : undefined,
    startMetres: value.startMetres as number | undefined,
    endMetres: value.endMetres as number | undefined,
    releaseDate: value.releaseDate as string | undefined,
    completedAt: value.completedAt as string | undefined,
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
      || !Array.isArray(rawRow.cells)) return null;
    const cells: RailCell[] = [];
    let previousEnd: number | null = null;
    for (const rawCell of rawRow.cells) {
      if (!isRecord(rawCell) || typeof rawCell.id !== "string" || !/^.+-\d+$/.test(rawCell.id)
        || typeof rawCell.from !== "string" || typeof rawCell.to !== "string"
        || typeof rawCell.temp !== "number" || !Number.isFinite(rawCell.temp)
        || (rawCell.placed !== undefined && typeof rawCell.placed !== "boolean")
        || (rawCell.released !== undefined && typeof rawCell.released !== "boolean")
        || cellIds.has(rawCell.id)) return null;
      const start = parseChainage(rawCell.from);
      const end = parseChainage(rawCell.to);
      if (start === null || end === null || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
        || end <= start || (previousEnd !== null && previousEnd !== start)) return null;
      cells.push({
        id: rawCell.id,
        from: rawCell.from,
        to: rawCell.to,
        temp: rawCell.temp,
        ...(rawCell.placed ? { placed: true } : {}),
        ...(rawCell.released ? { released: true } : {}),
      });
      cellIds.add(rawCell.id);
      previousEnd = end;
    }
    const row = { line: rawRow.line, rail: rawRow.rail, cells };
    const key = railRowKey(row);
    if (!key || rowKeys.has(key) || (cells.length > 0 && cells.some((cell) => cell.id.replace(/-\d+$/, "") !== key))) return null;
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
      startMetres: raw.startMetres as number | undefined, endMetres: raw.endMetres as number | undefined,
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
  const links = value.jointWeldLinks;
  if (links !== undefined && (!isRecord(links) || Object.values(links).some(ids => !Array.isArray(ids) || ids.some(id => typeof id !== "string")))) return null;
  return { version: 1, rows, placements, longRails, jointWeldLinks: links as Record<string, string[]> | undefined };
}

/** Planned 500 m intervals stop exactly at the project endpoint. */
export function generateRailRows(rows: RailRow[], start: number, end: number): RailRow[] {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end - start > 500_000) {
    throw new RangeError("Nhập lý trình đầu/cuối theo mét nguyên, chiều dài tuyến tối đa 500 km.");
  }
  return rows.map(row => {
    const cells: RailCell[] = [];
    for (let from = start; from < end;) {
      const to = Math.min(end, (Math.floor(from / 500) + 1) * 500);
      const old = row.cells.find(c => parseChainage(c.from) === from && parseChainage(c.to) === to);
      cells.push({ ...(old ?? { from: formatChainage(from), to: formatChainage(to), temp: DEFAULT_NEW_RAIL_TEMPERATURE }), id: `${railRowKey(row)}-${String(cells.length + 1).padStart(2, "0")}` });
      from = to;
    }
    return { ...row, cells };
  });
}

export const TRACK_PIXELS_PER_METRE = 118 / 500;
export function trackSpanStyle(start: number, end: number, origin: number) {
  return { left: (start - origin) * TRACK_PIXELS_PER_METRE, width: (end - start) * TRACK_PIXELS_PER_METRE };
}
