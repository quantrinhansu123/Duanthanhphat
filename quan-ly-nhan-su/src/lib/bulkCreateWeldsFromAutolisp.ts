/**
 * Tạo nhật ký mối hàn hàng loạt từ điểm Autolisp (toa_do).
 * Neo vị trí = ma_diem; mã hệ thống / sơn / máy sinh tuần tự theo rule hiện có.
 */

import type { MapPoint } from "@/data/mapPoints";
import {
  COORDINATE_RAIL_LABELS,
  COORDINATE_RAIL_PREFIXES,
  buildWeldCodePrefix,
  fieldCodeFromSystemCode,
  normalizeCoordinateCode,
  parseCoordinateCode,
  suggestMachineWeldCodeForMachine,
  suggestWeldCode,
  type CoordinateRailPrefix,
} from "@/lib/weldCode";
import {
  insertWeldJournalEntry,
  type WeldJournalInsert,
  type WeldReportRow,
  type WeldShift,
  type WeldTestStatus,
} from "@/lib/weldReportData";

export const AUTOLISP_BULK_MAX = 200;

export type AutolispBulkContext = {
  performedAt: string;
  du_an_id: string;
  sitePrefix: string;
  tho_han_id: string;
  may_id: string;
  machine?: { code?: string | null; name?: string | null; model?: string | null } | null;
  loai_ray: string;
  cong_nghe_han: WeldReportRow["cong_nghe_han"];
  loai_moi_han: WeldReportRow["loai_moi_han"];
  chung_chi_su_dung: string;
  ca_han?: WeldShift;
  tinh_trang_thi_nghiem?: WeldTestStatus;
};

export type AutolispBulkFilter = {
  prefixes: CoordinateRailPrefix[];
  /** Mét lý trình (null = không lọc). */
  chainageFromM?: number | null;
  chainageToM?: number | null;
  projectId?: string | null;
  onlyUnlinked?: boolean;
};

export type AutolispBulkPreviewRow = {
  pointId: string;
  maDiem: string;
  prefix: CoordinateRailPrefix;
  lyTrinh: string;
  kinhDo: number;
  viDo: number;
  selected: boolean;
  skipReason: string | null;
  ma_lich_su: string;
  ma_hien_truong: string;
  ten_moi_han_theo_may: string;
};

/** Parse Km dạng 0+850 / Km0+850.00 → mét. */
export function parseAutolispChainageMetres(raw: string | null | undefined): number | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const match = /(?:Km)?\s*(\d+)\+(\d+(?:[.,]\d+)?)/i.exec(value.replace(/\s+/g, ""));
  if (!match) return null;
  const km = Number(match[1]);
  const metres = Number(match[2].replace(",", "."));
  if (!Number.isFinite(km) || !Number.isFinite(metres)) return null;
  return km * 1000 + metres;
}

export function filterAutolispPointsForBulk(
  points: MapPoint[],
  filter: AutolispBulkFilter,
): MapPoint[] {
  const prefixes = new Set(
    (filter.prefixes.length ? filter.prefixes : [...COORDINATE_RAIL_PREFIXES]).map((p) => p),
  );
  const onlyUnlinked = filter.onlyUnlinked !== false;
  const fromM = filter.chainageFromM ?? null;
  const toM = filter.chainageToM ?? null;
  const projectId = filter.projectId?.trim() || null;

  return points.filter((point) => {
    const code = normalizeCoordinateCode(point.code) || point.code.trim().toUpperCase();
    const parsed = parseCoordinateCode(code);
    if (!parsed || !prefixes.has(parsed.prefix)) return false;
    if (onlyUnlinked && (point.isLinked || point.weldId)) return false;
    if (projectId && point.projectId && point.projectId !== projectId) return false;
    if (fromM !== null || toM !== null) {
      const metres = parseAutolispChainageMetres(point.chainage);
      if (metres === null) return false;
      if (fromM !== null && metres < fromM) return false;
      if (toM !== null && metres > toM) return false;
    }
    return true;
  });
}

function sortAutolispPoints(points: MapPoint[]): MapPoint[] {
  return [...points].sort((a, b) => {
    const ca = parseCoordinateCode(normalizeCoordinateCode(a.code) || a.code);
    const cb = parseCoordinateCode(normalizeCoordinateCode(b.code) || b.code);
    if (ca && cb && ca.prefix !== cb.prefix) {
      return COORDINATE_RAIL_PREFIXES.indexOf(ca.prefix) - COORDINATE_RAIL_PREFIXES.indexOf(cb.prefix);
    }
    const ma = parseAutolispChainageMetres(a.chainage);
    const mb = parseAutolispChainageMetres(b.chainage);
    if (ma !== null && mb !== null && ma !== mb) return ma - mb;
    if (ca && cb && ca.seq !== cb.seq) return ca.seq - cb.seq;
    return a.code.localeCompare(b.code, "vi");
  });
}

/**
 * Sinh bảng xem trước: cấp mã hệ thống / sơn / máy tuần tự cho các điểm chọn được.
 * Điểm đã liên kết → skipReason, không cấp mã.
 */
export function buildAutolispBulkPreview(
  points: MapPoint[],
  context: AutolispBulkContext,
  existingSystemCodes: string[],
  existingMachineCodes: string[],
): AutolispBulkPreviewRow[] {
  const sorted = sortAutolispPoints(points);
  const usedSystem = new Set(existingSystemCodes.map((c) => c.trim().toUpperCase()).filter(Boolean));
  const usedMachine = new Set(existingMachineCodes.map((c) => c.trim().toUpperCase()).filter(Boolean));
  const performedAt = context.performedAt.includes("T")
    ? context.performedAt
    : `${context.performedAt.slice(0, 10)}T08:00`;

  const rows: AutolispBulkPreviewRow[] = [];
  for (const point of sorted) {
    const maDiem = normalizeCoordinateCode(point.code) || point.code.trim().toUpperCase();
    const parsed = parseCoordinateCode(maDiem);
    if (!parsed) continue;

    const linked = Boolean(point.isLinked || point.weldId);
    if (linked) {
      rows.push({
        pointId: point.id,
        maDiem,
        prefix: parsed.prefix,
        lyTrinh: point.chainage || "",
        kinhDo: point.longitude,
        viDo: point.latitude,
        selected: false,
        skipReason: point.weldCode
          ? `Đã gắn ${point.weldCode}`
          : "Đã liên kết nhật ký",
        ma_lich_su: "",
        ma_hien_truong: "",
        ten_moi_han_theo_may: "",
      });
      continue;
    }

    const ma_lich_su = suggestWeldCode(
      context.cong_nghe_han,
      performedAt,
      [...usedSystem],
      context.sitePrefix,
      context.loai_moi_han,
    );
    if (ma_lich_su) usedSystem.add(ma_lich_su.toUpperCase());
    const ma_hien_truong = fieldCodeFromSystemCode(ma_lich_su) || "";
    const ten_moi_han_theo_may = suggestMachineWeldCodeForMachine(
      performedAt.slice(0, 10),
      [...usedMachine],
      context.machine,
    );
    if (ten_moi_han_theo_may) usedMachine.add(ten_moi_han_theo_may.toUpperCase());

    rows.push({
      pointId: point.id,
      maDiem,
      prefix: parsed.prefix,
      lyTrinh: point.chainage || "",
      kinhDo: point.longitude,
      viDo: point.latitude,
      selected: true,
      skipReason: null,
      ma_lich_su,
      ma_hien_truong,
      ten_moi_han_theo_may,
    });
  }
  return rows;
}

/** Sau khi bỏ tick / sửa mã máy: cấp lại mã hệ thống & sơn cho các dòng còn chọn (giữ mã máy đã sửa). */
export function resequenceAutolispBulkPreview(
  rows: AutolispBulkPreviewRow[],
  context: AutolispBulkContext,
  existingSystemCodes: string[],
  existingMachineCodes: string[],
  options?: { regenerateMachine?: boolean },
): AutolispBulkPreviewRow[] {
  const regenerateMachine = options?.regenerateMachine !== false;
  const usedSystem = new Set(existingSystemCodes.map((c) => c.trim().toUpperCase()).filter(Boolean));
  const usedMachine = new Set(existingMachineCodes.map((c) => c.trim().toUpperCase()).filter(Boolean));
  const performedAt = context.performedAt.includes("T")
    ? context.performedAt
    : `${context.performedAt.slice(0, 10)}T08:00`;

  return rows.map((row) => {
    if (row.skipReason || !row.selected) {
      return {
        ...row,
        selected: row.skipReason ? false : row.selected,
        ma_lich_su: row.skipReason ? "" : row.ma_lich_su,
        ma_hien_truong: row.skipReason ? "" : row.ma_hien_truong,
        ten_moi_han_theo_may: row.skipReason ? "" : row.ten_moi_han_theo_may,
      };
    }
    const ma_lich_su = suggestWeldCode(
      context.cong_nghe_han,
      performedAt,
      [...usedSystem],
      context.sitePrefix,
      context.loai_moi_han,
    );
    if (ma_lich_su) usedSystem.add(ma_lich_su.toUpperCase());
    const ma_hien_truong = fieldCodeFromSystemCode(ma_lich_su) || "";
    let ten_moi_han_theo_may = row.ten_moi_han_theo_may.trim().toUpperCase();
    if (regenerateMachine || !ten_moi_han_theo_may) {
      ten_moi_han_theo_may = suggestMachineWeldCodeForMachine(
        performedAt.slice(0, 10),
        [...usedMachine],
        context.machine,
      );
    }
    if (ten_moi_han_theo_may) usedMachine.add(ten_moi_han_theo_may.toUpperCase());
    return { ...row, ma_lich_su, ma_hien_truong, ten_moi_han_theo_may };
  });
}

export function validateAutolispBulkContext(context: AutolispBulkContext): string | null {
  if (!context.du_an_id.trim()) return "Chọn dự án.";
  if (!context.tho_han_id.trim()) return "Chọn thợ hàn.";
  if (!context.may_id.trim()) return "Chọn máy hàn.";
  if (!context.performedAt.trim().slice(0, 10)) return "Chọn ngày hàn.";
  if (!buildWeldCodePrefix(context.cong_nghe_han, context.performedAt, context.sitePrefix, context.loai_moi_han)) {
    return "Không sinh được tiền tố mã hệ thống — kiểm tra ngày và công nghệ.";
  }
  return null;
}

export type AutolispBulkCommitResult = {
  created: number;
  skipped: number;
  errors: string[];
};

export async function commitAutolispBulkWelds(
  rows: AutolispBulkPreviewRow[],
  context: AutolispBulkContext,
  onProgress?: (done: number, total: number) => void,
): Promise<AutolispBulkCommitResult> {
  const selected = rows.filter((row) => row.selected && !row.skipReason && row.ma_lich_su);
  if (selected.length > AUTOLISP_BULK_MAX) {
    return {
      created: 0,
      skipped: rows.length - selected.length,
      errors: [`Chỉ tạo tối đa ${AUTOLISP_BULK_MAX} mối mỗi lần. Đang chọn ${selected.length}.`],
    };
  }

  const date = context.performedAt.slice(0, 10);
  const year = Number(date.slice(0, 4)) || new Date().getFullYear();
  const status: WeldTestStatus = context.tinh_trang_thi_nghiem ?? "Chờ thí nghiệm";
  let created = 0;
  const errors: string[] = [];
  const skipped = rows.length - selected.length;

  for (let index = 0; index < selected.length; index += 1) {
    const row = selected[index];
    const payload: WeldJournalInsert = {
      ma_lich_su: row.ma_lich_su,
      du_an_id: context.du_an_id,
      tho_han_id: context.tho_han_id,
      nam_thuc_hien: year,
      ngay_thuc_hien: date,
      loai_ray: context.loai_ray,
      loai_moi_han: context.loai_moi_han,
      cong_nghe_han: context.cong_nghe_han,
      so_luong_loi: 0,
      ma_khuyet_tat: [],
      tinh_trang_thi_nghiem: status,
      nguyen_nhan_loi: null,
      ghi_chu: `Autolisp ${row.maDiem}`,
      moi_han_lien_ket: null,
      may_id: context.may_id,
      chung_chi_su_dung: context.chung_chi_su_dung.trim(),
      hach_toan: "HT-SX01",
      toa_do_id: row.pointId,
      kinh_do: row.kinhDo,
      vi_do: row.viDo,
      ly_trinh: row.lyTrinh || null,
      ca_han: context.ca_han ?? "Ca 1",
      ma_hien_truong: row.ma_hien_truong || null,
      ten_moi_han_theo_may: row.ten_moi_han_theo_may || null,
    };
    try {
      await insertWeldJournalEntry(payload);
      created += 1;
    } catch (err) {
      errors.push(
        `${row.maDiem}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    onProgress?.(index + 1, selected.length);
  }

  return { created, skipped, errors };
}

export function autolispPrefixLabel(prefix: CoordinateRailPrefix) {
  return `${prefix} · ${COORDINATE_RAIL_LABELS[prefix]}`;
}

export { COORDINATE_RAIL_PREFIXES };
