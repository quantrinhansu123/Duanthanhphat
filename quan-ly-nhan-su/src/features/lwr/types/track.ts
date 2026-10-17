/** Domain types for the LWR/CWR rail-welding tracker.
 *  Kept UI-agnostic so data logic stays separate from presentation. */

export type TempBand = "lt30" | "t30_32" | "t33_36" | "t37_40" | "gt40";

export interface BandLabel {
  band: TempBand;
  label: string;
}

export interface RailCell {
  id: string;
  from: string;
  to: string;
  temp: number;
}

export interface RailRow {
  line: string;
  rail: string;
  cells: RailCell[];
}

export interface TrackEvent {
  kind: "turnout" | "bridge" | "tunnel";
  label: string;
  km: string;
  /** position as fraction of the 0–10 km line */
  at: number;
  span?: [number, number];
}

export interface StatItem {
  label: string;
  value: string;
  tone: string;
}

export interface ForcePoint {
  x: number;
  p: number;
  u: number;
}

export interface CellDetail {
  deltaT: number;
  force: number;
  title: string;
}
