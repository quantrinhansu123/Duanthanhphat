import { normalizeCoordinateCode } from "@/lib/weldCode";

/** Thông tin đọc được từ mã QR dán trên ray / bảng vị trí. */
export type WeldQrPayload = {
  /** Mã Autolisp chuẩn hóa, VD HT0001. */
  lispCode: string;
  /** Mã hệ thống của mối, VD PQ-FBW-30-10-26-0001 (nếu có — để khớp mã đã in trên tem). */
  systemCode: string;
  /** Mã hiện trường in cạnh QR, VD FBW-30-10-26-0001 hoặc FBW-30-10-0001 (nếu có). */
  siteCode: string;
  /** Mã máy theo ngày, VD 30-10-26-01 (nếu có). */
  machineCode: string;
};

const LISP = /(?<![A-Z0-9])(HT|HP|TT|TP)[-_/ ]?(\d{1,6})(?!\d)/;
// {mã DA}-{CN}-{DD}-{MM}-{YY}-{xxxx}
const SYSTEM_CODE = /(?<![A-Z0-9-])([A-Z0-9]{1,8}-[A-Z]{2,4}-\d{2}-\d{2}-\d{2}-\d{3,5})(?![\d-])/;
// {CN}-{DD}-{MM}-{YY}-{xxxx} hoặc bản không có năm {CN}-{DD}-{MM}-{xxxx}
const SITE_CODE = /(?<![A-Z0-9-])([A-Z]{2,4}-\d{2}-\d{2}(?:-\d{2})?-\d{3,5})(?![\d-])/;
const MACHINE_CODE = /(?<![\d-])(\d{2}-\d{2}-\d{2}-\d{2,5})(?![\d-])/;

/** Nội dung ghi vào QR: mỗi mã một dòng, mã Lisp đứng đầu. */
export function buildWeldQrText(parts: { lispCode: string; systemCode?: string; siteCode?: string; machineCode?: string }) {
  return [parts.lispCode, parts.systemCode, parts.siteCode, parts.machineCode].filter(Boolean).join("\n");
}

/**
 * Đọc nội dung QR (chuỗi thuần, nhiều dòng, JSON hay URL đều được) → mã Lisp + các mã đi kèm.
 * Không có mã Lisp thì trả null (QR không phải của vị trí hàn).
 */
export function parseWeldQr(raw: string): WeldQrPayload | null {
  const text = raw.trim().toUpperCase();
  if (!text) return null;
  const lisp = LISP.exec(text);
  if (!lisp) return null;
  const systemCode = SYSTEM_CODE.exec(text)?.[1] ?? "";
  // Mã hiện trường tìm sau khi bỏ mã hệ thống, tránh khớp nhầm đuôi của mã hệ thống.
  const rest = systemCode ? text.replace(systemCode, " ") : text;
  return {
    lispCode: normalizeCoordinateCode(`${lisp[1]}${lisp[2]}`),
    systemCode,
    siteCode: SITE_CODE.exec(rest)?.[1] ?? "",
    machineCode: MACHINE_CODE.exec(rest)?.[1] ?? "",
  };
}
