// Input units are those of the stored LWR stress-release record.
export const cwrInputs = [
  ["area", "Diện tích F", "mm²", 1e6],
  ["modulus", "Mô đun E", "MPa", 0.001],
  ["alpha", "Hệ số giãn nở α", "1/°C", 1],
  ["minTemp", "Nhiệt độ ray thấp nhất", "°C", 1],
  ["maxTemp", "Nhiệt độ ray cao nhất", "°C", 1],
  ["neutralTemp", "Nhiệt độ khóa trong hồ sơ", "°C", 1],
  ["lockTempOffset", "Biên độ khóa ±", "°C", 1],
  ["resistance", "Lực cản dọc r", "kN/(m·ray)", 1],
  ["jointResistance", "Lực cản mối nối Pⱼ", "kN", 1],
  ["allowedGap", "Ngưỡng khe trong hồ sơ", "mm", 1],
] as const;
type Key = typeof cwrInputs[number][0];
export type CwrParams = Partial<Record<Key, number>>;
export type CwrRail = {
  id: string; code: string; label: string; projectId?: string; updatedAt: string;
  railType: string; params: CwrParams;
};

export function readCwrRail(raw: { id: string; code: string; label?: string; updatedAt?: string; params?: unknown }, projectId: string): CwrRail {
  const data = (raw.params && typeof raw.params === "object" ? raw.params : {}) as Record<string, unknown>;
  const params: CwrParams = {};
  for (const [key] of cwrInputs) {
    const value = data[key];
    if (typeof value === "number" && Number.isFinite(value)) params[key] = value;
  }
  const prefix = projectId + ":";
  const code = projectId && raw.code.startsWith(prefix) ? raw.code.slice(prefix.length) : raw.code;
  return { id: raw.id, code, label: raw.label ?? "", updatedAt: raw.updatedAt ?? "", projectId: projectId || undefined,
    railType: typeof data.railType === "string" ? data.railType.trim() : "", params };
}

export function calculateCwr(p: CwrParams) {
  const positive = (v?: number): v is number => v !== undefined && Number.isFinite(v) && v > 0;
  const nonnegative = (v?: number): v is number => v !== undefined && Number.isFinite(v) && v >= 0;
  const { area, modulus, alpha, minTemp, maxTemp, neutralTemp, lockTempOffset, resistance, jointResistance, allowedGap } = p;
  const E = positive(modulus) ? modulus / 1000 : null;
  const EA = E !== null && positive(area) ? E * area * 1e6 : null; // N
  const haveLock = Number.isFinite(neutralTemp) && nonnegative(lockTempOffset);
  const upper = haveLock ? neutralTemp! + lockTempOffset : null;
  const lower = haveLock ? neutralTemp! - lockTempOffset : null;
  const invalidRange = (minTemp !== undefined && maxTemp !== undefined && minTemp >= maxTemp)
    || (lower !== null && minTemp !== undefined && lower < minTemp)
    || (upper !== null && maxTemp !== undefined && upper > maxTemp);
  const rise = !invalidRange && lower !== null && maxTemp !== undefined ? maxTemp - lower : null;
  const drop = !invalidRange && upper !== null && minTemp !== undefined ? upper - minTemp : null;
  const knPerDegree = EA !== null && positive(alpha) ? EA * alpha / 1000 : null;
  const compression = knPerDegree !== null && rise !== null ? knPerDegree * rise : null;
  const tension = knPerDegree !== null && drop !== null ? knPerDegree * drop : null;
  const stress = E !== null && positive(alpha) && drop !== null ? E * alpha * drop : null;
  const gap = EA !== null && positive(alpha) && drop !== null && positive(resistance)
    ? EA * (alpha * drop) ** 2 / resistance : null;
  const dropLimit = EA !== null && positive(alpha) && positive(resistance) && positive(allowedGap)
    ? Math.sqrt(allowedGap * resistance / EA) / alpha : null;
  const length = tension !== null && compression !== null && nonnegative(jointResistance) && positive(resistance)
    ? Math.max(0, (Math.max(tension, compression) - jointResistance) / resistance) : null;
  const withinGap = gap !== null && positive(allowedGap) ? gap <= allowedGap : null;
  return { upper, lower, rise, drop, compression, tension, stress, gap, dropLimit, length, withinGap, invalidRange };
}
