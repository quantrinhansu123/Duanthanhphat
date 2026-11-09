/**
 * Quy tắc mã Lisp (điểm Autolisp HT/HP/TT/TP):
 *  1. Chạy liên tục trên một thanh ray (số +1 mỗi mối).
 *  2. Hai thanh ray của một tuyến (HT↔HP, TT↔TP) đánh số độc lập.
 * Thực tế hàn xen kẽ trái → phải theo từng lý trình, nên biết mã mối đầu của mỗi ray là sinh được cả dãy.
 */
import { parseCoordinateCode, type CoordinateRailPrefix } from "@/lib/weldCode";

const PAIR: Record<CoordinateRailPrefix, CoordinateRailPrefix> = { HT: "HP", HP: "HT", TT: "TP", TP: "TT" };
const LEFT = new Set<CoordinateRailPrefix>(["HT", "TT"]);

const format = (prefix: string, seq: number, width: number) => `${prefix}${String(seq).padStart(width, "0")}`;

/** Dãy mã xen kẽ [A0, B0, A1, B1, …] từ hai mã đầu (một mã mỗi ray của cùng tuyến); rỗng nếu hai mã không phải cặp ray. */
export function pairedLispSequence(firstA: string, firstB: string, count: number): string[] {
  const a = parseCoordinateCode(firstA), b = parseCoordinateCode(firstB);
  if (!a || !b || PAIR[a.prefix] !== b.prefix) return [];
  const out: string[] = [];
  for (let i = 0; out.length < count; i++) {
    out.push(format(a.prefix, a.seq + i, a.width));
    if (out.length < count) out.push(format(b.prefix, b.seq + i, b.width));
  }
  return out;
}

/**
 * Mã Lisp của mối kế tiếp, từ các mã đã hàn trong ngày (theo thứ tự hàn).
 * Mối kế tiếp nằm trên ray ít mối hơn (bằng nhau → ray bên kia mối vừa hàn), số = mã cuối của ray đó + 1.
 * Ray chưa có mối nào trong ngày thì chưa biết số đầu → null (nhập tay / quét QR mối đầu của ray đó).
 */
export function nextLispCode(dayCodes: string[]): string | null {
  const parsed = dayCodes.map((code) => parseCoordinateCode(code)).filter((p): p is NonNullable<typeof p> => p !== null);
  const last = parsed[parsed.length - 1];
  if (!last) return null;
  const other = PAIR[last.prefix];
  const onRail = (prefix: CoordinateRailPrefix) => parsed.filter((p) => p.prefix === prefix);
  const here = onRail(last.prefix), there = onRail(other);
  // Trái luôn hàn trước phải: bằng số mối → ray trái; phải còn thiếu → ray phải.
  const next = here.length === there.length ? (LEFT.has(last.prefix) ? last.prefix : other) : here.length > there.length ? other : last.prefix;
  const rail = onRail(next);
  const tail = rail[rail.length - 1];
  return tail ? format(next, tail.seq + 1, tail.width) : null;
}
