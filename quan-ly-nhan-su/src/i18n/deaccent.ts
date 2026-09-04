/** Bỏ toàn bộ dấu tiếng Việt, giữ nguyên chữ cái gốc. "Thành Phát" -> "Thanh Phat". */
export function deaccent(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFC");
}

const VIETNAMESE_RE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

export function hasVietnameseDiacritics(input: string): boolean {
  return VIETNAMESE_RE.test(input);
}
