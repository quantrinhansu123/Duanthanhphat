/** Deformations in mm from the approved thermal calculation, before rounding. */
export interface BufferDeformations {
  longExpansion: number;
  longContraction: number;
  bufferExpansion: number;
  bufferContraction: number;
}

export interface BufferGapRow {
  label: string;
  symbol: "a₁" | "a₂";
  lowerFormula: string;
  upperFormula: string;
  lower: number | null;
  upper: number | null;
  feasible: boolean | null;
}

export function calculateBufferGaps(structuralGap: number, deltas?: BufferDeformations): BufferGapRow[] {
  if (!Number.isFinite(structuralGap) || structuralGap <= 0) throw new RangeError("Khe hở cấu tạo phải lớn hơn 0.");
  if (deltas && [deltas.longExpansion, deltas.longContraction, deltas.bufferExpansion, deltas.bufferContraction].some(value => !Number.isFinite(value) || value < 0)) throw new RangeError("Các lượng giãn/co phải là số hữu hạn không âm.");
  const definitions = [
    { label: "Khe hở giữa ray dài và ray đệm", symbol: "a₁" as const, lowerFormula: "a₁ ≥ Δdài,giãn + Δđệm,giãn", upperFormula: "a₁ ≤ ag − (Δdài,co + Δđệm,co)", low: deltas ? deltas.longExpansion + deltas.bufferExpansion : null, high: deltas ? structuralGap - deltas.longContraction - deltas.bufferContraction : null },
    { label: "Khe hở giữa hai ray đệm 25 m", symbol: "a₂" as const, lowerFormula: "a₂ ≥ 2Δđệm,giãn", upperFormula: "a₂ ≤ ag − 2Δđệm,co", low: deltas ? 2 * deltas.bufferExpansion : null, high: deltas ? structuralGap - 2 * deltas.bufferContraction : null },
  ];
  return definitions.map(({ low, high, ...row }) => {
    // Round inward so the whole-mm interval still satisfies both inequalities.
    const lower = low === null ? null : Math.ceil(low);
    const upper = high === null ? null : Math.floor(high);
    return { ...row, lower, upper, feasible: lower === null || upper === null ? null : lower <= upper };
  });
}
