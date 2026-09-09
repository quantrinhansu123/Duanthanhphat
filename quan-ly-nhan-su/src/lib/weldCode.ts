/** Mã mối hàn: {mã dự án}{công nghệ}{DD}{MM}{YY}{số TT} — VD: PHQFBW1208260001 */

export const WELD_CODE_SITE_PREFIX = "PHQ";

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function padWeldSequence(n: number, width = 4) {
  return String(n).padStart(width, "0");
}

/** Chuẩn hóa mã dự án dùng làm tiền tố mã mối hàn. */
export function normalizeWeldSitePrefix(value?: string | null) {
  const trimmed = (value ?? "").trim().toUpperCase();
  return trimmed || WELD_CODE_SITE_PREFIX;
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
  return `${normalizeWeldSitePrefix(sitePrefix)}${tech}${parts.day}${parts.month}${parts.year}`;
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

/** Lấy số TT lớn nhất đã dùng cho cùng tiền tố mã dự án + công nghệ + ngày. */
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
  /** Mã dự án — tiền tố mã mối hàn */
  sitePrefix?: string | null;
};

/** Lập kế hoạch mã mới cho các bản ghi (số TT theo mã dự án + ngày + công nghệ). */
export function planWeldCodeAssignments(
  rows: WeldCodeSourceRow[],
  options?: {
    fallbackSitePrefix?: string;
    /** Mã đang giữ của bản ghi không thuộc phạm vi đồng bộ — tránh trùng số TT. */
    reservedCodes?: string[];
  } | string,
): { id: string; oldCode: string; newCode: string }[] {
  const normalizedOptions =
    typeof options === "string"
      ? { fallbackSitePrefix: options, reservedCodes: [] as string[] }
      : {
          fallbackSitePrefix: options?.fallbackSitePrefix ?? WELD_CODE_SITE_PREFIX,
          reservedCodes: options?.reservedCodes ?? [],
        };
  const fallbackSitePrefix = normalizedOptions.fallbackSitePrefix;
  const reservedCodes = normalizedOptions.reservedCodes;

  const enriched = rows
    .map((row) => {
      const sitePrefix = normalizeWeldSitePrefix(row.sitePrefix || fallbackSitePrefix);
      return {
        ...row,
        sitePrefix,
        prefix: buildWeldCodePrefix(row.cong_nghe_han, row.isoDate, sitePrefix),
      };
    })
    .filter((row) => row.prefix)
    .sort((a, b) => {
      const byDate = a.isoDate.localeCompare(b.isoDate);
      if (byDate !== 0) return byDate;
      const bySite = a.sitePrefix.localeCompare(b.sitePrefix);
      if (bySite !== 0) return bySite;
      const byMethod = a.cong_nghe_han.localeCompare(b.cong_nghe_han);
      if (byMethod !== 0) return byMethod;
      const byCode = a.ma_lich_su.localeCompare(b.ma_lich_su, "vi");
      if (byCode !== 0) return byCode;
      return a.id.localeCompare(b.id);
    });

  const seqByPrefix = new Map<string, number>();
  for (const row of enriched) {
    if (!seqByPrefix.has(row.prefix)) {
      seqByPrefix.set(row.prefix, nextWeldSequence(reservedCodes, row.prefix) - 1);
    }
  }

  return enriched.map((row) => {
    const next = (seqByPrefix.get(row.prefix) ?? 0) + 1;
    seqByPrefix.set(row.prefix, next);
    return {
      id: row.id,
      oldCode: row.ma_lich_su,
      newCode: buildWeldCode(row.cong_nghe_han, row.isoDate, next, row.sitePrefix),
    };
  });
}
