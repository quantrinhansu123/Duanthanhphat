/** Mã nhật ký hàn (đồng bộ Autolisp / máy / sơn):
 * - Hệ thống:   {mã DA}-{CN}-{DD}-{MM}-{YY}-{xxxx}   · TT 1→n theo dự án + công nghệ
 * - Hiện trường:{CN}-{DD}-{MM}-{YY}-{xxxx}            · cùng số TT với mã hệ thống (= sơn bụng ray)
 * - Máy:        {DD}-{MM}-{YY}-{xxxx}                · TT 1→hết ngày, reset mỗi ngày (mọi máy)
 * - Tọa độ:     HT|HP|TT|TP + xxxx                    · Autolisp · TT 1→n theo từng dải ray
 * VD: PQ-FBW-25-10-26-0001 · FBW-25-10-26-0001 · 25-10-26-0001 · HT0001
 */

export type MachineWeldNumbering = "un5" | "k922" | "day";

export const WELD_CODE_SITE_PREFIX = "PQ";
export const WELD_CODE_SEQUENCE_WIDTH = 4;
export const MACHINE_WELD_CODE_SEQUENCE_WIDTH = 4;

export const COORDINATE_RAIL_PREFIXES = ["HT", "HP", "TT", "TP"] as const;
export type CoordinateRailPrefix = (typeof COORDINATE_RAIL_PREFIXES)[number];

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function padWeldSequence(n: number, width = WELD_CODE_SEQUENCE_WIDTH) {
  return String(n).padStart(width, "0");
}

/** Chuẩn hóa mã dự án dùng làm tiền tố mã hệ thống. */
export function normalizeWeldSitePrefix(value?: string | null) {
  const trimmed = (value ?? "").trim().toUpperCase();
  return trimmed || WELD_CODE_SITE_PREFIX;
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

function normalizeMethod(method?: string | null) {
  return (method ?? "").trim().toUpperCase() || "FBW";
}

/** Tiền tố đếm mã hệ thống: {mã DA}-{công nghệ}- (không gồm ngày — TT theo cả dự án). */
export function buildWeldCodePrefix(
  method: string,
  _performedAt?: string,
  sitePrefix?: string,
  _loaiMoiHan?: string | null,
) {
  const site = normalizeWeldSitePrefix(sitePrefix);
  return `${site}-${normalizeMethod(method)}-`;
}

/** Tiền tố mã hiện trường (không gồm mã DA): {công nghệ}- */
export function buildSiteFieldCodePrefix(method: string) {
  return `${normalizeMethod(method)}-`;
}

/** Tiền tố mã máy theo ngày: {DD}-{MM}-{YY}- */
export function buildMachineDayPrefix(performedAt: string) {
  const parts = weldCodeDateParts(performedAt);
  if (!parts) return "";
  return `${parts.day}-${parts.month}-${parts.year}-`;
}

export type ParsedSystemWeldCode = {
  site: string;
  method: string;
  day: string;
  month: string;
  year: string;
  seq: number;
  width: number;
};

/** Parse mã hệ thống PQ-FBW-25-10-26-0001 */
export function parseSystemWeldCode(code: string): ParsedSystemWeldCode | null {
  const value = code.trim().toUpperCase();
  const match = /^([A-Z0-9]+)-([A-Z0-9]+)-(\d{2})-(\d{2})-(\d{2})-(\d+)$/.exec(value);
  if (!match) return null;
  return {
    site: match[1],
    method: match[2],
    day: match[3],
    month: match[4],
    year: match[5],
    seq: Number(match[6]),
    width: match[6].length,
  };
}

/** Parse mã hiện trường FBW-25-10-26-0001 */
export function parseSiteFieldCode(code: string): Omit<ParsedSystemWeldCode, "site"> | null {
  const value = code.trim().toUpperCase();
  const match = /^([A-Z0-9]+)-(\d{2})-(\d{2})-(\d{2})-(\d+)$/.exec(value);
  if (!match) return null;
  return {
    method: match[1],
    day: match[2],
    month: match[3],
    year: match[4],
    seq: Number(match[5]),
    width: match[5].length,
  };
}

/** Parse mã máy 25-10-26-0001 */
export function parseMachineDayCode(code: string): { day: string; month: string; year: string; seq: number; width: number } | null {
  const value = code.trim().toUpperCase();
  const match = /^(\d{2})-(\d{2})-(\d{2})-(\d+)$/.exec(value);
  if (!match) return null;
  return {
    day: match[1],
    month: match[2],
    year: match[3],
    seq: Number(match[4]),
    width: match[4].length,
  };
}

export function buildWeldCode(
  method: string,
  performedAt: string,
  sequence: number,
  sitePrefix = WELD_CODE_SITE_PREFIX,
  _loaiMoiHan?: string | null,
) {
  const parts = weldCodeDateParts(performedAt);
  if (!parts || !Number.isFinite(sequence) || sequence < 1) return "";
  const site = normalizeWeldSitePrefix(sitePrefix);
  return `${site}-${normalizeMethod(method)}-${parts.day}-${parts.month}-${parts.year}-${padWeldSequence(sequence)}`;
}

export function buildSiteFieldCode(method: string, performedAt: string, sequence: number) {
  const parts = weldCodeDateParts(performedAt);
  if (!parts || !Number.isFinite(sequence) || sequence < 1) return "";
  return `${normalizeMethod(method)}-${parts.day}-${parts.month}-${parts.year}-${padWeldSequence(sequence)}`;
}

/** Mã máy theo ngày (fallback): DD-MM-YY-xxxx. */
export function buildMachineWeldCode(performedAt: string, sequence: number) {
  if (!Number.isFinite(sequence) || sequence < 1) return "";
  const dayPrefix = buildMachineDayPrefix(performedAt);
  if (!dayPrefix) return "";
  return `${dayPrefix}${padWeldSequence(sequence, MACHINE_WELD_CODE_SEQUENCE_WIDTH)}`;
}

/** UN5: Year-Month-Day-xxx — tháng/ngày không pad (vd 2026-9-11-001). */
export function buildUn5MachineWeldCode(performedAt: string, sequence: number) {
  const iso = performedAt.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match || !Number.isFinite(sequence) || sequence < 1) return "";
  const year = match[1];
  const month = String(Number(match[2]));
  const day = String(Number(match[3]));
  return `${year}-${month}-${day}-${padWeldSequence(sequence, 3)}`;
}

/** K922: số thứ tự cộng dồn 1→n trên máy (chỉ số). */
export function buildK922MachineWeldCode(sequence: number) {
  if (!Number.isFinite(sequence) || sequence < 1) return "";
  return String(Math.trunc(sequence));
}

/** Mã trong máy: mọi máy dùng DD-MM-YY-xxxx (TT reset mỗi ngày). */
export function detectMachineWeldNumbering(
  _machine?: { code?: string | null; name?: string | null; model?: string | null } | null,
): MachineWeldNumbering {
  return "day";
}

export function parseUn5MachineCode(
  code: string,
): { year: string; month: number; day: number; seq: number; width: number } | null {
  const value = code.trim();
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})-(\d+)$/.exec(value);
  if (!match) return null;
  return {
    year: match[1],
    month: Number(match[2]),
    day: Number(match[3]),
    seq: Number(match[4]),
    width: match[4].length,
  };
}

export function parseK922MachineCode(code: string): { seq: number } | null {
  const value = code.trim();
  if (!/^\d+$/.test(value)) return null;
  const seq = Number(value);
  if (!Number.isFinite(seq) || seq < 1) return null;
  return { seq };
}

export function nextUn5MachineSequence(existingCodes: string[], performedAt: string) {
  const iso = performedAt.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return 1;
  const year = match[1];
  const month = Number(match[2]);
  const day = Number(match[3]);
  let max = 0;
  for (const code of existingCodes) {
    const parsed = parseUn5MachineCode(code);
    if (!parsed) continue;
    if (parsed.year !== year || parsed.month !== month || parsed.day !== day) continue;
    max = Math.max(max, parsed.seq);
  }
  return max + 1;
}

export function nextK922MachineSequence(existingCodes: string[]) {
  let max = 0;
  for (const code of existingCodes) {
    const parsed = parseK922MachineCode(code);
    if (!parsed) continue;
    max = Math.max(max, parsed.seq);
  }
  return max + 1;
}

/** Số TT tiếp theo cho mã hệ thống (1→n theo dự án + công nghệ). */
export function nextWeldSequence(existingCodes: string[], prefix: string) {
  if (!prefix) return 1;
  const needle = prefix.toUpperCase();
  let max = 0;
  for (const code of existingCodes) {
    const parsed = parseSystemWeldCode(code);
    if (parsed) {
      const codePrefix = `${parsed.site}-${parsed.method}-`;
      if (codePrefix !== needle) continue;
      max = Math.max(max, parsed.seq);
      continue;
    }
    // Fallback cũ: PREFIX + số liền
    const value = code.trim().toUpperCase();
    if (!value.startsWith(needle)) continue;
    const suffix = value.slice(needle.length);
    if (!/^\d+$/.test(suffix)) continue;
    max = Math.max(max, Number(suffix));
  }
  return max + 1;
}

export function nextSiteFieldSequence(existingCodes: string[], method: string) {
  const methodKey = normalizeMethod(method);
  let max = 0;
  for (const code of existingCodes) {
    const parsed = parseSiteFieldCode(code);
    if (!parsed || parsed.method !== methodKey) continue;
    max = Math.max(max, parsed.seq);
  }
  return max + 1;
}

export function nextMachineDaySequence(existingCodes: string[], performedAt: string) {
  const parts = weldCodeDateParts(performedAt);
  if (!parts) return 1;
  let max = 0;
  for (const code of existingCodes) {
    const parsed = parseMachineDayCode(code);
    if (!parsed) continue;
    if (parsed.day !== parts.day || parsed.month !== parts.month || parsed.year !== parts.year) continue;
    max = Math.max(max, parsed.seq);
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

/** Mã hiện trường = mã hệ thống bỏ tiền tố dự án. */
export function fieldCodeFromSystemCode(systemCode: string): string {
  const parsed = parseSystemWeldCode(systemCode);
  if (!parsed) return "";
  return `${parsed.method}-${parsed.day}-${parsed.month}-${parsed.year}-${padWeldSequence(parsed.seq, parsed.width)}`;
}

/** Gợi ý mã hiện trường theo công nghệ + danh sách đã có (TT theo dự án + CN). */
export function suggestSiteFieldCode(method: string, existingCodes: string[], performedAt: string) {
  if (!weldCodeDateParts(performedAt)) return "";
  return buildSiteFieldCode(method, performedAt, nextSiteFieldSequence(existingCodes, method));
}

/** Gợi ý mã máy theo ngày (reset mỗi ngày). `performedAt` = ISO / datetime-local. */
export function suggestMachineWeldCode(performedAt: string, existingCodes: string[]): string {
  if (!weldCodeDateParts(performedAt)) return "";
  return buildMachineWeldCode(performedAt, nextMachineDaySequence(existingCodes, performedAt));
}

/**
 * Gợi ý mã trong máy theo họ thiết bị:
 * - UN5 → YYYY-M-D-xxx (reset ngày)
 * - K922/KCM → n cộng dồn theo máy
 * - khác → DD-MM-YY-xxxx
 */
export function suggestMachineWeldCodeForMachine(
  performedAt: string,
  existingCodes: string[],
  machine?: { code?: string | null; name?: string | null; model?: string | null } | null,
): string {
  const scheme = detectMachineWeldNumbering(machine);
  if (scheme === "un5") {
    return buildUn5MachineWeldCode(performedAt, nextUn5MachineSequence(existingCodes, performedAt));
  }
  if (scheme === "k922") {
    return buildK922MachineWeldCode(nextK922MachineSequence(existingCodes));
  }
  return suggestMachineWeldCode(performedAt, existingCodes);
}

/** Nhãn hướng dẫn ô mã trong máy. */
export function machineWeldCodeHint(
  machine?: { code?: string | null; name?: string | null; model?: string | null } | null,
): string {
  const scheme = detectMachineWeldNumbering(machine);
  if (scheme === "un5") return "UN5 · YYYY-M-D-xxx · TT reset mỗi ngày · sửa được.";
  if (scheme === "k922") return "K922 · số TT cộng dồn 1→n trên máy · sửa được.";
  return "DD-MM-YY-xxxx · TT reset mỗi ngày · sửa được.";
}

/** Placeholder ô mã trong máy. */
export function machineWeldCodePlaceholder(
  performedAt: string,
  machine?: { code?: string | null; name?: string | null; model?: string | null } | null,
): string {
  const scheme = detectMachineWeldNumbering(machine);
  if (scheme === "un5") return buildUn5MachineWeldCode(performedAt, 1) || "2026-9-11-001";
  if (scheme === "k922") return "1";
  return buildMachineWeldCode(performedAt, 1) || "25-10-26-0001";
}

/** Chuẩn hóa mã Autolisp: HT/HP/TT/TP + số (chấp nhận R.TT173, TT-166…). */
export function normalizeCoordinateCode(raw: string): string {
  const value = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!value) return "";
  const ref = /^R\.?(HT|HP|TT|TP)(\d+)/.exec(value);
  if (ref) return `${ref[1]}${padWeldSequence(Number(ref[2]))}`;
  const direct = /^(HT|HP|TT|TP)[-_/]?(\d+)$/.exec(value);
  if (direct) return `${direct[1]}${padWeldSequence(Number(direct[2]))}`;
  const embedded = /(HT|HP|TT|TP)(\d{1,6})/.exec(value);
  if (embedded) return `${embedded[1]}${padWeldSequence(Number(embedded[2]))}`;
  return value;
}

export function parseCoordinateCode(
  code: string,
): { prefix: CoordinateRailPrefix; seq: number; width: number } | null {
  const normalized = normalizeCoordinateCode(code);
  const match = /^(HT|HP|TT|TP)(\d+)$/.exec(normalized);
  if (!match || !isCoordinateRailPrefix(match[1])) return null;
  return { prefix: match[1], seq: Number(match[2]), width: match[2].length };
}

export const COORDINATE_RAIL_LABELS: Record<CoordinateRailPrefix, string> = {
  HT: "Hạ trái",
  HP: "Hạ phải",
  TT: "Thượng trái",
  TP: "Thượng phải",
};

/** Tách phần chữ + số đuôi (VD: HT012 → { prefix: "HT", seq: 12, width: 3 }). */
export function splitTrailingSequence(code: string): { prefix: string; seq: number; width: number } | null {
  const value = code.trim().toUpperCase();
  const match = /^(.*?)(\d+)$/.exec(value);
  if (!match) return null;
  return { prefix: match[1], seq: Number(match[2]), width: match[2].length };
}

/** Tăng số đuôi của mã (giữ độ rộng số). Hỗ trợ cả mã có dấu '-' trước số TT. */
export function bumpTrailingCode(code: string, by = 1): string {
  const parts = splitTrailingSequence(code);
  if (!parts || by < 1) return code.trim().toUpperCase();
  return `${parts.prefix}${padWeldSequence(parts.seq + by, parts.width)}`;
}

/**
 * Gợi ý mã tiếp theo từ danh sách đã có + mã gốc (nếu có).
 * Ưu tiên cùng tiền tố với `seed`; không có seed thì dùng `fallbackPrefix` + 0001.
 */
export function suggestNextTrailingCode(
  existingCodes: string[],
  seed?: string | null,
  fallbackPrefix = "",
  width = WELD_CODE_SEQUENCE_WIDTH,
): string {
  const seedParts = splitTrailingSequence(seed ?? "");
  const prefix = (seedParts?.prefix || fallbackPrefix.trim().toUpperCase() || "").toUpperCase();
  if (!prefix) return seed?.trim().toUpperCase() || "";
  const padWidth = seedParts?.width || width;
  let max = 0;
  for (const code of existingCodes) {
    const parts = splitTrailingSequence(code);
    if (!parts || parts.prefix !== prefix) continue;
    max = Math.max(max, parts.seq);
  }
  if (seedParts && seedParts.prefix === prefix) max = Math.max(max, seedParts.seq);
  return `${prefix}${padWeldSequence(max + 1, padWidth)}`;
}

export function isCoordinateRailPrefix(value: string): value is CoordinateRailPrefix {
  return (COORDINATE_RAIL_PREFIXES as readonly string[]).includes(value.trim().toUpperCase());
}

/** Gợi ý mã tọa độ: HTxxxx / HPxxxx / TTxxxx / TPxxxx theo từng dải ray. */
export function suggestCoordinateCode(
  railPrefix: string,
  existingCodes: string[],
  seed?: string | null,
): string {
  const prefix = railPrefix.trim().toUpperCase();
  if (!isCoordinateRailPrefix(prefix)) return "";
  return suggestNextTrailingCode(existingCodes, seed, prefix, WELD_CODE_SEQUENCE_WIDTH);
}

export type WeldCodeSourceRow = {
  id: string;
  ma_lich_su: string;
  cong_nghe_han: string;
  /** ISO date YYYY-MM-DD */
  isoDate: string;
  /** Mã dự án — tiền tố mã mối hàn */
  sitePrefix?: string | null;
  /** Loại mối hàn (giữ để tương thích — không còn vào mã) */
  loai_moi_han?: string | null;
};

/** Lập kế hoạch mã hệ thống mới (TT theo dự án + công nghệ, ngày trong mã). */
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
      const bySite = a.sitePrefix.localeCompare(b.sitePrefix);
      if (bySite !== 0) return bySite;
      const byMethod = a.cong_nghe_han.localeCompare(b.cong_nghe_han);
      if (byMethod !== 0) return byMethod;
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
      newCode: buildWeldCode(row.cong_nghe_han, row.isoDate, next, row.sitePrefix),
    };
  });
}
