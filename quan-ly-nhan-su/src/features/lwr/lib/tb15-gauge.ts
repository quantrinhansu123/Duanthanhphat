/** Khổ 1.435 mm: H = 2.300 mm và S = 1.500 mm cho β = 0,002·Δh (A.0.2-3). Khổ 1.000 mm nhập H và S. */

export type GaugeMm = 1000 | 1435;
export type VehicleKind = "dau_may" | "toa_xe";

export type GaugeDraft = {
  gauge: GaugeMm;
  /** Khoảng cách tim ray trong – ray ngoài, mm. Khổ 1.435 cố định 1.500. */
  railCenterMm: string;
  cgLocomotiveMm: string;
  cgWagonMm: string;
  vehicle: VehicleKind;
};

export const GAUGE_STANDARD: GaugeDraft = {
  gauge: 1435,
  railCenterMm: "1500",
  cgLocomotiveMm: "2300",
  cgWagonMm: "2300",
  vehicle: "dau_may",
};

export function draftForGauge(gauge: GaugeMm, current: GaugeDraft): GaugeDraft {
  if (gauge === 1435) {
    return { ...GAUGE_STANDARD, vehicle: current.vehicle };
  }
  return {
    gauge: 1000,
    railCenterMm: current.gauge === 1000 ? current.railCenterMm : "",
    cgLocomotiveMm: current.gauge === 1000 ? current.cgLocomotiveMm : "",
    cgWagonMm: current.gauge === 1000 ? current.cgWagonMm : "",
    vehicle: current.vehicle,
  };
}

export function gaugeNumbers(draft: GaugeDraft): { cgHeightMm: number; railCenterMm: number } | { error: string } {
  const rawH = draft.vehicle === "dau_may" ? draft.cgLocomotiveMm : draft.cgWagonMm;
  const H = Number(rawH);
  const S = Number(draft.railCenterMm);
  if (!Number.isFinite(H) || H <= 0 || !Number.isFinite(S) || S <= 0) {
    return { error: "Nhập chiều cao trọng tâm H và khoảng cách tim ray S lớn hơn 0." };
  }
  return { cgHeightMm: H, railCenterMm: S };
}
