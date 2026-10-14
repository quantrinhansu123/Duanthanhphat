/** Chuẩn hóa ngày về YYYY-MM-DD để so sánh. Nhận ISO và dd/mm/yyyy. */
export function sortableDateKey(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const vi = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (vi) return `${vi[3]}-${vi[2].padStart(2, "0")}-${vi[1].padStart(2, "0")}`;
  return "";
}

/** Ngày gần nhất đứng trước. Dòng không có ngày đứng sau. */
export function compareNewestDate(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const left = sortableDateKey(a);
  const right = sortableDateKey(b);
  if (left && right && left !== right) return right.localeCompare(left);
  if (right && !left) return 1;
  if (left && !right) return -1;
  return 0;
}
