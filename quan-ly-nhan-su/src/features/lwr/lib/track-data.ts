import type {
  BandLabel,
  CellDetail,
  ForcePoint,
  RailCell,
  RailRow,
  StatItem,
  TempBand,
  TrackEvent,
} from "../types/track";

export function tempBand(t: number): TempBand {
  if (t < 30) return "lt30";
  if (t <= 32) return "t30_32";
  if (t <= 36) return "t33_36";
  if (t <= 40) return "t37_40";
  return "gt40";
}

export const BAND_COLORS: Record<TempBand, string> = {
  lt30: "#2f7fe0",
  t30_32: "#33b3c4",
  t33_36: "#1c9a57",
  t37_40: "#e8930c",
  gt40: "#e04242",
};

export const BAND_LABELS: BandLabel[] = [
  { band: "lt30", label: "<30°C" },
  { band: "t30_32", label: "30–32°C" },
  { band: "t33_36", label: "33–36°C" },
  { band: "t37_40", label: "37–40°C" },
  { band: "gt40", label: ">40°C" },
];

export const TRACK_STATS: StatItem[] = [
  { label: "Tổng chiều dài ray", value: "40 km", tone: "text-slate-900" },
  { label: "Đoạn LWR", value: "80", tone: "text-slate-900" },
  { label: "Ghi (Turnout)", value: "12", tone: "text-red-500" },
  { label: "Cầu (Bridge)", value: "5", tone: "text-blue-600" },
  { label: "Hầm (Tunnel)", value: "3", tone: "text-slate-900" },
];

/** Four rails exist as empty rows until the user ghép thêm thanh. */
export const RAIL_ROWS: RailRow[] = [
  { line: "TUYẾN THƯỢNG", rail: "Ray trái", cells: [] },
  { line: "TUYẾN THƯỢNG", rail: "Ray phải", cells: [] },
  { line: "TUYẾN HẠ", rail: "Ray trái", cells: [] },
  { line: "TUYẾN HẠ", rail: "Ray phải", cells: [] },
];

/** Flat lookup of every cell, in display order. */
export const ALL_CELLS: RailCell[] = RAIL_ROWS.flatMap((r) => r.cells);

export const ALL_CELL_IDS: string[] = ALL_CELLS.map((c) => c.id);

export const DEFAULT_CELL_ID = "";

export function getCellById(id: string): RailCell | undefined {
  return ALL_CELLS.find((c) => c.id === id);
}

/** Step selection forward/backward with wrap-around; unknown ids fall back to default. */
export function stepCellId(currentId: string, direction: 1 | -1): string {
  if (ALL_CELL_IDS.length === 0) return currentId;
  const idx = ALL_CELL_IDS.indexOf(currentId);
  const base = idx === -1 ? 0 : idx;
  const next = (base + direction + ALL_CELL_IDS.length) % ALL_CELL_IDS.length;
  return ALL_CELL_IDS[next];
}

export const TRACK_EVENTS: TrackEvent[] = [
  { kind: "turnout", label: "Ghi #1", km: "Km 0+820", at: 0.082 },
  { kind: "bridge", label: "Cầu C1", km: "Km 2+100 – 2+350", at: 0.222, span: [0.21, 0.235] },
  { kind: "tunnel", label: "Hầm H1", km: "Km 4+800 – 5+600", at: 0.52, span: [0.48, 0.56] },
  { kind: "turnout", label: "Ghi #2", km: "Km 6+750", at: 0.675 },
  { kind: "bridge", label: "Cầu C2", km: "Km 7+900 – 8+110", at: 0.8, span: [0.79, 0.811] },
  { kind: "tunnel", label: "Hầm H2", km: "Km 9+200 – 9+800", at: 0.95, span: [0.92, 0.98] },
];

/** Synthetic dual-axis curve estimated from the reference thumbnail:
 *  red P(kN): 0 at both rail ends, flat +110.8 kN plateau mid-span;
 *  blue u(mm): +0.26 mm at both ends, ~0 at centre. */
export function buildForceData(): ForcePoint[] {
  const pts: ForcePoint[] = [];
  const N = 61;
  for (let i = 0; i < N; i++) {
    const x = (500 * i) / (N - 1);
    const t = x / 500; // 0..1
    const edge = Math.min(1, Math.min(t, 1 - t) / 0.22);
    const smooth = edge * edge * (3 - 2 * edge);
    const p = 110.8 * smooth;
    const u = 0.26 * (1 - Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * 0.96);
    pts.push({ x: Math.round(x), p: Math.round(p * 10) / 10, u: Math.round(u * 1000) / 1000 });
  }
  return pts;
}

const NEUTRAL_TEMP = 35;
/** P ≈ E·A·α·|ΔT| per metre → ≈ 18.47 kN per °C for this rail profile. */
const FORCE_PER_DEGREE = 18.47;

export function detailForCell(cell: RailCell): CellDetail {
  const deltaT = cell.temp - NEUTRAL_TEMP;
  const force = Math.round(Math.abs(deltaT) * FORCE_PER_DEGREE * 10) / 10;
  // Prefix convention: U = tuyến thượng, D = tuyến hạ; T = ray trái, P = ray phải.
  const prefix = cell.id.split("-")[0] ?? "";
  const lineName = prefix.startsWith("U") ? "Tuyến thượng" : "Tuyến hạ";
  const railName = prefix.endsWith("T") ? "Ray trái" : "Ray phải";
  return { deltaT, force, title: `${lineName} - ${railName}` };
}
