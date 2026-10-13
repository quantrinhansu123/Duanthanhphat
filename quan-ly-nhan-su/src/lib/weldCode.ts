/** Mã mối hàn: {mã dự án}-{công nghệ}-{loại}{số TT}
 * VD: PHQ-ATW-SX001, PHQ-ATW-TN002, PHQ-ATW-CT001
 * Số TT đếm riêng theo dự án + phương pháp + loại mối (DT/TN/CT/SX/TS).
 */

import { isWeldType, WELD_TYPE_SHORT_CODES } from "@/data/weldTypes";

export const WELD_CODE_SITE_PREFIX = "PHQ";
export const WELD_CODE_SEQUENCE_WIDTH = 3;
export const MACHINE_WELD_CODE_SEQUENCE_WIDTH = 5;

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function padWeldSequence(n: number, width = WELD_CODE_SEQUENCE_WIDTH) {
  return String(n).padStart(width, "0");
}

/** Mã theo máy: mã máy + 5 số thứ tự trên máy đó. VD: KCM0070100001 */
export function buildMachineWeldCode(machineCode: string, sequence: number) {
  const machine = machineCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!machine || !Number.isFinite(sequence) || sequence < 1) return "";
  return `${machine}${padWeldSequence(sequence, MACHINE_WELD_CODE_SEQUENCE_WIDTH)}`;
}

/** Chuẩn hóa mã dự án dùng làm tiền tố mã mối hàn. */
export function normalizeWeldSitePrefix(value?: string | null) {
  const trimmed = (value ?? "").trim().toUpperCase();
  return trimmed || WELD_CODE_SITE_PREFIX;
}

/** DT = Đào tạo, TN = Thử nghiệm, CT = Chấp thuận, SX = Sản xuất, TS = Tần suất */
export function weldPurposeShortCode(loaiMoiHan?: string | null): string {
  const value = (loaiMoiHan ?? "").trim();
  return isWeldType(value) ? WELD_TYPE_SHORT_CODES[value] : WELD_TYPE_SHORT_CODES["Sản xuất"];
}

/** Dự án đã có mã riêng để làm tiền tố (không phải dùng tiền tố dự phòng). */
export function hasOwnWeldSitePrefix(value?: string | null) {
  return /^[A-Z0-9]+$/i.test((value ?? "").trim());
}

/** Tách ngày từ datetime-local / ISO thành DD, MM, YY. */
export function weldCodeDateParts(performedAt: string): { day: string; month: string; year: string } | null {
  const iso = performedAt.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, yyyy, month, day] = match;
  return { day, month, year: yyyy.slice(-2) };
}

/** Tiền tố đếm: mã dự án + công nghệ + loại mối. */
export function buildWeldCodePrefix(
  method: string,
  _performedAt?: string,
  sitePrefix?: string,
  loaiMoiHan?: string | null,
) {
  const methodPart = method.trim().toUpperCase() || "FBW";
  const site = normalizeWeldSitePrefix(sitePrefix);
  const purpose = weldPurposeShortCode(loaiMoiHan);
  return `${site}-${methodPart}-${purpose}`;
}

export function buildWeldCode(
  method: string,
  performedAt: string,
  sequence: number,
  sitePrefix = WELD_CODE_SITE_PREFIX,
  loaiMoiHan?: string | null,
) {
  const prefix = buildWeldCodePrefix(method, performedAt, sitePrefix, loaiMoiHan);
  if (!prefix || !Number.isFinite(sequence) || sequence < 1) return "";
  return `${prefix}${padWeldSequence(sequence)}`;
}

/** Lấy số TT lớn nhất đã dùng cho cùng tiền tố (dự án + công nghệ + loại). */
export function nextWeldSequence(existingCodes: string[], prefix: string) {
  if (!prefix) return 1;
  const needle = prefix.toUpperCase();
  let max = 0;
  for (const code of existingCodes) {
    const value = code.trim().toUpperCase();
    if (!value.startsWith(needle)) continue;
    const suffix = value.slice(needle.length);
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
  loaiMoiHan?: string | null,
) {
  const prefix = buildWeldCodePrefix(method, performedAt, sitePrefix, loaiMoiHan);
  if (!prefix) return "";
  return buildWeldCode(
    method,
    performedAt,
    nextWeldSequence(existingCodes, prefix),
    sitePrefix,
    loaiMoiHan,
  );
}

export type WeldCodeSourceRow = {
  id: string;
  ma_lich_su: string;
  cong_nghe_han: string;
  /** ISO date YYYY-MM-DD */
  isoDate: string;
  /** Mã dự án — tiền tố mã mối hàn */
  sitePrefix?: string | null;
  /** Loại mối hàn (WELD_TYPE_OPTIONS) */
  loai_moi_han?: string | null;
};

/** Lập kế hoạch mã mới (số TT theo dự án + công nghệ + loại mối). */
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
      const loai_moi_han = row.loai_moi_han?.trim() || "Sản xuất";
      return {
        ...row,
        sitePrefix,
        loai_moi_han,
        prefix: buildWeldCodePrefix(row.cong_nghe_han, row.isoDate, sitePrefix, loai_moi_han),
      };
    })
    .filter((row) => row.prefix)
    .sort((a, b) => {
      const bySite = a.sitePrefix.localeCompare(b.sitePrefix);
      if (bySite !== 0) return bySite;
      const byMethod = a.cong_nghe_han.localeCompare(b.cong_nghe_han);
      if (byMethod !== 0) return byMethod;
      const byType = a.loai_moi_han.localeCompare(b.loai_moi_han, "vi");
      if (byType !== 0) return byType;
      const byDate = a.isoDate.localeCompare(b.isoDate);
      if (byDate !== 0) return byDate;
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
      newCode: buildWeldCode(row.cong_nghe_han, row.isoDate, next, row.sitePrefix, row.loai_moi_han),
    };
  });
}
