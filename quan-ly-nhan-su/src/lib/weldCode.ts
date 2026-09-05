/** Mã mối hàn: {site}{công nghệ}{DD}{MM}{YY}{số TT} — VD: PHQFBW1208260001 */

export const WELD_CODE_SITE_PREFIX = "PHQ";

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function padWeldSequence(n: number, width = 4) {
  return String(n).padStart(width, "0");
}

/** Tách ngày từ datetime-local / ISO thành DD, MM, YY. */
export function weldCodeDateParts(performedAt: string): { day: string; month: string; year: string } | null {
  const iso = performedAt.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, yyyy, month, day] = match;
  return { day, month, year: yyyy.slice(-2) };
}

export function buildWeldCodePrefix(
  method: string,
  performedAt: string,
  sitePrefix = WELD_CODE_SITE_PREFIX,
) {
  const parts = weldCodeDateParts(performedAt);
  if (!parts) return "";
  const tech = method.trim().toUpperCase() || "FBW";
  return `${sitePrefix}${tech}${parts.day}${parts.month}${parts.year}`;
}

export function buildWeldCode(
  method: string,
  performedAt: string,
  sequence: number,
  sitePrefix = WELD_CODE_SITE_PREFIX,
) {
  const prefix = buildWeldCodePrefix(method, performedAt, sitePrefix);
  if (!prefix || !Number.isFinite(sequence) || sequence < 1) return "";
  return `${prefix}${padWeldSequence(sequence)}`;
}

/** Lấy số TT lớn nhất đã dùng cho cùng tiền tố ngày + công nghệ. */
export function nextWeldSequence(existingCodes: string[], prefix: string) {
  if (!prefix) return 1;
  let max = 0;
  for (const code of existingCodes) {
    const value = code.trim().toUpperCase();
    if (!value.startsWith(prefix.toUpperCase())) continue;
    const suffix = value.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    max = Math.max(max, Number(suffix));
  }
  return max + 1;
}

export function suggestWeldCode(
  method: string,
  performedAt: string,
  existingCodes: string[],
  sitePrefix = WELD_CODE_SITE_PREFIX,
) {
  const prefix = buildWeldCodePrefix(method, performedAt, sitePrefix);
  if (!prefix) return "";
  return buildWeldCode(method, performedAt, nextWeldSequence(existingCodes, prefix), sitePrefix);
}

export type WeldCodeSourceRow = {
  id: string;
  ma_lich_su: string;
  cong_nghe_han: string;
  /** ISO date YYYY-MM-DD */
  isoDate: string;
};

/** Lập kế hoạch mã mới cho toàn bộ bản ghi (số TT theo ngày + công nghệ). */
export function planWeldCodeAssignments(
  rows: WeldCodeSourceRow[],
  sitePrefix = WELD_CODE_SITE_PREFIX,
): { id: string; oldCode: string; newCode: string }[] {
  const enriched = rows
    .map((row) => ({
      ...row,
      prefix: buildWeldCodePrefix(row.cong_nghe_han, row.isoDate, sitePrefix),
    }))
    .filter((row) => row.prefix)
    .sort((a, b) => {
      const byDate = a.isoDate.localeCompare(b.isoDate);
      if (byDate !== 0) return byDate;
      const byMethod = a.cong_nghe_han.localeCompare(b.cong_nghe_han);
      if (byMethod !== 0) return byMethod;
      const byCode = a.ma_lich_su.localeCompare(b.ma_lich_su, "vi");
      if (byCode !== 0) return byCode;
      return a.id.localeCompare(b.id);
    });

  const seqByPrefix = new Map<string, number>();
  return enriched.map((row) => {
    const next = (seqByPrefix.get(row.prefix) ?? 0) + 1;
    seqByPrefix.set(row.prefix, next);
    return {
      id: row.id,
      oldCode: row.ma_lich_su,
      newCode: buildWeldCode(row.cong_nghe_han, row.isoDate, next, sitePrefix),
    };
  });
}
