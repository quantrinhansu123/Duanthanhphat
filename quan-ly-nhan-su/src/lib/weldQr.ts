import { normalizeCoordinateCode } from "@/lib/weldCode";

/** Thông tin đọc được từ mã QR dán trên ray / bảng vị trí. */
export type WeldQrPayload = {
  /** Mã Autolisp chuẩn hóa, VD HT0001. */
  lispCode: string;
  /** Mã hiện trường in cạnh QR, VD FBW-30-10-0001 (nếu có). */
  siteCode: string;
  /** Mã máy theo ngày, VD 30-10-26-01 (nếu có). */
  machineCode: string;
};

const LISP = /(?<![A-Z0-9])(HT|HP|TT|TP)[-_/ ]?(\d{1,6})(?!\d)/;
const SITE_CODE = /(?<![A-Z0-9])([A-Z]{2,4}-\d{2}-\d{2}-\d{3,5})(?![\d-])/;
const MACHINE_CODE = /(?<![\d-])(\d{2}-\d{2}-\d{2}-\d{2,5})(?![\d-])/;

/**
 * Đọc nội dung QR (chuỗi thuần, nhiều dòng, JSON hay URL đều được) → mã Lisp + mã hiện trường + mã máy.
 * Không có mã Lisp thì trả null (QR không phải của vị trí hàn).
 */
export function parseWeldQr(raw: string): WeldQrPayload | null {
  const text = raw.trim().toUpperCase();
  if (!text) return null;
  const lisp = LISP.exec(text);
  if (!lisp) return null;
  return {
    lispCode: normalizeCoordinateCode(`${lisp[1]}${lisp[2]}`),
    siteCode: SITE_CODE.exec(text)?.[1] ?? "",
    machineCode: MACHINE_CODE.exec(text)?.[1] ?? "",
  };
}
